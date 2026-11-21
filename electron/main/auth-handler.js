const { ipcMain } = require("electron");
const { PrismaClient } = require("@prisma/client");
const { setCurrentUser, clearCurrentUser, getCurrentUserId } = require("./auth-context");
const { createAuthService } = require("./auth-service");
const { createConfigurationService } = require("./configuration-service");

const prisma = new PrismaClient();
const auth = createAuthService(prisma);
const settings = createConfigurationService(prisma);

function registerAuthenticationHandlers() {
    ipcMain.handle("auth-login", async (event, request) => {
        const result = await auth.login(request?.username, request?.password);
        if (!result.success) return result;
        setCurrentUser(result.user.id);
        // The window signs out after this many idle minutes (Settings).
        return { ...result, sessionTimeoutMinutes: await settings.getNumber("SessionTimeoutMinutes") };
    });

    ipcMain.handle("auth-change-own-password", async (event, request) =>
        auth.changeOwnPassword(getCurrentUserId(), request?.currentPassword, request?.newPassword));

    // { reason: "idle" } when the window signed out after the idle time limit.
    ipcMain.handle("auth-logout", async (event, input) => {
        const userId = getCurrentUserId();
        if (userId && input?.reason === "idle") {
            await prisma.auditLog.create({ data: { userId, entity: "User", entityId: userId, action: "USER_SIGNED_OUT_IDLE" } });
        }
        clearCurrentUser();
        return { success: true };
    });
}

module.exports = { registerAuthenticationHandlers };
