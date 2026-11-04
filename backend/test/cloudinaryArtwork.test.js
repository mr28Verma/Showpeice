'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.CLOUDINARY_CLOUD_NAME = 'showpeice-test';
const { cloudinaryArtworkPublicId, isCloudinaryArtworkUrl } = require('../utils/cloudinaryArtwork');

test('Cloudinary artwork IDs are recovered only from this account artwork URLs', () => {
    const imageUrl = 'https://res.cloudinary.com/showpeice-test/image/upload/v123/showpeice/artworks/abc_01.png';
    assert.equal(isCloudinaryArtworkUrl(imageUrl), true);
    assert.equal(cloudinaryArtworkPublicId(imageUrl), 'showpeice/artworks/abc_01');
    assert.equal(cloudinaryArtworkPublicId('https://res.cloudinary.com/another-account/image/upload/showpeice/artworks/abc.png'), null);
    assert.equal(cloudinaryArtworkPublicId(`${imageUrl}?download=1`), null);
});
