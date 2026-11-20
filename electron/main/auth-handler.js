const { ipcMain } = require("electron");
const { PrismaClient } = require("@prisma/client");
const { setCurrentUser, clearCurrentUser, getCurrentUserId } = require("./auth-context");
const { createAuthService } = require("./auth-service");

const prisma = new PrismaClient();
const auth = createAuthService(prisma);

function registerAuthenticationHandlers() {
    ipcMain.handle("auth-login", async (event, request) => {
        const result = await auth.login(request?.username, request?.password);
        if (result.success) setCurrentUser(result.user.id);
        return result;
    });

    ipcMain.handle("auth-change-own-password", async (event, request) =>
        auth.changeOwnPassword(getCurrentUserId(), request?.currentPassword, request?.newPassword));

    ipcMain.handle("auth-logout", async () => {
        clearCurrentUser();
        return { success: true };
    });
}

module.exports = { registerAuthenticationHandlers };
