const { ipcMain } = require("electron");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Subjects have a short code (MAINT) and a name (Maintenance); owner question
// 15. Codes are stored in upper case with underscores, as in the seed data.
function cleanCode(code) {
    return String(code ?? "").trim().toUpperCase().replace(/\s+/g, "_");
}

function problemWith(subject) {
    const code = cleanCode(subject?.code);
    if (!code) return "Subject code is required.";
    if (!/^[A-Z0-9_-]+$/.test(code)) return "Subject code may only use letters, numbers, - and _.";
    if (!String(subject?.subjectName ?? "").trim()) return "Subject name is required.";
    return null;
}

async function duplicateOf(subject, exceptId) {
    const existing = await prisma.subject.findFirst({
        where: {
            OR: [{ code: cleanCode(subject.code) }, { subjectName: String(subject.subjectName).trim() }],
            ...(exceptId ? { NOT: { id: exceptId } } : {})
        }
    });
    return existing ? "A subject with that code or name already exists." : null;
}

function registerSubjectHandlers() {
    ipcMain.handle("subjects-get-all", async () =>
        prisma.subject.findMany({ orderBy: { subjectName: "asc" } })
    );

    ipcMain.handle("subjects-get-by-id", async (event, subjectId) =>
        prisma.subject.findUnique({ where: { id: subjectId } })
    );

    ipcMain.handle("subjects-create", async (event, subject) => {
        const problem = problemWith(subject) ?? await duplicateOf(subject);
        if (problem) return { success: false, message: problem };
        const createdSubject = await prisma.subject.create({
            data: {
                code: cleanCode(subject.code),
                subjectName: subject.subjectName.trim(),
                description: subject.description || null
            }
        });
        return { success: true, message: "Subject created", subject: createdSubject };
    });

    ipcMain.handle("subjects-update", async (event, subject) => {
        const problem = problemWith(subject) ?? await duplicateOf(subject, subject.id);
        if (problem) return { success: false, message: problem };
        const updatedSubject = await prisma.subject.update({
            where: { id: subject.id },
            data: {
                code: cleanCode(subject.code),
                subjectName: subject.subjectName.trim(),
                description: subject.description || null
            }
        });
        return { success: true, subject: updatedSubject };
    });

    // Questions in a deleted subject are kept; their subject is cleared.
    ipcMain.handle("subjects-delete", async (event, subjectId) => {
        await prisma.subject.delete({ where: { id: subjectId } });
        return { success: true };
    });
}

module.exports = { registerSubjectHandlers, cleanCode };
