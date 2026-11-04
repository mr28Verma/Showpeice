const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { hasSafeTestDatabase } = require('../testSupport/databaseTestGuard');
const app = require('../app');
const prisma = require('../prisma');

test('Authenticated shopping carts are private to each user', {
    skip: hasSafeTestDatabase ? false : 'Set TEST_DATABASE_URL to a local disposable *_test database to run database integration tests.',
}, async (t) => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';

    const password = 'CartTest-Password-123!';
    const passwordHash = await bcrypt.hash(password, 12);
    const [buyerA, buyerB, artist] = await Promise.all(
        ['CartBuyerA', 'CartBuyerB', 'CartArtist'].map((firstName) => prisma.user.create({
            data: {
                firstName,
                lastName: 'Test',
                email: `${firstName.toLowerCase()}_${crypto.randomUUID()}@example.test`,
                password: passwordHash,
                role: firstName === 'CartArtist' ? 'artist' : 'buyer',
            },
        }))
    );
    const [artworkA, artworkB, artworkForConstraint, unavailableArtwork] = await Promise.all(
        ['Cart Artwork A', 'Cart Artwork B', 'Cart Ownership Constraint', 'Cart Unavailable Artwork'].map((title, index) => prisma.artwork.create({
            data: {
                artistId: artist.id,
                title,
                description: 'Cart API test artwork',
                price: 2500,
                category: 'Painting',
                imageUrl: 'https://images.unsplash.com/test-image',
                status: 'published',
                available: index !== 3,
            },
        }))
    );

    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://localhost:${server.address().port}/api/cart`;
    const login = async (email) => {
        const response = await fetch(`http://localhost:${server.address().port}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(typeof result.token, 'string');
        return result.token;
    };
    const [tokenA, tokenB] = await Promise.all([login(buyerA.email), login(buyerB.email)]);
    const request = (path, token, options = {}) => fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers,
        },
    });

    t.after(async () => {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        await prisma.artwork.deleteMany({
            where: { id: { in: [artworkA.id, artworkB.id, artworkForConstraint.id, unavailableArtwork.id] } },
        });
        await prisma.user.deleteMany({ where: { id: { in: [buyerA.id, buyerB.id, artist.id] } } });
    });

    await t.test('requires authentication and rejects caller-supplied ownership', async () => {
        const unauthenticated = await fetch(baseUrl);
        assert.equal(unauthenticated.status, 401);

        const forgedOwner = await request('/items', tokenA, {
            method: 'POST',
            body: JSON.stringify({ artworkId: artworkA.id, userId: buyerB.id }),
        });
        assert.equal(forgedOwner.status, 400);

        const forgedQuery = await request(`?userId=${buyerB.id}`, tokenA);
        assert.equal(forgedQuery.status, 400);
    });

    await t.test('keeps additions, quantities, removals, and refreshes user-scoped', async () => {
        for (const artworkId of [artworkA.id, artworkA.id, artworkB.id]) {
            const response = await request('/items', tokenA, {
                method: 'POST',
                body: JSON.stringify({ artworkId }),
            });
            assert.equal(response.status, 200);
        }

        let response = await request('/items', tokenA, {
            method: 'POST',
            body: JSON.stringify({ artworkId: unavailableArtwork.id }),
        });
        assert.equal(response.status, 404);

        response = await request('', tokenB);
        assert.equal(response.status, 200);
        assert.deepEqual((await response.json()).cart.items, []);

        response = await request('/items', tokenB, {
            method: 'POST',
            body: JSON.stringify({ artworkId: artworkB.id }),
        });
        assert.equal(response.status, 200);

        response = await request(`/items/${artworkB.id}`, tokenB, { method: 'DELETE' });
        assert.equal(response.status, 200);

        response = await request('', tokenA);
        const buyerACart = (await response.json()).cart.items;
        assert.equal(buyerACart.length, 2);
        assert.equal(buyerACart.find((item) => item.id === artworkA.id).quantity, 2);
        assert.equal(buyerACart.find((item) => item.id === artworkB.id).quantity, 1);
        assert.equal(buyerACart.find((item) => item.id === artworkA.id).price, 2500);

        response = await request(`/items/${artworkA.id}`, tokenA, { method: 'PATCH', body: JSON.stringify({ quantity: 1 }) });
        assert.equal(response.status, 200);
        let updatedCart = (await response.json()).cart.items;
        assert.equal(updatedCart.find((item) => item.id === artworkA.id).quantity, 1);
        assert.equal(updatedCart.reduce((total, item) => total + item.price * item.quantity, 0), 5000);

        response = await request(`/items/${artworkA.id}`, tokenA, { method: 'PATCH', body: JSON.stringify({ quantity: 2 }) });
        assert.equal(response.status, 200);
        updatedCart = (await response.json()).cart.items;
        assert.equal(updatedCart.find((item) => item.id === artworkA.id).quantity, 2);
        assert.equal(updatedCart.reduce((total, item) => total + item.price * item.quantity, 0), 7500);

        response = await request(`/items/${artworkA.id}`, tokenA, { method: 'PATCH', body: JSON.stringify({ quantity: 1 }) });
        assert.equal(response.status, 200);
        updatedCart = (await response.json()).cart.items;
        assert.equal(updatedCart.find((item) => item.id === artworkA.id).quantity, 1);
        assert.equal(updatedCart.reduce((total, item) => total + item.price * item.quantity, 0), 5000);

        response = await request('', tokenA);
        const persistedCart = (await response.json()).cart.items;
        assert.equal(persistedCart.find((item) => item.id === artworkA.id).quantity, 1);
        assert.equal(persistedCart.reduce((total, item) => total + item.price * item.quantity, 0), 5000);

        for (const quantity of [0, -1, 11]) {
            response = await request(`/items/${artworkA.id}`, tokenA, { method: 'PATCH', body: JSON.stringify({ quantity }) });
            assert.equal(response.status, 400);
        }
        response = await request('/items/not-an-id', tokenA, { method: 'PATCH', body: JSON.stringify({ quantity: 1 }) });
        assert.equal(response.status, 400);

        response = await request(`/items/${artworkA.id}`, tokenB, { method: 'PATCH', body: JSON.stringify({ quantity: 5 }) });
        assert.equal(response.status, 404);
        response = await request(`/items/${artworkA.id}`, tokenB, { method: 'DELETE' });
        assert.equal(response.status, 404);
        response = await request(`/${buyerA.id}`, tokenB);
        assert.equal(response.status, 404);

        response = await request('', tokenB);
        const buyerBCart = (await response.json()).cart.items;
        assert.deepEqual(buyerBCart, []);

        response = await request(`/items/${artworkA.id}`, tokenA, { method: 'DELETE' });
        assert.equal(response.status, 200);
        let refreshedCartResponse = await request('', tokenA);
        let refreshedCart = (await refreshedCartResponse.json()).cart.items;
        assert.deepEqual(refreshedCart.map((item) => item.id), [artworkB.id]);

        response = await request(`/items/${artworkB.id}`, tokenA, { method: 'DELETE' });
        assert.equal(response.status, 200);
        refreshedCartResponse = await request('', tokenA);
        refreshedCart = (await refreshedCartResponse.json()).cart.items;
        assert.deepEqual(refreshedCart, []);
        response = await request(`/items/${artworkB.id}`, tokenA, { method: 'DELETE' });
        assert.equal(response.status, 404);
    });

    await t.test('merges guest items idempotently into only the authenticated user cart', async () => {
        const body = JSON.stringify({ items: [{ artworkId: artworkB.id, quantity: 3 }] });
        let response = await request('/merge', tokenA, { method: 'POST', body });
        assert.equal(response.status, 200);
        response = await request('/merge', tokenA, { method: 'POST', body });
        assert.equal(response.status, 200);
        const buyerACart = (await response.json()).cart.items;
        assert.equal(buyerACart.find((item) => item.id === artworkB.id).quantity, 3);

        response = await request('', tokenB);
        assert.deepEqual((await response.json()).cart.items, []);
    });

    await t.test('database constraints prevent an item from referencing another user cart', async () => {
        const cartB = await prisma.cart.findUnique({ where: { userId: buyerB.id } });
        assert.ok(cartB);

        await assert.rejects(
            prisma.cartItem.create({
                data: {
                    userId: buyerA.id,
                    cartId: cartB.id,
                    artworkId: artworkForConstraint.id,
                    quantity: 1,
                },
            }),
            (error) => error.code === 'P2003'
        );
    });
});
