import { Enemy, type HurtInfo } from './enemy';
import type { World } from '../world';
import type { EnemySpawn } from '../level';
import { clamp, rand, approach, angleDiff } from '../../core/math';
import { getArt } from '../../art';
import { drawDrone, drawTurret, drawHeavy, drawSpider, drawMiniMech, type RPose } from '../../art/robots';
import { PK } from '../fx';
import { moveBody } from '../physics';

const pose = (e: Enemy, o: Partial<RPose> & { aim: number }): RPose => ({
  facing: e.facing,
  t: e.t,
  flash: e.flash > 0,
  alpha: 1,
  charge: 0,
  kick: 0,
  phase: 0,
  moving: false,
  extra: 0,
  hp01: e.hp / e.maxHp,
  ...o,
});

// ------------------------------------------------------------------------------------------
export class Drone extends Enemy {
  charge = 0;
  mode = 'patrol';
  modeT = 0;
  osc = Math.random() * 6;
  homeX: number;
  homeY: number;
  cd = 1 + Math.random();
  burst = 0;
  gap = 0;
  aim = 0;
  tilt = 0;
  constructor(spawn: EnemySpawn) {
    super(spawn, { hp: 12, w: 33, h: 28, score: 120, wake: 620, tokens: [1, 2], metal: true });
    this.flying = true;
    this.gravity = 0;
    this.body.y = spawn.y;
    this.homeX = spawn.x;
    this.homeY = spawn.y;
  }
  update(w: World, dt: number) {
    this.tickCommon(dt);
    const b = this.body;
    const p = w.player;
    this.osc += dt;
    this.modeT += dt;
    this.cd -= dt;
    const kbx = this.kbx;
    this.kbx = 0;
    b.vx += kbx * 0.6;
    const see = this.canSee(w, 480);
    this.aim = this.aimAngleTo(w, this.x, this.y, 0.05);
    if (see) this.faceToward(p.x);
    switch (this.mode) {
      case 'patrol': {
        const tx = this.homeX + Math.sin(this.osc * 0.8) * (this.spawn.patrol ?? 90);
        const ty = this.homeY + Math.sin(this.osc * 1.7) * 10;
        b.vx = approach(b.vx, clamp((tx - this.x) * 1.6, -80, 80), 500 * dt);
        b.vy = approach(b.vy, clamp((ty - this.y) * 2, -60, 60), 500 * dt);
        if (Math.abs(b.vx) > 8 && !see) this.facing = b.vx > 0 ? 1 : -1;
        if (see) this.mode = 'engage';
        break;
      }
      case 'engage': {
        const side = p.x > this.x ? -1 : 1;
        const tx = p.x + side * (150 + Math.sin(this.osc) * 40);
        const ty = p.y - 84 + Math.sin(this.osc * 1.7) * 16;
        b.vx = approach(b.vx, clamp((tx - this.x) * 1.4, -125, 125), 700 * dt);
        b.vy = approach(b.vy, clamp((ty - this.y) * 2, -110, 110), 700 * dt);
        if (this.cd <= 0 && see) {
          this.mode = 'charge';
          this.modeT = 0;
        }
        if (!see && this.modeT > 4) this.mode = 'patrol';
        break;
      }
      case 'charge':
        b.vx = approach(b.vx, 0, 500 * dt);
        this.charge = clamp(this.modeT / 0.4, 0, 1);
        if (this.modeT >= 0.4) {
          this.burst = 2;
          this.gap = 0;
          this.mode = 'fire';
          this.modeT = 0;
        }
        break;
      case 'fire':
        this.gap -= dt;
        if (this.burst > 0 && this.gap <= 0) {
          const mx = this.x + this.facing * 15;
          const my = this.y + 10;
          const a = Math.atan2(p.y - 8 - my, p.x - mx);
          this.fireBullet(w, mx, my, a, 250, 7, 'orb');
          this.muzzleFlash(w, mx, my, a, 0.8);
          w.audio('enemyShot', 0.6, this.x);
          this.burst--;
          this.gap = 0.22;
        }
        if (this.burst <= 0 && this.gap <= 0) {
          this.charge = 0;
          this.cd = rand.range(1.5, 2.6);
          this.mode = 'engage';
          this.modeT = 0;
        }
        break;
    }
    this.tilt = approach(this.tilt, clamp(b.vx / 250, -0.5, 0.5), dt * 4);
    moveBody(b, dt, w.level, w.solidRects, false);
    if (b.y > w.level.pxH + 100) {
      this.silentDeath = true;
      this.alive = false;
      w.onEnemyKilled(this, undefined);
    }
  }
  protected onDeath(w: World) {
    w.fx.explosion(this.x, this.y, 20);
    w.fx.debris(this.x, this.y, 8, ['#565c7a', '#7a82a6', '#b13a8c'], 260);
    w.audio('robotDie', 0.8, this.x);
  }
  draw(g: CanvasRenderingContext2D) {
    drawDrone(g, getArt().robots, this.x, this.y, pose(this, { aim: this.aim, charge: this.charge, extra: this.tilt }));
  }
}

