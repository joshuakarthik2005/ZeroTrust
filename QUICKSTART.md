# 🚀 Quick Reference Guide

## Start the Application

```bash
cd c:\Users\DELL\Desktop\focys
npm start
```

Then open: **http://localhost:3000**

## 📋 Feature Checklist

### ✅ All Security Features Implemented

1. **Authentication (3/3)**
   - ✅ Password hashing with bcrypt (10 rounds)
   - ✅ Multi-Factor Authentication (TOTP)
   - ✅ JWT session management (1-hour expiry)

2. **Authorization (3/3)**
   - ✅ Role-based access control
   - ✅ Fine-grained ACL per document
   - ✅ Permission types: read, write, delete, sign, share

3. **Encryption (3/3)**
   - ✅ Hybrid encryption (RSA-2048 + AES-256)
   - ✅ End-to-end encrypted documents
   - ✅ Per-user key encryption

4. **Hashing & Signatures (3/3)**
   - ✅ SHA-256 document hashing
   - ✅ RSA digital signatures
   - ✅ Signature verification

5. **Encoding & Theory (3/3)**
   - ✅ Base64-encoded tokens
   - ✅ QR code generation
   - ✅ Zero-Trust architecture

**TOTAL: 15/15 Features ✅**

## 🔑 Key Commands

### Install Dependencies
```bash
npm install
```

### Start Server
```bash
npm start
```

### Start with Auto-Reload (Dev Mode)
```bash
npm run dev  # Requires nodemon installation
```

## 📝 Common Operations

### Register a New User
1. Go to http://localhost:3000
2. Click "Register" tab
3. Fill in: username, email, password (min 8 chars)
4. Scan QR code with authenticator app
5. Enter 6-digit code to enable MFA

### Login
1. Click "Login" tab
2. Enter email and password
3. Enter current OTP from authenticator app
4. You're in!

### Create Document
1. Click "+ Create Document"
2. Enter title and content
3. Optional: Check "Enable end-to-end encryption"
4. Click "Save Document"

### Sign Document
1. Open a document
2. Click "✍️ Sign Document"
3. Digital signature created!

### Share Document
1. Go to "Invites" section
2. Click "+ Generate Invite"
3. Select document
4. Choose permissions
5. Set expiry and max uses
6. Copy token or QR code
7. Share with other user

### Accept Invite
1. Receive invite token
2. Go to "Invites" section
3. Paste token in "Accept Invite Token" field
4. Click "Accept Invite"
5. Document appears in your list!

## 🔐 Security Algorithms Quick Ref

| Feature | Algorithm | Key Size | Purpose |
|---------|-----------|----------|---------|
| Password | bcrypt | 10 rounds | Secure password storage |
| MFA | TOTP (HMAC-SHA1) | 160 bits | Two-factor authentication |
| Session | JWT (HS256) | 256 bits | Authenticated sessions |
| Asymmetric | RSA | 2048 bits | Key exchange & signatures |
| Symmetric | AES-256-CBC | 256 bits | Fast data encryption |
| Hashing | SHA-256 | 256 bits | Document integrity |
| Encoding | Base64 | N/A | Token encoding |

## 📂 Project Structure

```
focys/
├── server.js              # Main Express server
├── package.json           # Dependencies
├── .env                   # Environment config
├── routes/
│   ├── auth.js           # Authentication & MFA
│   ├── documents.js      # Document CRUD & signing
│   └── invites.js        # Invite token system
├── middleware/
│   └── auth.js           # JWT & ACL middleware
├── utils/
│   ├── database.js       # In-memory storage
│   └── encryption.js     # Crypto utilities
├── public/
│   ├── index.html        # Frontend UI
│   ├── styles.css        # Styling
│   └── app.js            # Client JavaScript
└── docs/
    ├── README.md         # Main documentation
    ├── TESTING.md        # Test scenarios
    └── SECURITY.md       # Security architecture
```

## 🧪 Quick Tests

### Test MFA
```bash
# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"test1234"}'
```

### Test Document Creation
```bash
# First: Get JWT token by logging in
# Then:
curl -X POST http://localhost:3000/api/documents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","content":"Hello","encrypted":true}'
```

## 🐛 Troubleshooting

### Port 3000 already in use
```bash
# Kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Can't scan QR code
- Use Google Authenticator, Microsoft Authenticator, or Authy
- Alternatively, manually enter the secret key shown

### MFA token rejected
- Check device time is synced (TOTP is time-sensitive)
- Wait for next code (refreshes every 30 seconds)
- Ensure 6-digit code is current

### Encrypted document not decrypting
- Check browser console for errors
- Verify you have read permission
- Ensure document was shared with you properly

## 📞 Support

### Common Issues

**Q: How do I reset if I lose MFA?**
A: Currently, restart server (in-memory storage). In production, implement backup codes.

**Q: Can I use this in production?**
A: Not yet. Replace in-memory storage with database, add HTTPS, implement rate limiting.

**Q: How secure is this?**
A: Very secure for educational purposes. All industry-standard algorithms used.

**Q: Does the server see my documents?**
A: Encrypted documents: No (E2E encrypted). Regular documents: Yes.

## 🎓 Learning Resources

- **Zero-Trust**: https://www.cloudflare.com/learning/security/glossary/what-is-zero-trust/
- **bcrypt**: https://github.com/kelektiv/node.bcrypt.js
- **TOTP**: https://datatracker.ietf.org/doc/html/rfc6238
- **JWT**: https://jwt.io/introduction
- **RSA**: https://en.wikipedia.org/wiki/RSA_(cryptosystem)
- **AES**: https://en.wikipedia.org/wiki/Advanced_Encryption_Standard
- **Digital Signatures**: https://en.wikipedia.org/wiki/Digital_signature

## 🎯 Next Steps

1. ✅ **Setup Complete** - Server running
2. ⬜ Register your first user
3. ⬜ Enable MFA
4. ⬜ Create encrypted document
5. ⬜ Sign a document
6. ⬜ Generate invite token
7. ⬜ Share with another user
8. ⬜ Verify signatures
9. ⬜ Explore all features
10. ⬜ Consider production deployment

## 🔗 Useful Links

- Project Repo: (Add your GitHub link)
- Live Demo: (Add deployment URL)
- Documentation: See README.md
- Security Details: See SECURITY.md
- Testing Guide: See TESTING.md

---

**Remember: Security is achieved through layers, not a single solution! 🔒**

**For help, check the documentation or open an issue.**
