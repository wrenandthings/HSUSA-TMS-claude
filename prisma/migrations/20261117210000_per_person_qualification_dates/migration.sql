-- Moves qualification dates from the catalog (Qualification) to each
-- person's assignment (UserQualification), as the Prisma Schema spec and the
-- Qualification Rules Matrix require. Adds Permission, RolePermission, Backup,
-- and the actor and before/after fields on AuditLog.
-- Generated with `prisma migrate diff`, then the two INSERTs marked
-- "Hand-edited" were changed so existing data is kept.

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "permissionCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Backup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "backupName" TEXT NOT NULL,
    "fileLocation" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "sizeBytes" BIGINT NOT NULL,
    CONSTRAINT "Backup_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("action", "entity", "id", "timestamp") SELECT "action", "entity", "id", "timestamp" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");
CREATE TABLE "new_UserQualification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "revokedAt" DATETIME,
    "endReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "awardedDate" DATETIME,
    "expirationDate" DATETIME,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "UserQualification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserQualification_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "Qualification" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Hand-edited: each assignment takes the dates and suspension that used to
-- sit on its qualification, so nobody's current status changes.
INSERT INTO "new_UserQualification" ("id", "userId", "qualificationId", "assignedAt", "completedAt", "revokedAt", "endReason", "status", "awardedDate", "expirationDate", "suspended")
SELECT uq."id", uq."userId", uq."qualificationId", uq."assignedAt", uq."completedAt", uq."revokedAt", uq."endReason", uq."status",
       q."issuedAt", q."expiresAt", CASE WHEN q."status" = 'SUSPENDED' THEN true ELSE false END
FROM "UserQualification" uq JOIN "Qualification" q ON q."id" = uq."qualificationId";
DROP TABLE "UserQualification";
ALTER TABLE "new_UserQualification" RENAME TO "UserQualification";
CREATE INDEX "UserQualification_userId_idx" ON "UserQualification"("userId");
CREATE INDEX "UserQualification_qualificationId_idx" ON "UserQualification"("qualificationId");
CREATE INDEX "UserQualification_status_idx" ON "UserQualification"("status");
CREATE INDEX "UserQualification_expirationDate_idx" ON "UserQualification"("expirationDate");
CREATE TABLE "new_Qualification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "renewalMonths" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
-- Hand-edited: existing qualifications get a code made from their name
-- (upper case, spaces to underscores). If two names give the same code, the
-- later one gets part of its id added. Edit codes afterwards if needed.
INSERT INTO "new_Qualification" ("id", "code", "name", "description", "createdAt", "updatedAt")
SELECT q."id",
       UPPER(REPLACE(TRIM(q."name"), ' ', '_')) ||
       CASE WHEN EXISTS (SELECT 1 FROM "Qualification" e WHERE UPPER(REPLACE(TRIM(e."name"), ' ', '_')) = UPPER(REPLACE(TRIM(q."name"), ' ', '_')) AND e."id" < q."id")
            THEN '_' || SUBSTR(q."id", 1, 8) ELSE '' END,
       q."name", q."description", q."createdAt", q."updatedAt"
FROM "Qualification" q;
DROP TABLE "Qualification";
ALTER TABLE "new_Qualification" RENAME TO "Qualification";
CREATE UNIQUE INDEX "Qualification_code_key" ON "Qualification"("code");
CREATE UNIQUE INDEX "Qualification_name_key" ON "Qualification"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Permission_permissionCode_key" ON "Permission"("permissionCode");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

