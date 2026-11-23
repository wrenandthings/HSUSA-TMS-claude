// Training records and qualification requirements (owner decisions
// 2026-11-21, documents/DECISIONS.md):
// - people record their own completed training; it counts once approved;
// - a qualification is current only while all its requirements are.
const { trainingStatus, combine } = require("./requirement-status");
const { daysRemaining } = require("./qualification-status");
const { createConfigurationService } = require("./configuration-service");

const MANAGER_ROLES = ["Administrator", "Training_Manager", "Director_of_Operations", "Chief_Pilot", "Maintenance_Manager", "Quality_Control"];
// Who may change what each qualification needs (DECISIONS.md 2026-11-21).
const REQUIREMENT_EDITORS = ["Administrator", "Training_Manager"];
// Approval Matrix: a waiver only by the Director of Operations or an
// Administrator; overriding a whole qualification only by an Administrator.
const WAIVER_ROLES = ["Administrator", "Director_of_Operations"];
const OVERRIDE_ROLES = ["Administrator"];
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

    async function hasRole(userId, roles) {
        return Boolean(await prisma.userRole.findFirst({ where: { userId, role: { roleName: { in: roles } } } }));
    }

    async function canEditRequirements(userId) {
        return Boolean(await prisma.userRole.findFirst({ where: { userId, role: { roleName: { in: REQUIREMENT_EDITORS } } } }));
    }

    async function programs() {
        return prisma.trainingProgram.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] });
    }

    // Everything needed to work out one person's qualifications in memory.
    async function context(userId) {
        const [qualifications, allPrograms, records, assignments, waiting, waivers] = await Promise.all([
            prisma.qualification.findMany({ where: { hidden: false }, include: { requirements: true } }),
            prisma.trainingProgram.findMany(),
            prisma.userTrainingRecord.findMany({ where: { userId, approval: "APPROVED", result: { in: ["PASS", "WAIVED"] } } }),
            prisma.userQualification.findMany({ where: { userId, status: "ACTIVE" } }),
            prisma.userTrainingRecord.findMany({ where: { userId, approval: "PENDING" }, select: { programId: true } }),
            prisma.requirementWaiver.findMany({ where: { userId, revokedAt: null } })
        ]);
        const today = now();
        const active = waivers.filter((w) => daysRemaining(w.issuedAt, today) <= 0 && daysRemaining(w.expiresAt, today) >= 0);
        return {
            qualifications: new Map(qualifications.map((q) => [q.code, q])),
            programs: new Map(allPrograms.map((p) => [p.code, p])),
            records,
            assignments: new Map(assignments.map((a) => [a.qualificationId, a])),
            waiting: new Set(waiting.map((r) => r.programId)),
            waivedTraining: new Map(active.filter((w) => w.targetType === "TRAINING").map((w) => [w.targetRef, w])),
            overridden: new Map(active.filter((w) => w.targetType === "QUALIFICATION").map((w) => [w.targetRef, w]))
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
            const waiver = ctx.waivedTraining.get(program.code);
            if (waiver) {
                const days = daysRemaining(waiver.expiresAt, today);
                const done = trainingStatus(program, mine, today);
                return { type: "TRAINING", code: program.code, name: program.name, programId: program.id, renewalMonths: program.renewalMonths, waiting: ctx.waiting.has(program.id),
                    status: days <= 30 ? "EXPIRING" : "CURRENT", dueDate: waiver.expiresAt, graceEnd: null, inGrace: false, lastCompleted: done.lastCompleted ?? null,
                    waived: { id: waiver.id, reason: waiver.reason, expiresAt: waiver.expiresAt } };
            }
            return { type: "TRAINING", code: program.code, name: program.name, programId: program.id, renewalMonths: program.renewalMonths, waiting: ctx.waiting.has(program.id), ...trainingStatus(program, mine, today) };
        });
        let overall = combine(items);
        const override = ctx.overridden.get(code);
        if (override) {
            const days = daysRemaining(override.expiresAt, today);
            overall = { ...overall, status: days <= 30 ? "EXPIRING" : "CURRENT", dueDate: override.expiresAt, graceEnd: null, overridden: { id: override.id, reason: override.reason, expiresAt: override.expiresAt } };
        }
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
        const canEdit = await canEditRequirements(userId);
        return {
            success: true,
            canApprove,
            canEditRequirements: canEdit,
            canWaive: await hasRole(userId, WAIVER_ROLES),
            canOverride: await hasRole(userId, OVERRIDE_ROLES),
            isAdministrator: await hasRole(userId, ["Administrator"]),
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

    // Waivers and overrides for one person's qualification.
    async function waiverView(viewerId, userId, code) {
        const [canWaive, canOverride] = await Promise.all([hasRole(viewerId, WAIVER_ROLES), hasRole(viewerId, OVERRIDE_ROLES)]);
        if (!canWaive && !canOverride) return fail("Only the Director of Operations or an Administrator can grant waivers.");
        const ctx = await context(userId);
        const qualification = ctx.qualifications.get(code);
        if (!qualification) return fail("Qualification not found.");
        const result = evaluate(ctx, code, now());
        const refs = new Set([code, ...qualification.requirements.filter((r) => r.requirementType === "TRAINING").map((r) => r.requirementRef)]);
        const waivers = await prisma.requirementWaiver.findMany({
            where: { userId, targetRef: { in: [...refs] } },
            include: { approvedBy: { select: { username: true } }, revokedBy: { select: { username: true } } },
            orderBy: { createdAt: "desc" }
        });
        return {
            success: true, canWaive, canOverride, qualification: result,
            waivers: waivers.map((w) => ({
                id: w.id, targetType: w.targetType, targetRef: w.targetRef, reason: w.reason, documentation: w.documentation,
                issuedAt: w.issuedAt, expiresAt: w.expiresAt, approvedBy: w.approvedBy.username,
                revokedAt: w.revokedAt, revokedBy: w.revokedBy?.username ?? null, revokeReason: w.revokeReason
            }))
        };
    }

    async function grantWaiver(viewerId, input = {}) {
        const targetType = input.targetType === "QUALIFICATION" ? "QUALIFICATION" : input.targetType === "TRAINING" ? "TRAINING" : null;
        if (!targetType) return fail("Unknown waiver type.");
        if (targetType === "TRAINING" && !(await hasRole(viewerId, WAIVER_ROLES))) return fail("Only the Director of Operations or an Administrator can waive a requirement.");
        if (targetType === "QUALIFICATION" && !(await hasRole(viewerId, OVERRIDE_ROLES))) return fail("Only an Administrator can override a qualification.");
        const person = await prisma.user.findUnique({ where: { id: String(input.userId ?? "") } });
        if (!person) return fail("Person not found.");
        const ref = String(input.targetRef ?? "");
        const exists = targetType === "TRAINING"
            ? await prisma.trainingProgram.findUnique({ where: { code: ref } })
            : await prisma.qualification.findUnique({ where: { code: ref } });
        if (!exists) return fail(targetType === "TRAINING" ? "Training not found." : "Qualification not found.");
        const reason = String(input.reason ?? "").trim();
        if (!reason) return fail("Give the reason. It is required for every waiver and override.");
        const expiresAt = parseDay(input.expiresAt);
        if (!expiresAt) return fail("Enter the date it ends.");
        const t = now();
        const issuedAt = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
        if (expiresAt <= issuedAt) return fail("The end date must be after today.");
        if (expiresAt > new Date(Date.UTC(t.getFullYear() + 2, t.getMonth(), t.getDate()))) return fail("A waiver can last at most 2 years.");
        const already = await prisma.requirementWaiver.findFirst({ where: { userId: person.id, targetType, targetRef: ref, revokedAt: null, expiresAt: { gte: issuedAt } } });
        if (already) return fail("There is already an active one. Revoke it first to change it.");
        const documentation = String(input.documentation ?? "").trim() || null;
        const created = await prisma.requirementWaiver.create({ data: { userId: person.id, targetType, targetRef: ref, reason, documentation, approvedById: viewerId, issuedAt, expiresAt } });
        await prisma.auditLog.create({ data: { userId: viewerId, entity: "RequirementWaiver", entityId: created.id, action: targetType === "TRAINING" ? "REQUIREMENT_WAIVED" : "QUALIFICATION_OVERRIDDEN", newValue: JSON.stringify({ person: person.id, target: ref, reason, documentation, expiresAt: input.expiresAt }) } });
        return { success: true, message: targetType === "TRAINING" ? "Requirement waived." : "Qualification overridden." };
    }

    async function revokeWaiver(viewerId, waiverId, reason) {
        const waiver = await prisma.requirementWaiver.findUnique({ where: { id: String(waiverId ?? "") } });
        if (!waiver) return fail("Waiver not found.");
        const allowed = waiver.targetType === "TRAINING" ? await hasRole(viewerId, WAIVER_ROLES) : await hasRole(viewerId, OVERRIDE_ROLES);
        if (!allowed) return fail("You cannot revoke this.");
        if (waiver.revokedAt) return fail("Already revoked.");
        const why = String(reason ?? "").trim();
        if (!why) return fail("Give the reason for revoking.");
        await prisma.$transaction([
            prisma.requirementWaiver.update({ where: { id: waiver.id }, data: { revokedAt: now(), revokedById: viewerId, revokeReason: why } }),
            prisma.auditLog.create({ data: { userId: viewerId, entity: "RequirementWaiver", entityId: waiver.id, action: waiver.targetType === "TRAINING" ? "WAIVER_REVOKED" : "OVERRIDE_REVOKED", newValue: JSON.stringify({ reason: why }) } })
        ]);
        return { success: true, message: "Revoked." };
    }

    // The requirements editor (Training Manager and Administrator).
    async function requirementsEditor(userId) {
        if (!(await canEditRequirements(userId))) return fail("Only a Training Manager or Administrator can change requirements.");
        const [qualifications, allPrograms] = await Promise.all([
            prisma.qualification.findMany({ where: { hidden: false }, include: { requirements: true }, orderBy: { code: "asc" } }),
            prisma.trainingProgram.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] })
        ]);
        return {
            success: true,
            qualifications: qualifications.map((q) => ({
                id: q.id, code: q.code, name: q.name,
                requirements: q.requirements.map((r) => ({ type: r.requirementType, ref: r.requirementRef }))
            })),
            programs: allPrograms
        };
    }

    // True if `code` needs `target`, directly or through other qualifications.
    function reaches(byCode, code, target, seen = new Set()) {
        if (code === target) return true;
        if (seen.has(code)) return false;
        seen.add(code);
        return (byCode.get(code) ?? []).some((ref) => reaches(byCode, ref, target, seen));
    }

    async function setRequirements(userId, qualificationId, items) {
        if (!(await canEditRequirements(userId))) return fail("Only a Training Manager or Administrator can change requirements.");
        const qualification = await prisma.qualification.findUnique({ where: { id: String(qualificationId ?? "") }, include: { requirements: true } });
        if (!qualification) return fail("Qualification not found.");
        const list = Array.isArray(items) ? items : [];
        const [allPrograms, allQualifications] = await Promise.all([
            prisma.trainingProgram.findMany({ select: { code: true } }),
            prisma.qualification.findMany({ include: { requirements: true } })
        ]);
        const programCodes = new Set(allPrograms.map((p) => p.code));
        const byCode = new Map(allQualifications.map((q) => [q.code, q.requirements.filter((r) => r.requirementType === "QUALIFICATION").map((r) => r.requirementRef)]));
        const clean = [];
        const seen = new Set();
        for (const item of list) {
            const type = item?.type === "QUALIFICATION" ? "QUALIFICATION" : item?.type === "TRAINING" ? "TRAINING" : null;
            const ref = String(item?.ref ?? "");
            if (!type) return fail("Unknown requirement type.");
            if (type === "TRAINING" && !programCodes.has(ref)) return fail(`Unknown training: ${ref}.`);
            if (type === "QUALIFICATION") {
                if (!byCode.has(ref)) return fail(`Unknown qualification: ${ref}.`);
                if (reaches(byCode, ref, qualification.code)) return fail(`${ref} already needs ${qualification.code}, so ${qualification.code} cannot need ${ref}.`);
            }
            const key = `${type}:${ref}`;
            if (!seen.has(key)) { seen.add(key); clean.push({ requirementType: type, requirementRef: ref }); }
        }
        const before = qualification.requirements.map((r) => `${r.requirementType}:${r.requirementRef}`).sort();
        await prisma.$transaction([
            prisma.qualificationRequirement.deleteMany({ where: { qualificationId: qualification.id } }),
            prisma.qualificationRequirement.createMany({ data: clean.map((c) => ({ ...c, qualificationId: qualification.id })) }),
            prisma.auditLog.create({ data: { userId, entity: "Qualification", entityId: qualification.id, action: "REQUIREMENTS_CHANGED", oldValue: JSON.stringify(before), newValue: JSON.stringify([...seen].sort()) } })
        ]);
        return { success: true, message: `Saved requirements for ${qualification.name}.` };
    }

    // How often a training must be repeated (blank = once).
    async function setRenewal(userId, programId, renewalMonths) {
        if (!(await canEditRequirements(userId))) return fail("Only a Training Manager or Administrator can change requirements.");
        const program = await prisma.trainingProgram.findUnique({ where: { id: String(programId ?? "") } });
        if (!program) return fail("Training not found.");
        let months = null;
        if (renewalMonths !== null && renewalMonths !== "" && renewalMonths !== undefined) {
            months = Number(renewalMonths);
            if (!Number.isInteger(months) || months < 1 || months > 120) return fail("Enter whole months from 1 to 120, or leave it blank for once.");
        }
        await prisma.$transaction([
            prisma.trainingProgram.update({ where: { id: program.id }, data: { renewalMonths: months } }),
            prisma.auditLog.create({ data: { userId, entity: "TrainingProgram", entityId: program.id, action: "RENEWAL_CHANGED", oldValue: JSON.stringify(program.renewalMonths), newValue: JSON.stringify(months) } })
        ]);
        return { success: true, message: `${program.name}: ${months ? `every ${months} months` : "once"}.` };
    }

    // Alerts (owner decision Q23): 90/60/30/7 days before a due date, each
    // switchable in Settings, plus anything expired, in grace or not done.
    async function alertWindow() {
        const config = createConfigurationService(prisma);
        const on = await Promise.all([[90, "Alert90Days"], [60, "Alert60Days"], [30, "Alert30Days"], [7, "Alert7Days"]]
            .map(async ([days, key]) => (String(await config.get(key)).toUpperCase() === "TRUE" ? days : 0)));
        return Math.max(0, ...on);
    }

    function alertsFor(ctx, person, window, today) {
        const out = [];
        for (const q of ctx.qualifications.values()) {
            const assignment = ctx.assignments.get(q.id);
            if (!assignment || q.requirements.length === 0) continue;
            const result = evaluate(ctx, q.code, today);
            if (result.status === "SUSPENDED") continue;
            for (const item of result.items) {
                if (item.type !== "TRAINING") continue;
                const base = { person, qualification: q.name, qualificationCode: q.code, training: item.name, programCode: item.code, dueDate: item.dueDate ?? null, graceEnd: item.graceEnd ?? null, waiting: Boolean(item.waiting) };
                if (item.status === "MISSING") out.push({ ...base, level: "MISSING", daysLeft: null });
                else if (item.status === "EXPIRED") out.push({ ...base, level: "EXPIRED", daysLeft: daysRemaining(item.dueDate, today) });
                else if (item.dueDate) {
                    const days = daysRemaining(item.dueDate, today);
                    if (item.inGrace) out.push({ ...base, level: "GRACE", daysLeft: days });
                    else if (days <= window) out.push({ ...base, level: days <= 7 ? "DUE_7" : days <= 30 ? "DUE_30" : "DUE_SOON", daysLeft: days });
                }
            }
        }
        // One row per training: a check needed by PIC and IFR shows once.
        const merged = new Map();
        for (const a of out) {
            const seen = merged.get(a.programCode);
            if (!seen) merged.set(a.programCode, { ...a, qualifications: [a.qualificationCode] });
            else if (!seen.qualifications.includes(a.qualificationCode)) {
                seen.qualifications.push(a.qualificationCode);
                seen.qualification = `${seen.qualification}, ${a.qualification}`;
            }
        }
        return [...merged.values()];
    }

    const LEVEL_ORDER = { EXPIRED: 0, GRACE: 1, MISSING: 2, DUE_7: 3, DUE_30: 4, DUE_SOON: 5 };
    const byUrgency = (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || (a.daysLeft ?? 0) - (b.daysLeft ?? 0) || a.person.name.localeCompare(b.person.name);

    // Your own alerts, and for managers everyone's.
    async function alerts(userId) {
        if (!userId) return fail("Authentication required");
        const today = now();
        const window = await alertWindow();
        const me = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, firstName: true, lastName: true } });
        const label = (u) => ({ id: u.id, username: u.username, name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username });
        const mine = alertsFor(await context(userId), label(me), window, today).sort(byUrgency);
        let team = null;
        if (await isManager(userId)) {
            const holders = await prisma.user.findMany({
                where: { status: "ACTIVE", id: { not: userId }, qualifications: { some: { status: "ACTIVE" } } },
                select: { id: true, username: true, firstName: true, lastName: true }
            });
            team = [];
            for (const u of holders) team.push(...alertsFor(await context(u.id), label(u), window, today));
            team.sort(byUrgency);
        }
        return { success: true, windowDays: window, mine, team };
    }

    return { waiverView, grantWaiver, revokeWaiver, alerts, requirementsEditor, setRequirements, setRenewal, canEditRequirements, programs, myTraining, submit, withdraw, pending, review, qualificationFor, isManager };
}

module.exports = { createTrainingService, parseDay };
