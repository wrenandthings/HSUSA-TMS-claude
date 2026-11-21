// Question-bank CSV import, in the format agreed with Quail on 2026-11-19
// (wren-sandbox commons/direct/finch-quail.md):
//
//   questionId, questionText, answerA, answerB, answerC, answerD,
//   correctAnswer, answer, document, reference, category, subject, section,
//   difficulty, sourceRevision, active
//
// - questionId becomes Question.externalId, so importing the same file again
//   updates the questions instead of adding copies.
// - correctAnswer (A-D) is the source of truth. answer is only a check: a row
//   whose answer does not match the option correctAnswer points to is refused.
// - subject may be a subject code (MAINT) or a subject name (Maintenance).
// - document (added 2026-11-20) is the source manual's code, such as OM-A or
//   AMPI, and must match a Document. The column is optional, so older files
//   still import; a blank value leaves the question without a document.
// - The IMP-QBANK-001 header names (Question, AnswerA ... CorrectAnswer,
//   Reference) are accepted too.
// - Nothing is imported if any row has a problem, so a file never half-loads.

const HEADER_ALIASES = {
    questionid: "questionId",
    externalid: "questionId",
    questiontext: "questionText",
    question: "questionText",
    answera: "answerA",
    answerb: "answerB",
    answerc: "answerC",
    answerd: "answerD",
    correctanswer: "correctAnswer",
    answer: "answer",
    document: "document",
    sourcedocument: "document",
    reference: "reference",
    category: "category",
    subject: "subject",
    section: "section",
    difficulty: "difficulty",
    sourcerevision: "sourceRevision",
    active: "active"
};

const REQUIRED_COLUMNS = ["questionId", "questionText", "answerA", "answerB", "answerC", "answerD", "correctAnswer", "reference", "subject"];
const LETTERS = ["A", "B", "C", "D"];

// Splits CSV text into rows of fields. Handles quoted fields, doubled quotes,
// commas and line breaks inside quotes, CRLF line endings, and a leading BOM.
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    const source = String(text).replace(/^﻿/, "");

    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        if (quoted) {
            if (ch === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
            else if (ch === '"') quoted = false;
            else field += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ",") { row.push(field); field = ""; }
        else if (ch === "\n" || ch === "\r") {
            if (ch === "\r" && source[i + 1] === "\n") i += 1;
            row.push(field); rows.push(row); row = []; field = "";
        } else field += ch;
    }
    if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((value) => value.trim() !== ""));
}

function parseActive(value) {
    const text = String(value ?? "").trim().toLowerCase();
    if (text === "" || text === "yes" || text === "true" || text === "y" || text === "1") return true;
    if (text === "no" || text === "false" || text === "n" || text === "0") return false;
    return null;
}

const same = (a, b) => String(a).trim().replace(/\s+/g, " ").toLowerCase() === String(b).trim().replace(/\s+/g, " ").toLowerCase();

