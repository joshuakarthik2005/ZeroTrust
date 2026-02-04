const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, // null = root
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    permissions: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        permissions: [{ type: String, enum: ['read', 'write', 'delete', 'share', 'manage'] }],
        inheritFromParent: { type: Boolean, default: true }
    }],
    path: { type: String }, // Full path for quick lookup: "/folder1/subfolder2"
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Index for efficient queries
folderSchema.index({ workspaceId: 1, parentId: 1 });
folderSchema.index({ workspaceId: 1, path: 1 });

module.exports = mongoose.model('Folder', folderSchema);
