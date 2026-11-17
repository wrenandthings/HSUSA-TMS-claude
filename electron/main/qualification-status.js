// Qualification status rules from documents/QUALIFICATION_SPECIFICATION.md, section 4.
// Kept free of Electron and Prisma so it can be unit-tested.

const DAY_MS = 86400000;
const WARNING_DAYS = 30;
const CRITICAL_DAYS = 7;

// Expiration dates are entered with <input type="date"> and stored as UTC
// midnight of the chosen day, so the stored value's UTC date is the calendar
// day the user picked. "Today" is the local calendar date of this computer.
function daysRemaining(expiresAt, now = new Date()) {
    const expiry = new Date(expiresAt);
    const expiryDay = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((expiryDay - today) / DAY_MS);
}

function calculateStatus(expiresAt, status, now = new Date()) {
    if (status === "SUSPENDED") return status;
    if (!expiresAt) return "CURRENT";
    const days = daysRemaining(expiresAt, now);
    if (days < 0) return "EXPIRED";
    if (days <= CRITICAL_DAYS) return "EXPIRING_CRITICAL";
    if (days <= WARNING_DAYS) return "EXPIRING";
    return "CURRENT";
}

module.exports = { calculateStatus, daysRemaining, WARNING_DAYS, CRITICAL_DAYS };
