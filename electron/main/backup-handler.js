const path = require("path");
const { ipcMain } = require("electron");
const { getPrisma } = require("./prisma-client");
const { getCurrentUserId } = require("./auth-context");
const { createBackupService, databaseFile } = require("./backup-service");
const { getLogger } = require("./logging-service");

const prisma = getPrisma();
let service = null;

// The backups folder sits next to the database file (owner, question 26).
function backups() {
    if (!service) service = createBackupService(prisma, { folder: path.join(path.dirname(databaseFile()), "backups"), logger: getLogger() });
    return service;
}

async function requireAdministrator() {
    const userId = getCurrentUserId();
    if (!userId) return [null, "Authentication required"];
    const admin = await prisma.userRole.findFirst({ where: { userId, role: { roleName: "Administrator" } } });
    return admin ? [userId, null] : [null, "Only an administrator can manage backups."];
}

// The web version's database is PostgreSQL at a database host, which makes
// its own backups; these file backups are for the desktop's SQLite file only.
const HOSTED_MESSAGE = "This is the web version: backups are made by the database host, not from this page.";
const hosted = () => !String(process.env.DATABASE_URL ?? "").startsWith("file:");

function registerBackupHandlers() {
    ipcMain.handle("backups-list", async () => {
        const [, problem] = await requireAdministrator();
        if (problem) return { success: false, message: problem };
        if (hosted()) return { success: true, folder: HOSTED_MESSAGE, backups: [] };
        return { success: true, folder: backups().folder, backups: await backups().list() };
    });

    ipcMain.handle("backups-create", async () => {
        const [userId, problem] = await requireAdministrator();
        if (problem) return { success: false, message: problem };
        if (hosted()) return { success: false, message: HOSTED_MESSAGE, backups: [] };
        const result = await backups().backUp(userId, "manual");
        return { ...result, backups: await backups().list() };
    });
}

// Called once at start-up; never stops the app from opening.
async function backUpIfDue() {
    try {
        return await backups().backUpIfDue();
    } catch (error) {
        getLogger().failure("DAILY_BACKUP_FAILED", error);
        return { success: false };
    }
}

module.exports = { registerBackupHandlers, backUpIfDue };
