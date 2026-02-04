const crypto = require('crypto');

function generateDeviceFingerprint(req) {
    const components = [
        req.headers['user-agent'] || '',
        req.headers['accept-language'] || '',
        req.headers['accept-encoding'] || '',
        req.headers['accept'] || '',
        req.ip || '',
        // Screen resolution, timezone, etc would come from client-side JS
    ].join('|');
    
    return crypto
        .createHash('sha256')
        .update(components)
        .digest('hex');
}

function calculateRiskScore(sessionData, previousSessions = []) {
    let score = 0;
    
    // New device = higher risk
    if (sessionData.trustLevel === 'unknown') score += 30;
    if (sessionData.trustLevel === 'suspicious') score += 60;
    
    // Check for location changes
    if (previousSessions.length > 0) {
        const lastSession = previousSessions[0];
        
        // Different country
        if (lastSession.location && sessionData.location &&
            lastSession.location.country !== sessionData.location.country) {
            score += 20;
        }
        
        // Different IP but same country (moderate risk)
        if (lastSession.ipAddress !== sessionData.ipAddress) {
            score += 10;
        }
    }
    
    // Anomaly detection
    if (sessionData.anomalies && sessionData.anomalies.length > 0) {
        score += sessionData.anomalies.length * 15;
    }
    
    return Math.min(score, 100); // Cap at 100
}

function detectAnomalies(currentSession, previousSessions, userBehavior = {}) {
    const anomalies = [];
    
    if (previousSessions.length === 0) return anomalies;
    
    const lastSession = previousSessions[0];
    
    // Location change detection
    if (lastSession.location && currentSession.location) {
        if (lastSession.location.country !== currentSession.location.country) {
            anomalies.push({
                type: 'location_change',
                detectedAt: new Date(),
                severity: 'medium',
                details: {
                    from: lastSession.location.country,
                    to: currentSession.location.country
                }
            });
        }
    }
    
    // IP address change
    if (lastSession.ipAddress !== currentSession.ipAddress) {
        anomalies.push({
            type: 'ip_change',
            detectedAt: new Date(),
            severity: 'low',
            details: {
                from: lastSession.ipAddress,
                to: currentSession.ipAddress
            }
        });
    }
    
    // Device fingerprint change (possible spoofing)
    if (lastSession.deviceFingerprint !== currentSession.deviceFingerprint) {
        anomalies.push({
            type: 'device_fingerprint_change',
            detectedAt: new Date(),
            severity: 'high',
            details: 'Device fingerprint mismatch - possible spoofing attempt'
        });
    }
    
    return anomalies;
}

module.exports = {
    generateDeviceFingerprint,
    calculateRiskScore,
    detectAnomalies
};
