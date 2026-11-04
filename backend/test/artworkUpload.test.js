'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PassThrough } = require('stream');
const sharp = require('sharp');
const { hasSafeTestDatabase } = require('../testSupport/databaseTestGuard');

process.env.CLOUDINARY_CLOUD_NAME ||= 'showpeice-test';
process.env.CLOUDINARY_API_KEY ||= 'test-key';
process.env.CLOUDINARY_API_SECRET ||= 'test-secret';
process.env.JWT_SECRET ||= 'artwork-upload-test-secret';

const app = require('../app');
const cloudinary = require('../config/cloudinary');
const prisma = require('../prisma');

test('artist artwork uploads use Cloudinary and remain owner-scoped', {
    skip: hasSafeTestDatabase ? false : 'Set TEST_DATABASE_URL to a local disposable *_test database to run database integration tests.',
}, async (t) => {
    const suffix = crypto.randomUUID();
    const password = 'ArtworkUpload-Test-Password-123!';
    const passwordHash = await bcrypt.hash(password, 4);
    const [artist, otherArtist, buyer] = await Promise.all(
        [
            ['UploadArtist', 'artist'],
            ['OtherArtist', 'artist'],
            ['UploadBuyer', 'buyer'],
        ].map(([firstName, role]) => prisma.user.create({
            data: {
                firstName,
                lastName: 'Test',
                email: `${firstName.toLowerCase()}_${suffix}@example.test`,
                password: passwordHash,
                role,
            },
        }))
    );

    const originalUploadStream = cloudinary.uploader.upload_stream;
    const originalDestroy = cloudinary.uploader.destroy;
    const originalArtworkCreate = prisma.artwork.create;
    const uploads = [];
    const deletions = [];
    cloudinary.uploader.upload_stream = (options, callback) => {
        const stream = new PassThrough();
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('finish', () => {
            const publicId = `showpeice/artworks/test-${crypto.randomUUID()}`;
            uploads.push({ options, bytes: Buffer.concat(chunks), publicId });
            callback(null, {
                secure_url: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/v123/${publicId}.png`,
                public_id: publicId,
            });
        });
        return stream;
    };
    cloudinary.uploader.destroy = async (publicId) => {
        deletions.push(publicId);
        return { result: 'ok' };
    };

    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const login = async (email) => {
        const response = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(typeof result.token, 'string');
        return result.token;
    };
    const [artistToken, otherArtistToken, buyerToken] = await Promise.all([
        login(artist.email),
        login(otherArtist.email),
        login(buyer.email),
    ]);
    const image = await sharp({
        create: { width: 64, height: 48, channels: 3, background: '#8b6349' },
    }).png().toBuffer();
    const multipart = (fileBytes = image, mimeType = 'image/png') => {
        const body = new FormData();
        body.set('title', 'Cloudinary upload test');
        body.set('description', 'A disposable artwork image upload integration test.');
        body.set('price', '1200');
        body.set('category', 'Painting');
        body.set('available', 'true');
        body.set('isProtected', 'false');
        body.set('status', 'published');
        body.set('image', new Blob([fileBytes], { type: mimeType }), 'test-artwork.png');
        return body;
    };
    const request = (path, token, options = {}) => fetch(`${baseUrl}${path}`, {
        ...options,
        headers: { Authorization: ['Bearer', token].join(' ') },
    });

    t.after(async () => {
        prisma.artwork.create = originalArtworkCreate;
        cloudinary.uploader.upload_stream = originalUploadStream;
        cloudinary.uploader.destroy = originalDestroy;
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        await prisma.user.deleteMany({ where: { id: { in: [artist.id, otherArtist.id, buyer.id] } } });
    });

    await t.test('rejects unauthorized and invalid image submissions before Cloudinary', async () => {
        const unauthorized = await request('/api/artist/artworks', buyerToken, {
            method: 'POST',
            body: multipart(),
        });
        assert.equal(unauthorized.status, 403);
        assert.equal(uploads.length, 0);

        const invalidMime = await request('/api/artist/artworks', artistToken, {
            method: 'POST',
            body: multipart(Buffer.from('not an image'), 'text/plain'),
        });
        assert.equal(invalidMime.status, 422);

        const invalidContents = await request('/api/artist/artworks', artistToken, {
            method: 'POST',
            body: multipart(Buffer.from('not a PNG'), 'image/png'),
        });
        assert.equal(invalidContents.status, 422);
        assert.equal(uploads.length, 0);
    });

    await t.test('stores the Cloudinary URL and returns it to gallery and artist views', async () => {
        const response = await request('/api/artist/artworks', artistToken, {
            method: 'POST',
            body: multipart(),
        });
        assert.equal(response.status, 201);
        const result = await response.json();
        const artwork = result.artwork;
        assert.match(artwork.imageUrl, /^https:\/\/res\.cloudinary\.com\/showpeice-test\/image\/upload\/v123\/showpeice\/artworks\//);
        assert.equal(uploads.length, 1);
        assert.equal(uploads[0].options.folder, 'showpeice/artworks');
        assert.equal(uploads[0].options.resource_type, 'image');
        assert.deepEqual(uploads[0].bytes, image);

        const stored = await prisma.artwork.findUnique({ where: { id: artwork.id } });
        assert.equal(stored.imageUrl, artwork.imageUrl);
        assert.equal(stored.imagePublicId, uploads[0].publicId);
        assert.equal(stored.artistId, artist.id);

        const dashboard = await request('/api/artist/dashboard', artistToken);
        assert.equal(dashboard.status, 200);
        const dashboardResult = await dashboard.json();
        assert.equal(dashboardResult.artworks.find((item) => item.id === artwork.id).imagePreviewUrl, artwork.imageUrl);

        const gallery = await fetch(`${baseUrl}/api/artworks`);
        assert.equal(gallery.status, 200);
        assert.equal((await gallery.json()).artworks.find((item) => item.id === artwork.id).imageUrl, artwork.imageUrl);

        const profile = await fetch(`${baseUrl}/api/artists/${encodeURIComponent(dashboardResult.user.slug)}`);
        assert.equal(profile.status, 200);
        assert.equal((await profile.json()).artist.artworks.find((item) => item.id === artwork.id).imageUrl, artwork.imageUrl);

        const ownerUpdate = new FormData();
        ownerUpdate.set('title', 'Cloudinary upload test updated');
        ownerUpdate.set('description', 'Existing Cloudinary image retained.');
        ownerUpdate.set('price', '1200');
        ownerUpdate.set('category', 'Painting');
        ownerUpdate.set('available', 'true');
        ownerUpdate.set('isProtected', 'false');
        ownerUpdate.set('status', 'published');
        ownerUpdate.set('imageUrl', artwork.imageUrl);
        const updated = await request(`/api/artist/artworks/${artwork.id}`, artistToken, {
            method: 'PATCH',
            body: ownerUpdate,
        });
        assert.equal(updated.status, 200);
        assert.equal((await updated.json()).artwork.imageUrl, artwork.imageUrl);

        const otherOwnerUpdate = await request(`/api/artist/artworks/${artwork.id}`, otherArtistToken, {
            method: 'PATCH',
            body: multipart(),
        });
        assert.equal(otherOwnerUpdate.status, 404);
        assert.equal(uploads.length, 1);

        const removed = await request(`/api/artist/artworks/${artwork.id}`, artistToken, { method: 'DELETE' });
        assert.equal(removed.status, 200);
    });

    await t.test('removes a newly uploaded Cloudinary asset if the database save fails', async () => {
        const publicId = 'showpeice/artworks/failed-save-test';
        cloudinary.uploader.upload_stream = (options, callback) => {
            const stream = new PassThrough();
            stream.resume();
            stream.on('finish', () => callback(null, {
                secure_url: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/v123/${publicId}.png`,
                public_id: publicId,
            }));
            return stream;
        };
        prisma.artwork.create = async () => {
            const error = new Error('test database failure');
            error.code = 'P2000';
            throw error;
        };

        const response = await request('/api/artist/artworks', artistToken, {
            method: 'POST',
            body: multipart(),
        });
        assert.equal(response.status, 500);
        assert.match((await response.json()).error, /could not be saved/i);
        assert.ok(deletions.includes(publicId));
    });
});
