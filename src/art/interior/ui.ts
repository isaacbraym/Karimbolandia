/**
 * Camada de interface do interior (desenhada em px lógicos sobre o diorama): menu radial de
 * verbos, balões de fala, medidor de atenção, lista de travessuras, bolso, avisos e o carimbo
 * KARIMBADO!. Só desenho + geometria de clique; a lógica fica na sessão.
 */
import type { InteriorRenderer } from './renderer';
import type { Npc, VerbId, VerbView } from '../../game/interior/types';
import { drawPot } from './actors';

export interface Menu { fid: string; name: string; verbs: VerbView[]; sel: number; ax: number; ay: number; t: number }
export interface Caption { who: string; text: string; ttl: number; age: number; lines?: string[]; w?: number }
export interface Toast { title: string; sub: string; t: number; kind: 'prank' | 'rep' | 'info' }
export interface Stamp { t: number; gold: boolean }
export interface PranksView { id: string; label: string; done: boolean; bonus: boolean }

export interface UiState {
  menu: Menu | null;
  list: boolean;
  captions: Caption[];
  toasts: Toast[];
  stamp: Stamp | null;
  hint: string;
  hintT: number;
  hoverName: string;
  /** folha de leitura (lore): fecha com qualquer toque */
  reader: { title: string; text: string; t: number } | null;
  pranks: PranksView[];
  pocket: { id: string; label: string }[];
  rep: number;
  title: string;
  /** retângulos de clique calculados no desenho (px lógicos) */
  listRect: { x: number; y: number; w: number; h: number };
}

export const newUi = (): UiState => ({
  menu: null, list: false, captions: [], toasts: [], stamp: null, hint: '', hintT: 0, hoverName: '', reader: null, pranks: [], pocket: [], rep: 0, title: '',
  listRect: { x: 0, y: 0, w: 0, h: 0 },
});

export const SLICE_R = 18;

/** Posições dos botões do menu (centro da tela clampado para caber). */
export function layoutMenu(m: Menu, W: number, H: number): { x: number; y: number }[] {
  const n = m.verbs.length, R = 40 + n * 4;
  const cx = Math.max(R + 28, Math.min(W - R - 28, m.ax)), cy = Math.max(R + 40, Math.min(H - R - 46, m.ay));
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    out.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R });
  }
  m.ax = cx; m.ay = cy;
  return out;
}

