const express = require('express');
const router = express.Router();
const { User, Document } = require('../models');
const Organization = require('../models/Organization');
const Workspace = require('../models/Workspace');
const { authenticateToken } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');
const { createNotification } = require('../utils/notificationService');

// Get all workspaces for current organization
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { organizationId } = req.query;
        const user = await User.findById(userId);
        
        // Use provided organizationId or user's current organization
        const orgId = organizationId || user.currentOrganizationId;
        
        if (!orgId) {
            return res.status(400).json({ error: 'No organization selected' });
        }
        
        const workspaces = await Workspace.find({
            organizationId: orgId,
            $or: [
                { ownerId: userId },
                { 'members.userId': userId }
            ]
        }).populate('ownerId', 'username email');
        
        res.json(workspaces);
    } catch (error) {
        console.error('Error fetching workspaces:', error);
        res.status(500).json({ error: 'Failed to fetch workspaces' });
    }
});

// Create new workspace
router.post('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, defaultPermissions } = req.body;
        
        const user = await User.findById(userId);
        if (!user.currentOrganizationId) {
            return res.status(400).json({ error: 'No organization selected' });
        }
        
        if (!name) {
            return res.status(400).json({ error: 'Workspace name required' });
        }
        
        const workspace = new Workspace({
            name,
            organizationId: user.currentOrganizationId,
            ownerId: userId,
            members: [{
                userId,
                role: 'owner',
                permissions: {
                    canCreateDocuments: true,
                    canInviteMembers: true,
                    canManageFolders: true
                },
                joinedAt: new Date()
            }],
            defaultPermissions: defaultPermissions || { newMembers: ['read'] }
        });
        
        await workspace.save();
        
        // Update user's workspaces
        await User.findByIdAndUpdate(userId, {
            $push: { workspaces: { workspaceId: workspace._id, role: 'owner' } },
            currentWorkspaceId: workspace._id
        });
        
        await createAuditLog({
            action: 'workspace.create',
            userId,
            organizationId: user.currentOrganizationId,
            resourceType: 'workspace',
            resourceId: workspace._id,
            resourceName: name,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            result: 'success'
        });
        
        res.status(201).json(workspace);
    } catch (error) {
        console.error('Error creating workspace:', error);
        res.status(500).json({ error: 'Failed to create workspace' });
    }
});

// Add member to workspace
router.post('/:workspaceId/members', authenticateToken, async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { userEmail, role, permissions } = req.body;
        const userId = req.user.userId;
        
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found' });
        }
        
        // Check if requester has permission
        const requesterMember = workspace.members.find(m => m.userId.toString() === userId);
        if (!requesterMember || (!['owner', 'admin'].includes(requesterMember.role) && !requesterMember.permissions.canInviteMembers)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        const targetUser = await User.findOne({ email: userEmail });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if already member
        if (workspace.members.find(m => m.userId.toString() === targetUser._id.toString())) {
            return res.status(400).json({ error: 'User already a member' });
        }
        
        workspace.members.push({
            userId: targetUser._id,
            role: role || 'viewer',
            permissions: permissions || {
                canCreateDocuments: true,
                canInviteMembers: false,
                canManageFolders: false
            },
            joinedAt: new Date()
        });
        
        await workspace.save();
        
        // Update user's workspaces
        await User.findByIdAndUpdate(targetUser._id, {
            $push: { workspaces: { workspaceId: workspace._id, role: role || 'viewer' } }
        });
        
        await createAuditLog({
            action: 'workspace.member.add',
            userId,
            workspaceId: workspace._id,
            organizationId: workspace.organizationId,
            resourceType: 'workspace',
            resourceId: workspace._id,
            resourceName: workspace.name,
            metadata: { addedUser: userEmail, role },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            result: 'success'
        });
        
        res.json({ message: 'Member added successfully', workspace });
    } catch (error) {
        console.error('Error adding member:', error);
        res.status(500).json({ error: 'Failed to add member' });
    }
});

// Invite user to workspace
router.post('/:workspaceId/invite', authenticateToken, async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { email, role } = req.body;
        const userId = req.user.userId;
        
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found' });
        }
        
        // Check if requester has permission
        const requesterMember = workspace.members.find(m => m.userId.toString() === userId);
        if (!requesterMember || (!['owner', 'admin'].includes(requesterMember.role) && !requesterMember.permissions.canInviteMembers)) {
            return res.status(403).json({ error: 'Insufficient permissions to invite' });
        }
        
        const targetUser = await User.findOne({ email });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if already member
        if (workspace.members.find(m => m.userId.toString() === targetUser._id.toString())) {
            return res.status(400).json({ error: 'User is already a member' });
        }
        
        workspace.members.push({
            userId: targetUser._id,
            role: role || 'viewer',
            permissions: {
                canCreateDocuments: role === 'admin' || role === 'editor',
                canInviteMembers: role === 'admin',
                canManageFolders: role === 'admin'
            },
            joinedAt: new Date()
        });
        
        await workspace.save();
        
        // Update user's workspaces
        await User.findByIdAndUpdate(targetUser._id, {
            $push: { workspaces: { workspaceId: workspace._id, role: role || 'viewer' } }
        });
        
        // Create notification for invited user
        const inviter = await User.findById(userId);
        await createNotification({
            userId: targetUser._id,
            workspaceId: workspace._id,
            type: 'workspace_invite',
            title: 'Workspace Invitation',
            message: `${inviter.username || inviter.email} invited you to join workspace "${workspace.name}" as ${role || 'viewer'}`,
            resourceType: 'workspace',
            resourceId: workspace._id,
            actionUrl: `/workspace/${workspace._id}`,
            actionText: 'View Workspace',
            actorId: userId,
            actorName: inviter.username || inviter.email,
            priority: 'high'
        });
        
        await createAuditLog({
            action: 'workspace.invite',
            userId,
            workspaceId: workspace._id,
            organizationId: workspace.organizationId,
            resourceType: 'workspace',
            resourceId: workspace._id,
            resourceName: workspace.name,
            metadata: { invitedUser: email, role },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            result: 'success'
        });
        
        res.json({ message: 'User invited successfully', workspace });
    } catch (error) {
        console.error('Error inviting to workspace:', error);
        res.status(500).json({ error: 'Failed to send invite' });
    }
});

// Switch current workspace
router.post('/:workspaceId/switch', authenticateToken, async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const userId = req.user.userId;
        
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found' });
        }
        
        // Verify user is member
        if (!workspace.members.find(m => m.userId.toString() === userId)) {
            return res.status(403).json({ error: 'Not a member of this workspace' });
        }
        
        await User.findByIdAndUpdate(userId, {
            currentWorkspaceId: workspaceId,
            currentOrganizationId: workspace.organizationId
        });
        
        res.json({ message: 'Switched to workspace', workspaceId });
    } catch (error) {
        console.error('Error switching workspace:', error);
        res.status(500).json({ error: 'Failed to switch workspace' });
    }
});

module.exports = router;
