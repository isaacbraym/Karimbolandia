import { type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Service worker simples: pré-cacheia todo o build (caminhos RELATIVOS ao escopo,
 * então funciona em /Karimbolandia/ no GitHub Pages ou em qualquer subpasta).
 */
/** Identificador deste build (vai para o código e para version.json → aviso de atualização). */
const BUILD_ID = `${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}-${Math.random().toString(36).slice(2, 6)}`;

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
      writeFileSync(join(outDir, 'version.json'), JSON.stringify({ id: BUILD_ID, date: new Date().toISOString() }));
      const list = files.filter((f) => f !== 'sw.js' && f !== 'version.json' && !f.endsWith('.map'));
      const hash = createHash('sha1');
      for (const f of list) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 10) + '-' + BUILD_ID;
      const sw = `/* gerado no build — Karimbolândia */
const VERSION = 'karimbolandia-${version}';
const PRECACHE = ${JSON.stringify(['./', ...list])};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
// páginas que responderam "sei me atualizar sozinha" (versões novas do jogo)
const acked = new Set();
// Ao ativar: avisa as páginas abertas; as que não respondem em 1,5 s são de versões antigas
// (ex.: a v1 guardada no cache do celular) e são recarregadas — saem direto na versão nova.
function refreshOldPages() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      try { c.postMessage('kg-sw-updated'); } catch (err) { /* ignora */ }
    }
    return new Promise((r) => setTimeout(r, 1500)).then(() =>
      Promise.all(list.filter((c) => !acked.has(c.id) && 'navigate' in c).map((c) => c.navigate(c.url).catch(() => undefined)))
    );
  });
}
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('karimbolandia-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => refreshOldPages())
  );
});
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  if (e.data === 'kg-ack' && e.source) acked.add(e.source.id);
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // versão: sempre da rede (nunca do cache)
  if (url.pathname.endsWith('/version.json')) return;
  // Configuração de contas pode mudar sem trocar os assets; rede primeiro com fallback offline.
  if (url.pathname.endsWith('/cloud-config.json')) {
    e.respondWith(fetch(req, { cache: 'no-store' }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || new Response('{"enabled":false}', { headers: { 'Content-Type': 'application/json' } }))));
    return;
  }
  // página (navegação): rede primeiro → quem abre o jogo recebe a versão nova; offline usa o cache
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(req, { cache: 'no-store' }).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put('./', copy));
        return res;
      }).catch(() => caches.match('./').then((hit) => hit || caches.match(req, { ignoreSearch: true })))
    );
    return;
  }
  // arquivos com hash no nome (imutáveis), imagens e fontes: cache primeiro
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
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
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
