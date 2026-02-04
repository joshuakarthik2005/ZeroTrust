const express = require('express');
const router = express.Router();
const { User, Document } = require('../models');
const Organization = require('../models/Organization');
const Workspace = require('../models/Workspace');
const { authenticateToken } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');
const { createNotification } = require('../utils/notificationService');

// Get all organizations for current user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // Find orgs where user is member
        const orgs = await Organization.find({
            $or: [
                { ownerId: userId },
                { 'members.userId': userId }
            ]
        }).populate('ownerId', 'username email');
        
        res.json(orgs);
    } catch (error) {
        console.error('Error fetching organizations:', error);
        res.status(500).json({ error: 'Failed to fetch organizations' });
    }
});

// Create new organization
router.post('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, settings } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Organization name required' });
        }
        
        const organization = new Organization({
            name,
            ownerId: userId,
            members: [{
                userId,
                role: 'owner',
                joinedAt: new Date()
            }],
            settings: settings || {}
        });
        
        await organization.save();
        
        // Update user's organizations
        await User.findByIdAndUpdate(userId, {
            $push: { organizations: { organizationId: organization._id, role: 'owner' } },
            currentOrganizationId: organization._id
        });
        
        await createAuditLog({
            action: 'organization.create',
            userId,
            resourceType: 'organization',
            resourceId: organization._id,
            resourceName: name,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            result: 'success'
        });
        
        res.status(201).json(organization);
    } catch (error) {
        console.error('Error creating organization:', error);
        res.status(500).json({ error: 'Failed to create organization' });
    }
});

// Add member to organization
router.post('/:orgId/members', authenticateToken, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { userEmail, role } = req.body;
        const userId = req.user.userId;
        
        const org = await Organization.findById(orgId);
        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }
        
        // Check if requester is admin/owner
        const requesterMember = org.members.find(m => m.userId.toString() === userId);
        if (!requesterMember || !['owner', 'admin'].includes(requesterMember.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        const targetUser = await User.findOne({ email: userEmail });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if already member
        if (org.members.find(m => m.userId.toString() === targetUser._id.toString())) {
            return res.status(400).json({ error: 'User already a member' });
        }
        
        org.members.push({
            userId: targetUser._id,
            role: role || 'member',
            joinedAt: new Date()
        });
        
        await org.save();
        
        // Update user's organizations
        await User.findByIdAndUpdate(targetUser._id, {
            $push: { organizations: { organizationId: org._id, role: role || 'member' } }
        });
        
        await createAuditLog({
            action: 'organization.member.add',
            userId,
            resourceType: 'organization',
            resourceId: org._id,
            resourceName: org.name,
            metadata: { addedUser: userEmail, role },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            result: 'success'
        });
        
        res.json({ message: 'Member added successfully', organization: org });
    } catch (error) {
        console.error('Error adding member:', error);
        res.status(500).json({ error: 'Failed to add member' });
    }
});

// Invite user to organization
router.post('/:orgId/invite', authenticateToken, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { email, role, workspaceIds } = req.body;
        const userId = req.user.userId;
        
        const org = await Organization.findById(orgId);
        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }
        
        // Check if requester is admin/owner
        const requesterMember = org.members.find(m => m.userId.toString() === userId);
        if (!requesterMember || !['owner', 'admin'].includes(requesterMember.role)) {
            return res.status(403).json({ error: 'Insufficient permissions to invite' });
        }
        
        const targetUser = await User.findOne({ email });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        console.log('Target user:', targetUser.username, 'ID:', targetUser._id);
        console.log('Organization members:', org.members.map(m => ({ id: m.userId.toString(), role: m.role })));
        
        // Check if already member
        const existingMember = org.members.find(m => m.userId.toString() === targetUser._id.toString());
        console.log('Existing member check:', existingMember);
        
        if (existingMember) {
            return res.status(400).json({ error: 'User is already a member' });
        }
        
        org.members.push({
            userId: targetUser._id,
            role: role || 'member',
            joinedAt: new Date()
        });
        
        await org.save();
        
        // Update user's organizations
        await User.findByIdAndUpdate(targetUser._id, {
            $push: { organizations: { organizationId: org._id, role: role || 'member' } }
        });
        
        // If workspace IDs provided, add user to those workspaces
        if (workspaceIds && Array.isArray(workspaceIds) && workspaceIds.length > 0) {
            for (const workspaceId of workspaceIds) {
                const workspace = await Workspace.findById(workspaceId);
                if (workspace && workspace.organizationId.toString() === orgId) {
                    // Check if not already a member
                    if (!workspace.members.find(m => m.userId.toString() === targetUser._id.toString())) {
                        workspace.members.push({
                            userId: targetUser._id,
                            role: 'viewer',
                            permissions: {
                                canCreateDocuments: false,
                                canInviteMembers: false,
                                canManageFolders: false
                            },
                            joinedAt: new Date()
                        });
                        await workspace.save();
                        
                        // Update user's workspaces
                        await User.findByIdAndUpdate(targetUser._id, {
                            $push: { workspaces: { workspaceId: workspace._id, role: 'viewer' } }
                        });
                    }
                }
            }
        }
        
        // Create notification for invited user
        const inviter = await User.findById(userId);
        const workspaceInfo = workspaceIds && workspaceIds.length > 0 ? ` and ${workspaceIds.length} workspace(s)` : '';
        await createNotification({
            userId: targetUser._id,
            type: 'organization_invite',
            title: 'Organization Invitation',
            message: `${inviter.username || inviter.email} invited you to join ${org.name} as ${role || 'member'}${workspaceInfo}`,
            resourceType: 'organization',
            resourceId: org._id,
            actionUrl: `/organization/${org._id}`,
            actionText: 'View Organization',
            actorId: userId,
            actorName: inviter.username || inviter.email,
            priority: 'high'
        });
        
        await createAuditLog({
            action: 'organization.invite',
            userId,
            resourceType: 'organization',
            resourceId: org._id,
            resourceName: org.name,
            metadata: { invitedUser: email, role, workspaceIds },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            result: 'success'
        });
        
        res.json({ message: 'User invited successfully', organization: org });
    } catch (error) {
        console.error('Error inviting to organization:', error);
        res.status(500).json({ error: 'Failed to send invite' });
    }
});

// Switch current organization
router.post('/:orgId/switch', authenticateToken, async (req, res) => {
    try {
        const { orgId } = req.params;
        const userId = req.user.userId;
        
        const org = await Organization.findById(orgId);
        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }
        
        // Verify user is member
        if (!org.members.find(m => m.userId.toString() === userId)) {
            return res.status(403).json({ error: 'Not a member of this organization' });
        }
        
        await User.findByIdAndUpdate(userId, {
            currentOrganizationId: orgId,
            currentWorkspaceId: null
        });
        
        res.json({ message: 'Switched to organization', organizationId: orgId });
    } catch (error) {
        console.error('Error switching organization:', error);
        res.status(500).json({ error: 'Failed to switch organization' });
    }
});

module.exports = router;
