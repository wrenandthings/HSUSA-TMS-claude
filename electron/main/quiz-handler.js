const { ipcMain } = require("electron");
const { getPrisma } = require("./prisma-client");
const { getCurrentUserId } = require("./auth-context");
const { createQuizService } = require("./quiz-service");
const { getLogger } = require("./logging-service");

const prisma = getPrisma();
const quizzes = createQuizService(prisma);

// Every signed-in user may take quizzes; each person only sees their own.
function signedIn(work) {
    return async (event, input) => {
        const userId = getCurrentUserId();
        if (!userId) return { success: false, message: "Authentication required" };
        try {
            return await work(userId, input ?? {});
        } catch (error) {
            getLogger().failure("QUIZ_ERROR", error, { userId });
            return { success: false, message: "Something went wrong with the quiz. It has been logged." };
        }
    };
}

function registerQuizHandlers() {
    ipcMain.handle("quizzes-options", signedIn(async () => ({ success: true, ...(await quizzes.options()) })));
    ipcMain.handle("quizzes-start", signedIn((userId, input) => quizzes.start(userId, input)));
    ipcMain.handle("quizzes-get", signedIn((userId, input) => quizzes.get(userId, input.sessionId)));
    ipcMain.handle("quizzes-answer", signedIn((userId, input) => quizzes.answer(userId, input.sessionId, input.questionId, input.answer)));
    ipcMain.handle("quizzes-flag", signedIn((userId, input) => quizzes.flag(userId, input.sessionId, input.questionId, input.flagged)));
    ipcMain.handle("quizzes-finish", signedIn((userId, input) => quizzes.finish(userId, input.sessionId)));
    ipcMain.handle("quizzes-history", signedIn(async (userId) => ({ success: true, quizzes: await quizzes.history(userId) })));
}

module.exports = { registerQuizHandlers };
