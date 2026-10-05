/**
 * Efeitos do boxe: partículas (faíscas, estrelas, folhas, dente), letreiros de HQ que pipocam,
 * tremida de câmera e clarão. Pool fixo (nada alocado por quadro) e texto em cache: cada
 * (texto, tamanho, cor) vira UMA imagem na primeira vez e depois só é copiada.
 */
import { makeCanvas } from '../../kit';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; kind: 0 | 1 | 2 | 3; rot: number; vr: number; size: number; color: string; g: number }
export interface Pop { text: string; x: number; y: number; t: number; dur: number; color: string; size: number; vy: number; rot: number }

const MAX_PARTICLES = 90;
const MAX_POPS = 8;

interface TextImg { c: HTMLCanvasElement; w: number; h: number; ax: number; ay: number }
const textCache = new Map<string, TextImg>();
const FONT = '"Lilita One","Rajdhani",Impact,sans-serif';

/** Texto com contorno desenhado a partir de uma imagem em cache. */
export function txt(g: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, color = '#ffffff', align: CanvasTextAlign = 'center', alpha = 1, scale = 1, rot = 0) {
  if (typeof document === 'undefined') return;
  const k = Math.max(1, Math.round(g.getTransform().a * 2) / 2);
  const key = `${str}|${size}|${color}|${k}`;
  let e = textCache.get(key);
  if (!e) {
    if (textCache.size > 260) textCache.clear();
    const lw = Math.max(2, size * 0.22), pad = Math.ceil(lw + 2);
    const m = makeCanvas(8, 8).getContext('2d')!;
    m.font = `${size}px ${FONT}`;
    const tw = Math.ceil(m.measureText(str).width), w = tw + pad * 2, h = Math.ceil(size * 1.4) + pad * 2;
    const c = makeCanvas(w * k, h * k), cg = c.getContext('2d')!;
    cg.scale(k, k);
    cg.font = `${size}px ${FONT}`;
    cg.textBaseline = 'alphabetic';
    cg.lineJoin = 'round';
    cg.lineWidth = lw;
    cg.strokeStyle = '#170f2e';
    const by = pad + Math.ceil(size * 1.05);
    cg.strokeText(str, pad, by);
    cg.fillStyle = color;
    cg.fillText(str, pad, by);
    e = { c, w, h, ax: align === 'center' ? pad + tw / 2 : align === 'right' ? pad + tw : pad, ay: by };
    textCache.set(key, e);
  }
  const prev = g.globalAlpha;
  if (alpha !== 1) g.globalAlpha = prev * alpha;
  if (scale === 1 && rot === 0) g.drawImage(e.c, x - e.ax, y - e.ay, e.w, e.h);
  else {
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.scale(scale, scale);
    g.drawImage(e.c, -e.ax, -e.ay, e.w, e.h);
    g.restore();
  }
  g.globalAlpha = prev;
}

