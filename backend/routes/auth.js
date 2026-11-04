const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const requireAuth = require('../middleware/requireAuth');
const { isDatabaseUnavailable } = require('../utils/databaseErrors');

const router = express.Router();

// Signup route for buyers and artists.

router.post('/register', async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
            ? req.body
            : {};
        const { firstName, lastName, email, password } = body;
        const role = body.role ?? 'buyer';

        if (!process.env.JWT_SECRET) {
            console.error('[auth] JWT_SECRET is not configured');
            return res.status(503).json({ message: 'Authentication is temporarily unavailable.' });
        }

        if (typeof role !== 'string' || !['buyer', 'seller'].includes(role)) {
            return res.status(400).json({ message: 'Please choose a valid account type' });
        }

        if (typeof firstName !== 'string' || !firstName.trim() ||
            typeof lastName !== 'string' || !lastName.trim() ||
            typeof email !== 'string' || !email.trim() ||
            typeof password !== 'string' || !password) {
            return res.status(400).json({
                message: 'All fields are required'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({
                message: 'Please provide a valid email address'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters long'
            });
        }

        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail }
        });

        if (existingUser) {
            return res.status(409).json({
                message: 'An account with this email already exists'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: normalizedEmail,
                password: hashedPassword,
                role
            },
            select: { id: true, firstName: true, lastName: true, email: true, role: true }
        });

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        return res.status(201).json({
            message: 'Registration successful',
            token,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({
                message: 'An account with this email already exists'
            });
        }

        console.error('[auth] Registration failed:', error.code || error.name || 'unknown error');
        if (isDatabaseUnavailable(error)) {
            return res.status(503).json({
                message: 'The account service cannot reach the database right now. Please try again shortly.'
            });
        }

        return res.status(500).json({
            message: 'Internal server error'
        });
    }
});



router.post('/login', async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
            ? req.body
            : {};
        const { email, password } = body;

        if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
            return res.status(400).json(
                { message: 'Email and password are required' }
            );
        }

        if (!process.env.JWT_SECRET) {
            console.error('[auth] JWT_SECRET is not configured');
            return res.status(503).json({ message: 'Authentication is temporarily unavailable.' });
        }

        const user = await prisma.user.findUnique({
            where: { email: email.trim().toLowerCase() },
            select: { id: true, firstName: true, lastName: true, email: true, role: true, password: true }
        })

        if (!user) {
            return res.status(401).json(
                { message: 'Invalid email or password' }
            );
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json(
                { message: 'Invalid email or password' }
            );
        }

        if (!['buyer', 'seller', 'artist'].includes(user.role)) {
            return res.status(403).json({ message: 'This account has an invalid role. Please contact support.' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        return res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role
            }
        });
    }
    catch (error) {
        console.error('[auth] Login failed:', error.code || error.name || 'unknown error');
        if (isDatabaseUnavailable(error)) {
            return res.status(503).json({
                message: 'The account service cannot reach the database right now. Please try again shortly.'
            });
        }
        return res.status(500).json(
            { message: 'Sign in could not be completed. Please try again shortly.' }
        );
    }

});

router.get('/me', requireAuth, (req, res) => {
    if (!['buyer', 'seller', 'artist'].includes(req.authenticatedUser.role)) {
        return res.status(403).json({ error: 'This account has an invalid role. Please contact support.' });
    }

    return res.json({ user: req.authenticatedUser });
});

module.exports = router;
