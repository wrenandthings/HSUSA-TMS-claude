import { defineConfig } from "vitest/config";

// Run tests in the owner's time zone so date boundaries behave as they do in use.
process.env.TZ = "America/New_York";

export default defineConfig({
    test: {
        include: ["tests/unit/**/*.test.ts"]
    }
});
