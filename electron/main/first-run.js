// Setting up the database of an installed copy (no Prisma command-line tools
// there). On each start: apply any new migrations, recorded in Prisma's own
// _prisma_migrations table so `prisma migrate` would agree; after a new
// migration, run the seed (safe to repeat); and import each bundled question
// bank whose file is new or changed since it was last imported, so testers
// get Quail's new banks with each new installer. A changed file updates its
// questions by questionId (the importer's rule), so an edit made in the app to
// one of those questions is replaced when its bank file changes.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

async function appliedMigrations(prisma) {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" TEXT PRIMARY KEY NOT NULL, "checksum" TEXT NOT NULL, "finished_at" DATETIME, "migration_name" TEXT NOT NULL,
        "logs" TEXT, "rolled_back_at" DATETIME, "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
        "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0)`);
    const rows = await prisma.$queryRawUnsafe(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`);
    return new Set(rows.map((r) => r.migration_name));
}

// Splits a migration file into statements. Prisma's SQLite migrations have
// no semicolons inside strings or triggers, so splitting on ";" at line ends is safe.
function statements(sql) {
    return sql.split(/;\s*(?:\r?\n|$)/).map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
}

async function applyMigrations(prisma, folder, log = () => {}) {
    const done = await appliedMigrations(prisma);
    const names = fs.readdirSync(folder).filter((n) => fs.existsSync(path.join(folder, n, "migration.sql"))).sort();
    const applied = [];
    for (const name of names) {
        if (done.has(name)) continue;
        const sql = fs.readFileSync(path.join(folder, name, "migration.sql"), "utf8");
        const parts = statements(sql);
        // Statements run one by one: Prisma's SQLite migrations switch
        // foreign keys off and on, which SQLite ignores inside a transaction.
        for (const part of parts) await prisma.$executeRawUnsafe(part);
        const checksum = crypto.createHash("sha256").update(sql).digest("hex");
        await prisma.$executeRawUnsafe(
            `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count) VALUES (?, ?, current_timestamp, ?, 1)`,
            crypto.randomUUID(), checksum, name);
        applied.push(name);
        log(name);
    }
    return applied;
}

async function importBundledBanks(prisma, folder, importer, log = () => {}) {
    if (!fs.existsSync(folder)) return 0;
    let created = 0;
    for (const file of fs.readdirSync(folder).filter((n) => n.toLowerCase().endsWith(".csv")).sort()) {
        const text = fs.readFileSync(path.join(folder, file), "utf8");
        const checksum = crypto.createHash("sha256").update(text).digest("hex");
        const key = `BundledBank:${file}`;
        const seen = await prisma.configuration.findUnique({ where: { key } });
        if (seen?.value === checksum) continue;
        const result = await importer.importCsv(text);
        if (!result?.success) { log(file, result); continue; }
        created += result.created ?? 0;
        await prisma.configuration.upsert({
            where: { key },
            update: { value: checksum },
            create: { key, value: checksum, description: "Bundled question bank last imported (first-run.js)" }
        });
        log(file, result);
    }
    return created;
}

async function prepareDatabase(prisma, { migrationsFolder, banksFolder, seed, importer, logger }) {
    const applied = await applyMigrations(prisma, migrationsFolder, (name) => logger?.application("MIGRATION_APPLIED", { name }));
    if (applied.length > 0 || (await prisma.user.count()) === 0) {
        await seed(prisma);
        logger?.application("DATABASE_SEEDED", { after: applied });
    }
    const imported = await importBundledBanks(prisma, banksFolder, importer,
        (file, result) => logger?.application(result?.success ? "QUESTION_BANK_IMPORTED" : "QUESTION_BANK_IMPORT_FAILED", { file, created: result?.created, updated: result?.updated, message: result?.message }));
    if (imported) logger?.application("QUESTION_BANKS_IMPORTED", { created: imported });
    return { applied, imported };
}

module.exports = { prepareDatabase, applyMigrations, importBundledBanks, statements };
