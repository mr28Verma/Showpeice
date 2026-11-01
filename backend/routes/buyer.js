const express = require('express');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { Readable } = require('stream');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const requireAuth = require('../middleware/requireAuth');
const { requireBuyerAccess } = require('../middleware/requireRole');
const cloudinary = require('../config/cloudinary');

const router = express.Router();

const uploadTypes = {
    'image/png': {
        extension: 'png',
        signature: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    },
    'image/jpeg': {
        extension: 'jpg',
        signature: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    },
};

function uploadToCloudinary(buffer, mimeType, folder) {
    const type = uploadTypes[mimeType];
    if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 10 * 1024 * 1024 || !type || !type.signature(buffer)) {
        return Promise.resolve(null);
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        return Promise.resolve(null);
    }

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: 'image',
                allowed_formats: ['png', 'jpg', 'jpeg'],
            },
            (error, result) => {
                if (error) return reject(error);
                if (!result?.secure_url) return reject(new Error('Cloudinary did not return a secure image URL.'));
                return resolve(result);
            }
        );

        uploadStream.on('error', reject);
        Readable.from([buffer]).on('error', reject).pipe(uploadStream);
    });
}

async function saveUploadLocal(buffer, mimeType, directory) {
    const type = uploadTypes[mimeType];
    if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 10 * 1024 * 1024 || !type || !type.signature(buffer)) return null;
    const fileName = `${crypto.randomUUID()}.${type.extension}`;
    const targetDirectory = path.join(__dirname, '..', 'uploads', directory);
    await fs.mkdir(targetDirectory, { recursive: true });
    await fs.writeFile(path.join(targetDirectory, fileName), buffer, { flag: 'wx' });
    return `/uploads/${directory}/${fileName}`;
}

function validImageUrl(value) {
    if (value === null || value === '' || value === undefined) return true;
    if (typeof value !== 'string') return false;

    const localImagePattern = /^\/uploads\/(profiles|banners|artworks)\/[a-f0-9-]+\.(png|jpg|jpeg)$/i;
    if (localImagePattern.test(value)) return true;

    try {
        const url = new URL(value);
        return (
            (url.protocol === 'https:' || url.protocol === 'http:') &&
            (url.hostname.includes('cloudinary.com') || url.hostname.includes('unsplash.com') || url.hostname === 'localhost')
        );
    } catch {
        return false;
    }
}

function sanitizeUser(user) {
    if (!user) return null;
    return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || null,
        role: user.role,
        displayName: user.displayName || null,
        bio: user.bio || null,
        avatarUrl: user.avatarUrl || null,
        location: user.location || null,
        emailNotifications: Boolean(user.emailNotifications),
        createdAt: user.createdAt,
    };
}

function buyerArtworkImageUrl(artwork) {
    const imageUrl = typeof artwork?.imageUrl === 'string' ? artwork.imageUrl.trim() : '';
    if (!imageUrl) return null;

    // Original locally uploaded artwork files are deliberately not served publicly.
    // Return the generated preview route instead, while preserving valid remote URLs.
    if (/^\/uploads\/artworks\/[a-f0-9-]+\.(png|jpg|jpeg)$/i.test(imageUrl)) {
        return `/api/artworks/${artwork.id}/preview`;
    }

    return /^https?:\/\//i.test(imageUrl) ? imageUrl : null;
}

function serializeBuyerOrder(order) {
    return {
        ...order,
        items: order.items.map((item) => ({
            ...item,
            artwork: item.artwork
                ? { ...item.artwork, imageUrl: buyerArtworkImageUrl(item.artwork) }
                : null,
        })),
    };
}

