import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      strictPort: true,
      host: '0.0.0.0',
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
    },
    plugins: [
      react(),
      VitePWA({
        // For admin portal: self-destruct the service worker so old cached JS can't persist.
        // Admins are always online, no need for offline caching.
        selfDestroying: (env.VITE_APP_TARGET || process.env.VITE_APP_TARGET) === 'admin',
        filename: (env.VITE_APP_TARGET || process.env.VITE_APP_TARGET) === 'admin' ? 'sw-v2.js' : 'sw.js',
        registerType: 'autoUpdate',
        devOptions: {
          enabled: false
        },
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'HR Security Portal',
          short_name: 'HR Portal',
          description: 'Security Personnel & HR Management System',
          theme_color: '#1e3a8a',
          background_color: '#f3f4f6',
          display: 'standalone',
          scope: '/',
          start_url: '/',
          orientation: 'portrait',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MB
          skipWaiting: true,
          clientsClaim: true,
          navigateFallbackDenylist: [
            /^\/ads\.txt$/,
            /^\/robots\.txt$/,
            /^\/sitemap\.xml$/,
            /^\/llms\.txt$/,
            /^\/google8aaac7081881f131\.html$/,
            /^\/UDF_Brochure\.pdf$/,
            /^\/__\/.*$/
          ],
        }
      })
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      outDir: (env.VITE_APP_TARGET || process.env.VITE_APP_TARGET) === 'admin' 
        ? 'dist-admin' 
        : (env.VITE_APP_TARGET || process.env.VITE_APP_TARGET) === 'employee' 
          ? 'dist-employee' 
          : (env.VITE_APP_TARGET || process.env.VITE_APP_TARGET) === 'public'
            ? 'dist-public'
            : 'dist',
      rollupOptions: {
        output: {
          manualChunks: {
            'firebase-core': ['firebase/app', 'firebase/auth'],
            'firebase-services': ['firebase/firestore', 'firebase/storage', 'firebase/functions'],
            'vendor-ui': ['lucide-react'],
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-excel': ['xlsx'],
            'vendor-pdf': ['pdf-lib', 'pdfjs-dist'],
          }
        }
      },
      chunkSizeWarningLimit: 600,
    }
  };
});
