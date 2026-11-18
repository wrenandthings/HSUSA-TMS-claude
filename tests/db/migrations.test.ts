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
