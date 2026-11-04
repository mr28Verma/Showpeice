'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const previousJwtSecret = process.env.JWT_SECRET;
const previousNodeEnv = process.env.NODE_ENV;
process.env.JWT_SECRET = 'auth-api-test-secret';
process.env.NODE_ENV = 'test';

const app = require('../app');
const prisma = require('../prisma');

test('authentication API logs in buyers and artists, resolves the token owner, and distinguishes invalid sessions from DB failures', async (t) => {
    const originalFindUnique = prisma.user.findUnique;
    const originalCreate = prisma.user.create;
    const originalJwtSecret = previousJwtSecret;
    const users = new Map([
        [1101, {
            id: 1101,
            firstName: 'Buyer',
            lastName: 'One',
            email: 'auth-buyer@example.test',
            password: await bcrypt.hash('correct horse battery', 4),
            role: 'buyer',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }],
        [1102, {
            id: 1102,
            firstName: 'Artist',
            lastName: 'One',
            email: 'auth-artist@example.test',
            password: await bcrypt.hash('correct horse battery', 4),
            role: 'artist',
            createdAt: new Date('2026-01-02T00:00:00.000Z'),
        }],
    ]);
    let nextUserId = 1103;
    let databaseFailureCode = null;

    prisma.user.findUnique = async ({ where, select }) => {
        if (databaseFailureCode) {
            const error = new Error('Database operation failed.');
            error.code = databaseFailureCode;
            throw error;
        }
        const user = where.id
            ? users.get(where.id) || null
            : [...users.values()].find((user) => user.email === where.email) || null;
        if (!user || !select) return user;
        return Object.fromEntries(Object.keys(select)
            .filter((field) => select[field])
            .map((field) => [field, user[field]]));
    };
    prisma.user.create = async ({ data }) => {
        const user = { id: nextUserId++, ...data, createdAt: new Date() };
        users.set(user.id, user);
        return user;
    };

    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    t.after(async () => {
        prisma.user.findUnique = originalFindUnique;
        prisma.user.create = originalCreate;
        if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalJwtSecret;
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNodeEnv;
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    });

    const baseUrl = `http://127.0.0.1:${server.address().port}/api/auth`;
    const request = (path, options = {}) => fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers,
        },
    });
    const login = async (email) => {
        const response = await request('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password: 'correct horse battery' }),
        });
        assert.equal(response.status, 200);
        return response.json();
    };

    assert.equal((await request('/me')).status, 401);

    const buyerLogin = await login('AUTH-BUYER@example.test');
    const buyerMeResponse = await request('/me', {
        headers: { Authorization: `Bearer ${buyerLogin.token}` },
    });
    assert.equal(buyerMeResponse.status, 200);
    const buyerMe = await buyerMeResponse.json();
    assert.equal(buyerMe.user.id, 1101);
    assert.equal(buyerMe.user.email, 'auth-buyer@example.test');
    assert.equal(buyerMe.user.role, 'buyer');
    assert.equal('password' in buyerMe.user, false);

    const artistLogin = await login('auth-artist@example.test');
    const artistMe = await request('/me', {
        headers: { Authorization: `Bearer ${artistLogin.token}` },
    });
    assert.equal(artistMe.status, 200);
    assert.equal((await artistMe.json()).user.role, 'artist');

    const expiredToken = jwt.sign({ userId: 1101 }, process.env.JWT_SECRET, { expiresIn: -1 });
    assert.equal((await request('/me', {
        headers: { Authorization: `Bearer ${expiredToken}` },
    })).status, 401);
    assert.equal((await request('/me', {
        headers: { Authorization: 'Bearer not-a-valid-token' },
    })).status, 401);

    databaseFailureCode = 'P1001';
    const unavailableMe = await request('/me', {
        headers: { Authorization: `Bearer ${buyerLogin.token}` },
    });
    assert.equal(unavailableMe.status, 503);
    assert.equal((await unavailableMe.json()).error, 'Authentication is temporarily unavailable.');
    assert.equal((await request('/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'auth-buyer@example.test', password: 'correct horse battery' }),
    })).status, 503);
    assert.equal((await request('/register', {
        method: 'POST',
        body: JSON.stringify({
            firstName: 'New',
            lastName: 'Buyer',
            email: 'new-buyer@example.test',
            password: 'correct horse battery',
            role: 'buyer',
        }),
    })).status, 503);

    databaseFailureCode = 'P2022';
    assert.equal((await request('/me', {
        headers: { Authorization: `Bearer ${buyerLogin.token}` },
    })).status, 503);
});
