import { Request, Response } from 'express';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Generic API function for making HTTP requests using Node.js built-in modules
 */
export function api<T = any>(
  url: string,
  options: ApiOptions = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const https = (globalThis as any).require?.('https') || require('https');
    const http = (globalThis as any).require?.('http') || require('http');
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const requestOptions: any = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };
    
    if (options.body) {
      requestOptions.headers['Content-Length'] = (globalThis as any).Buffer?.byteLength(options.body).toString();
    }
    
    const req = lib.request(requestOptions, (res: any) => {
      let data = '';
      
      res.on('data', (chunk: any) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const contentType = res.headers['content-type'];
          
          if (contentType && contentType.includes('application/json')) {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } else {
            resolve(data as T);
          }
        } catch (parseError) {
          console.error('Failed to parse response:', parseError);
          reject(new Error('Failed to parse response'));
        }
      });
      
      res.on('error', (error: any) => {
        console.error('Request failed:', error);
        reject(error);
      });
    });
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.on('error', (error: any) => {
      console.error('Request setup failed:', error);
      reject(error);
    });
    
    req.end();
  });
}
