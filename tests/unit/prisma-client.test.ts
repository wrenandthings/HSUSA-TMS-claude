import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The web version's database allows 15 connections in all (2026-11-27).
const require = createRequire(import.meta.url);
const root = path.resolve(__dirname, "../..");
const { limitedUrl } = require(path.join(root, "electron/main/prisma-client.js"));

describe("shared database client", () => {
    it("caps the connections of a PostgreSQL URL, and leaves SQLite and set limits alone", () => {
        expect(limitedUrl("postgresql://u:p@h:5432/postgres", 5)).toBe("postgresql://u:p@h:5432/postgres?connection_limit=5");
        expect(limitedUrl("postgresql://u:p@h:5432/postgres?sslmode=require", 1)).toBe("postgresql://u:p@h:5432/postgres?sslmode=require&connection_limit=1");
        expect(limitedUrl("postgresql://u:p@h/db?connection_limit=2", 5)).toBe("postgresql://u:p@h/db?connection_limit=2");
        expect(limitedUrl("file:./dev.db", 5)).toBe("file:./dev.db");
    });

    it("is the only place handlers get a client from (one pool, not one per handler)", () => {
        const dir = path.join(root, "electron/main");
        const offenders = readdirSync(dir).filter((f) => f.endsWith("-handler.js") && readFileSync(path.join(dir, f), "utf8").includes("new PrismaClient("));
        expect(offenders).toEqual([]);
    });
});
