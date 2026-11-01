const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = 'role-access-test-secret';
process.env.CLIENT_URL = 'https://showpeice-test.example';

const app = require('../app');
const prisma = require('../prisma');

test('role access uses the database account and scopes buyer data', async (t) => {
    const originalFindUnique = prisma.user.findUnique;
    const originalOrderFindMany = prisma.order.findMany;
    const originalCompare = bcrypt.compare;
    const records = new Map([
        [101, { id: 101, firstName: 'Test', lastName: 'Buyer', email: 'buyer@example.test', role: 'buyer' }],
        [202, { id: 202, firstName: 'Test', lastName: 'Artist', email: 'artist@example.test', role: 'seller' }],
        [303, { id: 303, firstName: 'Test', lastName: 'Unknown', email: 'unknown@example.test', role: 'unknown' }],
    ]);
    prisma.user.findUnique = async ({ where }) => {
        const record = Number.isSafeInteger(where.id)
            ? records.get(where.id)
            : [...records.values()].find((user) => user.email === where.email);
        return record ? {
            ...record,
            phone: null,
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
            displayName: null,
            bio: null,
            avatarUrl: null,
            bannerUrl: null,
            medium: null,
            location: null,
            instagramUrl: null,
            websiteUrl: null,
            emailNotifications: false,
            publicProfileVisible: true,
        } : null;
    };
    bcrypt.compare = async () => true;

    let observedOrdersWhere;
    prisma.order.findMany = async ({ where }) => {
        observedOrdersWhere = where;
        return [];
    };

    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    t.after(async () => {
        prisma.user.findUnique = originalFindUnique;
        prisma.order.findMany = originalOrderFindMany;
        bcrypt.compare = originalCompare;
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    });

    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const tokenFor = (userId, role = 'buyer') => jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const request = (path, userId, role, headers = {}) => fetch(`${baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${tokenFor(userId, role)}`, ...headers },
    });

    await t.test('current account returns the database role, not the token role', async () => {
        const response = await request('/api/auth/me', 101, 'seller');
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.user.id, 101);
        assert.equal(result.user.role, 'buyer');
    });

    await t.test('login response uses the database role', async () => {
        const response = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'buyer@example.test', password: 'test-password' }),
        });
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.user.role, 'buyer');
        assert.equal(typeof result.token, 'string');
    });

    await t.test('buyer routes deny artist accounts and artist routes deny buyer accounts', async () => {
        const buyerToArtist = await request('/api/artist/dashboard', 101, 'seller');
        assert.equal(buyerToArtist.status, 403);
        const artistToBuyer = await request('/api/buyer/dashboard', 202, 'buyer');
        assert.equal(artistToBuyer.status, 403);
    });

    await t.test('protected dashboard APIs reject signed-out requests', async () => {
        const buyer = await fetch(`${baseUrl}/api/buyer/dashboard`);
        const artist = await fetch(`${baseUrl}/api/artist/dashboard`);
        assert.equal(buyer.status, 401);
        assert.equal(artist.status, 401);
    });

    await t.test('buyer order queries use only the authenticated database user ID', async () => {
        const response = await request('/api/buyer/orders', 101, 'artist');
        assert.equal(response.status, 200);
        assert.deepEqual(observedOrdersWhere, { buyerId: 101 });
    });

    await t.test('unknown database roles are rejected safely', async () => {
        const response = await request('/api/auth/me', 303, 'buyer');
        assert.equal(response.status, 403);
        const login = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'unknown@example.test', password: 'test-password' }),
        });
        assert.equal(login.status, 403);
    });

    await t.test('configured frontend origin is allowed and other origins are not', async () => {
        const allowed = await fetch(`${baseUrl}/api/auth/me`, {
            method: 'OPTIONS',
            headers: {
                Origin: 'https://showpeice-test.example',
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'authorization',
            },
        });
        assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://showpeice-test.example');

        const denied = await fetch(`${baseUrl}/api/auth/me`, {
            method: 'OPTIONS',
            headers: {
                Origin: 'https://other-site.example',
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'authorization',
            },
        });
        assert.equal(denied.headers.get('access-control-allow-origin'), null);
    });
});
