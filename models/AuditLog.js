const mongoose = require('mongoose');
const crypto = require('crypto');

const auditLogSchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    
    // Event details
    action: { 
        type: String, 
        required: true,
        enum: [
            'document.create', 'document.read', 'document.update', 'document.delete',
            'document.share', 'document.sign', 'document.download', 'document.version.restore',
            'permission.grant', 'permission.revoke', 'permission.modify',
            'user.login', 'user.logout', 'user.register', 
            'user.mfa.enable', 'user.mfa.disable', 'user.mfa.verify', 'user.mfa.failed',
            'session.create', 'session.kill', 'device.trust', 'device.revoke',
            'folder.create', 'folder.delete', 'folder.move',
            'workspace.create', 'workspace.delete', 'workspace.member.add', 'workspace.member.remove', 'workspace.invite',
            'organization.create', 'organization.delete', 'organization.member.add', 'organization.invite',
            'attack.detected', 'attack.blocked', 'security.violation'
        ]
    },
    
    // Actor information
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userEmail: String,
    userRole: String,
    
    // Target resource
    resourceType: { type: String, enum: ['document', 'folder', 'workspace', 'organization', 'user', 'session'] },
    resourceId: { type: mongoose.Schema.Types.ObjectId },
    resourceName: String,
    
    // Context
    ipAddress: String,
    userAgent: String,
    deviceFingerprint: String,
    sessionId: String,
    location: {
        country: String,
        city: String,
        coordinates: [Number] // [longitude, latitude]
    },
    
    // Additional data
    metadata: mongoose.Schema.Types.Mixed, // Action-specific data
    result: { type: String, enum: ['success', 'failure', 'blocked'], default: 'success' },
    errorMessage: String,
    
    // Tamper-evident chain
    sequenceNumber: { type: Number, required: true }, // Incrementing sequence
    previousLogHash: String, // Hash of previous log entry
    currentHash: String, // Hash of this entry
    
    // Compliance
    retentionUntil: Date, // For compliance retention policies
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
    
    timestamp: { type: Date, default: Date.now, immutable: true }
}, { timestamps: false }); // Don't use createdAt/updatedAt, use timestamp

// Compute hash before saving
auditLogSchema.pre('save', function(next) {
    const logData = {
        action: this.action,
        userId: this.userId,
        resourceType: this.resourceType,
        resourceId: this.resourceId,
        timestamp: this.timestamp,
        sequenceNumber: this.sequenceNumber,
        previousLogHash: this.previousLogHash,
        metadata: this.metadata
    };
    
    this.currentHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(logData))
        .digest('hex');
    
    next();
});

// Indexes for efficient querying
auditLogSchema.index({ workspaceId: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ resourceId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ sequenceNumber: 1 }, { unique: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
