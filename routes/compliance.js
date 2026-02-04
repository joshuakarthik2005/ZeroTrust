const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { User, Document } = require('../models');
const DeviceSession = require('../models/DeviceSession');
const { authenticateToken } = require('../middleware/auth');

// Get compliance dashboard data
router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        const { workspaceId, days = 30 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        
        const query = { timestamp: { $gte: startDate } };
        if (workspaceId) query.workspaceId = workspaceId;
        
        // Get security violations
        const violations = await AuditLog.find({
            ...query,
            $or: [
                { action: { $regex: /^attack\./ } },
                { result: 'blocked' },
                { severity: { $in: ['high', 'critical'] } }
            ]
        }).sort({ timestamp: -1 }).limit(100);
        
        // Get access patterns
        const accessStats = await AuditLog.aggregate([
            { $match: query },
            {
                $group: {
                    _id: {
                        action: '$action',
                        result: '$result'
                    },
                    count: { $sum: 1 }
                }
            }
        ]);
        
        // Get user activity
        const userActivity = await AuditLog.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$userId',
                    actionCount: { $sum: 1 },
                    lastActive: { $max: '$timestamp' }
                }
            },
            { $sort: { actionCount: -1 } },
            { $limit: 20 }
        ]);
        
        // Get documents without recent access
        const inactiveDocuments = await Document.aggregate([
            {
                $lookup: {
                    from: 'auditlogs',
                    let: { docId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$resourceId', '$$docId'] },
                                        { $gte: ['$timestamp', startDate] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'recentAccess'
                }
            },
            {
                $match: {
                    'recentAccess': { $size: 0 }
                }
            },
            { $limit: 50 }
        ]);
        
        // Get permission health (documents with expired permissions)
        const now = new Date();
        const expiredPermissions = await Document.aggregate([
            { $unwind: '$permissions' },
            {
                $match: {
                    'permissions.expiresAt': { $lte: now }
                }
            },
            {
                $group: {
                    _id: '$_id',
                    title: { $first: '$title' },
                    expiredCount: { $sum: 1 }
                }
            }
        ]);
        
        // Get suspicious sessions
        const suspiciousSessions = await DeviceSession.find({
            $or: [
                { trustLevel: 'suspicious' },
                { riskScore: { $gte: 50 } },
                { 'anomalies.0': { $exists: true } }
            ],
            isActive: true
        }).limit(20);
        
        // Calculate compliance score (0-100)
        let complianceScore = 100;
        
        // Deduct for violations
        const criticalViolations = violations.filter(v => v.severity === 'critical').length;
        const highViolations = violations.filter(v => v.severity === 'high').length;
        complianceScore -= (criticalViolations * 10 + highViolations * 5);
        
        // Deduct for expired permissions
        complianceScore -= Math.min(expiredPermissions.length * 2, 20);
        
        // Deduct for suspicious sessions
        complianceScore -= Math.min(suspiciousSessions.length * 3, 15);
        
        complianceScore = Math.max(complianceScore, 0);
        
        res.json({
            complianceScore,
            timeRange: { startDate, endDate: new Date(), days: parseInt(days) },
            violations: {
                total: violations.length,
                critical: criticalViolations,
                high: highViolations,
                recent: violations.slice(0, 10)
            },
            accessStats,
            userActivity,
            inactiveDocuments: {
                count: inactiveDocuments.length,
                documents: inactiveDocuments.slice(0, 10)
            },
            expiredPermissions: {
                count: expiredPermissions.length,
                documents: expiredPermissions.slice(0, 10)
            },
            suspiciousSessions: {
                count: suspiciousSessions.length,
                sessions: suspiciousSessions.slice(0, 10)
            },
            recommendations: generateRecommendations(complianceScore, {
                violations: violations.length,
                expiredPermissions: expiredPermissions.length,
                suspiciousSessions: suspiciousSessions.length,
                inactiveDocuments: inactiveDocuments.length
            })
        });
    } catch (error) {
        console.error('Error fetching compliance dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch compliance data' });
    }
});

function generateRecommendations(score, metrics) {
    const recommendations = [];
    
    if (score < 70) {
        recommendations.push({
            severity: 'critical',
            title: 'Low Compliance Score',
            message: 'Your compliance score is below acceptable levels. Immediate action required.',
            action: 'Review security violations and address critical issues'
        });
    }
    
    if (metrics.violations > 10) {
        recommendations.push({
            severity: 'high',
            title: 'High Number of Security Violations',
            message: `${metrics.violations} security violations detected in the selected time period.`,
            action: 'Review audit logs and strengthen security policies'
        });
    }
    
    if (metrics.expiredPermissions > 5) {
        recommendations.push({
            severity: 'medium',
            title: 'Expired Permissions Detected',
            message: `${metrics.expiredPermissions} documents have expired permissions.`,
            action: 'Review and remove expired document permissions'
        });
    }
    
    if (metrics.suspiciousSessions > 0) {
        recommendations.push({
            severity: 'high',
            title: 'Suspicious Sessions Active',
            message: `${metrics.suspiciousSessions} active sessions flagged as suspicious.`,
            action: 'Review session activity and terminate if necessary'
        });
    }
    
    if (metrics.inactiveDocuments > 20) {
        recommendations.push({
            severity: 'low',
            title: 'Many Inactive Documents',
            message: `${metrics.inactiveDocuments} documents have not been accessed recently.`,
            action: 'Consider archiving or reviewing inactive documents'
        });
    }
    
    return recommendations;
}

module.exports = router;