export function sliceAt(m: Menu, W: number, H: number, x: number, y: number): number {
  const pos = layoutMenu(m, W, H);
  let best = -1, bd = (SLICE_R + 8) * (SLICE_R + 8);
  for (let i = 0; i < pos.length; i++) {
    const d = (pos[i].x - x) ** 2 + (pos[i].y - y) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

const PILL = '#fff1cd', PILL_EDGE = '#4a3e37', INK = '#41322d';

function pill(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, lw = 1.2) {
  g.beginPath(); g.roundRect(x, y, w, h, r);
  g.fillStyle = fill; g.fill();
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}

// ───────────────────────────────────────────────────────────────────────── ícones de verbo
export function drawVerbIcon(g: CanvasRenderingContext2D, id: VerbId, x: number, y: number, s: number, c: string) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 1.9; g.lineCap = 'round'; g.lineJoin = 'round';
  switch (id) {
    case 'examine':
      g.beginPath(); g.moveTo(-8, 0); g.quadraticCurveTo(0, -7, 8, 0); g.quadraticCurveTo(0, 7, -8, 0); g.stroke();
      g.beginPath(); g.arc(0, 0, 2.6, 0, Math.PI * 2); g.fill(); break;
    case 'open': case 'close':
      g.strokeRect(-5.5, -7, 11, 14); g.beginPath(); g.moveTo(-5.5, -7); g.lineTo(id === 'open' ? -9 : -5.5, id === 'open' ? -4 : -7); g.lineTo(id === 'open' ? -9 : -5.5, id === 'open' ? 9 : 7); g.stroke();
      g.beginPath(); g.arc(3, 0, 1.2, 0, Math.PI * 2); g.fill(); break;
    case 'rummage':
      g.beginPath(); g.arc(-1.5, -1.5, 5.2, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(2.4, 2.4); g.lineTo(8, 8); g.stroke(); break;
    case 'take': case 'steal':
      g.beginPath(); g.moveTo(-6, 6); g.lineTo(-6, -1); g.lineTo(-3, -6); g.lineTo(-1, -1); g.lineTo(-1, -7); g.lineTo(2, -7); g.lineTo(2, -1); g.lineTo(5, -4); g.lineTo(7, -2); g.lineTo(5, 6); g.closePath(); g.stroke(); break;
    case 'eat': case 'drink':
      g.beginPath(); g.moveTo(-5, -8); g.lineTo(-5, -1); g.moveTo(-8, -8); g.lineTo(-8, -2); g.quadraticCurveTo(-6.5, 1, -5, -1); g.moveTo(-3.2, -8); g.lineTo(-3.2, -2); g.quadraticCurveTo(-4, 1, -5, -1); g.moveTo(-5, -1); g.lineTo(-5, 8); g.stroke();
      g.beginPath(); g.moveTo(5, 8); g.lineTo(5, -8); g.quadraticCurveTo(9, -4, 5, 1); g.stroke(); break;
    case 'use':
      g.beginPath(); g.arc(0, 0, 4.2, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 5.4, Math.sin(a) * 5.4); g.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); g.stroke(); } break;
    case 'sit': case 'lie':
      g.beginPath(); g.moveTo(-6, -8); g.lineTo(-6, 2); g.lineTo(5, 2); g.moveTo(-6, 2); g.lineTo(-6, 8); g.moveTo(5, 2); g.lineTo(5, 8); g.stroke(); break;
    case 'knock': case 'smash':
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r1 = i % 2 ? 4 : 8; g.beginPath(); g.moveTo(Math.cos(a) * 2, Math.sin(a) * 2); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke(); } break;
    case 'give':
      g.strokeRect(-6, -2, 12, 9); g.beginPath(); g.moveTo(0, -2); g.lineTo(0, 7); g.moveTo(-7, -2); g.lineTo(7, -2); g.stroke();
      g.beginPath(); g.moveTo(0, -2); g.quadraticCurveTo(-6, -9, -3, -4); g.moveTo(0, -2); g.quadraticCurveTo(6, -9, 3, -4); g.stroke(); break;
    case 'prank':
      g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0, 1, 4.6, 0.15, Math.PI - 0.15); g.stroke();
      g.beginPath(); g.arc(-3, -3, 1, 0, Math.PI * 2); g.arc(3, -3, 1, 0, Math.PI * 2); g.fill(); break;
    case 'pet':
      g.beginPath(); g.moveTo(0, 7); g.bezierCurveTo(-12, -1, -6, -9, 0, -3); g.bezierCurveTo(6, -9, 12, -1, 0, 7); g.stroke(); break;
    case 'shoo':
      g.beginPath(); g.moveTo(-7, 6); g.lineTo(5, -6); g.stroke(); g.beginPath(); g.moveTo(2, -8); g.lineTo(8, -8); g.lineTo(8, -2); g.stroke(); break;
    case 'water':
      g.beginPath(); g.moveTo(0, -8); g.quadraticCurveTo(7, 0, 0, 7); g.quadraticCurveTo(-7, 0, 0, -8); g.stroke(); break;
    case 'swing':
      g.beginPath(); g.arc(0, -2, 7, 0.3, Math.PI - 0.3); g.stroke(); g.beginPath(); g.moveTo(-7, 3); g.lineTo(-6, -2); g.lineTo(-2, 0); g.stroke(); break;
    case 'admire':
      g.beginPath(); g.ellipse(0, -1, 5.5, 7.5, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(-2, 8); g.lineTo(2, 8); g.stroke();
      g.beginPath(); g.moveTo(-2, -4); g.lineTo(0, -2); g.stroke(); break;
  }
  g.restore();
}

