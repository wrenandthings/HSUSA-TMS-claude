// Status of training requirements and of qualifications built from them
// (owner decisions 2026-11-21, documents/DECISIONS.md). No Electron or
// Prisma here, so it can be unit-tested.
//
// Dates are stored as UTC midnight of the chosen day (see qualification-status.js).
//
// A requirement with a renewal period is due at the end of a calendar month.
// Grace window (Qualification Rules Matrix v1.0): training done in the month
// before or after the due month counts as done in the due month. So:
// - the next due month is counted from the due month, not the completion
//   month, when the training was done within that window;
// - after the due month ends, the person is still in time until the end of
//   the following month (shown as due soon), and only then expired.
const { daysRemaining, WARNING_DAYS } = require("./qualification-status");

const monthIndex = (date) => { const d = new Date(date); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
const endOfMonth = (index) => new Date(Date.UTC(Math.floor(index / 12), (index % 12) + 1, 0));

// records: this person's approved, passed records for this program, any order.
function trainingStatus(program, records, now = new Date()) {
    const done = [...records].sort((a, b) => new Date(a.completionDate) - new Date(b.completionDate));
    if (done.length === 0) return { status: "MISSING", lastCompleted: null, dueDate: null, graceEnd: null };
    const lastCompleted = done[done.length - 1].completionDate;
    if (!program.renewalMonths) return { status: "CURRENT", lastCompleted, dueDate: null, graceEnd: null };

    let due = null;
    for (const record of done) {
        const month = monthIndex(record.completionDate);
        due = (due !== null && Math.abs(month - due) <= 1 ? due : month) + program.renewalMonths;
    }
    const dueDate = endOfMonth(due);
    const graceEnd = endOfMonth(due + 1);
    let status = "CURRENT";
    if (daysRemaining(graceEnd, now) < 0) status = "EXPIRED";
    else if (daysRemaining(dueDate, now) <= WARNING_DAYS) status = "EXPIRING";
    return { status, lastCompleted, dueDate, graceEnd, inGrace: status === "EXPIRING" && daysRemaining(dueDate, now) < 0 };
}

const RANK = { CURRENT: 0, EXPIRING: 1, EXPIRED: 2, MISSING: 3, INCOMPLETE: 3, SUSPENDED: 4 };

// items: [{ status, dueDate, graceEnd }]. The qualification is only as good
// as its worst requirement, and expires when the first requirement does.
function combine(items) {
    if (items.length === 0) return { status: "NO_REQUIREMENTS", dueDate: null, graceEnd: null };
    const worst = items.reduce((a, b) => (RANK[b.status] > RANK[a.status] ? b : a)).status;
    const earliest = (key) => items.map((i) => i[key]).filter(Boolean).sort((a, b) => new Date(a) - new Date(b))[0] ?? null;
    return {
        status: worst === "MISSING" ? "INCOMPLETE" : worst,
        dueDate: earliest("dueDate"),
        graceEnd: earliest("graceEnd")
    };
}

module.exports = { trainingStatus, combine, monthIndex, endOfMonth };
