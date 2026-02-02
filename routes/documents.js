const express = require('express');
const { authenticateToken, checkDocumentPermission, documentACL } = require('../middleware/auth');
const EncryptionService = require('../utils/encryption');
const { User, Document } = require('../models');

const router = express.Router();

/**
 * Create a new document
 * POST /api/documents
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { title, content, encrypted, sharedWith } = req.body;
        const userId = req.user.userId;

        let storedContent = content;
        let encryptedKeys = {};

        // If encryption requested, encrypt content
        if (encrypted) {
            const owner = await User.findById(userId);
            if (!owner) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Encrypt for owner
            const encryptedPackage = EncryptionService.encryptData(content, owner.publicKey);
            storedContent = JSON.stringify(encryptedPackage);
            encryptedKeys[userId] = encryptedPackage;

            // Encrypt for shared users
            if (sharedWith && Array.isArray(sharedWith)) {
                for (const shareUserId of sharedWith) {
                    const shareUser = await User.findById(shareUserId);
                    if (shareUser) {
                        const sharePackage = EncryptionService.encryptData(content, shareUser.publicKey);
                        encryptedKeys[shareUserId] = sharePackage;
                    }
                }
            }
        }

        const document = new Document({
            title,
            content: storedContent,
            ownerId: userId,
            encrypted,
            encryptedKeys,
            hash: EncryptionService.hash(content),
            signed: false,
            signatures: [],
            permissions: []
        });

        await document.save();

        // Grant owner all permissions
        documentACL.grant(document._id.toString(), userId, ['read', 'write', 'delete', 'sign', 'share']);

        // Grant permissions to shared users
        if (sharedWith && Array.isArray(sharedWith)) {
            for (const shareUserId of sharedWith) {
                documentACL.grant(document._id.toString(), shareUserId, ['read']);
            }
        }

        res.status(201).json({
            message: 'Document created successfully',
            document: {
                id: document._id.toString(),
                title: document.title,
                encrypted: document.encrypted,
                hash: document.hash,
                createdAt: document.createdAt
            }
        });
    } catch (error) {
        console.error('Document creation error:', error);
        res.status(500).json({ error: 'Failed to create document' });
    }
});

/**
 * Get all documents accessible to user
 * GET /api/documents
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const allDocuments = await Document.find({});
        const accessibleDocs = [];

        console.log(`User ${userId} requesting documents. Total documents: ${allDocuments.length}`);

        for (let doc of allDocuments) {
            const docId = doc._id.toString();
            const isOwner = doc.ownerId.toString() === userId;
            
            // Check MongoDB permissions array (for serverless persistence)
            const docPermission = doc.permissions.find(p => p.userId.toString() === userId);
            const hasAccessFromDB = docPermission && docPermission.permissions.includes('read');
            
            // Also check in-memory ACL (for backward compatibility)
            const hasAccessFromACL = documentACL.hasPermission(docId, userId, 'read');
            const hasAccess = hasAccessFromDB || hasAccessFromACL;
            
            console.log(`Document ${docId}: Owner=${isOwner}, HasAccessDB=${hasAccessFromDB}, HasAccessACL=${hasAccessFromACL}`);
            
            // Check if user owns or has access
            if (isOwner || hasAccess) {
                const userPerms = docPermission ? docPermission.permissions : (isOwner ? ['read', 'write', 'delete', 'share', 'sign'] : []);
                accessibleDocs.push({
                    id: docId,
                    title: doc.title,
                    ownerId: doc.ownerId.toString(),
                    signatureCount: doc.signatures.length,
                    createdAt: doc.createdAt,
                    updatedAt: doc.updatedAt,
                    permissions: userPerms,
                    isShared: !isOwner
                });
            }
        }

        console.log(`Returning ${accessibleDocs.length} accessible documents to user ${userId}`);
        res.json({ documents: accessibleDocs });
    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({ error: 'Failed to retrieve documents' });
    }
});

/**
 * Get a specific document
 * GET /api/documents/:id
 */
router.get('/:id', authenticateToken, checkDocumentPermission('read'), async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.user.userId;
        const document = await Document.findById(documentId);

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        let content = document.content;

        // Decrypt if encrypted
        if (document.encrypted) {
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const encryptedPackage = document.encryptedKeys.get(userId);
            if (!encryptedPackage) {
                return res.status(403).json({ error: 'No decryption key available' });
            }

            try {
                content = EncryptionService.decryptData(encryptedPackage, user.privateKey);
            } catch (decryptError) {
                return res.status(500).json({ error: 'Decryption failed' });
            }
        }

        // Get user permissions from MongoDB (for serverless)
        const isOwner = document.ownerId.toString() === userId;
        let userPermissions = [];
        
        if (isOwner) {
            userPermissions = ['read', 'write', 'delete', 'share', 'sign'];
        } else {
            const docPermission = document.permissions.find(p => p.userId.toString() === userId);
            userPermissions = docPermission ? docPermission.permissions : [];
        }

        res.json({
            id: document._id.toString(),
            title: document.title,
            content,
            ownerId: document.ownerId.toString(),
            encrypted: document.encrypted,
            hash: document.hash,
            signed: document.signed,
            signatures: document.signatures,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
            permissions: userPermissions
        });
    } catch (error) {
        console.error('Get document error:', error);
        res.status(500).json({ error: 'Failed to retrieve document' });
    }
});