const eyeFill = (g: CanvasRenderingContext2D, x: number, y: number, k: number, s = 1) => {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.beginPath(); g.moveTo(-8, 0); g.quadraticCurveTo(0, -7, 8, 0); g.quadraticCurveTo(0, 7, -8, 0); g.closePath();
  g.fillStyle = 'rgba(20,12,34,.82)'; g.fill();
  g.save(); g.clip(); g.fillStyle = k > 0.66 ? '#ff5a5a' : k > 0.33 ? '#ffc94a' : '#fff4c8';
  g.fillRect(-9, 7 - k * 14, 18, 14); g.restore();
  g.strokeStyle = '#170f2e'; g.lineWidth = 1.4; g.stroke();
  g.fillStyle = '#170f2e'; g.beginPath(); g.arc(0, 0, 2.1, 0, Math.PI * 2); g.fill();
  g.restore();
};

// ───────────────────────────────────────────────────────────────────────── desenho
export function drawOverlay(g: CanvasRenderingContext2D, r: InteriorRenderer, ui: UiState, W: number, H: number, t: number) {
  lastW = W;
  const sim = r.sim;
  g.save();
  g.textAlign = 'center';
  g.lineJoin = 'round';
  // marcas e medidor de atenção sobre os NPCs
  for (const n of sim.npcs) if (!n.away) drawNpcMarks(g, r, n, t);
  // rótulo do móvel apontado
  if (ui.hoverName && !ui.menu) {
    g.font = 'bold 11px sans-serif';
    const w = g.measureText(ui.hoverName).width + 18;
    const x = Math.max(w / 2 + 6, Math.min(W - w / 2 - 6, lastPointer.x)), y = Math.max(24, lastPointer.y - 20);
    pill(g, x - w / 2, y - 12, w, 20, 7, 'rgba(23,15,46,.88)', '#e6ce88', 1);
    g.fillStyle = '#fff4cf'; g.fillText(ui.hoverName, x, y + 2);
  }
  // balões
  drawCaptions(g, r, ui);
  // menu radial
  if (ui.menu) drawMenu(g, ui.menu, W, H, t);
  // lista de travessuras
  drawList(g, ui, W, H);
  // bolso e reputação
  drawPocket(g, ui, W, H);
  // título e dica
  g.font = 'bold 12px "Lilita One", sans-serif';
  g.textAlign = 'left';
  g.fillStyle = '#fff4cf'; g.strokeStyle = '#170f2e'; g.lineWidth = 3;
  g.strokeText(ui.title, 10, 20); g.fillText(ui.title, 10, 20);
  g.textAlign = 'center';
  if (ui.hint && ui.hintT > 0) {
    g.font = '11px sans-serif';
    const w = g.measureText(ui.hint).width + 26, a = Math.min(1, ui.hintT);
    g.globalAlpha = a;
    pill(g, W / 2 - w / 2, H - 30, w, 22, 8, 'rgba(23,15,46,.86)', '#8c78b8', 1);
    g.fillStyle = '#efe6ff'; g.fillText(ui.hint, W / 2, H - 15);
    g.globalAlpha = 1;
  }
  // avisos
  let ty = 36;
  for (const to of ui.toasts) {
    const k = to.t < 0.25 ? to.t / 0.25 : to.t > 2.6 ? Math.max(0, (3 - to.t) / 0.4) : 1;
    g.globalAlpha = k;
    g.font = 'bold 12px "Lilita One", sans-serif';
    const w = Math.max(g.measureText(to.title).width, 150) + 28;
    const y = ty - (1 - k) * 12;
    pill(g, W / 2 - w / 2, y, w, to.sub ? 36 : 24, 9, to.kind === 'prank' ? '#2f5d3b' : to.kind === 'rep' ? '#5a3a6a' : '#233a52', '#f2d98a', 1.4);
    g.fillStyle = '#fff4cf'; g.fillText(to.title, W / 2, y + 16);
    if (to.sub) { g.font = '10px sans-serif'; g.fillStyle = '#d8ecd2'; g.fillText(to.sub, W / 2, y + 29); }
    g.globalAlpha = 1; ty += (to.sub ? 40 : 28);
  }
  if (ui.reader) drawReader(g, ui.reader, W, H);
  if (ui.stamp) drawStamp(g, ui.stamp, W, H);
  g.restore();
}

