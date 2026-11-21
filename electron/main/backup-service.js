// Database backups (owner decision, question 26: a backups folder next to the
// database, kept 90 days; Settings > Records > BackupRetentionDays).
//
// A backup is a consistent copy made with SQLite's VACUUM INTO, which is safe
// while the app is running. Each one is recorded in the Backup table and the
// backup log. Copies older than the retention period are deleted, from the
// folder and the table. Restore is part of Administration (Phase 10).
const fs = require("fs");
const path = require("path");
const { createConfigurationService } = require("./configuration-service");

const DAY = 24 * 60 * 60 * 1000;
const NAME = /^hsusa-tms-\d{8}-\d{6}\.db$/;

// DATABASE_URL "file:./dev.db" is relative to the prisma/ folder.
function databaseFile(url = process.env.DATABASE_URL, prismaDir = path.resolve(__dirname, "..", "..", "prisma")) {
    if (!url || !url.startsWith("file:")) throw new Error("Backups need a SQLite DATABASE_URL (file:...)");
    const file = url.slice("file:".length).split("?")[0];
    return path.isAbsolute(file) ? file : path.resolve(prismaDir, file);
}

function stamp(date) {
    const p = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

function createBackupService(prisma, { folder, logger, now = () => new Date() }) {
    const settings = createConfigurationService(prisma);

    async function backUp(actorId = null, reason = "manual") {
        fs.mkdirSync(folder, { recursive: true });
        const name = `hsusa-tms-${stamp(now())}.db`;
        const file = path.join(folder, name);
        if (fs.existsSync(file)) return { success: false, message: "A backup was made less than a second ago." };
        try {
            // VACUUM INTO takes a string literal; the path is ours, but quotes are escaped anyway.
            await prisma.$executeRawUnsafe(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
            const sizeBytes = BigInt(fs.statSync(file).size);
            const record = await prisma.backup.create({ data: { backupName: name, fileLocation: file, createdBy: actorId, sizeBytes } });
            await prisma.auditLog.create({ data: { userId: actorId, entity: "Backup", entityId: record.id, action: "BACKUP_CREATED", newValue: JSON.stringify({ name, reason }) } });
            logger?.backup("BACKUP_CREATED", { name, reason, sizeBytes: Number(sizeBytes), userId: actorId });
            const removed = await prune();
            return { success: true, message: `Backup saved: ${name}`, name, removed };
        } catch (error) {
            logger?.failure("BACKUP_FAILED", error, { name, reason });
            if (fs.existsSync(file)) fs.rmSync(file);
            return { success: false, message: `Backup failed: ${error instanceof Error ? error.message : String(error)}` };
        }
    }

    // Deletes backups older than BackupRetentionDays. Only files with the
    // backup name pattern are touched. Returns the names removed.
    async function prune() {
        const days = await settings.getNumber("BackupRetentionDays");
        const cutoff = now().getTime() - days * DAY;
        const removed = [];
        for (const record of await prisma.backup.findMany({ where: { createdAt: { lt: new Date(cutoff) } } })) {
            if (NAME.test(path.basename(record.fileLocation)) && fs.existsSync(record.fileLocation)) fs.rmSync(record.fileLocation);
            await prisma.backup.delete({ where: { id: record.id } });
            removed.push(record.backupName);
        }
        if (removed.length) logger?.backup("BACKUPS_REMOVED", { removed, retentionDays: days });
        return removed;
    }

    // At app start: back up if the newest backup is a day old or more.
    async function backUpIfDue() {
        const newest = await prisma.backup.findFirst({ orderBy: { createdAt: "desc" } });
        if (newest && now().getTime() - newest.createdAt.getTime() < DAY) return { success: true, skipped: true };
        return backUp(null, "daily");
    }

    async function list() {
        return (await prisma.backup.findMany({ orderBy: { createdAt: "desc" } }))
            .map((b) => ({ id: b.id, name: b.backupName, createdAt: b.createdAt, sizeBytes: Number(b.sizeBytes) }));
    }

    return { backUp, prune, backUpIfDue, list, folder };
}

module.exports = { createBackupService, databaseFile };
