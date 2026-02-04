const express = require('express');
const router = express.Router();
const { User, Document } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');

// Track attack simulations
const attackSimulations = [];

// Enable/disable security lab mode
let securityLabEnabled = false;

router.get('/status', authenticateToken, (req, res) => {
    res.json({
        enabled: securityLabEnabled,
        simulations: attackSimulations.length
    });
});

router.post('/enable', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    if (user.role !== 'admin' && user.role !== 'owner') {
        return res.status(403).json({ error: 'Admin access required for Security Lab' });
    }
    
    securityLabEnabled = req.body.enabled || true;
    
    await createAuditLog({
        action: 'security.lab.toggle',
        userId,
        resourceType: 'system',
        metadata: { enabled: securityLabEnabled },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        severity: 'high',
        result: 'success'
    });
    
    res.json({ message: `Security Lab ${securityLabEnabled ? 'enabled' : 'disabled'}`, enabled: securityLabEnabled });
});

// Simulate replay attack
router.post('/simulate/replay-attack', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { targetDocumentId, oldSignature } = req.body;
        
        // Attempt to replay old signature
        const document = await Document.findById(targetDocumentId);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        // Check if signature matches current document hash
        const isReplay = document.hash !== oldSignature.documentHash;
        
        const result = {
            attackType: 'replay_attack',
            detected: isReplay,
            blocked: isReplay,
            details: {
                attempted: 'Replay old signature on modified document',
                currentHash: document.hash,
                replayedHash: oldSignature.documentHash,
                outcome: isReplay ? 'BLOCKED - Hash mismatch detected' : 'Would have succeeded'
            }
        };
        
        attackSimulations.push({
            ...result,
            timestamp: new Date(),
            userId
        });
        
        await createAuditLog({
            action: 'attack.detected',
            userId,
            resourceType: 'document',
            resourceId: targetDocumentId,
            metadata: result,
            severity: 'critical',
            result: isReplay ? 'blocked' : 'success'
        });
        
        res.json(result);
    } catch (error) {
        console.error('Replay attack simulation error:', error);
        res.status(500).json({ error: 'Simulation failed' });
    }
});

// Simulate privilege escalation
router.post('/simulate/privilege-escalation', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { targetDocumentId, attemptedPermission } = req.body;
        
        const document = await Document.findById(targetDocumentId);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        // Check if user has the permission
        const isOwner = document.ownerId.toString() === userId;
        const docPermission = document.permissions.find(p => p.userId.toString() === userId);
        const hasPermission = isOwner || (docPermission && docPermission.permissions.includes(attemptedPermission));
        
        const result = {
            attackType: 'privilege_escalation',
            detected: !hasPermission,
            blocked: !hasPermission,
            details: {
                attempted: `Access document with '${attemptedPermission}' permission`,
                actualPermissions: docPermission ? docPermission.permissions : (isOwner ? ['all'] : []),
                outcome: !hasPermission ? 'BLOCKED - Insufficient permissions' : 'Would have succeeded'
            }
        };
        
        attackSimulations.push({
            ...result,
            timestamp: new Date(),
            userId
        });
        
        await createAuditLog({
            action: 'attack.detected',
            userId,
            resourceType: 'document',
            resourceId: targetDocumentId,
            metadata: result,
            severity: 'critical',
            result: !hasPermission ? 'blocked' : 'success'
        });
        
        res.json(result);
    } catch (error) {
        console.error('Privilege escalation simulation error:', error);
        res.status(500).json({ error: 'Simulation failed' });
    }
});

// Simulate tampered document upload
router.post('/simulate/tampered-upload', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { documentId, tamperedContent } = req.body;
        
        const document = await Document.findById(documentId);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        // Calculate hash of tampered content
        const crypto = require('crypto');
        const tamperedHash = crypto.createHash('sha256').update(tamperedContent).digest('hex');
        
        // Check if hash matches stored hash
        const isTampered = document.hash !== tamperedHash;
        
        const result = {
            attackType: 'tampered_upload',
            detected: isTampered,
            blocked: isTampered,
            details: {
                attempted: 'Upload document with modified content but claim original',
                originalHash: document.hash,
                tamperedHash: tamperedHash,
                outcome: isTampered ? 'BLOCKED - Hash verification failed' : 'Would have succeeded'
            }
        };
        
        attackSimulations.push({
            ...result,
            timestamp: new Date(),
            userId
        });
        
        await createAuditLog({
            action: 'attack.detected',
            userId,
            resourceType: 'document',
            resourceId: documentId,
            metadata: result,
            severity: 'critical',
            result: isTampered ? 'blocked' : 'success'
        });
        
        res.json(result);
    } catch (error) {
        console.error('Tampered upload simulation error:', error);
        res.status(500).json({ error: 'Simulation failed' });
    }
});

// Get simulation results
router.get('/simulations', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const userSimulations = attackSimulations.filter(s => s.userId.toString() === userId);
        
        const summary = {
            total: userSimulations.length,
            blocked: userSimulations.filter(s => s.blocked).length,
            detected: userSimulations.filter(s => s.detected).length,
            byType: {
                replay_attack: userSimulations.filter(s => s.attackType === 'replay_attack').length,
                privilege_escalation: userSimulations.filter(s => s.attackType === 'privilege_escalation').length,
                tampered_upload: userSimulations.filter(s => s.attackType === 'tampered_upload').length
            },
            recent: userSimulations.slice(-10).reverse()
        };
        
        res.json(summary);
    } catch (error) {
        console.error('Error fetching simulations:', error);
        res.status(500).json({ error: 'Failed to fetch simulations' });
    }
});

// Clear simulation history
router.delete('/simulations', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const before = attackSimulations.length;
        attackSimulations.splice(0, attackSimulations.length, 
            ...attackSimulations.filter(s => s.userId.toString() !== userId)
        );
        const removed = before - attackSimulations.length;
        
        res.json({ message: `Cleared ${removed} simulations` });
    } catch (error) {
        console.error('Error clearing simulations:', error);
        res.status(500).json({ error: 'Failed to clear simulations' });
    }
});

module.exports = router;
