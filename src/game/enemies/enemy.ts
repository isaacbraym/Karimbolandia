import { newBody, moveBody, groundAt, type Body } from '../physics';
import type { World } from '../world';
import type { EnemySpawn, EnemyType } from '../level';
import type { Bullet } from '../bullets';
import { rand } from '../../core/math';
import { PK } from '../fx';
import type { Rect } from '../../core/math';

export interface HurtInfo {
  kx: number;
  ky: number;
  x: number;
  y: number;
  type: 'bullet' | 'explosion' | 'dash' | 'melee';
  dir: number;
  bullet?: Bullet;
  crit?: boolean;
}

export interface EnemyStats {
  hp: number;
  w: number;
  h: number;
  score: number;
  wake: number; // distância horizontal de ativação
  tokens: [number, number];
  metal?: boolean; // som/faíscas metálicas
}

export abstract class Enemy {
  spawn: EnemySpawn;
  type: EnemyType;
  body: Body;
  hp: number;
  maxHp: number;
  facing: 1 | -1;
  alive = true;
  awake = false;
  canBeHit = true;
  flash = 0;
  score: number;
  isBoss = false;
  t = 0;
  stats: EnemyStats;
  kbx = 0; // velocidade de empurrão externa
  gravity = 1500;
  flying = false;
  /** morreu por queda/fora do mundo: sem drops */
  silentDeath = false;
  spawnedByArena = false;
  invulnerable = false;
  lastHurt = 0;
  deadT = 0;
  contactDmg = 0;
  flashCd = 0;

  constructor(spawn: EnemySpawn, stats: EnemyStats) {
    this.spawn = spawn;
    this.type = spawn.type;
    this.stats = stats;
    this.body = newBody(stats.w, stats.h);
    this.body.x = spawn.x;
    this.body.y = spawn.y - stats.h / 2;
    this.hp = this.maxHp = stats.hp;
    this.facing = spawn.facing ?? (Math.random() < 0.5 ? -1 : 1);
    this.score = stats.score;
  }

  get x() {
    return this.body.x;
  }
  get y() {
    return this.body.y;
  }
  get feetY() {
    return this.body.y + this.body.h / 2;
  }
  get hitbox(): Rect {
    const b = this.body;
    return { x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h };
  }
  get center() {
    return { x: this.body.x, y: this.body.y };
  }

  abstract update(w: World, dt: number): void;
  abstract draw(g: CanvasRenderingContext2D, w: World): void;

  /** Aplica dano. Retorna dano efetivo (0..), ou -1 se bloqueado (escudo). */
  hurt(w: World, dmg: number, info: HurtInfo): number {
    if (!this.alive || this.invulnerable) return 0;
    this.hp -= dmg;
    if (this.flashCd <= 0) {
      this.flash = 0.05;
      this.flashCd = 0.14;
    }
    this.lastHurt = this.t;
    this.awake = true;
    this.kbx += info.kx * (this.stats.hp > 150 ? 0.25 : 1);
    if (!this.flying && this.body.onGround && info.ky < 0 && this.stats.hp < 100) this.body.vy = Math.min(this.body.vy, info.ky * 2.2);
    if (this.flying) {
      this.body.vx += info.kx * 0.5;
      this.body.vy += info.ky * 0.5;
    }
    w.fx.sparks(info.x, info.y, this.stats.metal ? 5 : 3, this.stats.metal ? '#ffe9a0' : '#ffb0b0', 180, -info.dir, 0, 1.6);
    w.audio(this.stats.metal ? 'hitMetal' : 'hit', 0.6, this.x);
    if (info.type !== 'explosion') w.fx.addHitStop(dmg >= 20 ? 0.03 : 0.012);
    if (this.hp <= 0) this.kill(w, info);
    else if (!this.stats.metal) w.audio('enemyHurt', 0.35, this.x);
    return dmg;
  }

  kill(w: World, info?: HurtInfo) {
    if (!this.alive) return;
    this.alive = false;
    this.deadT = 0;
    w.fx.addHitStop(0.045);
    w.onEnemyKilled(this, info);
    this.onDeath(w, info);
  }

