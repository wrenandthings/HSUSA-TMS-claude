const { ipcMain } = require("electron");
const { getPrisma } = require("./prisma-client");
const { getCurrentUserId } = require("./auth-context");
const { createAnalyticsService } = require("./analytics-service");
const { getLogger } = require("./logging-service");

const prisma = getPrisma();
const analytics = createAnalyticsService(prisma);

function handle(channel, work) {
    ipcMain.handle(channel, async (event, input) => {
        const userId = getCurrentUserId();
        if (!userId) return { success: false, message: "Authentication required" };
        try {
            return await work(userId, input ?? {});
        } catch (error) {
            getLogger().failure("ANALYTICS_ERROR", error, { userId, channel });
            return { success: false, message: "Something went wrong. It has been logged." };
        }
    });
}

function registerAnalyticsHandlers() {
    handle("progress-get", (userId, input) => analytics.progress(userId, input.userId));
    handle("progress-everyone", (userId) => analytics.everyone(userId));
}

module.exports = { registerAnalyticsHandlers };
