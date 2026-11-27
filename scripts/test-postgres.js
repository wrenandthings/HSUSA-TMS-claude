// Runs the database tests against PostgreSQL, the web version's database:
//   TEST_POSTGRES_URL=postgresql://user:password@host:5432/postgres npm run test:postgres
// The URL must let the tests create and drop databases (a local or
// throw-away server, never the live one). The Prisma client is made for
// PostgreSQL for the run, then made for SQLite again afterwards.
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const run = (args, env = {}) => spawnSync(npx, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...env }, shell: process.platform === "win32" }).status;

if (!process.env.TEST_POSTGRES_URL) {
    console.error("Set TEST_POSTGRES_URL to a PostgreSQL server the tests may create databases on.");
    process.exit(1);
}
let status = run(["prisma", "generate", "--schema", "prisma/postgres/schema.prisma"]);
if (status === 0) status = run(["vitest", "run", "tests/db", ...process.argv.slice(2)], { TEST_DATABASE: "postgres" });
run(["prisma", "generate"]);
process.exit(status ?? 1);
