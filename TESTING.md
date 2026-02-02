# Testing Guide for Zero-Trust Collaboration Workspace

## Quick Test Scenarios

### Scenario 1: Complete User Journey

1. **Register User 1**
   - Go to http://localhost:3000
   - Click "Register" tab
   - Username: `alice`
   - Email: `alice@example.com`
   - Password: `SecurePass123`
   - Scan QR code with Google Authenticator app
   - Enter 6-digit code to enable MFA

2. **Login with MFA**
   - Switch to "Login" tab
   - Email: `alice@example.com`
   - Password: `SecurePass123`
   - Enter current OTP from authenticator app
   - ✅ You're now logged in!

3. **Create Encrypted Document**
   - Click "+ Create Document"
   - Title: `Confidential Report`
   - Content: `This is sensitive information.`
   - ✅ Check "Enable end-to-end encryption"
   - Click "Save Document"

4. **Sign Document**
   - Click the document card to view
   - Click "✍️ Sign Document"
   - ✅ Digital signature created with your RSA private key

5. **Generate Invite**
   - Go to "Invites" section
   - Click "+ Generate Invite"
   - Select the document you created
   - Check permissions: read, sign
   - Set expiration: 60 minutes
   - Max uses: 1
   - Click "Generate Invite"
   - ✅ Copy the invite token or QR code

### Scenario 2: Second User Accepts Invite

1. **Register User 2**
   - Open new private/incognito browser window
   - Go to http://localhost:3000
   - Register as:
     - Username: `bob`
     - Email: `bob@example.com`
     - Password: `AnotherPass456`
   - Setup MFA and login

2. **Accept Invite**
   - Go to "Invites" section
   - Scroll to "Accept Invite Token"
   - Paste the token from Alice
   - Click "Accept Invite"
   - ✅ You now have access to Alice's document!

3. **View Shared Document**
   - Go to "Documents" section
   - ✅ You'll see Alice's encrypted document
   - Click to view - it's automatically decrypted for you!
   - ✅ You can sign it too (if Alice granted sign permission)

### Scenario 3: Security Testing

#### Test 1: ACL Enforcement
- Try to access a document you don't have permission for
- Expected: ❌ Error message "You don't have read permission"

#### Test 2: Signature Verification
1. Create and sign a document
2. Manually edit document content in browser DevTools or via API
3. Click "Verify Signatures"
4. Expected: ❌ "Invalid - hash mismatch"

#### Test 3: MFA Requirement
1. Logout
2. Try logging in with just password (enter wrong OTP)
3. Expected: ❌ "Invalid MFA token"

#### Test 4: Token Expiration
1. Generate invite with 1 minute expiration
2. Wait 2 minutes
3. Try to accept the invite
4. Expected: ❌ "Token has expired"

#### Test 5: Encrypted Data Privacy
1. Create encrypted document
2. Open browser DevTools → Network tab
3. Create another document
4. Check the POST request payload
5. Expected: ✅ Content is encrypted (base64 gibberish)

## API Testing with cURL

### Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```

### Login (Step 1)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```

### Verify MFA (Step 2)
```bash
curl -X POST http://localhost:3000/api/auth/verify-mfa \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "token": "123456"
  }'
```

### Create Document
```bash
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Test Document",
    "content": "This is a test",
    "encrypted": false
  }'
```

### List Documents
```bash
curl http://localhost:3000/api/documents \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Security Features Checklist

Test each feature to verify implementation:

- [ ] ✅ **Password Hashing**: Passwords stored as bcrypt hashes
- [ ] ✅ **MFA (TOTP)**: QR code + 6-digit OTP required for login
- [ ] ✅ **JWT Authentication**: Bearer token in Authorization header
- [ ] ✅ **Role-Based ACL**: Per-document permissions (read, write, delete, sign, share)
- [ ] ✅ **Hybrid Encryption**: RSA-2048 + AES-256-CBC
- [ ] ✅ **End-to-End Encryption**: Server never sees plaintext
- [ ] ✅ **SHA-256 Hashing**: Document integrity verification
- [ ] ✅ **Digital Signatures**: RSA signature with SHA-256
- [ ] ✅ **Base64 Encoding**: Invite tokens encoded
- [ ] ✅ **QR Codes**: Visual invite sharing
- [ ] ✅ **Token Expiration**: Time-based security
- [ ] ✅ **Usage Limits**: Max uses per invite
- [ ] ✅ **Zero-Trust**: Never trust, always verify

## Performance Testing

### Create 10 Documents
```javascript
// Run in browser console when logged in
for (let i = 1; i <= 10; i++) {
    fetch('/api/documents', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: `Document ${i}`,
            content: `Content for document ${i}`,
            encrypted: i % 2 === 0
        })
    }).then(r => r.json()).then(console.log);
}
```

### Test Concurrent Signups
Open multiple browser tabs and register users simultaneously.

## Troubleshooting

### Issue: QR Code not showing
- Check browser console for errors
- Verify qrcode package is installed
- Try refreshing the page

### Issue: MFA token always invalid
- Check your device time is correct (TOTP is time-based)
- Verify you're entering the current 6-digit code
- Try the next code (they refresh every 30 seconds)

### Issue: Encrypted document shows gibberish
- This is normal in the database/network
- Should auto-decrypt when viewing in UI
- Check browser console for decryption errors

### Issue: "Cannot read property of undefined"
- Clear browser cache and localStorage
- Restart the server
- Check server logs for errors

## Next Steps

1. Add database persistence (MongoDB/PostgreSQL)
2. Implement rate limiting
3. Add email verification
4. Implement password reset
5. Add audit logging
6. Deploy to production with HTTPS
7. Add unit tests
8. Implement WebSocket for real-time collaboration
9. Add file upload support
10. Implement document versioning

---

**Happy Testing! 🔒**
