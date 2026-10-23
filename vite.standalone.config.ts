import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Single-file HTML build: no server, data embedded in the page and kept in the browser. See scripts/build-html.mjs. */
export default defineConfig({
  root: 'web',
  base: './',
  plugins: [react()],
  define: { __STANDALONE__: 'true' },
  build: { outDir: '../dist-html', emptyOutDir: true, assetsInlineLimit: 100_000_000, cssCodeSplit: false, modulePreload: false },
});
