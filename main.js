const { app, BrowserWindow } = require("electron");
const path = require("path");
require("./electron/main/load-env").loadEnv(__dirname);
const { registerAuthenticationHandlers } = require("./electron/main/auth-handler");
const { registerUserHandlers } = require("./electron/main/user-handler");
const { registerRoleHandlers } = require("./electron/main/role-handler");
const { registerSubjectHandlers } = require("./electron/main/subject-handler");
const { registerQuestionHandlers } = require("./electron/main/question-handler");
const { registerQualificationHandlers } = require("./electron/main/qualification-handler");
const { registerConfigurationHandlers } = require("./electron/main/configuration-handler");
const { getLogger } = require("./electron/main/logging-service");
const { registerBackupHandlers, backUpIfDue } = require("./electron/main/backup-handler");
const { registerQuizHandlers } = require("./electron/main/quiz-handler");
const { registerTrainingHandlers } = require("./electron/main/training-handler");
const { registerFlashcardHandlers } = require("./electron/main/flashcard-handler");
const { registerAnalyticsHandlers } = require("./electron/main/analytics-handler");

process.on("uncaughtException", (error) => getLogger().failure("UNCAUGHT_EXCEPTION", error));
process.on("unhandledRejection", (reason) => getLogger().failure("UNHANDLED_REJECTION", reason));

let mainWindow = null;

function createMainWindow() {
    const preloadPath = path.join(__dirname, "electron", "preload", "preload.js");
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        title: "HSUSA Training Management System",
        webPreferences: { preload: preloadPath, contextIsolation: true, nodeIntegration: false }
    });
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(() => {
    getLogger().application("APP_STARTED", { version: app.getVersion() });
    registerUserHandlers();
    registerSubjectHandlers();
    registerQuestionHandlers();
    registerAuthenticationHandlers();
    registerRoleHandlers();
    registerQualificationHandlers();
    registerConfigurationHandlers();
    registerBackupHandlers();
    registerQuizHandlers();
    registerTrainingHandlers();
    registerFlashcardHandlers();
    registerAnalyticsHandlers();
    createMainWindow();
    // A daily backup, in the background, once the window is open.
    void backUpIfDue();
});

app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => getLogger().application("APP_STOPPED"));
