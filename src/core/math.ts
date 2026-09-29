export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sign = (v: number) => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const approach = (v: number, target: number, step: number) =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);
/** Suavização independente de frame: rate ≈ "por segundo". */
export const damp = (a: number, b: number, rate: number, dt: number) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
export const angleDiff = (a: number, b: number) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
export const rotateToward = (a: number, b: number, step: number) => {
  const d = angleDiff(a, b);
  return Math.abs(d) <= step ? b : a + Math.sign(d) * step;
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const rectsOverlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const pointInRect = (px: number, py: number, r: Rect) =>
  px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
export const circleRect = (cx: number, cy: number, cr: number, r: Rect) => {
  const nx = clamp(cx, r.x, r.x + r.w);
  const ny = clamp(cy, r.y, r.y + r.h);
  return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) <= cr * cr;
};

/** PRNG determinístico (mulberry32) — usado em geração de arte e nos testes. */
export class Rng {
  private s: number;
  constructor(seed = 1) {
    this.s = seed >>> 0;
  }
  next() {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number) {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number) {
    return Math.floor(this.range(a, b + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p: number) {
    return this.next() < p;
  }
}

/** RNG global do gameplay (não determinístico em runtime, mas substituível nos testes). */
export const rand = {
  fn: Math.random as () => number,
  next() {
    return this.fn();
  },
  range(a: number, b: number) {
    return a + (b - a) * this.fn();
  },
  spread(v: number) {
    return (this.fn() * 2 - 1) * v;
  },
  int(a: number, b: number) {
    return Math.floor(a + (b - a + 1) * this.fn());
  },
  chance(p: number) {
    return this.fn() < p;
  },
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.fn() * arr.length)];
  },
};

export const formatTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbToHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
export const mixColor = (a: string, b: string, t: number) => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(lerp(ca[0], cb[0], t), lerp(ca[1], cb[1], t), lerp(ca[2], cb[2], t));
};
export const shade = (hex: string, amt: number) =>
  amt >= 0 ? mixColor(hex, '#ffffff', amt) : mixColor(hex, '#000000', -amt);
