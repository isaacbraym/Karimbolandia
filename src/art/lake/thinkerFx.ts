/**
 * Efeitos da Praça do Pensador: facho de luz que desce por uma fenda no teto, halo de neon dos dois
 * anéis e cristais mais fortes. Tudo com sprites prontos e composição `lighter`; só desenha se a
 * estátua está perto da câmera.
 */
import type { World } from '../../game/world';
import { glowSprite, makeCanvas } from '../kit';

let shaft: HTMLCanvasElement | null = null;
let halo: HTMLCanvasElement | null = null;

function bakeShaft() {
  const c = makeCanvas(64, 256), g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(210,255,245,.0)');
  gr.addColorStop(0.18, 'rgba(210,255,245,.85)');
  gr.addColorStop(1, 'rgba(160,240,235,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(22, 0); g.lineTo(42, 0); g.lineTo(64, 256); g.lineTo(0, 256);
  g.closePath();
  g.fill();
  return c;
}
function bakeHalo() {
  const c = makeCanvas(256, 128), g = c.getContext('2d')!;
  g.translate(128, 64);
  for (const [w, a] of [[16, 0.18], [8, 0.35], [3, 0.8]] as [number, number][]) {
    g.strokeStyle = `rgba(110,235,255,${a})`;
    g.lineWidth = w;
    g.beginPath();
    g.ellipse(0, 0, 112, 42, 0, 0, 6.283);
    g.stroke();
  }
  return c;
}

/** Chamado depois das decorações do fundo e antes das da frente (com as luzes dos cristais). */
export function drawThinkerFx(g: CanvasRenderingContext2D, w: World) {
  const th = w.thinker;
  if (!th.exists || (th.light <= 0 && th.crystal <= 0) || !w.camera.visible(th.x, th.y - 120, 360)) return;
  shaft ??= bakeShaft();
  halo ??= bakeHalo();
  const breathe = 0.85 + 0.15 * Math.sin(w.time * 0.9);
  g.globalCompositeOperation = 'lighter';
  // facho de luz descendo do teto sobre a estátua
  g.globalAlpha = 0.5 * th.light * breathe;
  const top = th.y - 520;
  g.drawImage(shaft, th.x - 110, top, 220, 520);
  // brilho no pé da estátua
  const glow = glowSprite('#9ffff0', 32);
  g.globalAlpha = 0.5 * th.light * breathe;
  g.drawImage(glow.c, th.x - 120, th.y - 150, 240, 190);
  // halo de neon: os dois anéis (raios 150 e 220 px, achatados)
  g.globalAlpha = 0.55 * Math.min(1, th.crystal * 1.2);
  for (const r of w.water.rings) g.drawImage(halo, r.cx - r.r, r.cy - r.r * 0.42, r.r * 2, r.r * 0.84);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}
