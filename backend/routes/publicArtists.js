const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const requireAuth = require('../middleware/requireAuth');
const { artistRoles, buildArtistSlugMap, getArtistSlugMap } = require('../utils/artistSlugs');

const router = express.Router();
const publicArtworkSelect = {
    id: true,
    title: true,
    description: true,
    price: true,
    category: true,
    imageUrl: true,
    isProtected: true,
    available: true,
    createdAt: true,
};

async function loadOptionalViewer(req) {
    const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') || '');
    if (!match || !process.env.JWT_SECRET) return null;
    try {
        const claims = jwt.verify(match[1], process.env.JWT_SECRET);
        const id = Number(claims?.userId);
        if (!Number.isSafeInteger(id) || id < 1) return null;
        return await prisma.user.findUnique({ where: { id }, select: { id: true } });
    } catch {
        return null;
    }
}

async function getFollowerCount(artistId) {
    return prisma.artistFollow.count({ where: { artistId } });
}

router.get('/', async (_req, res) => {
    try {
        const artists = await prisma.user.findMany({
            where: { role: { in: artistRoles } },
            orderBy: [{ displayName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
            select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
                bannerUrl: true,
                medium: true,
                location: true,
                publicProfileVisible: true,
                _count: {
                    select: {
                        followers: true,
                        artworks: { where: { status: 'published' } },
                    },
                },
            },
        });
        const slugById = buildArtistSlugMap(artists);
        return res.json({ artists: artists.filter((artist) => artist.publicProfileVisible).map(({ _count, publicProfileVisible, ...artist }) => ({
            ...artist,
            slug: slugById.get(artist.id),
            followerCount: _count.followers,
            publishedArtworkCount: _count.artworks,
        })) });
    } catch (error) {
        console.error('[artists/list] Public artist list failed:', error.code || error.name || 'unknown error');
        return res.status(500).json({ error: 'Artist profiles could not be loaded. Please try again.' });
    }
});

router.get('/:slug', async (req, res) => {
    const requestedSlug = req.params.slug;
    const legacyId = /^\d+$/.test(requestedSlug) ? Number(requestedSlug) : null;
    if (legacyId !== null && (!Number.isSafeInteger(legacyId) || legacyId < 1)) {
        return res.status(400).json({ error: 'Provide a valid artist ID.' });
    }

    try {
        const slugById = new Map(await getArtistSlugMap(prisma));
        const artistId = legacyId ?? [...slugById.entries()].find(([, slug]) => slug === requestedSlug.toLowerCase())?.[0];
        if (!artistId) return res.status(404).json({ error: 'Artist profile could not be found.' });

        const artist = await prisma.user.findFirst({
            where: { id: artistId, role: { in: artistRoles } },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
                bannerUrl: true,
                medium: true,
                location: true,
                instagramUrl: true,
                websiteUrl: true,
                publicProfileVisible: true,
                createdAt: true,
                artworks: {
                    where: { status: 'published' },
                    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
                    select: publicArtworkSelect,
                },
            },
        });
        if (!artist) return res.status(404).json({ error: 'Artist profile could not be found.' });

        const viewer = await loadOptionalViewer(req);
        if (!artist.publicProfileVisible && viewer?.id !== artistId) return res.status(404).json({ error: 'Artist profile could not be found.' });
        const [followerCount, isFollowing] = await Promise.all([
            getFollowerCount(artistId),
            viewer && viewer.id !== artistId
                ? prisma.artistFollow.findUnique({ where: { followerId_artistId: { followerId: viewer.id, artistId } } })
                : Promise.resolve(null),
        ]);

        const artworks = artist.artworks.map((item) => ({
            ...item,
            imageUrl: item.imageUrl ? `/api/artworks/${item.id}/preview` : null,
        }));
        return res.json({ artist: { ...artist, artworks, slug: slugById.get(artistId), followerCount, isFollowing: Boolean(isFollowing), isOwnProfile: viewer?.id === artistId } });
    } catch (error) {
        console.error('[artists/profile] Public profile query failed:', error.code || error.name || 'unknown error');
        return res.status(500).json({ error: 'We could not load this artist profile. Please try again.' });
    }
});

router.post('/:id/follow', requireAuth, async (req, res) => {
    const artistId = Number(req.params.id);
    const followerId = req.authenticatedUser.id;
    if (!Number.isSafeInteger(artistId) || artistId < 1) {
        return res.status(400).json({ error: 'Provide a valid artist ID.' });
    }
    if (artistId === followerId) return res.status(400).json({ error: 'You cannot follow your own profile.' });

    try {
        const artist = await prisma.user.findFirst({ where: { id: artistId, role: { in: artistRoles } }, select: { id: true } });
        if (!artist) return res.status(404).json({ error: 'Artist profile could not be found.' });

        await prisma.artistFollow.upsert({
            where: { followerId_artistId: { followerId, artistId } },
            create: { followerId, artistId },
            update: {},
        });
        const followerCount = await getFollowerCount(artistId);
        return res.json({ isFollowing: true, followerCount });
    } catch (error) {
        console.error('[artists/follow] Follow request failed:', error.code || error.name || 'unknown error');
        return res.status(500).json({ error: 'This artist could not be followed. Please try again.' });
    }
});

router.delete('/:id/follow', requireAuth, async (req, res) => {
    const artistId = Number(req.params.id);
    const followerId = req.authenticatedUser.id;
    if (!Number.isSafeInteger(artistId) || artistId < 1) {
        return res.status(400).json({ error: 'Provide a valid artist ID.' });
    }
    if (artistId === followerId) return res.status(400).json({ error: 'You cannot unfollow your own profile.' });

    try {
        const artist = await prisma.user.findFirst({ where: { id: artistId, role: { in: artistRoles } }, select: { id: true } });
        if (!artist) return res.status(404).json({ error: 'Artist profile could not be found.' });

        await prisma.artistFollow.deleteMany({ where: { followerId, artistId } });
        const followerCount = await getFollowerCount(artistId);
        return res.json({ isFollowing: false, followerCount });
    } catch (error) {
        console.error('[artists/follow] Unfollow request failed:', error.code || error.name || 'unknown error');
        return res.status(500).json({ error: 'This artist could not be unfollowed. Please try again.' });
    }
});

module.exports = router;
