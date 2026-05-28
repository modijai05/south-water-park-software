// Cloudflare Worker for API Routing and Optimization
// South Water Park Ticket Management System
// Base name: thesouthticketmanagement

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API routing
    if (url.pathname.startsWith('/api/')) {
      const backendUrl = 'https://south-water-park-backend.onrender.com' + url.pathname + url.search;
      
      // Clone request and add headers
      const modifiedRequest = new Request(backendUrl, request);
      modifiedRequest.headers.set('X-Forwarded-Host', url.hostname);
      modifiedRequest.headers.set('X-Real-IP', request.headers.get('CF-Connecting-IP') || 'unknown');
      modifiedRequest.headers.set('X-Forwarded-Proto', url.protocol);
      
      try {
        const response = await fetch(modifiedRequest);
        
        // Clone response to modify headers
        const modifiedResponse = new Response(response.body, response);
        
        // Add CORS headers
        Object.entries(corsHeaders).forEach(([key, value]) => {
          modifiedResponse.headers.set(key, value);
        });
        
        // Cache successful GET requests
        if (request.method === 'GET' && response.ok) {
          modifiedResponse.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');
        }
        
        return modifiedResponse;
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Backend service unavailable', message: error.message }),
          { 
            status: 503, 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            } 
          }
        );
      }
    }

    // Static assets and SPA - let Cloudflare Pages handle
    return fetch(request);
  }
};