// ------------------------------------------------------------------------------------------
export class Turret extends Enemy {
  aim: number;
  charge = 0;
  kick = 0;
  cd = 1 + Math.random();
  burst = 0;
  gap = 0;
  mode = 'scan';
  modeT = 0;
  ceiling: boolean;
  headY: number;
  constructor(spawn: EnemySpawn) {
    super(spawn, { hp: 46, w: 38, h: 34, score: 200, wake: 600, tokens: [2, 3], metal: true });
    this.ceiling = !!spawn.ceiling;
    this.gravity = 0;
    if (this.ceiling) this.body.y = spawn.y + this.stats.h / 2;
    this.aim = this.ceiling ? Math.PI / 2 : -Math.PI / 2;
    this.headY = this.ceiling ? this.body.y - this.stats.h / 2 + 16 : spawn.y - 16;
    this.facing = spawn.facing ?? 1;
  }
  get feetAnchor() {
    return this.ceiling ? this.body.y - this.stats.h / 2 : this.body.y + this.stats.h / 2;
  }
  update(w: World, dt: number) {
    this.tickCommon(dt);
    this.modeT += dt;
    this.cd -= dt;
    this.kick = approach(this.kick, 0, dt * 8);
    const see = this.canSee(w, 500);
    const target = Math.atan2(w.player.y - 6 - this.headY, w.player.x - this.x);
    if (see) {
      const d = angleDiff(this.aim, target);
      this.aim += clamp(d, -2.4 * dt, 2.4 * dt);
    } else {
      // varre lentamente
      const base = this.ceiling ? Math.PI / 2 : -Math.PI / 2;
      const want = base + Math.sin(this.t * 0.8) * 0.9;
      this.aim += clamp(angleDiff(this.aim, want), -1 * dt, 1 * dt);
    }
    switch (this.mode) {
      case 'scan':
        if (see && this.cd <= 0 && Math.abs(angleDiff(this.aim, target)) < 0.5) {
          this.mode = 'charge';
          this.modeT = 0;
        }
        break;
      case 'charge':
        this.charge = clamp(this.modeT / 0.5, 0, 1);
        if (this.modeT >= 0.5) {
          this.burst = 4;
          this.gap = 0;
          this.mode = 'fire';
          this.modeT = 0;
        }
        break;
      case 'fire':
        this.gap -= dt;
        if (this.burst > 0 && this.gap <= 0) {
          const mx = this.x + Math.cos(this.aim) * 29;
          const my = this.headY + Math.sin(this.aim) * 29;
          this.fireBullet(w, mx, my, this.aim + rand.spread(0.03), 330, 7);
          this.muzzleFlash(w, mx, my, this.aim);
          this.kick = 1;
          w.audio('turretShot', 0.6, this.x);
          this.burst--;
          this.gap = 0.13;
        }
        if (this.burst <= 0 && this.gap <= 0) {
          this.charge = 0;
          this.cd = rand.range(1.3, 2.0);
          this.mode = 'scan';
        }
        break;
    }
  }
  protected onDeath(w: World) {
    w.fx.explosion(this.x, this.body.y, 26);
    w.fx.debris(this.x, this.body.y, 10, ['#4a5074', '#8087ac', '#ff8a2a'], 300);
    w.audio('robotDie', 0.9, this.x);
  }
  draw(g: CanvasRenderingContext2D) {
    drawTurret(g, getArt().robots, this.x, this.feetAnchor, pose(this, { aim: this.aim, charge: this.charge, kick: this.kick }), this.ceiling, 0);
  }
}

