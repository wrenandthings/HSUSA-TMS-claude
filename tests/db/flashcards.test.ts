import { createRequire } from "node:module";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";

// Flashcards (Phase 5) against a fresh database with 6 known questions:
// MAINT-1..4 (subject MAINT, manual OM-A) and PILOT-1..2 (PILOT, OM-C).
const require = createRequire(import.meta.url);
const main = path.resolve(__dirname, "../../electron/main");
const { createFlashcardService } = require(path.join(main, "flashcard-service.js"));
const { createQuizService } = require(path.join(main, "quiz-service.js"));
const { createQuestionBankImporter } = require(path.join(main, "question-bank.js"));
let db: TestDatabase;
let cards: any;
let mech: string;
let other: string;

beforeAll(async () => {
    db = createTestDatabase();
    db.run("tsx", ["prisma/seed.ts"]);
    const header = "questionId,questionText,answerA,answerB,answerC,answerD,correctAnswer,answer,document,reference,category,subject,section,difficulty,sourceRevision,active";
    const row = (id: string, subject: string, doc: string) => `${id},Question ${id}?,Right ${id},Wrong B,Wrong C,Wrong D,A,Right ${id},${doc},${doc} ref ${id},Cat,${subject},,Easy,,Yes`;
    const csv = [header, ...[1, 2, 3, 4].map(n => row(`MAINT-${n}`, "MAINT", "OM-A")), ...[1, 2].map(n => row(`PILOT-${n}`, "PILOT", "OM-C"))].join("\n");
    expect(await createQuestionBankImporter(db.prisma).importCsv(csv)).toMatchObject({ success: true, created: 6 });
    mech = (await db.prisma.user.create({ data: { username: "mech1", passwordHash: "x", firstName: "T", lastName: "M", status: "ACTIVE" } })).id;
    other = (await db.prisma.user.create({ data: { username: "pilot1", passwordHash: "x", firstName: "P", lastName: "P", status: "ACTIVE" } })).id;
    cards = createFlashcardService(db.prisma, { random: () => 0.5 });
});
afterAll(async () => { await db.cleanup(); });

const subjectId = async (code: string) => (await db.prisma.subject.findUniqueOrThrow({ where: { code } })).id;
const open = async (input: any, user = mech) => {
    const started = await cards.start(user, input);
    expect(started.success, started.message).toBe(true);
    return { ...(await cards.get(user, started.sessionId)).session, note: started.note };
};

describe("flashcards by subject", () => {
    it("shows the question on the front and the right answer and reference on the back", async () => {
        const set = await open({ mode: "SUBJECT", subjectId: await subjectId("PILOT"), count: 10 });
        expect(set.name).toBe("Flashcards: PILOT");
        expect(set.cards).toHaveLength(2);
        expect(set.note).toBe("Only 2 cards match, so this set has 2.");
        const card = set.cards.find((c: any) => c.externalId === "PILOT-1");
        expect(card).toMatchObject({ front: "Question PILOT-1?", back: "Right PILOT-1", reference: "OM-C ref PILOT-1", rating: null });
    });

    it("saves ratings, replaces a changed rating, and finishes when every card is rated", async () => {
        const set = await open({ mode: "SUBJECT", subjectId: await subjectId("PILOT") });
        const [a, b] = set.cards;
        expect(await cards.rate(mech, set.id, a.questionId, "UNSURE")).toEqual({ success: true, completed: false });
        expect(await cards.rate(mech, set.id, a.questionId, "KNOW_IT")).toEqual({ success: true, completed: false });
        expect(await cards.rate(mech, set.id, b.questionId, "MISSED")).toEqual({ success: true, completed: true });
        const after = (await cards.get(mech, set.id)).session;
        expect(after.completed).toBe(true);
        expect(after.counts).toEqual({ KNOW_IT: 1, UNSURE: 0, MISSED: 1, left: 0 });
        expect(await cards.rate(mech, set.id, a.questionId, "MAYBE")).toEqual({ success: false, message: "Unknown rating." });
    });

    it("puts cards last rated Missed first next time", async () => {
        const missed = (await db.prisma.flashcardHistory.findFirstOrThrow({ where: { userId: mech, status: "MISSED" } })).questionId;
        const set = await open({ mode: "SUBJECT", subjectId: await subjectId("PILOT") });
        expect(set.cards[0].questionId).toBe(missed);
    });

    it("keeps each person's cards private", async () => {
        const started = await cards.start(mech, { mode: "SUBJECT" });
        expect(await cards.get(other, started.sessionId)).toEqual({ success: false, message: "Flashcards not found." });
        expect((await cards.rate(other, started.sessionId, "x", "KNOW_IT")).message).toBe("Flashcards not found.");
    });
});

describe("weak area and custom flashcards", () => {
    it("builds weak areas from Missed and Unsure cards and missed quiz questions", async () => {
        expect((await cards.start(other, { mode: "WEAK_AREA" })).message).toBe("No weak areas yet: nothing rated Missed or Unsure, and no quiz questions missed in this choice.");
        const set = await open({ mode: "WEAK_AREA" });
        expect(set.cards.map((c: any) => c.externalId)).toEqual([expect.stringMatching(/^PILOT-/)]);
    });

    it("makes a set from the questions missed in a quiz", async () => {
        const quizzes = createQuizService(db.prisma, { random: () => 0.5 });
        const quiz = await quizzes.start(other, { type: "RANDOM", subjectId: await subjectId("MAINT"), count: 4 });
        const view = (await quizzes.get(other, quiz.sessionId)).quiz;
        for (const [i, item] of view.items.entries()) {
            const wrong = item.options.find((o: any) => o.value !== "A").value;
            await quizzes.answer(other, quiz.sessionId, item.questionId, i < 2 ? wrong : "A");
        }
        const set = await open({ mode: "CUSTOM", quizSessionId: quiz.sessionId }, other);
        expect(set.cards).toHaveLength(2);
        expect(set.name).toMatch(/^Missed in /);
        expect((await cards.start(mech, { mode: "CUSTOM", quizSessionId: quiz.sessionId })).message).toBe("Quiz not found.");
    });
});

describe("history and retention", () => {
    it("lists sessions and the share of reviewed cards known, by subject", async () => {
        const history = await cards.history(mech);
        expect(history.sessions.length).toBeGreaterThanOrEqual(3);
        const retention = await cards.retention(mech);
        expect(retention.subjects).toEqual([expect.objectContaining({ code: "PILOT", reviewed: 2, KNOW_IT: 1, MISSED: 1, knowPercent: 50 })]);
        expect(retention.overall).toEqual({ reviewed: 2, knowPercent: 50 });
        expect(await cards.retention(other)).toEqual({ success: true, subjects: [], overall: null });
    });
});
