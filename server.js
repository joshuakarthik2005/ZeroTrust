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

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection caching for serverless
let isConnected = false;

const connectDB = async () => {
    if (isConnected) {
        console.log('Using existing MongoDB connection');
        return;
    }

    try {
        const db = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zero-trust-workspace', {
            bufferCommands: false,
        });
        isConnected = db.connections[0].readyState === 1;
        console.log('✅ Connected to MongoDB');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        throw err;
    }
};

// Connect to MongoDB before handling requests
connectDB();

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
app.use('/api/documents', documentRoutes);
app.use('/api/invites', inviteRoutes);

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
