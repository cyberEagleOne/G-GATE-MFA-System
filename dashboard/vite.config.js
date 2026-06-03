import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5173
  },
  // Memaksa Vite untuk memaketkan library besar sejak awal di laptop
  optimizeDeps: {
    include: ['react-router-dom', 'react-leaflet', 'leaflet']
  }
})