  protected onDeath(w: World, _info?: HurtInfo) {
    w.fx.explosion(this.x, this.y, 22);
    w.audio('robotDie', 0.9, this.x);
  }

  // -------------------------------------------------------------- percepção
  distToPlayer(w: World) {
    const p = w.player;
    return Math.hypot(p.x - this.x, p.y - this.y);
  }
  dxToPlayer(w: World) {
    return w.player.x - this.x;
  }
  canSee(w: World, maxDist = 520): boolean {
    const p = w.player;
    if (!p.targetable) return false;
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    if (dx * dx + dy * dy > maxDist * maxDist) return false;
    return w.level.rayHit(this.x, this.y - this.body.h * 0.3, p.x, p.y - p.body.h * 0.2) < 0;
  }
  faceToward(x: number) {
    this.facing = x >= this.x ? 1 : -1;
  }
  aimAngleTo(w: World, ox: number, oy: number, lead = 0) {
    const p = w.player;
    const tx = p.x + p.body.vx * lead;
    // mira na altura do peito EM PÉ: agachar desvia de tiros retos (como nos clássicos)
    const chest = p.mounted ? p.y : p.feetY - 42;
    const ty = chest + p.body.vy * lead * 0.5;
    return Math.atan2(ty - oy, tx - ox);
  }

  // -------------------------------------------------------------- movimento
  /** Movimento terrestre padrão (gravidade + colisão + empurrão). */
  physics(w: World, dt: number) {
    const b = this.body;
    b.vy += this.gravity * dt;
    if (b.vy > 900) b.vy = 900;
    const ovx = b.vx;
    b.vx += this.kbx;
    this.kbx = 0;
    moveBody(b, dt, w.level, w.solidRects, true);
    if (b.wallDir === 0) {
      /* mantém */
    }
    void ovx;
    if (b.y > w.level.pxH + 120) {
      this.silentDeath = true;
      this.alive = false;
      w.onEnemyKilled(this, undefined);
    }
  }
  /** Existe chão à frente (evita cair de plataformas). */
  ledgeAhead(w: World, dist = 14): boolean {
    return groundAt(w.level, this.x + this.facing * (this.body.w / 2 + dist), this.feetY, 3);
  }

  tickCommon(dt: number) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.flashCd > 0) this.flashCd -= dt;
  }

  /** Empurrão de corpo (inimigos não se sobrepõem totalmente). */
  drops(w: World) {
    if (this.silentDeath) return;
    const [a, b] = this.stats.tokens;
    const n = rand.int(a, b);
    for (let i = 0; i < n; i++) w.spawnDrop('token', this.x, this.y - 8);
    if (w.wantsHealthDrop()) w.spawnDrop('health', this.x, this.y - 8);
    else if (rand.chance(0.2)) w.spawnDrop('ammo', this.x, this.y - 8);
    else if (rand.chance(0.07)) w.spawnDrop('nade', this.x, this.y - 8);
  }

  fireBullet(w: World, x: number, y: number, ang: number, speed: number, dmg: number, kind: 'enemy' | 'orb' | 'sniper' | 'missile' | 'bossShell' | 'bossOrb' = 'enemy', extra: Partial<{ life: number; homing: number; gravity: number; explode: { radius: number; dmg: number } | null; turnDelay: number; r: number; color: string; trail: string }> = {}) {
    w.spawnEnemyBullet(x, y, ang, speed, dmg, kind, extra);
  }

  muzzleFlash(w: World, x: number, y: number, ang: number, size = 1) {
    w.fx.light(x, y, 55 * size, 0.06, '#ff9a6a');
    w.fx.add(PK.Fire, x, y, 0, 0, 0.08, 9 * size, '#ffd27a', { size1: 3, front: true });
    if (w.fx.opt()) w.fx.add(PK.Spark, x, y, Math.cos(ang) * 200, Math.sin(ang) * 200, 0.1, 8, '#fff2b0', { size1: 1, front: true });
  }
}
