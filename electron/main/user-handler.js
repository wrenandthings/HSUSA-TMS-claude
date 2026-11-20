const { ipcMain } = require("electron");
const { PrismaClient } = require("@prisma/client");
const { getCurrentUserId } = require("./auth-context");
const { createAuthService } = require("./auth-service");

const prisma = new PrismaClient();
const auth = createAuthService(prisma);

// Password hashes never leave the main process.
const HIDE_PASSWORD = { passwordHash: true };

async function requireAdministrator() {
    const userId = getCurrentUserId();

    if (!userId) {
        throw new Error("Authentication required");
    }

    const administratorRole = await prisma.role.findUnique({
        where: { roleName: "Administrator" }
    });

    if (!administratorRole) {
        throw new Error("Administrator role is not configured");
    }

    const assignment = await prisma.userRole.findFirst({
        where: {
            userId,
            roleId: administratorRole.id
        }
    });

    if (!assignment) {
        throw new Error("Administrator permission required");
    }

    return userId;
}

async function writeAudit(action) {
    await prisma.auditLog.create({
        data: {
            entity: "User",
            action
        }
    });
}

function registerUserHandlers() {
    ipcMain.handle("users-get-all", async () => prisma.user.findMany({ omit: HIDE_PASSWORD, orderBy: { username: "asc" } }));

    ipcMain.handle("users-get-by-id", async (event, userId) => prisma.user.findUnique({
        where: { id: userId },
        omit: HIDE_PASSWORD,
        include: { userRoles: { include: { role: true } } }
    }));

    ipcMain.handle("users-create", async (event, user) => {
        await requireAdministrator();
        const existing = await prisma.user.findUnique({ where: { username: user.username } });
        if (existing) return { success: false, message: "Username already exists" };

        const password = await auth.newAccountPasswordFields(user.password);
        if (password.problem) return { success: false, message: password.problem };

        const createdUser = await prisma.user.create({
            omit: HIDE_PASSWORD,
            data: {
                username: user.username,
                ...password.data,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email || null,
                status: user.status || "ACTIVE"
            }
        });

        await writeAudit("USER_CREATED");
        return { success: true, user: createdUser };
    });

    ipcMain.handle("users-update", async (event, user) => {
        await requireAdministrator();
        const existing = await prisma.user.findFirst({
            where: { username: user.username, NOT: { id: user.id } }
        });
        if (existing) return { success: false, message: "Username already exists" };

        const updatedUser = await prisma.user.update({
            omit: HIDE_PASSWORD,
            where: { id: user.id },
            data: {
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email || null,
                status: user.status
            }
        });

        await writeAudit("USER_UPDATED");
        return { success: true, user: updatedUser };
    });

    ipcMain.handle("users-delete", async (event, userId) => {
        await requireAdministrator();

        const target = await prisma.user.findUnique({
            where: { id: userId },
            include: { userRoles: { include: { role: true } } }
        });

        if (!target) return { success: false, message: "User not found" };

        const isAdministrator = target.userRoles.some(
            (assignment) => assignment.role.roleName === "Administrator"
        );

        if (isAdministrator) {
            const administratorRole = await prisma.role.findUnique({ where: { roleName: "Administrator" } });
            const administratorCount = administratorRole
                ? await prisma.userRole.count({ where: { roleId: administratorRole.id } })
                : 0;

            if (administratorCount <= 1) {
                return { success: false, message: "The last Administrator cannot be deleted" };
            }
        }

        await prisma.userRole.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } });
        await writeAudit("USER_DELETED");
        return { success: true };
    });

    // An administrator sets a temporary password; the user changes it at next sign-in.
    ipcMain.handle("users-change-password", async (event, request) => {
        const actorId = await requireAdministrator();
        return auth.setPasswordForUser(actorId, request.userId, request.password);
    });
}

module.exports = { registerUserHandlers };
