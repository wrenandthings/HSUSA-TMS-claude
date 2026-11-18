import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";

let db: TestDatabase;

beforeAll(() => { db = createTestDatabase(); });
afterAll(async () => { await db.cleanup(); });

describe("migrations on a new database", () => {
    it("match the Prisma schema exactly", () => {
        const output = db.run("prisma", ["migrate", "diff", "--from-url", db.url, "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"]);
        expect(output).toContain("No difference detected");
    });

    it("create the qualification and question tables", async () => {
        await expect(db.prisma.qualification.count()).resolves.toBe(0);
        await expect(db.prisma.userQualification.count()).resolves.toBe(0);
        await expect(db.prisma.question.count()).resolves.toBe(0);
    });
});

describe("seed on a new database", () => {
    it("runs, and running it again changes nothing", async () => {
        db.run("tsx", ["prisma/seed.ts"]);
        const first = { roles: await db.prisma.role.count(), users: await db.prisma.user.count(), userRoles: await db.prisma.userRole.count() };
        db.run("tsx", ["prisma/seed.ts"]);
        expect({ roles: await db.prisma.role.count(), users: await db.prisma.user.count(), userRoles: await db.prisma.userRole.count() }).toEqual(first);
        expect(first.roles).toBe(10);
    });

    it("creates the admin account with the Administrator role", async () => {
        const admin = await db.prisma.user.findUnique({ where: { username: "admin" }, include: { userRoles: { include: { role: true } } } });
        expect(admin?.userRoles.map(r => r.role.roleName)).toContain("Administrator");
    });
});

describe("seed data from the Seed Data Specification", () => {
    it("creates the 11 qualifications with their renewal months", async () => {
        const rows = await db.prisma.qualification.findMany({ orderBy: { code: "asc" } });
        expect(Object.fromEntries(rows.map(r => [r.code, r.renewalMonths]))).toEqual({
            CHECK_AIRMAN: 24, COMM_SPEC: 12, CRM: 12, HAA: 24, HUET: 48, IFR: 6,
            INSTRUCTOR: 24, NVG: 12, OFFSHORE_IFR: 12, PIC: 12, SAR: 24
        });
    });

    it("creates the permissions and gives the Administrator all of them", async () => {
        const permissions = await db.prisma.permission.count();
        expect(permissions).toBe(27);
        const admin = await db.prisma.role.findUniqueOrThrow({ where: { roleName: "Administrator" }, include: { permissions: true } });
        expect(admin.permissions).toHaveLength(permissions);
    });

    it("creates every configuration value", async () => {
        const keys = (await db.prisma.configuration.findMany()).map(c => c.key).sort();
        expect(keys).toEqual([
            "Alert30Days", "Alert60Days", "Alert7Days", "Alert90Days", "AuditRetentionDays", "BackupRetentionDays",
            "CoverageThreshold", "MinimumPasswordLength", "PasswordComplexityRequired",
            "ReadinessKnowledgeWeight", "ReadinessQualificationWeight", "SessionTimeoutMinutes"
        ]);
    });

    it("leaves an existing qualification with the same name alone", async () => {
        await db.prisma.qualification.update({ where: { code: "HUET" }, data: { renewalMonths: 36 } });
        db.run("tsx", ["prisma/seed.ts"]);
        expect((await db.prisma.qualification.findUniqueOrThrow({ where: { code: "HUET" } })).renewalMonths).toBe(36);
        expect(await db.prisma.qualification.count()).toBe(11);
    });
});
