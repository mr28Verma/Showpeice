'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../prisma');

test('public artist profile exposes email only when the artist opted in', async (t) => {
    const originalFindMany = prisma.user.findMany;
    const originalFindFirst = prisma.user.findFirst;
    const originalFollowCount = prisma.artistFollow.count;
    let publicEmailVisible = false;
    const artistRecord = () => ({
        id: 501,
        firstName: 'Public',
        lastName: 'Artist',
        displayName: 'Public Artist',
        email: 'public-artist@example.test',
        publicEmailVisible,
        shopAnnouncement: 'New originals are available.',
        bio: 'A public artist biography.',
        avatarUrl: null,
        bannerUrl: null,
        medium: null,
        location: null,
        instagramUrl: null,
        websiteUrl: null,
        publicProfileVisible: true,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        artworks: [],
    });

    prisma.user.findMany = async () => [{ id: 501, firstName: 'Public', lastName: 'Artist', displayName: 'Public Artist' }];
    prisma.user.findFirst = async () => artistRecord();
    prisma.artistFollow.count = async () => 0;

    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    t.after(async () => {
        prisma.user.findMany = originalFindMany;
        prisma.user.findFirst = originalFindFirst;
        prisma.artistFollow.count = originalFollowCount;
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    });

    const url = `http://127.0.0.1:${server.address().port}/api/artists/public-artist`;
    const hiddenResponse = await fetch(url);
    assert.equal(hiddenResponse.status, 200);
    const hiddenProfile = (await hiddenResponse.json()).artist;
    assert.equal(hiddenProfile.publicEmail, null);
    assert.equal('email' in hiddenProfile, false);
    assert.equal(hiddenProfile.shopAnnouncement, 'New originals are available.');

    publicEmailVisible = true;
    const visibleResponse = await fetch(url);
    assert.equal(visibleResponse.status, 200);
    const visibleProfile = (await visibleResponse.json()).artist;
    assert.equal(visibleProfile.publicEmail, 'public-artist@example.test');
    assert.equal('email' in visibleProfile, false);
});
