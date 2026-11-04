const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { hasSafeTestDatabase } = require('../testSupport/databaseTestGuard');
const app = require('../app');
const prisma = require('../prisma');

test('GET /api/artworks lists only public published artwork', {
    skip: hasSafeTestDatabase ? false : 'Set TEST_DATABASE_URL to a local disposable *_test database to run database integration tests.',
}, async (t) => {
    const suffix = crypto.randomUUID();
    const artist = await prisma.user.create({
        data: {
            firstName: 'Gallery',
            lastName: 'Artist',
            email: `gallery_${suffix}@example.test`,
            password: 'unused-test-password',
            role: 'artist',
            displayName: 'Gallery Test Artist',
        },
    });
    const hiddenArtist = await prisma.user.create({
        data: {
            firstName: 'Hidden',
            lastName: 'Artist',
            email: `hidden_gallery_${suffix}@example.test`,
            password: 'unused-test-password',
            role: 'artist',
            publicProfileVisible: false,
        },
    });
    await prisma.artwork.createMany({
        data: [
            {
                artistId: artist.id,
                title: 'Published Test Work',
                description: 'Created for the public gallery API test.',
                price: 2500,
                category: 'Painting',
                status: 'published',
            },
            {
                artistId: artist.id,
                title: 'Draft Test Work',
                description: 'This draft must not appear in public results.',
                price: 3000,
                category: 'Painting',
                status: 'draft',
            },
            {
                artistId: hiddenArtist.id,
                title: 'Hidden Profile Work',
                description: 'This work belongs to a private artist profile.',
                price: 3500,
                category: 'Painting',
                status: 'published',
            },
        ],
    });

    const server = app.listen(0);
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        await prisma.artwork.deleteMany({ where: { artistId: { in: [artist.id, hiddenArtist.id] } } });
        await prisma.user.deleteMany({ where: { id: { in: [artist.id, hiddenArtist.id] } } });
    });

    const response = await fetch(`http://localhost:${server.address().port}/api/artworks`);
    assert.equal(response.status, 200);
    const data = await response.json();
    const result = data.artworks.find((item) => item.title === 'Published Test Work');

    assert.ok(result);
    assert.equal(result.price, 2500);
    assert.equal(result.category, 'Painting');
    assert.equal(result.artist.displayName, 'Gallery Test Artist');
    assert.equal(result.artist.slug, 'gallery-test-artist');
    assert.equal(result.imageUrl, null);
    assert.equal(data.artworks.some((item) => item.title === 'Draft Test Work'), false);
    assert.equal(data.artworks.some((item) => item.title === 'Hidden Profile Work'), false);

    const searchArtworks = async (search) => {
        const params = new URLSearchParams({ search });
        const searchResponse = await fetch(`http://localhost:${server.address().port}/api/artworks?${params}`);
        assert.equal(searchResponse.status, 200);
        return (await searchResponse.json()).artworks;
    };
    const titleMatches = await searchArtworks('pUbLiShEd tEsT');
    assert.deepEqual(titleMatches.map((item) => item.title), ['Published Test Work']);
    const artistMatches = await searchArtworks('gallery test');
    assert.deepEqual(artistMatches.map((item) => item.title), ['Published Test Work']);
    const categoryMatches = await searchArtworks('painting');
    assert.ok(categoryMatches.some((item) => item.title === 'Published Test Work'));
    assert.ok(categoryMatches.every((item) => item.category === 'Painting'));
    const draftMatches = await searchArtworks('Draft Test Work');
    assert.deepEqual(draftMatches, []);

    const longSearch = await fetch(`http://localhost:${server.address().port}/api/artworks?${new URLSearchParams({ search: 'x'.repeat(101) })}`);
    assert.equal(longSearch.status, 400);
});
