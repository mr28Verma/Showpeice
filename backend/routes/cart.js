const express = require('express');
const prisma = require('../prisma');
const requireAuth = require('../middleware/requireAuth');
const { isDatabaseUnavailable } = require('../utils/databaseErrors');

const router = express.Router();
const MAX_CART_QUANTITY = 10;

router.use(requireAuth);
router.use((req, res, next) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : {};

    if ('userId' in req.query || 'cartId' in req.query || 'userId' in body || 'cartId' in body) {
        return res.status(400).json({ error: 'Cart ownership is determined by your authenticated session.' });
    }

    return next();
});

function artworkImageUrl(artwork) {
    const imageUrl = typeof artwork.imageUrl === 'string' ? artwork.imageUrl.trim() : '';
    if (/^\/uploads\/artworks\/[a-f0-9-]+\.(png|jpg|jpeg)$/i.test(imageUrl)) {
        return `/api/artworks/${artwork.id}/preview`;
    }
    return /^https?:\/\//i.test(imageUrl) ? imageUrl : null;
}

function serializeCart(cart) {
    return {
        items: (cart?.items || []).map(({ artwork, quantity }) => ({
            id: artwork.id,
            title: artwork.title,
            artist: artwork.artist.displayName?.trim() ||
                `${artwork.artist.firstName} ${artwork.artist.lastName}`.trim(),
            price: artwork.price,
            image: artworkImageUrl(artwork),
            isProtected: artwork.isProtected,
            quantity,
        })),
    };
}

function validArtworkId(value) {
    return Number.isSafeInteger(value) && value > 0;
}

function validQuantity(value) {
    return Number.isSafeInteger(value) && value >= 1 && value <= MAX_CART_QUANTITY;
}

function cartErrorCode(error) {
    if (typeof error?.code === 'string' && (/^P\d{4}$/.test(error.code) || error.code === 'CART_CLIENT_STALE')) {
        return error.code;
    }

    return 'CART_INTERNAL_ERROR';
}

function cartErrorDetails(error) {
    const code = cartErrorCode(error);
    const table = typeof error?.meta?.table === 'string' ? error.meta.table : null;
    return table ? `${code} (table: ${table})` : code;
}

function assertCartClient(client) {
    if (!client?.cart || !client?.cartItem) {
        const error = new Error('The generated Prisma client does not include cart models.');
        error.code = 'CART_CLIENT_STALE';
        throw error;
    }
}

