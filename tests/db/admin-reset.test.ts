import { createRequire } from "node:module";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";

// The "Reset HSUSA TMS admin password" shortcut (owner, 2026-11-22).
const require = createRequire(import.meta.url);
const main = path.resolve(__dirname, "../../electron/main");
const { resetAdmin } = require(path.join(main, "admin-reset.js"));
const { checkPassword, hashPassword } = require(path.join(main, "passwords.js"));
let db: TestDatabase;

beforeAll(() => { db = createTestDatabase(); db.run("tsx", ["prisma/seed.ts"]); });
afterAll(async () => { await db.cleanup(); });

describe("admin reset", () => {
    it("gives admin the starting password and a forced change, and leaves other accounts alone", async () => {
        await db.prisma.user.update({ where: { username: "admin" }, data: { passwordHash: await hashPassword("Forgotten-99!x"), mustChangePassword: false, status: "LOCKED" } });
        const before = await db.prisma.user.findUniqueOrThrow({ where: { username: "User" } });
        expect(await resetAdmin(db.prisma)).toEqual({ created: false });
        const admin = await db.prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
        expect((await checkPassword(admin.passwordHash, "CHANGE_ME")).matches).toBe(true);
        expect(admin).toMatchObject({ mustChangePassword: true, status: "ACTIVE" });
        expect((await db.prisma.user.findUniqueOrThrow({ where: { username: "User" } })).passwordHash).toBe(before.passwordHash);
        expect(await db.prisma.auditLog.count({ where: { action: "ADMIN_PASSWORD_RESET_FROM_SHORTCUT" } })).toBe(1);
    });

    it("creates admin again, as an Administrator, if it was deleted", async () => {
        const admin = await db.prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
        await db.prisma.userRole.deleteMany({ where: { userId: admin.id } });
        await db.prisma.user.delete({ where: { id: admin.id } });
        expect(await resetAdmin(db.prisma)).toEqual({ created: true });
        const again = await db.prisma.user.findUniqueOrThrow({ where: { username: "admin" }, include: { userRoles: { include: { role: true } } } });
        expect(again.userRoles.map((r) => r.role.roleName)).toEqual(["Administrator"]);
    });
});
