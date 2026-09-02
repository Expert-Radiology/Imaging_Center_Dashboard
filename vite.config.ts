import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In production the API and the built frontend are the same container.
// Locally, run the API with `cd api && npm run dev` (port 8080) and Vite
// proxies to it; without it the app falls back to its bundled snapshot.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
