const { ipcMain } = require("electron");
const { getPrisma } = require("./prisma-client");
const { getCurrentUserId } = require("./auth-context");
const { createAuthService } = require("./auth-service");

const prisma = getPrisma();
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

async function audit(actorId, userId, action, roleName) {
    await prisma.auditLog.create({
        data: { userId: actorId, entity: "User", entityId: userId, action, newValue: JSON.stringify({ role: roleName }) }
    });
}

// Wraps a role change: admin check, finds the user and role, and replies with
// { success, message, user } (the user with roles) or { success: false, message }.
function roleChange(work) {
    return async (event, input) => {
        try {
            const actorId = await requireAdministrator();
            const user = await prisma.user.findUnique({ where: { id: String(input?.userId ?? "") } });
            if (!user) return { success: false, message: "User not found" };
            const role = await prisma.role.findUnique({ where: { id: String(input?.roleId ?? "") } });
            if (!role) return { success: false, message: "Role not found" };
            const problem = await work(actorId, user.id, role);
            if (problem) return { success: false, message: problem };
            const updated = await prisma.user.findUnique({
                where: { id: user.id }, omit: HIDE_PASSWORD, include: { userRoles: { include: { role: true } } }
            });
            return { success: true, message: "Roles updated.", user: updated };
        } catch (error) {
            return { success: false, message: error instanceof Error ? error.message : String(error) };
        }
    };
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

    // Roles (owner, 2026-11-20: role assignment was not built yet). Administrator
    // only. Returns { success, message, user? } with the user's roles.
    ipcMain.handle("users-add-role", roleChange(async (actorId, userId, role) => {
        const already = await prisma.userRole.findUnique({ where: { userId_roleId: { userId, roleId: role.id } } });
        if (already) return `This user already has the ${role.roleName} role.`;
        await prisma.userRole.create({ data: { userId, roleId: role.id } });
        await audit(actorId, userId, "USER_ROLE_ADDED", role.roleName);
        return null;
    }));

    ipcMain.handle("users-remove-role", roleChange(async (actorId, userId, role) => {
        const assignment = await prisma.userRole.findUnique({ where: { userId_roleId: { userId, roleId: role.id } } });
        if (!assignment) return `This user does not have the ${role.roleName} role.`;
        if (role.roleName === "Administrator") {
            if (userId === actorId) return "You cannot remove your own Administrator role. Ask another administrator.";
            const administrators = await prisma.userRole.count({ where: { roleId: role.id } });
            if (administrators <= 1) return "The last Administrator cannot lose the Administrator role.";
        }
        await prisma.userRole.delete({ where: { id: assignment.id } });
        await audit(actorId, userId, "USER_ROLE_REMOVED", role.roleName);
        return null;
    }));

    // An administrator sets a temporary password; the user changes it at next sign-in.
    ipcMain.handle("users-change-password", async (event, request) => {
        const actorId = await requireAdministrator();
        return auth.setPasswordForUser(actorId, request.userId, request.password);
    });
}

module.exports = { registerUserHandlers };
