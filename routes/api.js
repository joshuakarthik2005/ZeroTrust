const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const ApiToken = require('../models/ApiToken');
const { User, Document } = require('../models');
const { createAuditLog } = require('../utils/auditLogger');
const { authenticateToken } = require('../middleware/auth');

// Middleware to authenticate API token
async function authenticateApiToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'API token required' });
        }
        
        const token = authHeader.split(' ')[1];
        
        // Hash the token
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');
        
        const apiToken = await ApiToken.findOne({
            token: hashedToken,
            isActive: true,
            expiresAt: { $gt: new Date() }
        });
        
        if (!apiToken) {
            return res.status(401).json({ error: 'Invalid or expired API token' });
        }
        
        // Check IP whitelist
        if (apiToken.ipWhitelist && apiToken.ipWhitelist.length > 0) {
            if (!apiToken.ipWhitelist.includes(req.ip)) {
                return res.status(403).json({ error: 'IP address not whitelisted' });
            }
        }
        
        // Update usage
        apiToken.lastUsedAt = new Date();
        apiToken.usageCount += 1;
        await apiToken.save();
        
        req.apiToken = apiToken;
        req.user = { userId: apiToken.userId };
        
        next();
    } catch (error) {
        console.error('API token authentication error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
}

// Check API scope
function requireScope(...scopes) {
    return (req, res, next) => {
        const hasScope = scopes.some(scope => req.apiToken.scopes.includes(scope));
        if (!hasScope) {
            return res.status(403).json({ error: 'Insufficient API permissions' });
        }
        next();
    };
}

// Create API token
router.post('/tokens', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, scopes, expiresIn, ipWhitelist, workspaceId } = req.body;
        
        if (!name || !scopes) {
            return res.status(400).json({ error: 'Name and scopes required' });
        }
        
        // Generate random token
        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto
            .createHash('sha256')
            .update(rawToken)
            .digest('hex');
        
        const apiToken = new ApiToken({
            userId,
            workspaceId: workspaceId || null,
            name,
            token: hashedToken,
            tokenPrefix: rawToken.substring(0, 8),
            scopes,
            ipWhitelist: ipWhitelist || [],
            expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null
        });
        
        await apiToken.save();
        
        await createAuditLog({
            action: 'api.token.create',
            userId,
            workspaceId,
            resourceType: 'api_token',
            resourceId: apiToken._id,
            resourceName: name,
            metadata: { scopes },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            result: 'success'
        });
        
        // Return raw token only this once
        res.status(201).json({
            token: rawToken,
            tokenId: apiToken._id,
            prefix: apiToken.tokenPrefix,
            message: 'Save this token securely - it will not be shown again'
        });
    } catch (error) {
        console.error('Error creating API token:', error);
        res.status(500).json({ error: 'Failed to create API token' });
    }
});

// Get user's API tokens
router.get('/tokens', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const tokens = await ApiToken.find({ userId }).select('-token');
        
        res.json(tokens);
    } catch (error) {
        console.error('Error fetching API tokens:', error);
        res.status(500).json({ error: 'Failed to fetch API tokens' });
    }
});

// Revoke API token
router.delete('/tokens/:tokenId', authenticateToken, async (req, res) => {
    try {
        const { tokenId } = req.params;
        const userId = req.user.userId;
        
        const apiToken = await ApiToken.findOne({ _id: tokenId, userId });
        if (!apiToken) {
            return res.status(404).json({ error: 'API token not found' });
        }
        
        apiToken.isActive = false;
        apiToken.revokedAt = new Date();
        apiToken.revokedBy = userId;
        await apiToken.save();
        
        await createAuditLog({
            action: 'api.token.revoke',
            userId,
            resourceType: 'api_token',
            resourceId: tokenId,
            resourceName: apiToken.name,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            result: 'success'
        });
        
        res.json({ message: 'API token revoked successfully' });
    } catch (error) {
        console.error('Error revoking API token:', error);
        res.status(500).json({ error: 'Failed to revoke API token' });
    }
});

// API endpoints using token auth
router.get('/documents', authenticateApiToken, requireScope('documents:read'), async (req, res) => {
    try {
        const userId = req.user.userId;
        const { workspaceId } = req.query;
        
        const query = { ownerId: userId };
        if (workspaceId) query.workspaceId = workspaceId;
        
        const documents = await Document.find(query).select('title createdAt updatedAt workspaceId');
        
        res.json(documents);
    } catch (error) {
        console.error('API error:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

router.get('/documents/:documentId', authenticateApiToken, requireScope('documents:read'), async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user.userId;
        
        const document = await Document.findOne({
            _id: documentId,
            $or: [
                { ownerId: userId },
                { 'permissions.userId': userId }
            ]
        });
        
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        res.json(document);
    } catch (error) {
        console.error('API error:', error);
        res.status(500).json({ error: 'Failed to fetch document' });
    }
});

module.exports = router;
module.exports.authenticateApiToken = authenticateApiToken;
module.exports.requireScope = requireScope;