// ------------------------------------------------------------------------------------------
export class HeavyRobot extends Enemy {
  aim = 0;
  charge = 0;
  kick = 0;
  mode = 'walk';
  modeT = 0;
  cd = 1.5;
  phase = 0;
  lift = 0;
  burst = 0;
  gap = 0;
  alert = false;
  constructor(spawn: EnemySpawn) {
    super(spawn, { hp: 280, w: 62, h: 88, score: 500, wake: 620, tokens: [5, 8], metal: true });
  }
  hurt(w: World, dmg: number, info: HurtInfo): number {
    const armor = info.type === 'bullet' ? 0.72 : 1;
    return super.hurt(w, Math.max(1, Math.round(dmg * armor)), info);
  }
  update(w: World, dt: number) {
    this.tickCommon(dt);
    this.modeT += dt;
    this.cd -= dt;
    this.kick = approach(this.kick, 0, dt * 7);
    const b = this.body;
    const p = w.player;
    const dx = p.x - this.x;
    const dist = Math.abs(dx);
    const see = this.canSee(w, 560);
    if (!this.alert && (see || this.lastHurt > 0)) this.alert = true;
    this.aim = this.aimAngleTo(w, this.x + this.facing * 20, this.feetY - 61, 0.05);
    if (this.mode === 'walk' || this.mode === 'rest') this.faceToward(p.x);
    switch (this.mode) {
      case 'walk': {
        if (!this.alert) {
          b.vx = approach(b.vx, 0, 900 * dt);
          break;
        }
        const want = dist > 120 && this.ledgeAhead(w, 16) ? this.facing * 34 : 0;
        b.vx = approach(b.vx, want, 300 * dt);
        if (this.cd <= 0) {
          if (dist < 125 && Math.abs(p.y - this.y) < 60) this.setMode('stompwind');
          else if (see) this.setMode('volleywind');
        }
        break;
      }
      case 'volleywind':
        b.vx = approach(b.vx, 0, 800 * dt);
        this.charge = clamp(this.modeT / 0.75, 0, 1);
        if (this.modeT >= 0.75) {
          this.burst = 5;
          this.gap = 0;
          this.setMode('volley');
        }
        break;
      case 'volley':
        this.gap -= dt;
        if (this.burst > 0 && this.gap <= 0) {
          const mx = this.x + Math.cos(this.aim) * 40 * this.facing * this.facing + 0;
          const mxx = this.x + this.facing * 42;
          const my = this.feetY - 61 + Math.sin(this.aim) * 30;
          void mx;
          const a = this.aim + (this.burst - 3) * 0.1;
          this.fireBullet(w, mxx, my, a, 330, 8);
          this.muzzleFlash(w, mxx, my, a, 1.4);
          this.kick = 1;
          w.audio('enemyShot', 0.9, this.x);
          this.burst--;
          this.gap = 0.13;
        }
        if (this.burst <= 0 && this.gap <= 0) {
          this.charge = 0;
          this.cd = rand.range(2.2, 3.2);
          this.setMode('rest');
        }
        break;
      case 'stompwind':
        b.vx = approach(b.vx, 0, 900 * dt);
        this.lift = clamp(this.modeT / 0.55, 0, 1);
        if (this.modeT >= 0.55) {
          // pisão: ondas rasteiras nos dois sentidos
          this.lift = 0;
          for (const dir of [-1, 1]) {
            this.fireBullet(w, this.x + dir * 24, this.feetY - 7, dir === 1 ? 0 : Math.PI, 250, 16, 'enemy', { life: 1.6, r: 5, color: '#ffd9a0', trail: '#ff8a2a' });
          }
          w.fx.addShake(5, 0.3);
          w.audio('stomp', 1, this.x);
          for (let i = 0; i < 8; i++) w.fx.add(PK.Dust, this.x + rand.spread(30), this.feetY - 2, rand.spread(120), -rand.range(6, 30), 0.5, 9, '#b9b0c8', { size1: 3, a0: 0.7 });
          w.fx.add(PK.Ring, this.x, this.feetY - 4, 0, 0, 0.35, 8, '#ffd9a0', { size1: 50, a0: 0.7, front: true });
          this.cd = rand.range(2, 3);
          this.setMode('rest');
        }
        break;
      case 'rest':
        b.vx = approach(b.vx, 0, 900 * dt);
        if (this.modeT > 0.9) this.setMode('walk');
        break;
    }
    if (Math.abs(b.vx) > 5) this.phase += dt * (3 + Math.abs(b.vx) * 0.06);
    this.physics(w, dt);
  }
  private setMode(m: string) {
    this.mode = m;
    this.modeT = 0;
  }
  protected onDeath(w: World) {
    w.fx.explosion(this.x, this.y, 40);
    w.fx.explosion(this.x - 12, this.y + 14, 24);
    w.fx.debris(this.x, this.y, 18, ['#586082', '#7a84ad', '#ff8a2a', '#b13a8c'], 360);
    w.audio('bigExplosion', 1, this.x);
    w.fx.addShake(7, 0.4);
    w.fx.addHitStop(0.08);
  }
  draw(g: CanvasRenderingContext2D) {
    drawHeavy(g, getArt().robots, this.x, this.feetY, pose(this, { aim: this.aim, charge: this.charge, kick: this.kick, phase: this.phase, moving: Math.abs(this.body.vx) > 5, extra: this.lift }));
  }
}