async function getCart(userId, client = prisma) {
    assertCartClient(client);
    return client.cart.findUnique({
        where: { userId },
        include: {
            items: {
                orderBy: { createdAt: 'asc' },
                include: {
                    artwork: {
                        select: {
                            id: true,
                            title: true,
                            price: true,
                            imageUrl: true,
                            isProtected: true,
                            artist: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    displayName: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });
}

async function ensureCart(client, userId) {
    assertCartClient(client);
    return client.cart.upsert({
        where: { userId },
        create: { userId },
        update: {},
    });
}

async function runCartTransaction(operation) {
    for (let attempt = 0; ; attempt += 1) {
        try {
            return await prisma.$transaction(operation);
        } catch (error) {
            if (error?.code !== 'P2002' || attempt >= 1) throw error;
        }
    }
}

async function findAvailableArtworks(client, artworkIds) {
    const artworks = await client.artwork.findMany({
        where: {
            id: { in: artworkIds },
            available: true,
            status: { equals: 'published', mode: 'insensitive' },
        },
        select: { id: true },
    });

    return new Set(artworks.map((artwork) => artwork.id));
}

async function loadCurrentCart(req, res) {
    try {
        return res.json({ cart: serializeCart(await getCart(req.authenticatedUser.id)) });
    } catch (error) {
        const code = cartErrorCode(error);
        console.error('[cart/get] Failed to load cart:', cartErrorDetails(error));
        return res.status(isDatabaseUnavailable(error) ? 503 : 500).json({
            error: 'Failed to load your shopping bag.',
            ...(process.env.NODE_ENV !== 'production' ? { code } : {}),
        });
    }
}

router.get('/', loadCurrentCart);
router.get('/items', loadCurrentCart);

router.post('/items', async (req, res) => {
    const { artworkId } = req.body || {};
    if (!validArtworkId(artworkId)) {
        return res.status(400).json({ error: 'A valid artwork ID is required.' });
    }

    try {
        assertCartClient(prisma);
        await runCartTransaction(async (transaction) => {
            const userId = req.authenticatedUser.id;
            const availableArtworks = await findAvailableArtworks(transaction, [artworkId]);
            if (!availableArtworks.has(artworkId)) {
                const error = new Error('This artwork is unavailable for shopping.');
                error.status = 404;
                throw error;
            }

            const cart = await ensureCart(transaction, userId);
            const incremented = await transaction.cartItem.updateMany({
                where: { userId, artworkId, quantity: { lt: MAX_CART_QUANTITY } },
                data: { quantity: { increment: 1 } },
            });

            if (!incremented.count) {
                const existing = await transaction.cartItem.findUnique({
                    where: { userId_artworkId: { userId, artworkId } },
                });
                if (existing) return;
                await transaction.cartItem.create({
                    data: { userId, cartId: cart.id, artworkId, quantity: 1 },
                });
            }
        });

        return res.json({ cart: serializeCart(await getCart(req.authenticatedUser.id)) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ error: error.message });
        const code = cartErrorCode(error);
        console.error('[cart/add] Failed to add artwork:', cartErrorDetails(error));
        return res.status(isDatabaseUnavailable(error) ? 503 : 500).json({
            error: 'Failed to add artwork to your shopping bag.',
            ...(process.env.NODE_ENV !== 'production' ? { code } : {}),
        });
    }
});

router.post('/merge', async (req, res) => {
    const items = req.body?.items;
    if (!Array.isArray(items) || items.length > 200 ||
        items.some((item) => !item || !validArtworkId(item.artworkId) || !validQuantity(item.quantity))) {
        return res.status(400).json({ error: 'The guest shopping bag contains invalid items.' });
    }

    const uniqueItems = new Map();
    for (const item of items) {
        const quantity = (uniqueItems.get(item.artworkId) || 0) + item.quantity;
        uniqueItems.set(item.artworkId, Math.min(MAX_CART_QUANTITY, quantity));
    }
    const artworkIds = [...uniqueItems.keys()];

    try {
        assertCartClient(prisma);
        await runCartTransaction(async (transaction) => {
            const userId = req.authenticatedUser.id;
            const availableArtworks = await findAvailableArtworks(transaction, artworkIds);
            if (availableArtworks.size !== artworkIds.length) {
                const error = new Error('One or more guest artworks are unavailable.');
                error.status = 400;
                throw error;
            }

            const cart = await ensureCart(transaction, userId);
            for (const [artworkId, quantity] of uniqueItems) {
                await transaction.cartItem.upsert({
                    where: { userId_artworkId: { userId, artworkId } },
                    create: { userId, cartId: cart.id, artworkId, quantity },
                    update: {},
                });
                await transaction.cartItem.updateMany({
                    where: { userId, artworkId, quantity: { lt: quantity } },
                    data: { quantity },
                });
            }
        });

        return res.json({ cart: serializeCart(await getCart(req.authenticatedUser.id)) });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ error: error.message });
        const code = cartErrorCode(error);
        console.error('[cart/merge] Failed to merge guest cart:', cartErrorDetails(error));
        return res.status(isDatabaseUnavailable(error) ? 503 : 500).json({
            error: 'Failed to merge your guest shopping bag.',
            ...(process.env.NODE_ENV !== 'production' ? { code } : {}),
        });
    }
});

router.patch('/items/:artworkId', async (req, res) => {
    const artworkId = Number(req.params.artworkId);
    const { quantity } = req.body || {};
    if (!validArtworkId(artworkId) || !validQuantity(quantity)) {
        return res.status(400).json({ error: 'A valid artwork ID and quantity are required.' });
    }

    try {
        assertCartClient(prisma);
        const result = await prisma.cartItem.updateMany({
            where: { userId: req.authenticatedUser.id, artworkId },
            data: { quantity },
        });
        if (!result.count) return res.status(404).json({ error: 'Artwork not found in your shopping bag.' });

        return res.json({ cart: serializeCart(await getCart(req.authenticatedUser.id)) });
    } catch (error) {
        const code = cartErrorCode(error);
        console.error('[cart/update] Failed to update cart item:', cartErrorDetails(error));
        return res.status(isDatabaseUnavailable(error) ? 503 : 500).json({
            error: 'Failed to update your shopping bag.',
            ...(process.env.NODE_ENV !== 'production' ? { code } : {}),
        });
    }
});

router.delete('/items/:artworkId', async (req, res) => {
    const artworkId = Number(req.params.artworkId);
    if (!validArtworkId(artworkId)) {
        return res.status(400).json({ error: 'A valid artwork ID is required.' });
    }

    try {
        assertCartClient(prisma);
        const result = await prisma.cartItem.deleteMany({
            where: { userId: req.authenticatedUser.id, artworkId },
        });
        if (!result.count) return res.status(404).json({ error: 'Artwork not found in your shopping bag.' });

        return res.json({ cart: serializeCart(await getCart(req.authenticatedUser.id)) });
    } catch (error) {
        const code = cartErrorCode(error);
        console.error('[cart/remove] Failed to remove cart item:', cartErrorDetails(error));
        return res.status(isDatabaseUnavailable(error) ? 503 : 500).json({
            error: 'Failed to remove artwork from your shopping bag.',
            ...(process.env.NODE_ENV !== 'production' ? { code } : {}),
        });
    }
});

router.all('/items/:artworkId', (req, res) => {
    res.set('Allow', 'PATCH, DELETE');
    return res.status(405).json({ error: 'Use PATCH to change quantity or DELETE to remove this artwork from your shopping bag.' });
});

router.delete('/', async (req, res) => {
    try {
        assertCartClient(prisma);
        await prisma.cartItem.deleteMany({ where: { userId: req.authenticatedUser.id } });
        return res.json({ cart: { items: [] } });
    } catch (error) {
        const code = cartErrorCode(error);
        console.error('[cart/clear] Failed to clear cart:', cartErrorDetails(error));
        return res.status(isDatabaseUnavailable(error) ? 503 : 500).json({
            error: 'Failed to clear your shopping bag.',
            ...(process.env.NODE_ENV !== 'production' ? { code } : {}),
        });
    }
});

module.exports = router;
