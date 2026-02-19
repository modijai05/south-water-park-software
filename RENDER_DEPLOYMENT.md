# Render Deployment Guide - South Water Park Backend

## 🚀 Overview
This guide covers deploying the South Water Park backend to Render and connecting it with the Netlify frontend.

## 📋 Prerequisites
1. **Render Account**: Create a free account at https://render.com
2. **MongoDB Database**: MongoDB Atlas cluster (recommended)
3. **GitHub Repository**: Backend code pushed to GitHub

## 🏗️ Step 1: Prepare MongoDB

### MongoDB Atlas Setup (Recommended)
1. Go to https://cloud.mongodb.com
2. Create a free cluster
3. Create a database user with password
4. Get the connection string
5. Add your IP to the whitelist (or use 0.0.0.0/0 for all IPs)

**Connection String Format:**
```
mongodb+srv://username:password@cluster.mongodb.net/south_water_park
```

## 🔧 Step 2: Deploy to Render

### Option 1: Using GitHub Integration
1. Push backend code to GitHub
2. Go to Render Dashboard → New → Web Service
3. Connect your GitHub repository
4. Configure settings:
   - **Name**: `south-water-park-backend`
   - **Environment**: Node
   - **Region**: Choose nearest region
   - **Branch**: `main`
   - **Root Directory**: `backend/server`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

### Option 2: Manual Deployment
1. Create a new Web Service on Render
2. Upload your code or connect Git
3. Use the same configuration as above

## ⚙️ Step 3: Environment Variables

In Render Dashboard → Your Service → Environment, add:

```bash
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/south_water_park
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=10000
```

## 🔗 Step 4: Connect Frontend to Backend

### Update Frontend Environment
The frontend is already configured to connect to the Render backend via:
- **File**: `frontend/client/.env.production`
- **Content**: `VITE_API_URL=https://south-water-park-backend.onrender.com/api`

### Deploy Updated Frontend
```bash
cd frontend/client
npm run build
netlify deploy --prod --dir=dist
```

## 🌐 Step 5: Final URLs

After deployment:
- **Backend**: https://south-water-park-backend.onrender.com
- **Frontend**: https://ticketmanagementthesouth.netlify.app
- **Health Check**: https://south-water-park-backend.onrender.com/api/health

## 🔍 Step 6: Test the Connection

### 1. Test Backend Health
```bash
curl https://south-water-park-backend.onrender.com/api/health
```

### 2. Test Frontend-Backend Connection
1. Open https://ticketmanagementthesouth.netlify.app
2. Try to login with admin credentials
3. Check browser network tab for API calls

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Backend CORS already configured for Netlify frontend
   - Check environment variables in Render

2. **Database Connection**
   - Verify MongoDB connection string
   - Check MongoDB Atlas IP whitelist
   - Ensure database user has correct permissions

3. **Build Failures**
   - Check Render build logs
   - Ensure all dependencies are in package.json
   - Verify TypeScript compilation

4. **Timeout Issues**
   - Render free tier has 15-second timeout
   - Optimize database queries
   - Consider upgrading to paid tier for production

5. **Environment Variables**
   - Ensure all required variables are set
   - Check for typos in variable names
   - Restart service after adding variables

## 📊 Monitoring

### Render Dashboard Features
- **Metrics**: CPU, Memory, Response times
- **Logs**: Real-time application logs
- **Events**: Deployments, restarts, errors
- **Health Checks**: Automatic health monitoring

### Recommended Monitoring
```bash
# Check health endpoint
curl https://south-water-park-backend.onrender.com/api/health

# Monitor logs in Render Dashboard
# View metrics and alerts
```

## 🔄 CI/CD Setup

### Automatic Deployments
Render offers automatic deployments when you push to GitHub:
1. Connect your GitHub repository
2. Enable auto-deploy for the main branch
3. Every push triggers a new deployment

### Deployment Hook
```bash
# Manual redeployment
curl -X POST https://api.render.com/v1/services/YOUR_SERVICE_ID/deploys \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 🚀 Production Optimization

### Performance Tips
1. **Database Indexing**: Add indexes to frequently queried fields
2. **Caching**: Implement Redis for frequently accessed data
3. **Compression**: Enable gzip compression
4. **CDN**: Use CDN for static assets

### Security Best Practices
1. **Environment Variables**: Never commit secrets to Git
2. **HTTPS**: Always use HTTPS (Render provides this)
3. **Rate Limiting**: Already implemented in backend
4. **Input Validation**: Already implemented with Zod

## 📞 Support

### Render Documentation
- https://render.com/docs
- https://render.com/docs/node-serve

### MongoDB Atlas Documentation
- https://docs.mongodb.com/manual/cloud/atlas/

### Debug Commands
```bash
# Test backend locally
cd backend/server
npm run dev

# Test production connection
curl -I https://south-water-park-backend.onrender.com/api/health
```

---

**Note**: Render free tier has limitations (15-second timeout, 750 hours/month). For production use, consider upgrading to a paid plan.
