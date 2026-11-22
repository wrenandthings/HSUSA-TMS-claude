const { app, BrowserWindow, dialog } = require("electron");
const fs = require("fs");
const path = require("path");

// An installed copy keeps its database, logs and backups in the person's own
// app-data folder (%APPDATA%\HSUSA TMS). This must run before any handler
// creates a Prisma client. A copy run from the project uses the project's .env.
if (app.isPackaged) {
    const data = app.getPath("userData");
    fs.mkdirSync(data, { recursive: true });
    process.env.DATABASE_URL = `file:${path.join(data, "hsusa-tms.db").replace(/\\/g, "/")}`;
    process.env.LOG_DIR = path.join(data, "logs");
} else {
    require("./electron/main/load-env").loadEnv(__dirname);
}
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
        icon: path.join(__dirname, "electron", "assets", "icon.png"),
        webPreferences: { preload: preloadPath, contextIsolation: true, nodeIntegration: false }
    });
    if (app.isPackaged) mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));
    else mainWindow.loadURL("http://localhost:5173");
    mainWindow.on("closed", () => { mainWindow = null; });
}

// Installed copies set up and update their own database (electron/main/first-run.js).
async function prepareInstalledDatabase() {
    if (!app.isPackaged) return true;
    const { PrismaClient } = require("@prisma/client");
    const { prepareDatabase } = require("./electron/main/first-run");
    const { createQuestionBankImporter } = require("./electron/main/question-bank");
    const prisma = new PrismaClient();
    try {
        await prepareDatabase(prisma, {
            migrationsFolder: path.join(__dirname, "prisma", "migrations"),
            banksFolder: path.join(__dirname, "documents", "question-banks"),
            seed: require("./dist-electron/seed.cjs").seed,
            importer: createQuestionBankImporter(prisma),
            logger: getLogger()
        });
        return true;
    } catch (error) {
        getLogger().failure("DATABASE_SETUP_FAILED", error);
        dialog.showErrorBox("HSUSA TMS could not start", `Setting up the database failed: ${error.message}\n\nThe log is in ${process.env.LOG_DIR}.`);
        app.quit();
        return false;
    } finally {
        await prisma.$disconnect();
    }
}

app.whenReady().then(async () => {
    getLogger().application("APP_STARTED", { version: app.getVersion(), installed: app.isPackaged });
    if (!(await prepareInstalledDatabase())) return;
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
