'use strict';

function isCloudinaryArtworkUrl(value) {
    if (typeof value !== 'string') return false;

    try {
        const url = new URL(value);
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        if (!cloudName || url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.search || url.hash) return false;

        const escapedCloudName = cloudName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(
            `^/${escapedCloudName}/image/upload/(?:v\\d+/)?showpeice/artworks/[A-Za-z0-9_/-]+\\.(?:png|jpe?g|webp)$`,
            'i'
        ).test(url.pathname);
    } catch {
        return false;
    }
}

function cloudinaryArtworkPublicId(value) {
    if (!isCloudinaryArtworkUrl(value)) return null;

    try {
        const url = new URL(value);
        const prefix = `/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`;
        let assetPath = url.pathname.slice(prefix.length).replace(/^v\d+\//, '');
        assetPath = assetPath.replace(/\.(?:png|jpe?g|webp)$/i, '');
        return assetPath.startsWith('showpeice/artworks/') ? assetPath : null;
    } catch {
        return null;
    }
}

function publicArtworkImageUrl(artwork) {
    if (!artwork?.imageUrl) return null;

    if (isCloudinaryArtworkUrl(artwork.imageUrl) && !artwork.isProtected) {
        return artwork.imageUrl;
    }

    return `/api/artworks/${artwork.id}/preview`;
}

module.exports = { isCloudinaryArtworkUrl, cloudinaryArtworkPublicId, publicArtworkImageUrl };
