import { createRequire } from "node:module";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";

// Quiz engine (Phase 4) against a fresh database with 10 known questions:
// MAINT-1..6 (subject MAINT, manual OM-A) and PILOT-1..4 (PILOT, OM-C).
// Every correct answer is A.
const require = createRequire(import.meta.url);
const main = path.resolve(__dirname, "../../electron/main");
const { createQuizService } = require(path.join(main, "quiz-service.js"));
const { createQuestionBankImporter } = require(path.join(main, "question-bank.js"));
let db: TestDatabase;
let quizzes: any;
let mech: string;
let other: string;

// A fixed random sequence, so shuffles are repeatable.
function seededRandom(seed = 42) {
    let state = seed;
    return () => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648; };
}

beforeAll(async () => {
    db = createTestDatabase();
    db.run("tsx", ["prisma/seed.ts"]);
    const header = "questionId,questionText,answerA,answerB,answerC,answerD,correctAnswer,answer,document,reference,category,subject,section,difficulty,sourceRevision,active";
    const row = (id: string, subject: string, doc: string) => `${id},Question ${id}?,Right ${id},Wrong B,Wrong C,Wrong D,A,Right ${id},${doc},${doc} ref ${id},Cat,${subject},,Easy,,Yes`;
    const csv = [header,
        ...[1, 2, 3, 4, 5, 6].map(n => row(`MAINT-${n}`, "MAINT", "OM-A")),
        ...[1, 2, 3, 4].map(n => row(`PILOT-${n}`, "PILOT", "OM-C"))].join("\n");
    const imported = await createQuestionBankImporter(db.prisma).importCsv(csv);
    expect(imported).toMatchObject({ success: true, created: 10 });
    mech = (await db.prisma.user.create({ data: { username: "mech1", passwordHash: "x", firstName: "T", lastName: "M", status: "ACTIVE" } })).id;
    other = (await db.prisma.user.create({ data: { username: "pilot1", passwordHash: "x", firstName: "P", lastName: "P", status: "ACTIVE" } })).id;
    quizzes = createQuizService(db.prisma, { random: seededRandom() });
});
afterAll(async () => { await db.cleanup(); });

const subjectId = async (code: string) => (await db.prisma.subject.findUniqueOrThrow({ where: { code } })).id;
const documentId = async (code: string) => (await db.prisma.document.findUniqueOrThrow({ where: { code } })).id;
const start = async (userId: string, input: any) => {
    const started = await quizzes.start(userId, input);
    expect(started.success, started.message).toBe(true);
    return (await quizzes.get(userId, started.sessionId)).quiz;
};

describe("quiz options", () => {
    it("list subjects and manuals that have questions, and the quiz settings", async () => {
        const o = await quizzes.options();
        expect(o.subjects.map((s: any) => [s.code, s.questionCount])).toEqual([["MAINT", 6], ["PILOT", 4]]);
        expect(o.documents.map((d: any) => [d.code, d.questionCount])).toEqual([["OM-A", 6], ["OM-C", 4]]);
        expect(o).toMatchObject({ total: 10, questionCount: 20, certificationQuestionCount: 50, passMarkPercent: 80 });
    });
});

describe("a random practice quiz", () => {
    it("draws from the chosen subject, with each question's options shuffled", async () => {
        const quiz = await start(mech, { type: "RANDOM", subjectId: await subjectId("PILOT"), count: 3 });
        expect(quiz.name).toBe("Random quiz · PILOT");
        expect(quiz.items).toHaveLength(3);
        for (const item of quiz.items) {
            expect(item.externalId).toMatch(/^PILOT-/);
            expect(item.options.map((o: any) => o.label)).toEqual(["A", "B", "C", "D"]);
            expect([...item.options.map((o: any) => o.value)].sort()).toEqual(["A", "B", "C", "D"]);
            expect(item.correctAnswer).toBeNull();
        }
    });

    it("says when fewer questions match than were asked for", async () => {
        const started = await quizzes.start(mech, { type: "RANDOM", documentId: await documentId("OM-C"), count: 10 });
        expect(started.note).toBe("Only 4 questions match, so this quiz has 4.");
    });

    it("shows right or wrong and the reference after each answer, and the answer is final", async () => {
        const quiz = await start(mech, { type: "RANDOM", subjectId: await subjectId("MAINT"), count: 2 });
        const [first, second] = quiz.items;
        const afterRight = (await quizzes.answer(mech, quiz.id, first.questionId, "A")).quiz.items[0];
        expect(afterRight).toMatchObject({ selected: "A", correct: true, correctAnswer: "A", reference: `OM-A ref ${first.externalId}` });
        expect(await quizzes.answer(mech, quiz.id, first.questionId, "B")).toEqual({ success: false, message: "This question is already answered." });
        const afterWrong = (await quizzes.answer(mech, quiz.id, second.questionId, "C")).quiz.items[1];
        expect(afterWrong).toMatchObject({ correct: false, correctAnswer: "A" });

        const done = (await quizzes.finish(mech, quiz.id)).quiz;
        expect(done).toMatchObject({ completed: true, scorePercent: 50, passed: false, passMarkPercent: 80, correctCount: 1 });
        expect(await quizzes.answer(mech, quiz.id, second.questionId, "A")).toEqual({ success: false, message: "This quiz is already finished." });
        expect(await db.prisma.auditLog.count({ where: { action: "QUIZ_COMPLETED", entityId: quiz.id } })).toBe(1);
    });
});

