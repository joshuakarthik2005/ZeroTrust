const crypto = require('crypto');

/**
 * Encryption Module - Implements hybrid encryption (RSA + AES)
 * Used for end-to-end encrypted file sharing
 */

class EncryptionService {
    /**
     * Generate RSA key pair for a user
     */
    static generateKeyPair() {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });
        return { publicKey, privateKey };
    }

    /**
     * Hybrid encryption: Generate AES key, encrypt data with AES, encrypt AES key with RSA
     */
    static encryptData(data, recipientPublicKey) {
        // Generate random AES key
        const aesKey = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);

        // Encrypt data with AES-256-CBC
        const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
        let encrypted = cipher.update(data, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        // Encrypt AES key with recipient's RSA public key
        const encryptedKey = crypto.publicEncrypt(
            {
                key: recipientPublicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            aesKey
        );

        return {
            encryptedData: encrypted,
            encryptedKey: encryptedKey.toString('base64'),
            iv: iv.toString('base64')
        };
    }

    /**
     * Hybrid decryption: Decrypt AES key with RSA, decrypt data with AES
     */
    static decryptData(encryptedPackage, recipientPrivateKey) {
        const { encryptedData, encryptedKey, iv } = encryptedPackage;

        // Decrypt AES key with recipient's RSA private key
        const aesKey = crypto.privateDecrypt(
            {
                key: recipientPrivateKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            Buffer.from(encryptedKey, 'base64')
        );

        // Decrypt data with AES
        const decipher = crypto.createDecipheriv(
            'aes-256-cbc',
            aesKey,
            Buffer.from(iv, 'base64')
        );
        let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Generate SHA-256 hash
     */
    static hash(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * Create digital signature using RSA private key
     */
    static signData(data, privateKey) {
        const sign = crypto.createSign('SHA256');
        sign.update(data);
        sign.end();
        return sign.sign(privateKey, 'base64');
    }

    /**
     * Verify digital signature using RSA public key
     */
    static verifySignature(data, signature, publicKey) {
        const verify = crypto.createVerify('SHA256');
        verify.update(data);
        verify.end();
        return verify.verify(publicKey, signature, 'base64');
    }
}

module.exports = EncryptionService;
