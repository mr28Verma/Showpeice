'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'cart-api-test-secret';

const app = require('../app');
const prisma = require('../prisma');

test('cart API validates items and isolates every operation by the authenticated user', async (t) => {
    const originals = {
        userFindUnique: prisma.user.findUnique,
        artworkFindMany: prisma.artwork.findMany,
        cartFindUnique: prisma.cart.findUnique,
        cartUpsert: prisma.cart.upsert,
        cartItemFindUnique: prisma.cartItem.findUnique,
        cartItemCreate: prisma.cartItem.create,
        cartItemUpdateMany: prisma.cartItem.updateMany,
        cartItemUpsert: prisma.cartItem.upsert,
        cartItemDeleteMany: prisma.cartItem.deleteMany,
        transaction: prisma.$transaction,
    };
    const users = new Map([
        [701, { id: 701, firstName: 'Cart', lastName: 'Buyer A', email: 'cart-a@example.test', role: 'buyer' }],
        [702, { id: 702, firstName: 'Cart', lastName: 'Buyer B', email: 'cart-b@example.test', role: 'buyer' }],
        [703, { id: 703, firstName: 'Cart', lastName: 'Artist', email: 'cart-artist@example.test', role: 'artist' }],
    ]);
    const artworks = new Map([
        [901, { id: 901, title: 'Available work', price: 2500, imageUrl: 'https://res.cloudinary.com/showpeice/image/upload/showpeice/artworks/available.jpg', isProtected: false, available: true, status: 'published', artist: { firstName: 'Studio', lastName: 'Artist', displayName: null } }],
        [902, { id: 902, title: 'Unavailable work', price: 900, imageUrl: null, isProtected: false, available: false, status: 'published', artist: { firstName: 'Studio', lastName: 'Artist', displayName: null } }],
        [903, { id: 903, title: 'Race work', price: 1700, imageUrl: null, isProtected: false, available: true, status: 'published', artist: { firstName: 'Studio', lastName: 'Artist', displayName: null } }],
    ]);
    const carts = new Map();
    const items = new Map();
    let nextCartId = 1;
    let nextItemId = 1;
    let simulateConcurrentInsert = false;
    const itemKey = (userId, artworkId) => `${userId}:${artworkId}`;
    const authToken = (user) => jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    prisma.user.findUnique = async ({ where }) => users.get(where.id) || null;
    prisma.artwork.findMany = async ({ where }) => [...artworks.values()]
        .filter((artwork) => where.id.in.includes(artwork.id) && artwork.available && artwork.status.toLowerCase() === 'published')
        .map(({ id }) => ({ id }));
    prisma.cart.upsert = async ({ where, create }) => {
        if (!carts.has(where.userId)) carts.set(where.userId, { id: nextCartId++, userId: create.userId });
        return carts.get(where.userId);
    };
    prisma.cart.findUnique = async ({ where }) => {
        const cart = carts.get(where.userId);
        if (!cart) return null;
        return {
            ...cart,
            items: [...items.values()]
                .filter((item) => item.userId === where.userId)
                .sort((left, right) => left.createdAt - right.createdAt)
                .map((item) => ({ ...item, artwork: artworks.get(item.artworkId) })),
        };
    };
    prisma.cartItem.findUnique = async ({ where }) => items.get(itemKey(where.userId_artworkId.userId, where.userId_artworkId.artworkId)) || null;
    prisma.cartItem.create = async ({ data }) => {
        if (simulateConcurrentInsert) {
            simulateConcurrentInsert = false;
            items.set(itemKey(data.userId, data.artworkId), { id: nextItemId++, ...data, createdAt: new Date() });
            const error = new Error('A concurrent request created this cart item.');
            error.code = 'P2002';
            throw error;
        }
        const item = { id: nextItemId++, ...data, createdAt: new Date() };
        items.set(itemKey(item.userId, item.artworkId), item);
        return item;
    };
    prisma.cartItem.updateMany = async ({ where, data }) => {
        const matching = [...items.entries()].filter(([, item]) =>
            (where.userId === undefined || item.userId === where.userId) &&
            (where.artworkId === undefined || item.artworkId === where.artworkId) &&
            (where.id === undefined || item.id === where.id) &&
            (where.quantity?.lt === undefined || item.quantity < where.quantity.lt));
        for (const [key, item] of matching) {
            const quantity = typeof data.quantity === 'object'
                ? item.quantity + data.quantity.increment
                : data.quantity;
            items.set(key, { ...item, quantity });
        }
        return { count: matching.length };
    };
    prisma.cartItem.upsert = async ({ where, create }) => {
        const key = itemKey(where.userId_artworkId.userId, where.userId_artworkId.artworkId);
        if (!items.has(key)) await prisma.cartItem.create({ data: create });
        return items.get(key);
    };
    prisma.cartItem.deleteMany = async ({ where }) => {
        const matching = [...items.entries()].filter(([, item]) =>
            item.userId === where.userId && (where.artworkId === undefined || item.artworkId === where.artworkId));
        matching.forEach(([key]) => items.delete(key));
        return { count: matching.length };
    };
    prisma.$transaction = async (callback) => callback(prisma);

    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    t.after(async () => {
        prisma.user.findUnique = originals.userFindUnique;
        prisma.artwork.findMany = originals.artworkFindMany;
        prisma.cart.findUnique = originals.cartFindUnique;
        prisma.cart.upsert = originals.cartUpsert;
        prisma.cartItem.findUnique = originals.cartItemFindUnique;
        prisma.cartItem.create = originals.cartItemCreate;
        prisma.cartItem.updateMany = originals.cartItemUpdateMany;
        prisma.cartItem.upsert = originals.cartItemUpsert;
        prisma.cartItem.deleteMany = originals.cartItemDeleteMany;
        prisma.$transaction = originals.transaction;
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    });

    const baseUrl = `http://127.0.0.1:${server.address().port}/api/cart`;
    const tokenA = authToken(users.get(701));
    const tokenB = authToken(users.get(702));
    const artistToken = authToken(users.get(703));
    const request = (path, token, options = {}) => fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    assert.equal((await request('/', null)).status, 401);

    const addResponse = await request('/items', tokenA, { method: 'POST', body: JSON.stringify({ artworkId: 901 }) });
    assert.equal(addResponse.status, 200);
    assert.deepEqual((await addResponse.json()).cart.items.map(({ id, price, quantity }) => ({ id, price, quantity })), [
        { id: 901, price: 2500, quantity: 1 },
    ]);
    assert.deepEqual(
        (await (await request('/items', tokenA)).json()).cart.items.map(({ id }) => id),
        [901]
    );

    for (let index = 0; index < 12; index += 1) {
        const response = await request('/items', tokenA, { method: 'POST', body: JSON.stringify({ artworkId: 901 }) });
        assert.equal(response.status, 200);
    }
    assert.equal((await (await request('/', tokenA)).json()).cart.items[0].quantity, 10);

    const patchResponse = await request('/items/901', tokenA, { method: 'PATCH', body: JSON.stringify({ quantity: 3 }) });
    assert.equal(patchResponse.status, 200);
    assert.equal((await patchResponse.json()).cart.items[0].quantity, 3);
    const decreaseResponse = await request('/items/901', tokenA, { method: 'PATCH', body: JSON.stringify({ quantity: 1 }) });
    assert.equal(decreaseResponse.status, 200);
    assert.equal((await decreaseResponse.json()).cart.items[0].quantity, 1);
    assert.equal((await request('/items/901', tokenA, { method: 'PATCH', body: JSON.stringify({ quantity: 3 }) })).status, 200);
    assert.equal((await request('/items/901', tokenA, { method: 'PATCH', body: JSON.stringify({ quantity: 11 }) })).status, 400);
    assert.equal((await request('/items', tokenA, { method: 'POST', body: JSON.stringify({ artworkId: 902 }) })).status, 404);

    simulateConcurrentInsert = true;
    const raceResponse = await request('/items', tokenA, { method: 'POST', body: JSON.stringify({ artworkId: 903 }) });
    assert.equal(raceResponse.status, 200);
    assert.equal((await raceResponse.json()).cart.items.find((item) => item.id === 903).quantity, 2);
    assert.equal((await request('/items/903', tokenA, { method: 'DELETE' })).status, 200);

    assert.equal((await request('/items', artistToken, { method: 'POST', body: JSON.stringify({ artworkId: 901 }) })).status, 200);
    assert.equal((await (await request('/', artistToken)).json()).cart.items[0].quantity, 1);

    assert.deepEqual((await (await request('/', tokenB)).json()).cart.items, []);
    assert.equal((await request('/items/901', tokenB, { method: 'DELETE' })).status, 404);
    assert.equal((await (await request('/', tokenA)).json()).cart.items[0].quantity, 3);
    assert.equal((await request('/items/901', tokenA, { method: 'DELETE' })).status, 200);
    assert.deepEqual((await (await request('/', tokenA)).json()).cart.items, []);
    assert.equal((await (await request('/', artistToken)).json()).cart.items[0].quantity, 1);

    prisma.cart.findUnique = async () => {
        const error = new Error('Cart table is missing.');
        error.code = 'P2021';
        throw error;
    };
    assert.equal((await request('/', tokenA)).status, 503);
});