/**
 * Update document
 * PUT /api/documents/:id
 */
router.put('/:id', authenticateToken, checkDocumentPermission('write'), async (req, res) => {
    try {
        const documentId = req.params.id;
        const { title, content } = req.body;
        const document = await Document.findById(documentId);

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        if (title) document.title = title;
        if (content) {
            if (document.encrypted) {
                // Re-encrypt for all users with access
                const userIds = documentACL.getDocumentUsers(documentId);
                const encryptedKeys = new Map();

                for (const uid of userIds) {
                    const user = await User.findById(uid);
                    if (user) {
                        const encryptedPackage = EncryptionService.encryptData(content, user.publicKey);
                        encryptedKeys.set(uid, encryptedPackage);
                    }
                }

                const ownerPackage = encryptedKeys.get(req.user.userId);
                document.content = ownerPackage ? JSON.stringify(ownerPackage) : content;
                document.encryptedKeys = encryptedKeys;
            } else {
                document.content = content;
            }
            document.hash = EncryptionService.hash(content);
            document.signed = false; // Invalidate signatures on update
            document.signatures = [];
        }

        document.updatedAt = new Date();
        await document.save();

        res.json({ message: 'Document updated successfully' });
    } catch (error) {
        console.error('Update document error:', error);
        res.status(500).json({ error: 'Failed to update document' });
    }
});

/**
 * Delete document
 * DELETE /api/documents/:id
 */
router.delete('/:id', authenticateToken, checkDocumentPermission('delete'), async (req, res) => {
    try {
        const documentId = req.params.id;
        await Document.findByIdAndDelete(documentId);

        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

/**
 * Sign document with digital signature
 * POST /api/documents/:id/sign
 */
router.post('/:id/sign', authenticateToken, checkDocumentPermission('sign'), async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.user.userId;
        const document = await Document.findById(documentId);
        const user = await User.findById(userId);

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create signature of document content
        const dataToSign = document.content + document.hash;
        const signature = EncryptionService.signData(dataToSign, user.privateKey);

        const signatureObj = {
            userId,
            username: user.username,
            signature,
            timestamp: new Date(),
            documentHash: document.hash
        };

        document.signatures.push(signatureObj);
        document.signed = true;
        await document.save();

        res.json({
            message: 'Document signed successfully',
            signature: signatureObj
        });
    } catch (error) {
        console.error('Sign document error:', error);
        res.status(500).json({ error: 'Failed to sign document' });
    }
});

/**
 * Verify document signatures
 * GET /api/documents/:id/verify
 */
router.get('/:id/verify', authenticateToken, checkDocumentPermission('read'), async (req, res) => {
    try {
        const documentId = req.params.id;
        const document = await Document.findById(documentId);

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const verificationResults = [];
        
        for (const sig of document.signatures) {
            const signerUser = await User.findById(sig.userId);
            if (!signerUser) {
                verificationResults.push({ ...sig.toObject(), valid: false, reason: 'Signer not found' });
                continue;
            }

            const dataToVerify = document.content + sig.documentHash;
            const valid = EncryptionService.verifySignature(
                dataToVerify,
                sig.signature,
                signerUser.publicKey
            );

            verificationResults.push({
                userId: sig.userId.toString(),
                username: sig.username,
                timestamp: sig.timestamp,
                valid,
                hashMatch: sig.documentHash === document.hash
            });
        }

        res.json({
            documentId: document._id.toString(),
            currentHash: document.hash,
            signatures: verificationResults,
            allValid: verificationResults.every(r => r.valid && r.hashMatch)
        });
    } catch (error) {
        console.error('Verify signatures error:', error);
        res.status(500).json({ error: 'Failed to verify signatures' });
    }
});

/**
 * Share document with another user
 * POST /api/documents/:id/share
 */
router.post('/:id/share', authenticateToken, checkDocumentPermission('share'), async (req, res) => {
    try {
        const documentId = req.params.id;
        const { userId: targetUserId, permissions } = req.body;
        const document = await Document.findById(documentId);

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ error: 'Target user not found' });
        }

        // Grant permissions
        const validPermissions = ['read', 'write', 'sign'];
        const permissionsToGrant = permissions.filter(p => validPermissions.includes(p));
        documentACL.grant(documentId, targetUserId, permissionsToGrant);

        // If document is encrypted, encrypt for the new user
        if (document.encrypted) {
            const userId = req.user.userId;
            const owner = await User.findById(userId);
            
            // Decrypt content using owner's private key
            const ownerPackage = document.encryptedKeys.get(userId);
            const decryptedContent = EncryptionService.decryptData(ownerPackage, owner.privateKey);

            // Encrypt for target user
            const targetPackage = EncryptionService.encryptData(decryptedContent, targetUser.publicKey);
            document.encryptedKeys.set(targetUserId, targetPackage);
            await document.save();
        }

        res.json({
            message: 'Document shared successfully',
            sharedWith: targetUser.username,
            permissions: permissionsToGrant
        });
    } catch (error) {
        console.error('Share document error:', error);
        res.status(500).json({ error: 'Failed to share document' });
    }
});

module.exports = router;
