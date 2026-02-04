const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const { User, Document } = require('../models');
const { authenticateToken, checkDocumentPermission } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption');
const { sign, verify } = require('../utils/encryption');
const { createAuditLog } = require('../utils/auditLogger');

// Get comments for a document
router.get('/:documentId', authenticateToken, checkDocumentPermission('read'), async (req, res) => {
    try {
        const { documentId } = req.params;
        
        const comments = await Comment.find({
            documentId,
            isDeleted: false
        })
        .sort({ createdAt: -1 })
        .populate('authorId', 'username email publicKey');
        
        // Decrypt comments
        const decryptedComments = comments.map(comment => {
            try {
                const decrypted = decrypt(comment.encryptedContent);
                return {
                    ...comment.toObject(),
                    content: decrypted
                };
            } catch (err) {
                return {
                    ...comment.toObject(),
                    content: '[Decryption failed]'
                };
            }
        });
        
        res.json(decryptedComments);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// Add new comment
router.post('/:documentId', authenticateToken, checkDocumentPermission('comment'), async (req, res) => {
    try {
        const { documentId } = req.params;
        const { content, parentCommentId, position } = req.body;
        const userId = req.user.userId;
        
        if (!content) {
            return res.status(400).json({ error: 'Comment content required' });
        }
        
        const document = await Document.findById(documentId);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        const user = await User.findById(userId);
        
        // Encrypt comment
        const encryptedContent = encrypt(content);
        
        // Sign comment
        const signature = sign(content, user.privateKey);
        
        const comment = new Comment({
            documentId,
            workspaceId: document.workspaceId,
            authorId: userId,
            authorName: user.username,
            content,
            encryptedContent,
            signature,
            parentCommentId: parentCommentId || null,
            threadId: parentCommentId || null, // Will be updated to root ID if nested
            position: position || { type: 'general' }
        });
        
        await comment.save();
        
        await createAuditLog({
            action: 'comment.create',
            userId,
            workspaceId: document.workspaceId,
            resourceType: 'document',
            resourceId: documentId,
            resourceName: document.title,
            metadata: { commentId: comment._id },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            result: 'success'
        });
        
        res.status(201).json(comment);
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ error: 'Failed to create comment' });
    }
});

// Resolve comment
router.post('/:commentId/resolve', authenticateToken, async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.userId;
        
        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        
        comment.isResolved = true;
        comment.resolvedBy = userId;
        comment.resolvedAt = new Date();
        await comment.save();
        
        res.json({ message: 'Comment resolved', comment });
    } catch (error) {
        console.error('Error resolving comment:', error);
        res.status(500).json({ error: 'Failed to resolve comment' });
    }
});

// Delete comment
router.delete('/:commentId', authenticateToken, async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.userId;
        
        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        
        // Only author can delete
        if (comment.authorId.toString() !== userId) {
            return res.status(403).json({ error: 'Only comment author can delete' });
        }
        
        comment.isDeleted = true;
        comment.deletedAt = new Date();
        await comment.save();
        
        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

module.exports = router;
