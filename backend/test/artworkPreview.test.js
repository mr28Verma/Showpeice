'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { test } = require('node:test');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const { createArtworkPreview, PREVIEW_MAX_DIMENSION } = require('../utils/artworkPreview');

test('creates a bounded JPEG preview and visibly composites the protected watermark', async () => {
    const original = await sharp({
        create: { width: 2100, height: 1050, channels: 3, background: '#986744' },
    }).png().toBuffer();
    const plainPreview = await createArtworkPreview(original);
    const protectedPreview = await createArtworkPreview(original, { watermark: true });
    const metadata = await sharp(protectedPreview).metadata();

    assert.equal(metadata.format, 'jpeg');
    assert.equal(metadata.width, PREVIEW_MAX_DIMENSION);
    assert.equal(metadata.height, 700);

    const [plainPixels, protectedPixels] = await Promise.all([
        sharp(plainPreview).raw().toBuffer(),
        sharp(protectedPreview).raw().toBuffer(),
    ]);
    let changedPixels = 0;
    for (let index = 0; index < plainPixels.length; index += 3) {
        if (plainPixels[index] !== protectedPixels[index] ||
            plainPixels[index + 1] !== protectedPixels[index + 1] ||
            plainPixels[index + 2] !== protectedPixels[index + 2]) changedPixels += 1;
    }
    assert.ok(changedPixels > 100, 'the protected preview must include rasterized watermark pixels');
});

test('keeps small previews at their source dimensions', async () => {
    const original = await sharp({
        create: { width: 120, height: 80, channels: 3, background: '#345678' },
    }).png().toBuffer();
    const preview = await createArtworkPreview(original, { watermark: true });
    const metadata = await sharp(preview).metadata();

    assert.equal(metadata.width, 120);
    assert.equal(metadata.height, 80);
});

test('does not serve uploaded originals from the public uploads path', async (t) => {
    process.env.CLOUDINARY_CLOUD_NAME ||= 'showpeice-test';
    process.env.CLOUDINARY_API_KEY ||= 'test-key';
    process.env.CLOUDINARY_API_SECRET ||= 'test-secret';
    process.env.JWT_SECRET ||= 'showpeice-preview-test-secret';
    const prisma = require('../prisma');
    const app = require('../app');
    const artworkId = 77123;
    const artistId = 77124;
    const filename = `${crypto.randomUUID()}.png`;
    const sourcePath = path.join(__dirname, '..', 'uploads', 'artworks', filename);
    await fs.mkdir(path.dirname(sourcePath), { recursive: true });
    await sharp({
        create: { width: 1900, height: 1100, channels: 3, background: '#a06b4e' },
    }).png().toFile(sourcePath);
    let currentArtwork = {
        id: artworkId,
        artistId,
        imageUrl: `/uploads/artworks/${filename}`,
        isProtected: true,
        status: 'published',
        updatedAt: new Date(),
        artist: { publicProfileVisible: true },
    };
    const originalFindUnique = prisma.artwork.findUnique;
    const originalUserFindMany = prisma.user.findMany;
    const originalUserFindFirst = prisma.user.findFirst;
    const originalFollowCount = prisma.artistFollow.count;
    prisma.artwork.findUnique = async ({ where }) => where.id === artworkId ? currentArtwork : null;
    prisma.user.findMany = async () => [{ id: artistId, firstName: 'Test', lastName: 'Artist', displayName: null }];
    prisma.user.findFirst = async () => ({
        id: artistId,
        firstName: 'Test',
        lastName: 'Artist',
        displayName: null,
        bio: null,
        avatarUrl: null,
        bannerUrl: null,
        medium: null,
        location: null,
        instagramUrl: null,
        websiteUrl: null,
        publicProfileVisible: true,
        createdAt: new Date(),
        artworks: [{
            id: artworkId,
            title: 'Test artwork',
            description: 'Fixture record',
            price: 100,
            category: 'Painting',
            imageUrl: currentArtwork.imageUrl,
            isProtected: true,
            available: true,
            createdAt: new Date(),
        }],
    });
    prisma.artistFollow.count = async () => 0;
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    t.after(async () => {
        prisma.artwork.findUnique = originalFindUnique;
        prisma.user.findMany = originalUserFindMany;
        prisma.user.findFirst = originalUserFindFirst;
        prisma.artistFollow.count = originalFollowCount;
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        await fs.unlink(sourcePath).catch(() => {});
    });

    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const original = await fetch(`${baseUrl}${currentArtwork.imageUrl}`);
    assert.equal(original.status, 404);

    const publicPreview = await fetch(`${baseUrl}/api/artworks/${artworkId}/preview`);
    assert.equal(publicPreview.status, 200);
    assert.match(publicPreview.headers.get('content-type'), /image\/jpeg/);
    const publicPreviewBytes = Buffer.from(await publicPreview.arrayBuffer());
    const previewMetadata = await sharp(publicPreviewBytes).metadata();
    assert.equal(previewMetadata.format, 'jpeg');
    assert.equal(previewMetadata.width, PREVIEW_MAX_DIMENSION);
    assert.notDeepEqual(publicPreviewBytes, await createArtworkPreview(sourcePath), 'the public route must bake in the protected artwork watermark');

    const publicProfileResponse = await fetch(`${baseUrl}/api/artists/test-artist`);
    assert.equal(publicProfileResponse.status, 200);
    const publicProfile = await publicProfileResponse.json();
    assert.equal(publicProfile.artist.artworks[0].imageUrl, `/api/artworks/${artworkId}/preview`);
    assert.notEqual(publicProfile.artist.artworks[0].imageUrl, currentArtwork.imageUrl);

    currentArtwork = { ...currentArtwork, status: 'draft' };
    const unauthorizedDraft = await fetch(`${baseUrl}/api/artworks/${artworkId}/preview`);
    assert.equal(unauthorizedDraft.status, 404);

    const ownerPreviewToken = jwt.sign({ purpose: 'artwork-preview', artworkId, artistId }, process.env.JWT_SECRET, { expiresIn: '1m' });
    const ownerDraft = await fetch(`${baseUrl}/api/artworks/${artworkId}/preview?token=${ownerPreviewToken}`);
    assert.equal(ownerDraft.status, 200);
    assert.match(ownerDraft.headers.get('cache-control'), /no-store/);
});
