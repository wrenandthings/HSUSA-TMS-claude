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
const { seed } = require(path.join(root, "prisma/seed.ts"));
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
        const result = await prepareDatabase(fresh, { migrationsFolder: migrations, banksFolder: path.join(dir, "no-banks"), seed, importer: createQuestionBankImporter(fresh) });
        expect(result.applied.length).toBeGreaterThan(10);
        expect(await schema(fresh)).toEqual(await schema(reference.prisma));
    }, 60000);

    it("seeds roles, settings, qualifications and an admin who must change the password", async () => {
        expect(await fresh.role.count()).toBeGreaterThanOrEqual(12);
        expect(await fresh.trainingProgram.count()).toBeGreaterThan(20);
        const admin = await fresh.user.findUniqueOrThrow({ where: { username: "admin" } });
        expect(admin.mustChangePassword).toBe(true);
    });

    it("does nothing the second time, then imports the bundled banks into an empty bank", async () => {
        expect(await applyMigrations(fresh, migrations)).toEqual([]);
        const result = await prepareDatabase(fresh, { migrationsFolder: migrations, banksFolder: banks, seed, importer: createQuestionBankImporter(fresh) });
        expect(result.applied).toEqual([]);
        expect(result.imported).toBeGreaterThan(2000);
        const again = await prepareDatabase(fresh, { migrationsFolder: migrations, banksFolder: banks, seed, importer: createQuestionBankImporter(fresh) });
        expect(again.imported).toBe(0);
    }, 120000);
});
