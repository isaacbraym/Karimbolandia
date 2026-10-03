import './style.css';
import { Game } from './game/game';
import { startUpdateWatch, checkStartupVersion, wasUpdateAttempted, applyUpdate } from './core/update';
import { cloudSaves } from './core/cloud';

// Versioned entry pages share the root assets through their document base.
const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
const params = new URLSearchParams(location.search);

async function verifyBeforeStart(ui: HTMLElement): Promise<'current' | 'unavailable' | 'updating'> {
  const panel = document.createElement('section');
  panel.className = 'version-gate';
  const title = document.createElement('h1');
  title.textContent = 'KARIMBOLÂNDIA';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Verificando a versão mais recente...';
  panel.append(title, status);
  ui.append(panel);
  const result = await checkStartupVersion(base);
  if (result.status !== 'outdated') {
    panel.remove();
    return result.status;
  }
  if (!wasUpdateAttempted(result.id)) {
    status.textContent = 'Atualizando o jogo. Seu progresso será mantido.';
    await applyUpdate(result.id, base);
  } else {
    status.textContent = 'A nova versão ainda está chegando. Tente atualizar novamente em alguns instantes.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'TENTAR ATUALIZAR';
    retry.onclick = () => { retry.disabled = true; void applyUpdate(result.id, base); };
    panel.append(retry);
  }
  return 'updating';
}

async function boot() {
  if (params.get('debug') === 'sprites') {
    const { runSpriteDebug } = await import('./debug/sprites');
    await runSpriteDebug(base);
    return;
  }
  if (params.get('debug') === 'npcs') {
    const { runNpcDebug } = await import('./debug/npcs');
    runNpcDebug();
    return;
  }
  if (params.get('debug') === 'map') {
    const { runLevelMap } = await import('./debug/levelmap');
    runLevelMap();
    return;
  }
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const ui = document.getElementById('ui') as HTMLElement;
  const version = import.meta.env.PROD ? await verifyBeforeStart(ui) : 'current';
  if (version === 'updating') return;
  const game = new Game(canvas, ui);
  (window as unknown as { __karim: Game }).__karim = game;
  // versão mais nova sempre: confere já na tela de carregamento e recarrega sozinho se houver
  // (no meio de uma partida espera ela acabar / voltar ao menu)
  if (import.meta.env.PROD) {
    startUpdateWatch(base, {
      isSafe: () => game.state === 'loading' || game.state === 'menu' || game.state === 'complete' || game.state === 'gameover',
      onUpdate: (apply) => game.notifyUpdate(apply),
    });
  }
  void import('./core/audio').then((a) => import('./core/music').then((m) => ((window as unknown as Record<string, unknown>).__snd = { audio: a.audio, music: m.music, MIX: m.MIX })));
  await game.boot(base);
  if (version === 'unavailable') game.menus.toast('Não foi possível conferir a versão. Usando a versão disponível neste aparelho.');
  // Não atrasa a arte nem a partida; o SDK de nuvem vem em um chunk separado.
  void cloudSaves.initialize(base);
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    const reg = () => navigator.serviceWorker.register(`${base}sw.js`, { updateViaCache: 'none' }).catch(() => undefined);
    if (document.readyState === 'complete') void reg();
    else window.addEventListener('load', () => void reg());
  }
  if (params.get('autoplay') === '1') game.autoplay();
}

void boot();
