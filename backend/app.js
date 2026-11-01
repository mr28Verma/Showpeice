const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const buyerRoutes = require('./routes/buyer');
const artistRoutes = require('./routes/artist');
const publicArtistRoutes = require('./routes/publicArtists');
const publicArtworkRoutes = require('./routes/publicArtworks');

const app = express();

const configuredClientOrigins = new Set(
    (process.env.CLIENT_URL || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
            try {
                return new URL(value).origin;
            } catch {
                return null;
            }
        })
        .filter(Boolean)
);

function isLocalDevelopmentOrigin(origin) {
    try {
        const url = new URL(origin);
        return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    } catch {
        return false;
    }
}

app.use(cors({
    origin(origin, callback) {
        if (!origin || configuredClientOrigins.has(origin) ||
            (process.env.NODE_ENV !== 'production' && isLocalDevelopmentOrigin(origin))) {
            return callback(null, true);
        }
        return callback(null, false);
    },
}));
app.use(express.json());

app.use('/uploads/artworks', (_req, res) => res.status(404).end());
app.use(
    '/uploads',
    express.static(path.join(__dirname, 'uploads'), {
        fallthrough: true,
        maxAge: '1d',
    })
);

app.use('/api/auth', authRoutes);
app.use('/api/buyer', buyerRoutes);
app.use('/api/artworks', publicArtworkRoutes);
app.use('/api/artist', artistRoutes);
app.use('/api/artists', publicArtistRoutes);

app.get('/', (_req, res) => {
    res.send('Showpeice API is running');
});

module.exports = app;
