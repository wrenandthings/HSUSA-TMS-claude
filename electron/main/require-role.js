// Who may change what (Permission Matrix). Shared by handlers that change
// reference data: subjects follow the question bank's managers; roles are
// Administrator only.
const { getCurrentUserId } = require("./auth-context");

async function hasAnyRole(prisma, userId, roles) {
    if (!userId) return false;
    return Boolean(await prisma.userRole.findFirst({ where: { userId, role: { roleName: { in: roles } } } }));
}

// Wraps an ipcMain handler so it runs only for someone with one of `roles`.
function guarded(prisma, roles, message, fn) {
    return async (event, ...args) => {
        const userId = getCurrentUserId();
        if (!userId) return { success: false, message: "Authentication required" };
        if (!(await hasAnyRole(prisma, userId, roles))) return { success: false, message };
        return fn(event, ...args);
    };
}

module.exports = { hasAnyRole, guarded };
