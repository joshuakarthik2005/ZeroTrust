const mongoose = require('mongoose');

const apiTokenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    
    // Token details
    name: { type: String, required: true },
    token: { type: String, required: true, unique: true }, // Hashed token
    tokenPrefix: { type: String }, // First 8 chars for display
    
    // Scopes & permissions
    scopes: [{ 
        type: String,
        enum: [
            'documents:read', 'documents:write', 'documents:delete',
            'permissions:read', 'permissions:write',
            'audit:read', 'users:read', 'webhooks:manage'
        ]
    }],
    
    // Restrictions
    ipWhitelist: [String],
    rateLimit: { type: Number, default: 1000 }, // Requests per hour
    
    // Usage tracking
    lastUsedAt: Date,
    usageCount: { type: Number, default: 0 },
    
    // Lifecycle
    isActive: { type: Boolean, default: true },
    expiresAt: Date,
    revokedAt: Date,
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    createdAt: { type: Date, default: Date.now }
});

// Indexes
apiTokenSchema.index({ token: 1 });
apiTokenSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('ApiToken', apiTokenSchema);
