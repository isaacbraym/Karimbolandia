/**
 * Água da selva: pântanos rasos (andar devagar, respingos) e o lago fundo (nado com traje de
 * mergulho, peixes, bolhas, luz). A simulação aqui não depende de arte; o desenho fica em
 * `art/waterDraw.ts`.
 */
import type { Level, WaterZone, DecoSpawn } from './level';
import { clamp } from '../core/math';

export interface Fish {
  kind: 0 | 1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** largura em px no mundo */
  size: number;
  /** -1 = olhando para a esquerda (como na foto), 1 = direita; `turn` suaviza a virada */
  dir: -1 | 1;
  turn: number;
  /** fase da cauda */
  ph: number;
  speed: number;
  tx: number;
  ty: number;
  /** 0 = ao fundo (escurecido pela água), 1 = meio (mesmo plano do Karimbo), 2 = na frente */
  layer: 0 | 1 | 2;
  /** índice do líder do cardume (-1 = sozinho) */
  lead: number;
  offX: number;
  offY: number;
  wait: number;
  scared: number;
  zone: WaterZone;
}

export interface Bubble {
  x: number;
  y: number;
  r: number;
  vy: number;
  ph: number;
  life: number;
  top: number;
}

export interface Ripple {
  x: number;
  y: number;
  t: number;
  max: number;
  r: number;
}

