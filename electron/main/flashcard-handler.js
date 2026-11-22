const { ipcMain } = require("electron");
const { PrismaClient } = require("@prisma/client");
const { getCurrentUserId } = require("./auth-context");
const { createFlashcardService } = require("./flashcard-service");
const { getLogger } = require("./logging-service");

const prisma = new PrismaClient();
const flashcards = createFlashcardService(prisma);

function handle(channel, work) {
    ipcMain.handle(channel, async (event, input) => {
        const userId = getCurrentUserId();
        if (!userId) return { success: false, message: "Authentication required" };
        try {
            return await work(userId, input ?? {});
        } catch (error) {
            getLogger().failure("FLASHCARD_ERROR", error, { userId, channel });
            return { success: false, message: "Something went wrong. It has been logged." };
        }
    });
}

function registerFlashcardHandlers() {
    handle("flashcards-options", () => flashcards.options());
    handle("flashcards-start", (userId, input) => flashcards.start(userId, input));
    handle("flashcards-get", (userId, input) => flashcards.get(userId, input.sessionId));
    handle("flashcards-rate", (userId, input) => flashcards.rate(userId, input.sessionId, input.questionId, input.status));
    handle("flashcards-history", (userId) => flashcards.history(userId));
    handle("flashcards-retention", (userId) => flashcards.retention(userId));
}

module.exports = { registerFlashcardHandlers };
