// Sign-in and password changes. Takes a Prisma client so it can be tested
// against a temporary database; auth-handler.js and user-handler.js wire it to IPC.

const { hashPassword, checkPassword, passwordProblem, loadPasswordRules } = require("./passwords");

// The same message for an unknown user and a wrong password, so the sign-in
// screen doesn't reveal which usernames exist.
const BAD_SIGN_IN = "Invalid username or password";

function createAuthService(prisma) {
    async function audit(userId, action, entityId) {
        await prisma.auditLog.create({ data: { userId: userId ?? null, entity: "User", entityId: entityId ?? userId ?? null, action } });
    }

    async function checkNewPassword(password) {
        return passwordProblem(password, await loadPasswordRules(prisma));
    }

    return {
        // Returns { success, message, user?, mustChangePassword? }.
        async login(username, password) {
            const user = await prisma.user.findUnique({ where: { username: String(username ?? "") } });
            if (!user) return { success: false, message: BAD_SIGN_IN };
            if (user.status !== "ACTIVE") return { success: false, message: "User account is not active" };
            const { matches, isLegacyPlainText } = await checkPassword(user.passwordHash, password);
            if (!matches) return { success: false, message: BAD_SIGN_IN };

            let mustChangePassword = user.mustChangePassword;
            if (isLegacyPlainText) {
                // Upgrade a pre-hashing account: store a hash, and since the old
                // password was readable, have the user pick a new one.
                await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), mustChangePassword: true } });
                mustChangePassword = true;
                await audit(user.id, "USER_PASSWORD_HASHED");
            }
            return { success: true, message: "Login successful", user: { id: user.id, username: user.username }, mustChangePassword };
        },

        // The signed-in user changes their own password. Clears mustChangePassword.
        async changeOwnPassword(userId, currentPassword, newPassword) {
            if (!userId) return { success: false, message: "Authentication required" };
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user) return { success: false, message: "Authentication required" };
            const { matches } = await checkPassword(user.passwordHash, currentPassword);
            if (!matches) return { success: false, message: "Current password is incorrect." };
            if (newPassword === currentPassword) return { success: false, message: "New password must be different from the current one." };
            const problem = await checkNewPassword(newPassword);
            if (problem) return { success: false, message: problem };
            await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false } });
            await audit(userId, "USER_PASSWORD_CHANGED");
            return { success: true, message: "Password changed." };
        },

        // An administrator sets someone's password. They must change it at next sign-in.
        async setPasswordForUser(actorId, userId, newPassword) {
            const problem = await checkNewPassword(newPassword);
            if (problem) return { success: false, message: problem };
            await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword), mustChangePassword: true } });
            await audit(actorId, "USER_PASSWORD_SET", userId);
            return { success: true, message: "Password set. The user must change it at next sign-in." };
        },

        // Fields for a new account's password: hashed, and changed at first sign-in.
        async newAccountPasswordFields(password) {
            const problem = await checkNewPassword(password);
            if (problem) return { problem };
            return { data: { passwordHash: await hashPassword(password), mustChangePassword: true } };
        }
    };
}

module.exports = { createAuthService, BAD_SIGN_IN };
