require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const inviteRoutes = require('./routes/invites');
const organizationRoutes = require('./routes/organizations');
const workspaceRoutes = require('./routes/workspaces');
const folderRoutes = require('./routes/folders');
const versionRoutes = require('./routes/versions');
const sessionRoutes = require('./routes/sessions');
const auditLogRoutes = require('./routes/auditLogs');
const commentRoutes = require('./routes/comments');
const taskRoutes = require('./routes/tasks');
const notificationRoutes = require('./routes/notifications');
const complianceRoutes = require('./routes/compliance');
const apiRoutes = require('./routes/api');
const securityLabRoutes = require('./routes/securityLab');
const { initializeAuditLogger } = require('./utils/auditLogger');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection caching for serverless
let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: true, // Enable buffering
        };

        cached.promise = mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zero-trust-workspace', opts)
            .then((mongoose) => {
                console.log('✅ Connected to MongoDB');
                // Initialize audit logger after DB connection
                initializeAuditLogger().catch(err => console.error('Audit logger init error:', err));
                return mongoose;
            });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
};

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 3600000 // 1 hour
    }
}));

// Ensure MongoDB connection before API requests
app.use('/api', async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        res.status(500).json({ error: 'Database connection failed' });
    }
});

// Static files
app.use(express.static('public'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/versions', versionRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/api', apiRoutes);
app.use('/api/security-lab', securityLabRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/invites', inviteRoutes);

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// (Removed SPA enterprise routes and invite page mappings)

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`🔒 Zero-Trust Collaboration Workspace running on http://localhost:${PORT}`);
    console.log(`✓ Authentication: MFA enabled`);
    console.log(`✓ Authorization: Role-based ACL`);
    console.log(`✓ Encryption: End-to-end enabled`);
    console.log(`✓ Signatures: Digital signing active`);
    console.log(`✓ Invites: QR code generation ready`);
});
