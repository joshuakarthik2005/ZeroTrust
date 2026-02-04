const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;
const { authenticateToken, checkDocumentPermission, documentACL, requireReAuth, checkSensitiveAction } = require('../middleware/auth');
const EncryptionService = require('../utils/encryption');
const { User, Document } = require('../models');
const { createVersion } = require('./versions');
const { createAuditLog } = require('../utils/auditLogger');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, PPT, PPTX, DOC, DOCX, and TXT are allowed.'));
        }
    }
});

/**
 * Upload a file as a document
 * POST /api/documents/upload
 */
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const { title, encrypted, folderId, organizationId, workspaceId } = req.body;
        const userId = req.user.userId;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Use provided org/workspace or fall back to user's current
        const docOrganizationId = organizationId || user.currentOrganizationId || null;
        const docWorkspaceId = workspaceId || user.currentWorkspaceId || null;
        
        // Determine file type
        const ext = path.extname(req.file.originalname).toLowerCase();
        const fileTypeMap = {
            '.pdf': 'pdf',
            '.ppt': 'ppt',
            '.pptx': 'pptx',
            '.doc': 'doc',
            '.docx': 'docx',
            '.txt': 'text'
        };
        const fileType = fileTypeMap[ext] || 'uploaded';
        
        // Read file content for hash
        const fileBuffer = await fs.readFile(req.file.path);
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        
        // Create document
        const document = new Document({
            title: title || req.file.originalname,
            content: `File uploaded: ${req.file.originalname}`,
            ownerId: userId,
            workspaceId: docWorkspaceId,
            organizationId: docOrganizationId,
            fileType: fileType,
            filePath: req.file.path,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            encrypted: encrypted === 'true' || encrypted === true,
            hash: hash,
            folderId: folderId || null
        });
        
        await document.save();
        
        // Audit log
        await createAuditLog({
            action: 'document.create',
            userId: userId,
            userEmail: user.email,
            resourceType: 'document',
            resourceId: document._id,
            resourceName: document.title,
            metadata: { fileType, fileSize: req.file.size },
            result: 'success'
        });
        
        res.status(201).json({
            message: 'File uploaded successfully',
            document: {
                _id: document._id,
                title: document.title,
                fileType: document.fileType,
                fileName: document.fileName,
                fileSize: document.fileSize
            }
        });
    } catch (error) {
        console.error('File upload error:', error);
        // Clean up uploaded file if document creation failed
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error cleaning up file:', unlinkError);
            }
        }
        res.status(500).json({ error: 'File upload failed: ' + error.message });
    }
});

/**
 * Download/view uploaded file
 * GET /api/documents/:id/file
 */
router.get('/:id/file', authenticateToken, async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);
        
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        if (!document.filePath) {
            return res.status(400).json({ error: 'This document is not a file' });
        }
        
        // Check permissions
        const userId = req.user.userId;
        const isOwner = document.ownerId.toString() === userId;
        const hasPermission = document.permissions.some(p => p.userId.toString() === userId && 
                             (p.permissions.includes('download') || p.permissions.includes('read')));
        
        if (!isOwner && !hasPermission) {
            return res.status(403).json({ error: 'Permission denied' });
        }
        
        // Check if file exists
        const filePath = path.resolve(document.filePath);
        console.log('Attempting to serve file:', filePath);
        console.log('File exists check...');
        
        const fsSync = require('fs');
        if (!fsSync.existsSync(filePath)) {
            console.error('File not found on disk:', filePath);
            return res.status(404).json({ error: 'File not found on server' });
        }
        
        console.log('File exists, sending...');
        
        // Send file
        res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to send file' });
                }
            } else {
                console.log('File sent successfully');
            }
        });
    } catch (error) {
        console.error('File download error:', error);
        res.status(500).json({ error: 'File download failed' });
    }
});

