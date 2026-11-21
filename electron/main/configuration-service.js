// Settings stored in the Configuration table (Sprint 1, Epic 8).
// Every key the app knows has a rule here; a value that breaks its rule is
// refused with a message, and nothing is saved. Changes are audited.

const yesNo = { kind: "boolean" };
const whole = (min, max, unit) => ({ kind: "integer", min, max, unit });

// Order and groups are what the Settings screen shows.
const SETTINGS = [
    { key: "SessionTimeoutMinutes", group: "Security", label: "Sign out after this many minutes without activity", ...whole(5, 480, "minutes"), fallback: "30" },
    { key: "MinimumPasswordLength", group: "Security", label: "Minimum password length", ...whole(8, 64, "characters"), fallback: "12" },
    { key: "PasswordComplexityRequired", group: "Security", label: "Require upper case, lower case, a number and a symbol", ...yesNo, fallback: "TRUE" },
    { key: "Alert90Days", group: "Qualification alerts", label: "Alert 90 days before a qualification expires", ...yesNo, fallback: "TRUE" },
    { key: "Alert60Days", group: "Qualification alerts", label: "Alert 60 days before", ...yesNo, fallback: "TRUE" },
    { key: "Alert30Days", group: "Qualification alerts", label: "Alert 30 days before", ...yesNo, fallback: "TRUE" },
    { key: "Alert7Days", group: "Qualification alerts", label: "Alert 7 days before", ...yesNo, fallback: "TRUE" },
    { key: "ReadinessKnowledgeWeight", group: "Readiness", label: "Weight of knowledge (quiz results)", ...whole(0, 100, "%"), fallback: "70" },
    { key: "ReadinessQualificationWeight", group: "Readiness", label: "Weight of qualifications", ...whole(0, 100, "%"), fallback: "30" },
    { key: "CoverageThreshold", group: "Readiness", label: "Show knowledge scores once this much of a subject is covered", ...whole(0, 100, "%"), fallback: "50" },
    { key: "BackupRetentionDays", group: "Records", label: "Keep backups for", ...whole(1, 3650, "days"), fallback: "90" },
    { key: "AuditRetentionDays", group: "Records", label: "Keep audit records for", ...whole(30, 3650, "days"), fallback: "365" }
];

const BY_KEY = Object.fromEntries(SETTINGS.map((setting) => [setting.key, setting]));

// Returns [cleanValue, problem]. cleanValue is the text stored in the table.
function clean(setting, value) {
    if (setting.kind === "boolean") {
        const text = String(value).trim().toUpperCase();
        if (value === true || text === "TRUE" || text === "YES") return ["TRUE", null];
        if (value === false || text === "FALSE" || text === "NO") return ["FALSE", null];
        return [null, `${setting.label}: choose yes or no.`];
    }
    const text = String(value ?? "").trim();
    if (!/^\d+$/.test(text)) return [null, `${setting.label}: enter a whole number.`];
    const number = Number(text);
    if (number < setting.min || number > setting.max) {
        return [null, `${setting.label}: must be between ${setting.min} and ${setting.max} ${setting.unit}.`];
    }
    return [String(number), null];
}

function createConfigurationService(prisma) {
    // All known settings with their current values, in screen order.
    async function getAll() {
        const rows = await prisma.configuration.findMany({ where: { key: { in: SETTINGS.map((s) => s.key) } } });
        const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
        return SETTINGS.map((setting) => ({ ...setting, value: stored[setting.key] ?? setting.fallback }));
    }

    async function get(key) {
        const setting = BY_KEY[key];
        if (!setting) throw new Error(`Unknown setting ${key}`);
        const row = await prisma.configuration.findUnique({ where: { key } });
        return row?.value ?? setting.fallback;
    }

    async function getNumber(key) {
        return Number(await get(key));
    }

    // changes: { key: value, ... }. All are checked first; then all are saved
    // together, or none. Returns { success, message, settings? }.
    async function save(changes, actorId) {
        const current = Object.fromEntries((await getAll()).map((s) => [s.key, s.value]));
        const problems = [];
        const updates = {};
        for (const [key, value] of Object.entries(changes ?? {})) {
            const setting = BY_KEY[key];
            if (!setting) { problems.push(`${key} is not a setting.`); continue; }
            const [value2, problem] = clean(setting, value);
            if (problem) problems.push(problem);
            else if (value2 !== current[key]) updates[key] = value2;
        }
        const after = { ...current, ...updates };
        if (Number(after.ReadinessKnowledgeWeight) + Number(after.ReadinessQualificationWeight) !== 100) {
            problems.push("The two readiness weights must add up to 100%.");
        }
        if (problems.length > 0) return { success: false, message: problems.join(" ") };
        if (Object.keys(updates).length === 0) return { success: true, message: "Nothing changed.", settings: await getAll() };

        await prisma.$transaction([
            ...Object.entries(updates).map(([key, value]) => prisma.configuration.upsert({
                where: { key },
                update: { value },
                create: { key, value, description: BY_KEY[key].label }
            })),
            ...Object.entries(updates).map(([key, value]) => prisma.auditLog.create({
                data: { userId: actorId, entity: "Configuration", entityId: key, action: "CONFIGURATION_CHANGED", oldValue: current[key], newValue: value }
            }))
        ]);
        return { success: true, message: "Settings saved.", settings: await getAll() };
    }

    return { getAll, get, getNumber, save };
}

module.exports = { createConfigurationService, SETTINGS };
