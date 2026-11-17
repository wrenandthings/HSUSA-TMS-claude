// Qualification status rules from documents/QUALIFICATION_SPECIFICATION.md, section 4.
// Kept free of Electron and Prisma so it can be unit-tested.

function calculateStatus(expiresAt, status, now = new Date()) {
    if (status === "SUSPENDED") return status;
    if (!expiresAt) return "CURRENT";
    const days = (new Date(expiresAt).getTime() - now.getTime()) / 86400000;
    if (days < 0) return "EXPIRED";
    if (days <= 7) return "EXPIRING_CRITICAL";
    if (days <= 30) return "EXPIRING";
    return "CURRENT";
}

module.exports = { calculateStatus };
