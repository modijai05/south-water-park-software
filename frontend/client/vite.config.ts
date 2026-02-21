import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: { 
    port: 5174, 
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
    hmr: {
      overlay: false
    }
  },
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          charts: ['chart.js', 'react-chartjs-2'],
          utils: ['date-fns', 'dayjs']
        }
      }
    }
  }
});
