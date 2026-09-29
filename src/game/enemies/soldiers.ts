import { Enemy, type HurtInfo } from './enemy';
import type { World } from '../world';
import type { EnemySpawn } from '../level';
import { clamp, rand, approach, angleDiff, TAU } from '../../core/math';
import { getArt } from '../../art';
import { drawSoldier, soldierMuzzle, type SoldierStyle, type SState } from '../../art/soldiers';
import { PK } from '../fx';
import { moveBody } from '../physics';
import { Corpse } from '../corpse';

/** Base de soldados humanoides. */
abstract class Soldier extends Enemy {
  style: SoldierStyle;
  aim = 0;
  aiming = false;
  state: SState = 'idle';
  runPhase = 0;
  crouch = false;
  kick = 0;
  charge = 0;
  alert = false;
  mode = 'idle';
  modeT = 0;
  jumpCd = 0;
  patrolDir: 1 | -1;
  homeX: number;
  shootCd = 0;
  burstLeft = 0;
  burstGap = 0;
  stunned = 0;

  constructor(spawn: EnemySpawn, style: SoldierStyle, stats: ConstructorParameters<typeof Enemy>[1]) {
    super(spawn, stats);
    this.style = style;
    this.patrolDir = this.facing;
    this.homeX = spawn.x;
  }

  protected setMode(m: string) {
    this.mode = m;
    this.modeT = 0;
  }

  protected setCrouch(c: boolean) {
    if (this.crouch === c) return;
    const b = this.body;
    const feet = b.y + b.h / 2;
    this.crouch = c;
    b.h = c ? 28 : this.stats.h;
    b.y = feet - b.h / 2;
  }

  protected muzzlePos(w: World): [number, number] {
    void w;
    const art = getArt().soldiers[this.style];
    const [mx, my] = soldierMuzzle(this.facing, this.aim, art, this.crouch, this.kick);
    return [this.x + mx, this.feetY + my];
  }

  protected walk(dir: number, speed: number, dt: number, acc = 1200) {
    const b = this.body;
    b.vx = approach(b.vx, dir * speed, acc * dt);
  }

  protected tryJumpObstacle(w: World) {
    const b = this.body;
    if (this.jumpCd > 0 || !b.onGround) return;
    if (b.wallDir !== 0 && Math.sign(b.vx || this.facing) === b.wallDir) {
      b.vy = -470;
      this.jumpCd = 0.9;
    }
    void w;
  }

  protected patrol(w: World, dt: number, speed = 38) {
    const b = this.body;
    const range = this.spawn.patrol ?? 0;
    if (this.spawn.idle || range <= 0) {
      b.vx = approach(b.vx, 0, 900 * dt);
      this.state = 'idle';
      return;
    }
    if (Math.abs(this.x - this.homeX) > range || !this.ledgeAhead(w, 8) || b.wallDir !== 0) {
      this.patrolDir = (this.x > this.homeX ? -1 : 1) as 1 | -1;
      if (!this.ledgeAhead(w, 8) || b.wallDir !== 0) this.patrolDir = (this.patrolDir * -1) as 1 | -1;
    }
    this.facing = this.patrolDir;
    this.walk(this.patrolDir, speed, dt);
    this.state = 'run';
    this.runPhase += dt * 6;
  }

  protected commonUpdate(w: World, dt: number) {
    this.tickCommon(dt);
    if (this.jumpCd > 0) this.jumpCd -= dt;
    if (this.shootCd > 0) this.shootCd -= dt;
    this.kick = approach(this.kick, 0, dt * 9);
    this.modeT += dt;
    if (this.stunned > 0) this.stunned -= dt;
    void w;
  }

  protected animate(dt: number) {
    const b = this.body;
    if (!b.onGround && !this.flying) this.state = 'jump';
    else if (this.crouch) this.state = 'crouch';
    else if (this.flying) this.state = 'fly';
    else if (Math.abs(b.vx) > 12) {
      this.state = 'run';
      this.runPhase += dt * (5 + Math.abs(b.vx) * 0.045);
    } else this.state = 'idle';
    if (this.flash > 0.03 && this.stunned > 0.05) this.state = 'idle';
  }

