const jwt = require('jsonwebtoken');

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
        const documentId = req.params.id || req.body.documentId;
        const userId = req.user.userId;

        // Get document to check ownership
        const { Document } = require('../models');
        const document = await Document.findById(documentId);

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Owner has all permissions
        if (document.ownerId.toString() === userId) {
            return next();
        }

        // Check ACL
        if (!documentACL.hasPermission(documentId, userId, permission)) {
            return res.status(403).json({ 
                error: `You don't have ${permission} permission for this document` 
            });
        }

        next();
    };
}

module.exports = {
    authenticateToken,
    authorize,
    ACL,
    documentACL,
    checkDocumentPermission
};
