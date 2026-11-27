// Makes prisma/postgres/schema.prisma from prisma/schema.prisma (web roadmap
// step 3, 2026-11-27). The desktop app keeps SQLite; the web version uses
// PostgreSQL. prisma/schema.prisma stays the one place tables are defined:
// edit it, then run `npm run db:postgres-schema` and add a migration to BOTH
// prisma/migrations (SQLite) and prisma/postgres/migrations (see README).
// tests/unit/postgres-schema.test.ts fails if the two files drift apart.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function postgresSchema(sqliteSchema) {
    const marker = 'provider = "sqlite"';
    if (!sqliteSchema.includes(marker)) throw new Error('prisma/schema.prisma: provider = "sqlite" not found');
    return "// GENERATED from prisma/schema.prisma by scripts/postgres-schema.js. Do not edit.\n" +
        "// The web version's database (PostgreSQL). Edit prisma/schema.prisma instead.\n\n" +
        sqliteSchema.replace(marker, 'provider = "postgresql"');
}

module.exports = { postgresSchema };

if (require.main === module) {
    const source = fs.readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");
    fs.writeFileSync(path.join(root, "prisma", "postgres", "schema.prisma"), postgresSchema(source));
    console.log("Wrote prisma/postgres/schema.prisma");
}
