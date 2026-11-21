-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "questionText" TEXT NOT NULL,
    "answerA" TEXT,
    "answerB" TEXT,
    "answerC" TEXT,
    "answerD" TEXT,
    "correctAnswer" TEXT,
    "reference" TEXT,
    "category" TEXT,
    "section" TEXT,
    "difficulty" TEXT,
    "sourceRevision" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "answer" TEXT,
    "subjectId" TEXT,
    "documentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Question_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("active", "answer", "answerA", "answerB", "answerC", "answerD", "category", "correctAnswer", "createdAt", "difficulty", "externalId", "id", "questionText", "reference", "section", "sourceRevision", "subjectId", "updatedAt") SELECT "active", "answer", "answerA", "answerB", "answerC", "answerD", "category", "correctAnswer", "createdAt", "difficulty", "externalId", "id", "questionText", "reference", "section", "sourceRevision", "subjectId", "updatedAt" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE UNIQUE INDEX "Question_externalId_key" ON "Question"("externalId");
CREATE INDEX "Question_subjectId_idx" ON "Question"("subjectId");
CREATE INDEX "Question_documentId_idx" ON "Question"("documentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

