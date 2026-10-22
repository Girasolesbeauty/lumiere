import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Commit de esta version de las pantallas (Vercel lo da al armar): se compara con el del servidor
  define: { __COMMIT__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || '') },
})
