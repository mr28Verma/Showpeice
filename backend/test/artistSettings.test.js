'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../app');
const prisma = require('../prisma');

process.env.JWT_SECRET = 'artist-settings-test-secret';

test('artist settings APIs persist only the authenticated artist data', async (t) => {
    const originalFindUnique = prisma.user.findUnique;
    const originalUpdate = prisma.user.update;
    const originalDelete = prisma.user.delete;
    const originalTransaction = prisma.$transaction;
    const originalOrderCount = prisma.order.count;
    const originalOrderItemCount = prisma.orderItem.count;
    const originalCompare = bcrypt.compare;
    const accounts = new Map([
        [401, {
            id: 401,
            firstName: 'Settings',
            lastName: 'Artist',
            email: 'settings-artist@example.test',
            password: 'stored-password-hash',
            role: 'artist',
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
            displayName: 'Studio Name',
            bio: 'A saved biography.',
            shopAnnouncement: null,
            emailNotifications: false,
            publicProfileVisible: true,
            weeklyDigest: false,
            orderNotifications: true,
            publicEmailVisible: false,
            artworks: [{
                id: 91,
                title: 'Private studio artwork',
                description: 'Artist-owned export data.',
                price: 2500,
                category: 'Painting',
                imageUrl: 'https://res.cloudinary.com/demo/image/upload/test.jpg',
                isProtected: false,
                available: true,
                status: 'draft',
                createdAt: new Date('2025-02-01T00:00:00.000Z'),
                updatedAt: new Date('2025-02-01T00:00:00.000Z'),
            }],
        }],
        [402, {
            id: 402,
            firstName: 'Other',
            lastName: 'Buyer',
            email: 'other-buyer@example.test',
            password: 'other-password-hash',
            role: 'buyer',
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
            displayName: null,
            bio: null,
            shopAnnouncement: null,
            emailNotifications: false,
            publicProfileVisible: true,
            weeklyDigest: false,
            orderNotifications: true,
            publicEmailVisible: false,
            artworks: [],
        }],
    ]);

    prisma.user.findUnique = async ({ where, select }) => {
        if (settingsFailureCode && select?.weeklyDigest) {
            throw Object.assign(new Error('The saved artist settings schema is unavailable.'), {
                code: settingsFailureCode,
                meta: { column: 'User.weeklyDigest' },
            });
        }
        const account = accounts.get(where.id);
        if (!account) return null;
        if (!select) return { ...account };
        const result = {};
        for (const [field, selected] of Object.entries(select)) {
            if (selected === true) result[field] = account[field];
            else if (field === 'artworks' && selected?.select) {
                result.artworks = account.artworks.map((artwork) => {
                    const selectedArtwork = {};
                    for (const [artworkField, include] of Object.entries(selected.select)) {
                        if (include === true) selectedArtwork[artworkField] = artwork[artworkField];
                    }
                    return selectedArtwork;
                });
            }
        }
        return result;
    };
    prisma.user.update = async ({ where, data }) => {
        if (settingsFailureCode && Object.hasOwn(data, 'weeklyDigest')) {
            throw Object.assign(new Error('The saved artist settings schema is unavailable.'), {
                code: settingsFailureCode,
                meta: { column: 'User.weeklyDigest' },
            });
        }
        const account = accounts.get(where.id);
        if (!account) throw Object.assign(new Error('Record not found'), { code: 'P2025' });
        Object.assign(account, data);
        return { ...account };
    };
    prisma.user.delete = async ({ where }) => {
        const account = accounts.get(where.id);
        if (!account) throw Object.assign(new Error('Record not found'), { code: 'P2025' });
        accounts.delete(where.id);
        return { id: where.id };
    };

    let orderCount = 0;
    let soldArtworkCount = 0;
    let settingsFailureCode = null;
    prisma.order.count = async () => orderCount;
    prisma.orderItem.count = async () => soldArtworkCount;
    prisma.$transaction = async (operation) => operation({
        order: { count: prisma.order.count },
        orderItem: { count: prisma.orderItem.count },
        user: { delete: prisma.user.delete },
    });
    bcrypt.compare = async (password, hash) => password === 'correct-password' && hash === 'stored-password-hash';

    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    t.after(async () => {
        prisma.user.findUnique = originalFindUnique;
        prisma.user.update = originalUpdate;
        prisma.user.delete = originalDelete;
        prisma.$transaction = originalTransaction;
        prisma.order.count = originalOrderCount;
        prisma.orderItem.count = originalOrderItemCount;
        bcrypt.compare = originalCompare;
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    });

    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const tokenFor = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const request = (path, userId = 401, options = {}) => fetch(`${baseUrl}/api/artist${path}`, {
        ...options,
        headers: {
            Authorization: 'Bearer ' + tokenFor(userId),
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers,
        },
    });
    const settings = {
        displayName: 'Updated Studio',
        bio: 'Updated artist biography.',
        shopAnnouncement: 'New work this month.',
        emailNotifications: true,
        publicProfileVisible: false,
        weeklyDigest: true,
        orderNotifications: false,
        publicEmailVisible: true,
    };

    await t.test('GET returns only the account settings without a password', async () => {
        const response = await request('/settings');
        assert.equal(response.status, 200, await response.clone().text());
        const result = await response.json();
        assert.equal(result.settings.id, 401);
        assert.equal(result.settings.displayName, 'Studio Name');
        assert.equal('password' in result.settings, false);
    });

    await t.test('PATCH persists allowlisted settings for the authenticated account', async () => {
        const response = await request('/settings', 401, {
            method: 'PATCH',
            body: JSON.stringify({ ...settings, userId: 402, role: 'buyer' }),
        });
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.settings.displayName, settings.displayName);
        assert.equal(result.settings.orderNotifications, false);
        assert.equal(result.settings.publicProfileVisible, false);
        assert.equal(accounts.get(402).displayName, null);
    });

    await t.test('PATCH rejects invalid settings without saving', async () => {
        const response = await request('/settings', 401, {
            method: 'PATCH',
            body: JSON.stringify({ ...settings, shopAnnouncement: 'x'.repeat(501) }),
        });
        assert.equal(response.status, 400);
        assert.equal(accounts.get(401).shopAnnouncement, settings.shopAnnouncement);
    });

    await t.test('buyer accounts cannot read artist settings', async () => {
        const response = await request('/settings', 402);
        assert.equal(response.status, 403);
    });

    await t.test('missing settings columns are reported as a service failure for reads and saves', async () => {
        settingsFailureCode = 'P2022';
        const read = await request('/settings');
        assert.equal(read.status, 503);
        assert.deepEqual(await read.json(), {
            error: 'Artist settings could not be loaded. Please try again.',
        });

        const update = await request('/settings', 401, {
            method: 'PATCH',
            body: JSON.stringify(settings),
        });
        assert.equal(update.status, 503);
        assert.deepEqual(await update.json(), {
            error: 'Artist settings could not be saved. Please try again.',
        });
        assert.equal(accounts.get(401).emailNotifications, true);
        settingsFailureCode = null;
    });

    await t.test('data export contains own account and artworks but no password hash', async () => {
        const response = await request('/data-export');
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.account.id, 401);
        assert.equal(result.account.artworks[0].title, 'Private studio artwork');
        assert.equal('password' in result.account, false);
    });

    await t.test('account deletion requires password, explicit phrase, and retained order checks', async () => {
        const missingConfirmation = await request('/account', 401, {
            method: 'DELETE',
            body: JSON.stringify({ currentPassword: 'correct-password', confirmation: 'delete' }),
        });
        assert.equal(missingConfirmation.status, 400);

        const wrongPassword = await request('/account', 401, {
            method: 'DELETE',
            body: JSON.stringify({ currentPassword: 'wrong-password', confirmation: 'DELETE' }),
        });
        assert.equal(wrongPassword.status, 400);

        orderCount = 1;
        const retainedOrders = await request('/account', 401, {
            method: 'DELETE',
            body: JSON.stringify({ currentPassword: 'correct-password', confirmation: 'DELETE' }),
        });
        assert.equal(retainedOrders.status, 409);
        assert.equal(accounts.has(401), true);

        orderCount = 0;
        soldArtworkCount = 1;
        const retainedSale = await request('/account', 401, {
            method: 'DELETE',
            body: JSON.stringify({ currentPassword: 'correct-password', confirmation: 'DELETE' }),
        });
        assert.equal(retainedSale.status, 409);
        assert.equal(accounts.has(401), true);

        soldArtworkCount = 0;
        const deleted = await request('/account', 401, {
            method: 'DELETE',
            body: JSON.stringify({ currentPassword: 'correct-password', confirmation: 'DELETE' }),
        });
        assert.equal(deleted.status, 200);
        assert.equal(accounts.has(401), false);
    });
});
