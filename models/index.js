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
    createdAt: { type: Date, default: Date.now }
});

const documentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    encrypted: { type: Boolean, default: false },
    encryptedKeys: { type: Map, of: mongoose.Schema.Types.Mixed },
    hash: { type: String, required: true },
    signed: { type: Boolean, default: false },
    signatures: [{
        userId: mongoose.Schema.Types.ObjectId,
        username: String,
        signature: String,
        timestamp: Date,
        documentHash: String
    }],
    permissions: [{
        userId: mongoose.Schema.Types.ObjectId,
        permissions: [String]
    }],
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
