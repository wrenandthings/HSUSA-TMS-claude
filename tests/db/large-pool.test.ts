import { createRequire } from "node:module";
import path from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";

// Regression, found in the app 2026-11-21: with 2,000+ questions and some
// history, Weak areas crashed Prisma's SQLite engine ("no entry found for key")
// because the query listed every question id and sorted the results.
const require = createRequire(import.meta.url);
const main = path.resolve(__dirname, "../../electron/main");
const { createFlashcardService } = require(path.join(main, "flashcard-service.js"));
const { createQuizService } = require(path.join(main, "quiz-service.js"));
let db: TestDatabase;
let user: string;

beforeAll(async () => {
    db = createTestDatabase();
    await db.prisma.question.createMany({ data: Array.from({ length: 2200 }, (_, i) => ({ questionText: `Q${i}?`, answerA: "a", answerB: "b", answerC: "c", answerD: "d", correctAnswer: "A" })) });
    user = (await db.prisma.user.create({ data: { username: "u1", passwordHash: "x", firstName: "U", lastName: "One", status: "ACTIVE" } })).id;
}, 60000);
afterAll(async () => { await db.cleanup(); });

it("runs weak areas and unseen over 2,200 questions with history", async () => {
    const quizzes = createQuizService(db.prisma);
    const cards = createFlashcardService(db.prisma);
    const quiz = await quizzes.start(user, { type: "RANDOM", count: 5 });
    for (const item of (await quizzes.get(user, quiz.sessionId)).quiz.items) await quizzes.answer(user, quiz.sessionId, item.questionId, "B");
    const set = await cards.start(user, { mode: "SUBJECT", count: 3 });
    await cards.rate(user, set.sessionId, (await cards.get(user, set.sessionId)).session.cards[0].questionId, "MISSED");

    const weakCards = await cards.start(user, { mode: "WEAK_AREA", count: 50 });
    expect(weakCards.success, weakCards.message).toBe(true);
    expect((await cards.get(user, weakCards.sessionId)).session.cards.length).toBeGreaterThanOrEqual(5);
    expect((await quizzes.start(user, { type: "WEAK_AREA", count: 5 })).success).toBe(true);
    expect((await quizzes.start(user, { type: "UNSEEN", count: 5 })).success).toBe(true);
    expect((await cards.start(user, { mode: "SUBJECT", count: 20 })).success).toBe(true);
}, 60000);
