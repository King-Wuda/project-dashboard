import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8787' } },
  test: { root: '.', include: ['web/src/**/*.test.ts', 'server/**/*.test.mjs'] },
});
