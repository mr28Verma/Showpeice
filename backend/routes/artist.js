const express = require('express');
const { Readable } = require('stream');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const sharp = require('sharp');
const prisma = require('../prisma');
const requireAuth = require('../middleware/requireAuth');
const { requireArtistAccess } = require('../middleware/requireRole');
const { getArtistSlugMap } = require('../utils/artistSlugs');
const cloudinary = require('../config/cloudinary');
const { isDatabaseUnavailable } = require('../utils/databaseErrors');
const { createArtworkPreview } = require('../utils/artworkPreview');
const {
    isCloudinaryArtworkUrl,
    cloudinaryArtworkPublicId,
} = require('../utils/cloudinaryArtwork');

const router = express.Router();
const artworkUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter(_req, file, callback) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
            return callback(new Error('Upload a PNG, JPEG, or WebP image.'));
        }
        return callback(null, true);
    },
});
const uploadTypes = {
    'image/png': { extension: 'png', signature: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
    'image/jpeg': { extension: 'jpg', signature: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
    'image/webp': { extension: 'webp', signature: (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' },
};
const artworkSelect = {
    id: true,
    title: true,
    description: true,
    price: true,
    category: true,
    imageUrl: true,
    isProtected: true,
    available: true,
    status: true,
    createdAt: true,
    updatedAt: true,
};

function addStudioPreviewUrl(artwork, artistId) {
    if (!artwork.imageUrl) return { ...artwork, imagePreviewUrl: null };
    if (artwork.status === 'published' && !artwork.isProtected && isCloudinaryArtworkUrl(artwork.imageUrl)) {
        return { ...artwork, imagePreviewUrl: artwork.imageUrl };
    }
    const token = jwt.sign(
        { purpose: 'artwork-preview', artworkId: artwork.id, artistId },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
    );
    return {
        ...artwork,
        imagePreviewUrl: `/api/artworks/${artwork.id}/preview?token=${encodeURIComponent(token)}`,
    };
}

function artworkInput(body, imageUrl, { allowLegacyImage = false } = {}) {
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const category = typeof body?.category === 'string' ? body.category.trim() : '';
    const price = Number(body?.price);
    const available = body?.available === true || body?.available === 'true'
        ? true
        : body?.available === false || body?.available === 'false'
            ? false
            : undefined;
    const status = body?.status;
    const isProtected = body?.isProtected === true || body?.isProtected === 'true'
        ? true
        : body?.isProtected === false || body?.isProtected === 'false'
            ? false
            : undefined;
    const localImageUrl = typeof imageUrl === 'string' &&
        /^\/uploads\/artworks\/[a-f0-9-]+\.(png|jpg|jpeg|pdf)$/i.test(imageUrl);

    if (!title || title.length > 120 || !description || !category ||
        !Number.isSafeInteger(price) || price < 1 || price > 2147483647 ||
        typeof available !== 'boolean' || !['draft', 'published'].includes(status) ||
        (body?.isProtected !== undefined && typeof isProtected !== 'boolean') ||
        (!isCloudinaryArtworkUrl(imageUrl) && !(allowLegacyImage && localImageUrl))) {
        return null;
    }

    return { title, description, category, price, available, status, imageUrl, ...(isProtected === undefined ? {} : { isProtected }) };
}


function uploadToCloudinary(buffer, mimeType, folder) {
    const type = uploadTypes[mimeType];
    if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 10 * 1024 * 1024 || !type || !type.signature(buffer)) {
        return Promise.resolve(null);
    }
    if (!cloudinary.isConfigured) {
        const error = new Error('Image storage is not configured.');
        error.code = 'CLOUDINARY_NOT_CONFIGURED';
        error.status = 503;
        return Promise.reject(error);
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

function receiveArtworkUpload(req, res, next) {
    artworkUpload.single('image')(req, res, (error) => {
        if (!error) return next();
        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'Artwork images must be 10 MB or smaller.' });
        }
        if (error instanceof multer.MulterError) {
            return res.status(400).json({ error: 'Select one artwork image using the image field.' });
        }
        return res.status(422).json({ error: error.message || 'Upload a PNG, JPEG, or WebP image.' });
    });
}

async function uploadArtworkToCloudinary(file) {
    const type = uploadTypes[file?.mimetype];
    if (!type || !Buffer.isBuffer(file.buffer) || !file.buffer.length || file.buffer.length > 10 * 1024 * 1024 || !type.signature(file.buffer)) {
        const error = new Error('Upload a valid PNG, JPEG, or WebP image up to 10 MB.');
        error.status = 422;
        throw error;
    }

    let metadata;
    try {
        metadata = await sharp(file.buffer, { limitInputPixels: 40_000_000 }).metadata();
    } catch {
        const error = new Error('The selected file is not a valid image.');
        error.status = 422;
        throw error;
    }
    const expectedFormat = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' }[file.mimetype];
    if (metadata.format !== expectedFormat) {
        const error = new Error('The file contents do not match the selected image type.');
        error.status = 422;
        throw error;
    }

    if (!cloudinary.isConfigured) {
        const error = new Error('Image storage is not configured.');
        error.code = 'CLOUDINARY_NOT_CONFIGURED';
        error.status = 503;
        throw error;
    }

    const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'showpeice/artworks',
                resource_type: 'image',
                allowed_formats: ['png', 'jpg', 'jpeg', 'webp'],
            },
            (error, uploadResult) => {
                if (error) return reject(error);
                return resolve(uploadResult);
            }
        );
        uploadStream.on('error', reject);
        Readable.from([file.buffer]).on('error', reject).pipe(uploadStream);
    });

    const urlPublicId = cloudinaryArtworkPublicId(result?.secure_url);
    if (!result?.secure_url || !result?.public_id || !urlPublicId || result.public_id !== urlPublicId) {
        if (typeof result?.public_id === 'string') await removeUnattachedCloudinaryImage(result.public_id);
        const error = new Error('Cloudinary did not return a valid artwork image URL.');
        error.code = 'CLOUDINARY_INVALID_RESULT';
        throw error;
    }
    return result;
}