/**
 * Create a new document
 * POST /api/documents
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { title, content, encrypted, sharedWith, folderId } = req.body;
        const userId = req.user.userId;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

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
            workspaceId: user.currentWorkspaceId || null,
            organizationId: user.currentOrganizationId || null,
            folderId: folderId || null,
            encrypted,
            encryptedKeys,
            hash: EncryptionService.hash(content),
            signed: false,
            signatures: [],
            permissions: [],
            currentVersion: 1,
            size: Buffer.byteLength(content, 'utf8')
        });

        await document.save();
        
        // Create initial version
        try {
            await createVersion(document._id, userId, 'Initial version');
        } catch (versionError) {
            console.error('Version creation error:', versionError);
            // Don't fail document creation if versioning fails
        }

        // Grant owner all permissions
        documentACL.grant(document._id.toString(), userId, ['read', 'write', 'delete', 'sign', 'share']);

        // Grant permissions to shared users
        if (sharedWith && Array.isArray(sharedWith)) {
            for (const shareUserId of sharedWith) {
                documentACL.grant(document._id.toString(), shareUserId, ['read']);
            }
        }
        
        await createAuditLog({
            action: 'document.create',
            userId,
            workspaceId: user.currentWorkspaceId,
            organizationId: user.currentOrganizationId,
            resourceType: 'document',
            resourceId: document._id,
            resourceName: title,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            metadata: { encrypted, folderId },
            result: 'success'
        });

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
        const { organizationId, workspaceId } = req.query;
        
        // Build filter for documents
        let filter = {};
        if (organizationId) {
            filter.organizationId = organizationId;
        }
        if (workspaceId) {
            filter.workspaceId = workspaceId;
        }
        
        const allDocuments = await Document.find(filter);
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
                    isShared: !isOwner,
                    fileType: doc.fileType,
                    fileName: doc.fileName,
                    hasFile: !!doc.filePath
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
        
        console.log('Fetching document:', documentId, 'for user:', userId);
        
        const document = await Document.findById(documentId);

        if (!document) {
            console.log('Document not found in database:', documentId);
            return res.status(404).json({ error: 'Document not found' });
        }
        
        console.log('Document found:', document.title, 'owner:', document.ownerId);

        let content = document.content;

        // Decrypt if encrypted
        if (document.encrypted && document.encryptedKeys) {
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
            encrypted: document.encrypted || false,
            hash: document.hash || '',
            signed: document.signed || false,
            signatures: document.signatures || [],
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
            permissions: userPermissions,
            fileType: document.fileType || null,
            fileName: document.fileName || null,
            filePath: document.filePath || null,
            fileSize: document.fileSize || 0,
            mimeType: document.mimeType || null,
            hasFile: !!document.filePath,
            currentVersion: document.currentVersion || 1
        });
    } catch (error) {
        console.error('Get document error:', error);
        res.status(500).json({ error: 'Failed to retrieve document: ' + error.message });
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
        const userId = req.user.userId;
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
            
            // Invalidate all signatures on update
            document.signed = false;
            if (document.signatures && document.signatures.length > 0) {
                document.signatures.forEach(sig => {
                    sig.invalidated = true;
                    sig.invalidatedAt = new Date();
                });
            }
        }

        document.updatedAt = new Date();
        await document.save();
        
        // Create new version
        try {
            await createVersion(documentId, userId, 'Document updated');
        } catch (versionError) {
            console.error('Version creation error:', versionError);
        }
        
        await createAuditLog({
            action: 'document.update',
            userId,
            workspaceId: document.workspaceId,
            organizationId: document.organizationId,
            resourceType: 'document',
            resourceId: documentId,
            resourceName: document.title,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            result: 'success'
        });

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
router.delete('/:id', authenticateToken, requireReAuth('delete'), checkDocumentPermission('delete'), async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.user.userId;
        const document = await Document.findById(documentId);
        
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        await createAuditLog({
            action: 'document.delete',
            userId,
            workspaceId: document.workspaceId,
            organizationId: document.organizationId,
            resourceType: 'document',
            resourceId: documentId,
            resourceName: document.title,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            severity: 'high',
            result: 'success'
        });
        
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
router.post('/:id/sign', authenticateToken, requireReAuth('sign'), checkDocumentPermission('sign'), async (req, res) => {
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
            documentHash: document.hash,
            invalidated: false
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
router.post('/:id/share', authenticateToken, requireReAuth('share'), checkDocumentPermission('share'), async (req, res) => {
    try {
        const documentId = req.params.id;
        const { userId: targetUserId, email, permissions } = req.body;
        const currentUserId = req.user.userId;
        const document = await Document.findById(documentId);

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Find target user by userId or email
        let targetUser;
        if (targetUserId) {
            targetUser = await User.findById(targetUserId);
        } else if (email) {
            targetUser = await User.findOne({ email });
        }
        
        if (!targetUser) {
            return res.status(404).json({ error: 'Target user not found' });
        }
        
        const finalTargetUserId = targetUser._id.toString();

        // Grant permissions (updated list)
        const validPermissions = ['read', 'write', 'comment', 'share', 'delete', 'sign', 'download'];
        const permissionsToGrant = permissions.filter(p => validPermissions.includes(p));
        documentACL.grant(documentId, finalTargetUserId, permissionsToGrant);
        
        // Add to MongoDB permissions array for persistence
        const existingPermission = document.permissions.find(p => p.userId.toString() === finalTargetUserId);
        if (existingPermission) {
            existingPermission.permissions = [...new Set([...existingPermission.permissions, ...permissionsToGrant])];
        } else {
            document.permissions.push({
                userId: finalTargetUserId,
                permissions: permissionsToGrant,
                grantedBy: currentUserId,
                grantedAt: new Date()
            });
        }

        // If document is encrypted, encrypt for the new user
        if (document.encrypted && document.encryptedKeys) {
            const owner = await User.findById(currentUserId);
            
            // Decrypt content using owner's private key
            const ownerPackage = document.encryptedKeys.get(currentUserId);
            if (ownerPackage) {
                const decryptedContent = EncryptionService.decryptData(ownerPackage, owner.privateKey);

                // Encrypt for target user
                const targetPackage = EncryptionService.encryptData(decryptedContent, targetUser.publicKey);
                document.encryptedKeys.set(finalTargetUserId, targetPackage);
            }
        }
        
        // Save document to persist permissions
        await document.save();

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
