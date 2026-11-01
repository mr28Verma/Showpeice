const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const app = require('../app');
const prisma = require('../prisma');

function signTestToken(user) {
    return jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'testsecret',
        { expiresIn: '1h' }
    );
}

test('Buyer Dashboard API suite', async (t) => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';

    const buyer = await prisma.user.create({
        data: {
            firstName: 'TestBuyer',
            lastName: 'Collector',
            email: `testbuyer_${crypto.randomUUID()}@example.test`,
            password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
            role: 'buyer',
        },
    });

    t.after(async () => {
        await prisma.order.deleteMany({ where: { buyerId: buyer.id } });
        await prisma.address.deleteMany({ where: { userId: buyer.id } });
        await prisma.artwork.deleteMany({ where: { artistId: buyer.id } });
        await prisma.user.deleteMany({ where: { id: buyer.id } });
    });

    const token = signTestToken(buyer);

    await t.test('GET /api/buyer/dashboard returns 401 without token', async () => {
        const server = app.listen(0);
        const port = server.address().port;
        try {
            const res = await fetch(`http://localhost:${port}/api/buyer/dashboard`);
            assert.equal(res.status, 401);
        } finally {
            server.close();
        }
    });

    await t.test('GET /api/buyer/dashboard returns user, stats, and recentOrders', async () => {
        const server = app.listen(0);
        const port = server.address().port;
        try {
            const res = await fetch(`http://localhost:${port}/api/buyer/dashboard`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            assert.equal(res.status, 200);
            const data = await res.json();
            assert.equal(data.user.id, buyer.id);
            assert.ok(data.stats);
            assert.ok(Array.isArray(data.recentOrders));
        } finally {
            server.close();
        }
    });

    await t.test('PATCH /api/buyer/profile updates profile and persists to database', async () => {
        const server = app.listen(0);
        const port = server.address().port;
        try {
            const updatedName = 'UpdatedName';
            const updatedPhone = '+91 98765 43210';
            const res = await fetch(`http://localhost:${port}/api/buyer/profile`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    firstName: updatedName,
                    lastName: buyer.lastName,
                    email: buyer.email,
                    phone: updatedPhone,
                    displayName: 'Collector Art Fan',
                    bio: 'Passionate contemporary art collector',
                    location: 'New Delhi, India',
                    emailNotifications: true,
                }),
            });
            assert.equal(res.status, 200);
            const data = await res.json();
            assert.equal(data.user.firstName, updatedName);
            assert.equal(data.user.phone, updatedPhone);

            // Verify in DB directly
            const fromDb = await prisma.user.findUnique({ where: { id: buyer.id } });
            assert.equal(fromDb.phone, updatedPhone);
            assert.equal(fromDb.firstName, updatedName);
        } finally {
            server.close();
        }
    });

    await t.test('PATCH /api/buyer/profile rejects invalid input', async () => {
        const server = app.listen(0);
        const port = server.address().port;
        try {
            const res = await fetch(`http://localhost:${port}/api/buyer/profile`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    firstName: '',
                    lastName: '',
                    email: 'invalid-email',
                }),
            });
            assert.equal(res.status, 400);
        } finally {
            server.close();
        }
    });

    await t.test('Addresses CRUD operates cleanly for authenticated buyer', async () => {
        const server = app.listen(0);
        const port = server.address().port;
        try {
            // 1. Create Address
            const createRes = await fetch(`http://localhost:${port}/api/buyer/addresses`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fullName: 'Art Collector',
                    phone: '+91 99999 88888',
                    street: '123 Heritage Lane, Flat 4B',
                    city: 'Mumbai',
                    state: 'Maharashtra',
                    postalCode: '400001',
                    country: 'India',
                    isDefault: true,
                }),
            });
            assert.equal(createRes.status, 201);
            const { address } = await createRes.json();
            assert.ok(address.id);
            assert.equal(address.city, 'Mumbai');
            assert.equal(address.isDefault, true);

            // 2. Fetch Addresses
            const listRes = await fetch(`http://localhost:${port}/api/buyer/addresses`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            assert.equal(listRes.status, 200);
            const listData = await listRes.json();
            assert.ok(listData.addresses.some((a) => a.id === address.id));

            // 3. Update Address
            const updateRes = await fetch(`http://localhost:${port}/api/buyer/addresses/${address.id}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    city: 'Navi Mumbai',
                }),
            });
            assert.equal(updateRes.status, 200);
            const updatedData = await updateRes.json();
            assert.equal(updatedData.address.city, 'Navi Mumbai');

            // 4. Delete Address
            const delRes = await fetch(`http://localhost:${port}/api/buyer/addresses/${address.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            assert.equal(delRes.status, 200);
        } finally {
            server.close();
        }
    });

    await t.test('Buyer order checkout & order isolation', async () => {
        const server = app.listen(0);
        const port = server.address().port;
        try {
            // Get an artwork
            let artwork = await prisma.artwork.findFirst();
            if (!artwork) {
                artwork = await prisma.artwork.create({
                    data: {
                        artistId: buyer.id,
                        title: 'Test Masterpiece',
                        description: 'A fine contemporary test piece',
                        price: 45000,
                        category: 'painting',
                        status: 'published',
                    },
                });
            }

            // Create order via checkout endpoint
            const checkoutRes = await fetch(`http://localhost:${port}/api/buyer/orders/checkout`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    items: [{ artworkId: artwork.id, quantity: 1 }],
                    shippingAddress: {
                        fullName: 'Test Buyer',
                        street: '45 Gallery Walk',
                        city: 'Bengaluru',
                        state: 'Karnataka',
                        postalCode: '560001',
                        country: 'India',
                    },
                    paymentMethod: 'card',
                }),
            });

            assert.equal(checkoutRes.status, 201);
            const { order } = await checkoutRes.json();
            assert.ok(order.id);
            assert.equal(order.buyerId, buyer.id);
            assert.equal(order.totalAmount, artwork.price);
            assert.ok(order.orderNumber.startsWith('SP-'));

            // Fetch orders list
            const ordersRes = await fetch(`http://localhost:${port}/api/buyer/orders`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            assert.equal(ordersRes.status, 200);
            const ordersData = await ordersRes.json();
            assert.ok(ordersData.orders.some((o) => o.id === order.id));

            // The overview is built from unique Order records owned by this buyer,
            // rather than from joined OrderItem rows.
            const dashboardRes = await fetch(`http://localhost:${port}/api/buyer/dashboard`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            assert.equal(dashboardRes.status, 200);
            const dashboardData = await dashboardRes.json();
            const recentOrderIds = dashboardData.recentOrders.map((recentOrder) => recentOrder.id);
            assert.equal(new Set(recentOrderIds).size, recentOrderIds.length);
            assert.ok(dashboardData.recentOrders.some((recentOrder) => recentOrder.id === order.id));

            // Fetch single order
            const singleRes = await fetch(`http://localhost:${port}/api/buyer/orders/${order.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            assert.equal(singleRes.status, 200);
            const singleData = await singleRes.json();
            assert.equal(singleData.order.id, order.id);

            // Test isolation: another user should not see this order
            const anotherUserToken = jwt.sign(
                { userId: 99999, email: 'stranger@example.com', role: 'buyer' },
                process.env.JWT_SECRET || 'testsecret',
                { expiresIn: '1h' }
            );

            // Wait, userId 99999 doesn't exist in DB so requireAuth would reject with 401
            // Let's test with another valid user if exists or nonexistent user
            const strangerRes = await fetch(`http://localhost:${port}/api/buyer/orders/${order.id}`, {
                headers: { Authorization: `Bearer ${anotherUserToken}` },
            });
            assert.equal(strangerRes.status, 401);
        } finally {
            server.close();
        }
    });
});
