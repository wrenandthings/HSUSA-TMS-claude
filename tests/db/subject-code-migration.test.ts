import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Subjects made before codes existed must get one, and stay unique.
const root = path.resolve(__dirname, "../..");
const migrationsDir = path.join(root, "prisma", "migrations");
const target = "20261120170000_subject_codes_and_question_bank_fields";
const prismaBin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
let dir: string;
let url: string;
let prisma: PrismaClient;

function execute(sql: string) {
    const file = path.join(dir, `step-${Date.now()}-${Math.random()}.sql`);
    writeFileSync(file, sql);
    execFileSync(prismaBin, ["db", "execute", "--url", url, "--file", file], { cwd: root, stdio: "pipe" });
}
const migrationSql = (name: string) => readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");

beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "hsusa-tms-subject-migration-"));
    url = `file:${path.join(dir, "old.db")}`;
    const all = readdirSync(migrationsDir).filter(n => /^\d+_/.test(n)).sort();
    for (const name of all.filter(n => n < target)) execute(migrationSql(name));
    execute(`
        INSERT INTO "Subject" ("id","subjectName","updatedAt") VALUES
            ('s1','Crew Resource Management',CURRENT_TIMESTAMP),
            ('s2','crew resource management',CURRENT_TIMESTAMP);
        INSERT INTO "Question" ("id","questionText","answer","updatedAt") VALUES ('q1','Old question','Old answer',CURRENT_TIMESTAMP);
    `);
    for (const name of all.filter(n => n >= target)) execute(migrationSql(name));
    prisma = new PrismaClient({ datasources: { db: { url } } });
});
afterAll(async () => { await prisma.$disconnect(); rmSync(dir, { recursive: true, force: true }); });

describe("subject code migration", () => {
    it("gives old subjects a code from their name, unique even for near-duplicate names", async () => {
        const subjects = await prisma.subject.findMany({ orderBy: { id: "asc" } });
        expect(subjects.map(s => s.code)).toEqual(["CREW_RESOURCE_MANAGEMENT", "CREW_RESOURCE_MANAGEMENT_s2"]);
    });

    it("keeps old questions and their answers", async () => {
        expect(await prisma.question.findUniqueOrThrow({ where: { id: "q1" } })).toMatchObject({ answer: "Old answer", active: true, externalId: null });
    });
});
