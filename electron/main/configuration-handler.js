const { ipcMain } = require("electron");
const { PrismaClient } = require("@prisma/client");
const { getCurrentUserId } = require("./auth-context");
const { createConfigurationService } = require("./configuration-service");
const { getLogger } = require("./logging-service");

const prisma = new PrismaClient();
const settings = createConfigurationService(prisma);

async function isAdministrator(userId) {
    const assignment = await prisma.userRole.findFirst({ where: { userId, role: { roleName: "Administrator" } } });
    return Boolean(assignment);
}

function registerConfigurationHandlers() {
    // Anyone signed in may read the settings; the screen shows them read-only
    // to people who are not administrators.
    ipcMain.handle("configuration-get-all", async () => {
        const userId = getCurrentUserId();
        if (!userId) return { success: false, message: "Authentication required" };
        return { success: true, settings: await settings.getAll(), canEdit: await isAdministrator(userId) };
    });

    // { changes: { key: value } }. Administrator only.
    ipcMain.handle("configuration-save", async (event, input) => {
        const userId = getCurrentUserId();
        if (!userId) return { success: false, message: "Authentication required" };
        if (!(await isAdministrator(userId))) {
            getLogger().security("SETTINGS_CHANGE_REFUSED", { userId });
            return { success: false, message: "Only an administrator can change settings." };
        }
        const result = await settings.save(input?.changes, userId);
        if (result.success) getLogger().application("SETTINGS_SAVED", { userId, keys: Object.keys(input?.changes ?? {}) });
        return result;
    });
}

module.exports = { registerConfigurationHandlers };
