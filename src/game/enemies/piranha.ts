/**
 * Piranhas do lago da selva. Vivem em cardumes dentro de um território; enquanto o Karimbo fica
 * fora (com um raio de tolerância) elas circulam devagar em formação. Quando ele nada para dentro,
 * o cardume inteiro persegue: cada peixe tem a sua vaga em volta dele, sua fase e sua velocidade,
 * então nadam quase juntos — nunca idênticos. Mordem em dupla de quadros (boca aberta), morrem fácil
 * e desistem quando o Karimbo sai da água ou se afasta demais. A simulação não usa arte.
 */
import { Enemy, type HurtInfo } from './enemy';
import type { World } from '../world';
import type { EnemySpawn } from '../level';
import { clamp } from '../../core/math';
import { PK } from '../fx';
import { getJungle } from '../../art/jungle';

interface School {
  hx: number;
  hy: number;
  /** raio do território (px) */
  radius: number;
  aggro: boolean;
  calm: number;
  stamp: number;
}
/** tolerância além do território antes de o cardume reagir */
export const PIRANHA_TOLERANCE = 56;
export const PIRANHA_RADIUS = 150;
const schools = new WeakMap<World, Map<number, School>>();
/** Pseudoaleatório estável por peixe (não consome o gerador da simulação). */
const hash = (n: number, k: number) => {
  let h = Math.imul((n + 1) * 374761393 + k * 668265263, 0x27d4eb2d);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

/** Algum cardume de piranhas alerta com o território a menos de `r` px do ponto? */
export function piranhasAggro(w: World, x: number, y: number, r: number): boolean {
  const map = schools.get(w);
  if (!map) return false;
  for (const sc of map.values()) if (sc.aggro && Math.hypot(sc.hx - x, sc.hy - y) < r + sc.radius) return true;
  return false;
}

export function schoolFor(w: World, s: EnemySpawn): School {
  let map = schools.get(w);
  if (!map) schools.set(w, (map = new Map()));
  const id = s.school ?? s.id;
  let sc = map.get(id);
  if (!sc) map.set(id, (sc = { hx: s.homeX ?? s.x, hy: s.homeY ?? s.y, radius: PIRANHA_RADIUS, aggro: false, calm: 0, stamp: -1 }));
  return sc;
}

export class Piranha extends Enemy {
  readonly species: 1 | 2;
  /** comprimento desenhado (px) */
  readonly len: number;
  private slotX: number;
  private slotY: number;
  private phase: number;
  private speedK: number;
  biteT = 0;
  private biteCd = 0;
  private turn = 1;
  private school: School | null = null;

  constructor(s: EnemySpawn) {
    const species = s.species ?? 1;
    const r = (k: number) => hash(s.id, k);
    // espécie 1: pequena-média; espécie 2: média (nada de piranha grande por enquanto)
    const len = species === 1 ? 30 + r(1) * 10 : 44 + r(1) * 10;
    super(s, { hp: species === 1 ? 6 : 10, w: len * 0.78, h: len * 0.55, score: species === 1 ? 35 : 55, wake: 760, tokens: [0, 1] });
    this.species = species;
    this.len = len;
    this.flying = true;
    this.gravity = 0;
    this.phase = r(2) * Math.PI * 2;
    this.speedK = 0.86 + r(3) * 0.3;
    // vaga em volta do alvo (formação em elipse com bagunça própria)
    const a = r(4) * Math.PI * 2;
    const d = 18 + r(5) * 48;
    this.slotX = Math.cos(a) * d * 1.3;
    this.slotY = Math.sin(a) * d * 0.7;
    this.biteCd = r(6);
  }

  hurt(w: World, dmg: number, info: HurtInfo): number {
    // atirou num peixe: o cardume inteiro vem
    const sc = this.school ?? schoolFor(w, this.spawn);
    sc.aggro = true;
    sc.calm = 0;
    return super.hurt(w, dmg, info);
  }

  update(w: World, dt: number) {
    this.tickCommon(dt);
    const sc = (this.school ??= schoolFor(w, this.spawn));
    const p = w.player;
    const inWater = p.swimming && p.mode === 'foot' && p.targetable;
    // decisão do cardume uma vez por quadro (o primeiro peixe atualizado decide por todos)
    if (sc.stamp !== w.time) {
      sc.stamp = w.time;
      const d = Math.hypot(p.x - sc.hx, p.y - sc.hy);
      if (!sc.aggro && inWater && d < sc.radius + PIRANHA_TOLERANCE) {
        sc.aggro = true;
        sc.calm = 0;
        w.hooks.onBanner?.('CARDUME!', 'Piranhas defendem o território', 1.4);
      } else if (sc.aggro) {
        const lost = !inWater || d > sc.radius * 3.4 || p.mode === 'dead';
        sc.calm = lost ? sc.calm + dt : 0;
        if (sc.calm > 1.6) sc.aggro = false;
      }
    }
    const b = this.body;
    const t = w.time;
    let tx: number;
    let ty: number;
    let max: number;
    let acc: number;
    // O alerta tem memória para uma reentrada, mas não permite perseguir/morder fora da água.
    const pursuing = sc.aggro && inWater;
    if (pursuing) {
      tx = p.x + this.slotX * 0.42 + Math.sin(t * 3.1 + this.phase) * 10;
      ty = p.y - 12 + this.slotY * 0.42 + Math.cos(t * 2.7 + this.phase) * 8;
      max = (this.species === 1 ? 178 : 158) * this.speedK;
      acc = 520;
    } else {
      // passeio em formação, sincronizado pela fase do cardume e embaralhado pela de cada peixe
      tx = sc.hx + Math.cos(t * 0.42 + sc.hx * 0.01) * sc.radius * 0.5 + this.slotX + Math.sin(t * 1.3 + this.phase) * 7;
      ty = sc.hy + Math.sin(t * 0.57 + sc.hy * 0.01) * sc.radius * 0.22 + this.slotY + Math.cos(t * 1.1 + this.phase) * 5;
      max = 58 * this.speedK;
      acc = 170;
    }
    const dx = tx - b.x;
    const dy = ty - b.y;
    const dist = Math.hypot(dx, dy) || 1;
    const want = Math.min(max, dist * 3);
    const vx = (dx / dist) * want;
    const vy = (dy / dist) * want;
    b.vx += clamp(vx - b.vx, -acc * dt, acc * dt) + this.kbx;
    b.vy += clamp(vy - b.vy, -acc * dt, acc * dt);
    this.kbx = 0;
    // anda eixo a eixo e nunca sai da água nem entra na pedra
    const L = w.level;
    const nx = b.x + b.vx * dt;
    if (L.solidAtPx(nx + Math.sign(b.vx) * b.w * 0.5, b.y) || !w.water.lakeAt(nx, b.y)) b.vx *= -0.4;
    else b.x = nx;
    const ny = b.y + b.vy * dt;
    if (L.solidAtPx(b.x, ny + Math.sign(b.vy) * b.h * 0.5) || !w.water.lakeAt(b.x, ny - b.h * 0.3)) b.vy *= -0.4;
    else b.y = ny;
    // vira com histerese (não pisca de lado a lado)
    if (b.vx > 18) this.turn = 1;
    else if (b.vx < -18) this.turn = -1;
    this.facing = this.turn as 1 | -1;
    // mordida
    if (this.biteT > 0) this.biteT -= dt;
    if (this.biteCd > 0) this.biteCd -= dt;
    if (pursuing && this.biteCd <= 0 && Math.abs(p.x - b.x) < this.len * 0.5 + 12 && Math.abs(p.y - 12 - b.y) < 30) {
      this.biteT = 0.24;
      this.biteCd = 0.85 + hash(this.spawn.id, 7 + Math.floor(t)) * 0.6;
      p.nibble(w, this.species === 1 ? 4 : 6, b.x + this.facing * this.len * 0.4, b.y);
      w.audio('hit', 0.3, b.x);
    }
  }

  protected onDeath(w: World) {
    // nuvenzinha vermelha, bolhas e escamas: sem explosão de robô
    w.fx.add(PK.Ring, this.x, this.y, 0, 0, 0.35, 6, '#ff9a8a', { size1: this.len * 0.9, a0: 0.5 });
    for (let i = 0; i < 6; i++) w.fx.add(PK.Spark, this.x, this.y, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, 0.35, 3, i % 2 ? '#ff6a5a' : '#ffd0a0');
    for (let i = 0; i < 5; i++) w.water.addBubble(this.x + (Math.random() - 0.5) * 12, this.y, 1 + Math.random() * 2, this.y - 600);
    w.audio('splash', 0.3, this.x);
  }

  drops(w: World) {
    if (this.silentDeath) return;
    if (Math.random() < 0.35) w.spawnDrop('token', this.x, this.y);
    if (w.wantsHealthDrop()) w.spawnDrop('health', this.x, this.y);
  }

  draw(g: CanvasRenderingContext2D, w: World) {
    const art = getJungle()?.piranhas[this.species - 1];
    if (!art) return;
    const b = this.body;
    const L = this.len;
    const H = L * art.aspect;
    const frame = this.biteT > 0 ? art.b : art.a;
    g.save();
    g.translate(b.x, b.y);
    // a foto olha para a ESQUERDA: espelha quando nada para a direita; inclina com a subida/descida
    const tilt = clamp(b.vy / 320, -0.45, 0.45);
    g.rotate(tilt * this.facing);
    const wag = 1 + Math.sin(w.time * (this.biteT > 0 ? 22 : 13) + this.phase) * 0.05;
    g.scale(-this.facing * wag, 1);
    if (this.flash > 0) g.globalAlpha = 0.55;
    g.drawImage(frame, -L / 2, -H / 2, L, H);
    g.restore();
  }
}