// 1. GET /api/buyer/dashboard
router.get('/dashboard', requireAuth, requireBuyerAccess, async (req, res) => {
    const userId = req.authenticatedUser.id;

    try {
        const [orders, addressCount, statusCounts] = await Promise.all([
            prisma.order.findMany({
                where: { buyerId: userId },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: {
                    items: {
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
                                            id: true,
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
            }),
            prisma.address.count({ where: { userId } }),
            prisma.order.groupBy({
                by: ['status'],
                where: { buyerId: userId },
                _count: { _all: true },
            }),
        ]);

        const totalOrders = statusCounts.reduce((acc, row) => acc + row._count._all, 0);
        const activeOrders = statusCounts
            .filter((row) => ['pending', 'processing', 'shipped'].includes(row.status.toLowerCase()))
            .reduce((acc, row) => acc + row._count._all, 0);
        const deliveredOrders = statusCounts
            .filter((row) => row.status.toLowerCase() === 'delivered')
            .reduce((acc, row) => acc + row._count._all, 0);

        const paidAgg = await prisma.order.aggregate({
            where: { buyerId: userId, paymentStatus: 'paid' },
            _sum: { totalAmount: true },
        });

        const totalSpent = paidAgg._sum.totalAmount || 0;

        return res.json({
            user: sanitizeUser(req.authenticatedUser),
            stats: {
                totalOrders,
                activeOrders,
                deliveredOrders,
                totalSpent,
                savedAddresses: addressCount,
            },
            recentOrders: orders.map(serializeBuyerOrder),
        });
    } catch (error) {
        console.error('[buyer/dashboard] Error loading dashboard:', error);
        return res.status(500).json({ error: 'Failed to load buyer dashboard data.' });
    }
});

// 2. GET /api/buyer/profile
router.get('/profile', requireAuth, requireBuyerAccess, async (req, res) => {
    return res.json({ user: sanitizeUser(req.authenticatedUser) });
});

// 3. PATCH /api/buyer/profile
router.patch('/profile', requireAuth, requireBuyerAccess, async (req, res) => {
    const { firstName, lastName, email, phone, displayName, bio, location, avatarUrl, emailNotifications } = req.body || {};

    const cleanFirst = typeof firstName === 'string' ? firstName.trim() : '';
    const cleanLast = typeof lastName === 'string' ? lastName.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPhone = typeof phone === 'string' ? phone.trim() : null;
    const cleanDisplayName = typeof displayName === 'string' ? displayName.trim() : null;
    const cleanBio = typeof bio === 'string' ? bio.trim() : null;
    const cleanLocation = typeof location === 'string' ? location.trim() : null;

    if (!cleanFirst || cleanFirst.length > 80) {
        return res.status(400).json({ error: 'First name is required (up to 80 characters).' });
    }
    if (!cleanLast || cleanLast.length > 80) {
        return res.status(400).json({ error: 'Last name is required (up to 80 characters).' });
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) {
        return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (cleanPhone && (cleanPhone.length > 30 || !/^[+0-9\s\-()]{7,30}$/.test(cleanPhone))) {
        return res.status(400).json({ error: 'Provide a valid phone number (7-30 characters) or leave it empty.' });
    }
    if (cleanDisplayName && cleanDisplayName.length > 80) {
        return res.status(400).json({ error: 'Display name must not exceed 80 characters.' });
    }
    if (cleanBio && cleanBio.length > 2000) {
        return res.status(400).json({ error: 'Bio must not exceed 2000 characters.' });
    }
    if (cleanLocation && cleanLocation.length > 120) {
        return res.status(400).json({ error: 'Location must not exceed 120 characters.' });
    }
    if (avatarUrl !== undefined && !validImageUrl(avatarUrl)) {
        return res.status(400).json({ error: 'Provide a valid image URL for profile photo.' });
    }

    try {
        if (cleanEmail !== req.authenticatedUser.email) {
            const conflict = await prisma.user.findUnique({
                where: { email: cleanEmail },
                select: { id: true },
            });
            if (conflict && conflict.id !== req.authenticatedUser.id) {
                return res.status(409).json({ error: 'An account with this email address already exists.' });
            }
        }

        const updated = await prisma.user.update({
            where: { id: req.authenticatedUser.id },
            data: {
                firstName: cleanFirst,
                lastName: cleanLast,
                email: cleanEmail,
                phone: cleanPhone || null,
                displayName: cleanDisplayName || null,
                bio: cleanBio || null,
                location: cleanLocation || null,
                ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
                ...(typeof emailNotifications === 'boolean' ? { emailNotifications } : {}),
            },
        });

        return res.json({
            message: 'Profile updated successfully.',
            user: sanitizeUser(updated),
        });
    } catch (error) {
        console.error('[buyer/profile] Error updating profile:', error);
        return res.status(500).json({ error: 'Failed to update profile. Please try again.' });
    }
});

// 4. POST /api/buyer/uploads/avatar
router.post(
    '/uploads/avatar',
    requireAuth,
    requireBuyerAccess,
    express.raw({ type: ['image/png', 'image/jpeg'], limit: '10mb' }),
    async (req, res) => {
        try {
            const mimeType = req.get('content-type')?.split(';')[0].trim().toLowerCase();
            if (!mimeType || !uploadTypes[mimeType]) {
                return res.status(400).json({ error: 'Upload a valid PNG or JPEG image up to 10 MB.' });
            }

            let imageUrl = null;
            try {
                const cloudResult = await uploadToCloudinary(req.body, mimeType, 'showpeice/buyers/profiles');
                if (cloudResult?.secure_url) {
                    imageUrl = cloudResult.secure_url;
                }
            } catch (err) {
                console.warn('[buyer/avatar] Cloudinary upload failed, falling back to local:', err.message);
            }

            if (!imageUrl) {
                imageUrl = await saveUploadLocal(req.body, mimeType, 'profiles');
            }

            if (!imageUrl) {
                return res.status(400).json({ error: 'Could not process the uploaded avatar file.' });
            }

            await prisma.user.update({
                where: { id: req.authenticatedUser.id },
                data: { avatarUrl: imageUrl },
            });

            return res.status(201).json({ imageUrl });
        } catch (error) {
            console.error('[buyer/avatar] Avatar upload error:', error);
            return res.status(500).json({ error: 'Failed to upload profile photo.' });
        }
    }
);

// 5. PATCH /api/buyer/profile/password
router.patch('/profile/password', requireAuth, requireBuyerAccess, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};

    if (
        typeof currentPassword !== 'string' ||
        typeof newPassword !== 'string' ||
        newPassword.length < 8 ||
        newPassword.length > 128
    ) {
        return res.status(400).json({ error: 'Provide current password and a new password with at least 8 characters.' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: req.authenticatedUser.id },
            select: { password: true },
        });

        if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
            return res.status(400).json({ error: 'Current password is incorrect.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: req.authenticatedUser.id },
            data: { password: hashedPassword },
        });

        return res.json({ success: true, message: 'Password changed successfully.' });
    } catch (error) {
        console.error('[buyer/password] Error changing password:', error);
        return res.status(500).json({ error: 'Failed to update password.' });
    }
});