async function removeUnattachedCloudinaryImage(publicId) {
    if (typeof publicId !== 'string' || !publicId.startsWith('showpeice/artworks/')) return;
    try {
        const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        if (!['ok', 'not found'].includes(result?.result)) {
            console.error('[artist/artworks] Uploaded image cleanup was not confirmed:', result?.result || 'unknown result');
        }
    } catch (error) {
        logCloudinaryUploadFailure('Cleanup', error);
    }
}

async function removeUnusedCloudinaryArtwork(publicId) {
    if (typeof publicId !== 'string' || !publicId.startsWith('showpeice/artworks/')) return;

    try {
        const references = await prisma.artwork.count({ where: { imagePublicId: publicId } });
        if (references === 0) await removeUnattachedCloudinaryImage(publicId);
    } catch (error) {
        console.error('[artist/artworks] Could not verify image references before cleanup:', error.code || error.name || 'unknown error');
    }
}

function redactUploadDiagnostic(value) {
    let diagnostic = String(value);

    for (const variable of ['CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'JWT_SECRET']) {
        const secret = process.env[variable];
        if (secret) diagnostic = diagnostic.split(secret).join('[redacted]');
    }

    return diagnostic
        .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
        .replace(/(authorization\s*[:=]\s*)[^\r\n]+/gi, '$1[redacted]')
        .replace(/(api[_ -]?(?:key|secret)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]');
}

function logCloudinaryUploadFailure(label, error) {
    const code = error?.http_code || error?.statusCode || error?.code || error?.name || 'unknown error';
    console.error(`[artist/uploads] ${label} image upload failed (${code})`);

    if (process.env.NODE_ENV !== 'production') {
        const nestedErrors = Array.isArray(error?.errors)
            ? error.errors.map((item) => item?.stack || item?.message || item?.code).filter(Boolean)
            : [];
        const diagnostic = [error?.message, error?.error?.message, ...nestedErrors, error?.stack]
            .filter(Boolean)
            .join('\n');
        if (diagnostic) console.error(redactUploadDiagnostic(diagnostic));
    }
}

function cloudinaryUploadFailure(error) {
    const status = Number(error?.http_code || error?.statusCode || error?.status);
    const code = String(error?.code || '').toUpperCase();

    if (code === 'CLOUDINARY_NOT_CONFIGURED') {
        return { status: 503, error: 'Image storage is not configured on the server.' };
    }

    if (status === 401 || status === 403) {
        return {
            status: 502,
            error: 'Image storage rejected the server credentials. Check the Cloudinary API settings.',
        };
    }

    if ([420, 429].includes(status) || status >= 500 || [
        'EACCES', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EPIPE', 'ETIMEDOUT',
    ].includes(code)) {
        return { status: 503, error: 'Image storage is temporarily unavailable. Please try again.' };
    }

    if (status === 400 || status === 415) {
        return { status: 422, error: 'Cloudinary could not process this image. Upload a valid PNG or JPEG.' };
    }

    return { status: 502, error: 'The image could not be uploaded. Please try again.' };
}

function handleProfileUploadBodyError(error, _req, res, next) {
    if (!error) return next();

    if (error.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Profile images must be 10 MB or smaller.' });
    }

    return res.status(400).json({ error: 'The image request body could not be read. Send raw PNG or JPEG bytes.' });
}

function validImageUrl(value, localPattern) {
    if (value == null || value === '') return true;
    if (typeof value !== 'string') return false;

    if (localPattern.test(value)) return true;

    try {
        const url = new URL(value);
        return (
            url.protocol === 'https:' &&
            url.hostname === 'res.cloudinary.com'
        );
    } catch {
        return false;
    }
}

function profileInput(body) {
    const firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
    const bio = typeof body?.bio === 'string' ? body.bio.trim() : '';
    const medium = typeof body?.medium === 'string' ? body.medium.trim() : '';
    const location = typeof body?.location === 'string' ? body.location.trim() : '';
    const instagramUrl = typeof body?.instagramUrl === 'string' ? body.instagramUrl.trim() : '';
    const websiteUrl = typeof body?.websiteUrl === 'string' ? body.websiteUrl.trim() : '';

    const avatarUrl = body?.avatarUrl ?? null;
    const bannerUrl = body?.bannerUrl ?? null;

    const validHttpsUrl = (value) => {
        if (!value) return true;

        try {
            return new URL(value).protocol === 'https:';
        } catch {
            return false;
        }
    };

    const validImageUrl = (value) => {
        if (value === null || value === '') return true;
        if (typeof value !== 'string') return false;

        const localImagePattern =
            /^\/uploads\/(profiles|banners)\/[a-f0-9-]+\.(png|jpg)$/i;

        if (localImagePattern.test(value)) return true;

        try {
            const url = new URL(value);

            return (
                url.protocol === 'https:' &&
                url.hostname === 'res.cloudinary.com' &&
                /\.(png|jpe?g)$/i.test(url.pathname)
            );
        } catch {
            return false;
        }
    };

    if (
        !firstName ||
        firstName.length > 80 ||
        !lastName ||
        lastName.length > 80 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254 ||
        displayName.length > 80 ||
        bio.length > 2000 ||
        medium.length > 100 ||
        location.length > 120 ||
        instagramUrl.length > 300 ||
        websiteUrl.length > 300 ||
        !validHttpsUrl(instagramUrl) ||
        !validHttpsUrl(websiteUrl) ||
        !validImageUrl(avatarUrl) ||
        !validImageUrl(bannerUrl) ||
        typeof body?.emailNotifications !== 'boolean' ||
        typeof body?.publicProfileVisible !== 'boolean'
    ) {
        return null;
    }

    return {
        firstName,
        lastName,
        email,
        displayName: displayName || null,
        bio: bio || null,
        medium: medium || null,
        location: location || null,
        instagramUrl: instagramUrl || null,
        websiteUrl: websiteUrl || null,
        avatarUrl: avatarUrl || null,
        bannerUrl: bannerUrl || null,
        emailNotifications: body.emailNotifications,
        publicProfileVisible: body.publicProfileVisible,
    };
}

function redactProfileDiagnostic(value) {
    let diagnostic = String(value);

    for (const variable of [
        'DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
    ]) {
        const secret = process.env[variable];
        if (secret) diagnostic = diagnostic.split(secret).join('[redacted]');
    }

    return diagnostic
        .replace(/postgres(?:ql)?:\/\/[^\s`"'<>]+/gi, '[redacted database URL]')
        .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
        .replace(/(authorization\s*[:=]\s*)[^\r\n]+/gi, '$1[redacted]')
        .replace(/\beyJ[\w-]{8,}\.[\w-]+\.[\w-]+\b/g, '[redacted JWT]')
        .replace(/((?:password|passwd|pwd)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]');
}

router.post(
    '/uploads/profile',
    requireAuth,
    requireArtistAccess,
    express.raw({ type: ['image/png', 'image/jpeg'], limit: '10mb' }),
    handleProfileUploadBodyError,
    async (req, res) => {
        try {
            const mimeType = req.get('content-type')?.split(';')[0].trim().toLowerCase();
            const result = await uploadToCloudinary(
                req.body,
                mimeType,
                'showpeice/artists/profiles'
            );

            if (!result) {
                return res.status(400).json({
                    error: 'Upload a valid PNG or JPEG profile image up to 10 MB.',
                });
            }

            return res.status(201).json({ imageUrl: result.secure_url });
        } catch (error) {
            logCloudinaryUploadFailure('Profile', error);
            const failure = cloudinaryUploadFailure(error);
            return res.status(failure.status).json({ error: failure.error });
        }
    }
);

router.post(
    '/uploads/banner',
    requireAuth,
    requireArtistAccess,
    express.raw({ type: ['image/png', 'image/jpeg'], limit: '10mb' }),
    async (req, res) => {
        try {
            const mimeType = req.get('content-type')?.split(';')[0].trim();
            const result = await uploadToCloudinary(
                req.body,
                mimeType,
                'showpeice/artists/banners'
            );

            if (!result) {
                return res.status(400).json({
                    error: 'Upload a valid PNG or JPEG banner up to 10 MB.',
                });
            }

            return res.status(201).json({ imageUrl: result.secure_url });
        } catch (error) {
            logCloudinaryUploadFailure('Banner', error);
            const failure = cloudinaryUploadFailure(error);
            return res.status(failure.status).json({ error: failure.error.replace('this image', 'this banner') });
        }
    }
);

router.patch('/profile', requireAuth, requireArtistAccess, async (req, res) => {
    const data = profileInput(req.body);
    if (!data) return res.status(400).json({ error: 'Check the profile fields and use HTTPS for public links.' });
    try {
        const user = await prisma.user.update({
            where: { id: req.authenticatedUser.id },
            data,
            select: {
                id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true,
                displayName: true, bio: true, avatarUrl: true, bannerUrl: true, medium: true, location: true,
                instagramUrl: true, websiteUrl: true, emailNotifications: true, publicProfileVisible: true,
            },
        });
        const slugById = await getArtistSlugMap(prisma);
        return res.json({ user: { ...user, slug: slugById.get(user.id) } });
    } catch (error) {
        if (error.code === 'P2002') return res.status(409).json({ error: 'An account with this email already exists.' });
        console.error('[artist/profile] Profile update failed:', error.code || error.name || 'unknown error');
        if (process.env.NODE_ENV !== 'production') {
            const diagnostic = [error?.message, error?.stack]
                .filter((value, index, values) => typeof value === 'string' && values.indexOf(value) === index)
                .join('\n');
            if (diagnostic) console.error(redactProfileDiagnostic(diagnostic));
        }
        return res.status(500).json({ error: 'Your profile could not be updated. Please try again.' });
    }
});

const artistSettingsSelect = {
    id: true,
    displayName: true,
    bio: true,
    emailNotifications: true,
    publicProfileVisible: true,
    weeklyDigest: true,
    orderNotifications: true,
    publicEmailVisible: true,
    shopAnnouncement: true,
};

router.get('/settings', requireAuth, requireArtistAccess, async (req, res) => {
    try {
        const settings = await prisma.user.findUnique({
            where: { id: req.authenticatedUser.id },
            select: artistSettingsSelect,
        });
        if (!settings) return res.status(404).json({ error: 'Artist account could not be found.' });
        return res.json({ settings });
    } catch (error) {
        const code = error.code || error.name || 'unknown error';
        const missingSchemaObject = error.meta?.column || error.meta?.table;
        console.error(
            '[artist/settings] Settings query failed:',
            code,
            missingSchemaObject ? `(${missingSchemaObject})` : ''
        );
        return res.status(isDatabaseUnavailable(error) ? 503 : 500).json({
            error: 'Artist settings could not be loaded. Please try again.',
        });
    }
});

router.patch('/settings', requireAuth, requireArtistAccess, async (req, res) => {
    const body = req.body || {};
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : null;
    const bio = typeof body.bio === 'string' ? body.bio.trim() : null;
    const shopAnnouncement = typeof body.shopAnnouncement === 'string' ? body.shopAnnouncement.trim() : null;
    const booleanFields = [
        'emailNotifications',
        'publicProfileVisible',
        'weeklyDigest',
        'orderNotifications',
        'publicEmailVisible',
    ];

    if (
        displayName === null || displayName.length > 80 ||
        bio === null || bio.length > 2000 ||
        shopAnnouncement === null || shopAnnouncement.length > 500 ||
        booleanFields.some((field) => typeof body[field] !== 'boolean')
    ) {
        return res.status(400).json({ error: 'Check the settings fields and keep text within the listed character limits.' });
    }

    try {
        const settings = await prisma.user.update({
            where: { id: req.authenticatedUser.id },
            data: {
                displayName: displayName || null,
                bio: bio || null,
                shopAnnouncement: shopAnnouncement || null,
                emailNotifications: body.emailNotifications,
                publicProfileVisible: body.publicProfileVisible,
                weeklyDigest: body.weeklyDigest,
                orderNotifications: body.orderNotifications,
                publicEmailVisible: body.publicEmailVisible,
            },
            select: artistSettingsSelect,
        });
        return res.json({ settings });
    } catch (error) {
        const code = error.code || error.name || 'unknown error';
        const missingSchemaObject = error.meta?.column || error.meta?.table;
        console.error(
            '[artist/settings] Settings update failed:',
            code,
            missingSchemaObject ? `(${missingSchemaObject})` : ''
        );
        return res.status(isDatabaseUnavailable(error) ? 503 : 500).json({
            error: 'Artist settings could not be saved. Please try again.',
        });
    }
});

router.get('/data-export', requireAuth, requireArtistAccess, async (req, res) => {
    try {
        const account = await prisma.user.findUnique({
            where: { id: req.authenticatedUser.id },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                role: true,
                createdAt: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
                bannerUrl: true,
                medium: true,
                location: true,
                instagramUrl: true,
                websiteUrl: true,
                emailNotifications: true,
                publicProfileVisible: true,
                weeklyDigest: true,
                orderNotifications: true,
                publicEmailVisible: true,
                shopAnnouncement: true,
                artworks: {
                    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                    select: artworkSelect,
                },
            },
        });
        if (!account) return res.status(404).json({ error: 'Artist account could not be found.' });
        res.set('Content-Disposition', 'attachment; filename="showpeice-artist-data.json"');
        return res.json({ exportedAt: new Date().toISOString(), account });
    } catch (error) {
        console.error('[artist/data-export] Export failed:', error.code || error.name || 'unknown error');
        return res.status(500).json({ error: 'Your account data could not be exported. Please try again.' });
    }
});

router.patch('/profile/password', requireAuth, requireArtistAccess, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
        return res.status(400).json({ error: 'Provide your current password and a new password of at least 8 characters.' });
    }
    try {
        const account = await prisma.user.findUnique({ where: { id: req.authenticatedUser.id }, select: { password: true } });
        if (!account || !(await bcrypt.compare(currentPassword, account.password))) {
            return res.status(400).json({ error: 'Your current password is incorrect.' });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({ where: { id: req.authenticatedUser.id }, data: { password: hashedPassword } });
        return res.json({ success: true });
    } catch (error) {
        console.error('[artist/profile] Password update failed:', error.code || error.name || 'unknown error');
        return res.status(500).json({ error: 'Your password could not be updated. Please try again.' });
    }
});

router.delete('/account', requireAuth, requireArtistAccess, async (req, res) => {
    const { currentPassword, confirmation } = req.body || {};
    if (typeof currentPassword !== 'string' || !currentPassword || confirmation !== 'DELETE') {
        return res.status(400).json({ error: 'Enter your current password and type DELETE to confirm account removal.' });
    }

    const userId = req.authenticatedUser.id;
    try {
        const account = await prisma.user.findUnique({
            where: { id: userId },
            select: { password: true },
        });
        if (!account || !(await bcrypt.compare(currentPassword, account.password))) {
            return res.status(400).json({ error: 'Your current password is incorrect.' });
        }

        await prisma.$transaction(async (transaction) => {
            const [purchaseCount, soldArtworkCount] = await Promise.all([
                transaction.order.count({ where: { buyerId: userId } }),
                transaction.orderItem.count({ where: { artwork: { is: { artistId: userId } } } }),
            ]);
            if (purchaseCount > 0 || soldArtworkCount > 0) {
                const error = new Error('This account has order history that must be retained. Contact Showpeice support to request account deletion.');
                error.code = 'ACCOUNT_HAS_ORDER_HISTORY';
                throw error;
            }
            await transaction.user.delete({ where: { id: userId } });
        });

        return res.json({ success: true });
    } catch (error) {
        if (error.code === 'ACCOUNT_HAS_ORDER_HISTORY') {
            return res.status(409).json({ error: error.message });
        }
        if (error.code === 'P2003') {
            return res.status(409).json({ error: 'This account has related order records that must be retained. Contact Showpeice support to request account deletion.' });
        }
        console.error('[artist/account] Account deletion failed:', error.code || error.name || 'unknown error');
        return res.status(500).json({ error: 'Your account could not be deleted. Please try again.' });
    }
});

router.get('/dashboard', requireAuth, requireArtistAccess, async (req, res) => {
    const user = req.authenticatedUser;

    const where = { artistId: user.id };

    try {
        const [artworks, statusCounts] = await Promise.all([
            prisma.artwork.findMany({
                where,
                orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
                select: artworkSelect,
            }),
            prisma.artwork.groupBy({
                by: ['status'],
                where,
                _count: { _all: true },
            }),
        ]);

        const countForStatus = (status) => statusCounts.find((row) => row.status === status)?._count._all || 0;
        const stats = {
            totalArtworks: statusCounts.reduce((sum, row) => sum + row._count._all, 0),
            publishedArtworks: countForStatus('published'),
            draftArtworks: countForStatus('draft'),
            sales: null,
            views: null,
            pendingOrders: null,
        };

        const slugById = await getArtistSlugMap(prisma);

        return res.json({
            user: { ...user, slug: slugById.get(user.id) },
            artworks: artworks.map((artwork) => addStudioPreviewUrl(artwork, user.id)),
            recentArtworks: artworks.slice(0, 4).map((artwork) => addStudioPreviewUrl(artwork, user.id)),
            stats,
        });
    } catch (error) {
        const diagnostics = {
            code: error?.code || error?.name || 'unknown error',
            ...(typeof error?.meta?.modelName === 'string' ? { model: error.meta.modelName } : {}),
            ...(typeof error?.meta?.column === 'string' ? { column: error.meta.column } : {}),
            ...(typeof error?.meta?.table === 'string' ? { table: error.meta.table } : {}),
        };
        console.error('[artist/dashboard] Studio query failed:', JSON.stringify(diagnostics));
        return res.status(500).json({ error: 'We could not load your artist studio. Please try again.' });
    }
});

router.post('/artworks', requireAuth, requireArtistAccess, receiveArtworkUpload, async (req, res) => {
    let uploadedImage;
    try {
        if (req.file) uploadedImage = await uploadArtworkToCloudinary(req.file);
        const imageUrl = uploadedImage?.secure_url ?? req.body?.imageUrl;
        const data = artworkInput(req.body, imageUrl);
        if (!data || !isCloudinaryArtworkUrl(imageUrl)) {
            if (uploadedImage) await removeUnattachedCloudinaryImage(uploadedImage.public_id);
            return res.status(400).json({
                error: 'Provide complete artwork details and a PNG, JPEG, or WebP image stored in Cloudinary.',
            });
        }

        let imagePublicId = uploadedImage?.public_id;
        if (!uploadedImage) {
            const ownedImage = await prisma.artwork.findFirst({
                where: { artistId: req.authenticatedUser.id, imageUrl },
                select: { imagePublicId: true },
            });
            if (!ownedImage) {
                return res.status(403).json({ error: 'Upload an image or reuse an image already in your studio.' });
            }
            imagePublicId = ownedImage.imagePublicId || cloudinaryArtworkPublicId(imageUrl);
        }

        const artwork = await prisma.artwork.create({
            data: { ...data, artistId: req.authenticatedUser.id, imagePublicId },
            select: artworkSelect,
        });
        return res.status(201).json({ artwork: addStudioPreviewUrl(artwork, req.authenticatedUser.id) });
    } catch (error) {
        if (uploadedImage) await removeUnattachedCloudinaryImage(uploadedImage.public_id);
        if (error.status) return res.status(error.status).json({ error: error.message });
        if (uploadedImage) {
            console.error('[artist/artworks] Artwork creation failed:', error.code || error.name || 'unknown error');
            return res.status(500).json({ error: 'The image uploaded, but the artwork could not be saved. Please try again.' });
        }
        logCloudinaryUploadFailure('Artwork', error);
        const failure = cloudinaryUploadFailure(error);
        return res.status(failure.status).json({ error: failure.error });
    }
});

router.patch('/artworks/:id', requireAuth, requireArtistAccess, receiveArtworkUpload, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Provide a valid artwork ID.' });

    let uploadedImage;
    try {
        const existing = await prisma.artwork.findFirst({
            where: { id, artistId: req.authenticatedUser.id },
            select: { imageUrl: true, imagePublicId: true },
        });
        if (!existing) return res.status(404).json({ error: 'Artwork not found.' });
        const previousImagePublicId = existing.imagePublicId || cloudinaryArtworkPublicId(existing.imageUrl);

        if (req.file) uploadedImage = await uploadArtworkToCloudinary(req.file);
        const imageUrl = uploadedImage?.secure_url ??
            (typeof req.body?.imageUrl === 'string' ? req.body.imageUrl : existing.imageUrl);
        const data = artworkInput(req.body, imageUrl, {
            allowLegacyImage: imageUrl === existing.imageUrl,
        });
        if (!data) {
            if (uploadedImage) await removeUnattachedCloudinaryImage(uploadedImage.public_id);
            return res.status(400).json({
                error: 'Provide complete artwork details and keep its existing image or upload a valid Cloudinary image.',
            });
        }

        let imagePublicId = uploadedImage?.public_id;
        if (!uploadedImage) {
            if (imageUrl === existing.imageUrl) {
                imagePublicId = existing.imagePublicId || cloudinaryArtworkPublicId(imageUrl);
            } else {
                const ownedImage = await prisma.artwork.findFirst({
                    where: { artistId: req.authenticatedUser.id, imageUrl },
                    select: { imagePublicId: true },
                });
                if (!ownedImage) {
                    return res.status(403).json({ error: 'Upload an image or choose one already in your studio.' });
                }
                imagePublicId = ownedImage.imagePublicId || cloudinaryArtworkPublicId(imageUrl);
            }
        }

        const result = await prisma.artwork.updateMany({
            where: { id, artistId: req.authenticatedUser.id },
            data: { ...data, imagePublicId },
        });
        if (result.count === 0) {
            if (uploadedImage) await removeUnattachedCloudinaryImage(uploadedImage.public_id);
            return res.status(404).json({ error: 'Artwork not found.' });
        }

        const artwork = await prisma.artwork.findUnique({ where: { id }, select: artworkSelect });
        if (!artwork) {
            if (uploadedImage) await removeUnattachedCloudinaryImage(uploadedImage.public_id);
            return res.status(404).json({ error: 'Artwork not found.' });
        }
        if (previousImagePublicId && previousImagePublicId !== imagePublicId) {
            await removeUnusedCloudinaryArtwork(previousImagePublicId);
        }
        return res.json({ artwork: addStudioPreviewUrl(artwork, req.authenticatedUser.id) });
    } catch (error) {
        if (uploadedImage) await removeUnattachedCloudinaryImage(uploadedImage.public_id);
        if (error.status) return res.status(error.status).json({ error: error.message });
        if (uploadedImage) {
            console.error('[artist/artworks] Artwork update failed:', error.code || error.name || 'unknown error');
            return res.status(500).json({ error: 'The image uploaded, but the artwork could not be saved. Please try again.' });
        }
        logCloudinaryUploadFailure('Artwork', error);
        const failure = cloudinaryUploadFailure(error);
        return res.status(failure.status).json({ error: failure.error });
    }
});

router.delete('/artworks/:id', requireAuth, requireArtistAccess, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({ error: 'Provide a valid artwork ID.' });
    }

    try {
        const existing = await prisma.artwork.findFirst({
            where: { id, artistId: req.authenticatedUser.id },
            select: { imageUrl: true, imagePublicId: true },
        });
        if (!existing) return res.status(404).json({ error: 'Artwork not found.' });

        const result = await prisma.artwork.deleteMany({
            where: { id, artistId: req.authenticatedUser.id },
        });
        if (result.count === 0) return res.status(404).json({ error: 'Artwork not found.' });
        await removeUnusedCloudinaryArtwork(existing.imagePublicId || cloudinaryArtworkPublicId(existing.imageUrl));
        return res.json({ success: true });
    } catch (error) {
        console.error('[artist/artworks] Artwork deletion failed:', error.code || error.name || 'unknown error');
        return res.status(500).json({ error: 'Artwork could not be deleted. Please try again.' });
    }
});



module.exports = router;
