# Enterprise Zero-Trust Workspace - Setup & Testing Guide

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Make sure your `.env` file has:
```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
PORT=3000
```

### 3. Start the Server
```bash
node server.js
```

The server will start on `http://localhost:3000`

### 4. Access the Application
Open `http://localhost:3000/index-enterprise.html` in your browser

---

## 📋 Testing Checklist

### Phase 1: Authentication & Organizations
- [ ] Register a new user account
- [ ] Login with email/password
- [ ] Enable MFA and verify it works
- [ ] Create a new organization
- [ ] Create a workspace within the organization
- [ ] Switch between organizations/workspaces

### Phase 2: Document Management
- [ ] Create a new document
- [ ] Edit a document (version should auto-create)
- [ ] View document details
- [ ] Sign a document with your certificate
- [ ] Delete a document (should prompt for re-auth)

### Phase 3: Sharing & Permissions
- [ ] Share a document with granular permissions (read, write, comment, etc.)
- [ ] Test permission inheritance
- [ ] Set expiration dates on permissions
- [ ] Verify someone can't perform actions they don't have permission for

### Phase 4: Versioning
- [ ] Edit a document and check version history is created
- [ ] View version history modal
- [ ] Compare two versions
- [ ] Restore an old version
- [ ] Download a specific version
- [ ] Verify signatures are invalidated when content changes

### Phase 5: Comments & Collaboration
- [ ] Add a comment to a document
- [ ] Reply to a comment (threading)
- [ ] Resolve a comment
- [ ] Verify comments are encrypted

### Phase 6: Tasks & Approvals
- [ ] Create a task
- [ ] Assign task to a user
- [ ] Create an approval workflow task
- [ ] Approve/reject a task
- [ ] Check task status updates

### Phase 7: Device Trust & Sessions
- [ ] View active sessions
- [ ] Check device fingerprinting works
- [ ] Terminate a session
- [ ] Trust a device
- [ ] Verify risk scoring for new devices

### Phase 8: Audit Logs
- [ ] View audit logs for all actions
- [ ] Filter logs by action type, date range
- [ ] Verify hash chain integrity
- [ ] Check high-severity events are flagged

### Phase 9: Compliance Dashboard
- [ ] View compliance score
- [ ] Check security violations
- [ ] View user activity stats
- [ ] Check expired permissions
- [ ] Review suspicious sessions
- [ ] Read recommendations

### Phase 10: Security Lab
- [ ] Simulate replay attack (should be blocked)
- [ ] Simulate privilege escalation (should be blocked)
- [ ] Simulate tampered upload (should be detected)
- [ ] Verify all attacks are logged in audit trail

### Phase 11: Notifications
- [ ] Create actions that trigger notifications
- [ ] Check notification badge updates
- [ ] View notifications dropdown
- [ ] Mark notifications as read
- [ ] Verify real-time polling works

### Phase 12: Re-Authentication
- [ ] Try to delete a document (should prompt for password)
- [ ] Try to sign a document (should prompt for password)
- [ ] Verify failed re-auth blocks the action

---

## 🔍 Key Features to Verify

### Multi-Tenancy
- Organizations are isolated
- Workspaces are scoped to organizations
- Documents belong to workspaces
- Can't access other org's data

### Zero-Trust Architecture
- Every action requires valid JWT
- Sensitive actions require re-authentication
- Device fingerprinting on every login
- Risk-based authentication prompts

### Cryptographic Integrity
- Document versions have SHA-256 hashes
- Audit logs have hash chains (previousLogHash → currentHash)
- Signatures include document hash and are invalidated on edits
- Notifications are signed for authenticity

### Continuous Authentication
- High-risk actions prompt for MFA
- Session timeout enforcement
- Device trust levels affect access
- Anomaly detection triggers additional verification

---

## 🐛 Common Issues & Fixes

### Issue: "Cannot connect to database"
**Fix:** Check your MongoDB URI in `.env` and ensure MongoDB is running

### Issue: "401 Unauthorized" errors
**Fix:** 
- Clear browser localStorage
- Re-login to get fresh token
- Check JWT_SECRET is set in `.env`

### Issue: MFA not working
**Fix:** 
- Install `speakeasy` and `qrcode` packages
- Check MFA secret is being generated on setup

### Issue: File uploads failing
**Fix:**
- Check `uploads/` directory exists and is writable
- Verify file size limits in server config

### Issue: Frontend looks unstyled
**Fix:**
- Make sure `enterprise.css` is loaded
- Check browser console for 404 errors
- Clear browser cache

---

