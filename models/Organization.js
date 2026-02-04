const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['owner', 'admin', 'member', 'viewer'], default: 'member' },
        joinedAt: { type: Date, default: Date.now }
    }],
    settings: {
        requireMFA: { type: Boolean, default: false },
        allowedDomains: [String],
        sessionTimeout: { type: Number, default: 86400000 }, // 24 hours
        ipWhitelist: [String]
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Organization', organizationSchema);
