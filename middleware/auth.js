const jwt = require('jsonwebtoken');
const { createAuditLog } = require('../utils/auditLogger');
const { User } = require('../models');

/**
 * Verify JWT token middleware
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = decoded;
        req.authToken = token;
        next();
    });
}

/**
 * Role-based authorization middleware
 */
function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
}

/**
 * ACL - Access Control List for documents
 * Permissions: read, write, delete, sign, share
 */
class ACL {
    constructor() {
        this.permissions = new Map(); // documentId -> Map(userId -> permissions[])
    }

    /**
     * Grant permission to a user for a document
     */
    grant(documentId, userId, permissions) {
        if (!this.permissions.has(documentId)) {
            this.permissions.set(documentId, new Map());
        }
        
        const docPermissions = this.permissions.get(documentId);
        const existing = docPermissions.get(userId) || [];
        const newPermissions = [...new Set([...existing, ...permissions])];
        docPermissions.set(userId, newPermissions);
    }

    /**
     * Revoke permission from a user for a document
     */
    revoke(documentId, userId, permissions) {
        if (!this.permissions.has(documentId)) {
            return;
        }

        const docPermissions = this.permissions.get(documentId);
        const existing = docPermissions.get(userId) || [];
        const newPermissions = existing.filter(p => !permissions.includes(p));
        
        if (newPermissions.length > 0) {
            docPermissions.set(userId, newPermissions);
        } else {
            docPermissions.delete(userId);
        }
    }

    /**
     * Check if user has specific permission for a document
     */
    hasPermission(documentId, userId, permission) {
        if (!this.permissions.has(documentId)) {
            return false;
        }

        const docPermissions = this.permissions.get(documentId);
        const userPermissions = docPermissions.get(userId) || [];
        
        return userPermissions.includes(permission) || userPermissions.includes('*');
    }

    /**
     * Get all permissions for a user on a document
     */
    getPermissions(documentId, userId) {
        if (!this.permissions.has(documentId)) {
            return [];
        }

        const docPermissions = this.permissions.get(documentId);
        return docPermissions.get(userId) || [];
    }

    /**
     * Get all users with access to a document
     */
    getDocumentUsers(documentId) {
        if (!this.permissions.has(documentId)) {
            return [];
        }

        const docPermissions = this.permissions.get(documentId);
        return Array.from(docPermissions.keys());
    }
}

// Global ACL instance
const documentACL = new ACL();

/**
 * Middleware to check document permissions
 */
function checkDocumentPermission(permission) {
    return async (req, res, next) => {
        try {
            const documentId = req.params.id || req.body.documentId;
            const userId = req.user.userId;
            
            console.log('Checking permission:', permission, 'for doc:', documentId, 'user:', userId);

            // Get document to check ownership
            const { Document } = require('../models');
            const document = await Document.findById(documentId);

            if (!document) {
                console.log('Document not found in permission check:', documentId);
                return res.status(404).json({ error: 'Document not found' });
            }
            
            console.log('Document owner:', document.ownerId, 'requesting user:', userId);

            // Owner has all permissions
            if (document.ownerId.toString() === userId) {
                console.log('User is owner, granting access');
                return next();
            }

            // Check MongoDB permissions array first (for serverless persistence)
            const docPermission = document.permissions.find(p => p.userId.toString() === userId);
            if (docPermission && docPermission.permissions.includes(permission)) {
                return next();
            }

            // Also check in-memory ACL (backward compatibility)
            if (documentACL.hasPermission(documentId, userId, permission)) {
                return next();
            }

            return res.status(403).json({ 
                error: `You don't have ${permission} permission for this document` 
            });
        } catch (error) {
            console.error('checkDocumentPermission error:', error);
            return res.status(500).json({ error: 'Permission check failed: ' + error.message });
        }
    };
}

module.exports = {
    authenticateToken,
    authorize,
    ACL,
    documentACL,
    checkDocumentPermission,
    requireReAuth,
    checkSensitiveAction
};

/**
 * Continuous authentication - require re-auth for sensitive actions
 */
function requireReAuth(actionType) {
    return async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const user = await User.findById(userId);
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            // Check if user requires re-auth for this action
            if (user.requireReAuthFor && user.requireReAuthFor.includes(actionType)) {
                const reAuthToken = req.headers['x-reauth-token'];
                const reAuthMfa = req.headers['x-reauth-mfa'];
                
                if (!reAuthToken && !reAuthMfa) {
                    return res.status(403).json({ 
                        error: 'Re-authentication required',
                        reAuthRequired: true,
                        actionType
                    });
                }
                
                // Verify MFA if provided
                if (reAuthMfa && user.mfaEnabled) {
                    const speakeasy = require('speakeasy');
                    const verified = speakeasy.totp.verify({
                        secret: user.mfaSecret,
                        encoding: 'base32',
                        token: reAuthMfa,
                        window: 2
                    });
                    
                    if (!verified) {
                        await createAuditLog({
                            action: 'security.reauth.failed',
                            userId,
                            resourceType: 'user',
                            resourceId: userId,
                            metadata: { actionType, reason: 'Invalid MFA token' },
                            ipAddress: req.ip,
                            userAgent: req.headers['user-agent'],
                            severity: 'high',
                            result: 'blocked'
                        });
                        
                        return res.status(403).json({ error: 'Invalid re-authentication token' });
                    }
                }
                
                // Log successful re-auth
                await createAuditLog({
                    action: 'security.reauth.success',
                    userId,
                    resourceType: 'user',
                    resourceId: userId,
                    metadata: { actionType },
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                    severity: 'medium',
                    result: 'success'
                });
            }
            
            next();
        } catch (error) {
            console.error('Re-auth error:', error);
            res.status(500).json({ error: 'Re-authentication check failed' });
        }
    };
}

/**
 * Check for sensitive actions based on risk
 */
function checkSensitiveAction(actionType) {
    return async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const DeviceSession = require('../models/DeviceSession');
            
            // Find current session
            const session = await DeviceSession.findOne({
                jwtToken: req.authToken,
                isActive: true
            });
            
            if (session) {
                // Update sensitive actions count
                session.sensitiveActionsCount = (session.sensitiveActionsCount || 0) + 1;
                session.lastActivityAt = new Date();
                await session.save();
                
                // If risk score is high, require re-auth
                if (session.riskScore >= 50) {
                    const reAuthMfa = req.headers['x-reauth-mfa'];
                    if (!reAuthMfa) {
                        return res.status(403).json({
                            error: 'High-risk session detected',
                            reAuthRequired: true,
                            actionType,
                            riskScore: session.riskScore
                        });
                    }
                }
            }
            
            await createAuditLog({
                action: `sensitive.${actionType}`,
                userId,
                resourceType: 'user',
                resourceId: userId,
                metadata: { 
                    actionType,
                    riskScore: session ? session.riskScore : 0
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                deviceFingerprint: session ? session.deviceFingerprint : null,
                severity: 'medium',
                result: 'success'
            });
            
            next();
        } catch (error) {
            console.error('Sensitive action check error:', error);
            next(); // Don't block on error, just log
        }
    };
}
