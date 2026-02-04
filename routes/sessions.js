const express = require('express');
const router = express.Router();
const DeviceSession = require('../models/DeviceSession');
const { User } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { generateDeviceFingerprint, calculateRiskScore, detectAnomalies } = require('../utils/deviceTrust');
const { createAuditLog } = require('../utils/auditLogger');

// Get all active sessions for current user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const sessions = await DeviceSession.find({
            userId,
            isActive: true,
            expiresAt: { $gt: new Date() }
        }).sort({ lastActivityAt: -1 });
        
        res.json(sessions);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// Create/register new session (called on login)
async function createSession(userId, req, jwtToken) {
    try {
        const deviceFingerprint = generateDeviceFingerprint(req);
        
        // Check for previous sessions to detect anomalies
        const previousSessions = await DeviceSession.find({ userId })
            .sort({ lastActivityAt: -1 })
            .limit(5);
        
        const sessionData = {
            userId,
            sessionToken: require('crypto').randomBytes(32).toString('hex'),
            jwtToken,
            deviceFingerprint,
            deviceInfo: {
                browser: req.headers['user-agent'] || 'Unknown',
                platform: req.headers['sec-ch-ua-platform'] || 'Unknown'
            },
            ipAddress: req.ip,
            location: {
                // In production, use IP geolocation service
                country: 'Unknown',
                city: 'Unknown'
            },
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            lastActivityAt: new Date()
        };
        
        // Check if device is trusted
        const user = await User.findById(userId);
        const trustedDevice = user.trustedDevices?.find(d => d.fingerprint === deviceFingerprint);
        
        if (trustedDevice) {
            sessionData.trustLevel = 'trusted';
            sessionData.trustedAt = trustedDevice.trustedAt;
        } else {
            // Check if we've seen this device before
            const seenBefore = previousSessions.find(s => s.deviceFingerprint === deviceFingerprint);
            sessionData.trustLevel = seenBefore ? 'recognized' : 'unknown';
        }
        
        // Detect anomalies
        sessionData.anomalies = detectAnomalies(sessionData, previousSessions);
        
        // Calculate risk score
        sessionData.riskScore = calculateRiskScore(sessionData, previousSessions);
        
        const session = new DeviceSession(sessionData);
        await session.save();
        
        await createAuditLog({
            action: 'session.create',
            userId,
            resourceType: 'session',
            resourceId: session._id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            deviceFingerprint,
            metadata: {
                trustLevel: sessionData.trustLevel,
                riskScore: sessionData.riskScore,
                anomalyCount: sessionData.anomalies.length
            },
            severity: sessionData.riskScore > 50 ? 'high' : 'low',
            result: 'success'
        });
        
        return session;
    } catch (error) {
        console.error('Error creating session:', error);
        throw error;
    }
}

// Kill/terminate a session
router.delete('/:sessionId', authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.userId;
        
        const session = await DeviceSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Verify ownership
        if (session.userId.toString() !== userId) {
            return res.status(403).json({ error: 'Cannot terminate another user\'s session' });
        }
        
        session.isActive = false;
        session.terminatedAt = new Date();
        session.terminationReason = 'User-initiated';
        await session.save();
        
        await createAuditLog({
            action: 'session.kill',
            userId,
            resourceType: 'session',
            resourceId: sessionId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            metadata: { reason: 'User-initiated' },
            result: 'success'
        });
        
        res.json({ message: 'Session terminated successfully' });
    } catch (error) {
        console.error('Error terminating session:', error);
        res.status(500).json({ error: 'Failed to terminate session' });
    }
});

// Trust a device
router.post('/:sessionId/trust', authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.userId;
        const { deviceName } = req.body;
        
        const session = await DeviceSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        if (session.userId.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        session.trustLevel = 'trusted';
        session.trustedAt = new Date();
        await session.save();
        
        // Add to user's trusted devices
        const user = await User.findById(userId);
        const existingDevice = user.trustedDevices?.find(d => d.fingerprint === session.deviceFingerprint);
        
        if (!existingDevice) {
            if (!user.trustedDevices) user.trustedDevices = [];
            user.trustedDevices.push({
                fingerprint: session.deviceFingerprint,
                name: deviceName || 'Trusted Device',
                lastUsed: new Date(),
                trustedAt: new Date()
            });
            await user.save();
        }
        
        await createAuditLog({
            action: 'device.trust',
            userId,
            resourceType: 'session',
            resourceId: sessionId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            deviceFingerprint: session.deviceFingerprint,
            result: 'success'
        });
        
        res.json({ message: 'Device trusted successfully', session });
    } catch (error) {
        console.error('Error trusting device:', error);
        res.status(500).json({ error: 'Failed to trust device' });
    }
});

// Update session activity
async function updateSessionActivity(sessionToken) {
    try {
        await DeviceSession.findOneAndUpdate(
            { sessionToken, isActive: true },
            { lastActivityAt: new Date() }
        );
    } catch (error) {
        console.error('Error updating session activity:', error);
    }
}

module.exports = router;
module.exports.createSession = createSession;
module.exports.updateSessionActivity = updateSessionActivity;
