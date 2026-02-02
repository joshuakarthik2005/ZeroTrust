const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const EncryptionService = require('../utils/encryption');
const { User } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Register a new user
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password using bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate MFA secret
        const mfaSecret = speakeasy.generateSecret({
            name: `ZeroTrust (${email})`,
            length: 32
        });

        // Generate RSA key pair for encryption
        const { publicKey, privateKey } = EncryptionService.generateKeyPair();

        // Create user
        const user = new User({
            username,
            email,
            password: hashedPassword,
            mfaSecret: mfaSecret.base32,
            mfaEnabled: false,
            publicKey,
            privateKey,
            role: 'user'
        });

        await user.save();

        // Generate QR code for MFA setup
        const qrCode = await QRCode.toDataURL(mfaSecret.otpauth_url);

        res.status(201).json({
            message: 'User registered successfully',
            userId: user._id.toString(),
            mfaSetup: {
                secret: mfaSecret.base32,
                qrCode
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * Enable MFA for user
 * POST /api/auth/enable-mfa
 */
router.post('/enable-mfa', async (req, res) => {
    try {
        const { userId, token } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Clean token (remove spaces, dashes)
        const cleanToken = token.replace(/[\s-]/g, '');

        // Verify the token with larger window for initial setup
        const verified = speakeasy.totp.verify({
            secret: user.mfaSecret,
            encoding: 'base32',
            token: cleanToken,
            window: 6 // ±3 minutes tolerance for setup
        });

        if (!verified) {
            console.log('MFA verification failed for user:', userId);
            console.log('Token received:', cleanToken);
            return res.status(400).json({ error: 'Invalid MFA token. Please ensure your device time is correct and try the next code.' });
        }

        user.mfaEnabled = true;
        await user.save();

        res.json({
            message: 'MFA enabled successfully',
            mfaEnabled: true
        });
    } catch (error) {
        console.error('Enable MFA error:', error);
        res.status(500).json({ error: 'Failed to enable MFA' });
    }
});

/**
 * Login - Step 1: Verify password
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const foundUser = await User.findOne({ email });
        if (!foundUser) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, foundUser.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Return MFA required
        res.json({
            message: 'Password verified',
            userId: foundUser._id.toString(),
            mfaRequired: foundUser.mfaEnabled,
            mfaEnabled: foundUser.mfaEnabled
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * Login - Step 2: Verify MFA token and issue JWT
 * POST /api/auth/verify-mfa
 */
router.post('/verify-mfa', async (req, res) => {
    try {
        const { userId, token } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.mfaEnabled) {
            return res.status(400).json({ error: 'MFA not enabled for this user' });
        }

        // Clean token (remove spaces, dashes)
        const cleanToken = token.replace(/[\s-]/g, '');

        // Verify MFA token
        const verified = speakeasy.totp.verify({
            secret: user.mfaSecret,
            encoding: 'base32',
            token: cleanToken,
            window: 4 // ±2 minutes tolerance
        });

        if (!verified) {
            return res.status(401).json({ error: 'Invalid MFA token. Please try the current code.' });
        }

        // Generate JWT token
        const jwtToken = jwt.sign(
            { 
                userId: user._id.toString(), 
                email: user.email,
                role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Store session
        req.session.userId = user._id.toString();
        req.session.authenticated = true;

        res.json({
            message: 'Login successful',
            token: jwtToken,
            user: {
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                role: user.role,
                mfaEnabled: user.mfaEnabled
            }
        });
    } catch (error) {
        console.error('MFA verification error:', error);
        res.status(500).json({ error: 'MFA verification failed' });
    }
});

/**
 * Get current user info
 * GET /api/auth/me
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            role: user.role,
            mfaEnabled: user.mfaEnabled
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

/**
 * Logout
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;
