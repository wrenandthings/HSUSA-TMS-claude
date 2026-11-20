// TESTING ONLY (owner request 2026-11-20): give the admin account a blank
// password and skip the forced password change, for quick sign-in while
// testing on the owner's laptop. Run: npm run dev:blank-admin
//
// Before anyone else tests the app, set a real admin password again:
// sign in, open Users > admin > Set Password (the admin is then asked to
// choose a new one at next sign-in). Tracked in agents/finch/project.md.
const path = require("path");
require("../electron/main/load-env").loadEnv(path.resolve(__dirname, ".."));
const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../electron/main/passwords");

async function blankAdminPassword(prisma, username = "admin") {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) throw new Error(`No user named ${username}. Run npx prisma db seed first.`);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(""), mustChangePassword: false } });
    await prisma.auditLog.create({ data: { userId: user.id, entity: "User", entityId: user.id, action: "USER_PASSWORD_BLANKED_FOR_TESTING" } });
    return user.id;
}

if (require.main === module) {
    const prisma = new PrismaClient();
    blankAdminPassword(prisma)
        .then(() => console.log("The admin password is now blank (testing only). Sign in as admin with an empty password."))
        .catch((error) => { console.error(error.message); process.exitCode = 1; })
        .finally(() => prisma.$disconnect());
}

module.exports = { blankAdminPassword };
