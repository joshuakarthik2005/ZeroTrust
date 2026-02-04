const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['owner', 'admin', 'editor', 'viewer'], default: 'viewer' },
        permissions: {
            canCreateDocuments: { type: Boolean, default: true },
            canInviteMembers: { type: Boolean, default: false },
            canManageFolders: { type: Boolean, default: false }
        },
        joinedAt: { type: Date, default: Date.now }
    }],
    defaultPermissions: {
        newMembers: [{ type: String, enum: ['read', 'write', 'comment', 'share', 'delete', 'sign', 'download'] }]
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Workspace', workspaceSchema);