function drawReader(g: CanvasRenderingContext2D, rd: { title: string; text: string; t: number }, W: number, H: number) {
  const k = Math.min(1, rd.t / 0.18), e = 1 - Math.pow(1 - k, 3);
  g.fillStyle = `rgba(10,6,20,${0.55 * e})`;
  g.fillRect(0, 0, W, H);
  g.font = '12px sans-serif';
  const max = Math.min(330, W - 60), lines: string[] = [];
  for (const para of rd.text.split(/\r?\n/)) lines.push(...wrap(g, para, max - 30), '');
  lines.pop();
  const h = Math.min(H - 40, 56 + lines.length * 15), w = max;
  g.save();
  g.translate(W / 2, H / 2 + (1 - e) * 24); g.rotate(-0.015 * (1 - e) - 0.012); g.scale(0.9 + 0.1 * e, 0.9 + 0.1 * e);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-w / 2 + 3, -h / 2 + 5, w, h);
  g.fillStyle = '#f6e7b4'; g.fillRect(-w / 2, -h / 2, w, h);
  g.strokeStyle = '#b89a56'; g.lineWidth = 2; g.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
  g.fillStyle = '#7a3b2a'; g.font = 'bold 13px "Lilita One", sans-serif'; g.textAlign = 'center';
  g.fillText(rd.title, 0, -h / 2 + 26);
  g.fillStyle = '#3a2a14'; g.font = '12px sans-serif'; g.textAlign = 'left';
  lines.forEach((l, i) => g.fillText(l, -w / 2 + 16, -h / 2 + 48 + i * 15));
  g.textAlign = 'center'; g.fillStyle = '#8a7a5a'; g.font = '10px sans-serif';
  g.fillText('toque, clique ou aperte um botão para guardar', 0, h / 2 - 9);
  g.restore();
}

export const lastPointer = { x: 0, y: 0 };

function drawNpcMarks(g: CanvasRenderingContext2D, r: InteriorRenderer, n: Npc, t: number) {
  const p = r.toScreen(n.gx, n.gy, n.state === 'asleep' || n.state === 'stirring' ? 58 : 76, [0, 0]);
  const s = r.s;
  const x = p[0], y = p[1];
  const aware = n.data.aware ?? 0;
  if (aware > 0.03 && !n.mark) eyeFill(g, x, y - 4 * s, Math.min(1, aware), 0.95 * s);
  if (n.mark) {
    const bounce = Math.abs(Math.sin(t * 8)) * 3;
    g.font = `bold ${Math.round(18 * s)}px "Lilita One", sans-serif`;
    g.fillStyle = n.mark === '!' ? '#ff4a4a' : n.mark === '?' ? '#ffd24a' : '#bfe0ff';
    g.strokeStyle = '#170f2e'; g.lineWidth = 4;
    g.strokeText(n.mark, x, y - bounce); g.fillText(n.mark, x, y - bounce);
  }
}