// Returns { rows, errors }. Each row is ready to store except for the subject,
// which is still the text from the file (resolved against the database later).
function parseQuestionBankCsv(text) {
    const table = parseCsv(text);
    if (table.length === 0) return { rows: [], errors: ["The file is empty."] };

    const columns = table[0].map((header) => HEADER_ALIASES[header.trim().toLowerCase().replace(/[\s_-]/g, "")] ?? null);
    const missing = REQUIRED_COLUMNS.filter((name) => !columns.includes(name));
    if (missing.length > 0) {
        return { rows: [], errors: [`The file is missing these columns: ${missing.join(", ")}.`] };
    }

    const rows = [];
    const errors = [];
    const seenIds = new Map();

    table.slice(1).forEach((values, offset) => {
        const line = offset + 2;
        const raw = {};
        columns.forEach((name, index) => { if (name) raw[name] = (values[index] ?? "").trim(); });
        const problems = [];
        const id = raw.questionId;

        if (!id) problems.push("questionId is empty");
        else if (seenIds.has(id)) problems.push(`questionId ${id} is also on row ${seenIds.get(id)}`);
        else seenIds.set(id, line);
        if (!raw.questionText) problems.push("questionText is empty");
        for (const letter of LETTERS) if (!raw[`answer${letter}`]) problems.push(`answer${letter} is empty`);

        const correct = (raw.correctAnswer ?? "").toUpperCase();
        if (!LETTERS.includes(correct)) problems.push(`correctAnswer must be A, B, C or D (found "${raw.correctAnswer ?? ""}")`);
        else if (raw.answer && raw[`answer${correct}`] && !same(raw.answer, raw[`answer${correct}`])) {
            problems.push(`answer does not match answer${correct}`);
        }
        if (!raw.reference) problems.push("reference is empty");
        if (!raw.subject) problems.push("subject is empty");
        const active = parseActive(raw.active);
        if (active === null) problems.push(`active must be Yes or No (found "${raw.active}")`);

        if (problems.length > 0) {
            errors.push(`Row ${line}${id ? ` (${id})` : ""}: ${problems.join("; ")}.`);
            return;
        }
        rows.push({
            line,
            externalId: id,
            questionText: raw.questionText,
            answerA: raw.answerA,
            answerB: raw.answerB,
            answerC: raw.answerC,
            answerD: raw.answerD,
            correctAnswer: correct,
            reference: raw.reference,
            category: raw.category || null,
            section: raw.section || null,
            difficulty: raw.difficulty || null,
            sourceRevision: raw.sourceRevision || null,
            active,
            subject: raw.subject,
            document: raw.document || null
        });
    });

    return { rows, errors };
}

function createQuestionBankImporter(prisma) {
    // Checks the file against the database. With dryRun nothing is written.
    // Returns { success, created, updated, errors, message }.
    async function importCsv(text, { actorId = null, dryRun = false } = {}) {
        const { rows, errors } = parseQuestionBankCsv(text);

        const subjects = await prisma.subject.findMany();
        const subjectFor = (value) => subjects.find((s) => same(s.code, value)) ?? subjects.find((s) => same(s.subjectName, value));
        const documents = await prisma.document.findMany();
        const documentFor = (value) => documents.find((d) => same(d.code, value));
        for (const row of rows) {
            if (!subjectFor(row.subject)) errors.push(`Row ${row.line} (${row.externalId}): no subject has the code or name "${row.subject}".`);
            if (row.document && !documentFor(row.document)) errors.push(`Row ${row.line} (${row.externalId}): no document has the code "${row.document}".`);
        }

        const existing = new Set((await prisma.question.findMany({
            where: { externalId: { in: rows.map((row) => row.externalId) } },
            select: { externalId: true }
        })).map((q) => q.externalId));
        const updated = rows.filter((row) => existing.has(row.externalId)).length;
        const created = rows.length - updated;

        if (errors.length > 0) {
            return { success: false, created: 0, updated: 0, errors, message: `Nothing was imported. ${errors.length} row${errors.length === 1 ? " has a problem" : "s have problems"}.` };
        }
        if (rows.length === 0) return { success: false, created: 0, updated: 0, errors: ["The file has no questions."], message: "Nothing was imported." };
        if (dryRun) return { success: true, created, updated, errors: [], message: `Ready to import: ${created} new, ${updated} updated.` };

        const writes = rows.map(({ line, subject, document, ...data }) => {
            const fields = { ...data, subjectId: subjectFor(subject).id, documentId: document ? documentFor(document).id : null };
            return prisma.question.upsert({ where: { externalId: data.externalId }, create: fields, update: fields });
        });
        writes.push(prisma.auditLog.create({
            data: { userId: actorId, entity: "Question", action: "QUESTIONS_IMPORTED", newValue: JSON.stringify({ created, updated, firstId: rows[0].externalId, lastId: rows[rows.length - 1].externalId }) }
        }));
        await prisma.$transaction(writes);
        return { success: true, created, updated, errors: [], message: `Imported ${created} new and updated ${updated} questions.` };
    }

    return { importCsv };
}

module.exports = { parseCsv, parseQuestionBankCsv, createQuestionBankImporter };
