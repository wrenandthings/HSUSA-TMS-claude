// Password hashing and rules (owner decisions 2026-11-19, questions 16 and 17).
// Passwords are stored as bcrypt hashes. Accounts created before hashing still
// hold plain text; they are accepted once, then upgraded to a hash and marked
// for a password change (see auth-service.js).

const bcrypt = require("bcryptjs");

const BCRYPT_ROUNDS = 10;
const DEFAULT_MINIMUM_LENGTH = 12;

function isHash(stored) {
    return typeof stored === "string" && /^\$2[aby]\$\d\d\$/.test(stored);
}

async function hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Returns { matches, isLegacyPlainText }.
async function checkPassword(stored, given) {
    if (typeof stored !== "string" || typeof given !== "string") return { matches: false, isLegacyPlainText: false };
    if (isHash(stored)) return { matches: await bcrypt.compare(given, stored), isLegacyPlainText: false };
    return { matches: stored.length > 0 && stored === given, isLegacyPlainText: true };
}

// Returns null when the password is acceptable, otherwise a message for the user.
// Complexity means at least one lower-case letter, one upper-case letter, one
// digit and one symbol.
function passwordProblem(password, rules = {}) {
    const minimumLength = Number(rules.minimumLength) > 0 ? Number(rules.minimumLength) : DEFAULT_MINIMUM_LENGTH;
    const complexity = rules.complexityRequired !== false;
    if (typeof password !== "string" || password.length < minimumLength) {
        return `Password must be at least ${minimumLength} characters.`;
    }
    if (complexity) {
        const missing = [];
        if (!/[a-z]/.test(password)) missing.push("a lower-case letter");
        if (!/[A-Z]/.test(password)) missing.push("an upper-case letter");
        if (!/[0-9]/.test(password)) missing.push("a number");
        if (!/[^A-Za-z0-9]/.test(password)) missing.push("a symbol");
        if (missing.length) return `Password must include ${missing.join(", ")}.`;
    }
    return null;
}

// Reads MinimumPasswordLength and PasswordComplexityRequired from Configuration.
async function loadPasswordRules(prisma) {
    const rows = await prisma.configuration.findMany({
        where: { key: { in: ["MinimumPasswordLength", "PasswordComplexityRequired"] } }
    });
    const value = key => rows.find(r => r.key === key)?.value;
    return {
        minimumLength: Number(value("MinimumPasswordLength")) || DEFAULT_MINIMUM_LENGTH,
        complexityRequired: String(value("PasswordComplexityRequired") ?? "TRUE").toUpperCase() !== "FALSE"
    };
}

module.exports = { hashPassword, checkPassword, passwordProblem, loadPasswordRules, isHash };
