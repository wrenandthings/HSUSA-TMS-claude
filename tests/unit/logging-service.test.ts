import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { createLogger } = require("../../electron/main/logging-service.js");
const dirs: string[] = [];
const newDir = () => { const d = mkdtempSync(path.join(tmpdir(), "hsusa-logs-")); dirs.push(d); return path.join(d, "logs"); };
afterEach(() => dirs.splice(0).forEach(d => rmSync(d, { recursive: true, force: true })));

describe("logging service", () => {
    it("writes one JSON line per event to the category's file, creating the folder", () => {
        const dir = newDir();
        const log = createLogger({ dir, now: () => new Date("2026-11-21T04:00:00Z") });
        log.security("SIGNED_IN", { username: "admin" });
        log.import("QUESTION_BANK_IMPORTED", { created: 704 });
        expect(JSON.parse(readFileSync(path.join(dir, "security.log"), "utf8"))).toEqual({ time: "2026-11-21T04:00:00.000Z", event: "SIGNED_IN", username: "admin" });
        expect(readFileSync(path.join(dir, "import.log"), "utf8")).toContain('"created":704');
    });

    it("rotates a full file and keeps at most maxFiles old ones", () => {
        const dir = newDir();
        const log = createLogger({ dir, maxBytes: 200, maxFiles: 2 });
        for (let i = 0; i < 20; i += 1) log.application("TICK", { i, padding: "x".repeat(60) });
        expect(readdirSync(dir).sort()).toEqual(["application.1.log", "application.2.log", "application.log"]);
        const newest = readFileSync(path.join(dir, "application.log"), "utf8").trim().split("\n").map(l => JSON.parse(l).i);
        expect(newest[newest.length - 1]).toBe(19);
    });

    it("records errors with their message, and refuses unknown categories", () => {
        const dir = newDir();
        const log = createLogger({ dir });
        log.failure("UNCAUGHT_EXCEPTION", new Error("boom"));
        expect(JSON.parse(readFileSync(path.join(dir, "error.log"), "utf8"))).toMatchObject({ event: "UNCAUGHT_EXCEPTION", message: "boom" });
        expect(() => log.write("diary", "X")).toThrow("Unknown log category diary");
    });
});
