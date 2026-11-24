import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// The SPA and the API share one origin (in production Caddy routes these paths to Django), so the code uses
// relative URLs. The dev server does the same routing: these paths go to the backend.
const BACKEND_PATHS = ['/api', '/graphql', '/ws', '/media', '/admin', '/static']
const target =
  process.env.API_PROXY_TARGET ||
  loadEnv('development', process.cwd(), '').API_PROXY_TARGET ||
  'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: Object.fromEntries(
      BACKEND_PATHS.map((path) => [path, { target, changeOrigin: true, ws: path === '/ws' }]),
    ),
  },
})
