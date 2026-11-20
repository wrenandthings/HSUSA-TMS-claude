import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";

const require = createRequire(import.meta.url);
const { blankAdminPassword } = require("../../scripts/dev-blank-admin.js");
const { createAuthService } = require("../../electron/main/auth-service.js");
let db: TestDatabase;

beforeAll(() => { db = createTestDatabase(); db.run("tsx", ["prisma/seed.ts"]); });
afterAll(async () => { await db.cleanup(); });

describe("testing-only blank admin password", () => {
    it("lets admin sign in with an empty password and no forced change, and is audited", async () => {
        await blankAdminPassword(db.prisma);
        const auth = createAuthService(db.prisma);
        expect(await auth.login("admin", "")).toMatchObject({ success: true, mustChangePassword: false });
        expect((await auth.login("admin", "CHANGE_ME")).success).toBe(false);
        expect(await db.prisma.auditLog.count({ where: { action: "USER_PASSWORD_BLANKED_FOR_TESTING" } })).toBe(1);
    });
});
