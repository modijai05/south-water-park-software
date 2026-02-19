#!/bin/bash

echo "🚀 Deploying South Water Park to Firebase"

# Deploy Frontend
echo "📱 Building and deploying frontend..."
cd frontend/client
npm run build
firebase deploy --only hosting --project south-water-park-frontend

# Deploy Backend Functions
echo "🔧 Building and deploying backend functions..."
cd ../../backend/server/functions
npm install
firebase deploy --only functions --project south-water-park-backend

echo "✅ Deployment complete!"
echo "Frontend: https://south-water-park-frontend.web.app"
echo "Backend API: https://south-water-park-backend.cloudfunctions.net/api"
