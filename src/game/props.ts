import { rand } from '../core/math';
import type { World } from './world';
import type { PropSpawn, PropKind, LootKind } from './level';
import { PK } from './fx';
import { getArt } from '../art';
import { drawSpr } from '../art/kit';

export type HurtSrc = 'bullet' | 'explosion' | 'dash' | 'melee';

interface PropDef {
  w: number;
  h: number;
  hp: number;
  solid: boolean;
  debris: string[];
  explosive?: boolean;
  loot?: LootKind;
}

const DEFS: Record<PropKind, PropDef> = {
  crate: { w: 30, h: 30, hp: 14, solid: true, debris: ['#a06a3c', '#c98a4e', '#6d4526'], loot: 'random' },
  crateBig: { w: 46, h: 46, hp: 30, solid: true, debris: ['#8a5a30', '#b57a44', '#5b3a1e'], loot: 'random' },
  barrel: { w: 24, h: 32, hp: 12, solid: true, debris: ['#e2384a', '#ff6a3a', '#3b3350'], explosive: true },
  barricade: { w: 52, h: 34, hp: 40, solid: true, debris: ['#8892a8', '#5b6580', '#3a3f55'] },
  container: { w: 96, h: 64, hp: 110, solid: true, debris: ['#3c8a9a', '#2a6a7a', '#1a3f4a'] },
  terminal: { w: 26, h: 36, hp: 22, solid: false, debris: ['#39f0ff', '#3a3f55', '#20233a'], loot: 'points' },
  sign: { w: 40, h: 26, hp: 10, solid: false, debris: ['#ff3fb4', '#39f0ff', '#20233a'] },
  lamp: { w: 12, h: 60, hp: 8, solid: false, debris: ['#ffd23a', '#3a3f55'] },
  wall: { w: 32, h: 96, hp: 60, solid: true, debris: ['#7d7896', '#5a5674', '#3d3a55'] },
  door: { w: 32, h: 96, hp: 999, solid: true, debris: ['#39f0ff', '#3a3f55'] },
  vehicle: { w: 110, h: 44, hp: 120, solid: true, debris: ['#c94a2a', '#8a2a1a', '#2a2440'], explosive: true },
  pipe: { w: 24, h: 64, hp: 24, solid: false, debris: ['#8892a8', '#5b6580'] },
  shutter: { w: 32, h: 96, hp: 44, solid: true, debris: ['#8892a8', '#3a3f55'] },
  generator: { w: 44, h: 40, hp: 50, solid: true, debris: ['#ffb83a', '#3a3f55', '#2a2440'], explosive: true },
  speaker: { w: 28, h: 40, hp: 20, solid: true, debris: ['#3a3f55', '#ff3fb4', '#20233a'] },
};

export class Prop {
  spawn: PropSpawn;
  kind: PropKind;
  x: number;
  y: number; // centro
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  alive = true;
  solid: boolean;
  loot: LootKind;
  flash = 0;
  shake = 0;
  explosive: boolean;
  dashOnly: boolean;
  critical: boolean;
  hittable: boolean;
  secret: boolean;
  seed: number;
  /** barreira de arena (energia): não destrutível */
  barrier = false;
  openT = 0;

  constructor(s: PropSpawn) {
    const d = DEFS[s.kind];
    this.spawn = s;
    this.kind = s.kind;
    this.w = s.w ?? d.w;
    this.h = s.h ?? d.h;
    this.x = s.x;
    this.y = s.y - this.h / 2;
    this.hp = this.maxHp = s.hp ?? d.hp;
    this.solid = s.solid ?? d.solid;
    this.loot = s.loot ?? d.loot ?? 'none';
    this.explosive = s.explosive ?? d.explosive ?? false;
    this.dashOnly = !!s.dashOnly;
    this.critical = !!s.critical;
    this.secret = !!s.secret;
    this.hittable = s.kind !== 'door' && !s.critical;
    this.seed = Math.random() * 100;
  }

  get rect() {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  hurt(w: World, dmg: number, src: HurtSrc, dir = 0): boolean {
    if (!this.alive || !this.hittable || this.barrier) return false;
    if (this.dashOnly && src !== 'dash' && src !== 'explosion') {
      // parede reforçada: só o avanço do Nômad (ou explosões grandes) quebra
      this.flash = 0.06;
      w.fx.sparks(this.x, this.y, 2, '#c8d0ff', 120);
      w.audio('hitMetal', 0.5, this.x);
      return false;
    }
    this.hp -= dmg;
    this.flash = 0.08;
    this.shake = 0.12;
    w.audio(this.kind === 'barricade' || this.kind === 'container' || this.kind === 'vehicle' ? 'hitMetal' : 'hit', 0.5, this.x);
    if (this.hp <= 0) this.destroy(w, src, dir);
    return true;
  }

  destroy(w: World, src: HurtSrc, dir = 0) {
    this.alive = false;
    w.destroyedProps.add(this.spawn.id);
    const d = DEFS[this.kind];
    w.fx.debris(this.x, this.y, 12, d.debris, 240);
    w.fx.smoke(this.x, this.y, 3, '#7d7896', 10, 24, 0.7);
    w.audio(this.explosive ? 'explosion' : 'crateBreak', 0.9, this.x);
    w.fx.addShake(this.explosive ? 5 : 1.8, 0.2);
    if (this.secret) {
      w.fx.sparks(this.x, this.y, 16, '#fff2a0', 260);
      w.fx.add(PK.Glint, this.x, this.y, 0, 0, 0.5, 14, '#fff2a0', { front: true });
    }
    if (this.explosive) {
      w.explode(this.x, this.y, this.kind === 'vehicle' ? 96 : 68, this.kind === 'vehicle' ? 70 : 50, src === 'bullet' ? 0 : 0, { kb: 280, propsToo: true });
    }
    w.dropLoot(this);
    w.score += 25;
    w.propBroken(this);
  }

  update(dt: number) {
    if (this.flash > 0) this.flash -= dt;
    if (this.shake > 0) this.shake -= dt;
  }

  draw(g: CanvasRenderingContext2D, t: number) {
    if (this.barrier) return; // barreiras de arena são desenhadas pelo Director
    const art = getArt().props;
    const spr = art[this.kind];
    if (!spr) return;
    const sh = this.shake > 0 ? Math.sin(this.shake * 90) * 1.2 : 0;
    drawSpr(g, spr, this.x + sh, this.y + this.h / 2, { white: this.flash > 0, px: spr.w / 2, py: spr.h - 1 });
    if (this.explosive && this.kind === 'barrel' && Math.sin(t * 6 + this.seed) > 0.6) {
      g.fillStyle = '#ffd23a';
      g.fillRect(this.x - 1, this.y - this.h / 2 + 5, 2, 2);
    }
  }
}

export function pickLoot(kind: LootKind, hasWeapons: Set<string>): string | null {
  if (kind === 'none') return null;
  if (kind === 'random') {
    // nem toda caixa tem algo: ~25% vazias; o resto varia entre moedas, munição, granada e armas
    const r = rand.next();
    if (r < 0.25) return null;
    if (r < 0.42) return 'tokens';
    if (r < 0.58) return 'ammo';
    if (r < 0.68) return 'health';
    if (r < 0.77) return 'nade';
    if (r < 0.83) return 'points';
    const pool = ['shotgun', 'rifle', 'launcher', 'energy'].filter((w) => !hasWeapons.has(w) || rand.chance(0.35));
    return pool.length ? rand.pick(pool) : 'ammo';
  }
  return kind;
}
