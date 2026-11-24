// Password hashing and rules (owner decisions 2026-11-19, questions 16 and 17).
// Passwords are stored as bcrypt hashes. Accounts created before hashing still
// hold plain text; they are accepted once, then upgraded to a hash and marked
// for a password change (see auth-service.js).

const bcrypt = require("bcryptjs");

const BCRYPT_ROUNDS = 10;
const DEFAULT_MINIMUM_LENGTH = 6;

// Owner, 2026-11-24: default minimum 6 characters; an administrator turns
// each kind of character on or off, and at least one stays on.
const KINDS = [
    { rule: "requireUppercase", key: "PasswordRequireUppercase", test: /[A-Z]/, name: "an upper-case letter" },
    { rule: "requireLowercase", key: "PasswordRequireLowercase", test: /[a-z]/, name: "a lower-case letter" },
    { rule: "requireNumber", key: "PasswordRequireNumber", test: /[0-9]/, name: "a number" },
    { rule: "requireSymbol", key: "PasswordRequireSymbol", test: /[^A-Za-z0-9]/, name: "a symbol" }
];

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
// rules: { minimumLength, requireUppercase, requireLowercase, requireNumber,
// requireSymbol }. A rule left out counts as on.
function passwordProblem(password, rules = {}) {
    const minimumLength = Number(rules.minimumLength) > 0 ? Number(rules.minimumLength) : DEFAULT_MINIMUM_LENGTH;
    if (typeof password !== "string" || password.length < minimumLength) {
        return `Password must be at least ${minimumLength} characters.`;
    }
    const missing = KINDS.filter(kind => rules[kind.rule] !== false && !kind.test.test(password)).map(kind => kind.name);
    if (missing.length) return `Password must include ${missing.join(", ")}.`;
    return null;
}

// The rules in words, for the password forms.
function describePasswordRules(rules = {}) {
    const minimumLength = Number(rules.minimumLength) > 0 ? Number(rules.minimumLength) : DEFAULT_MINIMUM_LENGTH;
    const kinds = KINDS.filter(kind => rules[kind.rule] !== false).map(kind => kind.name);
    if (kinds.length === 0) return `At least ${minimumLength} characters.`;
    const list = kinds.length === 1 ? kinds[0] : `${kinds.slice(0, -1).join(", ")} and ${kinds.at(-1)}`;
    return `At least ${minimumLength} characters, with ${list}.`;
}

// Reads the password settings from Configuration. A database from before
// 2026-11-24 may still hold only PasswordComplexityRequired; it stands in
// for any of the four switches not yet stored.
async function loadPasswordRules(prisma) {
    const rows = await prisma.configuration.findMany({
        where: { key: { in: ["MinimumPasswordLength", "PasswordComplexityRequired", ...KINDS.map(kind => kind.key)] } }
    });
    const value = key => rows.find(r => r.key === key)?.value;
    const old = String(value("PasswordComplexityRequired") ?? "TRUE").toUpperCase() !== "FALSE";
    const rules = { minimumLength: Number(value("MinimumPasswordLength")) || DEFAULT_MINIMUM_LENGTH };
    for (const kind of KINDS) {
        const stored = value(kind.key);
        rules[kind.rule] = stored === undefined ? old : String(stored).toUpperCase() !== "FALSE";
    }
    return rules;
}

module.exports = { hashPassword, checkPassword, passwordProblem, describePasswordRules, loadPasswordRules, isHash, PASSWORD_KINDS: KINDS, DEFAULT_MINIMUM_LENGTH };
