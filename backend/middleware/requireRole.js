function requireRoles(allowedRoles, accountType) {
    return function roleGuard(req, res, next) {
        const role = req.authenticatedUser?.role;
        const validRoles = ['buyer', 'seller', 'artist'];

        if (!validRoles.includes(role)) {
            return res.status(403).json({ error: 'This account has an invalid role. Please contact support.' });
        }

        if (!allowedRoles.includes(role)) {
            return res.status(403).json({ error: `This account does not have ${accountType} access.` });
        }

        return next();
    };
}

module.exports = {
    requireBuyerAccess: requireRoles(['buyer'], 'buyer'),
    requireArtistAccess: requireRoles(['seller', 'artist'], 'artist'),
};
