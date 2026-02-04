const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');
const { markAsRead } = require('../utils/notificationService');

// Get notifications for current user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { unreadOnly, limit = 50 } = req.query;
        
        const query = { userId };
        if (unreadOnly === 'true') {
            query.isRead = false;
        }
        
        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));
        
        const unreadCount = await Notification.countDocuments({ userId, isRead: false });
        
        res.json({
            notifications,
            unreadCount
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark notification as read
router.patch('/:notificationId/read', authenticateToken, async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.userId;
        
        const notification = await markAsRead(notificationId, userId);
        
        res.json({ message: 'Notification marked as read', notification });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: error.message || 'Failed to mark notification as read' });
    }
});

// Mark all as read
router.post('/read-all', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        await Notification.updateMany(
            { userId, isRead: false },
            { isRead: true, readAt: new Date() }
        );
        
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
});

// Delete notification
router.delete('/:notificationId', authenticateToken, async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.userId;
        
        const notification = await Notification.findById(notificationId);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        if (notification.userId.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        await Notification.findByIdAndDelete(notificationId);
        
        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

module.exports = router;
