import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";

// The installed app sets up its own database (no Prisma command-line tools).
// It must end up the same as `prisma migrate deploy` + `prisma db seed`.
const require = createRequire(import.meta.url);
const root = path.resolve(__dirname, "../..");
const { prepareDatabase, applyMigrations } = require(path.join(root, "electron/main/first-run.js"));
const { createQuestionBankImporter } = require(path.join(root, "electron/main/question-bank.js"));
const { seed, SEED_VERSION } = require(path.join(root, "prisma/seed.ts"));
const migrations = path.join(root, "prisma/migrations");
const banks = path.join(root, "documents/question-banks");

let dir: string;
let fresh: PrismaClient;
let reference: TestDatabase;

beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "hsusa-tms-first-run-"));
    fresh = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "installed.db")}` } } });
    reference = createTestDatabase();
}, 60000);
afterAll(async () => { await fresh.$disconnect(); await reference.cleanup(); rmSync(dir, { recursive: true, force: true }); });

const schema = async (prisma: PrismaClient) => {
    const tables: any[] = await prisma.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations' ORDER BY name`);
    const out: Record<string, string[]> = {};
    for (const { name } of tables) {
        const cols: any[] = await prisma.$queryRawUnsafe(`PRAGMA table_info("${name}")`);
        out[name] = cols.map((c) => `${c.name}:${c.type}:${c.notnull}:${c.pk}`);
    }
    const indexes: any[] = await prisma.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name`);
    out.__indexes = indexes.map((i) => i.name);
    return out;
};

describe("first start of an installed copy", () => {
    it("builds the same tables, columns and indexes as prisma migrate deploy", async () => {
        const result = await prepareDatabase(fresh, { migrationsFolder: migrations, banksFolder: path.join(dir, "no-banks"), seed, seedVersion: SEED_VERSION, importer: createQuestionBankImporter(fresh) });
        expect(result.applied.length).toBeGreaterThan(10);
        expect(await schema(fresh)).toEqual(await schema(reference.prisma));
    }, 60000);

    it("seeds roles, settings, qualifications and an admin who must change the password", async () => {
        expect(await fresh.role.count()).toBeGreaterThanOrEqual(12);
        expect(await fresh.trainingProgram.count()).toBeGreaterThan(20);
        const admin = await fresh.user.findUniqueOrThrow({ where: { username: "admin" } });
        expect(admin.mustChangePassword).toBe(true);
    });

    it("adds the testing account User, a Pilot with a blank password, and re-seeds when the seed version rises", async () => {
        const { checkPassword } = require(path.join(root, "electron/main/passwords.js"));
        const user = await fresh.user.findUniqueOrThrow({ where: { username: "User" }, include: { userRoles: { include: { role: true } } } });
        expect(user.mustChangePassword).toBe(false);
        expect((await checkPassword(user.passwordHash, "")).matches).toBe(true);
        expect(user.userRoles.map((r) => r.role.roleName)).toEqual(["Pilot"]);
        // An existing install without the account gets it once the seed version rises.
        await fresh.userRole.deleteMany({ where: { userId: user.id } });
        await fresh.user.delete({ where: { id: user.id } });
        const options = { migrationsFolder: migrations, banksFolder: path.join(dir, "no-banks"), seed, importer: createQuestionBankImporter(fresh) };
        await prepareDatabase(fresh, { ...options, seedVersion: SEED_VERSION });
        expect(await fresh.user.count({ where: { username: "User" } })).toBe(0); // same version: not re-seeded
        await prepareDatabase(fresh, { ...options, seedVersion: SEED_VERSION + 1 });
        expect(await fresh.user.count({ where: { username: "User" } })).toBe(1);
    });

    it("imports every bundled bank once, and again only when its file changes", async () => {
        expect(await applyMigrations(fresh, migrations)).toEqual([]);
        const failures: string[] = [];
        const options = { migrationsFolder: migrations, banksFolder: banks, seed, importer: createQuestionBankImporter(fresh),
            logger: { application: (event: string, data: any) => { if (event === "QUESTION_BANK_IMPORT_FAILED") failures.push(`${data.file}: ${data.message}`); } } };
        const result = await prepareDatabase(fresh, options);
        expect(failures).toEqual([]);
        expect(result.applied).toEqual([]);
        expect(result.imported).toBe(3275); // twelve banks
        expect((await prepareDatabase(fresh, options)).imported).toBe(0);
        const codes = (await fresh.document.findMany({ where: { questions: { some: {} } }, select: { code: true } })).map((d) => d.code).sort();
        expect(codes).toEqual(expect.arrayContaining(["DISPATCH", "GOM", "HOIST", "HUMS", "MEL", "SAR-HEC", "SMS-A"]));
        // A changed file is imported again; unchanged files are skipped.
        await fresh.configuration.update({ where: { key: "BundledBank:HUMS_question_bank.csv" }, data: { value: "old" } });
        expect((await prepareDatabase(fresh, options)).imported).toBe(0); // same questions: updated, none created
        expect((await fresh.configuration.findUniqueOrThrow({ where: { key: "BundledBank:HUMS_question_bank.csv" } })).value).not.toBe("old");
    }, 180000);
});
