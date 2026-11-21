import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";

// Settings service and handlers, plus the idle sign-out pieces in auth.
const require = createRequire(import.meta.url);
const handlers = new Map<string, (event: unknown, input?: unknown) => Promise<any>>();
let db: TestDatabase;
let mechId: string;

beforeAll(async () => {
    db = createTestDatabase();
    process.env.DATABASE_URL = db.url;
    const electronPath = require.resolve("electron");
    require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true, exports: { ipcMain: { handle: (channel: string, fn: any) => handlers.set(channel, fn) } } } as any;
    const main = path.resolve(__dirname, "../../electron/main");
    require(path.join(main, "configuration-handler.js")).registerConfigurationHandlers();
    require(path.join(main, "auth-handler.js")).registerAuthenticationHandlers();
    db.run("tsx", ["prisma/seed.ts"]);
    // Sign-in tests use a known password; the seeded admin has one too.
    const { hashPassword } = require(path.join(main, "passwords.js"));
    await db.prisma.user.update({ where: { username: "admin" }, data: { passwordHash: await hashPassword("Hangar-Door-42x"), mustChangePassword: false } });
    mechId = (await db.prisma.user.create({ data: { username: "mech1", passwordHash: await hashPassword("Rotor-Blade-77y"), firstName: "T", lastName: "M", status: "ACTIVE" } })).id;
});
afterAll(async () => { await db.cleanup(); });

const call = (channel: string, input?: unknown) => handlers.get(channel)!({}, input);

describe("settings", () => {
    it("need a signed-in user to read, and show the seeded values", async () => {
        expect(await call("configuration-get-all")).toEqual({ success: false, message: "Authentication required" });
        await call("auth-login", { username: "mech1", password: "Rotor-Blade-77y" });
        const result = await call("configuration-get-all");
        expect(result.canEdit).toBe(false);
        expect(result.settings.find((s: any) => s.key === "SessionTimeoutMinutes").value).toBe("30");
    });

    it("can only be changed by an administrator", async () => {
        expect(await call("configuration-save", { changes: { SessionTimeoutMinutes: "15" } })).toEqual({ success: false, message: "Only an administrator can change settings." });
        await call("auth-logout");
    });

    it("refuse bad values and save nothing, then save good ones with an audit record", async () => {
        const login = await call("auth-login", { username: "admin", password: "Hangar-Door-42x" });
        expect(login.sessionTimeoutMinutes).toBe(30);

        const bad = await call("configuration-save", { changes: { SessionTimeoutMinutes: "2", Alert7Days: "maybe", ReadinessKnowledgeWeight: "80" } });
        expect(bad.success).toBe(false);
        expect(bad.message).toContain("must be between 5 and 480 minutes");
        expect(bad.message).toContain("choose yes or no");
        expect(bad.message).toContain("must add up to 100%");
        expect((await db.prisma.configuration.findUniqueOrThrow({ where: { key: "SessionTimeoutMinutes" } })).value).toBe("30");

        const good = await call("configuration-save", { changes: { SessionTimeoutMinutes: "15", Alert7Days: false, ReadinessKnowledgeWeight: "60", ReadinessQualificationWeight: "40" } });
        expect(good).toMatchObject({ success: true, message: "Settings saved." });
        expect((await db.prisma.configuration.findUniqueOrThrow({ where: { key: "Alert7Days" } })).value).toBe("FALSE");
        const audit = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "CONFIGURATION_CHANGED", entityId: "SessionTimeoutMinutes" } });
        expect(audit).toMatchObject({ oldValue: "30", newValue: "15" });

        await call("auth-logout");
        expect((await call("auth-login", { username: "admin", password: "Hangar-Door-42x" })).sessionTimeoutMinutes).toBe(15);
    });

    it("write sign-ins, failures and settings to the log files, never a password", async () => {
        await call("auth-login", { username: "admin", password: "Wrong-Password-1" });
        const security = readFileSync(path.join(process.env.LOG_DIR!, "security.log"), "utf8");
        expect(security).toContain('"event":"SIGN_IN_FAILED"');
        expect(security).toContain('"event":"SIGNED_IN"');
        expect(security).not.toContain("Wrong-Password-1");
        expect(security).not.toContain("Hangar-Door-42x");
        expect(readFileSync(path.join(process.env.LOG_DIR!, "application.log"), "utf8")).toContain('"event":"SETTINGS_SAVED"');
    });

    it("record an idle sign-out", async () => {
        await call("auth-logout", { reason: "idle" });
        const entry = await db.prisma.auditLog.findFirst({ where: { action: "USER_SIGNED_OUT_IDLE" } });
        expect(entry).not.toBeNull();
        expect(await call("configuration-get-all")).toEqual({ success: false, message: "Authentication required" });
    });
});
