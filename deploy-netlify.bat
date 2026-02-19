@echo off
echo 🚀 Deploying South Water Park Frontend to Netlify

cd frontend\client
echo 📱 Building frontend...
call npm run build

echo 🌐 Deploying to Netlify...
call netlify deploy --prod --dir=dist

echo ✅ Deployment complete!
echo 📱 Live URL: https://ticketmanagementthesouth.netlify.app
echo 🔧 Admin URL: https://app.netlify.com/projects/ticketmanagementthesouth

pause
