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
    createMainWindow();
});

app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => getLogger().application("APP_STOPPED"));
