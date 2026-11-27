import { createRequire } from "node:module";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";

// The hosted web version (TMS_PUBLIC_SITE=1) must not start with a known
// admin password or the blank-password testing account.
const require = createRequire(import.meta.url);
let db: TestDatabase;

beforeAll(() => { db = createTestDatabase(); });
afterAll(async () => {
    delete process.env.TMS_PUBLIC_SITE;
    delete process.env.TMS_ADMIN_INITIAL_PASSWORD;
    await db.cleanup();
});

describe("seed on the public web site", () => {
    it("refuses to create admin without an owner-supplied starting password", () => {
        process.env.TMS_PUBLIC_SITE = "1";
        delete process.env.TMS_ADMIN_INITIAL_PASSWORD;
        expect(() => db.run("tsx", ["prisma/seed.ts"])).toThrow();
    });

    it("uses the supplied password, still forces a change, and makes no testing account", async () => {
        process.env.TMS_PUBLIC_SITE = "1";
        process.env.TMS_ADMIN_INITIAL_PASSWORD = "Owner-Picked-Start-9";
        db.run("tsx", ["prisma/seed.ts"]);
        const { checkPassword } = require(path.resolve(__dirname, "../../electron/main/passwords.js"));
        const admin = await db.prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
        expect(admin.mustChangePassword).toBe(true);
        expect((await checkPassword(admin.passwordHash, "Owner-Picked-Start-9")).matches).toBe(true);
        expect((await checkPassword(admin.passwordHash, "CHANGE_ME")).matches).toBe(false);
        expect(await db.prisma.user.findUnique({ where: { username: "User" } })).toBeNull();
    });
});
