import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(__dirname, "../..");
const bin = (name: string) => path.join(root, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);

export type TestDatabase = { url: string; prisma: PrismaClient; run: (command: string, args: string[]) => string; cleanup: () => Promise<void> };

// True when the suite runs against PostgreSQL (npm run test:postgres), the
// web version's database. Tests that only make sense for the desktop's
// SQLite file (backups, the installed app's migration runner) skip then.
export const onPostgres = process.env.TEST_DATABASE === "postgres";

// Creates an empty database and applies every migration to it, the same way a
// new installation would: a SQLite file in a temp folder by default, or a new
// PostgreSQL database on the server in TEST_POSTGRES_URL.
export function createTestDatabase(): TestDatabase {
    const dir = mkdtempSync(path.join(tmpdir(), "hsusa-tms-test-"));
    // Handlers write log files; keep test logs out of the project folder.
    process.env.LOG_DIR = path.join(dir, "logs");

    let url: string;
    let dropDatabase = async () => {};
    let schemaArgs: string[] = [];
    if (onPostgres) {
        const admin = process.env.TEST_POSTGRES_URL;
        if (!admin) throw new Error("TEST_POSTGRES_URL is not set (see scripts/test-postgres.js)");
        const name = `tms_test_${randomBytes(6).toString("hex")}`;
        const server = new URL(admin);
        execFileSync(process.execPath, ["-e", `
            const { PrismaClient } = require("@prisma/client");
            const p = new PrismaClient({ datasources: { db: { url: ${JSON.stringify(admin)} } } });
            p.$executeRawUnsafe('CREATE DATABASE "${name}"').finally(() => p.$disconnect());
        `], { cwd: root, stdio: "pipe" });
        server.pathname = `/${name}`;
        url = server.toString();
        schemaArgs = ["--schema", "prisma/postgres/schema.prisma"];
        dropDatabase = async () => {
            const p = new PrismaClient({ datasources: { db: { url: admin } } });
            await p.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`).catch(() => undefined);
            await p.$disconnect();
        };
    } else {
        url = `file:${path.join(dir, "test.db")}`;
    }
    // Handlers make their own Prisma clients from DATABASE_URL.
    process.env.DATABASE_URL = url;
    const run = (command: string, args: string[]) =>
        execFileSync(bin(command), args, { cwd: root, env: { ...process.env, DATABASE_URL: url }, encoding: "utf8", stdio: "pipe" });
    run("prisma", ["migrate", "deploy", ...schemaArgs]);
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    return {
        url,
        prisma,
        run,
        cleanup: async () => {
            await prisma.$disconnect();
            await dropDatabase();
            rmSync(dir, { recursive: true, force: true });
        }
    };
}
