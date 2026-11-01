'use strict';

const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { createArtworkPreview } = require('../utils/artworkPreview');

const router = express.Router();
const uploadDirectory = path.join(__dirname, '..', 'uploads', 'artworks');
const maxSourceBytes = 10 * 1024 * 1024;
const previewCache = new Map();
const artworkFilenamePattern = /^([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\.(png|jpg)$/i;

function hasPrivatePreviewAccess(artwork, token) {
    if (!token || !process.env.JWT_SECRET) return false;
    try {
        const claims = jwt.verify(token, process.env.JWT_SECRET);
        return claims?.purpose === 'artwork-preview' &&
            Number(claims.artworkId) === artwork.id &&
            Number(claims.artistId) === artwork.artistId;
    } catch {
        return false;
    }
}

async function readImageUrl(imageUrl) {
    const localMatch = typeof imageUrl === 'string' && artworkFilenamePattern.exec(imageUrl.replace(/^\/uploads\/artworks\//, ''));
    if (imageUrl?.startsWith('/uploads/artworks/') && localMatch) {
        return fs.readFile(path.join(uploadDirectory, `${localMatch[1]}.${localMatch[2].toLowerCase()}`));
    }

    let remoteUrl;
    try {
        remoteUrl = new URL(imageUrl);
    } catch {
        return null;
    }
    if (remoteUrl.protocol !== 'https:' || remoteUrl.hostname !== 'res.cloudinary.com') return null;

    const response = await fetch(remoteUrl, { redirect: 'error', signal: AbortSignal.timeout(10_000) });
    if (!response.ok || !/^image\/(jpeg|png)$/i.test(response.headers.get('content-type') || '')) return null;
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxSourceBytes) return null;

    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
        size += chunk.length;
        if (size > maxSourceBytes) {
            await response.body.cancel().catch(() => {});
            return null;
        }
        chunks.push(chunk);
    }
    return Buffer.concat(chunks, size);
}

router.get('/:id/preview', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(404).end();

    try {
        const artwork = await prisma.artwork.findUnique({
            where: { id },
            select: {
                id: true,
                artistId: true,
                imageUrl: true,
                isProtected: true,
                status: true,
                updatedAt: true,
                artist: { select: { publicProfileVisible: true } },
            },
        });
        if (!artwork?.imageUrl) return res.status(404).end();

        const isPublic = artwork.status === 'published' && artwork.artist.publicProfileVisible;
        const previewToken = typeof req.query.token === 'string' ? req.query.token : '';
        const hasPrivateAccess = !isPublic && hasPrivatePreviewAccess(artwork, previewToken);
        if (!isPublic && !hasPrivateAccess) return res.status(404).end();

        const cacheKey = `${artwork.id}:${artwork.updatedAt.getTime()}:${artwork.isProtected}`;
        let preview = previewCache.get(cacheKey);
        if (!preview) {
            const source = await readImageUrl(artwork.imageUrl);
            if (!source || source.length > maxSourceBytes) return res.status(404).end();
            preview = await createArtworkPreview(source, { watermark: artwork.isProtected });
            previewCache.set(cacheKey, preview);
            if (previewCache.size > 20) previewCache.delete(previewCache.keys().next().value);
        }

        res.set({
            'Content-Type': 'image/jpeg',
            'Content-Disposition': 'inline; filename="showpeice-artwork-preview.jpg"',
            'Content-Length': String(preview.length),
            'Cache-Control': hasPrivateAccess ? 'private, no-store' : 'public, max-age=300, stale-while-revalidate=600',
            'X-Content-Type-Options': 'nosniff',
        });
        return res.send(preview);
    } catch (error) {
        console.error('[artworks/preview] Image preview failed:', error.code || error.name || 'unknown error');
        return res.status(404).end();
    }
});

module.exports = router;
