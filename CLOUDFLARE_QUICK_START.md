# Cloudflare Deployment Quick Start
# South Water Park Ticket Management System

## Pre-Deployment Checklist ✅

- [ ] Cloudflare account created
- [ ] GitHub repository connected to Cloudflare
- [ ] Backend running on Render (south-water-park-backend.onrender.com)
- [ ] MongoDB Atlas configured
- [ ] Configuration files updated (_headers, _redirects, cloudflare-worker.js)

## 5-Minute Deployment Guide

### Step 1: Deploy Frontend to Cloudflare Pages (2 minutes)
1. Go to: https://dash.cloudflare.com/
2. Navigate to: Pages → Create a project
3. Click: "Connect to Git"
4. Select: `modijai05/south-water-park-software`
5. Configure:
   - **Build command**: `cd frontend/client && npm install && npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`
6. Add environment variables:
   ```
   VITE_API_URL=/api
   VITE_APP_NAME=South Water Park Ticket Management
   VITE_ENVIRONMENT=production
   ```
7. Click: "Save and Deploy"

### Step 2: Deploy Cloudflare Worker (2 minutes)
1. Go to: https://dash.cloudflare.com/
2. Navigate to: Workers & Pages → Create application
3. Click: "Create Worker"
4. Name: `thesouthticketmanagement-api`
5. Paste content from `cloudflare-worker.js`
6. Click: "Deploy"
7. Add route: `thesouthticketmanagement.pages.dev/api/*`
8. Save configuration

### Step 3: Update Backend CORS (1 minute)
1. Go to: https://dashboard.render.com/
2. Navigate to: south-water-park-backend → Environment
3. Update `CLIENT_URL`: `https://thesouthticketmanagement.pages.dev`
4. Save changes (automatic redeploy)

## Verification

### Test Frontend
```
URL: https://thesouthticketmanagement.pages.dev
Expected: South Water Park Ticket Management loads
```

### Test API Proxy
```
URL: https://thesouthticketmanagement.pages.dev/api
Expected: Backend API response
```

### Test Backend
```
URL: https://south-water-park-backend.onrender.com/api
Expected: Backend API response
```

## Custom Domain Setup (Optional)

### Add Custom Domain
1. Cloudflare Pages → Custom domains
2. Click "Set up a custom domain"
3. Enter: `thesouthticketmanagement.com`
4. Follow DNS instructions
5. Update Worker route to: `thesouthticketmanagement.com/api/*`

### Update CORS
1. Render Dashboard → south-water-park-backend → Environment
2. Add custom domain to allowed origins
3. Save changes

## Troubleshooting

### Frontend Not Loading
- Check Cloudflare Pages build logs
- Verify build command is correct
- Ensure dist directory exists

### API Requests Failing
- Verify Worker route configuration
- Check Worker logs for errors
- Ensure backend is running on Render

### CORS Errors
- Update CLIENT_URL in Render environment
- Check Worker CORS headers
- Verify domain matches exactly

## Success Criteria

✅ Frontend loads at Cloudflare Pages URL  
✅ API requests proxied through Cloudflare Worker  
✅ Backend responds correctly  
✅ MongoDB connection stable  
✅ No CORS errors in browser console  

## Need Help?

- **Full Documentation**: See `CLOUDFLARE_DEPLOYMENT.md`
- **Cloudflare Support**: https://www.cloudflare.com/contact/
- **Render Support**: https://render.com/support

---

**Quick Start Version**: 1.0  
**Deployment Time**: ~5 minutes  
**Total Cost**: $0/month (free tiers)