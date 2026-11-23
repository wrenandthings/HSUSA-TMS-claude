// Admin password reset for an installed copy (owner, 2026-11-22). The
// installer adds a Start menu shortcut, "Reset HSUSA TMS admin password",
// that starts the app with --reset-admin. After the person confirms, the
// account "admin" gets the seed's starting password (CHANGE_ME) and must
// choose a new one at its next sign-in. Nothing else changes. If "admin" was
// deleted it is created again with the Administrator role.
// Anyone who can run programs on the computer can already replace the
// database file itself, so this gives no new access.
const { hashPassword } = require("./passwords");

const STARTING_PASSWORD = "CHANGE_ME";

async function resetAdmin(prisma) {
    const passwordHash = await hashPassword(STARTING_PASSWORD);
    let admin = await prisma.user.findUnique({ where: { username: "admin" } });
    let created = false;
    if (admin) {
        admin = await prisma.user.update({ where: { id: admin.id }, data: { passwordHash, mustChangePassword: true, status: "ACTIVE" } });
    } else {
        admin = await prisma.user.create({
            data: { username: "admin", firstName: "System", lastName: "Administrator", email: "admin@local", passwordHash, mustChangePassword: true, status: "ACTIVE" }
        });
        created = true;
    }
    const role = await prisma.role.findUnique({ where: { roleName: "Administrator" } });
    if (role && !(await prisma.userRole.findFirst({ where: { userId: admin.id, roleId: role.id } }))) {
        await prisma.userRole.create({ data: { userId: admin.id, roleId: role.id } });
    }
    await prisma.auditLog.create({ data: { userId: admin.id, entity: "User", entityId: admin.id, action: created ? "ADMIN_RECREATED_FROM_RESET" : "ADMIN_PASSWORD_RESET_FROM_SHORTCUT" } });
    return { created };
}

module.exports = { resetAdmin, STARTING_PASSWORD };
