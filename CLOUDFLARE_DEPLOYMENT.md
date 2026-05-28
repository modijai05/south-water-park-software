# Cloudflare Deployment Guide
# South Water Park Ticket Management System
# Base name: thesouthticketmanagement

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Cloudflare Pages (Frontend)                    │  │
│  │    thesouthticketmanagement.pages.dev                  │  │
│  │         React + Vite + Tailwind                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                 │
│                           │ API Requests                    │
│                           ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │       Cloudflare Worker (API Proxy)                   │  │
│  │     CORS • Caching • Security Headers                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                 │
│                           ▼                                 │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            │ Proxy to Backend
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    RENDER (Backend)                         │
│        south-water-park-backend.onrender.com               │
│         Node.js + Express + MongoDB                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ MongoDB Connection
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 MONGODB ATLAS                               │
│              cluster.nckewmo.mongodb.net                    │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Cloudflare Account** - Free tier available
2. **GitHub Repository** - Connected to Cloudflare Pages
3. **Render Account** - Backend hosting (already set up)
4. **MongoDB Atlas** - Database (already configured)

## Step 1: Cloudflare Pages Setup (Frontend)

### 1.1 Connect Repository
1. Go to Cloudflare Dashboard → Pages
2. Click "Create a project"
3. Select "Connect to Git"
4. Choose your repository: `modijai05/south-water-park-software`
5. Configure build settings:
   - **Build command**: `cd frontend/client && npm install && npm run build`
   - **Build output directory**: `frontend/client/dist`
   - **Root directory**: `/`
   - **Node.js version**: 20

### 1.2 Environment Variables
Add these environment variables in Cloudflare Pages:

```
VITE_API_URL=/api
VITE_APP_NAME=South Water Park Ticket Management
VITE_APP_VERSION=1.0.0
VITE_ENVIRONMENT=production
VITE_DEBUG=false
```

### 1.3 Custom Domain (Optional)
1. In Cloudflare Pages → Custom domains
2. Add your custom domain (e.g., `thesouthticketmanagement.com`)
3. Follow DNS instructions provided by Cloudflare

## Step 2: Cloudflare Worker Setup (API Proxy)

### 2.1 Create Worker
1. Go to Cloudflare Dashboard → Workers & Pages
2. Click "Create application"
3. Select "Create Worker"
4. Name: `thesouthticketmanagement-api`
5. Paste the content from `cloudflare-worker.js`

### 2.2 Deploy Worker
1. Click "Deploy"
2. Wait for deployment to complete

### 2.3 Configure Routes
1. Go to Worker Settings → Triggers → Routes
2. Add custom route: `thesouthticketmanagement.pages.dev/api/*`
3. Save configuration

**Note**: For custom domains, add route: `yourdomain.com/api/*`

## Step 3: Backend CORS Configuration

### 3.1 Update Render Environment Variables
1. Go to Render Dashboard → south-water-park-backend
2. Environment variables
3. Update `CLIENT_URL`: `https://thesouthticketmanagement.pages.dev`

### 3.2 Update Backend Code (if needed)
Ensure your Express server has proper CORS configuration:

```javascript
const cors = require('cors');

app.use(cors({
  origin: [
    'https://thesouthticketmanagement.pages.dev',
    'https://your-custom-domain.com'
  ],
  credentials: true
}));
```

## Step 4: MongoDB Configuration

### 4.1 MongoDB Atlas Setup (Already Configured)
Your MongoDB connection string is already configured in Render:
```
mongodb+srv://jaimodi05bapa_db_user:SgKNnsz19WTuvHp3@cluster.nckewmo.mongodb.net/?appName=Cluster
```

### 4.2 Cloudflare Access (Optional Enhancement)
For enhanced security, you can:
1. Set up Cloudflare Access for MongoDB Atlas
2. Create Zero Trust network policies
3. Restrict access to only Render IP addresses

## Step 5: DNS Configuration (Custom Domain)

### 5.1 Cloudflare DNS Setup
1. Add your domain to Cloudflare
2. Update nameservers at your domain registrar
3. Wait for DNS propagation (up to 48 hours)

### 5.2 DNS Records
```
Type: A
Name: @
IPv4 address: (Cloudflare will assign)
Proxy status: Proxied (orange cloud)

Type: CNAME
Name: www
Target: thesouthticketmanagement.pages.dev
Proxy status: Proxied (orange cloud)
```

## File Structure

