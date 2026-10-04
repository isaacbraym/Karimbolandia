import { newBody, moveBody, groundAt, type Body } from '../physics';
import type { World } from '../world';
import type { EnemySpawn, EnemyType } from '../level';
import type { Bullet } from '../bullets';
import { rand } from '../../core/math';
import { PK } from '../fx';
import type { Rect } from '../../core/math';
import { difficulty, stageAggro, stageHp } from '../../core/difficulty';
import { weaponEffect, type ArmorClass } from '../weapons';

/** Classe de proteção por tipo (decide quais armas funcionam melhor). */
const ARMOR: Record<EnemyType, ArmorClass> = {
  rifle: 'flesh', shotgun: 'flesh', shield: 'flesh', jetpack: 'flesh', sniper: 'flesh', grenadier: 'flesh', hunter: 'flesh',
  drone: 'mech', spider: 'mech', roller: 'mech', turret: 'armor', heavy: 'armor', minimech: 'armor', boss: 'flesh', piranha: 'flesh',
};
/** Sorteio estável por id de spawn: recarregar o save não troca quem é elite. */
const stableRoll = (id: number) => {
  let h = Math.imul(id ^ 0x5bd1e995, 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x165667b1);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};
/** Tons dos números de dano: normal, eficaz, resistido, crítico. */
const DMG_COLORS = ['#ffffff', '#ffd23a', '#9aa3b8', '#ff5a8a'];

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
  /** proteção contra cada arma */
  armor: ArmorClass;
  /** inimigo ELITE (dificuldade): mais vida, couraça dourada, prêmio maior */
  elite = false;
  /** ritmo de decisão/recarga (dificuldade) */
  aggro: number;
  /** multiplicador da dispersão da mira (dificuldade) */
  spreadMul: number;
  private armorWeight: number;
  private dmgAcc = 0;
  private dmgTone = 0;
  private dmgT = 0;

  constructor(spawn: EnemySpawn, stats: EnemyStats) {
    this.spawn = spawn;
    this.type = spawn.type;
    this.stats = stats;
    this.body = newBody(stats.w, stats.h);
    this.body.x = spawn.x;
    this.body.y = spawn.y - stats.h / 2;
    const diff = difficulty();
    this.armor = ARMOR[spawn.type] ?? 'flesh';
    this.aggro = diff.aggro * stageAggro();
    this.spreadMul = diff.spread;
    this.armorWeight = diff.armorWeight;
    const boss = spawn.type === 'boss';
    // só inimigos do mapa (id ≥ 0); reforços gerados na hora nunca são elite
    this.elite = !boss && spawn.id >= 0 && stableRoll(spawn.id) < diff.eliteChance;
    this.hp = this.maxHp = Math.round(stats.hp * (boss ? diff.bossHp : diff.enemyHp) * (this.elite ? 1.6 : 1) * (boss ? 1 : stageHp()));
    this.facing = spawn.facing ?? (Math.random() < 0.5 ? -1 : 1);
    this.score = Math.round(stats.score * (this.elite ? 1.5 : 1));
  }

  /**
   * Multiplicador de dano da arma contra este alvo, já com crítico na cabeça (soldados) e couraça
   * de elite. Também escolhe o tom do número flutuante.
   */
  protected damageScale(info: HurtInfo): number {
    const weapon = info.bullet?.weapon ?? (info.type === 'explosion' ? 'launcher' : null);
    let k = weapon ? weaponEffect(weapon, this.armor, this.armorWeight) : 1;
    if (this.elite && k <= 1.01 && info.type !== 'melee' && info.type !== 'dash') k *= 0.85;
    let tone = k > 1.08 ? 1 : k < 0.9 ? 2 : 0;
    if (info.type === 'bullet' && this.armor === 'flesh' && info.y < this.body.y - this.body.h * 0.26) {
      k *= 1.5;
      info.crit = true;
      tone = 3;
    }
    if (tone > this.dmgTone || this.dmgAcc === 0) this.dmgTone = tone;
    return k;
  }

  /** Soma os danos de um instante num único número (balas de escopeta viram um só). */
  protected noteDamage(dmg: number) {
    if (dmg <= 0) return;
    if (this.dmgAcc === 0) this.dmgT = 0.09;
    this.dmgAcc += dmg;
  }

  flushDamage(w: World, dt: number, force = false) {
    if (this.dmgAcc <= 0) return;
    this.dmgT -= dt;
    if (this.dmgT > 0 && !force) return;
    const n = Math.max(1, Math.round(this.dmgAcc));
    const tone = this.dmgTone;
    const top = this.body.y - this.body.h / 2;
    w.fx.popup(this.x + (Math.random() - 0.5) * 20, top - 4, tone === 3 ? `${n}!` : String(n), DMG_COLORS[tone], tone === 3 || n >= 40 ? 12 : n >= 18 ? 10.5 : 9);
    this.dmgAcc = 0;
    this.dmgTone = 0;
  }

  /** Barra de vida curta depois de levar dano + marca de elite (vetores simples, sem alocar). */
  drawStatus(g: CanvasRenderingContext2D) {
    if (!this.alive || this.isBoss) return;
    const top = this.body.y - this.body.h / 2 - 9;
    if (this.elite) {
      const pulse = 0.75 + 0.25 * Math.sin(this.t * 5);
      g.fillStyle = `rgba(255,210,58,${pulse})`;
      g.strokeStyle = '#3a2408';
      g.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        const y = top - 7 - i * 4;
        g.beginPath();
        g.moveTo(this.x - 6, y + 3);
        g.lineTo(this.x, y - 1);
        g.lineTo(this.x + 6, y + 3);
        g.lineTo(this.x + 6, y + 5);
        g.lineTo(this.x, y + 1.5);
        g.lineTo(this.x - 6, y + 5);
        g.closePath();
        g.fill();
        g.stroke();
      }
    }
    const since = this.t - this.lastHurt;
    if (this.lastHurt <= 0 || since > 2.6 || this.hp >= this.maxHp) return;
    const a = since > 2.1 ? (2.6 - since) / 0.5 : 1;
    const bw = Math.max(26, Math.min(58, this.body.w));
    const x = this.x - bw / 2;
    const f = Math.max(0, this.hp / this.maxHp);
    g.globalAlpha = a;
    g.fillStyle = 'rgba(14,10,34,0.85)';
    g.fillRect(x - 1, top - 1, bw + 2, 5);
    g.fillStyle = this.elite ? '#ffd23a' : f > 0.5 ? '#8fe05a' : f > 0.25 ? '#ffb83a' : '#ff4a4a';
    g.fillRect(x, top, bw * f, 3);
    if (this.armor === 'armor') {
      g.fillStyle = 'rgba(200,220,255,0.55)';
      g.fillRect(x, top, bw * f, 1);
    }
    g.globalAlpha = 1;
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
  /** Avisos podem atingir a câmera mesmo quando o atirador está fora dela. */
  drawWarnings(_g: CanvasRenderingContext2D, _w: World): void {}

  /** Aplica dano. Retorna dano efetivo (0..), ou -1 se bloqueado (escudo). */
  hurt(w: World, dmg: number, info: HurtInfo): number {
    if (!this.alive || this.invulnerable) return 0;
    dmg *= this.damageScale(info);
    this.hp -= dmg;
    this.noteDamage(dmg);
    if (this.flashCd <= 0) {
      this.flash = 0.05;
      this.flashCd = 0.14;
    }
    this.lastHurt = this.t;
    this.awake = true;
    // reação a impacto: tranco na direção do golpe (mola amortecida)
    const force = info.type === 'explosion' || info.type === 'dash' ? 1 : info.type === 'melee' ? 0.9 : 0.55;
    this.reactV += force * 9;
    this.reactDir = Math.sign(info.dir || info.kx || 1) || 1;
    this.kbx += info.kx * (this.stats.hp > 150 ? 0.25 : 1);
    if (!this.flying && this.body.onGround && info.ky < 0 && this.stats.hp < 100) this.body.vy = Math.min(this.body.vy, info.ky * 2.2);
    if (this.flying) {
      this.body.vx += info.kx * 0.5;
      this.body.vy += info.ky * 0.5;
    }
    w.fx.sparks(info.x, info.y, this.stats.metal ? 5 : 3, this.stats.metal ? '#ffe9a0' : '#ffb0b0', 180, -info.dir, 0, 1.6);
    w.audio(this.stats.metal ? 'hitMetal' : 'hit', 0.6, this.x);
    if (info.type !== 'explosion') w.fx.addHitStop(dmg >= 20 ? 0.03 : 0.012);
    if (info.crit) w.fx.sparks(info.x, info.y, 5, '#ff8ab4', 220, -info.dir, 0, 1.4);
    if (this.hp <= 0) this.kill(w, info);
    else if (!this.stats.metal) w.audio('enemyHurt', 0.35, this.x);
    return dmg;
  }

  kill(w: World, info?: HurtInfo) {
    if (!this.alive) return;
    this.alive = false;
    this.deadT = 0;
    this.flushDamage(w, 0, true);
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

  /** mola da reação a impacto (0 = parado) */
  react = 0;
  reactV = 0;
  reactDir = 1;
  /** segundos desde que surgiu (animação de entrada) */
  age = 0;

  tickCommon(dt: number) {
    this.t += dt;
    this.age += dt;
    this.reactV += (-260 * this.react - 14 * this.reactV) * dt;
    this.react = Math.max(-0.6, Math.min(1.2, this.react + this.reactV * dt));
    if (this.flash > 0) this.flash -= dt;
    if (this.flashCd > 0) this.flashCd -= dt;
  }

  /** Empurrão de corpo (inimigos não se sobrepõem totalmente). */
  drops(w: World) {
    if (this.silentDeath) return;
    const diff = difficulty();
    const [a, b] = this.stats.tokens;
    const raw = rand.int(a, b) * diff.tokens + (this.elite ? 2 : 0);
    const n = Math.floor(raw) + (raw % 1 > 0 && rand.chance(raw % 1) ? 1 : 0);
    for (let i = 0; i < n; i++) w.spawnDrop('token', this.x, this.y - 8);
    if (w.wantsHealthDrop()) w.spawnDrop('health', this.x, this.y - 8);
    else if (rand.chance(Math.min(0.6, (this.elite ? 0.55 : 0.2) * diff.supply * (w.player.hasEmptyOwned() ? 1.6 : 1)))) w.spawnDrop('ammo', this.x, this.y - 8);
    else if (rand.chance(0.07 * diff.supply)) w.spawnDrop('nade', this.x, this.y - 8);
  }

  fireBullet(w: World, x: number, y: number, ang: number, speed: number, dmg: number, kind: 'enemy' | 'orb' | 'sniper' | 'missile' | 'bossShell' | 'bossOrb' = 'enemy', extra: Partial<{ life: number; homing: number; gravity: number; explode: { radius: number; dmg: number } | null; turnDelay: number; r: number; color: string; trail: string; interceptable: boolean }> = {}) {
    w.spawnEnemyBullet(x, y, ang, speed, dmg, kind, extra);
  }

  muzzleFlash(w: World, x: number, y: number, ang: number, size = 1) {
    w.fx.light(x, y, 55 * size, 0.06, '#ff9a6a');
    w.fx.add(PK.Fire, x, y, 0, 0, 0.08, 9 * size, '#ffd27a', { size1: 3, front: true });
    if (w.fx.opt()) w.fx.add(PK.Spark, x, y, Math.cos(ang) * 200, Math.sin(ang) * 200, 0.1, 8, '#fff2b0', { size1: 1, front: true });
  }
}
