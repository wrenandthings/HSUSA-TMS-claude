// HSUSA TMS web server (web roadmap phase 2, owner 2026-11-24).
//
// Serves the same screens as the desktop app (built into dist-web/ by
// `npm run web:build`) and answers their calls at POST /api/<channel>. The
// handlers in electron/main/ are used unchanged: they register themselves
// with ipcMain.handle(), which this file provides, and they find the signed-in
// person through auth-context.js, which this file sets for each request.
//
// Start: `npm run web:start` (port 8080, or PORT). Database: DATABASE_URL
// from .env, as for the desktop app.

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SESSION_COOKIE = "tms_session";
const MAX_BODY_BYTES = 20 * 1024 * 1024; // question-bank CSVs are a few MB
const FAILED_SIGN_IN_LIMIT = 10; // per address, per 15 minutes
const FAILED_SIGN_IN_WINDOW_MS = 15 * 60 * 1000;
// The only calls answered without a sign-in. Everything else is refused here,
// before any handler runs, so nothing can be read by a stranger even where a
// desktop-era handler forgot to check (users, questions, subjects lists).
const PUBLIC_CHANNELS = new Set(["auth-login", "auth-password-rules", "auth-logout"]);

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2"
};

// The handlers call require("electron").ipcMain.handle(channel, fn). Outside
// Electron, give them a stand-in that collects the functions instead.
let registry = null;
function installHandlerRegistry() {
    if (registry) return registry;
    const handlers = new Map();
    registry = handlers;
    const fake = { ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) } };
    let electronPath;
    try { electronPath = require.resolve("electron"); } catch { electronPath = path.join(ROOT, "node_modules", "electron", "index.js"); }
    require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true, exports: fake };
    return handlers;
}

// JSON cannot carry BigInt (Backup.sizeBytes); Electron's IPC could.
const toJson = (value) => JSON.stringify(value, (key, v) => (typeof v === "bigint" ? Number(v) : v));

function readBody(request) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        request.on("data", (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) { reject(Object.assign(new Error("Request too large"), { status: 413 })); request.destroy(); return; }
            chunks.push(chunk);
        });
        request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        request.on("error", reject);
    });
}

function readCookie(request, name) {
    for (const part of String(request.headers.cookie ?? "").split(";")) {
        const [key, ...rest] = part.trim().split("=");
        if (key === name) return decodeURIComponent(rest.join("="));
    }
    return null;
}

