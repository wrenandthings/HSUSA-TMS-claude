import { createRequire } from "node:module";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";

// Found while writing the documentation (2026-11-22): anyone signed in could
// change subjects and roles. Subjects now follow the question bank's managers;
// roles are Administrator only, and the Administrator role is protected.
const require = createRequire(import.meta.url);
const handlers = new Map<string, (event: unknown, input?: unknown) => Promise<any>>();
let db: TestDatabase;
let auth: any;

beforeAll(async () => {
    db = createTestDatabase();
    process.env.DATABASE_URL = db.url;
    const electronPath = require.resolve("electron");
    require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true, exports: { ipcMain: { handle: (channel: string, fn: any) => handlers.set(channel, fn) } } } as any;
    const main = path.resolve(__dirname, "../../electron/main");
    require(path.join(main, "role-handler.js")).registerRoleHandlers();
    require(path.join(main, "subject-handler.js")).registerSubjectHandlers();
    auth = require(path.join(main, "auth-context.js"));
    db.run("tsx", ["prisma/seed.ts"]);
});
afterAll(async () => { auth.clearCurrentUser(); await db.cleanup(); });

const call = (channel: string, input?: unknown) => handlers.get(channel)!({}, input);
const signIn = async (username: string) => auth.setCurrentUser((await db.prisma.user.findUniqueOrThrow({ where: { username } })).id);

describe("subjects and roles", () => {
    it("refuse changes from someone not signed in, and from an ordinary user", async () => {
        auth.clearCurrentUser();
        expect(await call("subjects-create", { code: "X1", subjectName: "X one" })).toEqual({ success: false, message: "Authentication required" });
        await signIn("User");
        expect((await call("subjects-create", { code: "X1", subjectName: "X one" })).message).toBe("Only the Administrator, Director of Operations, Chief Pilot or Training Manager can change subjects.");
        expect(await call("roles-create", { roleName: "Hacker" })).toEqual({ success: false, message: "Only an Administrator can change roles." });
        // Reading is still open to everyone signed in.
        expect((await call("subjects-get-all")).length).toBeGreaterThan(10);
        expect((await call("roles-get-all")).length).toBeGreaterThan(10);
    });

    it("let an Administrator change them, but never rename or delete the Administrator role or a role in use", async () => {
        await signIn("admin");
        expect((await call("subjects-create", { code: "X1", subjectName: "X one" })).success).toBe(true);
        const created = await call("roles-create", { roleName: "Dispatcher" });
        expect(created.success).toBe(true);
        expect(await call("roles-delete", created.role.id)).toEqual({ success: true });
        const admin = await db.prisma.role.findUniqueOrThrow({ where: { roleName: "Administrator" } });
        expect((await call("roles-update", { id: admin.id, roleName: "Boss" })).message).toBe("The Administrator role cannot be renamed.");
        expect((await call("roles-delete", admin.id)).message).toBe("The Administrator role cannot be deleted.");
        const pilot = await db.prisma.role.findUniqueOrThrow({ where: { roleName: "Pilot" } });
        expect((await call("roles-delete", pilot.id)).message).toBe("Remove this role from its 1 person first.");
    });
});
