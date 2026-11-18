const { ipcMain } = require("electron");
const { PrismaClient } = require("@prisma/client");
const { getCurrentUserId } = require("./auth-context");
const { createQualificationRepository } = require("./qualification-repository");

const prisma = new PrismaClient();
const repository = createQualificationRepository(prisma);

async function requireAdministrator() {
    const userId = getCurrentUserId();
    if (!userId) throw new Error("Authentication required");
    const role = await prisma.role.findUnique({ where: { roleName: "Administrator" } });
    if (!role) throw new Error("Administrator role is not configured");
    const assignment = await prisma.userRole.findFirst({ where: { userId, roleId: role.id } });
    if (!assignment) throw new Error("Administrator permission required");
    return userId;
}

// Runs an administrator-only change and reports failures as { success: false, message }.
function adminAction(work) {
    return async (event, input) => {
        try {
            const actorId = await requireAdministrator();
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

    ipcMain.handle("qualifications-create", adminAction(async (input, actorId) => ({
        qualification: await repository.create(input, actorId)
    })));

    ipcMain.handle("qualifications-update", adminAction(async (input, actorId) => ({
        qualification: await repository.update(input, actorId)
    })));

    ipcMain.handle("qualifications-delete", adminAction(async (id, actorId) => {
        await repository.remove(id, actorId);
        return {};
    }));

    ipcMain.handle("qualifications-assign-user", adminAction(async (input, actorId) => ({
        assignment: await repository.assign(input, actorId)
    })));

    ipcMain.handle("qualifications-update-assignment", adminAction(async (input, actorId) => ({
        assignment: await repository.updateAssignment(input, actorId)
    })));

    ipcMain.handle("qualifications-unassign-user", adminAction(async (input, actorId) => ({
        assignment: await repository.unassign(input, actorId)
    })));
}

module.exports = { registerQualificationHandlers };