function createWebServer(options = {}) {
    const staticDir = options.staticDir ?? path.join(ROOT, "dist-web");
    const secureCookies = options.secureCookies ?? process.env.TMS_SECURE_COOKIES === "1";
    const now = options.now ?? (() => Date.now());

    const firstServer = !registry;
    const handlers = installHandlerRegistry();
    const { runWithUser } = require("../electron/main/auth-context");
    const { registerAllHandlers } = require("../electron/main/register-handlers");
    const { getLogger } = require("../electron/main/logging-service");
    if (firstServer) registerAllHandlers();

    // Who is signed in, per browser: a signed cookie holding the person's id,
    // when they were last active and their idle limit. It is kept by the
    // browser, so a free host that sleeps and wakes (losing its memory) does
    // not sign everyone out. The signature key is SESSION_SECRET, or else
    // derived from DATABASE_URL (itself a secret the host keeps), so it stays
    // the same across restarts without another setting to manage.
    const secret = options.sessionSecret ?? process.env.SESSION_SECRET
        ?? (process.env.DATABASE_URL ? crypto.createHash("sha256").update(`tms-session:${process.env.DATABASE_URL}`).digest("hex") : crypto.randomBytes(32).toString("hex"));
    const sign = (body) => crypto.createHmac("sha256", secret).update(body).digest("base64url");
    const failures = new Map(); // address -> [times]

    function readSession(request) {
        const raw = readCookie(request, SESSION_COOKIE);
        if (!raw || !raw.includes(".")) return null;
        const [body, signature] = raw.split(".");
        const expected = sign(body);
        if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
        let session;
        try { session = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return null; }
        if (!session?.userId) return null;
        // Server-side idle sign-out, with the same setting as the desktop window.
        if (now() - Number(session.lastSeen) > Number(session.timeoutMinutes || 30) * 60 * 1000) return null;
        return session;
    }

    function sessionCookie(session) {
        const body = Buffer.from(JSON.stringify(session)).toString("base64url");
        return cookie(`${body}.${sign(body)}`, 12 * 60 * 60);
    }

    function cookie(value, maxAgeSeconds) {
        return [
            `${SESSION_COOKIE}=${value}`,
            "Path=/",
            "HttpOnly",
            "SameSite=Strict",
            ...(secureCookies ? ["Secure"] : []),
            `Max-Age=${maxAgeSeconds}`
        ].join("; ");
    }

    function tooManyFailures(address) {
        const recent = (failures.get(address) ?? []).filter((t) => now() - t < FAILED_SIGN_IN_WINDOW_MS);
        failures.set(address, recent);
        return recent.length >= FAILED_SIGN_IN_LIMIT;
    }

    async function handleApi(request, response, channel) {
        const send = (status, body, headers = {}) => {
            response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
            response.end(toJson(body));
        };
        if (request.method !== "POST") return send(405, { success: false, message: "Use POST." });
        // Only the app's own pages send this header. Another site cannot add
        // it to a request without the browser asking this server first, which
        // it refuses, so this blocks cross-site requests (with SameSite cookies).
        if (request.headers["x-tms"] !== "1") return send(403, { success: false, message: "Request refused." });
        const handler = handlers.get(channel);
        if (!handler) return send(404, { success: false, message: "Unknown request." });

        const address = request.socket.remoteAddress ?? "";
        if (channel === "auth-login" && tooManyFailures(address)) {
            return send(429, { success: false, message: "Too many failed sign-ins. Wait 15 minutes and try again." });
        }

        let input;
        try {
            const text = await readBody(request);
            input = text ? JSON.parse(text) : undefined;
        } catch (error) {
            return send(error.status ?? 400, { success: false, message: error.status === 413 ? "The file is too large." : "Bad request." });
        }
        if (input === null) input = undefined;

        const session = readSession(request);
        if (!session && !PUBLIC_CHANNELS.has(channel)) {
            const headers = readCookie(request, SESSION_COOKIE) ? { "Set-Cookie": cookie("", 0) } : {};
            return send(200, { success: false, message: "Authentication required" }, headers);
        }
        let outcome;
        try {
            outcome = await runWithUser(session?.userId ?? null, () => handler({ sender: null }, input));
        } catch (error) {
            getLogger().failure("WEB_REQUEST_FAILED", error);
            // Also to the console, so the host's log shows it (its disk is not kept).
            console.error(`Request ${channel} failed:`, error);
            return send(500, { success: false, message: "Something went wrong. It has been logged." });
        }

        const headers = {};
        if (outcome.userId && outcome.userId !== session?.userId) {
            // Signed in (or as someone else): a new cookie.
            const timeoutMinutes = Number(outcome.result?.sessionTimeoutMinutes) || 30;
            headers["Set-Cookie"] = sessionCookie({ userId: outcome.userId, lastSeen: now(), timeoutMinutes, issued: now() });
        } else if (!outcome.userId && session) {
            headers["Set-Cookie"] = cookie("", 0); // signed out
        } else if (session) {
            // Still active: move the idle clock on.
            headers["Set-Cookie"] = sessionCookie({ ...session, lastSeen: now() });
        }
        if (channel === "auth-login" && !outcome.result?.success) {
            failures.set(address, [...(failures.get(address) ?? []), now()]);
        }
        return send(200, outcome.result, headers);
    }

    function handleStatic(request, response, pathname) {
        if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405); response.end(); return; }
        const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
        let file = path.resolve(staticDir, relative || "index.html");
        if (!file.startsWith(path.resolve(staticDir) + path.sep) && file !== path.resolve(staticDir)) { response.writeHead(404); response.end(); return; }
        // Any other address is a screen inside the app: send the page itself.
        // The build names it web.html (vite.web.config.ts).
        if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            file = path.join(staticDir, fs.existsSync(path.join(staticDir, "index.html")) ? "index.html" : "web.html");
        }
        if (!fs.existsSync(file)) {
            response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
            response.end("The screens are not built yet. Run: npm run web:build");
            return;
        }
        const isIndex = path.extname(file) === ".html";
        response.writeHead(200, {
            "Content-Type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
            "Cache-Control": isIndex ? "no-cache" : "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "same-origin"
        });
        if (request.method === "HEAD") { response.end(); return; }
        fs.createReadStream(file).pipe(response);
    }

    const server = http.createServer((request, response) => {
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        const api = pathname.match(/^\/api\/([a-z0-9-]+)$/);
        if (api) {
            handleApi(request, response, api[1]).catch((error) => {
                getLogger().failure("WEB_REQUEST_FAILED", error);
                if (!response.headersSent) { response.writeHead(500); response.end(); }
            });
        } else {
            handleStatic(request, response, pathname);
        }
    });

    return { server, handlers };
}

