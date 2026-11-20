const { ipcMain } = require("electron");
const { PrismaClient } = require("@prisma/client");
const { getCurrentUserId } = require("./auth-context");
const { createQualificationRepository } = require("./qualification-repository");

const prisma = new PrismaClient();
const repository = createQualificationRepository(prisma);

// Roles that may create, assign, renew, suspend and remove qualifications
// (owner decisions 2026-11-19, questions 20 and 33). Everyone may view them.
const QUALIFICATION_MANAGER_ROLES = [
    "Administrator",
    "Training_Manager",
    "Director_of_Operations",
    "Chief_Pilot",
    "Maintenance_Manager",
    "Quality_Control"
];

async function requireQualificationManager() {
    const userId = getCurrentUserId();
    if (!userId) throw new Error("Authentication required");
    const assignment = await prisma.userRole.findFirst({
        where: { userId, role: { roleName: { in: QUALIFICATION_MANAGER_ROLES } } }
    });
    if (!assignment) throw new Error("You do not have permission to manage qualifications");
    return userId;
}

// Runs a qualification-manager change and reports failures as { success: false, message }.
function managerAction(work) {
    return async (event, input) => {
        try {
            const actorId = await requireQualificationManager();
            return { success: true, ...(await work(input, actorId)) };
        } catch (error) {
            if (error && error.code === "P2002") {
                return { success: false, message: "A qualification with that code or name already exists." };
            }
            return { success: false, message: error instanceof Error ? error.message : String(error) };
        }
    };
}

function registerQualificationHandlers() {
    ipcMain.handle("qualifications-get-all", async () => repository.list());

    ipcMain.handle("qualifications-get-by-id", async (event, id) => repository.getById(id));

    ipcMain.handle("qualifications-create", managerAction(async (input, actorId) => ({
        qualification: await repository.create(input, actorId)
    })));

    ipcMain.handle("qualifications-update", managerAction(async (input, actorId) => ({
        qualification: await repository.update(input, actorId)
    })));

    ipcMain.handle("qualifications-delete", managerAction(async (id, actorId) => {
        await repository.remove(id, actorId);
        return {};
    }));

    ipcMain.handle("qualifications-assign-user", managerAction(async (input, actorId) => ({
        assignment: await repository.assign(input, actorId)
    })));

    ipcMain.handle("qualifications-update-assignment", managerAction(async (input, actorId) => ({
        assignment: await repository.updateAssignment(input, actorId)
    })));

    ipcMain.handle("qualifications-unassign-user", managerAction(async (input, actorId) => ({
        assignment: await repository.unassign(input, actorId)
    })));
}

module.exports = { registerQualificationHandlers, QUALIFICATION_MANAGER_ROLES };
