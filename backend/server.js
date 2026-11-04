require('dotenv').config();
const app = require('./app');
const prisma = require('./prisma');

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error('PORT must be a valid TCP port between 1 and 65535.');
}

function redactDatabaseUrl(value) {
    let diagnostic = String(value || '');
    for (const variable of ['DATABASE_URL', 'DIRECT_URL']) {
        if (process.env[variable]) diagnostic = diagnostic.split(process.env[variable]).join('[redacted database URL]');
    }
    return diagnostic.replace(/postgres(?:ql)?:\/\/[^\s`"'<>]+/gi, '[redacted database URL]');
}

async function startServer() {
    if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
        console.error('[startup] DATABASE_URL is required. Configure the backend PostgreSQL connection before starting the API.');
        process.exitCode = 1;
        return;
    }
    if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
        console.error('[startup] JWT_SECRET is required. Configure a unique secret before starting the API.');
        process.exitCode = 1;
        return;
    }

    try {
        const databaseUrl = new URL(process.env.DATABASE_URL);
        if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol) || !databaseUrl.hostname) {
            throw new Error();
        }
    } catch {
        console.error('[startup] DATABASE_URL must be a valid PostgreSQL connection URL.');
        process.exitCode = 1;
        return;
    }

    try {
        await prisma.$connect();
        console.log('[startup] Database connection established.');
    } catch (error) {
        console.error('[startup] Database connection failed:', error.code || error.name || 'unknown error');
        const diagnostic = redactDatabaseUrl(error.message);
        if (diagnostic) console.error(diagnostic);
        await prisma.$disconnect().catch(() => {});
        process.exitCode = 1;
        return;
    }

    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`Showpeice API is listening on 0.0.0.0:${PORT}`);
    });

    server.on('error', (error) => {
        console.error(`[startup] Could not listen on port ${PORT}:`, error.code || error.message);
        void prisma.$disconnect().finally(() => { process.exitCode = 1; });
    });
}

startServer().catch((error) => {
    console.error('[startup] API failed to start:', error.code || error.name || 'unknown error');
    process.exitCode = 1;
});
