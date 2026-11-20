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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("answer", "category", "createdAt", "difficulty", "id", "questionText", "updatedAt") SELECT "answer", "category", "createdAt", "difficulty", "id", "questionText", "updatedAt" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE UNIQUE INDEX "Question_externalId_key" ON "Question"("externalId");
CREATE INDEX "Question_subjectId_idx" ON "Question"("subjectId");
CREATE TABLE "new_Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
-- Existing subjects get a code made from their name (upper case, spaces as
-- underscores). A second subject with the same name gets part of its id added
-- so codes stay unique. Edited by hand after prisma migrate diff.
INSERT INTO "new_Subject" ("code", "createdAt", "description", "id", "subjectName", "updatedAt")
SELECT
    upper(replace(trim("subjectName"), ' ', '_')) ||
        CASE WHEN EXISTS (
            SELECT 1 FROM "Subject" AS earlier
            WHERE upper(trim(earlier."subjectName")) = upper(trim("Subject"."subjectName"))
              AND earlier."id" < "Subject"."id"
        ) THEN '_' || substr("id", 1, 8) ELSE '' END,
    "createdAt", "description", "id", "subjectName", "updatedAt"
FROM "Subject";
DROP TABLE "Subject";
ALTER TABLE "new_Subject" RENAME TO "Subject";
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

