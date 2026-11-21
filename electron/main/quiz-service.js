// Quiz engine (Phase 4): Random, Weak Area, Unseen and Certification quizzes
// over the one question pool, filtered by subject and/or source manual.
//
// Practice quizzes (Random, Weak Area, Unseen) show right or wrong and the
// manual reference as soon as a question is answered; that answer is final.
// Certification quizzes show nothing until submitted, and answers can be
// changed until then. Answer options are shuffled per quiz (owner decision)
// and the order is stored, so a review shows what the person saw.
const { createConfigurationService } = require("./configuration-service");

const LETTERS = ["A", "B", "C", "D"];
const TYPES = {
    RANDOM: "Random quiz",
    WEAK_AREA: "Weak area quiz",
    UNSEEN: "Unseen questions quiz",
    CERTIFICATION: "Certification quiz"
};

function shuffled(list, random) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

const fail = (message) => ({ success: false, message });

function createQuizService(prisma, { random = Math.random, now = () => new Date() } = {}) {
    const settings = createConfigurationService(prisma);

    // Questions a quiz may use: active, in the bank's four-option format.
    async function pool({ subjectId, documentId }) {
        return prisma.question.findMany({
            where: {
                active: true,
                correctAnswer: { in: LETTERS },
                answerA: { not: null }, answerB: { not: null }, answerC: { not: null }, answerD: { not: null },
                ...(subjectId ? { subjectId } : {}),
                ...(documentId ? { documentId } : {})
            },
            select: { id: true }
        });
    }

    // Subjects and manuals that have quiz-ready questions, with counts.
    async function options() {
        const questions = await prisma.question.findMany({
            where: { active: true, correctAnswer: { in: LETTERS } },
            select: { subject: { select: { id: true, code: true, subjectName: true } }, document: { select: { id: true, code: true, title: true } } }
        });
        const count = (key, pick) => {
            const map = new Map();
            for (const q of questions) {
                const item = pick(q);
                if (!item) continue;
                const entry = map.get(item.id) ?? { ...item, questionCount: 0 };
                entry.questionCount += 1;
                map.set(item.id, entry);
            }
            return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
        };
        return {
            subjects: count("subject", (q) => q.subject),
            documents: count("document", (q) => q.document),
            total: questions.length,
            questionCount: await settings.getNumber("QuizQuestionCount"),
            certificationQuestionCount: await settings.getNumber("CertificationQuestionCount"),
            passMarkPercent: await settings.getNumber("QuizPassMarkPercent")
        };
    }

    // Picks question ids for a quiz type. Returns [ids, problem].
    async function choose(userId, type, candidates, count) {
        const ids = candidates.map((q) => q.id);
        if (type === "RANDOM" || type === "CERTIFICATION") return [shuffled(ids, random).slice(0, count), null];

        const answers = await prisma.quizAnswer.findMany({
            where: { questionId: { in: ids }, session: { userId } },
            select: { questionId: true, correct: true, answeredAt: true },
            orderBy: { answeredAt: "asc" }
        });

        if (type === "UNSEEN") {
            const seen = new Set(answers.map((a) => a.questionId));
            const unseen = ids.filter((id) => !seen.has(id));
            if (unseen.length === 0) return [[], "You have answered every question in this selection at least once. Try a Random or Weak Area quiz."];
            return [shuffled(unseen, random).slice(0, count), null];
        }

        // WEAK_AREA: questions missed at least once, last answer wrong first,
        // then the lowest share answered correctly, then the most misses.
        const stats = new Map();
        for (const a of answers) {
            const s = stats.get(a.questionId) ?? { wrong: 0, total: 0, lastCorrect: true };
            s.total += 1;
            if (!a.correct) s.wrong += 1;
            s.lastCorrect = a.correct;
            stats.set(a.questionId, s);
        }
        const weak = [...stats.entries()].filter(([, s]) => s.wrong > 0);
        if (weak.length === 0) return [[], "No weak areas yet: you have not missed any questions in this selection."];
        weak.sort(([, a], [, b]) =>
            Number(a.lastCorrect) - Number(b.lastCorrect) ||
            (1 - a.wrong / a.total) - (1 - b.wrong / b.total) ||
            b.wrong - a.wrong);
        // Shuffle the chosen set so the order is not always the same.
        return [shuffled(weak.slice(0, count).map(([id]) => id), random), null];
    }

    async function start(userId, input = {}) {
        if (!userId) return fail("Authentication required");
        const type = String(input.type ?? "").toUpperCase();
        if (!TYPES[type]) return fail("Choose a quiz type.");

        const subject = input.subjectId ? await prisma.subject.findUnique({ where: { id: input.subjectId } }) : null;
        if (input.subjectId && !subject) return fail("That subject no longer exists.");
        const document = input.documentId ? await prisma.document.findUnique({ where: { id: input.documentId } }) : null;
        if (input.documentId && !document) return fail("That manual no longer exists.");

        const defaultCount = await settings.getNumber(type === "CERTIFICATION" ? "CertificationQuestionCount" : "QuizQuestionCount");
        const asked = type === "CERTIFICATION" ? defaultCount : Number(input.count ?? defaultCount);
        if (!Number.isInteger(asked) || asked < 1 || asked > 200) return fail("Choose between 1 and 200 questions.");

        const candidates = await pool({ subjectId: subject?.id, documentId: document?.id });
        if (candidates.length === 0) return fail("No questions match that selection.");
        const [questionIds, problem] = await choose(userId, type, candidates, asked);
        if (problem) return fail(problem);

        const scope = [subject?.code, document?.code].filter(Boolean).join(" · ") || "All questions";
        const session = await prisma.quizSession.create({
            data: {
                userId,
                quizType: type,
                name: `${TYPES[type]} · ${scope}`,
                subjectId: subject?.id ?? null,
                documentId: document?.id ?? null,
                startedAt: now(),
                passMarkPercent: await settings.getNumber("QuizPassMarkPercent"),
                questionCount: questionIds.length,
                questions: {
                    create: questionIds.map((questionId, index) => ({
                        questionId, displayOrder: index + 1, answerOrder: shuffled(LETTERS, random).join("")
                    }))
                }
            }
        });
        const note = questionIds.length < asked ? `Only ${questionIds.length} questions match, so this quiz has ${questionIds.length}.` : null;
        return { success: true, sessionId: session.id, note };
    }

    async function load(userId, sessionId) {
        const session = await prisma.quizSession.findUnique({
            where: { id: String(sessionId ?? "") },
            include: {
                questions: { orderBy: { displayOrder: "asc" }, include: { question: { include: { document: true, subject: true } } } },
                answers: true
            }
        });
        if (!session || session.userId !== userId) return null;
        return session;
    }

    // What the screen shows. Correct answers and references appear only for
    // answered practice questions, or for every question once completed.
    function view(session) {
        const practice = session.quizType !== "CERTIFICATION";
        const completed = Boolean(session.completedAt);
        const answers = new Map(session.answers.map((a) => [a.questionId, a]));
        return {
            id: session.id,
            name: session.name,
            type: session.quizType,
            practice,
            completed,
            startedAt: session.startedAt,
            completedAt: session.completedAt,
            passMarkPercent: session.passMarkPercent,
            scorePercent: session.scorePercent,
            passed: session.passed,
            questionCount: session.questionCount,
            answeredCount: session.answers.length,
            correctCount: session.answers.filter((a) => a.correct).length,
            items: session.questions.map((qq) => {
                const q = qq.question;
                const answer = answers.get(q.id);
                const reveal = completed || (practice && Boolean(answer));
                return {
                    position: qq.displayOrder,
                    questionId: q.id,
                    externalId: q.externalId,
                    text: q.questionText,
                    flagged: qq.flagged,
                    // label = the letter shown on screen; value = the question's own letter.
                    options: qq.answerOrder.split("").map((letter, index) => ({ label: LETTERS[index], value: letter, text: q[`answer${letter}`] })),
                    selected: answer?.selectedAnswer ?? null,
                    correct: reveal && answer ? answer.correct : null,
                    correctAnswer: reveal ? q.correctAnswer : null,
                    reference: reveal ? q.reference : null,
                    document: q.document?.code ?? null,
                    subject: q.subject?.code ?? null
                };
            })
        };
    }

    async function get(userId, sessionId) {
        const session = await load(userId, sessionId);
        return session ? { success: true, quiz: view(session) } : fail("Quiz not found.");
    }

    async function answer(userId, sessionId, questionId, selected) {
        const session = await load(userId, sessionId);
        if (!session) return fail("Quiz not found.");
        if (session.completedAt) return fail("This quiz is already finished.");
        const item = session.questions.find((qq) => qq.questionId === questionId);
        if (!item) return fail("That question is not in this quiz.");
        const letter = String(selected ?? "").toUpperCase();
        if (!LETTERS.includes(letter)) return fail("Choose one of the answers.");
        const practice = session.quizType !== "CERTIFICATION";
        if (practice && session.answers.some((a) => a.questionId === questionId)) return fail("This question is already answered.");

        const correct = letter === item.question.correctAnswer;
        await prisma.quizAnswer.upsert({
            where: { quizSessionId_questionId: { quizSessionId: session.id, questionId } },
            create: { quizSessionId: session.id, questionId, selectedAnswer: letter, correct, answeredAt: now() },
            update: { selectedAnswer: letter, correct, answeredAt: now() }
        });
        return get(userId, sessionId);
    }

    async function flag(userId, sessionId, questionId, flagged) {
        const session = await load(userId, sessionId);
        if (!session) return fail("Quiz not found.");
        const item = session.questions.find((qq) => qq.questionId === questionId);
        if (!item) return fail("That question is not in this quiz.");
        await prisma.quizQuestion.update({ where: { id: item.id }, data: { flagged: Boolean(flagged) } });
        return get(userId, sessionId);
    }

    // Unanswered questions count as wrong.
    async function finish(userId, sessionId) {
        const session = await load(userId, sessionId);
        if (!session) return fail("Quiz not found.");
        if (session.completedAt) return get(userId, sessionId);
        const correct = session.answers.filter((a) => a.correct).length;
        const scorePercent = Math.round((correct / session.questionCount) * 1000) / 10;
        const passed = scorePercent >= session.passMarkPercent;
        await prisma.$transaction([
            prisma.quizSession.update({ where: { id: session.id }, data: { completedAt: now(), scorePercent, passed } }),
            prisma.auditLog.create({
                data: { userId, entity: "QuizSession", entityId: session.id, action: "QUIZ_COMPLETED", newValue: JSON.stringify({ type: session.quizType, name: session.name, scorePercent, passed }) }
            })
        ]);
        return get(userId, sessionId);
    }

    async function history(userId, limit = 50) {
        const sessions = await prisma.quizSession.findMany({
            where: { userId },
            orderBy: { startedAt: "desc" },
            take: limit,
            include: { _count: { select: { answers: true } } }
        });
        return sessions.map((s) => ({
            id: s.id, name: s.name, type: s.quizType, startedAt: s.startedAt, completedAt: s.completedAt,
            scorePercent: s.scorePercent, passed: s.passed, passMarkPercent: s.passMarkPercent,
            questionCount: s.questionCount, answeredCount: s._count.answers
        }));
    }

    return { options, start, get, answer, flag, finish, history };
}

module.exports = { createQuizService, QUIZ_TYPES: TYPES };
