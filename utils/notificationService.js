const Notification = require('../models/Notification');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';

async function createNotification(data) {
    try {
        const {
            userId,
            workspaceId,
            type,
            title,
            message,
            resourceType,
            resourceId,
            actionUrl,
            actionText,
            actorId,
            actorName,
            priority = 'medium',
            expiresAt
        } = data;
        
        // Sign the notification for security-critical alerts
        let signature = null;
        if (['login_detected', 'suspicious_activity', 'access_violation', 'security_alert'].includes(type)) {
            const payload = JSON.stringify({ userId, type, message, timestamp: new Date() });
            signature = crypto
                .createHmac('sha256', JWT_SECRET)
                .update(payload)
                .digest('hex');
        }
        
        const notification = new Notification({
            userId,
            workspaceId,
            type,
            title,
            message,
            resourceType,
            resourceId,
            actionUrl,
            actionText,
            actorId,
            actorName,
            signature,
            priority,
            expiresAt: expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days default
        });
        
        await notification.save();
        
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
}

async function markAsRead(notificationId, userId) {
    try {
        const notification = await Notification.findById(notificationId);
        if (!notification) {
            throw new Error('Notification not found');
        }
        
        if (notification.userId.toString() !== userId) {
            throw new Error('Unauthorized');
        }
        
        notification.isRead = true;
        notification.readAt = new Date();
        await notification.save();
        
        return notification;
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
}

module.exports = {
    createNotification,
    markAsRead
};
