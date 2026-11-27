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
const { getLogger } = require("./electron/main/logging-service");
const { backUpIfDue } = require("./electron/main/backup-handler");
const { registerAllHandlers } = require("./electron/main/register-handlers");

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
            seedVersion: require("./dist-electron/seed.cjs").SEED_VERSION,
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

// Started from the "Reset HSUSA TMS admin password" shortcut (electron/main/admin-reset.js).
async function resetAdminIfAsked() {
    if (!process.argv.includes("--reset-admin")) return;
    const choice = dialog.showMessageBoxSync({
        type: "warning",
        title: "Reset the admin password",
        message: "Reset the admin account's password?",
        detail: "The account \"admin\" gets the starting password CHANGE_ME and must choose a new one at its next sign-in. Nothing else changes.",
        buttons: ["Reset password", "Cancel"],
        defaultId: 1,
        cancelId: 1
    });
    if (choice !== 0) return;
    const { PrismaClient } = require("@prisma/client");
    const { resetAdmin } = require("./electron/main/admin-reset");
    const prisma = new PrismaClient();
    try {
        const result = await resetAdmin(prisma);
        getLogger().security("ADMIN_PASSWORD_RESET", { recreated: result.created });
        dialog.showMessageBoxSync({ type: "info", title: "Admin password reset", message: "Done.", detail: "Sign in as admin with the password CHANGE_ME, then choose a new password.", buttons: ["OK"] });
    } catch (error) {
        getLogger().failure("ADMIN_PASSWORD_RESET_FAILED", error);
        dialog.showErrorBox("Admin password not reset", error.message);
    } finally {
        await prisma.$disconnect();
    }
}

app.whenReady().then(async () => {
    getLogger().application("APP_STARTED", { version: app.getVersion(), installed: app.isPackaged });
    if (!(await prepareInstalledDatabase())) return;
    await resetAdminIfAsked();
    registerAllHandlers();
    createMainWindow();
    // A daily backup, in the background, once the window is open.
    void backUpIfDue();
});

app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => getLogger().application("APP_STOPPED"));
