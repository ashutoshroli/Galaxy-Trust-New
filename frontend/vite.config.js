import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Stamps a unique version into the service worker on every production build,
// so each deploy gets a fresh cache name and the SW's activate handler purges
// any caches left over from the previous deploy (see public/sw.js).
function stampServiceWorkerVersion() {
  return {
    name: 'stamp-service-worker-version',
    apply: 'build',
    closeBundle() {
      const swPath = resolve(__dirname, 'dist/sw.js');
      if (!existsSync(swPath)) return;
      const version = process.env.CACHE_VERSION || String(Date.now());
      const contents = readFileSync(swPath, 'utf8').replace(/__CACHE_VERSION__/g, version);
      writeFileSync(swPath, contents);
    },
  };
}

export default defineConfig({
  plugins: [react(), stampServiceWorkerVersion()],
  server: {
    host: true,
    port: 5174,
  },
});