export class BoxFx {
  private p: Particle[] = [];
  private pops: Pop[] = [];
  shake = 0;
  private shakeT = 0;
  flash = 0;
  flashColor = '#ffffff';
  /** 0..1: linhas de velocidade (golpe final) */
  lines = 0;
  /** deslocamento atual da tremida (px lógicos) */
  sx = 0;
  sy = 0;

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) this.p.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, kind: 0, rot: 0, vr: 0, size: 1, color: '#fff', g: 0 });
  }

  reset() {
    for (const q of this.p) q.life = 0;
    this.pops.length = 0;
    this.shake = this.flash = this.lines = 0;
  }

  addShake(a: number, dur = 0.25) { if (a > this.shake) { this.shake = a; this.shakeT = dur; } }
  addFlash(a: number, color = '#ffffff') { this.flash = Math.max(this.flash, a); this.flashColor = color; }

  /** Rajada de partículas num ponto (kind: 0 faísca, 1 estrela, 2 folha, 3 dente). */
  burst(x: number, y: number, n: number, kind: 0 | 1 | 2 | 3, color: string, speed = 220, size = 3, grav = 600) {
    for (let i = 0; i < n; i++) {
      const q = this.p.find((a) => a.life <= 0);
      if (!q) return;
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.75);
      q.x = x; q.y = y; q.vx = Math.cos(a) * s; q.vy = Math.sin(a) * s - speed * 0.25; q.life = q.max = 0.5 + Math.random() * 0.6;
      q.kind = kind; q.rot = Math.random() * 6.28; q.vr = (Math.random() - 0.5) * 12; q.size = size * (0.7 + Math.random() * 0.7); q.color = color; q.g = grav;
    }
  }

  pop(text: string, x: number, y: number, color = '#ffe27a', size = 22, dur = 0.8) {
    if (this.pops.length >= MAX_POPS) this.pops.shift();
    this.pops.push({ text, x, y, t: 0, dur, color, size, vy: -26, rot: (Math.random() - 0.5) * 0.25 });
  }

  update(dt: number) {
    for (const q of this.p) {
      if (q.life <= 0) continue;
      q.life -= dt;
      q.vy += q.g * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
    }
    for (let i = this.pops.length - 1; i >= 0; i--) { const o = this.pops[i]; o.t += dt; o.y += o.vy * dt; if (o.t >= o.dur) this.pops.splice(i, 1); }
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      this.sx = (Math.random() - 0.5) * 2 * this.shake;
      this.sy = (Math.random() - 0.5) * 2 * this.shake;
      if (this.shakeT <= 0) { this.shake = 0; this.sx = this.sy = 0; }
    }
    this.flash = Math.max(0, this.flash - dt * 3);
    this.lines = Math.max(0, this.lines - dt * 1.4);
  }

  draw(g: CanvasRenderingContext2D) {
    for (const q of this.p) {
      if (q.life <= 0) continue;
      const a = Math.min(1, q.life / q.max * 2);
      g.globalAlpha = a;
      g.save();
      g.translate(q.x, q.y);
      g.rotate(q.rot);
      g.fillStyle = q.color;
      if (q.kind === 0) g.fillRect(-q.size, -q.size * 0.4, q.size * 2, q.size * 0.8);
      else if (q.kind === 1) { g.beginPath(); for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? q.size * 0.5 : q.size * 1.3; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); } g.closePath(); g.fill(); }
      else if (q.kind === 2) { g.beginPath(); g.ellipse(0, 0, q.size * 1.6, q.size * 0.8, 0, 0, Math.PI * 2); g.fill(); }
      else { g.fillStyle = '#fbf6e4'; g.beginPath(); g.moveTo(-q.size, q.size); g.lineTo(0, -q.size * 1.4); g.lineTo(q.size, q.size); g.closePath(); g.fill(); }
      g.restore();
    }
    g.globalAlpha = 1;
    for (const o of this.pops) {
      const k = o.t / o.dur;
      const s = k < 0.18 ? 0.5 + (k / 0.18) * 0.7 : 1.2 - (k - 0.18) * 0.3;
      txt(g, o.text, o.x, o.y, o.size, o.color, 'center', 1 - Math.max(0, (k - 0.6) / 0.4), s, o.rot);
    }
  }

  /** Linhas de velocidade e clarão (por cima de tudo). */
  drawOverlay(g: CanvasRenderingContext2D, W: number, H: number) {
    if (this.lines > 0.02) {
      g.save();
      g.globalAlpha = this.lines * 0.55;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      const cx = W / 2, cy = H * 0.45;
      g.beginPath();
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2 + (i % 3) * 0.04, r0 = 70 + (i % 5) * 18, r1 = Math.hypot(W, H);
        g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.7);
        g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      }
      g.stroke();
      g.restore();
    }
    if (this.flash > 0.01) {
      g.globalAlpha = Math.min(1, this.flash);
      g.fillStyle = this.flashColor;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
  }
}
