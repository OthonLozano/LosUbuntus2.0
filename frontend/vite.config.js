import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // En desarrollo, todo lo que empiece con /api se manda al backend (FastAPI).
    // Así el frontend llama a "/api/..." igual que cuando el backend lo sirva
    // en el despliegue, y no hace falta configurar CORS.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
