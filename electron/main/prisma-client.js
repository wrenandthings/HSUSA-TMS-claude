// One shared database client for the whole app.
//
// Each handler used to make its own PrismaClient, and each client opens its
// own pool of connections. With SQLite on the desktop that cost nothing. The
// web version's PostgreSQL (Supabase's free plan, session pooler) allows only
// 15 connections in total, and a dozen pools used them all up: every page
// then failed (first live test, 2026-11-27). Now there is one client, and on
// PostgreSQL its pool is capped (DATABASE_CONNECTION_LIMIT, default 5) so an
// old and a new server can overlap during a deploy and still fit.
const { PrismaClient } = require("@prisma/client");

// Adds connection_limit to a PostgreSQL URL that does not set one.
function limitedUrl(url, limit) {
    if (!url || !/^postgres(ql)?:\/\//.test(url) || /[?&]connection_limit=/.test(url)) return url;
    return `${url}${url.includes("?") ? "&" : "?"}connection_limit=${limit}`;
}

function createPrismaClient(limit = Number(process.env.DATABASE_CONNECTION_LIMIT) || 5) {
    const url = limitedUrl(process.env.DATABASE_URL, limit);
    return url && url !== process.env.DATABASE_URL ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient();
}

let shared = null;
function getPrisma() {
    if (!shared) shared = createPrismaClient();
    return shared;
}

module.exports = { getPrisma, createPrismaClient, limitedUrl };
