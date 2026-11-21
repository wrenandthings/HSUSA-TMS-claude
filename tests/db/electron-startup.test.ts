import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";

// Sprint 1, Epic 10: "Electron Startup". Runs the real main.js with a
// stand-in for Electron, against a fresh database.
const require = createRequire(import.meta.url);
const root = path.resolve(__dirname, "../..");
const windows: { options: any; url?: string }[] = [];
const channels = new Set<string>();
let db: TestDatabase;

beforeAll(async () => {
    db = createTestDatabase();
    process.env.DATABASE_URL = db.url;
    let ready!: () => void;
    const whenReady = new Promise<void>((resolve) => { ready = resolve; });
    const electron = {
        app: { whenReady: () => whenReady, on: () => undefined, getVersion: () => "1.0.0", quit: () => undefined },
        BrowserWindow: class { constructor(options: any) { windows.push({ options }); } loadURL(url: string) { windows[windows.length - 1].url = url; } on() {} },
        ipcMain: { handle: (channel: string) => channels.add(channel) }
    };
    const electronPath = require.resolve("electron");
    require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true, exports: electron } as any;
    require(path.join(root, "main.js"));
    ready();
    // Let the start-up code and the background daily backup finish.
    for (let i = 0; i < 50 && !existsSync(path.join(path.dirname(db.url.slice(5)), "backups")); i += 1) await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 300));
});
afterAll(async () => { await db.cleanup(); });

describe("Electron start-up", () => {
    it("opens one secure window on the Vite address with the preload script", () => {
        expect(windows).toHaveLength(1);
        const { options, url } = windows[0];
        expect(url).toBe("http://localhost:5173");
        expect(options.webPreferences).toMatchObject({ contextIsolation: true, nodeIntegration: false });
        expect(existsSync(options.webPreferences.preload)).toBe(true);
    });

    it("registers the handlers every screen uses", () => {
        for (const channel of ["auth-login", "auth-logout", "users-get-all", "roles-get-all", "subjects-get-all", "questions-get-all",
            "questions-import-bank", "qualifications-get-all", "configuration-get-all", "backups-create"]) {
            expect(channels, channel).toContain(channel);
        }
    });

    it("logs the start and makes the first daily backup next to the database", () => {
        expect(readFileSync(path.join(process.env.LOG_DIR!, "application.log"), "utf8")).toContain('"event":"APP_STARTED"');
        const backups = readdirSync(path.join(path.dirname(db.url.slice(5)), "backups"));
        expect(backups).toHaveLength(1);
        expect(backups[0]).toMatch(/^hsusa-tms-\d{8}-\d{6}\.db$/);
    });
});
