import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The web version's PostgreSQL schema is made from the desktop's SQLite one.
const require = createRequire(import.meta.url);
const root = path.resolve(__dirname, "../..");

describe("PostgreSQL schema", () => {
    it("matches prisma/schema.prisma (run npm run db:postgres-schema after editing it)", () => {
        const { postgresSchema } = require(path.join(root, "scripts/postgres-schema.js"));
        const sqlite = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
        expect(readFileSync(path.join(root, "prisma/postgres/schema.prisma"), "utf8")).toBe(postgresSchema(sqlite));
        expect(postgresSchema(sqlite)).toContain('provider = "postgresql"');
    });
});
