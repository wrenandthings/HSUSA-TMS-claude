import { defineConfig } from "vitest/config";

// Run tests in the owner's time zone so date boundaries behave as they do in use.
process.env.TZ = "America/New_York";

export default defineConfig({
    test: {
        include: ["tests/unit/**/*.test.ts", "tests/db/**/*.test.ts"],
        // Database tests run migrations and the seed script, which takes a few seconds.
        testTimeout: 60000,
        hookTimeout: 60000
    }
});
