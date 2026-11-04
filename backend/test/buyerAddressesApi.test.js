'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'buyer-address-api-test-secret';

const app = require('../app');
const prisma = require('../prisma');

test('buyer addresses persist atomically, keep one default, and stay private to the owner', async (t) => {
    const originals = {
        userFindUnique: prisma.user.findUnique,
        addressFindMany: prisma.address.findMany,
        addressCount: prisma.address.count,
        addressUpdateMany: prisma.address.updateMany,
        addressCreate: prisma.address.create,
        addressFindFirst: prisma.address.findFirst,
        addressUpdate: prisma.address.update,
        addressDelete: prisma.address.delete,
        transaction: prisma.$transaction,
    };
    const users = new Map([
        [801, { id: 801, firstName: 'Buyer', lastName: 'One', email: 'one@example.test', role: 'buyer' }],
        [802, { id: 802, firstName: 'Buyer', lastName: 'Two', email: 'two@example.test', role: 'buyer' }],
    ]);
    const addresses = new Map();
    let nextAddressId = 1;

    prisma.user.findUnique = async ({ where }) => users.get(where.id) || null;
    prisma.address.findMany = async ({ where }) => [...addresses.values()]
        .filter((address) => address.userId === where.userId)
        .sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || right.createdAt - left.createdAt);
    prisma.address.count = async ({ where }) => [...addresses.values()].filter((address) => address.userId === where.userId).length;
    prisma.address.updateMany = async ({ where, data }) => {
        const matching = [...addresses.values()].filter((address) => address.userId === where.userId);
        matching.forEach((address) => addresses.set(address.id, { ...address, ...data }));
        return { count: matching.length };
    };
    prisma.address.create = async ({ data }) => {
        const address = { id: nextAddressId++, ...data, createdAt: new Date(), updatedAt: new Date() };
        addresses.set(address.id, address);
        return address;
    };
    prisma.address.findFirst = async ({ where, orderBy }) => {
        const matching = [...addresses.values()].filter((address) =>
            (where.userId === undefined || address.userId === where.userId) &&
            (where.id === undefined || address.id === where.id));
        if (orderBy?.createdAt === 'desc') matching.sort((left, right) => right.createdAt - left.createdAt);
        return matching[0] || null;
    };
    prisma.address.update = async ({ where, data }) => {
        const address = { ...addresses.get(where.id), ...data, updatedAt: new Date() };
        addresses.set(where.id, address);
        return address;
    };
    prisma.address.delete = async ({ where }) => {
        const address = addresses.get(where.id);
        addresses.delete(where.id);
        return address;
    };
    prisma.$transaction = async (callback) => callback(prisma);

    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    t.after(async () => {
        prisma.user.findUnique = originals.userFindUnique;
        prisma.address.findMany = originals.addressFindMany;
        prisma.address.count = originals.addressCount;
        prisma.address.updateMany = originals.addressUpdateMany;
        prisma.address.create = originals.addressCreate;
        prisma.address.findFirst = originals.addressFindFirst;
        prisma.address.update = originals.addressUpdate;
        prisma.address.delete = originals.addressDelete;
        prisma.$transaction = originals.transaction;
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    });

    const baseUrl = `http://127.0.0.1:${server.address().port}/api/buyer/addresses`;
    const tokenFor = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const request = (path, token, options = {}) => fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            Authorization: `Bearer ${token}`,
            ...options.headers,
        },
    });
    const tokenA = tokenFor(801);
    const tokenB = tokenFor(802);
    const address = (fullName, isDefault) => ({
        fullName,
        phone: '9876543210',
        street: '12 Gallery Road',
        city: 'Jaipur',
        state: 'Rajasthan',
        postalCode: '302001',
        country: 'India',
        ...(isDefault === undefined ? {} : { isDefault }),
    });

    const firstResponse = await request('', tokenA, { method: 'POST', body: JSON.stringify(address('First Recipient')) });
    assert.equal(firstResponse.status, 201);
    const firstId = (await firstResponse.json()).address.id;
    assert.equal(addresses.get(firstId).isDefault, true);

    const secondResponse = await request('', tokenA, { method: 'POST', body: JSON.stringify(address('Second Recipient', true)) });
    assert.equal(secondResponse.status, 201);
    const secondId = (await secondResponse.json()).address.id;
    assert.equal(addresses.get(firstId).isDefault, false);
    assert.equal(addresses.get(secondId).isDefault, true);

    assert.equal((await request('', tokenA, { method: 'POST', body: JSON.stringify(address('Invalid Recipient', 'false')) })).status, 400);
    assert.equal((await request(`/${secondId}`, tokenB, { method: 'PATCH', body: JSON.stringify({ city: 'Delhi' }) })).status, 404);

    const updated = await request(`/${firstId}`, tokenA, { method: 'PATCH', body: JSON.stringify({ city: 'Udaipur' }) });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).address.city, 'Udaipur');

    const buyerBAddresses = await request('', tokenB);
    assert.deepEqual((await buyerBAddresses.json()).addresses, []);
    assert.equal((await request(`/${secondId}`, tokenA, { method: 'DELETE' })).status, 200);
    const remaining = await request('', tokenA);
    assert.deepEqual((await remaining.json()).addresses.map(({ id, isDefault }) => ({ id, isDefault })), [
        { id: firstId, isDefault: true },
    ]);
});
