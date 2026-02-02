# Security Architecture Documentation

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                      │
├─────────────────────────────────────────────────────────────┤
│  • HTML/CSS/JS Frontend                                      │
│  • User Authentication UI                                    │
│  • Document Management Interface                             │
│  • RSA Private Key (stored locally in production)            │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTPS (TLS 1.3)
                 │ JWT Bearer Token
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      API SERVER (Express.js)                 │
├─────────────────────────────────────────────────────────────┤
│  Authentication Middleware                                   │
│  ├─ JWT Verification                                         │
│  └─ Session Management                                       │
│                                                              │
│  Authorization Middleware (ACL)                              │
│  ├─ Permission Checking                                      │
│  └─ Resource Access Control                                 │
├─────────────────────────────────────────────────────────────┤
│  Routes                                                      │
│  ├─ /api/auth      (Authentication & MFA)                   │
│  ├─ /api/documents (CRUD, Signing, Sharing)                 │
│  └─ /api/invites   (Token Generation & Validation)          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER (In-Memory)                  │
├─────────────────────────────────────────────────────────────┤
│  users Map                                                   │
│  ├─ Hashed passwords (bcrypt)                               │
│  ├─ MFA secrets                                             │
│  └─ RSA key pairs                                           │
│                                                              │
│  documents Map                                               │
│  ├─ Encrypted content                                       │
│  ├─ Document hashes (SHA-256)                               │
│  └─ Digital signatures                                      │
│                                                              │
│  inviteTokens Map                                           │
│  └─ Base64-encoded metadata                                 │
└─────────────────────────────────────────────────────────────┘
```

## 🔐 Security Layers

### Layer 1: Transport Security
- **HTTPS/TLS** (in production)
- **Certificate Validation**
- **Secure Headers** (CSP, HSTS)

### Layer 2: Authentication
```
User Registration
    ↓
Password → bcrypt(password, 10 rounds) → Hashed Password
    ↓
MFA Secret Generation → TOTP Secret → QR Code
    ↓
User enables MFA → Verify OTP → MFA Active

User Login
    ↓
Email + Password → bcrypt.compare() → ✓ Valid
    ↓
Enter OTP → speakeasy.verify() → ✓ Valid
    ↓
Generate JWT → Sign with SECRET → Token (1hr expiry)
```

### Layer 3: Authorization (Zero-Trust)
```
API Request
    ↓
JWT Middleware → Verify Token → Extract userId
    ↓
ACL Middleware → Check Permission → Grant/Deny
    ↓
Resource Access → Audit Log → Response
```

### Layer 4: Data Protection

#### Encryption Flow
```
Plain Text Document
    ↓
Generate AES-256 Key (random 32 bytes)
    ↓
Encrypt Content → AES-256-CBC → Encrypted Data
    ↓
Encrypt AES Key → RSA-2048 (Public Key) → Encrypted Key
    ↓
Store: {encryptedData, encryptedKey, IV}
```

#### Decryption Flow
```
Retrieve {encryptedData, encryptedKey, IV}
    ↓
Decrypt AES Key → RSA-2048 (Private Key) → AES Key
    ↓
Decrypt Content → AES-256-CBC → Plain Text
    ↓
Display to Authorized User
```

### Layer 5: Integrity & Non-Repudiation

#### Digital Signature Flow
```
Document Content
    ↓
SHA-256 Hash → Document Hash
    ↓
Sign Hash → RSA-2048 (Private Key) → Digital Signature
    ↓
Store: {signature, timestamp, userId, documentHash}
```

#### Verification Flow
```
Document + Signature
    ↓
Compute Current Hash → SHA-256 → Current Hash
    ↓
Verify Signature → RSA (Public Key) → ✓ Valid/✗ Invalid
    ↓
Compare Hashes → Current vs Stored → ✓ Match/✗ Modified
```

## 🛡️ Security Mechanisms Detail

### 1. Password Security
- **Algorithm**: bcrypt
- **Rounds**: 10 (2^10 = 1024 iterations)
- **Salt**: Automatic per-password
- **Output**: 60-character hash

**Why bcrypt?**
- Adaptive (can increase rounds over time)
- Salt built-in
- Resistant to rainbow tables
- Slow by design (prevents brute force)

### 2. Multi-Factor Authentication
- **Protocol**: TOTP (RFC 6238)
- **Algorithm**: HMAC-SHA1
- **Time Step**: 30 seconds
- **Digits**: 6
- **Window**: ±2 steps (±60 seconds tolerance)

**Flow:**
```
Secret Key (Base32) + Current Time
    ↓
HMAC-SHA1(Secret, Time/30)
    ↓
Truncate to 6 digits
    ↓
Display in Authenticator App
```

### 3. JWT (JSON Web Tokens)
- **Algorithm**: HS256 (HMAC-SHA256)
- **Payload**: `{userId, email, role, iat, exp}`
- **Expiry**: 1 hour
- **Storage**: Client-side (localStorage/sessionStorage)

**Structure:**
```
Header.Payload.Signature
    ↓
Base64Url(Header).Base64Url(Payload).HMAC-SHA256(Header.Payload, SECRET)
```

### 4. Access Control List (ACL)

**Permission Matrix:**

| User Type | read | write | delete | sign | share |
|-----------|------|-------|--------|------|-------|
| Owner     | ✅   | ✅    | ✅     | ✅   | ✅    |
| Editor    | ✅   | ✅    | ❌     | ✅   | ❌    |
| Signer    | ✅   | ❌    | ❌     | ✅   | ❌    |
| Viewer    | ✅   | ❌    | ❌     | ❌   | ❌    |

**Implementation:**
```javascript
ACL Structure:
{
    documentId: {
        userId1: ['read', 'write'],
        userId2: ['read', 'sign'],
        userId3: ['read']
    }
}

