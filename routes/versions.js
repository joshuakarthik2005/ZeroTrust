const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const DocumentVersion = require('../models/DocumentVersion');
const { User, Document } = require('../models');
const { authenticateToken, checkDocumentPermission } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');

// Get version history for document
router.get('/:documentId', authenticateToken, checkDocumentPermission('read'), async (req, res) => {
    try {
        const { documentId } = req.params;
        
        const versions = await DocumentVersion.find({ documentId })
            .sort({ version: -1 })
            .populate('changedBy', 'username email');
        
        res.json(versions);
    } catch (error) {
        console.error('Error fetching versions:', error);
        res.status(500).json({ error: 'Failed to fetch versions' });
    }
});

// Create new version (automatic on document update)
async function createVersion(documentId, userId, changeDescription = '') {
    try {
        const document = await Document.findById(documentId);
        if (!document) {
            throw new Error('Document not found');
        }
        
        // Get previous version
        const previousVersion = await DocumentVersion.findOne({ documentId, isActive: true });
        
        const newVersionNumber = previousVersion ? previousVersion.version + 1 : 1;
        
        // Calculate content hash
        const contentHash = crypto
            .createHash('sha256')
            .update(document.content)
            .digest('hex');
        
        // Invalidate all signatures from previous version if content changed
        if (previousVersion && previousVersion.contentHash !== contentHash) {
            if (previousVersion.signatures && previousVersion.signatures.length > 0) {
                previousVersion.signatures.forEach(sig => {
                    sig.invalidatedAt = new Date();
                    sig.invalidationReason = 'Document was modified';
                });
                await previousVersion.save();
            }
            
            // Also invalidate signatures on main document
            if (document.signatures && document.signatures.length > 0) {
                document.signatures.forEach(sig => {
                    sig.invalidated = true;
                    sig.invalidatedAt = new Date();
                });
            }
        }
        
        // Deactivate previous version
        if (previousVersion) {
            previousVersion.isActive = false;
            await previousVersion.save();
        }
        
        const version = new DocumentVersion({
            documentId,
            version: newVersionNumber,
            title: document.title,
            content: document.content,
            encryptedContent: document.content, // Already encrypted
            contentHash,
            previousVersionHash: previousVersion ? previousVersion.contentHash : null,
            signatures: document.signatures ? document.signatures.map(s => ({
                userId: s.userId,
                signature: s.signature,
                signedAt: s.timestamp,
                invalidatedAt: s.invalidatedAt,
                invalidationReason: s.invalidated ? 'Document modified after signing' : null
            })) : [],
            changedBy: userId,
            changeDescription,
            metadata: {
                size: Buffer.byteLength(document.content, 'utf8'),
                permissions: document.permissions,
                tags: document.tags || []
            },
            isActive: true
        });
        
        await version.save();
        
        // Update document's current version
        document.currentVersion = newVersionNumber;
        await document.save();
        
        return version;
    } catch (error) {
        console.error('Error creating version:', error);
        throw error;
    }
}

// Restore version
router.post('/:documentId/restore/:versionNumber', authenticateToken, checkDocumentPermission('write'), async (req, res) => {
    try {
        const { documentId, versionNumber } = req.params;
        const userId = req.user.userId;
        
        const version = await DocumentVersion.findOne({ documentId, version: parseInt(versionNumber) });
        if (!version) {
            return res.status(404).json({ error: 'Version not found' });
        }
        
        const document = await Document.findById(documentId);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        // Restore content
        document.content = version.content;
        document.title = version.title;
        document.hash = version.contentHash;
        
        // Clear signatures (since we're restoring old content)
        document.signed = false;
        document.signatures = [];
        
        await document.save();
        
        // Create new version for the restore
        await createVersion(documentId, userId, `Restored from version ${versionNumber}`);
        
        await createAuditLog({
            action: 'document.version.restore',
            userId,
            workspaceId: document.workspaceId,
            resourceType: 'document',
            resourceId: documentId,
            resourceName: document.title,
            metadata: { restoredVersion: versionNumber },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            result: 'success'
        });
        
        res.json({ message: 'Version restored successfully', document });
    } catch (error) {
        console.error('Error restoring version:', error);
        res.status(500).json({ error: 'Failed to restore version' });
    }
});

// Compare two versions
router.get('/:documentId/compare/:version1/:version2', authenticateToken, checkDocumentPermission('read'), async (req, res) => {
    try {
        const { documentId, version1, version2 } = req.params;
        
        const v1 = await DocumentVersion.findOne({ documentId, version: parseInt(version1) });
        const v2 = await DocumentVersion.findOne({ documentId, version: parseInt(version2) });
        
        if (!v1 || !v2) {
            return res.status(404).json({ error: 'One or both versions not found' });
        }
        
        // Simple diff (could use a library like diff for better results)
        const diff = {
            version1: {
                number: v1.version,
                title: v1.title,
                contentHash: v1.contentHash,
                changedBy: v1.changedBy,
                createdAt: v1.createdAt,
                signatures: v1.signatures.length
            },
            version2: {
                number: v2.version,
                title: v2.title,
                contentHash: v2.contentHash,
                changedBy: v2.changedBy,
                createdAt: v2.createdAt,
                signatures: v2.signatures.length
            },
            contentChanged: v1.contentHash !== v2.contentHash,
            titleChanged: v1.title !== v2.title
        };
        
        res.json(diff);
    } catch (error) {
        console.error('Error comparing versions:', error);
        res.status(500).json({ error: 'Failed to compare versions' });
    }
});

module.exports = router;
module.exports.createVersion = createVersion;
