# Vercel Deployment Guide

## ⚠️ Important Limitations

This application uses **in-memory storage** which has limitations on Vercel:

- **Data persistence**: All data (users, documents, invites) will be lost when the serverless function restarts
- **Session management**: Sessions may not work reliably across multiple serverless instances
- **Multi-region**: Data won't sync across different Vercel regions

**For production use, you MUST migrate to a database** (MongoDB, PostgreSQL, etc.)

## 🚀 Deploy to Vercel

### Option 1: Deploy via Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```
   - Follow the prompts
   - Choose a project name
   - Confirm settings

4. **Set Environment Variables:**
   ```bash
   vercel env add JWT_SECRET
   vercel env add SESSION_SECRET
   ```
   - Enter strong secret values when prompted
   - Apply to Production, Preview, and Development

5. **Deploy to Production:**
   ```bash
   vercel --prod
   ```

### Option 2: Deploy via Vercel Dashboard

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Go to Vercel Dashboard:**
   - Visit https://vercel.com/dashboard
   - Click "Add New Project"
   - Import your GitHub repository

3. **Configure Project:**
   - Framework Preset: Other
   - Root Directory: ./
   - Build Command: (leave empty)
   - Output Directory: public
   - Install Command: npm install

4. **Add Environment Variables:**
   - Go to Settings → Environment Variables
   - Add:
     - `JWT_SECRET`: your-random-secret-key
     - `SESSION_SECRET`: your-random-session-key
     - `NODE_ENV`: production

5. **Deploy:**
   - Click "Deploy"
   - Wait for deployment to complete
   - Your app will be live at: `https://your-project.vercel.app`

## 🔧 Post-Deployment Configuration

### Update CORS (if needed)
If you have a separate frontend, add CORS to server.js:
```javascript
const cors = require('cors');
app.use(cors({
  origin: 'https://your-frontend-domain.com',
  credentials: true
}));
```

### Environment Variables to Set:
- `JWT_SECRET` - Strong random string (32+ characters)
- `SESSION_SECRET` - Strong random string (32+ characters)  
- `NODE_ENV` - Set to "production"

## ⚡ Quick Deploy Commands

```bash
# First time deployment
vercel

# Deploy to production
vercel --prod

# Check deployment status
vercel ls

# View logs
vercel logs YOUR_DEPLOYMENT_URL
```

## 🗄️ Migrate to Database (Recommended)

For production use, replace in-memory storage:

### MongoDB Atlas (Free Tier Available)

1. **Install MongoDB driver:**
   ```bash
   npm install mongodb mongoose
   ```

2. **Create MongoDB Atlas account:**
   - Visit https://www.mongodb.com/cloud/atlas
   - Create free cluster
   - Get connection string

3. **Add to Vercel Environment:**
   ```bash
   vercel env add MONGODB_URI
   # Paste your MongoDB connection string
   ```

4. **Update utils/database.js** to use MongoDB instead of Map

### Vercel Postgres (Recommended)

1. **Enable Postgres in Vercel:**
   - Go to your project in Vercel Dashboard
   - Click "Storage" → "Create Database"
   - Choose "Postgres"

2. **Install Postgres client:**
   ```bash
   npm install @vercel/postgres
   ```

3. **Environment variables are auto-added**

## 🔐 Security Checklist for Production

- [ ] Use strong JWT_SECRET and SESSION_SECRET
- [ ] Enable HTTPS only (Vercel does this automatically)
- [ ] Set secure cookie options
- [ ] Implement rate limiting
- [ ] Add database with encryption at rest
- [ ] Enable audit logging
- [ ] Set up monitoring and alerts
- [ ] Implement backup strategy
- [ ] Add CSRF protection
- [ ] Configure proper CORS

## 📊 Monitoring

View logs in real-time:
```bash
vercel logs --follow
```

Or in Vercel Dashboard:
- Go to your project
- Click "Deployments"
- Click on a deployment
- View "Runtime Logs"

## 🐛 Troubleshooting

### Deployment fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in package.json
- Verify Node.js version compatibility

### Environment variables not working
- Redeploy after adding env vars: `vercel --prod`
- Check they're set for the right environment (Production/Preview)

### 500 errors
- Check runtime logs: `vercel logs`
- Verify all required env vars are set
- Check for missing dependencies

### Data not persisting
- This is expected with in-memory storage
- Migrate to database for persistence

## 🌐 Custom Domain

1. **Go to Project Settings → Domains**
2. **Add your domain**
3. **Configure DNS** as instructed
4. **Wait for SSL certificate** (automatic)

## 📞 Support

- Vercel Docs: https://vercel.com/docs
- Vercel Discord: https://vercel.com/discord
- GitHub Issues: (your repo)

---

**Remember**: This deployment uses in-memory storage. For production, migrate to a database!
