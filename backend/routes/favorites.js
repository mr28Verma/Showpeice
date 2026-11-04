'use strict';

const express = require('express');
const prisma = require('../prisma');
const requireAuth = require('../middleware/requireAuth');
const { artistRoles } = require('../utils/artistSlugs');
const { publicArtworkImageUrl } = require('../utils/cloudinaryArtwork');
const { isDatabaseUnavailable } = require('../utils/databaseErrors');

const router = express.Router();
router.use(requireAuth);

const favoriteArtworkSelect = {
    id: true,
    title: true,
    description: true,
    price: true,
    category: true,
    imageUrl: true,
    isProtected: true,
    available: true,
    createdAt: true,
    artist: {
        select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
        },
    },
};

function validArtworkId(value) {
    return Number.isSafeInteger(value) && value > 0;
}

router.get('/', async (req, res) => {
    try {
        const favorites = await prisma.favorite.findMany({
            where: {
                userId: req.authenticatedUser.id,
                artwork: {
                    is: {
                        status: 'published',
                        artist: { is: { role: { in: artistRoles }, publicProfileVisible: true } },
                    },
                },
            },
            orderBy: [{ createdAt: 'desc' }, { artworkId: 'desc' }],
            select: { artwork: { select: favoriteArtworkSelect } },
        });

        return res.json({
            favorites: favorites.map(({ artwork }) => ({
                ...artwork,
                imageUrl: publicArtworkImageUrl(artwork),
            })),
        });
    } catch (error) {
        console.error('[favorites/list] Saved artwork could not be loaded:', error.code || error.name || 'unknown error');
        return res.status(isDatabaseUnavailable(error) ? 503 : 500).json({ error: 'Saved artwork could not be loaded. Please try again.' });
    }
});

router.post('/:artworkId', async (req, res) => {
    const artworkId = Number(req.params.artworkId);
    if (!validArtworkId(artworkId)) return res.status(400).json({ error: 'Provide a valid artwork ID.' });

    try {
        const artwork = await prisma.artwork.findFirst({
            where: {
                id: artworkId,
                status: 'published',
                artist: { is: { role: { in: artistRoles }, publicProfileVisible: true } },
            },
            select: { id: true },
        });
        if (!artwork) return res.status(404).json({ error: 'This artwork is not available to save.' });

        await prisma.favorite.upsert({
            where: { userId_artworkId: { userId: req.authenticatedUser.id, artworkId } },
            create: { userId: req.authenticatedUser.id, artworkId },
            update: {},
        });
        return res.json({ favorite: true, artworkId });
    } catch (error) {
        console.error('[favorites/add] Saved artwork could not be added:', error.code || error.name || 'unknown error');
        return res.status(isDatabaseUnavailable(error) ? 503 : 500).json({ error: 'This artwork could not be saved. Please try again.' });
    }
});

router.delete('/:artworkId', async (req, res) => {
    const artworkId = Number(req.params.artworkId);
    if (!validArtworkId(artworkId)) return res.status(400).json({ error: 'Provide a valid artwork ID.' });

    try {
        await prisma.favorite.deleteMany({
            where: { userId: req.authenticatedUser.id, artworkId },
        });
        return res.json({ favorite: false, artworkId });
    } catch (error) {
        console.error('[favorites/remove] Saved artwork could not be removed:', error.code || error.name || 'unknown error');
        return res.status(isDatabaseUnavailable(error) ? 503 : 500).json({ error: 'This artwork could not be removed from your saved list. Please try again.' });
    }
});

router.all('/:artworkId', (req, res) => {
    res.set('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Use POST to save artwork or DELETE to remove it from saved artwork.' });
});

module.exports = router;
