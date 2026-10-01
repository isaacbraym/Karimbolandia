/**
 * Garante que todo mundo jogue a versão mais nova: o build publica `version.json` com o id do
 * build; o jogo confere de tempos em tempos (e ao voltar para a aba). Se mudou, avisa com um botão
 * "ATUALIZAR AGORA", que limpa os caches do service worker e recarrega a página já na versão nova.
 */
export interface UpdateUI {
  /** chamada quando há versão nova; `apply` atualiza imediatamente */
  onUpdate(apply: () => void): void;
}

const CHECK_EVERY = 90_000; // ms

export function startUpdateWatch(base: string, ui: UpdateUI) {
  if (typeof window === 'undefined' || !('fetch' in window)) return;
  let notified = false;
  let busy = false;
  const check = async () => {
    if (notified || busy || !navigator.onLine) return;
    busy = true;
    try {
      const res = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const v = (await res.json()) as { id?: string };
        if (v.id && v.id !== __BUILD_ID__) {
          notified = true;
          ui.onUpdate(() => void applyUpdate(v.id!));
        }
      }
    } catch {
      /* offline / sem version.json: ignora */
    } finally {
      busy = false;
    }
  };
  window.setTimeout(() => void check(), 4000);
  window.setInterval(() => void check(), CHECK_EVERY);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void check();
  });
  window.addEventListener('online', () => void check());
}

/** Limpa caches + service worker e recarrega com um parâmetro novo (fura qualquer cache HTTP). */
export async function applyUpdate(id: string) {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* segue para o recarregamento mesmo assim */
  }
  const url = new URL(location.href);
  url.searchParams.set('v', id);
  location.replace(url.toString());
}
