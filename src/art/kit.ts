/** Ferramentas de arte procedural: bake em canvas offscreen + helpers de estilo (contorno, sombreado). */
import { mixColor, shade } from '../core/math';

export let ART_SCALE = 2;
export const setArtScale = (s: number) => {
  ART_SCALE = s;
};

export const OUT = '#170f2e'; // contorno padrão (roxo quase preto)

export interface Sprite {
  c: HTMLCanvasElement;
  w: number; // tamanho lógico
  h: number;
  s: number; // escala de bake
  ox: number; // pivô lógico
  oy: number;
  white?: HTMLCanvasElement;
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/**
 * Desenha `fn` num canvas de w×h lógicos (× escala). Coordenadas dentro de `fn` são lógicas,
 * com origem no canto do sprite. `ox/oy` = pivô lógico (padrão: centro-base).
 */
export function bake(
  w: number,
  h: number,
  fn: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: { scale?: number; ox?: number; oy?: number } = {}
): Sprite {
  const s = opts.scale ?? ART_SCALE;
  const c = makeCanvas(w * s, h * s);
  const g = c.getContext('2d')!;
  g.scale(s, s);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  fn(g, w, h);
  return { c, w, h, s, ox: opts.ox ?? w / 2, oy: opts.oy ?? h };
}

export function whiteOf(spr: Sprite): HTMLCanvasElement {
  if (spr.white) return spr.white;
  const c = makeCanvas(spr.c.width, spr.c.height);
  const g = c.getContext('2d')!;
  g.drawImage(spr.c, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  spr.white = c;
  return c;
}

export interface DrawOpts {
  rot?: number;
  sx?: number;
  sy?: number;
  flip?: boolean;
  alpha?: number;
  white?: boolean;
  /** desenha o sprite normal e, por cima, uma máscara branca com este alpha (flash suave) */
  flash?: number;
  /** pivô extra (em coordenadas lógicas do sprite) — padrão spr.ox/oy */
  px?: number;
  py?: number;
}

/** Desenha um sprite com pivô em (x,y). */
export function drawSpr(g: CanvasRenderingContext2D, spr: Sprite, x: number, y: number, o: DrawOpts = {}) {
  const px = o.px ?? spr.ox;
  const py = o.py ?? spr.oy;
  const rot = o.rot ?? 0;
  const sx = (o.sx ?? 1) * (o.flip ? -1 : 1);
  const sy = o.sy ?? 1;
  const prevA = g.globalAlpha;
  if (o.alpha !== undefined) g.globalAlpha = prevA * o.alpha;
  const src = o.white ? whiteOf(spr) : spr.c;
  const fl = o.flash && !o.white ? o.flash : 0;
  if (rot === 0 && sx === 1 && sy === 1) {
    g.drawImage(src, x - px, y - py, spr.w, spr.h);
    if (fl) {
      g.globalAlpha *= fl;
      g.drawImage(whiteOf(spr), x - px, y - py, spr.w, spr.h);
      g.globalAlpha = o.alpha !== undefined ? prevA * o.alpha : prevA;
    }
  } else {
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.scale(sx, sy);
    g.drawImage(src, -px, -py, spr.w, spr.h);
    if (fl) {
      g.globalAlpha *= fl;
      g.drawImage(whiteOf(spr), -px, -py, spr.w, spr.h);
    }
    g.restore();
  }
  if (o.alpha !== undefined) g.globalAlpha = prevA;
}

// ------------------------------------------------------------------ paths e estilo
export function rrPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

export function vGrad(g: CanvasRenderingContext2D, y0: number, y1: number, ...stops: [number, string][]) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [t, c] of stops) gr.addColorStop(t, c);
  return gr;
}
export function hGrad(g: CanvasRenderingContext2D, x0: number, x1: number, ...stops: [number, string][]) {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  for (const [t, c] of stops) gr.addColorStop(t, c);
  return gr;
}

/** Retângulo arredondado sombreado (claro em cima, escuro embaixo) com contorno e brilho. */
export function shadedRR(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  base: string,
  o: { outline?: string; lw?: number; hi?: number; lo?: number; shine?: boolean } = {}
) {
  rrPath(g, x, y, w, h, r);
  g.fillStyle = vGrad(g, y, y + h, [0, shade(base, o.hi ?? 0.22)], [0.55, base], [1, shade(base, o.lo ?? -0.32)]);
  g.fill();
  if (o.shine !== false) {
    g.save();
    rrPath(g, x, y, w, h, r);
    g.clip();
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.fillRect(x, y, w, Math.max(1, h * 0.28));
    g.fillStyle = 'rgba(0,0,0,0.10)';
    g.fillRect(x + w * 0.62, y, w * 0.38, h);
    g.restore();
  }
  rrPath(g, x, y, w, h, r);
  g.lineWidth = o.lw ?? 1.2;
  g.strokeStyle = o.outline ?? OUT;
  g.stroke();
}

export function shadedEllipse(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  base: string,
  o: { outline?: string; lw?: number } = {}
) {
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  const gr = g.createRadialGradient(cx - rx * 0.35, cy - ry * 0.4, Math.min(rx, ry) * 0.1, cx, cy, Math.max(rx, ry));
  gr.addColorStop(0, shade(base, 0.35));
  gr.addColorStop(0.55, base);
  gr.addColorStop(1, shade(base, -0.4));
  g.fillStyle = gr;
  g.fill();
  g.lineWidth = o.lw ?? 1.2;
  g.strokeStyle = o.outline ?? OUT;
  g.stroke();
}

export function poly(
  g: CanvasRenderingContext2D,
  pts: [number, number][],
  fill: string | CanvasGradient,
  o: { outline?: string | null; lw?: number } = {}
) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (o.outline !== null) {
    g.lineWidth = o.lw ?? 1.2;
    g.strokeStyle = o.outline ?? OUT;
    g.stroke();
  }
}

export function rivet(g: CanvasRenderingContext2D, x: number, y: number, r = 0.9, c = '#ffffff33') {
  g.fillStyle = c;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

// ------------------------------------------------------------------ brilhos reutilizáveis
const glowCache = new Map<string, Sprite>();
/** Esfera de brilho (para blend 'lighter'). Tamanho lógico = 2r. */
export function glowSprite(color: string, r = 32): Sprite {
  const key = color + '|' + r;
  const hit = glowCache.get(key);
  if (hit) return hit;
  const spr = bake(
    r * 2,
    r * 2,
    (g) => {
      const gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, color);
      gr.addColorStop(0.35, mixColor(color, '#000000', 0.55) + '');
      gr.addColorStop(1, '#00000000');
      g.globalAlpha = 1;
      g.fillStyle = gr;
      g.fillRect(0, 0, r * 2, r * 2);
    },
    { scale: 1, ox: r, oy: r }
  );
  glowCache.set(key, spr);
  return spr;
}

/** Brilho suave com alpha real (útil sem 'lighter'). */
export function softDot(color: string, r = 16): Sprite {
  const key = 'dot|' + color + '|' + r;
  const hit = glowCache.get(key);
  if (hit) return hit;
  const spr = bake(
    r * 2,
    r * 2,
    (g) => {
      const gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, color);
      gr.addColorStop(1, color + '00');
      g.fillStyle = gr;
      g.fillRect(0, 0, r * 2, r * 2);
    },
    { scale: 1, ox: r, oy: r }
  );
  glowCache.set(key, spr);
  return spr;
}

export function clearArtCaches() {
  glowCache.clear();
}
