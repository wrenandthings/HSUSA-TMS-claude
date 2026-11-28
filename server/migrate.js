// Applies the PostgreSQL migrations before the web server starts, retrying
// while the database is full or not reachable yet. During a deploy the old
// server can still hold connections (Supabase free plan: 15 in all), so a
// first refusal is not a reason to fail the deploy (2026-11-27).
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { limitedUrl } = require("../electron/main/prisma-client");

const root = path.resolve(__dirname, "..");
const prisma = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
const RETRYABLE = /EMAXCONN|max clients|P1001|P1017|Can't reach database|Timed out/i;
const TRIES = Number(process.env.MIGRATE_TRIES) || 12;
const WAIT_MS = Number(process.env.MIGRATE_WAIT_MS) || 15000;

for (let attempt = 1; attempt <= TRIES; attempt++) {
    const run = spawnSync(prisma, ["migrate", "deploy", "--schema", "prisma/postgres/schema.prisma"], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, DATABASE_URL: limitedUrl(process.env.DATABASE_URL, 1) }
    });
    process.stdout.write(run.stdout ?? "");
    process.stderr.write(run.stderr ?? "");
    if (run.status === 0) process.exit(0);
    const output = `${run.stdout}\n${run.stderr}`;
    if (!RETRYABLE.test(output) || attempt === TRIES) {
        console.error(`Migrations failed (attempt ${attempt} of ${TRIES}).`);
        process.exit(run.status || 1);
    }
    console.log(`Database busy or not reachable; trying again in ${WAIT_MS / 1000} s (attempt ${attempt} of ${TRIES}).`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, WAIT_MS);
}
