const express = require('express');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { authenticateToken, documentACL } = require('../middleware/auth');
const { User, Document, InviteToken } = require('../models');

const router = express.Router();

/**
 * Generate secure invite token for workspace/document
 * POST /api/invites/generate
 */
router.post('/generate', authenticateToken, async (req, res) => {
    try {
        const { documentId, expiresIn, permissions, maxUses } = req.body;
        const userId = req.user.userId;

        // Validate permissions
        if (documentId && !documentACL.hasPermission(documentId, userId, 'share')) {
            const doc = await Document.findById(documentId);
            if (!doc || doc.ownerId.toString() !== userId) {
                return res.status(403).json({ error: 'Cannot create invite for this document' });
            }
        }

        // Generate secure random token
        const tokenId = crypto.randomBytes(16).toString('hex');
        const tokenData = {
            invitedBy: userId,
            documentId: documentId || null,
            permissions: permissions || ['read'],
            createdAt: new Date(),
            expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 60000) : null,
            maxUses: maxUses || 1,
            uses: 0
        };

        // Create token payload
        const payload = JSON.stringify(tokenData);
        
        // Encode with Base64
        const base64Token = Buffer.from(payload).toString('base64');
        const fullToken = `${tokenId}:${base64Token}`;

        // Store token in database
        const inviteToken = new InviteToken({
            tokenId,
            invitedBy: userId,
            documentId: documentId || undefined,
            permissions: permissions || ['read'],
            expiresAt: tokenData.expiresAt,
            maxUses: tokenData.maxUses,
            uses: 0
        });
        await inviteToken.save();

        // Generate QR code
        const inviteUrl = `${req.protocol}://${req.get('host')}/accept-invite?token=${encodeURIComponent(fullToken)}`;
        const qrCode = await QRCode.toDataURL(inviteUrl);

        res.json({
            message: 'Invite created successfully',
            token: fullToken,
            tokenId,
            qrCode,
            inviteUrl,
            expiresAt: tokenData.expiresAt,
            maxUses: tokenData.maxUses
        });
    } catch (error) {
        console.error('Generate invite error:', error);
        res.status(500).json({ error: 'Failed to generate invite' });
    }
});

/**
 * Validate and decode invite token
 * GET /api/invites/validate/:token
 */
router.get('/validate/:token', async (req, res) => {
    try {
        const fullToken = req.params.token;
        const [tokenId, base64Token] = fullToken.split(':');

        if (!tokenId || !base64Token) {
            return res.status(400).json({ error: 'Invalid token format' });
        }

        const tokenData = await InviteToken.findOne({ tokenId });
        if (!tokenData) {
            return res.status(404).json({ error: 'Token not found or expired' });
        }

        // Check expiration
        if (tokenData.expiresAt && new Date() > new Date(tokenData.expiresAt)) {
            await InviteToken.findByIdAndDelete(tokenData._id);
            return res.status(410).json({ error: 'Token has expired' });
        }

        // Check max uses
        if (tokenData.uses >= tokenData.maxUses) {
            await InviteToken.findByIdAndDelete(tokenData._id);
            return res.status(410).json({ error: 'Token has reached maximum uses' });
        }

        // Decode Base64
        const decoded = Buffer.from(base64Token, 'base64').toString('utf8');
        const payload = JSON.parse(decoded);

        const inviter = await User.findById(tokenData.invitedBy);

        res.json({
            valid: true,
            invitedBy: inviter ? inviter.username : 'Unknown',
            documentId: payload.documentId,
            permissions: payload.permissions,
            createdAt: payload.createdAt,
            expiresAt: payload.expiresAt,
            usesRemaining: payload.maxUses - tokenData.uses
        });
    } catch (error) {
        console.error('Validate invite error:', error);
        res.status(400).json({ error: 'Invalid token' });
    }
});

/**
 * Accept invite token (must be authenticated)
 * POST /api/invites/accept
 */
