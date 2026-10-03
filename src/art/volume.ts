import { poly, rrPath } from './kit';
import { shade } from '../core/math';

/** Três faces compartilham os mesmos vértices: sem lacunas nas quinas. */
export function prism(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dx: number, dy: number, color: string, lw = 1) {
  const a: [number, number] = [x, y], b: [number, number] = [x + w, y];
  const c: [number, number] = [x + w, y + h], d: [number, number] = [x, y + h];
  const aa: [number, number] = [x + dx, y + dy], bb: [number, number] = [x + w + dx, y + dy];
  const cc: [number, number] = [x + w + dx, y + h + dy];
  poly(g, [b, bb, cc, c], shade(color, -0.32), { lw });
  poly(g, [a, b, bb, aa], shade(color, 0.2), { lw });
  poly(g, [a, b, c, d], color, { lw });
}

/** Acabamento assado junto da peça: volume lateral, reflexo suave e costuras. */
export function clothFinish(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  g.save(); rrPath(g, x, y, w, h, Math.min(3, w / 4)); g.clip();
  const tone = g.createLinearGradient(x, y, x + w, y + h * 0.2);
  tone.addColorStop(0, 'rgba(255,245,220,.24)'); tone.addColorStop(.25, 'rgba(255,245,220,.05)');
  tone.addColorStop(.65, 'rgba(10,8,28,.03)'); tone.addColorStop(1, 'rgba(10,8,28,.3)');
  g.fillStyle = tone; g.fillRect(x, y, w, h);
  g.strokeStyle = shade(color, -0.35); g.lineWidth = .7;
  g.beginPath(); g.moveTo(x + w * .78, y + h * .24); g.quadraticCurveTo(x + w * .9, y + h * .65, x + w * .75, y + h * .92);
  g.moveTo(x + w * .16, y + h * .7); g.quadraticCurveTo(x + w * .4, y + h * .6, x + w * .53, y + h * .76); g.stroke();
  g.strokeStyle = 'rgba(255,246,223,.4)'; g.lineWidth = .55;
  g.beginPath(); g.moveTo(x + 2, y + h - 1.5); g.lineTo(x + w - 2, y + h - 1.5); g.stroke();
  g.restore();
}