```
d:/south-water-park-software/
├── _headers                      # Cloudflare Pages security headers
├── _redirects                    # SPA routing and API proxy rules
├── cloudflare-worker.js          # Cloudflare Worker for API routing
├── wrangler.toml                 # Cloudflare Worker configuration
├── frontend/client/
│   ├── .env.production           # Updated for Cloudflare
│   ├── vite.config.ts            # Build configuration
│   └── dist/                     # Build output directory
└── backend/server/
    ├── .env.example             # Updated CLIENT_URL
    └── src/index.js              # Express server
```

## Configuration Files

### _headers
- Security headers (X-Frame-Options, CSP, etc.)
- Cache control for static assets
- CORS headers for API routes

### _redirects
- SPA routing (all routes → index.html)
- API proxy (/api/* → Render backend)

### cloudflare-worker.js
- CORS handling
- Request forwarding to Render backend
- Error handling and caching
- Security headers

### wrangler.toml
- Cloudflare Worker configuration
- Environment variables
- KV/D1 bindings (optional for caching)

## Deployment Commands

### Local Testing
```bash
# Frontend
cd frontend/client
npm run build
npm run preview

# Backend
cd backend/server
npm run dev
```

### Cloudflare Deployment
```bash
# Deploy Worker (requires Wrangler CLI)
npm install -g wrangler
wrangler login
wrangler deploy

# Pages deployment is automatic via Git push
git push origin main
```

## Monitoring and Debugging

### Cloudflare Analytics
- View traffic analytics in Cloudflare Dashboard
- Monitor API request patterns
- Check cache hit rates

### Worker Logs
```bash
wrangler tail
```

### Render Logs
- View logs in Render Dashboard
- Monitor backend performance
- Check MongoDB connection status

## Security Considerations

1. **CORS Configuration**: Only allow your Cloudflare Pages domain
2. **API Rate Limiting**: Implement in Cloudflare Worker
3. **MongoDB Security**: Use IP whitelisting via Cloudflare Access
4. **HTTPS Only**: All connections are encrypted
5. **Environment Variables**: Never commit secrets to Git

## Performance Optimization

1. **Static Asset Caching**: Long cache duration for JS/CSS
2. **API Response Caching**: 60s browser, 300s edge cache
3. **Image Optimization**: Use Cloudflare Images (optional)
4. **Code Splitting**: Already configured in Vite
5. **Minification**: Enabled in production build

## Troubleshooting

### Common Issues

**API Requests Failing**
- Check Worker routes configuration
- Verify CORS headers in Worker
- Ensure backend is running on Render

**Build Failures**
- Check build logs in Cloudflare Pages
- Verify Node.js version compatibility
- Ensure all dependencies are installable

**MongoDB Connection Issues**
- Verify connection string in Render environment
- Check MongoDB Atlas IP whitelist
- Ensure Render can reach MongoDB

**SPA Routing Issues**
- Verify _redirects file configuration
- Check that all routes use client-side routing
- Ensure index.html is served for all routes

## Cost Analysis

### Cloudflare Free Tier
- Pages: Unlimited
- Workers: 100,000 requests/day
- KV: 100,000 reads/day, 1,000 writes/day
- D1: 5GB storage, 25M rows read/day

### Render Free Tier
- Web Service: Free with spin-down
- Database: MongoDB Atlas free tier

### MongoDB Atlas Free Tier
- 512MB storage
- Shared RAM
- Good for development/small production

**Total Cost**: $0/month (using free tiers)

## Scaling Considerations

### When to Upgrade
1. **Cloudflare Workers**: > 100,000 requests/day
2. **Render**: Need persistent backend (no spin-down)
3. **MongoDB**: > 512MB storage or better performance

### Upgrade Path
1. Cloudflare Workers Paid: $5/month for 10M requests
2. Render Standard: $7/month for persistent backend
3. MongoDB Atlas Shared: $9/month for better performance

## Support and Maintenance

### Regular Tasks
- Monitor Cloudflare analytics
- Check Render backend logs
- Review MongoDB storage usage
- Update dependencies monthly

### Emergency Contacts
- Cloudflare Support: https://www.cloudflare.com/contact/
- Render Support: https://render.com/support
- MongoDB Support: https://www.mongodb.com/contact

## Backup and Recovery

### Database Backups
- MongoDB Atlas automatic backups (paid tier)
- Export data regularly using MongoDB Atlas UI
- Keep backups in separate location

### Code Backups
- Git repository serves as backup
- Tag releases for easy rollback
- Document configuration changes

---

**Deployment Status**: Configuration complete, ready for Cloudflare Pages deployment

**Next Steps**:
1. Deploy frontend to Cloudflare Pages
2. Deploy Cloudflare Worker
3. Update Render environment variables
4. Test full application flow
5. Configure custom domain (optional)

**Documentation Version**: 1.0  
**Last Updated**: 2026-05-29