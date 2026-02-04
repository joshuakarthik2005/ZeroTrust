const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    
    // Notification details
    type: { 
        type: String, 
        required: true,
        enum: [
            'permission_granted', 'permission_revoked', 'permission_modified',
            'document_shared', 'document_mentioned', 'comment_added', 'comment_reply',
            'task_assigned', 'task_approved', 'task_rejected', 'task_completed',
            'approval_needed', 'signature_required',
            'login_detected', 'new_device', 'suspicious_activity',
            'access_violation', 'security_alert',
            'workspace_invite', 'organization_invite'
        ]
    },
    
    title: { type: String, required: true },
    message: { type: String, required: true },
    
    // Related resources
    resourceType: { type: String, enum: ['document', 'comment', 'task', 'workspace', 'organization', 'session'] },
    resourceId: { type: mongoose.Schema.Types.ObjectId },
    
    // Action link
    actionUrl: String,
    actionText: String,
    
    // Actor (who triggered this notification)
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: String,
    
    // Delivery
    isRead: { type: Boolean, default: false },
    readAt: Date,
    
    // Signed payload (for security notifications)
    signature: String,
    
    // Priority
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date
});

// Indexes
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ workspaceId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
