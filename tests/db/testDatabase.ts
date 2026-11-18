import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(__dirname, "../..");
const bin = (name: string) => path.join(root, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);

export type TestDatabase = { url: string; prisma: PrismaClient; run: (command: string, args: string[]) => string; cleanup: () => Promise<void> };

// Creates an empty SQLite file in a temp folder and applies every migration in
// prisma/migrations to it, the same way a new installation would.
export function createTestDatabase(): TestDatabase {
    const dir = mkdtempSync(path.join(tmpdir(), "hsusa-tms-test-"));
    const url = `file:${path.join(dir, "test.db")}`;
    const run = (command: string, args: string[]) =>
        execFileSync(bin(command), args, { cwd: root, env: { ...process.env, DATABASE_URL: url }, encoding: "utf8", stdio: "pipe" });
    run("prisma", ["migrate", "deploy"]);
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    return {
        url,
        prisma,
        run,
        cleanup: async () => {
            await prisma.$disconnect();
            rmSync(dir, { recursive: true, force: true });
        }
    };
}
