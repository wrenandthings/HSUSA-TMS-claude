import { createRequire } from "node:module";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";

// Progress (Phase 8) against a database with 10 MAINT questions (sections
// Engines x6 and Rotors x4) and 4 PILOT questions. Every correct answer is A.
const require = createRequire(import.meta.url);
const main = path.resolve(__dirname, "../../electron/main");
const { createAnalyticsService } = require(path.join(main, "analytics-service.js"));
const { createQuizService } = require(path.join(main, "quiz-service.js"));
const { createQuestionBankImporter } = require(path.join(main, "question-bank.js"));
let db: TestDatabase;
let analytics: any;
let quizzes: any;
let mech: string;
let manager: string;
const now = () => new Date(2026, 10, 21, 12, 0, 0);

beforeAll(async () => {
    db = createTestDatabase();
    db.run("tsx", ["prisma/seed.ts"]);
    const header = "questionId,questionText,answerA,answerB,answerC,answerD,correctAnswer,answer,document,reference,category,subject,section,difficulty,sourceRevision,active";
    const row = (id: string, subject: string, section: string) => `${id},Question ${id}?,Right,Wrong B,Wrong C,Wrong D,A,Right,OM-A,ref,Cat,${subject},${section},Easy,,Yes`;
    const csv = [header,
        ...[1, 2, 3, 4, 5, 6].map(n => row(`MAINT-${n}`, "MAINT", "Engines")),
        ...[7, 8, 9, 10].map(n => row(`MAINT-${n}`, "MAINT", "Rotors")),
        ...[1, 2, 3, 4].map(n => row(`PILOT-${n}`, "PILOT", "Flight"))].join("\n");
    expect(await createQuestionBankImporter(db.prisma).importCsv(csv)).toMatchObject({ success: true, created: 14 });
    mech = (await db.prisma.user.create({ data: { username: "mech1", passwordHash: "x", firstName: "Max", lastName: "Mech", status: "ACTIVE" } })).id;
    const tm = await db.prisma.role.findUniqueOrThrow({ where: { roleName: "Training_Manager" } });
    manager = (await db.prisma.user.create({ data: { username: "tm1", passwordHash: "x", firstName: "Tess", lastName: "M", status: "ACTIVE", userRoles: { create: { roleId: tm.id } } } })).id;
    analytics = createAnalyticsService(db.prisma, { now });
    quizzes = createQuizService(db.prisma, { random: () => 0.5, now });
});
afterAll(async () => { await db.cleanup(); });

// Answers the given MAINT questions in one quiz: right for those in `right`.
async function answer(ids: string[], right: string[]) {
    const subject = (await db.prisma.subject.findUniqueOrThrow({ where: { code: "MAINT" } })).id;
    const quiz = await quizzes.start(mech, { type: "RANDOM", subjectId: subject, count: 10 });
    for (const item of (await quizzes.get(mech, quiz.sessionId)).quiz.items) {
        if (!ids.includes(item.externalId)) continue;
        const pick = right.includes(item.externalId) ? "A" : item.options.find((o: any) => o.value !== "A").value;
        await quizzes.answer(mech, quiz.sessionId, item.questionId, pick);
    }
}
const maint = (p: any) => p.subjects.find((s: any) => s.code === "MAINT");

describe("coverage and knowledge", () => {
    it("starts at zero with knowledge hidden", async () => {
        const p = await analytics.progress(mech);
        expect(p).toMatchObject({ success: true, coverage: 0, knowledge: null, readiness: null, seen: 0, totalQuestions: 14, canSeeOthers: false });
        expect(maint(p)).toMatchObject({ total: 10, seen: 0, coverage: 0, knowledgeVisible: false, knowledge: null });
    });

    it("keeps knowledge hidden below 50% coverage", async () => {
        await answer(["MAINT-1", "MAINT-2", "MAINT-3", "MAINT-4"], ["MAINT-1", "MAINT-2", "MAINT-3"]);
        const p = await analytics.progress(mech);
        expect(maint(p)).toMatchObject({ seen: 4, coverage: 40, knowledgeVisible: false, knowledge: null });
        expect(p.knowledge).toBeNull();
    });

    it("shows knowledge at 50%, using the latest answer to each question", async () => {
        // MAINT-4 now right; MAINT-5 wrong. Latest: 1-4 right, 5 wrong.
        await answer(["MAINT-4", "MAINT-5"], ["MAINT-4"]);
        const p = await analytics.progress(mech);
        expect(maint(p)).toMatchObject({ seen: 5, coverage: 50, knowledgeVisible: true, knowledge: 80 });
        expect(p.knowledge).toBe(80);
        expect(p.coverage).toBe(36); // 5 of 14
        // No qualifications assigned: readiness is knowledge alone.
        expect(p.qualifications).toMatchObject({ assigned: 0, score: null });
        expect(p.readiness).toBe(80);
    });

    it("lists weak sections with at least three answers, lowest first", async () => {
        const p = await analytics.progress(mech);
        expect(p.weakAreas).toEqual([expect.objectContaining({ subject: "MAINT", section: "Engines", answered: 5, right: 4, score: 80 })]);
    });
});

describe("readiness", () => {
    it("weighs knowledge 70% and qualifications 30%, counting only current ones", async () => {
        // HUET has requirements (the HUET course); with nothing done it is not current.
        // RTS has no requirements and no expiry date, so it is current.
        for (const code of ["HUET", "RTS"]) {
            const q = await db.prisma.qualification.findUniqueOrThrow({ where: { code } });
            await db.prisma.userQualification.create({ data: { userId: mech, qualificationId: q.id } });
        }
        const p = await analytics.progress(mech);
        expect(p.qualifications).toMatchObject({ assigned: 2, current: 1, score: 50 });
        expect(p.readiness).toBe(71); // 80 x 0.7 + 50 x 0.3 = 71
    });
});

describe("who can see what", () => {
    it("lets managers see anyone, and others only themselves", async () => {
        expect(await analytics.progress(mech, manager)).toEqual({ success: false, message: "You can only see your own progress." });
        expect((await analytics.progress(manager, mech)).person.username).toBe("mech1");
        expect(await analytics.everyone(mech)).toEqual({ success: false, message: "Only a manager can see everyone's progress." });
        const all = await analytics.everyone(manager);
        expect(all.people.find((p: any) => p.username === "mech1")).toMatchObject({ readiness: 71, knowledge: 80, coverage: 36, qualificationScore: 50 });
    });
});
