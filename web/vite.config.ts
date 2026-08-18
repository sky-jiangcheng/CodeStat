import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Do NOT auto-inject the SW registration script into index.html.
      // In a Wails WebView (desktop app) the service worker hijacks
      // navigation and causes a white screen on Intel Macs where WKWebView's
      // SW support is unreliable. We register the SW manually in main.tsx
      // only when running in a real browser (not inside Wails).
      injectRegister: false,
      devOptions: {
        enabled: true,
      },
      includeAssets: ['favicon.svg', 'favicon.ico'],
      manifest: {
        name: 'GitBuddy',
        short_name: 'GitBuddy',
        description: 'Git 代码提交统计面板 - 自动发现本地项目并可视化展示提交量',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        categories: ['developer tools', 'productivity', 'git'],
        shortcuts: [
          {
            name: '知识库',
            url: '/knowledge',
            icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: '仪表盘',
            url: '/dashboard',
            icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        screenshots: [
          {
            src: '/screenshot-desktop.png',
            sizes: '1280x800',
            type: 'image/png',
            form_factor: 'wide',
          },
          {
            src: '/screenshot-mobile.png',
            sizes: '750x1334',
            type: 'image/png',
            form_factor: 'narrow',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // Use index.html as the SPA fallback (there is no offline.html).
        navigateFallback: '/index.html',
        // Never let the SW intercept API requests that should go to the
        // backend — the NetworkFirst route below already handles /api, but
        // this denylist prevents the navigateFallback from catching
        // /api/* paths when the network fails.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:18731',
        changeOrigin: true,
      },
    },
    allowedHosts: ['.monkeycode-ai.online'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