Permission Check:
function hasPermission(docId, userId, permission) {
    const doc = getDocument(docId);
    if (doc.ownerId === userId) return true; // Owner bypass
    return ACL[docId][userId].includes(permission);
}
```

### 5. Hybrid Encryption System

**Why Hybrid?**
- RSA: Secure key exchange, but slow for large data
- AES: Fast symmetric encryption for data
- Combination: Best of both worlds

**Key Sizes:**
- RSA: 2048 bits (256 bytes)
- AES: 256 bits (32 bytes)
- IV: 128 bits (16 bytes)

**Security Properties:**
- Confidentiality: Only recipient can decrypt
- Perfect Forward Secrecy: Unique AES key per document
- Key Isolation: Each user gets separately encrypted copy

### 6. Digital Signatures

**Algorithm Chain:**
```
Content → SHA-256 → Hash → RSA Sign → Signature
                              ↓
                         Private Key

Verification:
Signature → RSA Verify → Hash → Compare → ✓/✗
                ↑
           Public Key
```

**Security Properties:**
- **Integrity**: Any modification invalidates signature
- **Non-repudiation**: Only signer could create signature
- **Authenticity**: Proves signer identity

### 7. Invite Token System

**Token Structure:**
```
Token = TokenID:Base64(Metadata)

Metadata = {
    invitedBy: userId,
    documentId: docId,
    permissions: ['read', 'write'],
    createdAt: timestamp,
    expiresAt: timestamp,
    maxUses: number
}
```

**Security Features:**
- Random TokenID (16 bytes = 128 bits entropy)
- Base64 encoding (not encryption, just encoding)
- Expiration enforcement
- Usage tracking
- Revocation support

**QR Code:**
- Encodes invite URL with embedded token
- Standard QR code format
- Scannable by any QR reader

## 🔒 Zero-Trust Implementation

### Principle 1: Verify Explicitly
```
Every Request:
    ↓
Extract JWT from Authorization header
    ↓
Verify signature with secret key
    ↓
Check expiration time
    ↓
Extract user identity
    ↓
Proceed to authorization
```

### Principle 2: Least Privilege
```
User requests document access
    ↓
Check if user is owner → YES → Grant all permissions
    ↓ NO
Check ACL for specific permissions → Grant only what's listed
    ↓
User has read, write → Can view and edit
    ↓
User tries to delete → ❌ DENIED (needs delete permission)
```

### Principle 3: Assume Breach
```
Scenario: Server compromised
    ↓
Attacker accesses database
    ↓
Sees encrypted document content → Can't decrypt (needs private key)
    ↓
Sees password hashes → Can't reverse (bcrypt is one-way)
    ↓
Sees MFA secrets → Can't generate past tokens (TOTP is time-based)
    ↓
Result: Data remains protected ✅
```

## 📊 Threat Model

### Threats Mitigated

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Password theft | bcrypt hashing + MFA | ✅ |
| Session hijacking | JWT expiry + HTTPS | ✅ |
| Brute force | MFA + rate limiting (TODO) | ⚠️ |
| Man-in-the-middle | HTTPS/TLS (production) | ⚠️ |
| SQL injection | N/A (in-memory, no SQL) | ✅ |
| XSS | Input sanitization | ✅ |
| CSRF | SameSite cookies (TODO) | ⚠️ |
| Unauthorized access | ACL + JWT | ✅ |
| Data breach | E2E encryption | ✅ |
| Signature forgery | RSA asymmetric crypto | ✅ |
| Replay attacks | Token expiry | ✅ |

### Future Enhancements

1. **Rate Limiting**: Prevent brute force on login
2. **CSRF Protection**: Anti-CSRF tokens
3. **XSS Protection**: Content Security Policy
4. **Audit Logging**: Track all security events
5. **Key Rotation**: Periodic key regeneration
6. **HSM Integration**: Hardware security module for keys
7. **Multi-region**: Geographic redundancy
8. **Backup Encryption**: Encrypted backups
9. **DDoS Protection**: Cloudflare/AWS Shield
10. **Penetration Testing**: Regular security audits

## 🎯 Compliance Mapping

### GDPR
- ✅ Data encryption (Art. 32)
- ✅ Access control (Art. 32)
- ✅ Right to deletion (delete endpoint)
- ⚠️ Data portability (export feature TODO)

### NIST Cybersecurity Framework
- ✅ Identify: Asset inventory (users, docs)
- ✅ Protect: Encryption, MFA, ACL
- ⚠️ Detect: Logging (TODO)
- ⚠️ Respond: Incident response (TODO)
- ⚠️ Recover: Backups (TODO)

### OWASP Top 10 (2021)
1. ✅ Broken Access Control → ACL implementation
2. ✅ Cryptographic Failures → E2E encryption
3. ⚠️ Injection → Input validation (partial)
4. ⚠️ Insecure Design → Zero-Trust architecture
5. ✅ Security Misconfiguration → Secure defaults
6. ⚠️ Vulnerable Components → Regular updates needed
7. ✅ Authentication Failures → MFA + bcrypt
8. ⚠️ Software/Data Integrity → Digital signatures
9. ⚠️ Logging/Monitoring → TODO
10. ⚠️ SSRF → Input validation needed

---

**Security is a journey, not a destination. Continuously improve! 🔒**
