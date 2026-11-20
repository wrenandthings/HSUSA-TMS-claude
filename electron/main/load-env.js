const fs = require("fs");
const path = require("path");

// The Prisma command-line tools read .env by themselves, but the running app
// does not, so database calls fail with "Environment variable not found:
// DATABASE_URL". Load the project's .env at startup. Values already set in the
// environment win, so a DATABASE_URL set some other way is kept.
function loadEnv(projectDir) {
    const file = path.join(projectDir, ".env");
    if (!fs.existsSync(file)) return false;
    const before = { ...process.env };
    process.loadEnvFile(file);
    for (const [key, value] of Object.entries(before)) process.env[key] = value;
    return true;
}

module.exports = { loadEnv };
