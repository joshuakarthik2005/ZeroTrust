const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    
    // Task details
    title: { type: String, required: true },
    description: String,
    type: { 
        type: String, 
        enum: ['approval', 'review', 'signature', 'task', 'workflow'], 
        default: 'task' 
    },
    
    // Assignment
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Status & priority
    status: { 
        type: String, 
        enum: ['pending', 'in_progress', 'approved', 'rejected', 'completed', 'cancelled'], 
        default: 'pending' 
    },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    
    // Approval workflow
    approvalChain: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        order: Number, // Sequential or parallel approval
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        decidedAt: Date,
        comments: String,
        signature: String
    }],
    requiresAllApprovals: { type: Boolean, default: false }, // true = all must approve, false = any
    
    // Conditional logic
    conditions: [{
        field: String, // e.g., 'document.size', 'user.role', 'permission.level'
        operator: String, // 'equals', 'greater_than', 'contains', etc.
        value: mongoose.Schema.Types.Mixed
    }],
    
    // Notifications
    notifyOnComplete: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    
    // Deadlines
    dueDate: Date,
    completedAt: Date,
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes
taskSchema.index({ workspaceId: 1, status: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ documentId: 1 });

module.exports = mongoose.model('Task', taskSchema);
