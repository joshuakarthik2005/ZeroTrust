const mongoose = require('mongoose');

const deviceSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Session identification
    sessionToken: { type: String, required: true, unique: true },
    jwtToken: String, // Reference to JWT for invalidation
    
    // Device fingerprinting
    deviceFingerprint: { type: String, required: true },
    deviceInfo: {
        browser: String,
        os: String,
        device: String,
        screenResolution: String,
        timezone: String,
        language: String,
        platform: String,
        hardwareConcurrency: Number,
        deviceMemory: Number,
        colorDepth: Number,
        canvasFingerprint: String
    },
    
    // Trust & security
    trustLevel: { 
        type: String, 
        enum: ['trusted', 'recognized', 'unknown', 'suspicious'], 
        default: 'unknown' 
    },
    trustedAt: Date,
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    
    // Location tracking
    ipAddress: String,
    location: {
        country: String,
        region: String,
        city: String,
        coordinates: [Number],
        isp: String
    },
    
    // Session lifecycle
    createdAt: { type: Date, default: Date.now },
    lastActivityAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    terminatedAt: Date,
    terminationReason: String,
    
    // MFA & re-authentication
    mfaVerifiedAt: Date,
    lastReAuthAt: Date,
    sensitiveActionsCount: { type: Number, default: 0 },
    
    // Anomaly detection
    anomalies: [{
        type: { type: String }, // 'location_change', 'ip_change', 'impossible_travel', 'unusual_activity'
        detectedAt: Date,
        severity: String,
        details: mongoose.Schema.Types.Mixed
    }]
});

// Indexes
deviceSessionSchema.index({ userId: 1, isActive: 1 });
deviceSessionSchema.index({ sessionToken: 1 });
deviceSessionSchema.index({ deviceFingerprint: 1 });
deviceSessionSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('DeviceSession', deviceSessionSchema);