// 6. GET /api/buyer/orders
router.get('/orders', requireAuth, requireBuyerAccess, async (req, res) => {
    const userId = req.authenticatedUser.id;
    const { status } = req.query;

    const where = { buyerId: userId };
    if (typeof status === 'string' && status.trim() && status.toLowerCase() !== 'all') {
        where.status = { equals: status.trim().toLowerCase(), mode: 'insensitive' };
    }

    try {
        const orders = await prisma.order.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                address: true,
                items: {
                    include: {
                        artwork: {
                            select: {
                                id: true,
                                title: true,
                                price: true,
                                imageUrl: true,
                                isProtected: true,
                                category: true,
                                artist: {
                                    select: {
                                        id: true,
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

        return res.json({ orders: orders.map(serializeBuyerOrder) });
    } catch (error) {
        console.error('[buyer/orders] Error fetching orders:', error);
        return res.status(500).json({ error: 'Failed to load order history.' });
    }
});

// 7. GET /api/buyer/orders/:id
router.get('/orders/:id', requireAuth, requireBuyerAccess, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({ error: 'Invalid order ID.' });
    }

    try {
        const order = await prisma.order.findFirst({
            where: { id, buyerId: req.authenticatedUser.id },
            include: {
                address: true,
                items: {
                    include: {
                        artwork: {
                            select: {
                                id: true,
                                title: true,
                                description: true,
                                price: true,
                                imageUrl: true,
                                isProtected: true,
                                category: true,
                                artist: {
                                    select: {
                                        id: true,
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

        if (!order) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        return res.json({ order: serializeBuyerOrder(order) });
    } catch (error) {
        console.error('[buyer/orders] Error fetching single order:', error);
        return res.status(500).json({ error: 'Failed to load order details.' });
    }
});

// 8. GET /api/buyer/addresses
router.get('/addresses', requireAuth, requireBuyerAccess, async (req, res) => {
    try {
        const addresses = await prisma.address.findMany({
            where: { userId: req.authenticatedUser.id },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        });

        return res.json({ addresses });
    } catch (error) {
        console.error('[buyer/addresses] Error fetching addresses:', error);
        return res.status(500).json({ error: 'Failed to load addresses.' });
    }
});

// 9. POST /api/buyer/addresses
router.post('/addresses', requireAuth, requireBuyerAccess, async (req, res) => {
    const { fullName, phone, street, city, state, postalCode, country, isDefault } = req.body || {};

    const cleanName = typeof fullName === 'string' ? fullName.trim() : '';
    const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
    const cleanStreet = typeof street === 'string' ? street.trim() : '';
    const cleanCity = typeof city === 'string' ? city.trim() : '';
    const cleanState = typeof state === 'string' ? state.trim() : '';
    const cleanPostal = typeof postalCode === 'string' ? postalCode.trim() : '';
    const cleanCountry = typeof country === 'string' && country.trim() ? country.trim() : 'India';

    if (!cleanName || cleanName.length > 100) {
        return res.status(400).json({ error: 'Recipient name is required (up to 100 characters).' });
    }
    if (!cleanStreet || cleanStreet.length > 255) {
        return res.status(400).json({ error: 'Street address is required (up to 255 characters).' });
    }
    if (!cleanCity || cleanCity.length > 100) {
        return res.status(400).json({ error: 'City is required (up to 100 characters).' });
    }
    if (!cleanState || cleanState.length > 100) {
        return res.status(400).json({ error: 'State is required (up to 100 characters).' });
    }
    if (!cleanPostal || cleanPostal.length > 20) {
        return res.status(400).json({ error: 'Postal / PIN code is required (up to 20 characters).' });
    }

    try {
        const userId = req.authenticatedUser.id;

        const count = await prisma.address.count({ where: { userId } });
        const shouldBeDefault = Boolean(isDefault) || count === 0;

        if (shouldBeDefault) {
            await prisma.address.updateMany({
                where: { userId },
                data: { isDefault: false },
            });
        }

        const address = await prisma.address.create({
            data: {
                userId,
                fullName: cleanName,
                phone: cleanPhone || null,
                street: cleanStreet,
                city: cleanCity,
                state: cleanState,
                postalCode: cleanPostal,
                country: cleanCountry,
                isDefault: shouldBeDefault,
            },
        });

        return res.status(201).json({ address });
    } catch (error) {
        console.error('[buyer/addresses] Error creating address:', error);
        return res.status(500).json({ error: 'Failed to save address.' });
    }
});

// 10. PATCH /api/buyer/addresses/:id
router.patch('/addresses/:id', requireAuth, requireBuyerAccess, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({ error: 'Invalid address ID.' });
    }

    const { fullName, phone, street, city, state, postalCode, country, isDefault } = req.body || {};

    const cleanName = typeof fullName === 'string' ? fullName.trim() : undefined;
    const cleanPhone = typeof phone === 'string' ? phone.trim() : undefined;
    const cleanStreet = typeof street === 'string' ? street.trim() : undefined;
    const cleanCity = typeof city === 'string' ? city.trim() : undefined;
    const cleanState = typeof state === 'string' ? state.trim() : undefined;
    const cleanPostal = typeof postalCode === 'string' ? postalCode.trim() : undefined;
    const cleanCountry = typeof country === 'string' ? country.trim() : undefined;

    try {
        const existing = await prisma.address.findFirst({
            where: { id, userId: req.authenticatedUser.id },
        });

        if (!existing) {
            return res.status(404).json({ error: 'Address not found.' });
        }

        if (isDefault === true) {
            await prisma.address.updateMany({
                where: { userId: req.authenticatedUser.id },
                data: { isDefault: false },
            });
        }

        const updated = await prisma.address.update({
            where: { id },
            data: {
                ...(cleanName !== undefined ? { fullName: cleanName } : {}),
                ...(cleanPhone !== undefined ? { phone: cleanPhone || null } : {}),
                ...(cleanStreet !== undefined ? { street: cleanStreet } : {}),
                ...(cleanCity !== undefined ? { city: cleanCity } : {}),
                ...(cleanState !== undefined ? { state: cleanState } : {}),
                ...(cleanPostal !== undefined ? { postalCode: cleanPostal } : {}),
                ...(cleanCountry !== undefined ? { country: cleanCountry } : {}),
                ...(typeof isDefault === 'boolean' ? { isDefault } : {}),
            },
        });

        return res.json({ address: updated });
    } catch (error) {
        console.error('[buyer/addresses] Error updating address:', error);
        return res.status(500).json({ error: 'Failed to update address.' });
    }
});

// 11. DELETE /api/buyer/addresses/:id
router.delete('/addresses/:id', requireAuth, requireBuyerAccess, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({ error: 'Invalid address ID.' });
    }

    try {
        const existing = await prisma.address.findFirst({
            where: { id, userId: req.authenticatedUser.id },
        });

        if (!existing) {
            return res.status(404).json({ error: 'Address not found.' });
        }

        await prisma.address.delete({ where: { id } });

        if (existing.isDefault) {
            const nextAddress = await prisma.address.findFirst({
                where: { userId: req.authenticatedUser.id },
                orderBy: { createdAt: 'desc' },
            });
            if (nextAddress) {
                await prisma.address.update({
                    where: { id: nextAddress.id },
                    data: { isDefault: true },
                });
            }
        }

        return res.json({ success: true, message: 'Address removed.' });
    } catch (error) {
        console.error('[buyer/addresses] Error deleting address:', error);
        return res.status(500).json({ error: 'Failed to delete address.' });
    }
});

// 12. POST /api/buyer/orders/checkout (Create order from items)
router.post('/orders/checkout', requireAuth, requireBuyerAccess, async (req, res) => {
    const userId = req.authenticatedUser.id;
    const { items, addressId, shippingAddress, paymentMethod = 'card' } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Cart is empty. Add artworks to checkout.' });
    }

    try {
        const artworkIds = items.map((i) => Number(i.artworkId)).filter((id) => Number.isSafeInteger(id) && id > 0);
        if (artworkIds.length !== items.length) {
            return res.status(400).json({ error: 'Invalid artwork items in order request.' });
        }

        const artworks = await prisma.artwork.findMany({
            where: { id: { in: artworkIds } },
            select: { id: true, title: true, price: true, available: true, status: true },
        });

        if (artworks.length === 0) {
            return res.status(400).json({ error: 'None of the requested artworks were found.' });
        }

        const artworkMap = new Map(artworks.map((a) => [a.id, a]));

        let totalAmount = 0;
        const validatedItems = [];

        for (const item of items) {
            const art = artworkMap.get(Number(item.artworkId));
            if (!art) {
                return res.status(400).json({ error: `Artwork #${item.artworkId} is no longer available.` });
            }
            const qty = Math.max(1, Number(item.quantity) || 1);
            const linePrice = art.price;
            totalAmount += linePrice * qty;
            validatedItems.push({
                artworkId: art.id,
                quantity: qty,
                price: linePrice,
            });
        }

        let addressSnapshot = shippingAddress;
        let selectedAddressId = null;

        if (addressId) {
            const saved = await prisma.address.findFirst({
                where: { id: Number(addressId), userId },
            });
            if (saved) {
                selectedAddressId = saved.id;
                addressSnapshot = {
                    fullName: saved.fullName,
                    phone: saved.phone,
                    street: saved.street,
                    city: saved.city,
                    state: saved.state,
                    postalCode: saved.postalCode,
                    country: saved.country,
                };
            }
        }

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
        const orderNumber = `SP-${dateStr}-${randomSuffix}`;

        const estimatedDelivery = new Date();
        estimatedDelivery.setDate(estimatedDelivery.getDate() + 5);

        const newOrder = await prisma.$transaction(async (tx) => {
            const order = await tx.order.create({
                data: {
                    orderNumber,
                    buyerId: userId,
                    totalAmount,
                    status: 'processing',
                    paymentStatus: 'paid',
                    paymentMethod,
                    addressId: selectedAddressId,
                    shippingAddress: addressSnapshot || null,
                    trackingNumber: `TRK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
                    estimatedDelivery,
                    items: {
                        create: validatedItems,
                    },
                },
                include: {
                    items: {
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
                                            id: true,
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

            return order;
        });

        return res.status(201).json({
            message: 'Order created successfully.',
            order: serializeBuyerOrder(newOrder),
        });
    } catch (error) {
        console.error('[buyer/checkout] Checkout failed:', error);
        return res.status(500).json({ error: 'Order could not be placed. Please try again.' });
    }
});

module.exports = router;
