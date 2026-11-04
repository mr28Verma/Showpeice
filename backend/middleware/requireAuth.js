
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

function redactDatabaseUrls(value) {
    let diagnostic = String(value);

    for (const variable of ['DATABASE_URL', 'DIRECT_URL']) {
        const databaseUrl = process.env[variable];
        if (databaseUrl) diagnostic = diagnostic.split(databaseUrl).join('[redacted database URL]');
    }

    return diagnostic.replace(/postgres(?:ql)?:\/\/[^\s`"'<>]+/gi, '[redacted database URL]');
}

async function requireAuth(req, res, next) {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
        return res.status(401).json({
            error: 'A bearer token is required.',
        });
    }

    if (!process.env.JWT_SECRET) {
        console.error('[auth] JWT_SECRET is not configured');

        return res.status(503).json({
            error: 'Authentication is temporarily unavailable.',
        });
    }

    let claims;

    try {
        claims = jwt.verify(match[1], process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({
            error: 'Your session is invalid or has expired. Please sign in again.',
        });
    }

    const userId = Number(claims?.userId);

    if (!Number.isSafeInteger(userId) || userId < 1) {
        return res.status(401).json({
            error: 'Your session is invalid. Please sign in again.',
        });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                createdAt: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
                bannerUrl: true,
                medium: true,
                location: true,
                instagramUrl: true,
                websiteUrl: true,
                emailNotifications: true,
                publicProfileVisible: true,
                phone: true,
            },
        });

        if (!user) {
            return res.status(401).json({
                error: 'The account for this session no longer exists.',
            });
        }

        req.authenticatedUser = user;

        return next();
    } catch (error) {
        console.error(
            '[auth] Account lookup failed:',
            error.code || error.name || 'unknown error'
        );

        if (process.env.NODE_ENV !== 'production') {
            const diagnostic = error.stack || error.message;
            if (diagnostic) console.error(redactDatabaseUrls(diagnostic));
        }

        return res.status(503).json({
            error: 'Authentication is temporarily unavailable.',
        });
    }
}

module.exports = requireAuth;
