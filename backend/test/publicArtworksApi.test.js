'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.CLOUDINARY_CLOUD_NAME = 'showpeice-test';

const app = require('../app');
const prisma = require('../prisma');

test('public gallery returns only visible published work and applies search consistently', async (t) => {
    const originalArtworkFindMany = prisma.artwork.findMany;
    const originalUserFindMany = prisma.user.findMany;
    const artists = [
        { id: 921, firstName: 'Sun', lastName: 'Artist', displayName: 'Sun Studio', publicProfileVisible: true },
        { id: 922, firstName: 'Hidden', lastName: 'Artist', displayName: 'Hidden Studio', publicProfileVisible: false },
    ];
    const artworks = [
        {
            id: 931, artistId: 921, title: 'Sunlit courtyard', description: 'Visible original.', price: 2100,
            category: 'Painting', imageUrl: 'https://res.cloudinary.com/showpeice-test/image/upload/v12/showpeice/artworks/sunlit.jpg',
            isProtected: false, available: true, status: 'published', createdAt: new Date('2025-02-02'), updatedAt: new Date('2025-02-02'),
            artist: artists[0],
        },
        {
            id: 932, artistId: 921, title: 'Quiet blue', description: 'Another visible original.', price: 2500,
            category: 'Printmaking', imageUrl: 'https://res.cloudinary.com/showpeice-test/image/upload/v12/showpeice/artworks/blue.jpg',
            isProtected: true, available: true, status: 'published', createdAt: new Date('2025-02-01'), updatedAt: new Date('2025-02-01'),
            artist: artists[0],
        },
        {
            id: 933, artistId: 922, title: 'Hidden sun', description: 'Private artist work.', price: 3500,
            category: 'Painting', imageUrl: 'https://res.cloudinary.com/showpeice-test/image/upload/v12/showpeice/artworks/hidden.jpg',
            isProtected: false, available: true, status: 'published', createdAt: new Date('2025-01-30'), updatedAt: new Date('2025-01-30'),
            artist: artists[1],
        },
        {
            id: 934, artistId: 921, title: 'Draft sun', description: 'Unpublished work.', price: 3900,
            category: 'Painting', imageUrl: 'https://res.cloudinary.com/showpeice-test/image/upload/v12/showpeice/artworks/draft.jpg',
            isProtected: false, available: true, status: 'draft', createdAt: new Date('2025-01-29'), updatedAt: new Date('2025-01-29'),
            artist: artists[0],
        },
    ];
    const queries = [];

    prisma.artwork.findMany = async (args) => {
        queries.push(args);
        const search = args.where.AND?.[0]?.OR?.[0]?.title?.contains?.toLowerCase() || '';
        return artworks.filter((artwork) => {
            if (artwork.status !== args.where.status || !artwork.artist.publicProfileVisible) return false;
            if (!search) return true;
            return [
                artwork.title,
                artwork.category,
                artwork.artist.firstName,
                artwork.artist.lastName,
                artwork.artist.displayName,
            ].some((value) => value.toLowerCase().includes(search));
        });
    };
    prisma.user.findMany = async () => artists.map(({ id, firstName, lastName, displayName }) => ({ id, firstName, lastName, displayName }));

    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    t.after(async () => {
        prisma.artwork.findMany = originalArtworkFindMany;
        prisma.user.findMany = originalUserFindMany;
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    });

    const baseUrl = `http://127.0.0.1:${server.address().port}/api/artworks`;
    const searchResponse = await fetch(`${baseUrl}?search=courtyard`);
    assert.equal(searchResponse.status, 200);
    const searchResult = await searchResponse.json();
    assert.deepEqual(searchResult.artworks.map(({ id }) => id), [931]);
    assert.equal(searchResult.artworks[0].artist.slug, 'sun-studio');
    assert.equal(searchResult.artworks[0].imageUrl, artworks[0].imageUrl);
    assert.equal(queries[0].where.status, 'published');
    assert.equal(queries[0].where.artist.is.publicProfileVisible, true);
    assert.deepEqual(queries[0].orderBy, [{ updatedAt: 'desc' }, { id: 'desc' }]);

    const tooLong = await fetch(`${baseUrl}?search=${'x'.repeat(101)}`);
    assert.equal(tooLong.status, 400);
    assert.equal(queries.length, 1);
});
