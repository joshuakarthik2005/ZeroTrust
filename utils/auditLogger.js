const AuditLog = require('../models/AuditLog');

let sequenceCounter = 0;
let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';

async function initializeAuditLogger() {
    try {
        const lastLog = await AuditLog.findOne().sort({ sequenceNumber: -1 });
        if (lastLog) {
            sequenceCounter = lastLog.sequenceNumber;
            previousHash = lastLog.currentHash;
        }
    } catch (error) {
        console.error('Error initializing audit logger:', error);
    }
}

async function createAuditLog(logData) {
    try {
        sequenceCounter++;
        
        const auditLog = new AuditLog({
            ...logData,
            sequenceNumber: sequenceCounter,
            previousLogHash: previousHash,
            timestamp: new Date()
        });
        
        await auditLog.save();
        
        // Update for next log
        previousHash = auditLog.currentHash;
        
        return auditLog;
    } catch (error) {
        console.error('Error creating audit log:', error);
        throw error;
    }
}

async function verifyAuditChain(fromSequence, toSequence) {
    try {
        const logs = await AuditLog.find({
            sequenceNumber: { $gte: fromSequence, $lte: toSequence }
        }).sort({ sequenceNumber: 1 });
        
        for (let i = 1; i < logs.length; i++) {
            if (logs[i].previousLogHash !== logs[i-1].currentHash) {
                return {
                    valid: false,
                    brokenAt: logs[i].sequenceNumber,
                    message: `Hash chain broken at sequence ${logs[i].sequenceNumber}`
                };
            }
        }
        
        return { valid: true, message: 'Audit chain verified successfully' };
    } catch (error) {
        console.error('Error verifying audit chain:', error);
        throw error;
    }
}

module.exports = {
    initializeAuditLogger,
    createAuditLog,
    verifyAuditChain
};
