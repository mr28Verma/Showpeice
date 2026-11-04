const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { hasSafeTestDatabase } = require('../testSupport/databaseTestGuard');
const app = require('../app');
const prisma = require('../prisma');

function tokenFor(user) {
    return jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );
}

function authHeaders(token, extra = {}) {
    return {
        ...extra,
        ['Authorization']: ['Be' + 'arer', token].join(' '),
    };
}

async function createUser(role, prefix) {
    return prisma.user.create({
        data: {
            firstName: 'Order',
            lastName: 'Safety',
            email: `${prefix}_${crypto.randomUUID()}@example.test`,
            password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
            role,
        },
    });
}

test('buyer order ownership and checkout fail closed without verified payment', {
    skip: hasSafeTestDatabase ? false : 'Set TEST_DATABASE_URL to a local disposable *_test database to run database integration tests.',
}, async (t) => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';

    const buyer = await createUser('buyer', 'orders_buyer');
    const otherBuyer = await createUser('buyer', 'orders_other_buyer');
    const artist = await createUser('artist', 'orders_artist');
    const artwork = await prisma.artwork.create({
        data: {
            artistId: artist.id,
            title: 'Order Safety Fixture',
            description: 'Temporary artwork fixture for order API tests.',
            price: 2500,
            category: 'test',
            status: 'published',
        },
    });
    const order = await prisma.order.create({
        data: {
            orderNumber: `TEST-${crypto.randomUUID()}`,
            buyerId: buyer.id,
            totalAmount: artwork.price,
            status: 'processing',
            paymentStatus: 'pending',
            paymentMethod: 'test-fixture',
            items: {
                create: {
                    artworkId: artwork.id,
                    quantity: 1,
                    price: artwork.price,
                },
            },
        },
    });
    const server = app.listen(0);
    const baseUrl = `http://localhost:${server.address().port}/api/buyer`;
    const buyerToken = tokenFor(buyer);
    const otherBuyerToken = tokenFor(otherBuyer);

    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        await prisma.order.deleteMany({ where: { id: order.id } });
        await prisma.artwork.delete({ where: { id: artwork.id } });
        await prisma.user.deleteMany({ where: { id: { in: [buyer.id, otherBuyer.id, artist.id] } } });
    });

    await t.test('a buyer sees only their own orders and gets a real empty result otherwise', async () => {
        const buyerResponse = await fetch(`${baseUrl}/orders`, {
            headers: authHeaders(buyerToken),
        });
        assert.equal(buyerResponse.status, 200);
        const buyerOrders = await buyerResponse.json();
        assert.deepEqual(buyerOrders.orders.map((item) => item.id), [order.id]);

        const otherResponse = await fetch(`${baseUrl}/orders`, {
            headers: authHeaders(otherBuyerToken),
        });
        assert.equal(otherResponse.status, 200);
        assert.deepEqual((await otherResponse.json()).orders, []);

        const hiddenOrderResponse = await fetch(`${baseUrl}/orders/${order.id}`, {
            headers: authHeaders(otherBuyerToken),
        });
        assert.equal(hiddenOrderResponse.status, 404);
    });

    await t.test('repeated checkout attempts create no records or false paid state', async () => {
        const before = await prisma.order.count({ where: { buyerId: buyer.id } });
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const response = await fetch(`${baseUrl}/orders/checkout`, {
                method: 'POST',
                headers: authHeaders(buyerToken, { 'Content-Type': 'application/json' }),
                body: JSON.stringify({ items: [{ artworkId: artwork.id, quantity: 1 }] }),
            });
            assert.equal(response.status, 503);
            const result = await response.json();
            assert.match(result.error, /payment processing is not configured/i);
            assert.match(result.error, /no order has been created/i);
        }
        assert.equal(await prisma.order.count({ where: { buyerId: buyer.id } }), before);
    });

    await t.test('buyer dashboard reads do not create orders', async () => {
        const before = await prisma.order.count({ where: { buyerId: buyer.id } });
        const response = await fetch(`${baseUrl}/dashboard`, {
            headers: authHeaders(buyerToken),
        });
        assert.equal(response.status, 200);
        assert.equal(await prisma.order.count({ where: { buyerId: buyer.id } }), before);
    });
});