## 📊 API Endpoints Reference

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/mfa/setup` - Setup MFA
- `POST /api/auth/mfa/verify` - Verify MFA code

### Organizations
- `GET /api/organizations` - List user's organizations
- `POST /api/organizations` - Create organization
- `POST /api/organizations/:id/switch` - Switch active org

### Workspaces
- `GET /api/workspaces` - List workspaces in current org
- `POST /api/workspaces` - Create workspace
- `POST /api/workspaces/:id/switch` - Switch active workspace

### Documents
- `GET /api/documents` - List documents in workspace
- `POST /api/documents` - Create document
- `PUT /api/documents/:id` - Update document (creates version)
- `DELETE /api/documents/:id` - Delete document (requires re-auth)
- `POST /api/documents/:id/sign` - Sign document
- `POST /api/documents/:id/share` - Share with permissions

### Versions
- `GET /api/versions/:documentId` - Get version history
- `POST /api/versions/:documentId/restore/:versionId` - Restore version
- `GET /api/versions/:documentId/compare` - Compare versions

### Comments
- `GET /api/comments/:documentId` - Get comments
- `POST /api/comments/:documentId` - Add comment
- `POST /api/comments/:id/resolve` - Resolve comment

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `POST /api/tasks/:id/approve` - Approve/reject task

### Audit Logs
- `GET /api/audit-logs` - Query audit logs
- `GET /api/audit-logs/verify/chain` - Verify hash chain

### Sessions
- `GET /api/sessions` - List active sessions
- `DELETE /api/sessions/:id` - Terminate session
- `POST /api/sessions/:id/trust` - Trust device

### Compliance
- `GET /api/compliance/dashboard` - Get compliance metrics

### Security Lab
- `POST /api/security-lab/simulate/replay-attack`
- `POST /api/security-lab/simulate/privilege-escalation`
- `POST /api/security-lab/simulate/tampered-upload`

---

## 🔐 Security Notes

1. **Never commit `.env` file** - Add it to `.gitignore`
2. **Use strong JWT secrets** - Generate with `openssl rand -base64 32`
3. **Enable HTTPS in production** - Use Let's Encrypt or similar
4. **MongoDB security** - Enable authentication and network restrictions
5. **Rate limiting** - Already implemented for auth endpoints
6. **Input validation** - Sanitize all user inputs
7. **CORS** - Configure for your frontend domain only

---

## 📝 Development Notes

### Architecture
- **Backend:** Express.js + MongoDB + Mongoose
- **Frontend:** Vanilla JavaScript (no framework)
- **Auth:** JWT + MFA (TOTP)
- **Security:** Zero-trust, continuous authentication, device fingerprinting

### File Structure
```
focys/
├── models/              # Database schemas
│   ├── Organization.js
│   ├── Workspace.js
│   ├── Document.js (in index.js)
│   ├── User.js (in index.js)
│   ├── DocumentVersion.js
│   ├── AuditLog.js
│   ├── DeviceSession.js
│   ├── Comment.js
│   ├── Task.js
│   ├── Notification.js
│   └── ApiToken.js
├── routes/              # API endpoints
│   ├── auth.js
│   ├── documents.js
│   ├── organizations.js
│   ├── workspaces.js
│   ├── versions.js
│   ├── sessions.js
│   ├── auditLogs.js
│   ├── comments.js
│   ├── tasks.js
│   ├── notifications.js
│   ├── compliance.js
│   ├── api.js
│   └── securityLab.js
├── utils/               # Helper functions
│   ├── auditLogger.js
│   ├── deviceTrust.js
│   └── notificationService.js
├── middleware/          # Express middleware
│   └── auth.js
├── public/              # Frontend files
│   ├── index-enterprise.html
│   ├── app-enterprise.js (Part 1: Auth, Orgs, Workspaces)
│   ├── app-enterprise-part2.js (Part 2: Documents, Sharing)
│   ├── app-enterprise-part3.js (Part 3: Comments, Tasks, Audit, Sessions)
│   ├── app-enterprise-part4.js (Part 4: Notifications, Versions, Utils)
│   └── enterprise.css
└── server.js            # Main server file
```

---

## 🚀 Next Steps After Testing

1. **Fix any bugs found during testing**
2. **Add missing features** (if any identified)
3. **Implement SSO/OAuth** (Google, Microsoft)
4. **Performance optimization** (caching, indexing)
5. **Deploy to production** (after local testing passes)
6. **Set up monitoring** (error tracking, analytics)
7. **Write API documentation** (Swagger/OpenAPI)
8. **Add automated tests** (Jest, Mocha, etc.)

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Check server logs for backend errors
3. Verify MongoDB connection
4. Review this guide for common issues
5. Test each feature individually

Happy testing! 🎉
