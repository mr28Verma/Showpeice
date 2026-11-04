'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'favorites-api-test-secret';
process.env.CLOUDINARY_CLOUD_NAME = 'showpeice-test';

const app = require('../app');
const prisma = require('../prisma');

test('favorites API stores saved artwork per user and returns only public published work', async (t) => {
    const originals = {
        userFindUnique: prisma.user.findUnique,
        artworkFindFirst: prisma.artwork.findFirst,
        favoriteFindMany: prisma.favorite.findMany,
        favoriteUpsert: prisma.favorite.upsert,
        favoriteDeleteMany: prisma.favorite.deleteMany,
    };
    const users = new Map([
        [941, { id: 941, firstName: 'Buyer', lastName: 'One', email: 'favorite-one@example.test', role: 'buyer' }],
        [942, { id: 942, firstName: 'Buyer', lastName: 'Two', email: 'favorite-two@example.test', role: 'buyer' }],
        [943, { id: 943, firstName: 'Artist', lastName: 'One', email: 'favorite-artist@example.test', role: 'artist' }],
    ]);
    const artworks = new Map([
        [951, { id: 951, title: 'Public favorite', description: 'Gallery work.', price: 1800, category: 'Painting', imageUrl: 'https://res.cloudinary.com/showpeice-test/image/upload/v7/showpeice/artworks/favorite.jpg', isProtected: false, available: true, status: 'published', createdAt: new Date(), artist: { id: 961, firstName: 'Public', lastName: 'Artist', displayName: null, role: 'artist', publicProfileVisible: true } }],
        [952, { id: 952, title: 'Private favorite', description: 'Private profile work.', price: 1900, category: 'Painting', imageUrl: null, isProtected: false, available: true, status: 'published', createdAt: new Date(), artist: { id: 962, firstName: 'Private', lastName: 'Artist', displayName: null, role: 'artist', publicProfileVisible: false } }],
        [953, { id: 953, title: 'Draft favorite', description: 'Unpublished work.', price: 2000, category: 'Painting', imageUrl: null, isProtected: false, available: true, status: 'draft', createdAt: new Date(), artist: { id: 961, firstName: 'Public', lastName: 'Artist', displayName: null, role: 'artist', publicProfileVisible: true } }],
    ]);
    const favorites = new Map();
    const keyFor = (userId, artworkId) => `${userId}:${artworkId}`;

    prisma.user.findUnique = async ({ where }) => users.get(where.id) || null;
    prisma.artwork.findFirst = async ({ where }) => {
        const artwork = artworks.get(where.id);
        return artwork && artwork.status === where.status && artwork.artist.publicProfileVisible &&
            ['artist', 'seller'].includes(artwork.artist.role)
            ? { id: artwork.id }
            : null;
    };
    prisma.favorite.upsert = async ({ where, create }) => {
        const key = keyFor(where.userId_artworkId.userId, where.userId_artworkId.artworkId);
        if (!favorites.has(key)) favorites.set(key, { ...create, createdAt: new Date() });
        return favorites.get(key);
    };
    prisma.favorite.findMany = async ({ where }) => [...favorites.values()]
        .filter((favorite) => {
            const artwork = artworks.get(favorite.artworkId);
            return favorite.userId === where.userId && artwork?.status === 'published' && artwork.artist.publicProfileVisible;
        })
        .map((favorite) => {
            const artwork = artworks.get(favorite.artworkId);
            return {
                artwork: {
                    id: artwork.id,
                    title: artwork.title,
                    description: artwork.description,
                    price: artwork.price,
                    category: artwork.category,
                    imageUrl: artwork.imageUrl,
                    isProtected: artwork.isProtected,
                    available: artwork.available,
                    createdAt: artwork.createdAt,
                    artist: {
                        id: artwork.artist.id,
                        firstName: artwork.artist.firstName,
                        lastName: artwork.artist.lastName,
                        displayName: artwork.artist.displayName,
                    },
                },
            };
        });
    prisma.favorite.deleteMany = async ({ where }) => {
        const key = keyFor(where.userId, where.artworkId);
        const count = favorites.delete(key) ? 1 : 0;
        return { count };
    };

    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    t.after(async () => {
        prisma.user.findUnique = originals.userFindUnique;
        prisma.artwork.findFirst = originals.artworkFindFirst;
        prisma.favorite.findMany = originals.favoriteFindMany;
        prisma.favorite.upsert = originals.favoriteUpsert;
        prisma.favorite.deleteMany = originals.favoriteDeleteMany;
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    });

    const baseUrl = `http://127.0.0.1:${server.address().port}/api/favorites`;
    const tokenFor = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const request = (path, token, method) => fetch(`${baseUrl}${path}`, {
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const buyerToken = tokenFor(941);
    const otherBuyerToken = tokenFor(942);
    const artistToken = tokenFor(943);

    assert.equal((await request('', null)).status, 401);
    assert.equal((await request('/not-an-id', buyerToken, 'POST')).status, 400);
    assert.equal((await request('/952', buyerToken, 'POST')).status, 404);
    assert.equal((await request('/953', buyerToken, 'POST')).status, 404);

    assert.equal((await request('/951', buyerToken, 'POST')).status, 200);
    assert.equal((await request('/951', buyerToken, 'POST')).status, 200);
    const savedResponse = await request('', buyerToken);
    assert.equal(savedResponse.status, 200);
    const saved = (await savedResponse.json()).favorites;
    assert.deepEqual(saved.map(({ id }) => id), [951]);
    assert.equal(saved[0].imageUrl, artworks.get(951).imageUrl);

    assert.deepEqual((await (await request('', otherBuyerToken)).json()).favorites, []);
    assert.equal((await request('/951', otherBuyerToken, 'DELETE')).status, 200);
    assert.equal((await (await request('', buyerToken)).json()).favorites.length, 1);
    assert.equal((await request('/951', artistToken, 'POST')).status, 200);
    assert.equal((await (await request('', artistToken)).json()).favorites.length, 1);

    assert.equal((await request('/951', buyerToken, 'DELETE')).status, 200);
    assert.deepEqual((await (await request('', buyerToken)).json()).favorites, []);

    prisma.favorite.findMany = async () => {
        const error = new Error('Favorites table is missing.');
        error.code = 'P2021';
        throw error;
    };
    assert.equal((await request('', buyerToken)).status, 503);
});
