import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'RutaRep',
        short_name: 'RutaRep',
        description: 'Gestión de rutas de reparto',
        lang: 'es',
        categories: ['productivity', 'business', 'logistics', 'tools'],
        theme_color: '#0b1320',
        background_color: '#0b1320',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          {
            src: 'screenshot-1.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Ruta del día',
          },
          {
            src: 'screenshot-2.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Historial de entregas',
          },
        ],
      },
      workbox: {
        cacheId: 'rutarep-v2',
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        importScripts: ['/push-sw.js'],
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        globIgnores: ['screenshot-*.png', 'icon-512-maskable.png'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-cache', expiration: { maxEntries: 50, maxAgeSeconds: 300 } },
          },
        ],
      },
    }),
  ],
})
