import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";
import { createAuthService, BAD_SIGN_IN } from "../../electron/main/auth-service";
import { hashPassword, isHash } from "../../electron/main/passwords";

let db: TestDatabase;
let auth: ReturnType<typeof createAuthService>;

beforeAll(async () => {
    db = createTestDatabase();
    db.run("tsx", ["prisma/seed.ts"]);
    auth = createAuthService(db.prisma);
});
afterAll(async () => { await db.cleanup(); });

const user = (username: string) => db.prisma.user.findUniqueOrThrow({ where: { username } });

describe("the seeded admin", () => {
    it("has a hashed password and must change it at first sign-in", async () => {
        const admin = await user("admin");
        expect(isHash(admin.passwordHash)).toBe(true);
        expect(admin.mustChangePassword).toBe(true);
        const result = await auth.login("admin", "CHANGE_ME");
        expect(result).toMatchObject({ success: true, mustChangePassword: true, user: { username: "admin" } });
    });
});

describe("login", () => {
    it("gives the same message for an unknown user and a wrong password", async () => {
        expect(await auth.login("nobody", "x")).toEqual({ success: false, message: BAD_SIGN_IN });
        expect(await auth.login("admin", "wrong")).toEqual({ success: false, message: BAD_SIGN_IN });
    });

    it("refuses an inactive account", async () => {
        await db.prisma.user.create({ data: { username: "gone", passwordHash: await hashPassword("Hangar-Door-42x"), firstName: "G", lastName: "One", status: "INACTIVE" } });
        expect((await auth.login("gone", "Hangar-Door-42x")).message).toBe("User account is not active");
    });

    it("upgrades a plain-text password from before hashing, and asks for a new one", async () => {
        await db.prisma.user.create({ data: { username: "legacy", passwordHash: "OldPlainText1!", firstName: "L", lastName: "Egacy", status: "ACTIVE" } });
        const result = await auth.login("legacy", "OldPlainText1!");
        expect(result).toMatchObject({ success: true, mustChangePassword: true });
        const after = await user("legacy");
        expect(isHash(after.passwordHash)).toBe(true);
        expect(after.mustChangePassword).toBe(true);
        expect((await auth.login("legacy", "OldPlainText1!")).success).toBe(true);
    });
});

describe("changing your own password", () => {
    it("needs the current password, follows the rules, and clears the forced change", async () => {
        const admin = await user("admin");
        expect((await auth.changeOwnPassword(admin.id, "wrong", "Hangar-Door-42x")).message).toBe("Current password is incorrect.");
        expect((await auth.changeOwnPassword(admin.id, "CHANGE_ME", "short")).message).toBe("Password must be at least 12 characters.");
        expect((await auth.changeOwnPassword(admin.id, "CHANGE_ME", "CHANGE_ME")).message).toBe("New password must be different from the current one.");
        expect(await auth.changeOwnPassword(admin.id, "CHANGE_ME", "Hangar-Door-42x")).toEqual({ success: true, message: "Password changed." });
        expect((await user("admin")).mustChangePassword).toBe(false);
        expect(await auth.login("admin", "Hangar-Door-42x")).toMatchObject({ success: true, mustChangePassword: false });
        expect((await auth.login("admin", "CHANGE_ME")).success).toBe(false);
    });

    it("requires being signed in", async () => {
        expect((await auth.changeOwnPassword(null, "a", "b")).message).toBe("Authentication required");
    });
});

describe("an administrator setting someone's password", () => {
    it("hashes it, follows the rules, forces a change at next sign-in, and is audited", async () => {
        const admin = await user("admin");
        const pilot = await db.prisma.user.create({ data: { username: "pilot", passwordHash: await hashPassword("Hangar-Door-42x"), firstName: "P", lastName: "Ilot", status: "ACTIVE" } });
        expect((await auth.setPasswordForUser(admin.id, pilot.id, "weak")).success).toBe(false);
        expect((await auth.setPasswordForUser(admin.id, pilot.id, "Temporary-Pass-9")).success).toBe(true);
        const after = await user("pilot");
        expect(isHash(after.passwordHash) && after.mustChangePassword).toBe(true);
        const entry = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "USER_PASSWORD_SET" } });
        expect([entry.userId, entry.entityId]).toEqual([admin.id, pilot.id]);
    });
});
