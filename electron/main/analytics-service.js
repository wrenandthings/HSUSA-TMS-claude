// Progress (Phase 8; UI spec ANL-001, Reporting spec RPT-COV/KNOW/WA/ORG,
// Master Baseline business rules). Choices made where the specs are silent
// (DECISIONS.md 2026-11-21, "Progress"):
// - a question is "seen" once answered in a quiz (flashcards do not test);
// - knowledge is the share of seen questions whose latest quiz answer is right;
// - a subject's knowledge is hidden until its coverage reaches the threshold
//   (CoverageThreshold, default 50%); overall knowledge uses only subjects
//   past the threshold, weighted by questions seen;
// - qualification score = current qualifications / assigned qualifications,
//   where Current and Expiring count in full (Rules Matrix);
// - readiness = knowledge x 70% + qualifications x 30% (both settings); with no
//   qualifications assigned, readiness is knowledge alone; with knowledge
//   hidden, readiness is not shown yet.
const { createConfigurationService } = require("./configuration-service");
const { createTrainingService } = require("./training-service");
const { calculateStatus } = require("./qualification-status");

const fail = (message) => ({ success: false, message });
const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const MIN_SECTION_ANSWERS = 3;

function createAnalyticsService(prisma, { now = () => new Date() } = {}) {
    const settings = createConfigurationService(prisma);
    const training = createTrainingService(prisma, { now });

    async function weights() {
        const [knowledge, qualification, threshold] = await Promise.all([
            settings.getNumber("ReadinessKnowledgeWeight"),
            settings.getNumber("ReadinessQualificationWeight"),
            settings.getNumber("CoverageThreshold")
        ]);
        return { knowledge, qualification, threshold };
    }

    // Active questions, grouped once and shared by every person's figures.
    async function bank() {
        const questions = await prisma.question.findMany({
            where: { active: true },
            select: { id: true, section: true, subject: { select: { code: true, subjectName: true } } }
        });
        const totals = new Map();
        for (const q of questions) {
            const code = q.subject?.code ?? "None";
            const entry = totals.get(code) ?? { code, name: q.subject?.subjectName ?? "No subject", total: 0 };
            entry.total += 1;
            totals.set(code, entry);
        }
        return { byId: new Map(questions.map((q) => [q.id, q])), totals };
    }

    async function qualificationScore(userId) {
        const at = now();
        const assignments = await prisma.userQualification.findMany({
            where: { userId, status: "ACTIVE", qualification: { hidden: false } },
            include: { qualification: { include: { requirements: true } } }
        });
        const items = [];
        for (const a of assignments) {
            let status;
            if (a.qualification.requirements.length > 0) {
                const result = await training.qualificationFor(userId, a.qualification.code);
                status = result.status === "NO_REQUIREMENTS" ? "CURRENT" : result.status;
            } else {
                status = calculateStatus(a.expirationDate, a.suspended ? "SUSPENDED" : "CURRENT", at);
                if (status === "EXPIRING_CRITICAL") status = "EXPIRING";
            }
            items.push({ code: a.qualification.code, name: a.qualification.name, status, counts: status === "CURRENT" || status === "EXPIRING" });
        }
        items.sort((x, y) => x.code.localeCompare(y.code));
        const current = items.filter((i) => i.counts).length;
        return { assigned: items.length, current, score: items.length ? percent(current, items.length) : null, items };
    }

    async function progressFor(userId, shared) {
        const { byId, totals } = shared.bank;
        const w = shared.weights;
        // Filter by person only (large id lists crash Prisma's SQLite engine).
        const answers = await prisma.quizAnswer.findMany({
            where: { session: { userId } }, select: { questionId: true, correct: true }, orderBy: { answeredAt: "asc" }
        });
        const last = new Map();
        for (const a of answers) if (byId.has(a.questionId)) last.set(a.questionId, a.correct);

        const subjects = new Map([...totals.values()].map((t) => [t.code, { ...t, seen: 0, right: 0 }]));
        const sections = new Map();
        for (const [id, correct] of last) {
            const q = byId.get(id);
            const code = q.subject?.code ?? "None";
            const s = subjects.get(code);
            s.seen += 1;
            if (correct) s.right += 1;
            const key = `${code}|${q.section || "General"}`;
            const sec = sections.get(key) ?? { subject: code, section: q.section || "General", answered: 0, right: 0 };
            sec.answered += 1;
            if (correct) sec.right += 1;
            sections.set(key, sec);
        }

        const subjectRows = [...subjects.values()].sort((a, b) => a.code.localeCompare(b.code)).map((s) => {
            const coverage = percent(s.seen, s.total);
            const visible = s.seen > 0 && coverage >= w.threshold;
            return { code: s.code, name: s.name, total: s.total, seen: s.seen, coverage, knowledgeVisible: visible, knowledge: visible ? percent(s.right, s.seen) : null };
        });
        const counted = subjectRows.filter((s) => s.knowledgeVisible);
        const countedSeen = counted.reduce((n, s) => n + s.seen, 0);
        const countedRight = [...subjects.values()].filter((s) => counted.some((c) => c.code === s.code)).reduce((n, s) => n + s.right, 0);
        const knowledge = counted.length ? percent(countedRight, countedSeen) : null;
        const totalQuestions = [...totals.values()].reduce((n, t) => n + t.total, 0);

        const qualifications = await qualificationScore(userId);
        let readiness = null;
        if (knowledge !== null) {
            readiness = qualifications.score === null
                ? knowledge
                : Math.round((knowledge * w.knowledge + qualifications.score * w.qualification) / 100);
        }

        const weakAreas = [...sections.values()]
            .filter((s) => s.answered >= MIN_SECTION_ANSWERS)
            .map((s) => ({ ...s, score: percent(s.right, s.answered) }))
            .filter((s) => s.score < 100)
            .sort((a, b) => a.score - b.score || b.answered - a.answered)
            .slice(0, 10);

        return {
            readiness,
            knowledge,
            coverage: percent(last.size, totalQuestions),
            seen: last.size,
            totalQuestions,
            qualifications,
            subjects: subjectRows,
            weakAreas
        };
    }

    async function shared() {
        const [b, w] = await Promise.all([bank(), weights()]);
        return { bank: b, weights: w };
    }

    // One person's progress. Managers may look at anyone.
    async function progress(viewerId, userId) {
        if (!viewerId) return fail("Authentication required");
        const target = userId || viewerId;
        const manager = await training.isManager(viewerId);
        if (target !== viewerId && !manager) return fail("You can only see your own progress.");
        const person = await prisma.user.findUnique({ where: { id: target }, select: { id: true, username: true, firstName: true, lastName: true } });
        if (!person) return fail("Person not found.");
        const s = await shared();
        return {
            success: true,
            canSeeOthers: manager,
            weights: s.weights,
            person: { id: person.id, username: person.username, name: `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() || person.username },
            ...(await progressFor(target, s))
        };
    }

    // Everyone's headline figures, for managers (RPT-ORG-001).
    async function everyone(viewerId) {
        if (!viewerId) return fail("Authentication required");
        if (!(await training.isManager(viewerId))) return fail("Only a manager can see everyone's progress.");
        const people = await prisma.user.findMany({
            where: { status: "ACTIVE" }, select: { id: true, username: true, firstName: true, lastName: true, userRoles: { select: { role: { select: { roleName: true } } } } },
            orderBy: { username: "asc" }
        });
        const s = await shared();
        const rows = [];
        for (const p of people) {
            const r = await progressFor(p.id, s);
            rows.push({
                id: p.id, username: p.username, name: `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.username,
                roles: p.userRoles.map((ur) => ur.role.roleName.replace(/_/g, " ")),
                readiness: r.readiness, knowledge: r.knowledge, coverage: r.coverage, qualificationScore: r.qualifications.score,
                qualificationsAssigned: r.qualifications.assigned
            });
        }
        return { success: true, weights: s.weights, people: rows };
    }

    return { progress, everyone };
}

module.exports = { createAnalyticsService };