  fireAt(w: World, speed = 400, dmg = 8, spread = 0.05, kind: 'enemy' | 'orb' = 'enemy') {
    const [mx, my] = this.muzzlePos(w);
    const a = this.aim + rand.spread(spread);
    this.fireBullet(w, mx, my, a, speed, dmg, kind);
    this.muzzleFlash(w, mx, my, a);
    this.kick = 1;
    w.audio('enemyShot', 0.7, this.x);
  }

  protected onDeath(w: World, info?: HurtInfo) {
    const dir = info ? Math.sign(info.dir || 1) : this.facing;
    w.audio('enemyDie', 0.9, this.x);
    w.fx.sparks(this.x, this.y, 10, '#ffd0a0', 260);
    w.fx.smoke(this.x, this.y, 3, '#6b6480', 9, 26, 0.7);
    w.corpses.push(new Corpse(this.x, this.y, dir * rand.range(120, 240) + (info?.kx ?? 0) * 0.3, -rand.range(280, 420), (g, x, y, rot, alpha) => {
      const art = getArt().soldiers[this.style];
      drawSoldier(g, art, x, y + 22, { facing: this.facing, state: 'hurt', t: 0, runPhase: 0, aim: this.aim, aiming: false, flash: false, alpha, kick: 0, charge: 0, style: this.style, rot });
    }));
    w.fx.explosion(this.x, this.y - 6, 9);
  }

  draw(g: CanvasRenderingContext2D, w: World) {
    const art = getArt().soldiers[this.style];
    const b = this.body;
    this.drawExtra(g, w, false);
    drawSoldier(g, art, this.x, this.feetY, {
      facing: this.facing,
      state: this.state,
      t: this.t,
      runPhase: this.runPhase,
      aim: this.aim,
      aiming: this.aiming,
      flash: this.flash > 0,
      alpha: 1,
      kick: this.kick,
      charge: this.charge,
      style: this.style,
      shieldUp: this.shieldUp(),
      jet: this.flying ? 0.5 + Math.min(0.5, Math.abs(b.vy) / 200) : 0,
    });
    this.drawExtra(g, w, true);
  }
  protected shieldUp(): boolean {
    return true;
  }
  protected drawExtra(g: CanvasRenderingContext2D, w: World, front: boolean) {
    void g;
    void w;
    void front;
  }
}

// ------------------------------------------------------------------------------------------
export class RifleSoldier extends Soldier {
  coverT = 0;
  constructor(spawn: EnemySpawn) {
    super(spawn, 'rifle', { hp: 30, w: 22, h: 46, score: 100, wake: 560, tokens: [1, 2] });
  }

