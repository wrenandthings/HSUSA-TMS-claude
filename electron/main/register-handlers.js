// Registers every handler. Used by the desktop app (main.js) and by the web
// server (server/web-server.js), so both offer exactly the same functions.
const { registerAuthenticationHandlers } = require("./auth-handler");
const { registerUserHandlers } = require("./user-handler");
const { registerRoleHandlers } = require("./role-handler");
const { registerSubjectHandlers } = require("./subject-handler");
const { registerQuestionHandlers } = require("./question-handler");
const { registerQualificationHandlers } = require("./qualification-handler");
const { registerConfigurationHandlers } = require("./configuration-handler");
const { registerBackupHandlers } = require("./backup-handler");
const { registerQuizHandlers } = require("./quiz-handler");
const { registerTrainingHandlers } = require("./training-handler");
const { registerFlashcardHandlers } = require("./flashcard-handler");
const { registerAnalyticsHandlers } = require("./analytics-handler");

function registerAllHandlers() {
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
}

module.exports = { registerAllHandlers };
