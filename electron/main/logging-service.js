// Log files (Sprint 1, Epic 7). One file per category in the logs folder,
// one JSON object per line. A file over maxBytes is rotated:
// security.log -> security.1.log -> ... -> security.<maxFiles>.log, and the
// oldest is dropped. Never log passwords, hashes or other secrets.
const fs = require("fs");
const path = require("path");

const CATEGORIES = ["application", "security", "backup", "import", "export", "error"];

function createLogger({ dir, maxBytes = 5 * 1024 * 1024, maxFiles = 5, now = () => new Date() } = {}) {
    if (!dir) throw new Error("A logs folder is required");

    function fileFor(category, index) {
        return path.join(dir, index ? `${category}.${index}.log` : `${category}.log`);
    }

    function rotateIfNeeded(category, incoming) {
        const current = fileFor(category);
        let size = 0;
        try { size = fs.statSync(current).size; } catch { return; }
        if (size + incoming <= maxBytes) return;
        const oldest = fileFor(category, maxFiles);
        if (fs.existsSync(oldest)) fs.rmSync(oldest);
        for (let i = maxFiles - 1; i >= 1; i -= 1) {
            if (fs.existsSync(fileFor(category, i))) fs.renameSync(fileFor(category, i), fileFor(category, i + 1));
        }
        fs.renameSync(current, fileFor(category, 1));
    }

    // Logging must never break the app: any failure here is swallowed after
    // one attempt to report it on the console.
    function write(category, event, details = {}) {
        if (!CATEGORIES.includes(category)) throw new Error(`Unknown log category ${category}`);
        try {
            fs.mkdirSync(dir, { recursive: true });
            const line = JSON.stringify({ time: now().toISOString(), event, ...details }) + "\n";
            rotateIfNeeded(category, Buffer.byteLength(line));
            fs.appendFileSync(fileFor(category), line);
        } catch (error) {
            console.error("Could not write log", category, event, error?.message);
        }
    }

    const logger = { dir, write };
    for (const category of CATEGORIES) logger[category] = (event, details) => write(category, event, details);
    logger.failure = (event, error, details = {}) =>
        write("error", event, { ...details, message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
    return logger;
}

// The app's one logger. Folder: LOG_DIR if set, else "logs" in the project
// folder (next to the database during development).
let shared = null;
function getLogger() {
    if (!shared) shared = createLogger({ dir: process.env.LOG_DIR || path.resolve(__dirname, "..", "..", "logs") });
    return shared;
}

module.exports = { createLogger, getLogger, CATEGORIES };