  update(w: World, dt: number) {
    this.commonUpdate(w, dt);
    const b = this.body;
    const see = this.canSee(w, 470);
    if (!this.alert && (see || this.lastHurt > 0 && this.t - this.lastHurt < 4)) {
      this.alert = true;
      this.setMode('move');
    }
    if (!this.alert) {
      this.aiming = false;
      this.patrol(w, dt);
    } else {
      const p = w.player;
      const dx = p.x - this.x;
      const dist = Math.abs(dx);
      this.faceToward(p.x);
      this.aim = this.aimAngleTo(w, this.x, this.feetY - 28, 0.05);
      this.aiming = true;
      switch (this.mode) {
        case 'move': {
          this.setCrouch(false);
          const desired = 230;
          let dir = 0;
          if (dist > desired + 50) dir = this.facing;
          else if (dist < desired - 70) dir = -this.facing;
          if (dir !== 0 && dir === -this.facing && !this.ledgeAhead(w, -14)) dir = 0;
          if (dir === this.facing && !this.ledgeAhead(w, 10)) dir = 0;
          this.walk(dir, dir === this.facing ? 72 : 58, dt);
          this.tryJumpObstacle(w);
          if (this.modeT > rand.range(0.7, 1.4) && see) this.setMode('charge');
          if (!see && this.modeT > 3 && dist > 500) this.alert = false;
          break;
        }
        case 'charge':
          b.vx = approach(b.vx, 0, 1400 * dt);
          this.charge = clamp(this.modeT / 0.42, 0, 1);
          if (this.modeT >= 0.42) {
            this.burstLeft = 3;
            this.burstGap = 0;
            this.setMode('burst');
          }
          break;
        case 'burst':
          b.vx = approach(b.vx, 0, 1400 * dt);
          this.burstGap -= dt;
          if (this.burstLeft > 0 && this.burstGap <= 0) {
            this.fireAt(w, 380, 8, 0.05);
            this.burstLeft--;
            this.burstGap = 0.17;
          }
          if (this.burstLeft <= 0 && this.burstGap <= 0) {
            this.charge = 0;
            this.setMode(rand.chance(0.3) ? 'cover' : 'move');
          }
          break;
        case 'cover':
          this.setCrouch(true);
          b.vx = approach(b.vx, 0, 1400 * dt);
          this.charge = 0;
          if (this.modeT > 0.9) {
            this.setCrouch(false);
            this.setMode('move');
          }
          break;
        default:
          this.setMode('move');
      }
    }
    this.physics(w, dt);
    this.animate(dt);
  }
}

// ------------------------------------------------------------------------------------------
export class ShotgunSoldier extends Soldier {
  constructor(spawn: EnemySpawn) {
    super(spawn, 'shotgun', { hp: 46, w: 24, h: 46, score: 130, wake: 540, tokens: [1, 3] });
  }
  update(w: World, dt: number) {
    this.commonUpdate(w, dt);
    const b = this.body;
    const see = this.canSee(w, 440);
    if (!this.alert && (see || (this.lastHurt > 0 && this.t - this.lastHurt < 4))) {
      this.alert = true;
      this.setMode('rush');
    }
    if (!this.alert) {
      this.aiming = false;
      this.patrol(w, dt, 42);
    } else {
      const p = w.player;
      const dist = Math.abs(p.x - this.x);
      this.faceToward(p.x);
      this.aim = this.aimAngleTo(w, this.x, this.feetY - 28, 0);
      this.aiming = true;
      switch (this.mode) {
        case 'rush':
          if (this.ledgeAhead(w, 12) || Math.abs(p.y - this.y) > 40) this.walk(this.facing, 122, dt, 1600);
          else b.vx = approach(b.vx, 0, 1400 * dt);
          this.tryJumpObstacle(w);
          if (dist < 160 && see && this.shootCd <= 0) this.setMode('wind');
          if (!see && this.modeT > 3.5 && dist > 520) this.alert = false;
          break;
        case 'wind':
          b.vx = approach(b.vx, 0, 1600 * dt);
          this.charge = clamp(this.modeT / 0.4, 0, 1);
          if (this.modeT >= 0.4) {
            const [mx, my] = this.muzzlePos(w);
            for (let i = 0; i < 5; i++) {
              const a = this.aim + (i - 2) * 0.13 + rand.spread(0.03);
              this.fireBullet(w, mx, my, a, rand.range(330, 400), 7, 'enemy', { life: 0.45 });
            }
            this.muzzleFlash(w, mx, my, this.aim, 1.6);
            w.fx.smoke(mx, my, 2, '#8b8499', 6, 16, 0.5);
            w.audio('shotgun', 0.6, this.x);
            this.kick = 1;
            this.body.vx -= this.facing * 90;
            this.charge = 0;
            this.shootCd = 1.4;
            this.setMode('recover');
          }
          break;
        case 'recover':
          this.walk(-this.facing, dist < 120 ? 60 : 0, dt);
          if (this.modeT > 0.9) this.setMode('rush');
          break;
        default:
          this.setMode('rush');
      }
    }
    this.physics(w, dt);
    this.animate(dt);
  }
}

