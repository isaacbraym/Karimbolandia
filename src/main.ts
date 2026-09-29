import './style.css';
import { Game } from './game/game';

const base = import.meta.env.BASE_URL;
const params = new URLSearchParams(location.search);

async function boot() {
  if (params.get('debug') === 'sprites') {
    const { runSpriteDebug } = await import('./debug/sprites');
    await runSpriteDebug(base);
    return;
  }
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const ui = document.getElementById('ui') as HTMLElement;
  const game = new Game(canvas, ui);
  (window as unknown as { __karim: Game }).__karim = game;
  await game.boot(base);
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${base}sw.js`).catch(() => {
        /* offline opcional */
      });
    });
  }
  if (params.get('autoplay') === '1') game.play();
}

void boot();
