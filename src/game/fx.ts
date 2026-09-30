/** Sistema de partículas leve (pool) + popups de texto + luzes de flash. */
import { rand } from '../core/math';
import { softDot, glowSprite, drawSpr } from '../art/kit';

export const enum PK {
  Spark = 0, // risco aditivo
  Smoke = 1,
  Fire = 2, // brilho aditivo que encolhe
  Debris = 3, // retângulo com gravidade
  Casing = 4,
  Ring = 5, // onda de choque
  Dust = 6,
  Glint = 7, // brilho de estrela
  Ember = 8, // brasa flutuante (aditiva)
  Drop = 9, // gota/líquido
}

export interface Particle {
  kind: PK;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  size1: number;
  rot: number;
  vr: number;
  color: string;
  g: number;
  drag: number;
  a0: number;
  bounce: number;
  front: boolean;
  onGround: boolean;
}

export interface Popup {
  x: number;
  y: number;
  vy: number;
  life: number;
  max: number;
  text: string;
  color: string;
  size: number;
}

export interface FlashLight {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  color: string;
}

export class Fx {
  parts: Particle[] = [];
  pool: Particle[] = [];
  popups: Popup[] = [];
  lights: FlashLight[] = [];
  /** 0.25..1 — reduz spawn em qualidade baixa */
  density = 1;
  maxParts = 900;
  /** área visível (mundo) para descartar o desenho do que está fora da tela */
  view = { x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 };
  shake = 0;
  shakeT = 0;
  hitStop = 0;
  flash = 0; // flash branco de tela (0..1)
  flashColor = '#ffffff';
  slowmo = 0; // tempo restante de câmera lenta
  slowScale = 1;

  reset() {
    for (const p of this.parts) this.pool.push(p);
    this.parts.length = 0;
    this.popups.length = 0;
    this.lights.length = 0;
    this.shake = 0;
    this.hitStop = 0;
    this.flash = 0;
    this.slowmo = 0;
  }

  add(
    kind: PK,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    color: string,
    o: { size1?: number; g?: number; drag?: number; a0?: number; bounce?: number; front?: boolean; rot?: number; vr?: number } = {}
  ) {
    if (this.parts.length >= this.maxParts) return null;
    const p = this.pool.pop() ?? ({} as Particle);
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.max = life;
    p.size = size;
    p.size1 = o.size1 ?? size;
    p.rot = o.rot ?? 0;
    p.vr = o.vr ?? 0;
    p.color = color;
    p.g = o.g ?? 0;
    p.drag = o.drag ?? 0;
    p.a0 = o.a0 ?? 1;
    p.bounce = o.bounce ?? 0;
    p.front = o.front ?? false;
    p.onGround = false;
    this.parts.push(p);
    return p;
  }

  /** Aplica densidade: retorna true se esta partícula "opcional" deve ser criada. */
  opt() {
    return this.density >= 1 || Math.random() < this.density;
  }

  addShake(amount: number, dur = 0.25) {
    if (amount > this.shake) {
      this.shake = amount;
      this.shakeT = dur;
    }
  }
  addHitStop(t: number) {
    if (t > this.hitStop) this.hitStop = t;
  }
  addFlash(a: number, color = '#ffffff') {
    this.flash = Math.max(this.flash, a);
    this.flashColor = color;
  }
  light(x: number, y: number, r: number, life: number, color: string) {
    if (this.lights.length > 24) this.lights.shift();
    this.lights.push({ x, y, r, life, max: life, color });
  }
  popup(x: number, y: number, text: string, color = '#ffe27a', size = 9) {
    if (this.popups.length > 16) this.popups.shift();
    this.popups.push({ x, y, vy: -34, life: 0.9, max: 0.9, text, color, size });
  }

