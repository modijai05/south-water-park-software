@echo off
echo 🚀 South Water Park Backend - Deployment Verification
echo.

echo 📋 Step 1: Checking Render Dashboard
echo 1. Go to https://render.com
echo 2. Navigate to your south-water-park-backend service
echo 3. Check deployment status
echo.

echo 🔍 Step 2: Verify Build Status
echo Expected: Build Success (no TypeScript errors)
echo If failed: Check DEPLOYMENT_TROUBLESHOOTING.md
echo.

echo 🗄️ Step 3: Verify MongoDB Connection
echo Expected: Database connected to MongoDB Atlas
echo Check logs for: "MongoDB connected (persistent) - Production Ready"
echo.

echo ❤️ Step 4: Health Check Test
echo URL: https://south-water-park-api.onrender.com/api/health
echo Expected Response:
echo {
echo   "ok": true,
echo   "database": { "connected": true, ... },
echo   "environment": "production"
echo }
echo.

echo 🔐 Step 5: Authentication Test
echo Command: curl -X POST https://south-water-park-api.onrender.com/api/auth/login ...
echo Expected: JWT token returned
echo.

echo ✅ Step 6: Data Persistence Verification
echo 1. Create a test user via admin panel
echo 2. Restart the service
echo 3. Verify user still exists (no data loss)
echo.

echo 📊 Expected Final Status:
echo ✅ Build: Success
echo ✅ Database: Connected to MongoDB Atlas
echo ✅ Health Check: Passing
echo ✅ Authentication: Working
echo ✅ Data Persistence: Guaranteed
echo ✅ Zero Warnings: Confirmed
echo ✅ Zero Errors: Confirmed
echo.

echo 🚨 If any step fails:
echo 1. Check DEPLOYMENT_TROUBLESHOOTING.md
echo 2. Verify MongoDB Atlas IP whitelist (0.0.0.0/0)
echo 3. Check environment variables in Render dashboard
echo 4. Review build and runtime logs
echo.

echo 🎯 Production URLs:
echo Backend: https://south-water-park-api.onrender.com
echo Health: https://south-water-park-api.onrender.com/api/health
echo.

pause
