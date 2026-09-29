import { type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Service worker simples: pré-cacheia todo o build (caminhos RELATIVOS ao escopo,
 * então funciona em /Karimbolandia/ no GitHub Pages ou em qualquer subpasta).
 */
function pwaPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'karimbolandia-pwa',
    apply: 'build',
    configResolved(cfg) {
      outDir = cfg.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const p = join(dir, name);
          if (statSync(p).isDirectory()) walk(p);
          else files.push(relative(outDir, p).split(sep).join('/'));
        }
      };
      walk(outDir);
      const list = files.filter((f) => f !== 'sw.js' && !f.endsWith('.map'));
      const hash = createHash('sha1');
      for (const f of list) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 10);
      const sw = `/* gerado no build — Karimbolândia */
const VERSION = 'karimbolandia-${version}';
const PRECACHE = ${JSON.stringify(['./', ...list])};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match('./')))
  );
});
`;
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  // Caminhos relativos: funciona em https://isaacbraym.github.io/Karimbolandia/ e localmente.
  base: './',
  plugins: [pwaPlugin()],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    assetsInlineLimit: 4096,
  },
  server: { port: 5173, host: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
