import { createRequire } from "node:module";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";

// Loads the real IPC handlers with a stand-in for Electron's ipcMain, so the
// administrator check and the { success, message } replies can be tested.
const require = createRequire(import.meta.url);
const handlers = new Map<string, (event: unknown, input?: unknown) => Promise<any>>();
let db: TestDatabase;
let auth: { setCurrentUser: (id: string | null) => void; clearCurrentUser: () => void };
let adminId: string;
let pilotId: string;

beforeAll(async () => {
    db = createTestDatabase();
    process.env.DATABASE_URL = db.url;
    const electronPath = require.resolve("electron");
    require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true, exports: { ipcMain: { handle: (channel: string, fn: any) => handlers.set(channel, fn) } } } as any;
    const main = path.resolve(__dirname, "../../electron/main");
    require(path.join(main, "qualification-handler.js")).registerQualificationHandlers();
    auth = require(path.join(main, "auth-context.js"));

    db.run("tsx", ["prisma/seed.ts"]);
    adminId = (await db.prisma.user.findUniqueOrThrow({ where: { username: "admin" } })).id;
    pilotId = (await db.prisma.user.create({ data: { username: "pilot", passwordHash: "x", firstName: "P", lastName: "Pilot", status: "ACTIVE" } })).id;
});
afterAll(async () => { await db.cleanup(); });

const call = (channel: string, input?: unknown) => handlers.get(channel)!({}, input);

describe("qualification IPC handlers", () => {
    it("register every channel the preload script uses", () => {
        expect([...handlers.keys()].sort()).toEqual([
            "qualifications-assign-user", "qualifications-create", "qualifications-delete", "qualifications-get-all",
            "qualifications-get-by-id", "qualifications-set-hidden", "qualifications-unassign-user", "qualifications-update", "qualifications-update-assignment"
        ]);
    });

    it("refuse changes when nobody is signed in, or the user is not an administrator", async () => {
        auth.clearCurrentUser();
        expect(await call("qualifications-create", { code: "X", name: "X" })).toEqual({ success: false, message: "Authentication required" });
        auth.setCurrentUser(pilotId);
        expect(await call("qualifications-create", { code: "X", name: "X" })).toEqual({ success: false, message: "You do not have permission to manage qualifications" });
    });

    it("let an administrator create, assign, and renew, recording them as the actor", async () => {
        auth.setCurrentUser(adminId);
        const created = await call("qualifications-create", { code: "TEST_IFR", name: "Test Instrument", renewalMonths: "6" });
        expect(created.success).toBe(true);
        const assigned = await call("qualifications-assign-user", { qualificationId: created.qualification.id, userId: pilotId, awardedDate: "2026-09-01" });
        expect(assigned.assignment.expirationDate.toISOString().slice(0, 10)).toBe("2027-03-01");
        const renewed = await call("qualifications-update-assignment", { assignmentId: assigned.assignment.id, expirationDate: "2027-09-01" });
        expect(renewed.success).toBe(true);
        const actors = new Set((await db.prisma.auditLog.findMany()).map(e => e.userId));
        expect([...actors]).toEqual([adminId]);
    });

    it("let every qualification-manager role make changes, and refuse Pilot and Maintenance", async () => {
        const { QUALIFICATION_MANAGER_ROLES } = require(path.resolve(__dirname, "../../electron/main/qualification-handler.js"));
        expect(QUALIFICATION_MANAGER_ROLES).toEqual(["Administrator", "Training_Manager", "Director_of_Operations", "Chief_Pilot", "Maintenance_Manager", "Quality_Control"]);
        const allowed: string[] = [];
        for (const roleName of [...QUALIFICATION_MANAGER_ROLES, "Pilot", "Maintenance"]) {
            const role = await db.prisma.role.findUniqueOrThrow({ where: { roleName } });
            const user = await db.prisma.user.create({ data: { username: `u-${roleName}`, passwordHash: "x", firstName: "T", lastName: roleName, status: "ACTIVE", userRoles: { create: { roleId: role.id } } } });
            auth.setCurrentUser(user.id);
            const result = await call("qualifications-create", { code: `T_${roleName}`, name: `Test ${roleName}` });
            if (result.success) allowed.push(roleName);
        }
        expect(allowed).toEqual(QUALIFICATION_MANAGER_ROLES);
    });

    it("let only an administrator hide a qualification, and leave it out of the list", async () => {
        auth.setCurrentUser(adminId);
        const q = (await call("qualifications-create", { code: "OOPS", name: "Created in error" })).qualification;
        const tmRole = await db.prisma.role.findUniqueOrThrow({ where: { roleName: "Training_Manager" } });
        const tm = await db.prisma.user.create({ data: { username: "tm-hide", passwordHash: "x", firstName: "T", lastName: "M", status: "ACTIVE", userRoles: { create: { roleId: tmRole.id } } } });
        auth.setCurrentUser(tm.id);
        expect(await call("qualifications-set-hidden", { id: q.id, hidden: true })).toEqual({ success: false, message: "Only an administrator can hide or unhide a qualification" });
        auth.setCurrentUser(adminId);
        expect((await call("qualifications-set-hidden", { id: q.id, hidden: true })).success).toBe(true);
        const visible = (await call("qualifications-get-all")).map((x: any) => x.code);
        const all = (await call("qualifications-get-all", { includeHidden: true })).map((x: any) => x.code);
        expect(visible).not.toContain("OOPS");
        expect(all).toContain("OOPS");
    });

    it("return validation problems as a message instead of throwing", async () => {
        auth.setCurrentUser(adminId);
        expect(await call("qualifications-create", { code: "PIC", name: "Another PIC" })).toEqual({ success: false, message: "A qualification with that code or name already exists." });
        expect(await call("qualifications-create", { code: "", name: "No code" })).toEqual({ success: false, message: "Qualification code is required." });
    });
});
