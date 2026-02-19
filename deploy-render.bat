@echo off
echo 🚀 Deploying South Water Park Backend to Render

echo 📋 Prerequisites Check:
echo 1. Make sure backend code is pushed to GitHub
echo 2. Have MongoDB Atlas connection string ready
echo 3. Have Render account created

echo 🔧 Step 1: Build Backend
cd backend\server
call npm run build

echo 📦 Step 2: Deploy to Render
echo 📝 Manual Steps Required:
echo 1. Go to https://render.com
echo 2. Click "New" → "Web Service"
echo 3. Connect your GitHub repository
echo 4. Configure:
echo    - Name: south-water-park-backend
echo    - Environment: Node
echo    - Root Directory: backend/server
echo    - Build Command: npm run build
echo    - Start Command: npm start
echo    - Instance Type: Free
echo 5. Add Environment Variables:
echo    - NODE_ENV=production
echo    - MONGODB_URI=your_mongodb_connection_string
echo    - JWT_SECRET=your-secret-key
echo    - PORT=10000

echo 🌐 Expected Backend URL: https://south-water-park-backend.onrender.com
echo 🔗 Frontend URL: https://ticketmanagementthesouth.netlify.app

echo ✅ After deployment, test:
echo    curl https://south-water-park-backend.onrender.com/api/health

pause
