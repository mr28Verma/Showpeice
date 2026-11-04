'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const { PassThrough } = require('stream');

process.env.JWT_SECRET = 'artwork-upload-api-test-secret';
process.env.CLOUDINARY_CLOUD_NAME = 'showpeice-test';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';

const app = require('../app');
const cloudinary = require('../config/cloudinary');
const prisma = require('../prisma');

test('artwork upload stores its Cloudinary public ID and safely cleans replaced or unreferenced assets', async (t) => {
    const originals = {
        userFindUnique: prisma.user.findUnique,
        artworkCreate: prisma.artwork.create,
        artworkFindFirst: prisma.artwork.findFirst,
        artworkFindUnique: prisma.artwork.findUnique,
        artworkUpdateMany: prisma.artwork.updateMany,
        artworkDeleteMany: prisma.artwork.deleteMany,
        artworkCount: prisma.artwork.count,
        isConfigured: cloudinary.isConfigured,
        uploadStream: cloudinary.uploader.upload_stream,
        destroy: cloudinary.uploader.destroy,
    };
    const users = new Map([
        [911, { id: 911, firstName: 'Upload', lastName: 'Artist', email: 'upload@example.test', role: 'artist' }],
        [912, { id: 912, firstName: 'Other', lastName: 'Artist', email: 'other@example.test', role: 'artist' }],
    ]);
    const artworks = new Map();
    const uploads = [];
    const deletions = [];
    let nextArtworkId = 1;
    let failNextCreate = false;

    prisma.user.findUnique = async ({ where }) => users.get(where.id) || null;
    prisma.artwork.create = async ({ data }) => {
        if (failNextCreate) {
            failNextCreate = false;
            const error = new Error('Simulated database write failure.');
            error.code = 'P2000';
            throw error;
        }
        const artwork = { id: nextArtworkId++, ...data, createdAt: new Date(), updatedAt: new Date() };
        artworks.set(artwork.id, artwork);
        return artwork;
    };
    prisma.artwork.findFirst = async ({ where }) => [...artworks.values()].find((artwork) =>
        (where.id === undefined || artwork.id === where.id) &&
        (where.artistId === undefined || artwork.artistId === where.artistId) &&
        (where.imageUrl === undefined || artwork.imageUrl === where.imageUrl)) || null;
    prisma.artwork.findUnique = async ({ where }) => artworks.get(where.id) || null;
    prisma.artwork.updateMany = async ({ where, data }) => {
        const artwork = artworks.get(where.id);
        if (!artwork || artwork.artistId !== where.artistId) return { count: 0 };
        artworks.set(artwork.id, { ...artwork, ...data, updatedAt: new Date() });
        return { count: 1 };
    };
    prisma.artwork.deleteMany = async ({ where }) => {
        const artwork = artworks.get(where.id);
        if (!artwork || artwork.artistId !== where.artistId) return { count: 0 };
        artworks.delete(artwork.id);
        return { count: 1 };
    };
    prisma.artwork.count = async ({ where }) => [...artworks.values()]
        .filter((artwork) => artwork.imagePublicId === where.imagePublicId).length;
    cloudinary.uploader.upload_stream = (options, callback) => {
        const stream = new PassThrough();
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('finish', () => {
            const publicId = `showpeice/artworks/mock-${uploads.length + 1}`;
            uploads.push({ options, publicId, bytes: Buffer.concat(chunks) });
            callback(null, {
                secure_url: `https://res.cloudinary.com/showpeice-test/image/upload/v123/${publicId}.png`,
                public_id: publicId,
            });
        });
        return stream;
    };
    cloudinary.uploader.destroy = async (publicId) => {
        deletions.push(publicId);
        return { result: 'ok' };
    };

    const image = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#345678' } }).png().toBuffer();
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    t.after(async () => {
        prisma.user.findUnique = originals.userFindUnique;
        prisma.artwork.create = originals.artworkCreate;
        prisma.artwork.findFirst = originals.artworkFindFirst;
        prisma.artwork.findUnique = originals.artworkFindUnique;
        prisma.artwork.updateMany = originals.artworkUpdateMany;
        prisma.artwork.deleteMany = originals.artworkDeleteMany;
        prisma.artwork.count = originals.artworkCount;
        cloudinary.isConfigured = originals.isConfigured;
        cloudinary.uploader.upload_stream = originals.uploadStream;
        cloudinary.uploader.destroy = originals.destroy;
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    });

    const baseUrl = `http://127.0.0.1:${server.address().port}/api/artist/artworks`;
    const tokenFor = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const request = (path, userId, form, method = path ? 'PATCH' : 'POST') => fetch(`${baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${tokenFor(userId)}` },
        ...(form ? { body: form } : {}),
    });
    const formFor = (title, withImage = true, imageUrl = null) => {
        const form = new FormData();
        form.set('title', title);
        form.set('description', 'Temporary route test artwork.');
        form.set('price', '1800');
        form.set('category', 'Painting');
        form.set('available', 'true');
        form.set('isProtected', 'false');
        form.set('status', 'draft');
        if (withImage) form.set('image', new Blob([image], { type: 'image/png' }), 'artwork.png');
        if (imageUrl) form.set('imageUrl', imageUrl);
        return form;
    };

    assert.equal(cloudinary.isConfigured, true);
    const createdResponse = await request('', 911, formFor('Uploaded artwork'));
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()).artwork;
    const stored = artworks.get(created.id);
    assert.equal(stored.imagePublicId, uploads[0].publicId);
    assert.equal(stored.imageUrl, created.imageUrl);
    assert.deepEqual(uploads[0].bytes, image);

    cloudinary.isConfigured = false;
    assert.equal((await request('', 911, formFor('Unavailable storage'))).status, 503);
    cloudinary.isConfigured = true;

    const otherOwner = await request(`/${created.id}`, 912, formFor('Unauthorized change'));
    assert.equal(otherOwner.status, 404);
    assert.equal(uploads.length, 1);

    const duplicateResponse = await request('', 911, formFor('Own image reuse', false, created.imageUrl));
    assert.equal(duplicateResponse.status, 201);
    const duplicate = (await duplicateResponse.json()).artwork;
    assert.equal(artworks.get(duplicate.id).imagePublicId, stored.imagePublicId);

    const replacementResponse = await request(`/${created.id}`, 911, formFor('Replacement artwork'));
    assert.equal(replacementResponse.status, 200);
    assert.equal(deletions.includes(stored.imagePublicId), false, 'a duplicate artwork reference prevents premature cleanup');

    assert.equal((await request(`/${duplicate.id}`, 911, null, 'DELETE')).status, 200);
    assert.ok(deletions.includes(stored.imagePublicId), 'deleting the last reference cleans up the shared image');
    assert.equal(deletions.includes(artworks.get(created.id).imagePublicId), false, 'the replacement remains attached to its artwork');

    failNextCreate = true;
    const failedSave = await request('', 911, formFor('Database write fails'));
    assert.equal(failedSave.status, 500);
    assert.ok(deletions.includes(uploads[uploads.length - 1].publicId), 'unattached upload is cleaned up when the database write fails');
});
