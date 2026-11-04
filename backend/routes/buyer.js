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
        orderNotifications: user.orderNotifications !== false,
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
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const has = (field) => Object.prototype.hasOwnProperty.call(body, field);
    const data = {};

    for (const [field, label] of [['firstName', 'First name'], ['lastName', 'Last name']]) {
        if (!has(field)) continue;
        const value = typeof body[field] === 'string' ? body[field].trim() : '';
        if (!value || value.length > 80) {
            return res.status(400).json({ error: `${label} is required (up to 80 characters).` });
        }
        data[field] = value;
    }

    if (has('email')) {
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
            return res.status(400).json({ error: 'A valid email address is required.' });
        }
        data.email = email;
    }

    if (has('phone')) {
        const phone = body.phone === null ? '' : typeof body.phone === 'string' ? body.phone.trim() : null;
        if (phone === null || (phone && (phone.length > 30 || !/^[+0-9\s\-()]{7,30}$/.test(phone)))) {
            return res.status(400).json({ error: 'Provide a valid phone number (7-30 characters) or leave it empty.' });
        }
        data.phone = phone || null;
    }

    for (const [field, label, maxLength] of [
        ['displayName', 'Display name', 80],
        ['bio', 'Bio', 2000],
        ['location', 'Location', 120],
    ]) {
        if (!has(field)) continue;
        const value = body[field] === null ? '' : typeof body[field] === 'string' ? body[field].trim() : null;
        if (value === null || value.length > maxLength) {
            return res.status(400).json({ error: `${label} must not exceed ${maxLength} characters.` });
        }
        data[field] = value || null;
    }

    if (has('avatarUrl')) {
        if (body.avatarUrl !== null && body.avatarUrl !== '' && !validImageUrl(body.avatarUrl)) {
            return res.status(400).json({ error: 'Provide a valid image URL for profile photo.' });
        }
        data.avatarUrl = body.avatarUrl || null;
    }
    for (const [field, label] of [
        ['emailNotifications', 'Curated artwork email preference'],
        ['orderNotifications', 'Order update email preference'],
    ]) {
        if (!has(field)) continue;
        if (typeof body[field] !== 'boolean') {
            return res.status(400).json({ error: `${label} must be true or false.` });
        }
        data[field] = body[field];
    }

    if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'Provide at least one profile field to update.' });
    }

    try {
        if (data.email && data.email !== req.authenticatedUser.email) {
            const conflict = await prisma.user.findUnique({
                where: { email: data.email },
                select: { id: true },
            });
            if (conflict && conflict.id !== req.authenticatedUser.id) {
                return res.status(409).json({ error: 'An account with this email address already exists.' });
            }
        }

        const updated = await prisma.user.update({
            where: { id: req.authenticatedUser.id },
            data,
        });

        return res.json({
            message: 'Profile updated successfully.',
            user: sanitizeUser(updated),
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'An account with this email address already exists.' });
        }
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

    if (isDefault !== undefined && typeof isDefault !== 'boolean') {
        return res.status(400).json({ error: 'Default address must be true or false.' });
    }

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
    if (cleanPhone && (cleanPhone.length > 30 || !/^[+0-9\s\-()]{7,30}$/.test(cleanPhone))) {
        return res.status(400).json({ error: 'Provide a valid phone number (7-30 characters) or leave it empty.' });
    }
    if (cleanCountry.length > 100) {
        return res.status(400).json({ error: 'Country must not exceed 100 characters.' });
    }

    try {
        const userId = req.authenticatedUser.id;
        const address = await prisma.$transaction(async (transaction) => {
            const count = await transaction.address.count({ where: { userId } });
            const shouldBeDefault = isDefault === true || count === 0;

            if (shouldBeDefault) {
                await transaction.address.updateMany({
                    where: { userId },
                    data: { isDefault: false },
                });
            }

            return transaction.address.create({
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

    if (isDefault !== undefined && typeof isDefault !== 'boolean') {
        return res.status(400).json({ error: 'Default address must be true or false.' });
    }
    if (Object.keys(req.body || {}).length === 0) {
        return res.status(400).json({ error: 'Provide at least one address field to update.' });
    }
    if (cleanName !== undefined && (!cleanName || cleanName.length > 100)) {
        return res.status(400).json({ error: 'Recipient name is required (up to 100 characters).' });
    }
    if (cleanPhone !== undefined && cleanPhone && (cleanPhone.length > 30 || !/^[+0-9\s\-()]{7,30}$/.test(cleanPhone))) {
        return res.status(400).json({ error: 'Provide a valid phone number (7-30 characters) or leave it empty.' });
    }
    if (cleanStreet !== undefined && (!cleanStreet || cleanStreet.length > 255)) {
        return res.status(400).json({ error: 'Street address is required (up to 255 characters).' });
    }
    if (cleanCity !== undefined && (!cleanCity || cleanCity.length > 100)) {
        return res.status(400).json({ error: 'City is required (up to 100 characters).' });
    }
    if (cleanState !== undefined && (!cleanState || cleanState.length > 100)) {
        return res.status(400).json({ error: 'State is required (up to 100 characters).' });
    }
    if (cleanPostal !== undefined && (!cleanPostal || cleanPostal.length > 20)) {
        return res.status(400).json({ error: 'Postal / PIN code is required (up to 20 characters).' });
    }
    if (cleanCountry !== undefined && (!cleanCountry || cleanCountry.length > 100)) {
        return res.status(400).json({ error: 'Country is required (up to 100 characters).' });
    }

    try {
        const updated = await prisma.$transaction(async (transaction) => {
            const existing = await transaction.address.findFirst({
                where: { id, userId: req.authenticatedUser.id },
            });
            if (!existing) return null;

            if (isDefault === true) {
                await transaction.address.updateMany({
                    where: { userId: req.authenticatedUser.id },
                    data: { isDefault: false },
                });
            }

            return transaction.address.update({
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
        });
        if (!updated) return res.status(404).json({ error: 'Address not found.' });

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
        const deleted = await prisma.$transaction(async (transaction) => {
            const existing = await transaction.address.findFirst({
                where: { id, userId: req.authenticatedUser.id },
            });
            if (!existing) return false;

            await transaction.address.delete({ where: { id } });

            if (existing.isDefault) {
                const nextAddress = await transaction.address.findFirst({
                    where: { userId: req.authenticatedUser.id },
                    orderBy: { createdAt: 'desc' },
                });
                if (nextAddress) {
                    await transaction.address.update({
                        where: { id: nextAddress.id },
                        data: { isDefault: true },
                    });
                }
            }
            return true;
        });
        if (!deleted) return res.status(404).json({ error: 'Address not found.' });

        return res.json({ success: true, message: 'Address removed.' });
    } catch (error) {
        console.error('[buyer/addresses] Error deleting address:', error);
        return res.status(500).json({ error: 'Failed to delete address.' });
    }
});

// Checkout must stay closed until a server-verified payment provider is configured.
router.post('/orders/checkout', requireAuth, requireBuyerAccess, (_req, res) => {
    return res.status(503).json({
        error: 'Secure payment processing is not configured. No order has been created.',
    });
});

module.exports = router;
