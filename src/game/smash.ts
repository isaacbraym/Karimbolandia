/**
 * Cenário urbano destrutível: carros estacionados, lixeiras, hidrantes, bancos, árvores, postes…
 * O Nômad destrói tudo isso só de passar por cima, e explosões (granadas, barris, lança-granadas)
 * também. Carros explodem e viram carcaças em chamas; hidrantes viram gêiseres (que lançam o
 * Karimbo para cima!); lixeiras espalham papel; máquinas de venda soltam moedas.
 */
import type { World } from './world';
import type { DecoSpawn } from './level';
import { PK } from './fx';
import { rand } from '../core/math';
import { decoScale } from '../art/decor';

type SmashKind = 'car' | 'light' | 'heavy' | 'hydrant' | 'tree' | 'pole' | 'barrel';
interface SmashDef {
  k: SmashKind;
  hw: number; // meia largura (unidades locais, antes da escala)
  h: number; // altura
  debris: string[];
}
const SMASH: Record<string, SmashDef> = {
  parkedCar: { k: 'car', hw: 58, h: 50, debris: ['#d94a7a', '#3aa6d9', '#243a5a', '#111111'] },
  wreckCar: { k: 'car', hw: 50, h: 36, debris: ['#2c2148', '#4a3a5a', '#111111'] },
  trashCans: { k: 'light', hw: 22, h: 34, debris: ['#5a6a8a', '#7a8aaa', '#e8e8f0'] },
  hydrant: { k: 'hydrant', hw: 12, h: 32, debris: ['#e0453a', '#ffd23a'] },
  bench: { k: 'light', hw: 30, h: 38, debris: ['#3a2f5c', '#2a2244'] },
  dumpster: { k: 'heavy', hw: 36, h: 50, debris: ['#2f7a5a', '#245f46', '#1c4a37'] },
  roadBarrier: { k: 'light', hw: 34, h: 30, debris: ['#e8e8f0', '#ff7a2a', '#5a5674'] },
  vending: { k: 'heavy', hw: 20, h: 70, debris: ['#2a4a9a', '#9fe9ff', '#ff5a7a', '#ffd23a'] },
  crateStack: { k: 'light', hw: 30, h: 56, debris: ['#a06a3c', '#8a5a30', '#b07a44'] },
  fireBarrel: { k: 'barrel', hw: 10, h: 26, debris: ['#4a3a3a', '#2a2020', '#ff9a3a'] },
  streetTree: { k: 'tree', hw: 22, h: 110, debris: ['#2f8a6a', '#3aa87a', '#3a2a4a'] },
  kiosk: { k: 'heavy', hw: 34, h: 78, debris: ['#2a2058', '#3aa6d9', '#ffd7a0'] },
  lampPost: { k: 'pole', hw: 6, h: 70, debris: ['#2c2560', '#ffe9a8'] },
  trafficLight: { k: 'pole', hw: 6, h: 120, debris: ['#2c2560', '#ff3a4a', '#3aff8a'] },
};

interface Geyser {
  x: number;
  y: number;
  t: number;
}

export class Smasher {
  /** índices (em data.decos) destrutíveis, ordenados por x */
  private idx: number[] = [];
  private xs: number[] = [];
  smashed = new Set<number>();
  /** decorações criadas em jogo (carcaças em chamas no lugar dos carros) */
  extra: DecoSpawn[] = [];
  geysers: Geyser[] = [];

  constructor(private w: World) {
    const d = w.data.decos;
    const list: number[] = [];
    for (let i = 0; i < d.length; i++) if (d[i].layer === 'back' && SMASH[d[i].kind]) list.push(i);
    list.sort((a, b) => d[a].x - d[b].x);
    this.idx = list;
    this.xs = list.map((i) => d[i].x);
  }

  reset() {
    this.smashed.clear();
    this.extra = [];
    this.geysers = [];
  }

