const {
    ipcMain
} = require("electron");
const {
    PrismaClient
} = require("@prisma/client");

const { getCurrentUserId } = require("./auth-context");
const { createQuestionBankImporter } = require("./question-bank");

const prisma = new PrismaClient();
const bankImporter = createQuestionBankImporter(prisma);

// Roles with Question Management in the Seed Data Specification v1.0.
const QUESTION_MANAGER_ROLES = ["Administrator", "Director_of_Operations", "Chief_Pilot", "Training_Manager"];

async function requireQuestionManager() {
    const userId = getCurrentUserId();
    if (!userId) throw new Error("Authentication required");
    const assignment = await prisma.userRole.findFirst({
        where: { userId, role: { roleName: { in: QUESTION_MANAGER_ROLES } } }
    });
    if (!assignment) throw new Error("You do not have permission to import questions");
    return userId;
}

function registerQuestionHandlers() {
    ipcMain.handle("questions-get-all", async () =>
        prisma.question.findMany({
            orderBy: { questionText: "asc" },
            include: { subject: true }
        })
    );

    ipcMain.handle("questions-get-by-id", async (event, questionId) =>
        prisma.question.findUnique({
            where: { id: questionId }
        })
    );

    ipcMain.handle("questions-create", async (event, question) => {
        const createdQuestion = await prisma.question.create({
            data: {
                questionText: question.questionText,
                category: question.category || null,
                difficulty: question.difficulty || null,
                answer: question.answer || null
            }
        });

        return {
            success: true,
            message: "Question created",
            question: createdQuestion
        };
    });

    ipcMain.handle("questions-update", async (event, question) => {
        const updatedQuestion = await prisma.question.update({
            where: { id: question.id },
            data: {
                questionText: question.questionText,
                category: question.category || null,
                difficulty: question.difficulty || null,
                answer: question.answer || null
            }
        });

        return {
            success: true,
            question: updatedQuestion
        };
    });

    ipcMain.handle("questions-delete", async (event, questionId) => {
        await prisma.question.delete({
            where: { id: questionId }
        });
        return { success: true };
    });

    ipcMain.handle("questions-delete-many", async (event, questionIds) => {
        const result = await prisma.question.deleteMany({
            where: {
                id: { in: questionIds }
            }
        });

        return {
            success: true,
            deleted: result.count
        };
    });

    // Question-bank CSV in the agreed 15-column format. { csvText, dryRun }.
    // A dry run reports what would change and every problem, writing nothing.
    ipcMain.handle("questions-import-bank", async (event, input) => {
        try {
            const actorId = await requireQuestionManager();
            return await bankImporter.importCsv(String(input?.csvText ?? ""), { actorId, dryRun: Boolean(input?.dryRun) });
        } catch (error) {
            return { success: false, created: 0, updated: 0, errors: [], message: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle("questions-import", async (event, questions) => {
        const createdQuestions = await prisma.$transaction(
            questions.map((question) => prisma.question.create({
                data: {
                    questionText: question.questionText,
                    category: question.category || null,
                    difficulty: question.difficulty || null,
                    answer: question.answer || null
                }
            }))
        );

        return {
            success: true,
            imported: createdQuestions.length
        };
    });
}

module.exports = { registerQuestionHandlers, QUESTION_MANAGER_ROLES };
