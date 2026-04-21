import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

// Single source of truth for the app version: package.json. The renderer
// never reads package.json at runtime (it's not in the asar), so we inline
// the value at build time.
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

// Inline CHANGELOG.md too so the in-app "click the version to see history"
// dialog works fully offline with zero filesystem access from the renderer.
// Falls back to a minimal placeholder if the file is missing, so a first-time
// checkout without CHANGELOG.md still builds cleanly.
let changelog = '';
try {
  changelog = fs.readFileSync(path.resolve(__dirname, 'CHANGELOG.md'), 'utf-8');
} catch {
  changelog = '# Changelog\n\n_Aucun historique disponible._\n';
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: '.',
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_CHANGELOG__: JSON.stringify(changelog),
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 5173,
  },
});
