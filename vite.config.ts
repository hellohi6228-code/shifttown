import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative paths: works at a domain root, under GitHub Pages' /shifttown/, and inside Capacitor.
  base: './',
  plugins: [react(), tailwindcss()],
  server: { port: 5173, host: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 700 },
})
