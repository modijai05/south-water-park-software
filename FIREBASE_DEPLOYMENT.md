# Firebase Deployment Guide - South Water Park

## 🚀 Overview
This guide covers deploying both the frontend and backend of the South Water Park management system to Firebase.

## 📋 Prerequisites
1. **Firebase Account**: Create a Firebase account at https://console.firebase.google.com
2. **Firebase CLI**: Already installed (`npm install -g firebase-tools`)
3. **Google Account**: Logged in (`firebase login`)

## 🏗️ Project Setup

### 1. Create Firebase Projects
Go to [Firebase Console](https://console.firebase.google.com) and create two projects:

1. **Frontend Project**: `south-water-park-frontend`
   - Enable: Hosting
   - Location: Choose nearest region

2. **Backend Project**: `south-water-park-backend`
   - Enable: Functions, Firestore (for data if needed)
   - Location: Same region as frontend

### 2. Configure Environment Variables

#### Backend (Firebase Functions)
In Firebase Console → Project Settings → Functions → Environment Variables:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/south_water_park
JWT_SECRET=your-super-secret-jwt-key
NODE_ENV=production
```

## 📱 Frontend Deployment

### Option 1: Using Deployment Script
```bash
# Windows
.\deploy-firebase.bat

# Linux/Mac
./deploy-firebase.sh
```

### Option 2: Manual Deployment
```bash
cd frontend/client
npm run build
firebase deploy --only hosting --project south-water-park-frontend
```

## 🔧 Backend Deployment

### Option 1: Using Deployment Script
Included in the main deployment script above.

### Option 2: Manual Deployment
```bash
cd backend/server/functions
npm install
firebase deploy --only functions --project south-water-park-backend
```

## 🌐 Access URLs After Deployment

- **Frontend**: https://south-water-park-frontend.web.app
- **Backend API**: https://south-water-park-backend.cloudfunctions.net/api

## 🔄 Environment Configuration

### Frontend API URL
Update the frontend to use the deployed backend URL:

1. In `frontend/client/src/lib/api.ts` or similar:
```typescript
const API_BASE_URL = 'https://south-water-park-backend.cloudfunctions.net/api';
```

2. Or use environment variables:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
```

### CORS Configuration
The backend functions already include CORS configuration for Firebase hosting.

## 📊 Database Setup

### MongoDB Atlas (Recommended)
1. Create a free MongoDB Atlas account
2. Create a cluster
3. Get the connection string
4. Add to Firebase Functions environment variables

### Alternative: Firebase Firestore
Replace MongoDB with Firestore if preferred:
- Update models to use Firestore
- Modify queries to use Firestore syntax

## 🔍 Testing Deployment

### 1. Frontend Tests
```bash
cd frontend/client
npm run build
npm run preview
```

### 2. Backend Tests
```bash
cd backend/server/functions
firebase emulators:start
```

## 🚨 Troubleshooting

### Common Issues

1. **Build Size Warning**
   - Already optimized with manual chunks in vite.config.ts
   - Can be ignored for now

2. **Function Timeout**
   - Increase timeout in firebase.json:
   ```json
   "functions": {
     "timeoutSeconds": 540
   }
   ```

3. **CORS Issues**
   - Ensure CORS is properly configured in functions/index.js
   - Check Firebase Functions CORS settings

4. **Database Connection**
   - Verify MongoDB connection string
   - Check network access in MongoDB Atlas
   - Ensure environment variables are set

## 📝 Deployment Commands Summary

```bash
# Frontend
cd frontend/client
npm run build
firebase deploy --only hosting --project south-water-park-frontend

# Backend
cd backend/server/functions  
npm install
firebase deploy --only functions --project south-water-park-backend

# Both (using script)
.\deploy-firebase.bat  # Windows
./deploy-firebase.sh    # Linux/Mac
```

## 🔄 CI/CD Setup (Optional)

### GitHub Actions
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Firebase
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Deploy Frontend
        run: |
          cd frontend/client
          npm ci
          npm run build
          npx firebase-tools deploy --only hosting --project south-water-park-frontend
      - name: Deploy Backend
        run: |
          cd backend/server/functions
          npm ci
          npx firebase-tools deploy --only functions --project south-water-park-backend
```

## 📞 Support

For issues:
1. Check Firebase Console logs
2. Review function logs in Firebase Console
3. Verify environment variables
4. Test locally with Firebase emulators

---

**Note**: This deployment setup uses Firebase Functions for the backend. For production, consider using Cloud Run or App Engine for better performance and scaling.
