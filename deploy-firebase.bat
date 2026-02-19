@echo off
echo 🚀 Deploying South Water Park to Firebase

REM Deploy Frontend
echo 📱 Building and deploying frontend...
cd frontend\client
call npm run build
call firebase deploy --only hosting --project south-water-park-frontend

REM Deploy Backend Functions  
echo 🔧 Building and deploying backend functions...
cd ..\..\backend\server\functions
call npm install
call firebase deploy --only functions --project south-water-park-backend

echo ✅ Deployment complete!
echo Frontend: https://south-water-park-frontend.web.app
echo Backend API: https://south-water-park-backend.cloudfunctions.net/api

pause
