-- CreateTable
CREATE TABLE "QualificationRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "qualificationId" TEXT NOT NULL,
    "requirementType" TEXT NOT NULL,
    "requirementRef" TEXT NOT NULL,
    CONSTRAINT "QualificationRequirement_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "Qualification" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingProgram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "renewalMonths" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserTrainingRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "completionDate" DATETIME NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'PASS',
    "instructorName" TEXT,
    "notes" TEXT,
    "approval" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    CONSTRAINT "UserTrainingRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserTrainingRecord_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserTrainingRecord_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "QualificationRequirement_qualificationId_requirementType_requirementRef_key" ON "QualificationRequirement"("qualificationId", "requirementType", "requirementRef");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingProgram_code_key" ON "TrainingProgram"("code");

-- CreateIndex
CREATE INDEX "UserTrainingRecord_userId_programId_idx" ON "UserTrainingRecord"("userId", "programId");

-- CreateIndex
CREATE INDEX "UserTrainingRecord_approval_idx" ON "UserTrainingRecord"("approval");

