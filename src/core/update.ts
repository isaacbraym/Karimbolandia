/**
 * Garante que todo mundo jogue a versão mais nova, sem precisar tocar em nada:
 *  • o build publica `version.json` com o id do build; o jogo confere logo ao abrir (ainda na tela
 *    de carregamento), de tempos em tempos e ao voltar para a aba;
 *  • se mudou e o jogador NÃO está no meio de uma partida (carregando, menu, fim de fase, fim de
 *    jogo), o jogo limpa os caches e recarrega sozinho já na versão nova;
 *  • no meio da partida não interrompe: mostra um botão discreto e atualiza sozinho assim que o
 *    jogador voltar ao menu / terminar a fase;
 *  • o service worker novo também avisa as páginas abertas; páginas de versões antigas (que não
 *    sabem responder) são recarregadas por ele — é isso que tira do ar quem ainda está na v1.
 * Proteção contra laço: cada versão nova só é tentada automaticamente uma vez por sessão.
 */
export interface UpdateUI {
  /** pode recarregar agora sem atrapalhar (fora de uma partida em andamento)? */
  isSafe(): boolean;
  /** fallback: mostra o aviso/botão de atualizar (`apply` atualiza imediatamente) */
  onUpdate(apply: () => void): void;
}

const CHECK_EVERY = 60_000; // ms
const TRIED_KEY = 'karimbolandia.update.tried';

export type VersionCheck = { status: 'current' } | { status: 'unavailable' } | { status: 'outdated'; id: string };

/** A abertura aguarda esta consulta. Falhas de rede nunca apagam nem bloqueiam o save offline. */
export async function checkStartupVersion(base: string, installedId = __BUILD_ID__): Promise<VersionCheck> {
  if (!navigator.onLine) return { status: 'unavailable' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
    if (!res.ok) return { status: 'unavailable' };
    const v = await res.json() as { id?: unknown };
    if (typeof v.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(v.id)) return { status: 'unavailable' };
    return v.id === installedId ? { status: 'current' } : { status: 'outdated', id: v.id };
  } catch {
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}

export function wasUpdateAttempted(id: string) {
  // O parâmetro também protege contra loops quando sessionStorage está indisponível.
  return triedId() === id || new URL(location.href).searchParams.get('v') === id;
}

function triedId(): string | null {
  try {
    return sessionStorage.getItem(TRIED_KEY);
  } catch {
    return null;
  }
}
function markTried(id: string) {
  try {
    sessionStorage.setItem(TRIED_KEY, id);
  } catch {
    /* modo privado: segue sem a marca */
  }
}

export function startUpdateWatch(base: string, ui: UpdateUI) {
  if (typeof window === 'undefined' || !('fetch' in window)) return;
  let pending: string | null = null;
  let notified = false;
  let busy = false;

  const handle = (id: string) => {
    if (wasUpdateAttempted(id)) {
      // já recarregamos uma vez para esta versão e ela ainda não veio (CDN atrasada): só avisa
      if (!notified) {
        notified = true;
        ui.onUpdate(() => void applyUpdate(id, base));
      }
      return;
    }
    if (ui.isSafe()) {
      void applyUpdate(id, base);
    } else {
      pending = id;
      if (!notified) {
        notified = true;
        ui.onUpdate(() => {
          void applyUpdate(id, base);
        });
      }
    }
  };

  const check = async () => {
    if (busy || !navigator.onLine) return;
    busy = true;
    try {
      const v = await checkStartupVersion(base);
      if (v.status === 'outdated') handle(v.id);
    } finally {
      busy = false;
    }
  };

  // logo ao abrir (enquanto carrega) e depois periodicamente
  void check();
  window.setInterval(() => void check(), CHECK_EVERY);
  // atualização adiada: aplica sozinha quando a partida acabar / voltar ao menu
  window.setInterval(() => {
    if (pending && ui.isSafe()) {
      const id = pending;
      pending = null;
      void applyUpdate(id, base);
    }
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void check();
  });
  window.addEventListener('online', () => void check());
  // o service worker novo avisa quando ativa: responde que esta página sabe se atualizar e confere
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data !== 'kg-sw-updated') return;
      try {
        (e.source as ServiceWorker | null)?.postMessage('kg-ack');
      } catch {
        /* sem resposta: no pior caso o SW recarrega a página */
      }
      void check();
    });
    // entrega as mensagens já (sem esperar o fim do carregamento da página)
    try {
      navigator.serviceWorker.startMessages();
    } catch {
      /* navegador antigo: entrega ao terminar de carregar */
    }
  }
}

/** Limpa caches + service worker e recarrega com um parâmetro novo (fura qualquer cache HTTP). */
export async function applyUpdate(id: string, base = './') {
  markTried(id);
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k.startsWith('karimbolandia-')).map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      const scope = new URL(base, location.href).href;
      await Promise.all(regs.filter(r => r.scope === scope).map((r) => r.unregister()));
    }
  } catch {
    /* segue para o recarregamento mesmo assim */
  }
  const url = new URL(location.href);
  url.searchParams.set('v', id);
  location.replace(url.toString());
}
