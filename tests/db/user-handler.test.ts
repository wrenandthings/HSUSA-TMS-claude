import { createRequire } from "node:module";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";

// Loads the real user and sign-in IPC handlers with a stand-in for Electron's ipcMain.
const require = createRequire(import.meta.url);
const handlers = new Map<string, (event: unknown, input?: unknown) => Promise<any>>();
let db: TestDatabase;

beforeAll(async () => {
    db = createTestDatabase();
    process.env.DATABASE_URL = db.url;
    const electronPath = require.resolve("electron");
    require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true, exports: { ipcMain: { handle: (channel: string, fn: any) => handlers.set(channel, fn) } } } as any;
    const main = path.resolve(__dirname, "../../electron/main");
    require(path.join(main, "user-handler.js")).registerUserHandlers();
    require(path.join(main, "auth-handler.js")).registerAuthenticationHandlers();
    db.run("tsx", ["prisma/seed.ts"]);
});
afterAll(async () => { await db.cleanup(); });

const call = (channel: string, input?: unknown) => handlers.get(channel)!({}, input);

describe("user and sign-in handlers", () => {
    it("sign in as the seeded admin, who must change the password first", async () => {
        expect(await call("auth-login", { username: "admin", password: "CHANGE_ME" })).toMatchObject({ success: true, mustChangePassword: true });
        expect(await call("auth-change-own-password", { currentPassword: "CHANGE_ME", newPassword: "Hangar-Door-42x" })).toMatchObject({ success: true });
    });

    it("never send password hashes to the screens", async () => {
        const users = await call("users-get-all");
        expect(users.length).toBeGreaterThan(0);
        expect(JSON.stringify(users)).not.toContain("passwordHash");
        const one = await call("users-get-by-id", users[0].id);
        expect(one.passwordHash).toBeUndefined();
        expect(one.userRoles.length).toBeGreaterThan(0);
    });

    it("check a new account's temporary password against the rules, then hash it", async () => {
        const base = { username: "mech1", firstName: "M", lastName: "One", email: "", status: "ACTIVE" };
        expect(await call("users-create", { ...base, password: "short" })).toEqual({ success: false, message: "Password must be at least 12 characters." });
        const created = await call("users-create", { ...base, password: "Temporary-Pass-9" });
        expect(created.success).toBe(true);
        expect(created.user.passwordHash).toBeUndefined();
        const stored = await db.prisma.user.findUniqueOrThrow({ where: { username: "mech1" } });
        expect(stored.passwordHash.startsWith("$2")).toBe(true);
        expect(stored.mustChangePassword).toBe(true);
        expect(await call("auth-login", { username: "mech1", password: "Temporary-Pass-9" })).toMatchObject({ success: true, mustChangePassword: true });
    });
});
