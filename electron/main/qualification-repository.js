// Database logic for qualifications and per-person assignments, following
// documents/QUALIFICATION_SPECIFICATION.md. Takes a Prisma client so it can be
// tested against a temporary database; qualification-handler.js wires it to IPC.

const { calculateStatus } = require("./qualification-status");

// Only these user fields reach the renderer. Spec section 5: qualification
// views must not expose password data or restricted user administration data.
const USER_FIELDS = { id: true, username: true, firstName: true, lastName: true };

// Date inputs send "YYYY-MM-DD", which new Date() reads as UTC midnight.
function parseDate(value) {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
    return date;
}

// Adds whole months in UTC, keeping the day where possible. A day past the end
// of the target month moves back to its last day (Jan 31 + 1 month = Feb 28).
function addMonths(date, months) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + months;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
}

function parseRenewalMonths(value) {
    if (value === undefined || value === null || value === "") return null;
    const months = Number(value);
    if (!Number.isInteger(months) || months <= 0) throw new Error("Renewal months must be a whole number greater than zero.");
    return months;
}

function qualificationData(input) {
    const name = String(input.name ?? "").trim();
    const code = String(input.code ?? "").trim().toUpperCase().replace(/\s+/g, "_");
    if (!name) throw new Error("Qualification name is required.");
    if (!code) throw new Error("Qualification code is required.");
    return {
        code,
        name,
        description: input.description ? String(input.description).trim() : null,
        renewalMonths: parseRenewalMonths(input.renewalMonths),
        active: input.active === undefined ? true : Boolean(input.active)
    };
}

function withStatus(assignment, now) {
    return {
        ...assignment,
        qualificationStatus: calculateStatus(assignment.expirationDate, assignment.suspended ? "SUSPENDED" : "CURRENT", now)
    };
}

function snapshot(record) {
    return record ? JSON.stringify(record) : null;
}

function createQualificationRepository(prisma, options = {}) {
    const now = () => (options.now ? options.now() : new Date());

    const include = {
        assignments: { include: { user: { select: USER_FIELDS } }, orderBy: { assignedAt: "desc" } }
    };

    function serialize(record) {
        if (!record) return null;
        const at = now();
        return { ...record, assignments: record.assignments.map(a => withStatus(a, at)) };
    }

    async function audit(actorId, action, entityId, oldValue, newValue) {
        await prisma.auditLog.create({
            data: { userId: actorId ?? null, entity: "Qualification", entityId, action, oldValue: snapshot(oldValue), newValue: snapshot(newValue) }
        });
    }

    async function findActiveAssignment(qualificationId, userId) {
        return prisma.userQualification.findFirst({ where: { qualificationId, userId, status: "ACTIVE" } });
    }

    return {
        // Hidden qualifications (created in error) are left out unless asked for.
        async list(options = {}) {
            const records = await prisma.qualification.findMany({
                where: options.includeHidden ? undefined : { hidden: false },
                include,
                orderBy: { name: "asc" }
            });
            return records.map(serialize);
        },

        // Spec section 3 and owner question 24: an administrator can hide a
        // qualification created in error. Nothing is deleted; it can be unhidden.
        async setHidden(id, hidden, actorId) {
            const before = await prisma.qualification.findUniqueOrThrow({ where: { id } });
            const updated = await prisma.qualification.update({ where: { id }, data: { hidden: Boolean(hidden) }, include });
            await audit(actorId, hidden ? "QUALIFICATION_HIDDEN" : "QUALIFICATION_UNHIDDEN", id, { hidden: before.hidden }, { hidden: Boolean(hidden) });
            return serialize(updated);
        },

        async getById(id) {
            return serialize(await prisma.qualification.findUnique({ where: { id }, include }));
        },

        async create(input, actorId) {
            const data = qualificationData(input);
            const created = await prisma.qualification.create({ data, include });
            await audit(actorId, "QUALIFICATION_CREATED", created.id, null, data);
            return serialize(created);
        },

        async update(input, actorId) {
            const before = await prisma.qualification.findUniqueOrThrow({ where: { id: input.id } });
            const data = qualificationData(input);
            const updated = await prisma.qualification.update({ where: { id: input.id }, data, include });
            await audit(actorId, "QUALIFICATION_UPDATED", updated.id, before, data);
            return serialize(updated);
        },

        // Spec section 3: assignment history must not be permanently deleted,
        // and deleting a qualification would cascade to its assignments.
        async remove(id, actorId) {
            const before = await prisma.qualification.findUniqueOrThrow({ where: { id } });
            const history = await prisma.userQualification.count({ where: { qualificationId: id } });
            if (history > 0) {
                throw new Error("This qualification has assignment history and cannot be deleted. Mark it inactive instead, or an administrator can hide it.");
            }
            await prisma.qualification.delete({ where: { id } });
            await audit(actorId, "QUALIFICATION_DELETED", id, before, null);
        },

        // Creates an active assignment. If no expiration date is given, it is
        // the awarded date plus the qualification's renewal months.
        async assign(input, actorId) {
            const existing = await findActiveAssignment(input.qualificationId, input.userId);
            if (existing) return withStatus(existing, now());
            const qualification = await prisma.qualification.findUniqueOrThrow({ where: { id: input.qualificationId } });
            const awardedDate = parseDate(input.awardedDate) ?? null;
            let expirationDate = parseDate(input.expirationDate) ?? null;
            if (!expirationDate && awardedDate && qualification.renewalMonths) {
                expirationDate = addMonths(awardedDate, qualification.renewalMonths);
            }
            const created = await prisma.userQualification.create({
                data: { userId: input.userId, qualificationId: input.qualificationId, status: "ACTIVE", awardedDate, expirationDate }
            });
            await audit(actorId, "QUALIFICATION_ASSIGNED", input.qualificationId, null, created);
            return withStatus(created, now());
        },

        // Changes a person's dates, or suspends or reinstates their assignment.
        // Only fields present in the input are changed.
        async updateAssignment(input, actorId) {
            const before = await prisma.userQualification.findUniqueOrThrow({ where: { id: input.assignmentId } });
            if (before.status !== "ACTIVE") throw new Error("Only active assignments can be changed.");
            const data = {};
            const awardedDate = parseDate(input.awardedDate);
            const expirationDate = parseDate(input.expirationDate);
            if (awardedDate !== undefined) data.awardedDate = awardedDate;
            if (expirationDate !== undefined) data.expirationDate = expirationDate;
            if (input.suspended !== undefined) data.suspended = Boolean(input.suspended);
            const updated = await prisma.userQualification.update({ where: { id: before.id }, data });
            let action = "QUALIFICATION_UPDATED";
            if (data.suspended === true && !before.suspended) action = "QUALIFICATION_SUSPENDED";
            if (data.suspended === false && before.suspended) action = "QUALIFICATION_REINSTATED";
            await audit(actorId, action, before.qualificationId, before, updated);
            return withStatus(updated, now());
        },

        // Spec section 3: removal changes the assignment to REVOKED and keeps it.
        async unassign(input, actorId) {
            const active = await findActiveAssignment(input.qualificationId, input.userId);
            if (!active) return null;
            const updated = await prisma.userQualification.update({
                where: { id: active.id },
                data: { status: "REVOKED", revokedAt: now(), endReason: input.reason || "Removed by administrator" }
            });
            await audit(actorId, "QUALIFICATION_UNASSIGNED", input.qualificationId, active, updated);
            return withStatus(updated, now());
        }
    };
}

module.exports = { createQualificationRepository, addMonths, USER_FIELDS };