// ------------------------------------------------------------------------------------------
export class ShieldSoldier extends Soldier {
  shield = true;
  constructor(spawn: EnemySpawn) {
    super(spawn, 'shield', { hp: 58, w: 26, h: 46, score: 180, wake: 520, tokens: [2, 3] });
  }
  protected shieldUp() {
    return this.shield;
  }
  hurt(w: World, dmg: number, info: HurtInfo): number {
    if (this.shield && info.type === 'bullet' && info.bullet) {
      const b = info.bullet;
      const fromFront = Math.sign(b.vx) === -this.facing;
      const fromAbove = b.vy > 0 && Math.abs(b.vy) > Math.abs(b.vx) * 1.05;
      const pierces = b.kind === 'plasma';
      if (fromFront && !fromAbove && !pierces) {
        w.fx.sparks(info.x, info.y, 6, '#7ff9ff', 200, -info.dir, 0, 1.6);
        w.fx.add(PK.Glint, info.x, info.y, 0, 0, 0.14, 7, '#bfffff', { front: true });
        w.audio('shieldPing', 0.7, this.x);
        this.alert = true;
        return -1;
      }
    }
    return super.hurt(w, dmg, info);
  }
  update(w: World, dt: number) {
    this.commonUpdate(w, dt);
    const b = this.body;
    const see = this.canSee(w, 400);
    if (!this.alert && (see || this.lastHurt > 0)) {
      this.alert = true;
      this.setMode('advance');
    }
    this.contactDmg = this.mode === 'lunge' ? 16 : 0;
    if (!this.alert) {
      this.aiming = false;
      this.patrol(w, dt, 30);
    } else {
      const p = w.player;
      const dist = Math.abs(p.x - this.x);
      if (this.mode !== 'lunge' && this.mode !== 'stun') this.faceToward(p.x);
      this.aim = this.facing === 1 ? 0 : Math.PI;
      this.aiming = false;
      switch (this.mode) {
        case 'advance':
          this.shield = true;
          if (this.ledgeAhead(w, 10)) this.walk(this.facing, 50, dt);
          else b.vx = approach(b.vx, 0, 1000 * dt);
          this.tryJumpObstacle(w);
          if (dist < 82 && Math.abs(p.y - this.y) < 50) this.setMode('windup');
          break;
        case 'windup':
          b.vx = approach(b.vx, 0, 1400 * dt);
          this.charge = clamp(this.modeT / 0.42, 0, 1);
          if (this.modeT >= 0.42) {
            this.setMode('lunge');
            this.charge = 0;
            b.vx = this.facing * 250;
            w.audio('servo', 0.8, this.x);
          }
          break;
        case 'lunge':
          this.shield = false;
          b.vx = this.facing * 250 * (1 - this.modeT / 0.3);
          if (this.modeT > 0.26) this.setMode('stun');
          break;
        case 'stun':
          this.shield = false;
          b.vx = approach(b.vx, 0, 1400 * dt);
          if (this.modeT > 0.75) {
            this.shield = true;
            this.setMode('advance');
          }
          break;
        default:
          this.setMode('advance');
      }
    }
    this.physics(w, dt);
    this.animate(dt);
    if (this.mode === 'lunge') this.state = 'bash';
  }
}

