# Vercel Deployment Guide

## Environment Variables Required

When deploying to Vercel, add these environment variables in the Vercel dashboard:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/zero-trust-workspace
JWT_SECRET=generate-a-random-string-at-least-32-characters-long
SESSION_SECRET=generate-another-random-string-at-least-32-characters-long
NODE_ENV=production
```

## MongoDB Atlas Setup (Required for Vercel)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a free cluster (M0)
4. Database Access → Add Database User (username + password)
5. Network Access → Add IP Address → **Allow Access from Anywhere** (0.0.0.0/0)
6. Connect → Connect your application → Copy connection string
7. Replace `<password>` with your actual password

## How to Add Environment Variables in Vercel

1. Go to your project in Vercel dashboard
2. Settings → Environment Variables
3. Add each variable:
   - Name: `MONGODB_URI`
   - Value: Your MongoDB Atlas connection string
   - Environment: Production, Preview, Development (select all)
4. Click "Save"
5. Repeat for all variables

## Generate Secure Secrets

Use this in PowerShell to generate random secrets:

```powershell
# Generate JWT_SECRET
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})

# Generate SESSION_SECRET
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

## Deploy Steps

1. Push code to GitHub (already done ✅)
2. Go to https://vercel.com/new
3. Import your repository: `joshuakarthik2005/ZeroTrust`
4. Add environment variables (see above)
5. Click "Deploy"

## Post-Deployment

After deployment:
- Your app will be at: `https://your-project.vercel.app`
- Test all features
- Update any hardcoded URLs if needed

## Troubleshooting

**Error: Cannot connect to MongoDB**
- Check MongoDB Atlas Network Access allows 0.0.0.0/0
- Verify connection string is correct
- Ensure password doesn't contain special characters (use URL encoding)

**Error: JWT/Session issues**
- Verify all environment variables are set
- Redeploy after adding variables
