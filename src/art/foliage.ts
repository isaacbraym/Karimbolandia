/**
 * Folhagem e casca pintadas à mão em código (só no ASSAR das decorações: gradientes aqui são
 * permitidos porque rodam uma vez). Copas com tufos recortados em folhas, sombra interna, borda
 * iluminada pelo sol e textura de folhinhas; troncos cilíndricos com fissuras, nós e musgo.
 */
import { Rng, shade } from '../core/math';
import { OUT } from './kit';

export interface LeafPalette {
  dark: string;
  mids: readonly string[];
  light: string;
  /** cor das flores/frutos opcionais */
  bloom?: string;
}
export const JUNGLE_LEAVES: LeafPalette = { dark: '#163d20', mids: ['#2f7a3a', '#3f9446', '#4fa64e', '#2a6a34'], light: '#9ee07a' };
export const CITY_LEAVES: LeafPalette = { dark: '#123a35', mids: ['#2f8a6a', '#3aa87a', '#256e58', '#47b884'], light: '#a8f2c0' };
export const VILLAGE_LEAVES: LeafPalette = { dark: '#2a4a22', mids: ['#5f8a3e', '#6f9a48', '#527a36', '#7aa44e'], light: '#c8e88a' };

/** contorno recortado em pontas de folha (não um círculo liso) */
function lobedPath(g: CanvasRenderingContext2D, x: number, y: number, rad: number, r: Rng) {
  const n = 9 + Math.floor(rad / 6);
  const phase = r.range(0, Math.PI * 2);
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const am = phase + ((i - 0.5) / n) * Math.PI * 2;
    const rr = rad * (0.9 + 0.12 * Math.sin(i * 2.7));
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr * 0.86;
    if (i === 0) g.moveTo(px, py);
    else g.quadraticCurveTo(x + Math.cos(am) * rad * 1.16, y + Math.sin(am) * rad * 1.0, px, py);
  }
  g.closePath();
}

function leaflet(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, col: string) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const w = len * 0.42;
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + c * len * 0.5 - s * w, y + s * len * 0.5 + c * w, x + c * len, y + s * len);
  g.quadraticCurveTo(x + c * len * 0.5 + s * w, y + s * len * 0.5 - c * w, x, y);
  g.fill();
}

