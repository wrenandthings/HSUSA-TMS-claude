import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";

const require = createRequire(import.meta.url);
const main = path.resolve(__dirname, "../../electron/main");
const { createBackupService, databaseFile } = require(path.join(main, "backup-service.js"));
const { createLogger } = require(path.join(main, "logging-service.js"));
let db: TestDatabase;
let folder: string;

beforeAll(() => {
    db = createTestDatabase();
    db.run("tsx", ["prisma/seed.ts"]);
    folder = path.join(mkdtempSync(path.join(tmpdir(), "hsusa-backups-")), "backups");
});
afterAll(async () => { await db.cleanup(); rmSync(path.dirname(folder), { recursive: true, force: true }); });

describe("backups", () => {
    it("find the database file from DATABASE_URL, relative to prisma/", () => {
        expect(databaseFile("file:./dev.db", "/app/prisma")).toBe(path.resolve("/app/prisma/dev.db"));
        expect(databaseFile("file:/data/tms.db", "/app/prisma")).toBe("/data/tms.db");
        expect(() => databaseFile("postgres://x", "/app/prisma")).toThrow("SQLite");
    });

    it("make a working copy of the database, recorded, audited and logged", async () => {
        const logger = createLogger({ dir: process.env.LOG_DIR });
        const service = createBackupService(db.prisma, { folder, logger, now: () => new Date(2026, 10, 21, 4, 30, 0) });
        const result = await service.backUp(null, "manual");
        expect(result).toMatchObject({ success: true, name: "hsusa-tms-20261121-043000.db", removed: [] });
        const copy = new PrismaClient({ datasources: { db: { url: `file:${path.join(folder, result.name)}` } } });
        expect(await copy.role.count()).toBe(12);
        await copy.$disconnect();
        expect(await db.prisma.backup.count()).toBe(1);
        expect(await db.prisma.auditLog.count({ where: { action: "BACKUP_CREATED" } })).toBe(1);
    });

    it("skip the daily backup when one is less than a day old", async () => {
        const service = createBackupService(db.prisma, { folder, now: () => new Date() });
        expect(await service.backUpIfDue()).toEqual({ success: true, skipped: true });
    });

    it("remove backups older than BackupRetentionDays, file and record", async () => {
        const old = await db.prisma.backup.findFirstOrThrow();
        await db.prisma.backup.update({ where: { id: old.id }, data: { createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000) } });
        const service = createBackupService(db.prisma, { folder, now: () => new Date() });
        const result = await service.backUpIfDue();
        expect(result.success).toBe(true);
        expect(result.removed).toEqual([old.backupName]);
        expect(existsSync(old.fileLocation)).toBe(false);
        expect(readdirSync(folder)).toHaveLength(1);
        expect(await db.prisma.backup.count()).toBe(1);
    });
});

describe("backup channels", () => {
    it("are for administrators only", async () => {
        const handlers = new Map<string, (event: unknown, input?: unknown) => Promise<any>>();
        process.env.DATABASE_URL = db.url;
        const electronPath = require.resolve("electron");
        require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true, exports: { ipcMain: { handle: (c: string, fn: any) => handlers.set(c, fn) } } } as any;
        require(path.join(main, "backup-handler.js")).registerBackupHandlers();
        const auth = require(path.join(main, "auth-context.js"));
        expect(await handlers.get("backups-create")!({})).toEqual({ success: false, message: "Authentication required" });
        const user = await db.prisma.user.create({ data: { username: "pilot", passwordHash: "x", firstName: "P", lastName: "P", status: "ACTIVE" } });
        auth.setCurrentUser(user.id);
        expect(await handlers.get("backups-list")!({})).toEqual({ success: false, message: "Only an administrator can manage backups." });
        auth.setCurrentUser(null);
    });
});
