const express = require('express');
const router = express.Router();
const Folder = require('../models/Folder');
const { User, Document } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');

// Get folder tree for workspace
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);
        
        if (!user.currentWorkspaceId) {
            return res.status(400).json({ error: 'No workspace selected' });
        }
        
        const folders = await Folder.find({
            workspaceId: user.currentWorkspaceId
        }).sort({ path: 1 });
        
        // Build tree structure
        const buildTree = (parentId = null) => {
            return folders
                .filter(f => (f.parentId ? f.parentId.toString() : null) === parentId)
                .map(folder => ({
                    ...folder.toObject(),
                    children: buildTree(folder._id.toString())
                }));
        };
        
        const tree = buildTree(null);
        res.json(tree);
    } catch (error) {
        console.error('Error fetching folders:', error);
        res.status(500).json({ error: 'Failed to fetch folders' });
    }
});

// Create new folder
router.post('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, parentId } = req.body;
        
        const user = await User.findById(userId);
        if (!user.currentWorkspaceId) {
            return res.status(400).json({ error: 'No workspace selected' });
        }
        
        if (!name) {
            return res.status(400).json({ error: 'Folder name required' });
        }
        
        let path = `/${name}`;
        
        // Calculate full path if has parent
        if (parentId) {
            const parent = await Folder.findById(parentId);
            if (!parent) {
                return res.status(404).json({ error: 'Parent folder not found' });
            }
            path = `${parent.path}/${name}`;
        }
        
        const folder = new Folder({
            name,
            workspaceId: user.currentWorkspaceId,
            parentId: parentId || null,
            ownerId: userId,
            path
        });
        
        await folder.save();
        
        await createAuditLog({
            action: 'folder.create',
            userId,
            workspaceId: user.currentWorkspaceId,
            resourceType: 'folder',
            resourceId: folder._id,
            resourceName: name,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            result: 'success'
        });
        
        res.status(201).json(folder);
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

// Move document to folder
router.post('/:folderId/documents/:documentId', authenticateToken, async (req, res) => {
    try {
        const { folderId, documentId } = req.params;
        const userId = req.user.userId;
        
        const document = await Document.findById(documentId);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        // Check permission
        if (document.ownerId.toString() !== userId) {
            const docPermission = document.permissions.find(p => p.userId.toString() === userId);
            if (!docPermission || !docPermission.permissions.includes('write')) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
        }
        
        const folder = await Folder.findById(folderId);
        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        
        document.folderId = folderId;
        await document.save();
        
        await createAuditLog({
            action: 'document.move',
            userId,
            workspaceId: folder.workspaceId,
            resourceType: 'document',
            resourceId: documentId,
            resourceName: document.title,
            metadata: { toFolder: folder.name, folderId },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            result: 'success'
        });
        
        res.json({ message: 'Document moved successfully', document });
    } catch (error) {
        console.error('Error moving document:', error);
        res.status(500).json({ error: 'Failed to move document' });
    }
});

// Delete folder
router.delete('/:folderId', authenticateToken, async (req, res) => {
    try {
        const { folderId } = req.params;
        const userId = req.user.userId;
        
        const folder = await Folder.findById(folderId);
        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        
        // Check permission
        if (folder.ownerId.toString() !== userId) {
            const folderPermission = folder.permissions.find(p => p.userId.toString() === userId);
            if (!folderPermission || !folderPermission.permissions.includes('delete')) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
        }
        
        // Check if folder has children
        const childFolders = await Folder.countDocuments({ parentId: folderId });
        const childDocuments = await Document.countDocuments({ folderId });
        
        if (childFolders > 0 || childDocuments > 0) {
            return res.status(400).json({ error: 'Folder must be empty before deletion' });
        }
        
        await Folder.findByIdAndDelete(folderId);
        
        await createAuditLog({
            action: 'folder.delete',
            userId,
            workspaceId: folder.workspaceId,
            resourceType: 'folder',
            resourceId: folderId,
            resourceName: folder.name,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            result: 'success'
        });
        
        res.json({ message: 'Folder deleted successfully' });
    } catch (error) {
        console.error('Error deleting folder:', error);
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});

module.exports = router;
