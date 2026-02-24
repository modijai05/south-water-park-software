@echo off
echo 🚀 South Water Park - Professional Deployment Script
echo ================================================

echo.
echo 📋 Step 1: Building Backend...
cd backend/server
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Backend build failed!
    pause
    exit /b 1
)
echo ✅ Backend built successfully

echo.
echo 📋 Step 2: Building Frontend...
cd ../../frontend/client
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Frontend build failed!
    pause
    exit /b 1
)
echo ✅ Frontend built successfully

echo.
echo 📋 Step 3: Committing changes...
cd ../../..
git add .
git commit -m "Professional authentication fixes and deployment ready - %date% %time%"
if %errorlevel% neq 0 (
    echo ❌ Git commit failed!
    pause
    exit /b 1
)
echo ✅ Changes committed successfully

echo.
echo 📋 Step 4: Pushing to GitHub...
git push origin main
if %errorlevel% neq 0 (
    echo ❌ Git push failed!
    pause
    exit /b 1
)
echo ✅ Code pushed to GitHub successfully

echo.
echo 🎉 Deployment Ready!
echo ================================================
echo ✅ Backend: Will auto-deploy to Render
echo ✅ Frontend: Deploy to Netlify manually
echo.
echo 📝 Next Steps:
echo 1. Configure environment variables in Render dashboard
echo 2. Deploy frontend to Netlify
echo 3. Test authentication at your deployed URL
echo.
echo 🔗 Important URLs:
echo - Render Dashboard: https://dashboard.render.com
echo - Netlify: https://app.netlify.com
echo - MongoDB Atlas: https://cloud.mongodb.com
echo.
pause
