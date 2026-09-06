import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { geo } from './scripts/geo-plugin.mjs';

// BASE_PATH — шлях, з якога аддаецца сайт: па змаўчанні і ў CI (уласны дамен на GitHub Pages) — "/";
// для падтэчкі «<user>.github.io/<рэпазіторый>/» задайце "/<рэпазіторый>/"
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), geo()],
  build: { target: 'es2020', sourcemap: false },
  test: { environment: 'node' },
});