  update(dt: number, solidAt: (x: number, y: number) => boolean) {
    // partículas
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.push(p);
        this.parts[i] = this.parts[this.parts.length - 1];
        this.parts.pop();
        continue;
      }
      if (p.drag) {
        const d = Math.exp(-p.drag * dt);
        p.vx *= d;
        p.vy *= d;
      }
      p.vy += p.g * dt;
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      if (p.bounce > 0) {
        if (solidAt(nx, ny)) {
          if (!solidAt(p.x, ny)) {
            p.vx *= -p.bounce;
          } else {
            p.vy *= -p.bounce;
            p.vx *= 0.7;
            p.vr *= 0.6;
            if (Math.abs(p.vy) < 25) {
              p.vy = 0;
              p.onGround = true;
            }
          }
        } else {
          p.x = nx;
          p.y = ny;
        }
      } else {
        p.x = nx;
        p.y = ny;
      }
      p.rot += p.vr * dt;
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt;
      p.y += p.vy * dt;
      p.vy *= 0.94;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
    for (let i = this.lights.length - 1; i >= 0; i--) {
      this.lights[i].life -= dt;
      if (this.lights[i].life <= 0) this.lights.splice(i, 1);
    }
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      this.shake *= Math.exp(-6 * dt);
      if (this.shakeT <= 0 || this.shake < 0.05) this.shake = 0;
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.slowmo > 0) {
      this.slowmo -= dt;
      if (this.slowmo <= 0) this.slowScale = 1;
    }
  }

  draw(g: CanvasRenderingContext2D, front: boolean) {
    const v = this.view;
    // pass 1: normais; pass 2: aditivas
    for (const p of this.parts) {
      if (p.front !== front) continue;
      if (p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1) continue;
      const t = p.life / p.max;
      switch (p.kind) {
        case PK.Smoke:
        case PK.Dust: {
          const s = p.size1 + (p.size - p.size1) * t;
          const a = p.a0 * Math.min(1, t * 2.2) * (p.kind === PK.Dust ? 0.5 : 0.7) * (t > 0.85 ? (1 - t) / 0.15 : 1);
          if (a <= 0.01) break;
          const spr = softDot(p.color, 16);
          g.globalAlpha = a;
          g.drawImage(spr.c, p.x - s, p.y - s, s * 2, s * 2);
          g.globalAlpha = 1;
          break;
        }
        case PK.Debris: {
          const s = p.size;
          g.globalAlpha = Math.min(1, t * 3);
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          g.fillStyle = p.color;
          g.fillRect(-s / 2, -s / 3, s, s * 0.66);
          g.restore();
          g.globalAlpha = 1;
          break;
        }
        case PK.Casing: {
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          g.globalAlpha = Math.min(1, t * 4);
          g.fillStyle = p.color;
          g.fillRect(-1.4, -0.7, 2.8, 1.4);
          g.restore();
          g.globalAlpha = 1;
          break;
        }
        case PK.Drop: {
          g.globalAlpha = Math.min(1, t * 3);
          g.fillStyle = p.color;
          g.beginPath();
          g.arc(p.x, p.y, p.size, 0, 6.283);
          g.fill();
          g.globalAlpha = 1;
          break;
        }
        default:
          break;
      }
    }
    // aditivas
    g.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      if (p.front !== front) continue;
      if (p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1) continue;
      const t = p.life / p.max;
      switch (p.kind) {
        case PK.Spark: {
          const len = Math.max(1.5, p.size * (0.4 + t * 0.6));
          const sp = Math.hypot(p.vx, p.vy) || 1;
          g.globalAlpha = Math.min(1, t * 2.2) * p.a0;
          g.strokeStyle = p.color;
          g.lineWidth = Math.max(0.8, p.size1);
          g.beginPath();
          g.moveTo(p.x, p.y);
          g.lineTo(p.x - (p.vx / sp) * len, p.y - (p.vy / sp) * len);
          g.stroke();
          break;
        }
        case PK.Fire: {
          const s = p.size1 + (p.size - p.size1) * t;
          const spr = glowSprite(p.color, 24);
          g.globalAlpha = Math.min(1, t * 1.6) * p.a0;
          g.drawImage(spr.c, p.x - s, p.y - s, s * 2, s * 2);
          break;
        }
        case PK.Ember: {
          g.globalAlpha = Math.min(1, t * 3) * p.a0;
          g.fillStyle = p.color;
          g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          break;
        }
        case PK.Ring: {
          const s = p.size + (p.size1 - p.size) * (1 - t);
          g.globalAlpha = t * p.a0;
          g.strokeStyle = p.color;
          g.lineWidth = 2 + 4 * t;
          g.beginPath();
          g.arc(p.x, p.y, s, 0, 6.283);
          g.stroke();
          break;
        }
        case PK.Glint: {
          const s = p.size * (0.3 + 0.7 * Math.sin(t * Math.PI));
          g.globalAlpha = p.a0;
          g.strokeStyle = p.color;
          g.lineWidth = 1.2;
          g.beginPath();
          g.moveTo(p.x - s, p.y);
          g.lineTo(p.x + s, p.y);
          g.moveTo(p.x, p.y - s);
          g.lineTo(p.x, p.y + s);
          g.stroke();
          break;
        }
        default:
          break;
      }
    }
    g.globalAlpha = 1;
    if (front) {
      for (const l of this.lights) {
        const t = l.life / l.max;
        const spr = glowSprite(l.color, 32);
        g.globalAlpha = t * t;
        const r = l.r * (0.7 + 0.3 * (1 - t));
        g.drawImage(spr.c, l.x - r, l.y - r, r * 2, r * 2);
      }
      g.globalAlpha = 1;
    }
    g.globalCompositeOperation = 'source-over';
  }

  /** cache de popups (texto com contorno pré-desenhado): "+100", "ESMAGADO!"... se repetem muito */
  private popCache = new Map<string, { c: HTMLCanvasElement; w: number; h: number; ay: number }>();
  /** px de tela por unidade de mundo (para o texto ficar nítido) */
  popScale = 3;
  private popSprite(text: string, size: number, color: string) {
    const key = text + '|' + size + '|' + color;
    let e = this.popCache.get(key);
    if (e) return e;
    const k = this.popScale;
    const f = `bold ${size}px Rajdhani, sans-serif`;
    const mc = document.createElement('canvas').getContext('2d')!;
    mc.font = f;
    const pad = 3;
    const tw = Math.ceil(mc.measureText(text).width);
    const w = tw + pad * 2;
    const h = Math.ceil(size * 1.4) + pad * 2;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * k);
    c.height = Math.ceil(h * k);
    const cg = c.getContext('2d')!;
    cg.scale(k, k);
    cg.font = f;
    cg.textAlign = 'center';
    cg.lineWidth = 2.4;
    cg.lineJoin = 'round';
    cg.strokeStyle = '#170f2e';
    const by = pad + Math.ceil(size * 1.05);
    cg.strokeText(text, w / 2, by);
    cg.fillStyle = color;
    cg.fillText(text, w / 2, by);
    e = { c, w, h, ay: by };
    if (this.popCache.size > 120) this.popCache.delete(this.popCache.keys().next().value as string);
    this.popCache.set(key, e);
    return e;
  }

  drawPopups(g: CanvasRenderingContext2D) {
    if (!this.popups.length || typeof document === 'undefined') return;
    for (const p of this.popups) {
      g.globalAlpha = Math.min(1, (p.life / p.max) * 2);
      const e = this.popSprite(p.text, p.size, p.color);
      g.drawImage(e.c, p.x - e.w / 2, p.y - e.ay, e.w, e.h);
    }
    g.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ atalhos de efeito
  sparks(x: number, y: number, n: number, color = '#ffd27a', speed = 220, dirX = 0, dirY = 0, spread = Math.PI * 2) {
    n = Math.ceil(n * this.density);
    const base = Math.atan2(dirY, dirX);
    for (let i = 0; i < n; i++) {
      const a = dirX === 0 && dirY === 0 ? rand.range(0, 6.283) : base + rand.spread(spread / 2);
      const s = speed * rand.range(0.35, 1);
      this.add(PK.Spark, x, y, Math.cos(a) * s, Math.sin(a) * s, rand.range(0.12, 0.32), rand.range(5, 11), color, { size1: 1.2, drag: 3, front: true });
    }
  }

  smoke(x: number, y: number, n: number, color = '#555065', size = 14, up = 30, life = 0.9) {
    n = Math.ceil(n * this.density);
    for (let i = 0; i < n; i++) {
      this.add(PK.Smoke, x + rand.spread(4), y + rand.spread(4), rand.spread(22), -up * rand.range(0.5, 1.3), life * rand.range(0.7, 1.2), size * 1.4, color, { size1: size * 0.5, drag: 1.4, a0: 0.75 });
    }
  }

  debris(x: number, y: number, n: number, colors: string[], speed = 200) {
    n = Math.ceil(n * this.density);
    for (let i = 0; i < n; i++) {
      const a = rand.range(-Math.PI, 0);
      const s = speed * rand.range(0.3, 1);
      this.add(PK.Debris, x, y, Math.cos(a) * s, Math.sin(a) * s, rand.range(0.5, 1.1), rand.range(2.5, 6), rand.pick(colors), { g: 700, bounce: 0.45, vr: rand.spread(14), rot: rand.range(0, 6), front: true });
    }
  }

  explosion(x: number, y: number, size: number) {
    const s = size;
    this.add(PK.Ring, x, y, 0, 0, 0.32, s * 0.35, '#ffd9a0', { size1: s * 1.15, a0: 0.9, front: true });
    for (let i = 0; i < Math.ceil(7 * this.density); i++) {
      this.add(PK.Fire, x + rand.spread(s * 0.45), y + rand.spread(s * 0.45), rand.spread(60), rand.spread(60) - 20, rand.range(0.28, 0.55), s * rand.range(0.55, 0.95), rand.pick(['#ff9a2a', '#ffcf5a', '#ff5a1a']), { size1: s * 0.15, drag: 2, front: true });
    }
    this.add(PK.Fire, x, y, 0, 0, 0.22, s * 1.1, '#fff2c0', { size1: s * 0.4, front: true });
    this.smoke(x, y, 5, '#3c3550', s * 0.6, 40, 1.1);
    this.sparks(x, y, 12, '#ffc04d', s * 6);
    this.debris(x, y, 6, ['#3b3350', '#5a4f70', '#2a2440'], s * 5);
    this.light(x, y, s * 3.4, 0.35, '#ff9a3a');
  }
}
