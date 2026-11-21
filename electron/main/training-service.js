// Training records and qualification requirements (owner decisions
// 2026-11-21, documents/DECISIONS.md):
// - people record their own completed training; it counts once approved;
// - a qualification is current only while all its requirements are.
const { trainingStatus, combine } = require("./requirement-status");

const MANAGER_ROLES = ["Administrator", "Training_Manager", "Director_of_Operations", "Chief_Pilot", "Maintenance_Manager", "Quality_Control"];
const fail = (message) => ({ success: false, message });

// <input type="date"> gives "YYYY-MM-DD"; store UTC midnight of that day.
function parseDay(value) {
    const text = String(value ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const date = new Date(`${text}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? null : date;
}

function createTrainingService(prisma, { now = () => new Date() } = {}) {
    async function isManager(userId) {
        return Boolean(await prisma.userRole.findFirst({ where: { userId, role: { roleName: { in: MANAGER_ROLES } } } }));
    }

    async function programs() {
        return prisma.trainingProgram.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] });
    }

    // Everything needed to work out one person's qualifications in memory.
    async function context(userId) {
        const [qualifications, allPrograms, records, assignments] = await Promise.all([
            prisma.qualification.findMany({ where: { hidden: false }, include: { requirements: true } }),
            prisma.trainingProgram.findMany(),
            prisma.userTrainingRecord.findMany({ where: { userId, approval: "APPROVED", result: { in: ["PASS", "WAIVED"] } } }),
            prisma.userQualification.findMany({ where: { userId, status: "ACTIVE" } })
        ]);
        return {
            qualifications: new Map(qualifications.map((q) => [q.code, q])),
            programs: new Map(allPrograms.map((p) => [p.code, p])),
            records,
            assignments: new Map(assignments.map((a) => [a.qualificationId, a]))
        };
    }

    // One qualification for one person, with each requirement's status.
    function evaluate(ctx, code, today, seen = new Set()) {
        const qualification = ctx.qualifications.get(code);
        if (!qualification) return { code, name: code, status: "MISSING", items: [] };
        if (seen.has(code)) return { code, name: qualification.name, status: "MISSING", items: [], loop: true };
        const ordered = [...qualification.requirements].sort((a, b) =>
            (a.requirementType === b.requirementType ? 0 : a.requirementType === "TRAINING" ? -1 : 1) || a.requirementRef.localeCompare(b.requirementRef));
        const items = ordered.map((req) => {
            if (req.requirementType === "QUALIFICATION") {
                const inner = evaluate(ctx, req.requirementRef, today, new Set([...seen, code]));
                return { type: "QUALIFICATION", code: req.requirementRef, name: inner.name, status: inner.status === "INCOMPLETE" || inner.status === "NO_REQUIREMENTS" ? "MISSING" : inner.status, dueDate: inner.dueDate ?? null, graceEnd: inner.graceEnd ?? null };
            }
            const program = ctx.programs.get(req.requirementRef);
            if (!program) return { type: "TRAINING", code: req.requirementRef, name: req.requirementRef, status: "MISSING", dueDate: null, graceEnd: null };
            const mine = ctx.records.filter((r) => r.programId === program.id);
            return { type: "TRAINING", code: program.code, name: program.name, programId: program.id, renewalMonths: program.renewalMonths, ...trainingStatus(program, mine, today) };
        });
        const overall = combine(items);
        const assignment = ctx.assignments.get(qualification.id);
        return {
            code,
            qualificationId: qualification.id,
            name: qualification.name,
            ...overall,
            status: assignment?.suspended ? "SUSPENDED" : overall.status,
            items
        };
    }

    // The "My training" page: the person's assigned qualifications, each with
    // its requirements, plus their own records waiting for approval or rejected.
    async function myTraining(userId) {
        if (!userId) return fail("Authentication required");
        const ctx = await context(userId);
        const today = now();
        const mine = [...ctx.qualifications.values()].filter((q) => ctx.assignments.has(q.id)).sort((a, b) => a.code.localeCompare(b.code));
        const records = await prisma.userTrainingRecord.findMany({
            where: { userId }, include: { program: true, reviewer: { select: { username: true } } }, orderBy: { submittedAt: "desc" }, take: 50
        });
        const canApprove = await isManager(userId);
        return {
            success: true,
            canApprove,
            pendingToReview: canApprove ? await prisma.userTrainingRecord.count({ where: { approval: "PENDING", userId: { not: userId } } }) : 0,
            qualifications: mine.map((q) => evaluate(ctx, q.code, today)),
            records: records.map((r) => ({
                id: r.id, program: r.program.name, programCode: r.program.code, completionDate: r.completionDate, result: r.result,
                approval: r.approval, notes: r.notes, instructorName: r.instructorName, submittedAt: r.submittedAt,
                reviewedBy: r.reviewer?.username ?? null, reviewedAt: r.reviewedAt, reviewNote: r.reviewNote
            })),
            programs: await programs()
        };
    }

    async function submit(userId, input = {}) {
        if (!userId) return fail("Authentication required");
        const program = await prisma.trainingProgram.findUnique({ where: { id: String(input.programId ?? "") } });
        if (!program || !program.active) return fail("Choose the training you completed.");
        const date = parseDay(input.completionDate);
        if (!date) return fail("Enter the date you completed it.");
        const t = now();
        if (date > new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()))) return fail("The completion date cannot be in the future.");
        const result = ["PASS", "FAIL", "INCOMPLETE"].includes(input.result) ? input.result : "PASS";
        const record = await prisma.userTrainingRecord.create({
            data: {
                userId, programId: program.id, completionDate: date, result,
                instructorName: String(input.instructorName ?? "").trim() || null,
                notes: String(input.notes ?? "").trim() || null,
                submittedAt: t
            }
        });
        await prisma.auditLog.create({ data: { userId, entity: "UserTrainingRecord", entityId: record.id, action: "TRAINING_RECORDED", newValue: JSON.stringify({ program: program.code, completionDate: input.completionDate, result }) } });
        return { success: true, message: "Recorded. It will count once a manager approves it." };
    }

    // A person may withdraw their own record while it waits for approval.
    async function withdraw(userId, recordId) {
        const record = await prisma.userTrainingRecord.findUnique({ where: { id: String(recordId ?? "") } });
        if (!record || record.userId !== userId) return fail("Record not found.");
        if (record.approval !== "PENDING") return fail("Only a record waiting for approval can be withdrawn.");
        await prisma.userTrainingRecord.delete({ where: { id: record.id } });
        await prisma.auditLog.create({ data: { userId, entity: "UserTrainingRecord", entityId: record.id, action: "TRAINING_WITHDRAWN" } });
        return { success: true, message: "Withdrawn." };
    }

    async function pending(managerId) {
        if (!managerId) return fail("Authentication required");
        if (!(await isManager(managerId))) return fail("Only a manager can approve training.");
        const records = await prisma.userTrainingRecord.findMany({
            where: { approval: "PENDING" },
            include: { program: true, user: { select: { id: true, username: true, firstName: true, lastName: true } } },
            orderBy: { submittedAt: "asc" }
        });
        return {
            success: true,
            records: records.map((r) => ({
                id: r.id, userId: r.user.id, username: r.user.username, person: `${r.user.firstName} ${r.user.lastName}`.trim(),
                program: r.program.name, programCode: r.program.code, completionDate: r.completionDate, result: r.result,
                instructorName: r.instructorName, notes: r.notes, submittedAt: r.submittedAt, own: r.user.id === managerId
            }))
        };
    }

    async function review(managerId, recordId, approve, note) {
        if (!managerId) return fail("Authentication required");
        if (!(await isManager(managerId))) return fail("Only a manager can approve training.");
        const record = await prisma.userTrainingRecord.findUnique({ where: { id: String(recordId ?? "") }, include: { program: true } });
        if (!record) return fail("Record not found.");
        if (record.approval !== "PENDING") return fail("This record has already been reviewed.");
        if (record.userId === managerId) return fail("You cannot approve your own training. Ask another manager.");
        const reviewNote = String(note ?? "").trim() || null;
        if (!approve && !reviewNote) return fail("Say why it is rejected, so the person can fix it.");
        await prisma.$transaction([
            prisma.userTrainingRecord.update({ where: { id: record.id }, data: { approval: approve ? "APPROVED" : "REJECTED", reviewedById: managerId, reviewedAt: now(), reviewNote } }),
            prisma.auditLog.create({ data: { userId: managerId, entity: "UserTrainingRecord", entityId: record.id, action: approve ? "TRAINING_APPROVED" : "TRAINING_REJECTED", newValue: JSON.stringify({ person: record.userId, program: record.program.code, note: reviewNote }) } })
        ]);
        return { success: true, message: approve ? "Approved." : "Rejected." };
    }

    // For the Qualifications pages: one person's status on one qualification.
    async function qualificationFor(userId, code) {
        return evaluate(await context(userId), code, now());
    }

    return { programs, myTraining, submit, withdraw, pending, review, qualificationFor, isManager };
}

module.exports = { createTrainingService, parseDay };
