import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";

// Imports Quail's real banks through the real IPC handlers (with a stand-in
// for Electron's ipcMain), and checks subject codes on the subject handler.
const require = createRequire(import.meta.url);
const handlers = new Map<string, (event: unknown, input?: unknown) => Promise<any>>();
const banks = path.resolve(__dirname, "../../documents/question-banks");
const maintCsv = readFileSync(path.join(banks, "Maint_question_bank.csv"), "utf8");
let db: TestDatabase;
let auth: { setCurrentUser: (id: string | null) => void };
let adminId: string;
let pilotId: string;

beforeAll(async () => {
    db = createTestDatabase();
    process.env.DATABASE_URL = db.url;
    const electronPath = require.resolve("electron");
    require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true, exports: { ipcMain: { handle: (channel: string, fn: any) => handlers.set(channel, fn) } } } as any;
    const main = path.resolve(__dirname, "../../electron/main");
    require(path.join(main, "question-handler.js")).registerQuestionHandlers();
    require(path.join(main, "subject-handler.js")).registerSubjectHandlers();
    auth = require(path.join(main, "auth-context.js"));
    db.run("tsx", ["prisma/seed.ts"]);
    adminId = (await db.prisma.user.findUniqueOrThrow({ where: { username: "admin" } })).id;
    pilotId = (await db.prisma.user.create({ data: { username: "pilot", passwordHash: "x", firstName: "P", lastName: "Pilot", status: "ACTIVE" } })).id;
});
afterAll(async () => { await db.cleanup(); });

const call = (channel: string, input?: unknown) => handlers.get(channel)!({}, input);

describe("seeded subjects", () => {
    it("are the eleven codes from the Seed Data Specification, plus OMD (owner, 2026-11-21)", async () => {
        const codes = (await db.prisma.subject.findMany({ orderBy: { code: "asc" } })).map(s => s.code);
        expect(codes).toEqual(["AW169", "COMM", "CRM", "HAA", "HAZMAT", "MAINT", "MGMT", "NVG", "OFFSHORE_IFR", "OMA", "OMD", "PILOT"]);
    });
});

describe("question-bank import", () => {
    it("is refused for someone without Question Management", async () => {
        auth.setCurrentUser(pilotId);
        expect(await call("questions-import-bank", { csvText: maintCsv })).toMatchObject({ success: false, message: "You do not have permission to import questions" });
        expect(await db.prisma.question.count()).toBe(0);
    });

    it("previews without writing, then imports, then updates on a second import", async () => {
        auth.setCurrentUser(adminId);
        expect(await call("questions-import-bank", { csvText: maintCsv, dryRun: true })).toMatchObject({ success: true, created: 704, updated: 0 });
        expect(await db.prisma.question.count()).toBe(0);

        expect(await call("questions-import-bank", { csvText: maintCsv })).toMatchObject({ success: true, created: 704, updated: 0 });
        const first = await db.prisma.question.findUniqueOrThrow({ where: { externalId: "MAINT-001" }, include: { subject: true, document: true } });
        expect(first).toMatchObject({ correctAnswer: "C", answerC: "Director of Maintenance", reference: "OM-A (US) V2.1-RC1, 1.4.6, p. 42", active: true });
        expect(first.subject?.code).toBe("MAINT");
        expect(first.document?.code).toBe("OM-A");
        expect(await db.prisma.question.count({ where: { document: { code: "OM-C" } } })).toBe(238);

        expect(await call("questions-import-bank", { csvText: maintCsv })).toMatchObject({ success: true, created: 0, updated: 704 });
        expect(await db.prisma.question.count()).toBe(704);
        expect(await db.prisma.auditLog.count({ where: { action: "QUESTIONS_IMPORTED" } })).toBe(2);
    });

    it("imports nothing when one row names an unknown subject or manual", async () => {
        const header = maintCsv.split("\n", 1)[0].trim();
        const row = (values: Record<string, string>) => header.split(",").map(name => values[name] ?? "").join(",");
        const base = { questionText: "Q", answerA: "a", answerB: "b", answerC: "c", answerD: "d", correctAnswer: "A", answer: "a", reference: "Ref", subject: "MAINT", document: "OM-A", active: "Yes" };
        const csv = [header,
            row({ ...base, questionId: "NEW-1" }),
            row({ ...base, questionId: "NEW-2", subject: "ASTRONOMY" }),
            row({ ...base, questionId: "NEW-3", document: "OM-Z" })].join("\n");
        const result = await call("questions-import-bank", { csvText: csv });
        expect(result.success).toBe(false);
        expect(result.errors).toEqual([
            'Row 3 (NEW-2): no subject has the code or name "ASTRONOMY".',
            'Row 4 (NEW-3): no document has the code "OM-Z".'
        ]);
        expect(await db.prisma.question.findUnique({ where: { externalId: "NEW-1" } })).toBeNull();
    });

    it("imports all four of Quail's banks: 1,806 questions, each with its manual", async () => {
        for (const file of ["Maint_AMP_AMPI_question_bank.csv", "OMD_question_bank.csv", "OMC_question_bank.csv"]) {
            const result = await call("questions-import-bank", { csvText: readFileSync(path.join(banks, file), "utf8") });
            expect(result, file).toMatchObject({ success: true, errors: [] });
        }
        expect(await db.prisma.question.count()).toBe(1806);
        expect(await db.prisma.question.count({ where: { documentId: null } })).toBe(0);
        const byManual = await db.prisma.question.groupBy({ by: ["documentId"], _count: true });
        expect(byManual).toHaveLength(5);
        expect(await db.prisma.question.count({ where: { subject: { code: "OMD" } } })).toBe(305);
    });
});

describe("subject codes", () => {
    it("are required, cleaned to upper case, and unique", async () => {
        expect(await call("subjects-create", { code: "", subjectName: "Weather" })).toEqual({ success: false, message: "Subject code is required." });
        expect(await call("subjects-create", { code: "maint", subjectName: "Other" })).toEqual({ success: false, message: "A subject with that code or name already exists." });
        const made = await call("subjects-create", { code: "wx basics", subjectName: "Weather" });
        expect(made.subject.code).toBe("WX_BASICS");
    });
});