/** Copa volumosa: tufos ordenados de trás para frente, cada um com luz do alto à esquerda. */
export function foliage(g: CanvasRenderingContext2D, r: Rng, x: number, y: number, rad: number, pal: LeafPalette, tufts = 9) {
  const cl: [number, number, number][] = [];
  for (let i = 0; i < tufts; i++) cl.push([x + r.range(-1, 1) * rad * 0.82, y + r.range(-0.6, 0.45) * rad * 0.72, rad * r.range(0.36, 0.6)]);
  cl.sort((a, b) => a[1] - b[1]);
  // massa escura de fundo (dá profundidade entre os tufos)
  g.fillStyle = pal.dark;
  for (const [bx, by, br] of cl) {
    lobedPath(g, bx + br * 0.08, by + br * 0.16, br * 1.04, r);
    g.fill();
  }
  g.strokeStyle = 'rgba(8,24,14,0.55)';
  g.lineWidth = 1.1;
  for (const [bx, by, br] of cl) {
    lobedPath(g, bx + br * 0.08, by + br * 0.16, br * 1.04, r);
    g.stroke();
  }
  for (const [bx, by, br] of cl) {
    const mid = r.pick(pal.mids);
    const gr = g.createRadialGradient(bx - br * 0.35, by - br * 0.45, br * 0.1, bx, by, br * 1.1);
    gr.addColorStop(0, shade(mid, 0.28));
    gr.addColorStop(0.55, mid);
    gr.addColorStop(1, shade(mid, -0.3));
    g.fillStyle = gr;
    lobedPath(g, bx, by, br * 0.94, r);
    g.fill();
    // folhinhas: textura de folhas sobrepostas, mais claras no alto
    const n = Math.floor(6 + br / 3);
    for (let k = 0; k < n; k++) {
      const a = r.range(0, Math.PI * 2);
      const d = br * Math.sqrt(r.next()) * 0.8;
      const lx = bx + Math.cos(a) * d;
      const ly = by + Math.sin(a) * d * 0.85;
      const top = ly < by;
      leaflet(g, lx, ly, r.range(3.5, 6.5) * Math.min(1.6, br / 14), r.range(-2.6, -0.5), top ? shade(mid, 0.22) : shade(mid, -0.18));
    }
    // borda iluminada pelo sol
    g.strokeStyle = pal.light;
    g.globalAlpha = 0.55;
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(bx, by, br * 0.82, Math.PI * 1.08, Math.PI * 1.55);
    g.stroke();
    g.globalAlpha = 1;
  }
  // brilhos pontuais e flores/frutos
  g.fillStyle = pal.light;
  g.globalAlpha = 0.6;
  for (let i = 0; i < tufts; i++) {
    const [bx, by, br] = cl[i];
    g.beginPath();
    g.arc(bx - br * 0.4, by - br * 0.42, br * 0.13, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  if (pal.bloom) {
    for (let i = 0; i < tufts; i++) {
      const [bx, by, br] = cl[i];
      g.fillStyle = pal.bloom;
      g.strokeStyle = OUT;
      g.lineWidth = 0.5;
      g.beginPath();
      g.arc(bx + r.range(-0.5, 0.5) * br, by + r.range(-0.4, 0.5) * br, 2.2, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }
}

/** Tronco cilíndrico entre (x0..x1) de yTop a yBot, levemente mais largo na base. */
export function barkTrunk(g: CanvasRenderingContext2D, r: Rng, cx: number, yTop: number, yBot: number, wTop: number, wBot: number, base: string) {
  g.beginPath();
  g.moveTo(cx - wTop / 2, yTop);
  g.lineTo(cx + wTop / 2, yTop);
  g.quadraticCurveTo(cx + wBot * 0.42, (yTop + yBot) * 0.5, cx + wBot / 2, yBot);
  g.lineTo(cx - wBot / 2, yBot);
  g.quadraticCurveTo(cx - wBot * 0.42, (yTop + yBot) * 0.5, cx - wTop / 2, yTop);
  g.closePath();
  const gr = g.createLinearGradient(cx - wBot / 2, 0, cx + wBot / 2, 0);
  gr.addColorStop(0, shade(base, -0.38));
  gr.addColorStop(0.28, shade(base, 0.22));
  gr.addColorStop(0.55, base);
  gr.addColorStop(1, shade(base, -0.45));
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 1.2;
  g.stroke();
  g.save();
  g.clip();
  // fissuras verticais da casca
  g.strokeStyle = shade(base, -0.5);
  g.lineWidth = 1;
  const n = Math.max(3, Math.floor(wBot / 5));
  for (let i = 0; i < n; i++) {
    let x = cx - wBot / 2 + (i + 0.5) * (wBot / n) + r.range(-2, 2);
    let y = yBot;
    g.beginPath();
    g.moveTo(x, y);
    while (y > yTop) {
      y -= r.range(6, 14);
      x += r.range(-1.6, 1.6);
      g.lineTo(x, Math.max(yTop, y));
    }
    g.stroke();
  }
  // luz fina na aresta iluminada
  g.strokeStyle = 'rgba(255,240,210,0.22)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(cx - wTop * 0.22, yTop);
  g.lineTo(cx - wBot * 0.24, yBot);
  g.stroke();
  // nós e musgo
  for (let i = 0; i < 2 + Math.floor((yBot - yTop) / 90); i++) {
    const ky = r.range(yTop + 10, yBot - 14);
    const kx = cx + r.range(-0.25, 0.25) * wBot;
    g.fillStyle = shade(base, -0.42);
    g.beginPath();
    g.ellipse(kx, ky, 2.6, 3.8, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = shade(base, 0.25);
    g.lineWidth = 0.7;
    g.beginPath();
    g.ellipse(kx, ky, 4, 5.4, 0, Math.PI * 0.9, Math.PI * 1.9);
    g.stroke();
  }
  g.fillStyle = 'rgba(96,154,56,0.55)';
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.ellipse(cx + r.range(-0.4, 0.1) * wBot, yBot - r.range(4, 40), r.range(3, 7), r.range(2, 4), 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}
