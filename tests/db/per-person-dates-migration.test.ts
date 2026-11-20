import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Builds a database as it was before the per-person migration, fills it with
// old-style data, applies the migration, and checks nothing was lost.
const root = path.resolve(__dirname, "../..");
const migrationsDir = path.join(root, "prisma", "migrations");
const target = "20261117210000_per_person_qualification_dates";
const prismaBin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");

let dir: string;
let url: string;
let prisma: PrismaClient;

function execute(sql: string) {
    const file = path.join(dir, `step-${Date.now()}-${Math.random()}.sql`);
    writeFileSync(file, sql);
    execFileSync(prismaBin, ["db", "execute", "--url", url, "--file", file], { cwd: root, stdio: "pipe" });
}

const migrationSql = (name: string) => require("node:fs").readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");

beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "hsusa-tms-migration-"));
    url = `file:${path.join(dir, "old.db")}`;
    const before = readdirSync(migrationsDir).filter(n => /^\d+_/.test(n) && n < target).sort();
    for (const name of before) execute(migrationSql(name));

    execute(`
        INSERT INTO "User" ("id","username","passwordHash","firstName","lastName","status","updatedAt") VALUES
            ('u1','pilot1','x','A','One','ACTIVE',CURRENT_TIMESTAMP),
            ('u2','pilot2','x','B','Two','ACTIVE',CURRENT_TIMESTAMP);
        INSERT INTO "Qualification" ("id","name","description","status","issuedAt","expiresAt","updatedAt") VALUES
            ('q1','Pilot In Command','PIC','CURRENT','2026-01-15 00:00:00','2027-01-15 00:00:00',CURRENT_TIMESTAMP),
            ('q2','HUET',NULL,'SUSPENDED',NULL,'2028-06-01 00:00:00',CURRENT_TIMESTAMP),
            ('q3','CRM',NULL,'CURRENT',NULL,NULL,CURRENT_TIMESTAMP),
            ('q4','crm',NULL,'CURRENT',NULL,NULL,CURRENT_TIMESTAMP);
        INSERT INTO "UserQualification" ("id","userId","qualificationId","status","revokedAt","endReason") VALUES
            ('a1','u1','q1','ACTIVE',NULL,NULL),
            ('a2','u2','q1','REVOKED','2026-10-01 00:00:00','Removed (no reason given)'),
            ('a3','u1','q2','ACTIVE',NULL,NULL),
            ('a4','u2','q3','ACTIVE',NULL,NULL);
    `);
    execute(migrationSql(target));
    // Apply every later migration too, so the current Prisma client matches
    // the tables and the data is checked to survive them.
    const after = readdirSync(migrationsDir).filter(n => /^\d+_/.test(n) && n > target).sort();
    for (const name of after) execute(migrationSql(name));
    prisma = new PrismaClient({ datasources: { db: { url } } });
});

afterAll(async () => {
    await prisma?.$disconnect();
    rmSync(dir, { recursive: true, force: true });
});

describe("per-person qualification dates migration", () => {
    it("keeps every qualification and gives each a unique code", async () => {
        const rows = await prisma.qualification.findMany({ orderBy: { id: "asc" } });
        expect(rows.map(r => [r.id, r.code, r.name])).toEqual([
            ["q1", "PILOT_IN_COMMAND", "Pilot In Command"],
            ["q2", "HUET", "HUET"],
            ["q3", "CRM", "CRM"],
            ["q4", "CRM_q4", "crm"]
        ]);
        expect(rows.every(r => r.active && r.renewalMonths === null)).toBe(true);
    });

    it("copies the qualification's dates onto every assignment of it", async () => {
        const a1 = await prisma.userQualification.findUniqueOrThrow({ where: { id: "a1" } });
        expect(a1.awardedDate?.toISOString()).toBe("2026-01-15T00:00:00.000Z");
        expect(a1.expirationDate?.toISOString()).toBe("2027-01-15T00:00:00.000Z");
        const a4 = await prisma.userQualification.findUniqueOrThrow({ where: { id: "a4" } });
        expect(a4.expirationDate).toBeNull();
    });

    it("turns a suspended qualification into suspended assignments", async () => {
        expect((await prisma.userQualification.findUniqueOrThrow({ where: { id: "a3" } })).suspended).toBe(true);
        expect((await prisma.userQualification.findUniqueOrThrow({ where: { id: "a1" } })).suspended).toBe(false);
    });

    it("keeps revoked history unchanged", async () => {
        const a2 = await prisma.userQualification.findUniqueOrThrow({ where: { id: "a2" } });
        expect([a2.status, a2.endReason, a2.revokedAt?.toISOString()]).toEqual(["REVOKED", "Removed (no reason given)", "2026-10-01T00:00:00.000Z"]);
        expect(await prisma.userQualification.count()).toBe(4);
    });
});
