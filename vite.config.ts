import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // Ver src/mocks/vendor/tough-cookie-lite.ts (remove ~120 KB comprimidos do bundle dos mocks).
      'tough-cookie': path.resolve(import.meta.dirname, './src/mocks/vendor/tough-cookie-lite.ts'),
    },
  },
})
