import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { geo } from './scripts/geo-plugin.mjs';

// BASE_PATH задаецца ў CI як "/<назва-рэпазіторыя>/" для GitHub Pages
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), geo()],
  build: { target: 'es2020', sourcemap: false },
  test: { environment: 'node' },
});
