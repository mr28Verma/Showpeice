'use strict';

const localTestUrl = 'postgresql://showpeice_test:showpeice_test@127.0.0.1:5432/showpeice_test';
const configuredTestUrl = process.env.TEST_DATABASE_URL?.trim();

if (configuredTestUrl) {
    let parsedUrl;
    try {
        parsedUrl = new URL(configuredTestUrl);
    } catch {
        throw new Error('TEST_DATABASE_URL must be a valid local PostgreSQL URL for a disposable *_test database.');
    }

    const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));
    const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname);
    const isTestDatabase = /(?:^|[_-])test(?:$|[_-])/i.test(databaseName);
    if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol) || !isLocalHost || !isTestDatabase) {
        throw new Error('TEST_DATABASE_URL must point to a local PostgreSQL database whose name includes a test segment.');
    }

    process.env.DATABASE_URL = configuredTestUrl;
} else {
    // Prisma also reads backend/.env automatically. Override it before importing
    // the client so a skipped integration test can never select that database.
    process.env.DATABASE_URL = localTestUrl;
}

module.exports = { hasSafeTestDatabase: Boolean(configuredTestUrl) };