// ------------------------------------------------------------------------------------------
export class JetpackSoldier extends Soldier {
  targetX = 0;
  diveT = 0;
  diveCd = 4 + Math.random() * 3;
  flyOsc = Math.random() * 6;
  contactWhileDive = false;
  constructor(spawn: EnemySpawn) {
    super(spawn, 'jetpack', { hp: 24, w: 22, h: 40, score: 200, wake: 640, tokens: [2, 3] });
    this.flying = true;
    this.gravity = 0;
    this.body.y = spawn.y;
  }
  update(w: World, dt: number) {
    this.commonUpdate(w, dt);
    const b = this.body;
    const p = w.player;
    this.flyOsc += dt;
    this.diveCd -= dt;
    const dx = p.x - this.x;
    this.faceToward(p.x);
    const see = this.canSee(w, 560);
    this.aim = this.aimAngleTo(w, this.x, this.y - 6, 0.05);
    this.aiming = true;
    this.contactDmg = this.mode === 'dive' ? 15 : 0;
    const kbx = this.kbx;
    this.kbx = 0;
    b.vx += kbx * 0.6;
    switch (this.mode) {
      case 'idle':
      case 'hover': {
        if (!this.alert && see) this.alert = true;
        if (!this.alert) {
          b.vx = approach(b.vx, 0, 400 * dt);
          b.vy = approach(b.vy, Math.sin(this.flyOsc * 2) * 20, 600 * dt);
          break;
        }
        const want = p.y - 100 + Math.sin(this.flyOsc * 1.6) * 26;
        const dir = dx > 0 ? 1 : -1;
        const keep = 250 + Math.sin(this.flyOsc * 0.7) * 50;
        this.targetX = p.x - dir * keep;
        b.vx = approach(b.vx, clamp((this.targetX - this.x) * 1.6, -150, 150), 700 * dt);
        b.vy = approach(b.vy, clamp((want - this.y) * 2.4, -140, 140), 800 * dt);
        if (this.mode === 'idle') this.setMode('hover');
        if (this.modeT > rand.range(1.2, 2.0) && see) this.setMode('charge');
        if (this.diveCd <= 0 && see && Math.abs(dx) < 380) this.setMode('divewind');
        break;
      }
      case 'charge':
        b.vx = approach(b.vx, 0, 500 * dt);
        b.vy = approach(b.vy, Math.sin(this.flyOsc * 3) * 15, 500 * dt);
        this.charge = clamp(this.modeT / 0.4, 0, 1);
        if (this.modeT >= 0.4) {
          this.burstLeft = 2;
          this.burstGap = 0;
          this.setMode('burst');
        }
        break;
      case 'burst':
        this.burstGap -= dt;
        if (this.burstLeft > 0 && this.burstGap <= 0) {
          this.fireAt(w, 340, 8, 0.04);
          this.burstLeft--;
          this.burstGap = 0.2;
        }
        if (this.burstLeft <= 0 && this.burstGap <= 0) {
          this.charge = 0;
          this.setMode('hover');
        }
        break;
      case 'divewind':
        b.vx = approach(b.vx, 0, 700 * dt);
        b.vy = approach(b.vy, -60, 700 * dt);
        this.charge = clamp(this.modeT / 0.55, 0, 1);
        if (this.modeT >= 0.55) {
          const a = Math.atan2(p.y - 8 - this.y, p.x - this.x);
          b.vx = Math.cos(a) * 400;
          b.vy = Math.sin(a) * 400;
          this.charge = 0;
          this.diveCd = rand.range(6, 9);
          this.setMode('dive');
          w.audio('dash', 0.5, this.x);
        }
        break;
      case 'dive':
        if (this.modeT > 0.6 || b.onGround || b.wallDir !== 0) {
          this.setMode('rise');
        }
        break;
      case 'rise':
        b.vy = approach(b.vy, -170, 900 * dt);
        b.vx = approach(b.vx, 0, 600 * dt);
        if (this.modeT > 0.55) this.setMode('hover');
        break;
    }
    // não entra no chão: sobe se muito baixo
    moveBody(b, dt, w.level, w.solidRects, false);
    if (b.y > w.level.pxH + 100) {
      this.silentDeath = true;
      this.alive = false;
      w.onEnemyKilled(this, undefined);
    }
    // fumaça do jato
    if (w.fx.opt() && Math.random() < dt * 30) {
      w.fx.add(PK.Smoke, this.x - this.facing * 8, this.y + 12, rand.spread(10), 40 + rand.range(0, 40), 0.5, 5, '#8b8499', { size1: 1, a0: 0.5 });
    }
    this.animate(dt);
    this.state = 'fly';
  }

