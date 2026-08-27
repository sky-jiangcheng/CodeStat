import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
    rollupOptions: {
      output: {
        // Ensure each page becomes its own chunk so lazy-loaded navigation
        // only fetches the code needed for the destination route.
        manualChunks(id) {
          if (id.includes('src/pages/Dashboard')) return 'dashboard'
          if (id.includes('src/pages/Knowledge')) return 'knowledge'
          if (id.includes('src/pages/ProjectDetail')) return 'projectDetail'
          if (id.includes('src/pages/Settings')) return 'settings'
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
    env: {
      NODE_ENV: 'development',
    },
  },
})
