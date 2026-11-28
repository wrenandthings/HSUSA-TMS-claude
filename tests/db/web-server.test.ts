import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";

// The web version's server (web roadmap phase 2): the same handlers behind
// POST /api/<channel>, one session per browser.
const require = createRequire(import.meta.url);
const root = path.resolve(__dirname, "../..");
let db: TestDatabase;
let base: string;
let server: any;
let clock = Date.now();

beforeAll(async () => {
    db = createTestDatabase();
    process.env.DATABASE_URL = db.url;
    db.run("tsx", ["prisma/seed.ts"]);
    const { hashPassword } = require(path.join(root, "electron/main/passwords.js"));
    await db.prisma.user.update({ where: { username: "admin" }, data: { passwordHash: await hashPassword("Hangar-Door-42x"), mustChangePassword: false } });
    await db.prisma.user.update({ where: { username: "User" }, data: { passwordHash: await hashPassword("Rotor-Blade-77y"), mustChangePassword: false } });
    const staticDir = mkdtempSync(path.join(os.tmpdir(), "tms-web-"));
    mkdirSync(path.join(staticDir, "assets"));
    writeFileSync(path.join(staticDir, "index.html"), "<html>TMS</html>");
    writeFileSync(path.join(staticDir, "assets", "app.js"), "console.log(1)");
    const { createWebServer } = require(path.join(root, "server/web-server.js"));
    ({ server } = createWebServer({ staticDir, now: () => clock }));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.cleanup();
});

// A browser: keeps its own session cookie.
function browser() {
    let cookie = "";
    return async (channel: string, input?: unknown, headers: Record<string, string> = { "X-TMS": "1" }) => {
        const response = await fetch(`${base}/api/${channel}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers, ...(cookie ? { Cookie: cookie } : {}) },
            body: input === undefined ? "" : JSON.stringify(input)
        });
        const set = response.headers.get("set-cookie");
        if (set) cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
        return { status: response.status, body: await response.json(), setCookie: set };
    };
}

describe("web server", () => {
    it("offers every function the desktop app's preload offers", async () => {
        const preload = readFileSync(path.join(root, "electron/preload/preload.js"), "utf8");
        const channels = [...preload.matchAll(/invoke\("([a-z0-9-]+)"/g)].map((m) => m[1]);
        expect(channels.length).toBeGreaterThan(60);
        const { apiFromPreload } = require(path.join(root, "server/api-from-preload.js"));
        expect(apiFromPreload(preload)).toContain("export function createApi(ipcRenderer)");
        const open = browser();
        for (const channel of channels) {
            expect((await open(channel)).status, channel).not.toBe(404);
        }
    });

    it("refuses requests without the app's header, and anything but POST", async () => {
        expect((await browser()("auth-login", { username: "admin", password: "Hangar-Door-42x" }, {})).status).toBe(403);
        expect((await fetch(`${base}/api/auth-login`)).status).toBe(405);
        expect((await browser()("no-such-thing")).status).toBe(404);
    });

    it("keeps each browser's sign-in separate, with a safe cookie", async () => {
        const admin = browser();
        const pilot = browser();
        expect((await admin("configuration-get-all")).body).toEqual({ success: false, message: "Authentication required" });

        const login = await admin("auth-login", { username: "admin", password: "Hangar-Door-42x" });
        expect(login.body.success).toBe(true);
        expect(login.setCookie).toMatch(/HttpOnly/);
        expect(login.setCookie).toMatch(/SameSite=Strict/);
        expect((await pilot("auth-login", { username: "User", password: "Rotor-Blade-77y" })).body.success).toBe(true);

        // Same request, different people: only the administrator may save settings.
        expect((await admin("configuration-get-all")).body.canEdit).toBe(true);
        expect((await pilot("configuration-get-all")).body.canEdit).toBe(false);
        expect((await pilot("configuration-save", { changes: { SessionTimeoutMinutes: "15" } })).body).toEqual({ success: false, message: "Only an administrator can change settings." });

        // Dates come back as text the screens turn back into dates.
        expect(typeof (await pilot("training-mine")).body.success).toBe("boolean");

        await admin("auth-logout");
        expect((await admin("configuration-get-all")).body.success).toBe(false);
        expect((await pilot("configuration-get-all")).body.success).toBe(true);
    });

    it("signs a browser out after the idle time, on the server", async () => {
        const pilot = browser();
        await pilot("auth-login", { username: "User", password: "Rotor-Blade-77y" });
        clock += 29 * 60 * 1000;
        expect((await pilot("training-mine")).body.success).toBe(true);
        clock += 31 * 60 * 1000;
        expect((await pilot("training-mine")).body).toEqual({ success: false, message: "Authentication required" });
    });

    it("stops guessing after 10 failed sign-ins for 15 minutes", async () => {
        const guesser = browser();
        for (let i = 0; i < 10; i++) expect((await guesser("auth-login", { username: "admin", password: "wrong" })).body.success).toBe(false);
        expect((await guesser("auth-login", { username: "admin", password: "Hangar-Door-42x" })).status).toBe(429);
        clock += 16 * 60 * 1000;
        expect((await guesser("auth-login", { username: "admin", password: "Hangar-Door-42x" })).body.success).toBe(true);
    });

    it("answers nothing but sign-in to a browser that is not signed in", async () => {
        const stranger = browser();
        for (const channel of ["users-get-all", "questions-get-all", "subjects-get-all", "qualifications-get-all", "users-get-by-id"]) {
            expect((await stranger(channel)).body, channel).toEqual({ success: false, message: "Authentication required" });
        }
        expect((await stranger("auth-password-rules")).body.success).toBe(true);
    });

    it("keeps a sign-in when the server restarts (a free host sleeping), and refuses a forged cookie", async () => {
        const pilot = browser();
        const login = await pilot("auth-login", { username: "User", password: "Rotor-Blade-77y" });
        const cookie = String(login.setCookie).split(";")[0];
        const { createWebServer } = require(path.join(root, "server/web-server.js"));
        const restarted = createWebServer({ staticDir: os.tmpdir(), now: () => clock }).server;
        await new Promise<void>((resolve) => restarted.listen(0, "127.0.0.1", resolve));
        const ask = (value: string) => fetch(`http://127.0.0.1:${(restarted.address() as AddressInfo).port}/api/training-mine`, {
            method: "POST", headers: { "Content-Type": "application/json", "X-TMS": "1", Cookie: value }, body: ""
        }).then((r) => r.json());
        expect((await ask(cookie)).success).toBe(true);
        const [name, value] = cookie.split("=");
        const [body] = value.split(".");
        const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), userId: "someone-else" })).toString("base64url");
        expect(await ask(`${name}=${forged}.${value.split(".")[1]}`)).toEqual({ success: false, message: "Authentication required" });
        await new Promise((resolve) => restarted.close(resolve));
    });

    it("serves the screens, and never files outside them", async () => {
        expect(await (await fetch(`${base}/`)).text()).toBe("<html>TMS</html>");
        expect(await (await fetch(`${base}/assets/app.js`)).text()).toBe("console.log(1)");
        expect(await (await fetch(`${base}/quizzes`)).text()).toBe("<html>TMS</html>");
        const escape = await fetch(`${base}/..%2F..%2Fpackage.json`);
        expect(escape.status).toBe(404);
        expect(await escape.text()).not.toContain("electron");
    });
});
