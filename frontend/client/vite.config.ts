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
    sourcemap: false, // Disable sourcemaps for production to reduce bundle size
    minify: 'esbuild', // Use esbuild for faster builds (built into Vite)
    chunkSizeWarningLimit: 1500,
    target: 'es2015',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Simplified chunking to avoid circular dependencies
          if (id.includes('node_modules')) {
            // Exceljs is very large, keep it separate
            if (id.includes('exceljs')) {
              return 'vendor-excel';
            }
            // Charts libraries
            if (id.includes('chart.js') || id.includes('recharts')) {
              return 'vendor-charts';
            }
            // Framer motion
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            // Everything else in node_modules goes to vendor to avoid circular deps
            return 'vendor';
          }
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Optimize for production
    cssCodeSplit: true,
    reportCompressedSize: false,
    // Enable build optimizations
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: []
  }
});
