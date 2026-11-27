import { defineConfig } from "vitest/config";

// Run tests in the owner's time zone so date boundaries behave as they do in use.
process.env.TZ = "America/New_York";

export default defineConfig({
    test: {
        include: ["tests/unit/**/*.test.ts", "tests/db/**/*.test.ts"],
        // On PostgreSQL (npm run test:postgres, the web version's database) skip
        // the tests that are about the desktop's SQLite file: its backups, the
        // installed app's start-up, and upgrades of old SQLite databases.
        exclude: process.env.TEST_DATABASE === "postgres"
            ? ["**/node_modules/**", "tests/db/backup.test.ts", "tests/db/electron-startup.test.ts", "tests/db/first-run.test.ts",
               "tests/db/per-person-dates-migration.test.ts", "tests/db/subject-code-migration.test.ts"]
            : ["**/node_modules/**"],
        // Database tests run migrations and the seed script, which takes a few seconds.
        testTimeout: 60000,
        hookTimeout: 60000
    }
});
