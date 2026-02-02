# Quick Start with MongoDB

## Prerequisites
Before starting, ensure you have Node.js installed and MongoDB ready.

## Option 1: Local MongoDB (Recommended for Testing)

### Windows Installation
1. **Download MongoDB Community Server**
   - Go to https://www.mongodb.com/try/download/community
   - Download Windows MSI installer
   - Run installer with default settings
   - MongoDB installs as a Windows Service (starts automatically)

2. **Verify MongoDB is Running**
   ```powershell
   # Check if MongoDB service is running
   Get-Service MongoDB
   
   # Or connect with mongosh
   mongosh
   ```

3. **Update .env File**
   ```env
   PORT=3001
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   MONGODB_URI=mongodb://localhost:27017/zero-trust-workspace
   ```

## Option 2: MongoDB Atlas (Free Cloud Database)

1. **Create Free Account**
   - Go to https://www.mongodb.com/cloud/atlas/register
   - Sign up for free tier (512MB free forever)

2. **Create Cluster**
   - Click "Build a Database"
   - Choose FREE tier (M0)
   - Select region closest to you
   - Click "Create Cluster"

3. **Configure Access**
   - **Database Access**: Create a database user
     - Username: `admin`
     - Password: Generate secure password
     - Database User Privileges: Read and write to any database
   
   - **Network Access**: Add IP Address
     - Click "Allow Access from Anywhere" (for development)
     - Or add your current IP address

4. **Get Connection String**
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy connection string (looks like: `mongodb+srv://admin:<password>@cluster0.xxxxx.mongodb.net/`)
   
5. **Update .env File**
   ```env
   PORT=3001
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   MONGODB_URI=mongodb+srv://admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/zero-trust-workspace
   ```
   **Replace**:
   - `YOUR_PASSWORD` with actual password
   - `cluster0.xxxxx` with your actual cluster URL

## Start the Application

### 1. Install Dependencies
```powershell
cd c:\Users\DELL\Desktop\focys
npm install
```

### 2. Start Server
```powershell
npm start
```

### 3. Look for Success Message
```
✅ Connected to MongoDB
Server running on port 3001
```

### 4. Open Application
- Open browser: http://localhost:3001
- You should see the login/register page

## Test the Full Flow

### 1. Register New User
- Click "Register" tab
- Enter:
  - Username: `testuser`
  - Email: `test@example.com`
  - Password: `Test123!`
  - Confirm password: `Test123!`
- Click "Register"

### 2. Enable MFA
- You'll see a QR code
- Install authenticator app (Google Authenticator, Microsoft Authenticator, Authy)
- Scan QR code with your phone
- Enter the 6-digit code from authenticator
- Click "Enable MFA"

### 3. Login
- Enter email: `test@example.com`
- Enter password: `Test123!`
- Click "Login"
- Enter current 6-digit code from authenticator
- Click "Verify MFA"

### 4. Create Document
- Click "Create Document" button
- Enter title: `Test Document`
- Enter content: `This is my first encrypted document!`
- Check "Encrypt document"
- Click "Create"

### 5. Test Persistence
- **Stop the server**: Press Ctrl+C
- **Restart**: Run `npm start` again
- **Login again** with same credentials
- **Verify**: Your document is still there!

## Verify Database Contents

### Local MongoDB
```powershell
# Connect to MongoDB
mongosh

# Switch to your database
use zero-trust-workspace

# View collections
show collections

# View users
db.users.find().pretty()

# View documents
db.documents.find().pretty()

# View invite tokens
db.invitetokens.find().pretty()

# Exit
exit
```

### MongoDB Atlas
1. Go to your cluster in Atlas web interface
2. Click "Browse Collections"
3. You'll see:
   - `users` collection with your account
   - `documents` collection with your encrypted doc
   - `invitetokens` collection (empty until you create invites)

## Common Issues

### Issue: "MongoServerError: Authentication failed"
**Solution**: Check your MongoDB Atlas password is correct in MONGODB_URI

### Issue: "MongooseServerSelectionError: connect ECONNREFUSED"
**Solution**: 
- For local: Make sure MongoDB service is running (`Get-Service MongoDB`)
- For Atlas: Check your IP is whitelisted in Network Access

### Issue: "Cannot find module 'mongoose'"
**Solution**: Run `npm install` to install all dependencies

### Issue: Port 3001 already in use
**Solution**: 
```powershell
# Find process using port 3001
Get-NetTCPConnection -LocalPort 3001

# Kill the process (replace PID with actual process ID)
Stop-Process -Id PID -Force
```

## Next Steps

Once MongoDB is working:
1. ✅ Test document sharing with invite tokens
2. ✅ Test digital signatures
3. ✅ Test document editing
4. ✅ Deploy to Vercel with MongoDB Atlas

## MongoDB Atlas for Production

For deploying to Vercel:
1. **Use MongoDB Atlas** (not local MongoDB)
2. **Update Vercel Environment Variables**:
   - Go to Vercel project settings
   - Add environment variable: `MONGODB_URI=mongodb+srv://...`
3. **Secure Your Cluster**:
   - Remove "Allow Access from Anywhere"
   - Add specific IP ranges for your servers

## Database Backup

### Local MongoDB Backup
```powershell
# Backup database
mongodump --db zero-trust-workspace --out c:\backup

# Restore database
mongorestore --db zero-trust-workspace c:\backup\zero-trust-workspace
```

### MongoDB Atlas Backup
- Automatic backups included in paid tiers
- Free tier: Export data manually from "Browse Collections"

## Performance Tips

1. **Add Indexes** (for production):
   ```javascript
   // In models/index.js
   userSchema.index({ email: 1 });
   userSchema.index({ username: 1 });
   documentSchema.index({ ownerId: 1 });
   inviteTokenSchema.index({ tokenId: 1 });
   ```

2. **Monitor Queries** (add to server.js):
   ```javascript
   mongoose.set('debug', true); // Shows all queries in console
   ```

3. **Connection Pooling** (already configured):
   - Default pool size: 100 connections
   - Automatically managed by Mongoose

## Need Help?

- **MongoDB Docs**: https://www.mongodb.com/docs/
- **Mongoose Docs**: https://mongoosejs.com/docs/
- **MongoDB Atlas Support**: https://www.mongodb.com/cloud/atlas/help

Enjoy your Zero-Trust Secure Collaboration Workspace with persistent storage! 🎉
