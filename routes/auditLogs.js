const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { authenticateToken } = require('../middleware/auth');
const { verifyAuditChain } = require('../utils/auditLogger');

// Get audit logs with filters
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { workspaceId, action, userId, resourceType, startDate, endDate, limit = 100 } = req.query;
        
        const query = {};
        
        if (workspaceId) query.workspaceId = workspaceId;
        if (action) query.action = action;
        if (userId) query.userId = userId;
        if (resourceType) query.resourceType = resourceType;
        
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }
        
        const logs = await AuditLog.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .populate('userId', 'username email');
        
        res.json(logs);
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// Get audit log by ID
router.get('/:logId', authenticateToken, async (req, res) => {
    try {
        const { logId } = req.params;
        
        const log = await AuditLog.findById(logId).populate('userId', 'username email');
        if (!log) {
            return res.status(404).json({ error: 'Audit log not found' });
        }
        
        res.json(log);
    } catch (error) {
        console.error('Error fetching audit log:', error);
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});

// Verify audit chain integrity
router.get('/verify/chain', authenticateToken, async (req, res) => {
    try {
        const { fromSequence, toSequence } = req.query;
        
        if (!fromSequence || !toSequence) {
            return res.status(400).json({ error: 'fromSequence and toSequence required' });
        }
        
        const result = await verifyAuditChain(
            parseInt(fromSequence),
            parseInt(toSequence)
        );
        
        res.json(result);
    } catch (error) {
        console.error('Error verifying audit chain:', error);
        res.status(500).json({ error: 'Failed to verify audit chain' });
    }
});

// Get audit statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
    try {
        const { workspaceId, startDate, endDate } = req.query;
        
        const query = {};
        if (workspaceId) query.workspaceId = workspaceId;
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }
        
        const stats = await AuditLog.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$action',
                    count: { $sum: 1 },
                    successCount: {
                        $sum: { $cond: [{ $eq: ['$result', 'success'] }, 1, 0] }
                    },
                    failureCount: {
                        $sum: { $cond: [{ $eq: ['$result', 'failure'] }, 1, 0] }
                    },
                    blockedCount: {
                        $sum: { $cond: [{ $eq: ['$result', 'blocked'] }, 1, 0] }
                    }
                }
            },
            { $sort: { count: -1 } }
        ]);
        
        const totalLogs = await AuditLog.countDocuments(query);
        
        res.json({
            totalLogs,
            actionStats: stats,
            timeRange: { startDate, endDate }
        });
    } catch (error) {
        console.error('Error fetching audit stats:', error);
        res.status(500).json({ error: 'Failed to fetch audit statistics' });
    }
});

module.exports = router;
