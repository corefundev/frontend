import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    strictPort: true,
    // MIGR-1 (#424): локальная проверка host-routing'а поддоменов
    // (chrome --host-resolver-rules → dev-сервер). Только dev.
    allowedHosts: ['app.localhost', 'sprosly.com', 'news.sprosly.com', 'help.sprosly.com'],
    // Dev proxy: requests to /api in the browser are forwarded to the backend.
    // In production this isn't used — the frontend talks to VITE_API_URL directly.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_PROXY ?? 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    // Split large vendor chunks so the login page loads fast without
    // pulling in recharts/react-query bundles.
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-query':  ['@tanstack/react-query', 'axios'],
          'vendor-charts': ['recharts'],
        },
      },
    },
    sourcemap: false,    // don't leak source maps to prod users
  },
})