router.post('/accept', authenticateToken, async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.userId;
        const [tokenId, base64Token] = token.split(':');

        if (!tokenId || !base64Token) {
            return res.status(400).json({ error: 'Invalid token format' });
        }

        const tokenData = await InviteToken.findOne({ tokenId });
        if (!tokenData) {
            return res.status(404).json({ error: 'Token not found or expired' });
        }

        // Check expiration
        if (tokenData.expiresAt && new Date() > new Date(tokenData.expiresAt)) {
            await InviteToken.findByIdAndDelete(tokenData._id);
            return res.status(410).json({ error: 'Token has expired' });
        }

        // Check max uses
        if (tokenData.uses >= tokenData.maxUses) {
            await InviteToken.findByIdAndDelete(tokenData._id);
            return res.status(410).json({ error: 'Token has reached maximum uses' });
        }

        // Grant access based on invite
        if (tokenData.documentId) {
            const document = await Document.findById(tokenData.documentId);
            
            if (!document) {
                return res.status(404).json({ error: 'Document no longer exists' });
            }

            // Grant permissions
            documentACL.grant(tokenData.documentId, userId, tokenData.permissions);

            // Update document permissions array
            document.permissions = document.permissions.filter(
                p => p.userId.toString() !== userId
            );
            document.permissions.push({
                userId,
                permissions: tokenData.permissions
            });

            // If encrypted, encrypt for new user
            if (document.encrypted) {
                const EncryptionService = require('../utils/encryption');
                const inviter = await User.findById(tokenData.invitedBy);
                const newUser = await User.findById(userId);

                if (inviter && newUser) {
                    const inviterPackage = document.encryptedKeys.get(tokenData.invitedBy.toString());
                    if (inviterPackage) {
                        const decryptedContent = EncryptionService.decryptData(
                            inviterPackage,
                            inviter.privateKey
                        );
                        const newPackage = EncryptionService.encryptData(
                            decryptedContent,
                            newUser.publicKey
                        );
                        document.encryptedKeys.set(userId, newPackage);
                    }
                }
            }
            await document.save();
        }

        // Increment uses
        tokenData.uses++;
        await tokenData.save();

        // Delete if max uses reached
        if (tokenData.uses >= tokenData.maxUses) {
            await InviteToken.findByIdAndDelete(tokenData._id);
        }

        res.json({
            message: 'Invite accepted successfully',
            documentId: tokenData.documentId,
            permissions: tokenData.permissions
        });
    } catch (error) {
        console.error('Accept invite error:', error);
        res.status(500).json({ error: 'Failed to accept invite' });
    }
});

/**
 * List all active invites created by user
 * GET /api/invites/my-invites
 */
router.get('/my-invites', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const inviteTokens = await InviteToken.find({ invitedBy: userId });
        const myInvites = inviteTokens.map(tokenData => ({
            tokenId: tokenData.tokenId,
            documentId: tokenData.documentId,
            permissions: tokenData.permissions,
            createdAt: tokenData.createdAt,
            expiresAt: tokenData.expiresAt,
            uses: tokenData.uses,
            maxUses: tokenData.maxUses,
            active: tokenData.uses < tokenData.maxUses && 
                    (!tokenData.expiresAt || new Date() < new Date(tokenData.expiresAt))
        }));

        res.json({ invites: myInvites });
    } catch (error) {
        console.error('Get invites error:', error);
        res.status(500).json({ error: 'Failed to retrieve invites' });
    }
});

/**
 * Revoke an invite token
 * DELETE /api/invites/:tokenId
 */
router.delete('/:tokenId', authenticateToken, async (req, res) => {
    try {
        const tokenId = req.params.tokenId;
        const userId = req.user.userId;
        const tokenData = await InviteToken.findOne({ tokenId });

        if (!tokenData) {
            return res.status(404).json({ error: 'Token not found' });
        }

        if (tokenData.invitedBy.toString() !== userId) {
            return res.status(403).json({ error: 'Cannot revoke this invite' });
        }

        await InviteToken.findByIdAndDelete(tokenData._id);
        res.json({ message: 'Invite revoked successfully' });
    } catch (error) {
        console.error('Revoke invite error:', error);
        res.status(500).json({ error: 'Failed to revoke invite' });
    }
});

module.exports = router;
