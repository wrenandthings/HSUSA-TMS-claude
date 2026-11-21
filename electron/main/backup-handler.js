const path = require("path");
const { ipcMain } = require("electron");
const { PrismaClient } = require("@prisma/client");
const { getCurrentUserId } = require("./auth-context");
const { createBackupService, databaseFile } = require("./backup-service");
const { getLogger } = require("./logging-service");

const prisma = new PrismaClient();
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

function registerBackupHandlers() {
    ipcMain.handle("backups-list", async () => {
        const [, problem] = await requireAdministrator();
        if (problem) return { success: false, message: problem };
        return { success: true, folder: backups().folder, backups: await backups().list() };
    });

    ipcMain.handle("backups-create", async () => {
        const [userId, problem] = await requireAdministrator();
        if (problem) return { success: false, message: problem };
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
