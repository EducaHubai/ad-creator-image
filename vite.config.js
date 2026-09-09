import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['read-excel-file/browser'],
  },
  // En dev, /api lo atiende server.js (npm run server) — mismo origen que en
  // producción, donde server.js sirve también los estáticos.
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
