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
    if (triedId() === id) {
      // já recarregamos uma vez para esta versão e ela ainda não veio (CDN atrasada): só avisa
      if (!notified) {
        notified = true;
        ui.onUpdate(() => void applyUpdate(id));
      }
      return;
    }
    if (ui.isSafe()) {
      markTried(id);
      void applyUpdate(id);
    } else {
      pending = id;
      if (!notified) {
        notified = true;
        ui.onUpdate(() => {
          markTried(id);
          void applyUpdate(id);
        });
      }
    }
  };

  const check = async () => {
    if (busy || !navigator.onLine) return;
    busy = true;
    try {
      const res = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const v = (await res.json()) as { id?: string };
        if (v.id && v.id !== __BUILD_ID__) handle(v.id);
      }
    } catch {
      /* offline / sem version.json: ignora */
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
      markTried(id);
      void applyUpdate(id);
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
