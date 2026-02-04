const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const { User, Document } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');
const { createNotification } = require('../utils/notificationService');

// Get tasks for workspace
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);
        
        if (!user.currentWorkspaceId) {
            return res.status(400).json({ error: 'No workspace selected' });
        }
        
        const { status, assignedToMe } = req.query;
        
        const query = { workspaceId: user.currentWorkspaceId };
        if (status) query.status = status;
        if (assignedToMe === 'true') query.assignedTo = userId;
        
        const tasks = await Task.find(query)
            .sort({ createdAt: -1 })
            .populate('assignedTo', 'username email')
            .populate('assignedBy', 'username email')
            .populate('documentId', 'title');
        
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// Create new task
router.post('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { title, description, type, assignedTo, documentId, dueDate, priority, approvalChain } = req.body;
        
        const user = await User.findById(userId);
        if (!user.currentWorkspaceId) {
            return res.status(400).json({ error: 'No workspace selected' });
        }
        
        if (!title) {
            return res.status(400).json({ error: 'Task title required' });
        }
        
        const task = new Task({
            workspaceId: user.currentWorkspaceId,
            documentId: documentId || null,
            title,
            description,
            type: type || 'task',
            assignedTo: Array.isArray(assignedTo) ? assignedTo : [assignedTo],
            assignedBy: userId,
            priority: priority || 'medium',
            dueDate: dueDate ? new Date(dueDate) : null,
            approvalChain: approvalChain || []
        });
        
        await task.save();
        
        // Create notifications for assigned users
        for (const assigneeId of task.assignedTo) {
            await createNotification({
                userId: assigneeId,
                workspaceId: user.currentWorkspaceId,
                type: 'task_assigned',
                title: 'New Task Assigned',
                message: `You have been assigned: ${title}`,
                resourceType: 'task',
                resourceId: task._id,
                actorId: userId,
                actorName: user.username,
                priority: priority || 'medium'
            });
        }
        
        await createAuditLog({
            action: 'task.create',
            userId,
            workspaceId: user.currentWorkspaceId,
            resourceType: 'task',
            resourceId: task._id,
            resourceName: title,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            result: 'success'
        });
        
        res.status(201).json(task);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// Update task status
router.patch('/:taskId/status', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status } = req.body;
        const userId = req.user.userId;
        
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        // Check if user is assigned or creator
        if (!task.assignedTo.includes(userId) && task.assignedBy.toString() !== userId) {
            return res.status(403).json({ error: 'Not authorized to update this task' });
        }
        
        task.status = status;
        if (status === 'completed') {
            task.completedAt = new Date();
        }
        task.updatedAt = new Date();
        
        await task.save();
        
        res.json({ message: 'Task status updated', task });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

// Approve/reject in approval chain
router.post('/:taskId/approve', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { approved, comments } = req.body;
        const userId = req.user.userId;
        
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        if (task.type !== 'approval') {
            return res.status(400).json({ error: 'Task is not an approval type' });
        }
        
        // Find user's approval in chain
        const approvalStep = task.approvalChain.find(a => a.userId.toString() === userId);
        if (!approvalStep) {
            return res.status(403).json({ error: 'Not in approval chain' });
        }
        
        if (approvalStep.status !== 'pending') {
            return res.status(400).json({ error: 'Already decided' });
        }
        
        approvalStep.status = approved ? 'approved' : 'rejected';
        approvalStep.decidedAt = new Date();
        approvalStep.comments = comments;
        
        // Check if all approvals complete
        const allApproved = task.approvalChain.every(a => a.status === 'approved');
        const anyRejected = task.approvalChain.some(a => a.status === 'rejected');
        
        if (anyRejected) {
            task.status = 'rejected';
        } else if (allApproved) {
            task.status = 'approved';
            task.completedAt = new Date();
        }
        
        task.updatedAt = new Date();
        await task.save();
        
        // Notify task creator
        await createNotification({
            userId: task.assignedBy,
            workspaceId: task.workspaceId,
            type: approved ? 'task_approved' : 'task_rejected',
            title: approved ? 'Task Approved' : 'Task Rejected',
            message: `${task.title} has been ${approved ? 'approved' : 'rejected'}`,
            resourceType: 'task',
            resourceId: task._id,
            actorId: userId,
            priority: 'high'
        });
        
        res.json({ message: approved ? 'Task approved' : 'Task rejected', task });
    } catch (error) {
        console.error('Error processing approval:', error);
        res.status(500).json({ error: 'Failed to process approval' });
    }
});

module.exports = router;
