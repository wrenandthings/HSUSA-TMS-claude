// Applies the PostgreSQL migrations before the web server starts (2026-11-27).
//
// - Usually there is nothing new: the migration folders are compared with
//   Prisma's _prisma_migrations table over one connection, and Prisma's
//   migrate command (which takes a database-wide lock) is not run at all.
// - When something is new, `prisma migrate deploy` runs with its output shown
//   as it goes, and each try is stopped after 45 s. During a deploy the old
//   server can still hold connections (Supabase free plan: 15 in all), so a
//   busy or slow database is retried rather than failing the deploy.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { createPrismaClient, limitedUrl } = require("../electron/main/prisma-client");

const root = path.resolve(__dirname, "..");
const prismaBin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
const TRIES = Number(process.env.MIGRATE_TRIES) || 8;
const WAIT_MS = Number(process.env.MIGRATE_WAIT_MS) || 15000;
const TRY_TIMEOUT_MS = Number(process.env.MIGRATE_TRY_TIMEOUT_MS) || 45000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function migrationFolders() {
    const dir = path.join(root, "prisma", "postgres", "migrations");
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

// The migrations not yet applied, or null when the database cannot say.
async function pending() {
    const prisma = createPrismaClient(1);
    try {
        const rows = await Promise.race([
            prisma.$queryRawUnsafe('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'),
            sleep(TRY_TIMEOUT_MS).then(() => { throw new Error("Timed out checking migrations"); })
        ]);
        const applied = new Set(rows.map((r) => r.migration_name));
        return migrationFolders().filter((name) => !applied.has(name));
    } catch (error) {
        // A new, empty database has no _prisma_migrations table yet.
        if (/_prisma_migrations|does not exist|42P01/.test(String(error?.message))) return migrationFolders();
        console.log(`Could not check migrations: ${String(error?.message ?? error).split("\n").filter(Boolean).pop()}`);
        return null;
    } finally {
        await prisma.$disconnect().catch(() => undefined);
    }
}

async function main() {
    for (let attempt = 1; attempt <= TRIES; attempt++) {
        const todo = await pending();
        if (todo && todo.length === 0) {
            console.log("Database is up to date; no migrations to apply.");
            return 0;
        }
        if (todo) {
            console.log(`Applying ${todo.length} migration(s): ${todo.join(", ")} (attempt ${attempt} of ${TRIES})`);
            const run = spawnSync(prismaBin, ["migrate", "deploy", "--schema", "prisma/postgres/schema.prisma"], {
                cwd: root,
                stdio: "inherit",
                timeout: TRY_TIMEOUT_MS,
                env: { ...process.env, DATABASE_URL: limitedUrl(process.env.DATABASE_URL, 1) }
            });
            if (run.status === 0) return 0;
            console.log(run.error ? `Migrate stopped: ${run.error.message}` : `Migrate exited with ${run.status}.`);
        }
        if (attempt < TRIES) {
            console.log(`Trying again in ${WAIT_MS / 1000} s.`);
            await sleep(WAIT_MS);
        }
    }
    console.error("Migrations could not be applied.");
    return 1;
}

main().then((code) => process.exit(code), (error) => { console.error(error); process.exit(1); });
