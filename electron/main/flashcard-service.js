// Flashcards (Phase 5; UI spec FLASH-001 dashboard, FLASH-002 review).
// Modes: by subject or manual, weak areas, or a custom set made from the
// questions missed in a quiz. Each card is rated Know it, Unsure or Missed;
// those ratings drive Weak areas and the retention figures.
const { createConfigurationService } = require("./configuration-service");

const MODES = { SUBJECT: "Flashcards", WEAK_AREA: "Weak area flashcards", CUSTOM: "Missed quiz questions" };
const STATES = ["KNOW_IT", "UNSURE", "MISSED"];
const LETTERS = ["A", "B", "C", "D"];
const fail = (message) => ({ success: false, message });

function shuffled(list, random) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// The back of a card: the correct option's text, or a written answer.
function answerOf(q) {
    if (LETTERS.includes(q.correctAnswer) && q[`answer${q.correctAnswer}`]) return q[`answer${q.correctAnswer}`];
    return q.answer || null;
}

function createFlashcardService(prisma, { random = Math.random, now = () => new Date() } = {}) {
    const settings = createConfigurationService(prisma);

    // Questions that can be a card: active, with an answer to show.
    async function pool({ subjectId, documentId, ids } = {}) {
        const questions = await prisma.question.findMany({
            where: {
                active: true,
                ...(subjectId ? { subjectId } : {}),
                ...(documentId ? { documentId } : {}),
                ...(ids ? { id: { in: ids } } : {})
            },
            select: { id: true, correctAnswer: true, answer: true, answerA: true, answerB: true, answerC: true, answerD: true }
        });
        return questions.filter((q) => answerOf(q)).map((q) => q.id);
    }

    // The latest rating for each question this person has reviewed.
    async function latest(userId, ids) {
        const rows = await prisma.flashcardHistory.findMany({
            where: { userId, ...(ids ? { questionId: { in: ids } } : {}) },
            select: { questionId: true, status: true, reviewedAt: true },
            orderBy: { reviewedAt: "asc" }
        });
        const map = new Map();
        for (const r of rows) map.set(r.questionId, r);
        return map;
    }

    async function options() {
        const count = await settings.getNumber("FlashcardCount");
        return { success: true, cardCount: count };
    }

    async function start(userId, input = {}) {
        if (!userId) return fail("Authentication required");
        const mode = MODES[input.mode] ? input.mode : "SUBJECT";
        const wanted = Number(input.count) || (await settings.getNumber("FlashcardCount"));
        if (!Number.isInteger(wanted) || wanted < 1 || wanted > 200) return fail("Choose from 1 to 200 cards.");
        let ids;
        let name = MODES[mode];
        let note = "";

        if (mode === "CUSTOM") {
            const quiz = await prisma.quizSession.findUnique({ where: { id: String(input.quizSessionId ?? "") }, include: { answers: true } });
            if (!quiz || quiz.userId !== userId) return fail("Quiz not found.");
            const missed = quiz.answers.filter((a) => !a.correct).map((a) => a.questionId);
            ids = shuffled(await pool({ ids: missed }), random);
            if (ids.length === 0) return fail("This quiz has no missed questions to make cards from.");
            name = `Missed in ${quiz.name}`;
        } else {
            const candidates = await pool({ subjectId: input.subjectId || undefined, documentId: input.documentId || undefined });
            if (candidates.length === 0) return fail("No questions match this choice.");
            const last = await latest(userId, candidates);
            if (mode === "WEAK_AREA") {
                // Cards last rated Missed or Unsure, and questions last answered wrong in a quiz.
                const quizAnswers = await prisma.quizAnswer.findMany({
                    where: { questionId: { in: candidates }, session: { userId } },
                    select: { questionId: true, correct: true }, orderBy: { answeredAt: "asc" }
                });
                const quizLast = new Map();
                for (const a of quizAnswers) quizLast.set(a.questionId, a.correct);
                const rank = (id) => {
                    const s = last.get(id)?.status;
                    if (s === "MISSED") return 0;
                    if (s === "UNSURE") return 1;
                    if (!s && quizLast.get(id) === false) return 2;
                    return null;
                };
                const weak = candidates.filter((id) => rank(id) !== null);
                if (weak.length === 0) return fail("No weak areas yet: nothing rated Missed or Unsure, and no quiz questions missed in this choice.");
                ids = [0, 1, 2].flatMap((r) => shuffled(weak.filter((id) => rank(id) === r), random));
            } else {
                // Missed first, then Unsure, then never seen, then Know it (oldest first).
                const groups = [[], [], [], []];
                for (const id of candidates) {
                    const s = last.get(id)?.status;
                    groups[s === "MISSED" ? 0 : s === "UNSURE" ? 1 : !s ? 2 : 3].push(id);
                }
                const known = groups[3].sort((a, b) => last.get(a).reviewedAt - last.get(b).reviewedAt);
                ids = [...shuffled(groups[0], random), ...shuffled(groups[1], random), ...shuffled(groups[2], random), ...known];
            }
            const [subject, document] = await Promise.all([
                input.subjectId ? prisma.subject.findUnique({ where: { id: input.subjectId } }) : null,
                input.documentId ? prisma.document.findUnique({ where: { id: input.documentId } }) : null
            ]);
            const scope = [subject?.code, document?.code].filter(Boolean).join(" · ");
            if (scope) name = `${name}: ${scope}`;
        }

        if (ids.length < wanted) note = `${ids.length === 1 ? "Only 1 card matches" : `Only ${ids.length} cards match`}, so this set has ${ids.length}.`;
        ids = ids.slice(0, wanted);
        const session = await prisma.flashcardSession.create({
            data: { userId, mode, name, subjectId: input.subjectId || null, documentId: input.documentId || null, questionIds: JSON.stringify(ids), startedAt: now() }
        });
        return { success: true, sessionId: session.id, note };
    }

    async function get(userId, sessionId) {
        const session = await prisma.flashcardSession.findUnique({ where: { id: String(sessionId ?? "") }, include: { history: true } });
        if (!session || session.userId !== userId) return fail("Flashcards not found.");
        const ids = JSON.parse(session.questionIds);
        const questions = await prisma.question.findMany({
            where: { id: { in: ids } },
            include: { subject: { select: { code: true } }, document: { select: { code: true } } }
        });
        const byId = new Map(questions.map((q) => [q.id, q]));
        const rated = new Map(session.history.map((h) => [h.questionId, h.status]));
        const cards = ids.filter((id) => byId.has(id)).map((id, index) => {
            const q = byId.get(id);
            return {
                position: index + 1, questionId: id, externalId: q.externalId, front: q.questionText, back: answerOf(q),
                reference: q.reference, subject: q.subject?.code ?? null, document: q.document?.code ?? null, rating: rated.get(id) ?? null
            };
        });
        return { success: true, session: { id: session.id, name: session.name, mode: session.mode, completed: Boolean(session.completedAt), cards, counts: tally(cards.map((c) => c.rating)) } };
    }

    function tally(ratings) {
        const counts = { KNOW_IT: 0, UNSURE: 0, MISSED: 0, left: 0 };
        for (const r of ratings) { if (r) counts[r] += 1; else counts.left += 1; }
        return counts;
    }

    // One rating per card per session; rating a card again replaces it.
    async function rate(userId, sessionId, questionId, status) {
        if (!STATES.includes(status)) return fail("Unknown rating.");
        const session = await prisma.flashcardSession.findUnique({ where: { id: String(sessionId ?? "") } });
        if (!session || session.userId !== userId) return fail("Flashcards not found.");
        const ids = JSON.parse(session.questionIds);
        if (!ids.includes(questionId)) return fail("That card is not in this set.");
        const at = now();
        await prisma.$transaction([
            prisma.flashcardHistory.deleteMany({ where: { sessionId: session.id, questionId } }),
            prisma.flashcardHistory.create({ data: { userId, questionId, sessionId: session.id, status, reviewedAt: at } })
        ]);
        const done = await prisma.flashcardHistory.count({ where: { sessionId: session.id } });
        if (done >= ids.length && !session.completedAt) {
            await prisma.flashcardSession.update({ where: { id: session.id }, data: { completedAt: at } });
        }
        return { success: true, completed: done >= ids.length };
    }

    async function history(userId, limit = 30) {
        const sessions = await prisma.flashcardSession.findMany({
            where: { userId }, include: { history: { select: { status: true } } }, orderBy: { startedAt: "desc" }, take: limit
        });
        return {
            success: true,
            sessions: sessions.map((s) => {
                const total = JSON.parse(s.questionIds).length;
                const counts = tally(s.history.map((h) => h.status));
                return { id: s.id, name: s.name, startedAt: s.startedAt, completedAt: s.completedAt, total, ...counts, left: total - s.history.length };
            })
        };
    }

    // Retention: for each subject, the share of reviewed cards whose latest
    // rating is Know it.
    async function retention(userId) {
        const last = await latest(userId);
        if (last.size === 0) return { success: true, subjects: [], overall: null };
        const questions = await prisma.question.findMany({
            where: { id: { in: [...last.keys()] } }, select: { id: true, subject: { select: { code: true, subjectName: true } } }
        });
        const rows = new Map();
        const add = (key, label, status) => {
            const row = rows.get(key) ?? { code: key, name: label, reviewed: 0, KNOW_IT: 0, UNSURE: 0, MISSED: 0 };
            row.reviewed += 1;
            row[status] += 1;
            rows.set(key, row);
        };
        for (const q of questions) add(q.subject?.code ?? "None", q.subject?.subjectName ?? "No subject", last.get(q.id).status);
        const subjects = [...rows.values()].map((r) => ({ ...r, knowPercent: Math.round((r.KNOW_IT / r.reviewed) * 100) })).sort((a, b) => a.code.localeCompare(b.code));
        const known = subjects.reduce((n, r) => n + r.KNOW_IT, 0);
        const reviewed = subjects.reduce((n, r) => n + r.reviewed, 0);
        return { success: true, subjects, overall: { reviewed, knowPercent: Math.round((known / reviewed) * 100) } };
    }

    return { options, start, get, rate, history, retention };
}

module.exports = { createFlashcardService, answerOf };
