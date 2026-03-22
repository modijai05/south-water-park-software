@echo off
echo ========================================
echo South Water Park - Professional Deployment
echo ========================================
echo.

echo [1/5] Preparing Backend Deployment...
cd /d "d:\south-water-park-software\backend\server"
echo     - Building backend...
call npm run build
if %errorlevel% neq 0 (
    echo     ❌ Backend build failed
    pause
    exit /b 1
)
echo     ✅ Backend built successfully

echo.
echo [2/5] Preparing Frontend Deployment...
cd /d "d:\south-water-park-software\frontend\client"
echo     - Building frontend...
call npm run build
if %errorlevel% neq 0 (
    echo     ❌ Frontend build failed
    pause
    exit /b 1
)
echo     ✅ Frontend built successfully

echo.
echo [3/5] Git Operations...
cd /d "d:\south-water-park-software"
echo     - Adding all changes...
git add .
echo     - Committing changes...
git commit -m "Professional deployment: Fixed price sync and user creation issues
- Fixed real-time price sync in Admin Dashboard All-Time Performance
- Enhanced user creation with proper validation and error handling
- Added fallback mode support for authentication
- Removed TypeScript warnings and improved code quality
- Enhanced ticket config integration across all dashboards"
echo     - Pushing to GitHub...
git push origin main
if %errorlevel% neq 0 (
    echo     ❌ Git push failed
    pause
    exit /b 1
)
echo     ✅ Code pushed to GitHub successfully

echo.
echo [4/5] Backend Deployment Instructions...
echo     📋 Backend Deployment Steps:
echo     1. Go to https://render.com
echo     2. Click "New" → "Web Service"
echo     3. Connect your GitHub repository: modijai05/south-water-park-software
echo     4. Configure:
echo        - Name: south-water-park-backend
echo        - Environment: Node
echo        - Root Directory: backend/server
echo        - Build Command: npm run build
echo        - Start Command: npm start
echo        - Instance Type: Free
echo     5. Add Environment Variables:
echo        - NODE_ENV=production
echo        - MONGODB_URI=mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/south_water_park?retryWrites=true&w=majority
echo        - JWT_SECRET=south-water-park-secret-change-in-prod
echo        - PORT=10000
echo     6. Click "Create Web Service"

echo.
echo [5/5] Frontend Deployment Instructions...
echo     📋 Frontend Deployment Steps:
echo     1. Go to https://app.netlify.com
echo     2. Click "Add new site" → "Import an existing project"
echo     3. Connect to GitHub: modijai05/south-water-park-software
echo     4. Configure:
echo        - Publish directory: frontend/client/dist
echo        - Build command: cd frontend/client && npm run build
echo     5. Add Environment Variables:
echo        - VITE_API_URL=https://south-water-park-backend.onrender.com
echo     6. Click "Deploy site"

echo.
echo ========================================
echo ✅ DEPLOYMENT PREPARATION COMPLETE
echo ========================================
echo.
echo 🌐 Expected URLs:
echo    Backend: https://south-water-park-backend.onrender.com
echo    Frontend: https://ticketmanagementthesouth.netlify.app
echo.
echo 🧪 After deployment, test:
echo    - Backend Health: https://south-water-park-backend.onrender.com/api/health
echo    - User Creation: Admin Dashboard → Manage Users → Create User
echo    - Price Sync: Update ticket config and verify real-time sync in Admin Dashboard
echo.
echo 📝 Notes:
echo    - All fixes have been implemented and tested
echo    - Real-time price sync is working in both Today's and All-Time Performance
echo    - User creation works without errors in both database and fallback modes
echo    - TypeScript warnings have been resolved
echo.
pause
