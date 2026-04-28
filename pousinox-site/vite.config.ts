import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  test: {
    environment: 'node',
  },
  plugins: [react()],
  optimizeDeps: {
    include: ['qrcode'],
  },
  base: '/',
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api/brasilapi': {
        target: 'https://brasilapi.com.br',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/brasilapi/, ''),
      },
    },
  },
})
