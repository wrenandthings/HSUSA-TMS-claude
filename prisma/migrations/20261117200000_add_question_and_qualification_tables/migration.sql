-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionText" TEXT NOT NULL,
    "category" TEXT,
    "difficulty" TEXT,
    "answer" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Qualification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CURRENT',
    "issuedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserQualification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "revokedAt" DATETIME,
    "endReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "UserQualification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserQualification_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "Qualification" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Qualification_name_key" ON "Qualification"("name");

-- CreateIndex
CREATE INDEX "Qualification_status_idx" ON "Qualification"("status");

-- CreateIndex
CREATE INDEX "Qualification_expiresAt_idx" ON "Qualification"("expiresAt");

-- CreateIndex
CREATE INDEX "UserQualification_userId_idx" ON "UserQualification"("userId");

-- CreateIndex
CREATE INDEX "UserQualification_qualificationId_idx" ON "UserQualification"("qualificationId");

-- CreateIndex
CREATE INDEX "UserQualification_status_idx" ON "UserQualification"("status");