function wrap(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/), lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (g.measureText(test).width > max && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawCaptions(g: CanvasRenderingContext2D, r: InteriorRenderer, ui: UiState) {
  const sim = r.sim;
  g.font = '10.5px sans-serif';
  const drawn = new Set<string>();
  for (let i = ui.captions.length - 1; i >= 0; i--) {
    const c = ui.captions[i];
    if (drawn.has(c.who)) continue;
    drawn.add(c.who);
    if (!c.lines) { c.lines = text2(g, c.text); c.w = Math.max(...c.lines.map((l) => g.measureText(l).width)) + 18; }
    let x: number, y: number;
    if (c.who === 'karimbo') { const p = r.toScreen(sim.px, sim.py, 78, [0, 0]); x = p[0]; y = p[1]; }
    else { const n = sim.npc(c.who); if (!n) continue; const p = r.toScreen(n.gx, n.gy, 96, [0, 0]); x = p[0]; y = p[1]; }
    const w = c.w!, h = c.lines.length * 13 + 9;
    const a = c.age < 0.15 ? c.age / 0.15 : c.ttl - c.age < 0.35 ? Math.max(0, (c.ttl - c.age) / 0.35) : 1;
    const cx = Math.max(w / 2 + 6, Math.min(lastW - w / 2 - 6, x)), top = Math.max(6, y - h - 6);
    g.globalAlpha = a;
    pill(g, cx - w / 2, top, w, h, 6, c.who === 'karimbo' ? '#e9f7ff' : PILL, PILL_EDGE, 1.2);
    g.beginPath(); g.moveTo(x - 4, top + h - 0.5); g.lineTo(x, top + h + 6); g.lineTo(x + 4, top + h - 0.5); g.fillStyle = c.who === 'karimbo' ? '#e9f7ff' : PILL; g.fill();
    g.fillStyle = INK;
    c.lines.forEach((l, k) => g.fillText(l, cx, top + 13 + k * 13));
    g.globalAlpha = 1;
  }
}
let lastW = 640;
const text2 = (g: CanvasRenderingContext2D, s: string) => wrap(g, s, 168);

function drawMenu(g: CanvasRenderingContext2D, m: Menu, W: number, H: number, t: number) {
  lastW = W;
  const pos = layoutMenu(m, W, H);
  const k = Math.min(1, m.t / 0.16), ease = 1 - Math.pow(1 - k, 3);
  // véu e nome do móvel
  g.fillStyle = `rgba(10,6,20,${0.34 * ease})`;
  g.fillRect(0, 0, W, H);
  g.font = 'bold 12px "Lilita One", sans-serif';
  const nw = g.measureText(m.name).width + 22;
  pill(g, m.ax - nw / 2, m.ay - 11, nw, 22, 8, 'rgba(23,15,46,.94)', '#e6ce88', 1.2);
  g.fillStyle = '#fff4cf'; g.textAlign = 'center'; g.fillText(m.name, m.ax, m.ay + 4);
  for (let i = 0; i < pos.length; i++) {
    const v = m.verbs[i], sel = i === m.sel;
    const px = m.ax + (pos[i].x - m.ax) * ease, py = m.ay + (pos[i].y - m.ay) * ease;
    const rad = (SLICE_R + (sel ? 3.5 + Math.sin(t * 9) * 0.6 : 0)) * (0.5 + 0.5 * ease);
    // haste até o centro
    g.strokeStyle = 'rgba(255,240,200,.25)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(m.ax, m.ay); g.lineTo(px, py); g.stroke();
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(px + 1.5, py + 2.5, rad, 0, Math.PI * 2); g.fill();
    g.fillStyle = v.hostile ? (sel ? '#c2434a' : '#8e2c36') : (sel ? '#2f6b64' : '#1f3a3c');
    g.strokeStyle = sel ? '#fff2a8' : '#e6ce88'; g.lineWidth = sel ? 3 : 2;
    g.beginPath(); g.arc(px, py, rad, 0, Math.PI * 2); g.fill(); g.stroke();
    drawVerbIcon(g, v.id, px, py, sel ? 1.18 : 1, '#fff4cf');
    // ondas de ruído (canto superior direito)
    if (v.waves > 0) {
      g.strokeStyle = v.waves === 3 ? '#ff7a5a' : v.waves === 2 ? '#ffc94a' : '#cfeaa0'; g.lineWidth = 1.7;
      for (let w = 1; w <= v.waves; w++) { g.beginPath(); g.arc(px + rad * 0.78, py - rad * 0.78, 2.5 + w * 2.3, -Math.PI * 0.62, Math.PI * 0.12); g.stroke(); }
    }
    // olho: alguém vai ver
    if (v.witness) { g.save(); g.translate(px - rad * 0.8, py - rad * 0.82); eyeFill(g, 0, 0, 0.9, 0.78); g.restore(); }
    // rótulo
    g.font = `${sel ? 'bold ' : ''}9.5px sans-serif`;
    const lw = g.measureText(v.label).width + 12;
    pill(g, px - lw / 2, py + rad + 3, lw, 14, 5, sel ? '#fff1cd' : 'rgba(23,15,46,.9)', sel ? PILL_EDGE : '#8c78b8', 1);
    g.fillStyle = sel ? INK : '#efe6ff'; g.fillText(v.label, px, py + rad + 13.5);
  }
}

function drawList(g: CanvasRenderingContext2D, ui: UiState, W: number, H: number) {
  const done = ui.pranks.filter((p) => p.done && !p.bonus).length, total = ui.pranks.filter((p) => !p.bonus).length;
  if (!ui.pranks.length) return;
  const open = ui.list;
  g.font = '10px sans-serif';
  let w = 112;
  if (open) for (const p of ui.pranks) w = Math.max(w, g.measureText(p.label).width + 34);
  const h = open ? 26 + ui.pranks.length * 15 : 22;
  const x = W - w - 8, y = 8;
  ui.listRect.x = x; ui.listRect.y = y; ui.listRect.w = w; ui.listRect.h = h;
  g.save();
  g.translate(x + w / 2, y + h / 2); g.rotate(open ? 0.02 : -0.03); g.translate(-(x + w / 2), -(y + h / 2));
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + 2, y + 3, w, h);
  g.fillStyle = '#f7e8a8'; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(x + w / 2 - 14, y - 4, 28, 9);
  g.textAlign = 'left'; g.fillStyle = '#5a3f20';
  g.font = 'bold 10px sans-serif';
  g.fillText(`TRAVESSURAS ${done}/${total}`, x + 8, y + 15);
  if (open) {
    g.font = '10px sans-serif';
    ui.pranks.forEach((p, i) => {
      const yy = y + 30 + i * 15;
      g.strokeStyle = '#5a3f20'; g.lineWidth = 1.2; g.strokeRect(x + 8, yy - 8, 9, 9);
      if (p.done) { g.strokeStyle = '#2f7a3b'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 9, yy - 3); g.lineTo(x + 12, yy); g.lineTo(x + 18, yy - 9); g.stroke(); }
      g.fillStyle = p.done ? '#8a7a5a' : '#3a2a14';
      g.fillText((p.bonus ? '★ ' : '') + p.label, x + 23, yy);
      if (p.done) { const tw = g.measureText((p.bonus ? '★ ' : '') + p.label).width; g.strokeStyle = '#8a7a5a'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 23, yy - 3); g.lineTo(x + 23 + tw, yy - 3); g.stroke(); }
    });
  }
  g.restore();
  g.textAlign = 'center';
  void H;
}

