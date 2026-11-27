import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync } from 'node:fs';

export default defineConfig({ plugins: [react(), {
  name: 'offline-pdf-assets',
  closeBundle() {
    mkdirSync('dist/pdfjs', { recursive: true });
    for (const folder of ['cmaps', 'standard_fonts', 'wasm']) cpSync(`node_modules/pdfjs-dist/${folder}`, `dist/pdfjs/${folder}`, { recursive: true });
  },
}], build: { target: 'es2022' } });
