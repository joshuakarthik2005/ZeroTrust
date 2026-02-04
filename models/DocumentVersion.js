const mongoose = require('mongoose');

const documentVersionSchema = new mongoose.Schema({
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    version: { type: Number, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    encryptedContent: { type: String, required: true },
    contentHash: { type: String, required: true }, // SHA-256 of content
    previousVersionHash: { type: String }, // Hash chain
    
    // Signature tracking
    signatures: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        signature: String,
        signedAt: Date,
        invalidatedAt: Date, // Set when document is modified after signing
        invalidationReason: String
    }],
    
    // Change tracking
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changeDescription: { type: String },
    diffFromPrevious: { type: String }, // Stored diff for quick comparison
    
    // Metadata snapshot
    metadata: {
        size: Number,
        permissions: mongoose.Schema.Types.Mixed, // Snapshot of permissions at this version
        tags: [String]
    },
    
    createdAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: false } // Only one active version per document
});

// Compound index for efficient version queries
documentVersionSchema.index({ documentId: 1, version: -1 });
documentVersionSchema.index({ documentId: 1, isActive: 1 });

module.exports = mongoose.model('DocumentVersion', documentVersionSchema);