function drawPocket(g: CanvasRenderingContext2D, ui: UiState, W: number, H: number) {
  const x0 = 10, y0 = H - 40;
  g.font = '9px sans-serif';
  for (let i = 0; i < Math.max(1, ui.pocket.length); i++) {
    const x = x0 + i * 34;
    g.fillStyle = 'rgba(23,15,46,.8)'; g.strokeStyle = '#8c78b8'; g.lineWidth = 1.2;
    g.beginPath(); g.roundRect(x, y0, 30, 30, 7); g.fill(); g.stroke();
    const it = ui.pocket[i];
    if (it && it.id === 'panela') drawPot(g, x + 15, y0 + 17, 1.3);
  }
  void W;
}

function drawStamp(g: CanvasRenderingContext2D, st: Stamp, W: number, H: number) {
  const k = Math.min(1, st.t / 0.28), out = st.t > 2.2 ? Math.max(0, 1 - (st.t - 2.2) / 0.4) : 1;
  const sc = k < 1 ? 3.2 - 2.2 * k * k : 1 + Math.max(0, 0.16 - (st.t - 0.28) * 0.5);
  g.save();
  g.globalAlpha = out;
  g.translate(W / 2, H / 2 - 6);
  g.rotate(-0.16);
  g.scale(sc, sc);
  const col = st.gold ? '#ffd23a' : '#e84a5f';
  g.font = 'bold 44px "Lilita One", "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.lineWidth = 6; g.strokeStyle = '#170f2e';
  g.strokeText('KARIMBADO!', 0, 14);
  g.fillStyle = col; g.fillText('KARIMBADO!', 0, 14);
  g.lineWidth = 3; g.strokeStyle = col; g.strokeRect(-132, -34, 264, 62);
  g.font = 'bold 13px sans-serif'; g.fillStyle = '#fff4cf';
  g.fillText(st.gold ? '★ ESTRELA DOURADA ★' : 'TODAS AS TRAVESSURAS', 0, 46);
  g.restore();
  if (k >= 1 && st.t < 0.5) {
    g.fillStyle = `rgba(255,255,255,${0.35 * (1 - (st.t - 0.28) / 0.22)})`;
    g.fillRect(0, 0, W, H);
  }
}
