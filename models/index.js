const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    mfaSecret: { type: String, required: true },
    mfaEnabled: { type: Boolean, default: false },
    publicKey: { type: String, required: true },
    privateKey: { type: String, required: true },
    role: { type: String, default: 'user' },
    
    // Organization & workspace memberships
    organizations: [{
        organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
        role: String
    }],
    workspaces: [{
        workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
        role: String
    }],
    
    // Current context (for multi-tenant)
    currentOrganizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    currentWorkspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    
    // Trusted devices
    trustedDevices: [{
        fingerprint: String,
        name: String,
        lastUsed: Date,
        trustedAt: Date
    }],
    
    // Security settings
    requireReAuthFor: [{ 
        type: String,
        enum: ['download', 'share', 'delete', 'sign', 'permission_change']
    }],
    
    createdAt: { type: Date, default: Date.now }
});

const documentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // File metadata for uploads
    fileType: { type: String, enum: ['text', 'pdf', 'ppt', 'pptx', 'doc', 'docx', 'uploaded'], default: 'text' },
    filePath: String, // Path to uploaded file
    fileName: String, // Original filename
    fileSize: Number, // File size in bytes
    mimeType: String, // MIME type
    
    // Organization & workspace
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder' },
    
    // Encryption
    encrypted: { type: Boolean, default: false },
    encryptedKeys: { type: Map, of: mongoose.Schema.Types.Mixed },
    hash: { type: String, required: true },
    
    // Signatures
    signed: { type: Boolean, default: false },
    signatures: [{
        userId: mongoose.Schema.Types.ObjectId,
        username: String,
        signature: String,
        timestamp: Date,
        documentHash: String,
        invalidated: { type: Boolean, default: false },
        invalidatedAt: Date
    }],
    
    // Permissions (granular)
    permissions: [{
        userId: mongoose.Schema.Types.ObjectId,
        permissions: {
            type: [String],
            enum: ['read', 'write', 'comment', 'share', 'delete', 'sign', 'download']
        },
        grantedBy: mongoose.Schema.Types.ObjectId,
        grantedAt: { type: Date, default: Date.now },
        expiresAt: Date
    }],
    
    // Advanced sharing
    sharingSettings: {
        allowDownload: { type: Boolean, default: true },
        viewOnly: { type: Boolean, default: false },
        watermark: { type: Boolean, default: false },
        ipWhitelist: [String],
        expiresAt: Date
    },
    
    // Versioning
    currentVersion: { type: Number, default: 1 },
    
    // Metadata
    tags: [String],
    size: Number,
    mimeType: String,
    
    // DLP
    containsSensitiveData: { type: Boolean, default: false },
    dlpKeywords: [String],
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const inviteTokenSchema = new mongoose.Schema({
    tokenId: { type: String, required: true, unique: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    permissions: [String],
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
    maxUses: { type: Number, default: 1 },
    uses: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);
const Document = mongoose.model('Document', documentSchema);
const InviteToken = mongoose.model('InviteToken', inviteTokenSchema);

module.exports = { User, Document, InviteToken };