/** Semente estável (sem Math.random na criação: mesma fase = mesmos peixes). */
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Waters {
  zones: WaterZone[];
  fish: Fish[] = [];
  bubbles: Bubble[] = [];
  ripples: Ripple[] = [];
  vents: { x: number; y: number; t: number }[] = [];
  private level: Level;
  private rnd = mulberry(9001);
  time = 0;

  constructor(zones: WaterZone[], level: Level, decos: DecoSpawn[]) {
    this.zones = zones;
    this.level = level;
    for (const d of decos) if (d.kind === 'uVent') this.vents.push({ x: d.x, y: d.y - 4, t: 0 });
    this.spawnFish();
  }

  reset() {
    this.bubbles.length = 0;
    this.ripples.length = 0;
    this.fish.length = 0;
    this.rnd = mulberry(9001);
    this.spawnFish();
  }

  // ------------------------------------------------------------------ consultas
  /** Zona de água que contém o ponto (px). */
  zoneAt(x: number, y: number): WaterZone | null {
    for (const z of this.zones) if (x >= z.x && x < z.x + z.w && y >= z.y && y <= z.y + z.h) return z;
    return null;
  }
  /** Lago em que o ponto está submerso. */
  lakeAt(x: number, y: number): WaterZone | null {
    const z = this.zoneAt(x, y);
    return z && z.kind === 'lake' ? z : null;
  }
  /** Profundidade (px) do pântano nos pés (0 = seco). */
  wadeDepth(x: number, feetY: number): number {
    for (const z of this.zones) {
      if (z.kind !== 'swamp' || x < z.x || x >= z.x + z.w) continue;
      if (feetY > z.y && feetY <= z.y + z.h + 2) return feetY - z.y;
    }
    return 0;
  }

  // ------------------------------------------------------------------ peixes
  private freeAt(z: WaterZone, x: number, y: number, pad: number) {
    // margem vertical ~ meia altura do peixe: antes os grandes subiam até a superfície e o recorte do
    // lago cortava o alto da cabeça
    if (x < z.x + pad || x > z.x + z.w - pad || y < z.y + pad * 1.3 + 6 || y > z.y + z.h - pad * 1.1) return false;
    return !this.level.solidAtPx(x, y) && !this.level.solidAtPx(x - pad * 0.6, y) && !this.level.solidAtPx(x + pad * 0.6, y) && !this.level.solidAtPx(x, y + pad * 0.4);
  }

  private pickTarget(f: Fish) {
    const z = f.zone;
    const pad = Math.max(24, f.size * 0.6);
    for (let i = 0; i < 12; i++) {
      // nadam mais na horizontal (alvos largos e pouco altos)
      const x = f.x + (this.rnd() - 0.5) * Math.min(z.w, 900);
      const y = f.y + (this.rnd() - 0.5) * Math.min(z.h, 160);
      if (this.freeAt(z, x, y, pad)) {
        f.tx = x;
        f.ty = y;
        return;
      }
    }
    f.tx = z.x + z.w / 2;
    f.ty = z.y + z.h * 0.45;
  }

  private spawnFish() {
    for (const z of this.zones) {
      if (z.kind !== 'lake') continue;
      const area = (z.w * z.h) / 10000;
      const r = this.rnd;
      const add = (size: number, layer: 0 | 1 | 2, lead = -1, offX = 0, offY = 0): Fish | null => {
        let x = 0;
        let y = 0;
        let ok = false;
        for (let k = 0; k < 30 && !ok; k++) {
          x = z.x + 40 + r() * (z.w - 80);
          y = z.y + 30 + r() * (z.h - 60);
          ok = this.freeAt(z, x, y, Math.max(20, size * 0.5));
        }
        if (!ok) return null;
        const f: Fish = {
          kind: r() < 0.5 ? 0 : 1, x, y, vx: 0, vy: 0, size, dir: r() < 0.5 ? -1 : 1, turn: 1, ph: r() * 6.28,
          speed: (size < 44 ? 70 : size < 90 ? 46 : 30) * (0.8 + r() * 0.4), tx: x, ty: y, layer, lead, offX, offY, wait: r() * 2, scared: 0, zone: z,
        };
        f.turn = f.dir;
        this.fish.push(f);
        return f;
      };
      // gigantes lentos (2–3), médios solitários e cardumes de pequenos — densidade pelo tamanho do lago
      const nBig = Math.max(3, Math.round(area * 0.04));
      const nMid = Math.max(6, Math.round(area * 0.09));
      const nSchools = Math.max(3, Math.round(area * 0.05));
      for (let i = 0; i < nBig; i++) add(118 + r() * 46, i === 0 ? 2 : r() < 0.5 ? 1 : 0);
      for (let i = 0; i < nMid; i++) add(54 + r() * 36, r() < 0.45 ? 0 : 1);
      for (let s = 0; s < nSchools; s++) {
        const leader = add(30 + r() * 10, s % 2 === 0 ? 1 : 0);
        if (!leader) continue;
        const li = this.fish.length - 1;
        const kind = leader.kind;
        for (let k = 0; k < 6; k++) {
          const f = add(22 + r() * 14, leader.layer, li, -18 - (k % 3) * 22 - r() * 8, ((k % 2) * 2 - 1) * (10 + r() * 14));
          if (f) {
            f.kind = kind;
            const nx = leader.x + f.offX;
            const ny = leader.y + f.offY;
            if (this.freeAt(z, nx, ny, 16)) {
              f.x = nx;
              f.y = ny;
            }
          }
        }
      }
      // ao fundo, peixinhos distantes
      for (let i = 0; i < Math.max(5, Math.round(area * 0.08)); i++) add(18 + r() * 12, 0);
    }
  }

  // ------------------------------------------------------------------ simulação
  /** `px,py`: Karimbo (peixes fogem dele); `active`: o lago está perto da câmera. */
  update(dt: number, px: number, py: number, swimming: boolean, viewX0: number, viewX1: number) {
    this.time += dt;
    const near = (z: WaterZone) => z.x + z.w > viewX0 - 600 && z.x < viewX1 + 600;
    // peixes
    for (let i = 0; i < this.fish.length; i++) {
      const f = this.fish[i];
      if (!near(f.zone)) continue;
      const z = f.zone;
      const dxp = f.x - px;
      const dyp = f.y - py;
      const d2 = dxp * dxp + dyp * dyp;
      const fearR = 60 + f.size * 0.9;
      if (swimming && d2 < fearR * fearR && f.layer === 1) f.scared = 1.2;
      else if (swimming && d2 < fearR * fearR * 0.5) f.scared = Math.max(f.scared, 0.6);
      let tx: number;
      let ty: number;
      let spd = f.speed;
      if (f.scared > 0) {
        f.scared -= dt;
        const d = Math.sqrt(d2) || 1;
        tx = f.x + (dxp / d) * 200;
        ty = f.y + (dyp / d) * 90;
        spd *= 2.6;
      } else if (f.lead >= 0) {
        const L = this.fish[f.lead];
        const back = L.dir === 1 ? 1 : -1;
        tx = L.x + f.offX * back;
        ty = L.y + f.offY + Math.sin(this.time * 1.7 + i) * 4;
        spd = L.speed * 1.35 + 30;
      } else {
        if (f.wait > 0) {
          f.wait -= dt;
          spd *= 0.25;
        }
        const ddx = f.tx - f.x;
        const ddy = f.ty - f.y;
        if (ddx * ddx + ddy * ddy < 24 * 24) {
          this.pickTarget(f);
          f.wait = this.rnd() < 0.4 ? 0.6 + this.rnd() * 1.8 : 0;
        }
        tx = f.tx;
        ty = f.ty;
      }
      const ddx = tx - f.x;
      const ddy = ty - f.y;
      const dd = Math.hypot(ddx, ddy) || 1;
      const want = Math.min(spd, dd * 2.2);
      const ax = (ddx / dd) * want - f.vx;
      const ay = ((ddy / dd) * want) * 0.6 - f.vy;
      const k = clamp(dt * (f.scared > 0 ? 5 : 1.6), 0, 1);
      f.vx += ax * k;
      f.vy += ay * k;
      let nx = f.x + f.vx * dt;
      let ny = f.y + f.vy * dt;
      // nunca atravessa pedra nem sai da água
      const pad = Math.max(10, f.size * 0.35);
      if (!this.freeAt(z, nx, ny, pad)) {
        if (this.freeAt(z, nx, f.y, pad)) ny = f.y, (f.vy *= -0.4);
        else if (this.freeAt(z, f.x, ny, pad)) nx = f.x, (f.vx *= -0.4);
        else {
          nx = f.x;
          ny = f.y;
          f.vx *= -0.5;
          f.vy *= -0.5;
          if (f.lead < 0) this.pickTarget(f);
        }
      }
      f.x = nx;
      f.y = ny;
      if (Math.abs(f.vx) > 6) f.dir = f.vx > 0 ? 1 : -1;
      f.turn += (f.dir - f.turn) * clamp(dt * 7, 0, 1);
      f.ph += dt * (4 + Math.hypot(f.vx, f.vy) * 0.09) * (f.size < 40 ? 1.6 : 1);
      // bolhinha de vez em quando
      if (f.size > 50 && this.bubbles.length < 90 && Math.random() < dt * 0.25) this.addBubble(f.x + (f.turn < 0 ? -1 : 1) * f.size * 0.42, f.y - f.size * 0.1, 1.2 + Math.random() * 1.6, z.y);
    }
    // fontes de bolhas no fundo
    for (const v of this.vents) {
      if (v.x < viewX0 - 200 || v.x > viewX1 + 200) continue;
      v.t -= dt;
      if (v.t <= 0) {
        v.t = 0.08 + Math.random() * 0.35;
        const z = this.zoneAt(v.x, v.y);
        if (z) this.addBubble(v.x + (Math.random() - 0.5) * 8, v.y, 1 + Math.random() * 3, z.y);
      }
    }
    // bolhas
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.life += dt;
      b.vy = Math.max(-70 - b.r * 18, b.vy - 160 * dt);
      b.y += b.vy * dt;
      b.x += Math.sin(b.life * 7 + b.ph) * 14 * dt;
      if (b.y <= b.top + b.r) {
        if (b.r > 1.8 && this.ripples.length < 40) this.ripples.push({ x: b.x, y: b.top, t: 0, max: 0.7, r: 6 + b.r * 2 });
        this.bubbles.splice(i, 1);
      } else if (b.life > 9) this.bubbles.splice(i, 1);
    }
    // ondas na superfície
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.t += dt;
      if (r.t >= r.max) this.ripples.splice(i, 1);
    }
  }

  addBubble(x: number, y: number, r: number, top: number) {
    if (this.bubbles.length >= 110) return;
    this.bubbles.push({ x, y, r, vy: -20 - Math.random() * 30, ph: Math.random() * 6.28, life: 0, top });
  }

  ripple(x: number, y: number, r = 14, max = 0.8) {
    if (this.ripples.length >= 40) this.ripples.shift();
    this.ripples.push({ x, y, t: 0, max, r });
  }
}