module.exports = { createWebServer };

// Brings in any question bank in documents/question-banks/ that is new or
// changed since it was last imported, as the installed desktop app does at
// start. Updating a bank for everyone = replace the CSV and restart.
async function importBundledQuestionBanks() {
    const { PrismaClient } = require("@prisma/client");
    const { importBundledBanks } = require("../electron/main/first-run");
    const { createQuestionBankImporter } = require("../electron/main/question-bank");
    const { getLogger } = require("../electron/main/logging-service");
    const prisma = new PrismaClient();
    try {
        return await importBundledBanks(prisma, path.join(ROOT, "documents", "question-banks"), createQuestionBankImporter(prisma),
            (file, result) => getLogger().application(result?.success ? "QUESTION_BANK_IMPORTED" : "QUESTION_BANK_IMPORT_FAILED", { file, created: result?.created, updated: result?.updated, message: result?.message }));
    } finally {
        await prisma.$disconnect();
    }
}

module.exports.importBundledQuestionBanks = importBundledQuestionBanks;

// Runs prisma/seed.ts only when it has new content: when its SEED_VERSION is
// higher than the one recorded in Configuration (as the installed desktop app
// does), or on a new database. The seed is slow over a long-distance database
// link (about a minute), so the hosted site must not run it on every wake-up.
async function seedIfNeeded() {
    const { execFileSync } = require("node:child_process");
    const { PrismaClient } = require("@prisma/client");
    const source = fs.readFileSync(path.join(ROOT, "prisma", "seed.ts"), "utf8");
    const version = Number(source.match(/const SEED_VERSION = (\d+);/)?.[1] ?? 1);
    const prisma = new PrismaClient();
    try {
        const recorded = await prisma.configuration.findUnique({ where: { key: "SeedVersion" } });
        const hasAdmin = await prisma.user.count({ where: { username: "admin" } });
        if (hasAdmin && Number(recorded?.value) >= version) return false;
        const tsx = path.join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
        execFileSync(tsx, ["prisma/seed.ts"], { cwd: ROOT, stdio: "inherit", env: process.env });
        await prisma.configuration.upsert({
            where: { key: "SeedVersion" },
            update: { value: String(version) },
            create: { key: "SeedVersion", value: String(version), description: "Seed version last applied" }
        });
        return true;
    } finally {
        await prisma.$disconnect();
    }
}

module.exports.seedIfNeeded = seedIfNeeded;

if (require.main === module) {
    require("../electron/main/load-env").loadEnv(ROOT);
    const port = Number(process.env.PORT) || 8080;
    const { getLogger } = require("../electron/main/logging-service");
    // Open the site first: a host waits only a few minutes for the port, and a
    // free host that wakes on a visit should answer as soon as it can. New
    // starting data and question banks are then brought in behind it.
    const { server } = createWebServer();
    server.listen(port, () => {
        getLogger().application("WEB_SERVER_STARTED", { port });
        console.log(`HSUSA TMS web version: http://localhost:${port}`);
        (async () => {
            if (await seedIfNeeded()) console.log("Starting data added.");
            const created = await importBundledQuestionBanks();
            if (created) console.log(`Question banks imported: ${created} new questions.`);
        })().catch((error) => {
            getLogger().failure("WEB_STARTUP_DATA_FAILED", error);
            console.error("Starting data or question banks could not be loaded:", error);
        });
    });
}
