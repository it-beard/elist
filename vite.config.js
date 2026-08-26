import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH задаецца ў CI як "/<назва-рэпазыторыя>/" для GitHub Pages
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  build: { target: 'es2020', sourcemap: false },
  test: { environment: 'node' },
});
