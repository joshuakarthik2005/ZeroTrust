const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    
    // Author
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: String,
    
    // Content (encrypted)
    content: { type: String, required: true },
    encryptedContent: { type: String, required: true },
    signature: String, // Digital signature of the comment
    
    // Thread support
    parentCommentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' },
    threadId: { type: mongoose.Schema.Types.ObjectId }, // Root comment ID
    
    // Position (for inline comments)
    position: {
        type: { type: String, enum: ['inline', 'general'], default: 'general' },
        startOffset: Number,
        endOffset: Number,
        selectedText: String
    },
    
    // Status
    isResolved: { type: Boolean, default: false },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
    
    // Metadata
    editedAt: Date,
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    
    createdAt: { type: Date, default: Date.now }
});

// Indexes
commentSchema.index({ documentId: 1, createdAt: -1 });
commentSchema.index({ threadId: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', commentSchema);