// ------------------------------------------------------------------------------------------
export class SpiderBot extends Enemy {
  mode = 'crawl';
  modeT = 0;
  phase = 0;
  crouch = 0;
  cd = 1;
  constructor(spawn: EnemySpawn) {
    super(spawn, { hp: 30, w: 47, h: 28, score: 150, wake: 560, tokens: [1, 2], metal: true });
    this.contactDmg = 9;
  }
  update(w: World, dt: number) {
    this.tickCommon(dt);
    this.modeT += dt;
    this.cd -= dt;
    const b = this.body;
    const p = w.player;
    const dx = p.x - this.x;
    const dist = Math.abs(dx);
    const see = this.canSee(w, 460);
    this.contactDmg = this.mode === 'leap' ? 14 : 8;
    switch (this.mode) {
      case 'crawl':
        this.faceToward(p.x);
        if (see || this.lastHurt > 0) {
          const ahead = this.ledgeAhead(w, 8);
          b.vx = approach(b.vx, ahead ? this.facing * 96 : 0, 900 * dt);
          if (b.wallDir !== 0 && b.onGround) b.vy = -420;
          if (dist < 190 && b.onGround && this.cd <= 0) {
            this.mode = 'wind';
            this.modeT = 0;
          }
        } else b.vx = approach(b.vx, 0, 800 * dt);
        break;
      case 'wind':
        b.vx = approach(b.vx, 0, 1200 * dt);
        this.crouch = clamp(this.modeT / 0.4, 0, 1);
        if (this.modeT >= 0.4) {
          this.mode = 'leap';
          this.modeT = 0;
          this.crouch = 0;
          b.vx = this.facing * clamp(dist * 1.9, 190, 330);
          b.vy = -380;
          w.audio('jump', 0.6, this.x);
        }
        break;
      case 'leap':
        if (b.onGround && this.modeT > 0.12) {
          this.mode = 'rest';
          this.modeT = 0;
          this.cd = rand.range(1.2, 2.0);
        }
        break;
      case 'rest':
        b.vx = approach(b.vx, 0, 1400 * dt);
        if (this.modeT > 0.45) this.mode = 'crawl';
        break;
    }
    if (Math.abs(b.vx) > 8 && b.onGround) this.phase += dt * (4 + Math.abs(b.vx) * 0.09);
    this.physics(w, dt);
  }
  protected onDeath(w: World) {
    w.fx.explosion(this.x, this.y, 20);
    w.fx.debris(this.x, this.y, 8, ['#6a3a4f', '#8a4a63', '#e2384a'], 260);
    w.audio('robotDie', 0.8, this.x);
  }
  draw(g: CanvasRenderingContext2D) {
    drawSpider(g, getArt().robots, this.x, this.feetY, pose(this, { aim: 0, phase: this.phase, moving: Math.abs(this.body.vx) > 8 || this.mode === 'leap', extra: this.crouch }));
  }
}