describe("a certification quiz", () => {
    it("hides results until submitted, lets answers change, and counts unanswered as wrong", async () => {
        const quiz = await start(mech, { type: "CERTIFICATION", documentId: await documentId("OM-A") });
        expect(quiz.items).toHaveLength(6);
        const [a, b] = quiz.items;
        await quizzes.answer(mech, quiz.id, a.questionId, "B");
        const changed = (await quizzes.answer(mech, quiz.id, a.questionId, "A")).quiz.items[0];
        expect(changed).toMatchObject({ selected: "A", correct: null, correctAnswer: null, reference: null });
        await quizzes.answer(mech, quiz.id, b.questionId, "A");
        await quizzes.flag(mech, quiz.id, b.questionId, true);
        const done = (await quizzes.finish(mech, quiz.id)).quiz;
        expect(done).toMatchObject({ scorePercent: 33.3, passed: false, answeredCount: 2, correctCount: 2 });
        expect(done.items[0]).toMatchObject({ correct: true, correctAnswer: "A", reference: expect.stringContaining("OM-A ref") });
        expect(done.items[1].flagged).toBe(true);
    });
});

describe("unseen and weak area quizzes", () => {
    it("unseen leaves out questions already answered, and says when none are left", async () => {
        const answered = new Set((await db.prisma.quizAnswer.findMany({ where: { session: { userId: mech } } })).map(a => a.questionId));
        const quiz = await start(mech, { type: "UNSEEN", subjectId: await subjectId("MAINT"), count: 20 });
        expect(quiz.items.length).toBeGreaterThan(0);
        expect(quiz.items.some((i: any) => answered.has(i.questionId))).toBe(false);
        for (const item of quiz.items) await quizzes.answer(mech, quiz.id, item.questionId, "A");
        await quizzes.finish(mech, quiz.id);
        expect(await quizzes.start(mech, { type: "UNSEEN", subjectId: await subjectId("MAINT") })).toEqual({
            success: false, message: "You have answered every question in this selection at least once. Try a Random or Weak Area quiz."
        });
    });

    it("weak area needs a miss first, then brings back the missed questions", async () => {
        expect(await quizzes.start(other, { type: "WEAK_AREA" })).toEqual({ success: false, message: "No weak areas yet: you have not missed any questions in this selection." });
        const first = await start(other, { type: "RANDOM", documentId: await documentId("OM-C"), count: 4 });
        await quizzes.answer(other, first.id, first.items[0].questionId, "D");
        await quizzes.answer(other, first.id, first.items[1].questionId, "A");
        await quizzes.finish(other, first.id);
        const weak = await start(other, { type: "WEAK_AREA" });
        expect(weak.items.map((i: any) => i.questionId)).toEqual([first.items[0].questionId]);
    });
});

describe("privacy and history", () => {
    it("keeps each person's quizzes to themselves, newest first in history", async () => {
        const mine = await quizzes.history(mech);
        expect(mine.length).toBeGreaterThan(3);
        expect(await quizzes.get(other, mine[0].id)).toEqual({ success: false, message: "Quiz not found." });
        expect(mine[0].startedAt >= mine[mine.length - 1].startedAt).toBe(true);
        expect(await quizzes.start(null, { type: "RANDOM" })).toEqual({ success: false, message: "Authentication required" });
    });

    it("refuses a bad type or count", async () => {
        expect(await quizzes.start(mech, { type: "EASY" })).toEqual({ success: false, message: "Choose a quiz type." });
        expect(await quizzes.start(mech, { type: "RANDOM", count: 0 })).toEqual({ success: false, message: "Choose between 1 and 200 questions." });
    });
});
