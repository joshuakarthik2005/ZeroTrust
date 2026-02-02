# MongoDB Setup Guide for Windows

## Option 1: Install MongoDB Locally (Recommended for Development)

### Download and Install MongoDB Community Server

1. **Download MongoDB:**
   - Go to: https://www.mongodb.com/try/download/community
   - Select: Windows, Version 7.0 (or latest)
   - Click "Download"

2. **Install MongoDB:**
   - Run the installer (msi file)
   - Choose "Complete" installation
   - Check "Install MongoDB as a Service"
   - Check "Install MongoDB Compass" (GUI tool)

3. **Verify Installation:**
   ```powershell
   mongod --version
   ```

4. **Start MongoDB:**
   - It should start automatically as a Windows service
   - Or manually start:
   ```powershell
   net start MongoDB
   ```

5. **Test Connection:**
   ```powershell
   mongosh
   ```
   - Type `exit` to quit

### Your app is already configured to connect to: `mongodb://localhost:27017/zero-trust-workspace`

---

## Option 2: Use MongoDB Atlas (Free Cloud Database)

### Setup MongoDB Atlas (No local installation needed)

1. **Create Account:**
   - Go to: https://www.mongodb.com/cloud/atlas/register
   - Sign up for free

2. **Create Cluster:**
   - Choose "Free" M0 cluster
   - Select a region (closest to you)
   - Click "Create Cluster"

3. **Create Database User:**
   - Go to "Database Access"
   - Click "Add New Database User"
   - Username: `admin`
   - Password: (create strong password)
   - Database User Privileges: "Read and write to any database"
   - Click "Add User"

4. **Whitelist IP Address:**
   - Go to "Network Access"
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (for development)
   - Click "Confirm"

5. **Get Connection String:**
   - Go to "Database" → Click "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - It looks like: `mongodb+srv://admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

6. **Update .env file:**
   ```env
   MONGODB_URI=mongodb+srv://admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/zero-trust-workspace?retryWrites=true&w=majority
   ```
   - Replace `<password>` with your actual password
   - Add database name: `/zero-trust-workspace` before the `?`

---

## Quick Start Commands

### For Local MongoDB:
```powershell
# Check if MongoDB is running
net start | findstr MongoDB

# Start MongoDB service
net start MongoDB

# Stop MongoDB service
net stop MongoDB

# Check MongoDB logs
type "C:\Program Files\MongoDB\Server\7.0\log\mongod.log"
```

### Start Your App:
```powershell
npm start
```

You should see:
```
✅ Connected to MongoDB
🔒 Zero-Trust Collaboration Workspace running on http://localhost:3001
```

---

## Troubleshooting

### MongoDB not found
- Add MongoDB to PATH:
  - `C:\Program Files\MongoDB\Server\7.0\bin`

### Connection refused
- Make sure MongoDB service is running:
  ```powershell
  net start MongoDB
  ```

### Can't connect to Atlas
- Check internet connection
- Verify IP is whitelisted
- Check username/password in connection string

### App runs without database
- The app will start even without MongoDB
- You'll see: `⚠️ Running without database - data will not persist`
- Data will be lost on restart (in-memory mode)

---

## Using MongoDB Compass (GUI)

1. **Open MongoDB Compass**
2. **Connection String:**
   - Local: `mongodb://localhost:27017`
   - Atlas: (your connection string)
3. **Connect**
4. **View databases:**
   - You'll see `zero-trust-workspace` database
   - Collections: users, documents, invitetokens

---

## Next Steps

After MongoDB is running:

1. ✅ Refresh issue is fixed (uses localStorage)
2. ✅ Database is set up (MongoDB)
3. ✅ Data persists across server restarts
4. ✅ Multiple users can work simultaneously

**Start your app:**
```powershell
npm start
```

**Test the database:**
1. Register a new user
2. Restart the server
3. Login with same credentials
4. Your user should still exist! ✅