// ------------------------------------------------------------------------------------------
export class MiniMech extends Enemy {
  aim = 0;
  charge = 0;
  kick = 0;
  mode = 'walk';
  modeT = 0;
  cd = 1.2;
  rocketCd = 3.5;
  phase = 0;
  burst = 0;
  gap = 0;
  pod = 0;
  alert = false;
  constructor(spawn: EnemySpawn) {
    super(spawn, { hp: 120, w: 48, h: 65, score: 400, wake: 620, tokens: [4, 6], metal: true });
  }
  update(w: World, dt: number) {
    this.tickCommon(dt);
    this.modeT += dt;
    this.cd -= dt;
    this.rocketCd -= dt;
    this.kick = approach(this.kick, 0, dt * 8);
    const b = this.body;
    const p = w.player;
    const dist = Math.abs(p.x - this.x);
    const see = this.canSee(w, 560);
    if (!this.alert && (see || this.lastHurt > 0)) this.alert = true;
    this.aim = this.aimAngleTo(w, this.x + this.facing * 24, this.feetY - 32, 0.05);
    if (this.mode === 'walk') this.faceToward(p.x);
    switch (this.mode) {
      case 'walk': {
        if (!this.alert) {
          b.vx = approach(b.vx, 0, 800 * dt);
          break;
        }
        let dir = 0;
        if (dist > 300) dir = this.facing;
        else if (dist < 170) dir = -this.facing;
        if (dir === this.facing && !this.ledgeAhead(w, 14)) dir = 0;
        b.vx = approach(b.vx, dir * 60, 700 * dt);
        if (b.wallDir !== 0 && b.onGround) b.vy = -480;
        if (this.rocketCd <= 0 && see) this.setMode('podopen');
        else if (this.cd <= 0 && see) this.setMode('charge');
        break;
      }
      case 'charge':
        b.vx = approach(b.vx, 0, 900 * dt);
        this.charge = clamp(this.modeT / 0.42, 0, 1);
        if (this.modeT >= 0.42) {
          this.burst = 2;
          this.gap = 0;
          this.setMode('burst');
        }
        break;
      case 'burst':
        this.gap -= dt;
        if (this.burst > 0 && this.gap <= 0) {
          const mx = this.x + this.facing * 50;
          const my = this.feetY - 32 + Math.sin(this.aim) * 19;
          this.fireBullet(w, mx, my, this.aim, 340, 9);
          this.muzzleFlash(w, mx, my, this.aim, 1.4);
          this.kick = 1;
          w.audio('enemyShot', 0.8, this.x);
          this.burst--;
          this.gap = 0.25;
        }
        if (this.burst <= 0 && this.gap <= 0) {
          this.charge = 0;
          this.cd = rand.range(1.5, 2.3);
          this.setMode('walk');
        }
        break;
      case 'podopen':
        b.vx = approach(b.vx, 0, 900 * dt);
        this.pod = clamp(this.modeT / 0.7, 0, 1);
        if (this.modeT >= 0.7) {
          const mx = this.x - this.facing * 14;
          const my = this.feetY - 60;
          for (let i = 0; i < 2; i++) {
            const a = -Math.PI / 2 + (this.facing === 1 ? -0.5 : 0.5) + i * (this.facing === 1 ? 0.6 : -0.6);
            this.fireBullet(w, mx, my, a, 250, 22, 'missile', { homing: 1.7, turnDelay: 0.35, life: 3.4, explode: { radius: 60, dmg: 26 } });
          }
          w.audio('missile', 0.9, this.x);
          w.fx.smoke(mx, my, 4, '#8b8499', 8, 30, 0.6);
          this.rocketCd = rand.range(5.5, 7.5);
          this.pod = 0;
          this.setMode('walk');
        }
        break;
    }
    if (Math.abs(b.vx) > 6) this.phase += dt * (3.5 + Math.abs(b.vx) * 0.09);
    this.physics(w, dt);
  }
  private setMode(m: string) {
    this.mode = m;
    this.modeT = 0;
  }
  protected onDeath(w: World) {
    w.fx.explosion(this.x, this.y, 34);
    w.fx.explosion(this.x + 10, this.y + 10, 20);
    w.fx.debris(this.x, this.y, 14, ['#8a4a9a', '#5f3470', '#ff8a2a', '#a765b8'], 340);
    w.audio('bigExplosion', 0.9, this.x);
    w.fx.addShake(5, 0.3);
  }
  draw(g: CanvasRenderingContext2D) {
    drawMiniMech(g, getArt().robots, this.x, this.feetY, pose(this, { aim: this.aim, charge: this.charge, kick: this.kick, phase: this.phase, moving: Math.abs(this.body.vx) > 6, extra: this.pod }));
  }
}
