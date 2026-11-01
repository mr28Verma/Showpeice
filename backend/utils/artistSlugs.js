const artistRoles = ['artist', 'seller'];

function artistSlugBase(artist) {
    const displayName = typeof artist.displayName === 'string' ? artist.displayName.trim() : '';
    const fullName = `${artist.firstName || ''} ${artist.lastName || ''}`.trim();
    const name = displayName || fullName;
    const slug = name
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    if (!slug) return `artist-${artist.id}`;
    return /^\d+$/.test(slug) ? `artist-${slug}` : slug;
}

function buildArtistSlugMap(artists) {
    const bases = artists.map((artist) => ({ artist, base: artistSlugBase(artist) }));
    const counts = new Map();
    for (const { base } of bases) counts.set(base, (counts.get(base) || 0) + 1);

    const reservedBases = new Set(counts.keys());
    const slugs = new Map();
    const used = new Set();

    for (const { artist, base } of bases) {
        if (counts.get(base) === 1) {
            slugs.set(artist.id, base);
            used.add(base);
        }
    }

    const duplicateGroups = new Map();
    for (const entry of bases) {
        if (counts.get(entry.base) === 1) continue;
        const group = duplicateGroups.get(entry.base) || [];
        group.push(entry);
        duplicateGroups.set(entry.base, group);
    }

    for (const [base, group] of duplicateGroups) {
        group.sort((a, b) => a.artist.id - b.artist.id);
        const [canonical, ...duplicates] = group;
        slugs.set(canonical.artist.id, base);
        used.add(base);

        for (const { artist } of duplicates) {
            let slug = `${base}-${artist.id}`;
            let suffix = 2;
            while (reservedBases.has(slug) || used.has(slug)) {
                slug = `${base}-${artist.id}-${suffix}`;
                suffix += 1;
            }
            slugs.set(artist.id, slug);
            used.add(slug);
        }
    }

    return slugs;
}

async function getArtistSlugMap(prisma) {
    const artists = await prisma.user.findMany({
        where: { role: { in: artistRoles } },
        select: { id: true, firstName: true, lastName: true, displayName: true },
    });
    return buildArtistSlugMap(artists);
}

module.exports = { artistRoles, buildArtistSlugMap, getArtistSlugMap };
