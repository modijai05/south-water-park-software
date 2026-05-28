# Cloudflare Pages Deployment Guide

## Quick Setup

This repository is configured for Cloudflare Pages deployment with the following settings:

### Build Configuration
- **Build command**: `cd frontend/client && npm install && npm run build`
- **Build output directory**: `frontend/client/dist`
- **Root directory**: `/`
- **Node.js version**: 20

### Environment Variables
```
VITE_API_URL=https://south-water-park-backend.onrender.com/api
VITE_APP_NAME=South Water Park Ticket Management
VITE_ENVIRONMENT=production
```

### Important Notes
- This configuration is for Cloudflare Pages ONLY
- Cloudflare Workers should be deployed separately if needed
- The _redirects file handles API proxying to the backend
- The _headers file provides security headers

## Deployment Steps

1. Connect your GitHub repository to Cloudflare Pages
2. Use the build configuration above
3. Add the environment variables
4. Deploy

## Troubleshooting

If you encounter wrangler-related errors, ensure that:
- No custom deploy command is configured in Cloudflare Pages settings
- The build command is set to the frontend build only
- No wrangler.toml files are present in the repository