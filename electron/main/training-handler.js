const { ipcMain } = require("electron");
const { PrismaClient } = require("@prisma/client");
const { getCurrentUserId } = require("./auth-context");
const { createTrainingService } = require("./training-service");
const { getLogger } = require("./logging-service");

const prisma = new PrismaClient();
const training = createTrainingService(prisma);

function handle(channel, work) {
    ipcMain.handle(channel, async (event, input) => {
        const userId = getCurrentUserId();
        if (!userId) return { success: false, message: "Authentication required" };
        try {
            return await work(userId, input ?? {});
        } catch (error) {
            getLogger().failure("TRAINING_ERROR", error, { userId, channel });
            return { success: false, message: "Something went wrong. It has been logged." };
        }
    });
}

function registerTrainingHandlers() {
    handle("training-mine", (userId) => training.myTraining(userId));
    handle("training-submit", (userId, input) => training.submit(userId, input));
    handle("training-withdraw", (userId, input) => training.withdraw(userId, input.recordId));
    handle("training-pending", (userId) => training.pending(userId));
    handle("requirements-get", (userId) => training.requirementsEditor(userId));
    handle("requirements-set", (userId, input) => training.setRequirements(userId, input.qualificationId, input.items));
    handle("training-renewal-set", (userId, input) => training.setRenewal(userId, input.programId, input.renewalMonths));
    handle("training-review", (userId, input) => training.review(userId, input.recordId, Boolean(input.approve), input.note));
}

module.exports = { registerTrainingHandlers };