  protected onDeath(w: World, info?: HurtInfo) {
    w.fx.explosion(this.x, this.y, 20);
    w.audio('robotDie', 0.8, this.x);
    super.onDeath(w, info);
  }
}

// ------------------------------------------------------------------------------------------
export class Sniper extends Soldier {
  lock = 0;
  reload = 1.2;
  lasered = false;
  laserEnd: [number, number] = [0, 0];
  constructor(spawn: EnemySpawn) {
    super(spawn, 'sniper', { hp: 22, w: 22, h: 46, score: 220, wake: 700, tokens: [2, 4] });
    this.spawn.idle = true;
  }
  update(w: World, dt: number) {
    this.commonUpdate(w, dt);
    const b = this.body;
    const p = w.player;
    const see = this.canSee(w, 680);
    this.aiming = true;
    this.faceToward(p.x);
    this.reload -= dt;
    const target = this.aimAngleTo(w, this.x, this.feetY - 30, 0);
    if (see && this.reload <= 0) {
      this.alert = true;
      // rastreia devagar até travar
      if (this.lock < 1.05) {
        const d = angleDiff(this.aim, target);
        this.aim += clamp(d, -2.6 * dt, 2.6 * dt);
      }
      this.lock += dt;
      this.charge = clamp(this.lock / 1.35, 0, 1);
      this.lasered = true;
      if (this.lock >= 1.35) {
        const [mx, my] = this.muzzlePos(w);
        this.fireBullet(w, mx, my, this.aim, 1100, 26, 'sniper');
        this.muzzleFlash(w, mx, my, this.aim, 2);
        w.audio('sniperShot', 0.8, this.x);
        this.kick = 1.6;
        this.lock = 0;
        this.reload = 2.4;
        this.charge = 0;
        this.lasered = false;
      }
    } else {
      this.lock = Math.max(0, this.lock - dt * 2);
      this.charge = 0;
      this.lasered = false;
      if (!see) {
        const d = angleDiff(this.aim, this.facing === 1 ? 0 : Math.PI);
        this.aim += clamp(d, -1.5 * dt, 1.5 * dt);
      } else {
        const d = angleDiff(this.aim, target);
        this.aim += clamp(d, -1.8 * dt, 1.8 * dt);
      }
    }
    if (this.lasered) {
      const [mx, my] = this.muzzlePos(w);
      const len = 900;
      const ex = mx + Math.cos(this.aim) * len;
      const ey = my + Math.sin(this.aim) * len;
      const t = w.level.rayHit(mx, my, ex, ey);
      const tt = t >= 0 ? t : 1;
      this.laserEnd = [mx + (ex - mx) * tt, my + (ey - my) * tt];
    }
    b.vx = approach(b.vx, 0, 1600 * dt);
    this.physics(w, dt);
    this.animate(dt);
    this.state = this.crouch ? 'crouch' : 'idle';
  }

  draw(g: CanvasRenderingContext2D, w: World) {
    super.draw(g, w);
    if (this.lasered && this.alive) {
      const [mx, my] = this.muzzlePos(w);
      const [ex, ey] = this.laserEnd;
      const lockT = this.lock / 1.35;
      const blink = lockT > 0.8 && Math.floor(this.t * 24) % 2 === 0;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = blink ? '#ffffff' : '#ff3a3a';
      g.globalAlpha = 0.25 + lockT * 0.6;
      g.lineWidth = 1.2 + lockT * 1.2;
      g.beginPath();
      g.moveTo(mx, my);
      g.lineTo(ex, ey);
      g.stroke();
      g.restore();
    }
  }
}

void TAU;