  private lower(x: number) {
    let lo = 0;
    let hi = this.xs.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (this.xs[m] < x) lo = m + 1;
      else hi = m;
    }
    return lo;
  }

  /** Destrói decorações cuja caixa cruza a área (x0..x1, y0..y1). Retorna quantas quebrou. */
  area(x0: number, x1: number, y0: number, y1: number, dir: number, cause: 'nomad' | 'blast') {
    const d = this.w.data.decos;
    let n = 0;
    for (let k = this.lower(x0 - 140); k < this.idx.length && this.xs[k] <= x1 + 140; k++) {
      const i = this.idx[k];
      if (this.smashed.has(i)) continue;
      const dc = d[i];
      const def = SMASH[dc.kind];
      const s = decoScale(dc);
      const hw = def.hw * s;
      const top = dc.y - def.h * s;
      if (dc.x + hw < x0 || dc.x - hw > x1 || dc.y < y0 || top > y1) continue;
      this.smash(i, dc, def, s, dir, cause);
      n++;
    }
    return n;
  }

  private smash(i: number, dc: DecoSpawn, def: SmashDef, s: number, dir: number, cause: 'nomad' | 'blast') {
    const w = this.w;
    const fx = w.fx;
    this.smashed.add(i);
    const x = dc.x;
    const y = dc.y;
    const cy = y - def.h * s * 0.45;
    fx.debris(x, cy, def.k === 'light' ? 10 : 16, def.debris, def.k === 'heavy' ? 300 : 360);
    w.score += def.k === 'car' ? 120 : 30;
    switch (def.k) {
      case 'car': {
        w.audio('bigExplosion', 1, x);
        // explosão de verdade: fere inimigos em volta e quebra o que estiver perto
        w.after(0.08, () => w.explode(x, y - 24 * s, 88, 55, 0, { kb: 360, big: true }));
        fx.add(PK.Ring, x, y - 20, 0, 0, 0.5, 20, '#ffcf5a', { size1: 120, a0: 0.8, front: true });
        for (let k = 0; k < 4; k++) fx.debris(x + rand.spread(40), y - 20, 3, ['#111111', '#333344'], 420);
        fx.popup(x, y - 70, 'KABUM! +120', '#ffcf5a', 11);
        if (dc.kind === 'parkedCar') this.extra.push({ kind: 'wreckCar', x, y, layer: 'back', flip: dc.flip, scale: dc.scale });
        for (let k = 0; k < 3; k++) w.spawnDrop('token', x + rand.spread(30), y - 30);
        break;
      }
      case 'barrel':
        w.audio('explosion', 1, x);
        w.explode(x, y - 14, 70, 45, 0, { kb: 300 });
        break;
      case 'hydrant':
        w.audio('crateBreak', 0.9, x);
        w.audio('hitMetal', 0.7, x);
        this.geysers.push({ x, y: y - 20 * s, t: 0 });
        break;
      case 'tree':
        w.audio('crateBreak', 1, x);
        for (let k = 0; k < 26; k++) {
          fx.add(PK.Debris, x + rand.spread(40 * s), y - rand.range(40, 110) * s, rand.spread(260) + dir * 80, -rand.range(60, 260), rand.range(0.8, 1.6), rand.range(4, 7), rand.pick(['#2f8a6a', '#3aa87a', '#4ac08a']), { g: 260, drag: 1.2, vr: rand.spread(8) });
        }
        break;
      case 'pole':
        w.audio('hitMetal', 1, x);
        w.audio('spark', 0.8, x);
        fx.sparks(x, y - def.h * s, 22, '#9fe9ff', 360);
        fx.light(x, y - def.h * s, 120, 0.25, '#9fe9ff');
        break;
      case 'heavy':
        w.audio('hitMetal', 1, x);
        w.audio('crateBreak', 0.8, x);
        fx.sparks(x, cy, 14, '#ffd27a', 300);
        for (let k = 0; k < (dc.kind === 'vending' ? 4 : 2); k++) w.spawnDrop('token', x + rand.spread(20), cy);
        if (dc.kind === 'vending' && rand.chance(0.35)) w.spawnDrop('ammo', x, cy);
        break;
      default:
        w.audio('crateBreak', 0.9, x);
        if (dc.kind === 'trashCans') {
          // papel voando
          for (let k = 0; k < 14; k++) fx.add(PK.Debris, x + rand.spread(16), y - 20, rand.spread(200) + dir * 60, -rand.range(80, 240), rand.range(1, 2), rand.range(3, 5), '#e8e8f0', { g: 120, drag: 1.6, vr: rand.spread(10) });
        }
        if (rand.chance(0.35)) w.spawnDrop('token', x, cy);
        break;
    }
    fx.addShake(def.k === 'car' ? 6 : cause === 'nomad' ? 2.4 : 1.5, 0.18);
    if (cause === 'nomad' && def.k !== 'car') w.audio('crush', 0.8, x);
  }

  update(dt: number) {
    const w = this.w;
    for (const g of this.geysers) {
      g.t += dt;
      if (g.t > 4.5) continue;
      const k = g.t < 0.3 ? g.t / 0.3 : g.t > 3.8 ? (4.5 - g.t) / 0.7 : 1;
      const n = Math.ceil(5 * k * w.fx.density);
      for (let j = 0; j < n; j++) {
        w.fx.add(PK.Drop, g.x + rand.spread(5), g.y, rand.spread(70), -rand.range(360, 560) * k, rand.range(0.6, 1.1), rand.range(1.6, 2.8), rand.pick(['#9fe0ff', '#c8f2ff', '#6ac8ff']), { g: 900 });
      }
      if (Math.random() < dt * 20) w.fx.add(PK.Smoke, g.x + rand.spread(10), g.y - rand.range(40, 120) * k, rand.spread(20), -20, 0.8, 16, '#dff4ff', { size1: 30, a0: 0.25 });
      // gêiser lança quem estiver em cima
      const p = w.player;
      if (k > 0.5 && Math.abs(p.x - g.x) < 18 + p.body.w / 2 && p.feetY > g.y - 140 && p.feetY < g.y + 30 && p.body.vy > -300) {
        p.body.vy = p.mounted ? -520 : -640;
        p.body.onGround = false;
        w.audio('flap', 0.8, g.x);
      }
    }
    this.geysers = this.geysers.filter((g) => g.t < 4.6);
  }
}
