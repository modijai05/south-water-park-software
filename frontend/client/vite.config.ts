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
    outDir: '../../dist',
    sourcemap: true,
    minify: 'esbuild',
    chunkSizeWarningLimit: 1500,
    target: 'es2015',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          charts: ['chart.js', 'react-chartjs-2', 'recharts'],
          utils: ['date-fns', 'dayjs'],
          motion: ['framer-motion'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          export: ['exceljs']
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Optimize for production
    cssCodeSplit: true,
    reportCompressedSize: false
  }
});
