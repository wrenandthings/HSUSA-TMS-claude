const { ipcMain } = require("electron");
const { PrismaClient } = require("@prisma/client");
const { setCurrentUser, clearCurrentUser, getCurrentUserId } = require("./auth-context");
const { createAuthService } = require("./auth-service");
const { createConfigurationService } = require("./configuration-service");
const { getLogger } = require("./logging-service");

const prisma = new PrismaClient();
const auth = createAuthService(prisma);
const settings = createConfigurationService(prisma);

function registerAuthenticationHandlers() {
    ipcMain.handle("auth-login", async (event, request) => {
        const result = await auth.login(request?.username, request?.password);
        if (!result.success) {
            getLogger().security("SIGN_IN_FAILED", { username: String(request?.username ?? ""), reason: result.message });
            return result;
        }
        setCurrentUser(result.user.id);
        getLogger().security("SIGNED_IN", { userId: result.user.id, username: result.user.username, mustChangePassword: Boolean(result.mustChangePassword) });
        // The window signs out after this many idle minutes (Settings).
        return { ...result, sessionTimeoutMinutes: await settings.getNumber("SessionTimeoutMinutes") };
    });

    ipcMain.handle("auth-change-own-password", async (event, request) => {
        const userId = getCurrentUserId();
        const result = await auth.changeOwnPassword(userId, request?.currentPassword, request?.newPassword);
        getLogger().security(result.success ? "PASSWORD_CHANGED" : "PASSWORD_CHANGE_REFUSED", { userId, ...(result.success ? {} : { reason: result.message }) });
        return result;
    });

    // { reason: "idle" } when the window signed out after the idle time limit.
    ipcMain.handle("auth-logout", async (event, input) => {
        const userId = getCurrentUserId();
        if (userId && input?.reason === "idle") {
            await prisma.auditLog.create({ data: { userId, entity: "User", entityId: userId, action: "USER_SIGNED_OUT_IDLE" } });
        }
        if (userId) getLogger().security(input?.reason === "idle" ? "SIGNED_OUT_IDLE" : "SIGNED_OUT", { userId });
        clearCurrentUser();
        return { success: true };
    });
}

module.exports = { registerAuthenticationHandlers };
