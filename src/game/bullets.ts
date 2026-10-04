import { rand, TAU } from '../core/math';
import { segmentRectEntry } from '../core/segment';
import type { World } from './world';
import { PK } from './fx';
import { glowSprite } from '../art/kit';
import type { Enemy } from './enemies/enemy';
import type { Prop } from './props';
import { circleEntry } from './interception';
import { drawInterceptableGrenade } from '../art/hazards';
import type { WeaponId } from './weapons';

export type BulletKind = 'std' | 'shell' | 'rocket' | 'plasma' | 'enemy' | 'orb' | 'sniper' | 'missile' | 'nomadShell' | 'bossShell' | 'bossOrb' | 'mine';

export interface BulletOpts {
  interceptable?: boolean;
  kind?: BulletKind;
  team: 0 | 1; // 0 = jogador, 1 = inimigo
  dmg: number;
  life?: number;
  r?: number;
  pierce?: number;
  gravity?: number;
  kb?: number;
  color?: string;
  trail?: string;
  explode?: { radius: number; dmg: number } | null;
  homing?: number; // rad/s de curva
  turnDelay?: number;
  wallBounce?: boolean;
  fromNomad?: boolean;
  length?: number; // comprimento do traço visual
  breakProps?: boolean;
  dmgProps?: number;
  /** arma do Karimbo que disparou (eficácia contra blindagem) */
  weapon?: WeaponId;
}

export class Bullet {
  readonly interceptable: boolean;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  kind: BulletKind;
  team: 0 | 1;
  dmg: number;
  life: number;
  r: number;
  pierce: number;
  gravity: number;
  kb: number;
  color: string;
  trail: string;
  explode: { radius: number; dmg: number } | null;
  homing: number;
  turnDelay: number;
  wallBounce: boolean;
  dead = false;
  fromNomad: boolean;
  length: number;
  age = 0;
  hitList: object[] | null = null;
  dmgProps: number;
  weapon: WeaponId | null;

  constructor(x: number, y: number, vx: number, vy: number, o: BulletOpts) {
    this.interceptable = o.interceptable === true && o.team === 1 && !!o.explode;
    this.x = this.px = x;
    this.y = this.py = y;
    this.vx = vx;
    this.vy = vy;
    this.kind = o.kind ?? 'std';
    this.team = o.team;
    this.dmg = o.dmg;
    this.life = o.life ?? 1;
    this.r = o.r ?? 2.4;
    this.pierce = o.pierce ?? 0;
    this.gravity = o.gravity ?? 0;
    this.kb = o.kb ?? 60;
    this.color = o.color ?? '#fff2b0';
    this.trail = o.trail ?? '#ffb340';
    this.explode = o.explode ?? null;
    this.homing = o.homing ?? 0;
    this.turnDelay = o.turnDelay ?? 0;
    this.wallBounce = o.wallBounce ?? false;
    this.fromNomad = o.fromNomad ?? false;
    this.length = o.length ?? Math.min(22, Math.hypot(vx, vy) * 0.028);
    this.dmgProps = o.dmgProps ?? o.dmg;
    this.weapon = o.weapon ?? null;
    if (this.pierce > 0) this.hitList = [];
  }

  update(w: World, dt: number) {
    if (this.dead) return;
    this.age += dt;
    this.life -= dt;
    if (this.life <= 0) {
      this.finish(w, false);
      return;
    }
    if (this.homing > 0 && this.age > this.turnDelay) {
      const p = w.player;
      const tx = p.x - this.x;
      const ty = p.y - p.body.h * 0.2 - this.y;
      const want = Math.atan2(ty, tx);
      const cur = Math.atan2(this.vy, this.vx);
      let d = want - cur;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      const step = Math.max(-this.homing * dt, Math.min(this.homing * dt, d));
      const sp = Math.hypot(this.vx, this.vy);
      this.vx = Math.cos(cur + step) * sp;
      this.vy = Math.sin(cur + step) * sp;
    }
    this.vy += this.gravity * dt;
    this.px = this.x;
    this.py = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.resolveContacts(w);

    // trilha de partículas leve
    if (this.kind === 'rocket' || this.kind === 'missile') {
      if (w.fx.opt()) w.fx.add(PK.Smoke, this.x, this.y, rand.spread(12), rand.spread(12), 0.6, 7, '#8a8298', { size1: 2, a0: 0.6 });
      w.fx.add(PK.Fire, this.x, this.y, 0, 0, 0.18, 8, '#ffb347', { size1: 2 });
    } else if (this.kind === 'plasma') {
      if (w.fx.opt()) w.fx.add(PK.Fire, this.x, this.y, 0, 0, 0.16, 6, '#2ad0ff', { size1: 1 });
    }

    // fora do mundo
    if (this.y > w.level.pxH + 200 || this.x < -100 || this.x > w.level.pxW + 100) this.dead = true;
  }

  /** Resolve the earliest contact across categories, without sorting world arrays.
   * Only a piercing hit needs another scan; its existing hitList prevents repeats.
   */
  private resolveContacts(w: World) {
    const endX = this.x, endY = this.y, dx = endX - this.px, dy = endY - this.py;
    const tile = w.level.rayHit(this.px, this.py, endX, endY);
    const minX = Math.min(this.px, endX) - this.r, maxX = Math.max(this.px, endX) + this.r;
    const minY = Math.min(this.py, endY) - this.r, maxY = Math.max(this.py, endY) + this.r;
    if (this.pierce > 0 && !this.hitList) this.hitList = [];
    while (true) {
      let first = tile >= 0 ? tile : Infinity;
      let prop: Prop | null = null, enemy: Enemy | null = null, grenade: Bullet | null = null, player = false;
      for (const p of w.props) {
        if (!p.alive || !p.hittable || this.hitList?.includes(p)) continue;
        if (this.team === 0 ? !(this.dmgProps > 0 || this.explode) : !p.solid || p.kind === 'sign') continue;
        if (p.x + p.w / 2 < minX || p.x - p.w / 2 > maxX || p.y + p.h / 2 < minY || p.y - p.h / 2 > maxY) continue;
        const t = segmentRectEntry(this.px, this.py, endX, endY, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, this.r);
        if (t !== null && t < first) { first = t;prop = p; }
      }
      if (this.team === 0) {
        for (const e of w.enemies) {
          if (!e.alive || !e.canBeHit || this.hitList?.includes(e)) continue;
          if (e.x + e.stats.w < minX || e.x - e.stats.w > maxX || e.y + e.stats.h < minY || e.y - e.stats.h > maxY) continue;
          const hb = e.hitbox, t = segmentRectEntry(this.px, this.py, endX, endY, hb.x, hb.y, hb.w, hb.h, this.r);
          if (t !== null && t < first) { first = t;enemy = e;prop = null; }
        }
        // Small registry of explicitly interceptable grenades, not all bullets.
        if (!this.explode) for (const b of w.interceptableBullets) {
          if (b.dead) continue;
          const t = circleEntry(this.px, this.py, endX, endY, b.x, b.y, this.r + b.r);
          if (t !== null && t < first) { first = t;grenade = b;enemy = null;prop = null; }
        }
      } else if (w.player.targetable && !w.village?.active && (w.player.invuln <= 0 || w.player.isDashing)) {
        const hb = w.player.hitbox, t = segmentRectEntry(this.px, this.py, endX, endY, hb.x, hb.y, hb.w, hb.h, this.r);
        if (t !== null && t < first) { first = t;player = true;prop = null; }
      }
      if (first === Infinity) { this.x = endX;this.y = endY;return; }
      const x = this.px + dx * first, y = this.py + dy * first;
      if (player) {
        // Let the player's existing dash / i-frame handling use the full segment.
        this.x = endX;this.y = endY;w.player.tryHitByBullet(w, this);
        if (this.dead) { this.x = x;this.y = y; }
        return;
      }
      this.x = x;this.y = y;
      if (grenade) {
        grenade.dead = true;w.interceptableBullets.delete(grenade);
        w.audio('hitMetal', .65, grenade.x);
        w.fx.sparks(grenade.x, grenade.y, 7, '#ffe19e', 130);
        w.fx.popup(grenade.x, grenade.y - 15, 'INTERCEPTADA!', '#ffe19e', 9);
        this.dead = true;return; // Even a piercing round is consumed.
      }
      if (enemy) {
        this.hitEnemy(w, enemy);
        if (this.dead) return;
        continue;
      }
      if (prop) {
        if (this.team === 1) {
          w.fx.sparks(x, y, 3, '#ffd27a', 140, -this.vx, -this.vy, 1.4);
          this.dead = true;return;
        }
        prop.hurt(w, this.dmgProps, 'bullet', Math.sign(this.vx));
        w.fx.sparks(x, y, 4, '#ffd27a', 160, -this.vx, -this.vy, 1.4);
        if (this.explode) { this.impactWorld(w);return; }
        if (this.pierce > 0 && prop.kind !== 'wall' && !prop.solid) {
          this.hitList!.push(prop);this.pierce--;continue;
        }
        this.finish(w, false);return;
      }
      // Terrain wins exact ties with targets embedded in a wall.
      if (this.wallBounce) {
        this.x = this.px;this.y = this.py;this.vx *= -1;this.life -= .15;
      } else this.impactWorld(w);
      return;
    }
  }

  private hitEnemy(w: World, e: Enemy) {
    const dir = Math.sign(this.vx) || 1;
    const dealt = e.hurt(w, this.dmg, { kx: dir * this.kb, ky: -this.kb * 0.15, x: this.x, y: this.y, type: this.explode ? 'explosion' : 'bullet', dir, bullet: this });
    if (this.hitList) this.hitList.push(e);
    if (dealt < 0) {
      // bloqueado (escudo): o projétil some
      this.dead = true;
      return;
    }
    if (this.explode) {
      this.impactWorld(w);
      return;
    }
    if (this.pierce > 0) {
      this.pierce--;
    } else {
      this.finish(w, true);
    }
  }

  private impactWorld(w: World) {
    if (this.explode) {
      w.explode(this.x, this.y, this.explode.radius, this.explode.dmg, this.team, { kb: 320, fromNomad: this.fromNomad });
      this.dead = true;
      return;
    }
    w.fx.sparks(this.x, this.y, 5, this.trail, 190, -this.vx, -this.vy, 1.6);
    if (w.fx.opt()) w.fx.add(PK.Dust, this.x, this.y, 0, -8, 0.4, 6, '#b9b0c8', { size1: 2, a0: 0.5 });
    if (this.kind === 'shell' || this.kind === 'nomadShell') w.fx.add(PK.Glint, this.x, this.y, 0, 0, 0.12, 5, this.color, {});
    this.dead = true;
  }

  finish(w: World, hitTarget: boolean) {
    if (this.explode) {
      w.explode(this.x, this.y, this.explode.radius, this.explode.dmg, this.team, { kb: 320, fromNomad: this.fromNomad });
    } else if (hitTarget) {
      w.fx.sparks(this.x, this.y, 3, this.trail, 150, -this.vx, -this.vy, 1.2);
    }
    this.dead = true;
  }

  draw(g: CanvasRenderingContext2D) {
    if (this.dead) return;
    if (this.interceptable) {
      drawInterceptableGrenade(g, this.x, this.y, this.age, Math.atan2(this.vy, this.vx));
      return;
    }
    const sp = Math.hypot(this.vx, this.vy) || 1;
    const nx = this.vx / sp;
    const ny = this.vy / sp;
    switch (this.kind) {
      case 'rocket':
      case 'missile': {
        g.save();
        g.translate(this.x, this.y);
        g.rotate(Math.atan2(this.vy, this.vx));
        g.fillStyle = this.kind === 'missile' ? '#e8e3f2' : '#a5c98c';
        g.fillRect(-7, -2.4, 12, 4.8);
        g.fillStyle = this.kind === 'missile' ? '#e2384a' : '#ffd23a';
        g.fillRect(5, -2.4, 3.5, 4.8);
        g.fillStyle = '#2a2440';
        g.fillRect(-9, -3.4, 3, 6.8);
        g.restore();
        break;
      }
      case 'orb':
      case 'bossOrb': {
        const r = this.kind === 'bossOrb' ? 7 : 4.5;
        const spr = glowSprite(this.color, 16);
        g.globalCompositeOperation = 'lighter';
        g.drawImage(spr.c, this.x - r * 2.2, this.y - r * 2.2, r * 4.4, r * 4.4);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(this.x, this.y, r * 0.5, 0, TAU);
        g.fill();
        break;
      }
      case 'plasma': {
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = '#2ad0ff';
        g.lineWidth = 5;
        g.globalAlpha = 0.55;
        g.beginPath();
        g.moveTo(this.x - nx * 18, this.y - ny * 18);
        g.lineTo(this.x, this.y);
        g.stroke();
        g.globalAlpha = 1;
        g.strokeStyle = '#eaffff';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(this.x - nx * 12, this.y - ny * 12);
        g.lineTo(this.x, this.y);
        g.stroke();
        g.globalCompositeOperation = 'source-over';
        break;
      }
      case 'sniper': {
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = '#ff5a5a';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(this.x - nx * 40, this.y - ny * 40);
        g.lineTo(this.x, this.y);
        g.stroke();
        g.strokeStyle = '#fff';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(this.x - nx * 24, this.y - ny * 24);
        g.lineTo(this.x, this.y);
        g.stroke();
        g.globalCompositeOperation = 'source-over';
        break;
      }
      case 'mine': {
        g.fillStyle = '#e2384a';
        g.beginPath();
        g.arc(this.x, this.y, 3.2, 0, TAU);
        g.fill();
        break;
      }
      default: {
        // traço luminoso (balas, cartuchos)
        const L = this.length;
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = this.trail;
        g.lineWidth = this.kind === 'nomadShell' || this.kind === 'bossShell' ? 3.4 : this.team === 1 ? 3 : 2.6;
        g.globalAlpha = 0.6;
        g.beginPath();
        g.moveTo(this.x - nx * L, this.y - ny * L);
        g.lineTo(this.x, this.y);
        g.stroke();
        g.globalAlpha = 1;
        g.strokeStyle = this.color;
        g.lineWidth = this.team === 1 ? 1.6 : 1.4;
        g.beginPath();
        g.moveTo(this.x - nx * L * 0.6, this.y - ny * L * 0.6);
        g.lineTo(this.x, this.y);
        g.stroke();
        g.globalCompositeOperation = 'source-over';
        if (this.team === 1) {
          // núcleo claro para leitura das balas inimigas
          g.fillStyle = '#fff5d8';
          g.beginPath();
          g.arc(this.x, this.y, 1.7, 0, TAU);
          g.fill();
        }
      }
    }
  }
}

/** Segmento (a→b) engrossado por `r` intersecta o retângulo? */
export function segHitsRect(ax: number, ay: number, bx: number, by: number, r: number, rx: number, ry: number, rw: number, rh: number) {
  return segmentRectEntry(ax, ay, bx, by, rx, ry, rw, rh, r) !== null;
}

// ------------------------------------------------------------------------------------------
export class Grenade {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuse = 1.5;
  dead = false;
  rot = 0;
  team: 0 | 1;
  bounces = 0;
  fromNomad: boolean;
  radius: number;
  dmg: number;

  constructor(x: number, y: number, vx: number, vy: number, team: 0 | 1 = 0, fromNomad = false) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.team = team;
    this.fromNomad = fromNomad;
    this.radius = fromNomad ? 138 : 118; // área maior (+50%)
    this.dmg = fromNomad ? 95 : 75;
  }

  update(w: World, dt: number) {
    if (this.dead) return;
    this.fuse -= dt;
    this.vy += 900 * dt;
    this.rot += this.vx * dt * 0.06;
    const L = w.level;
    const r = 4;
    const ox = this.x;
    const oy = this.y;
    // Colisão por eixo com ricochete, contra tiles E coberturas/objetos sólidos (antes os objetos eram
    // testados depois do movimento e a granada era empurrada para dentro deles, ficando presa).
    const nx = this.x + this.vx * dt;
    if (L.solidAtPx(nx + Math.sign(this.vx) * r, this.y) || this.blocked(w, nx, this.y, r)) {
      this.vx *= -0.55;
      this.bounce(w);
    } else this.x = nx;
    const ny = this.y + this.vy * dt;
    if (L.solidAtPx(this.x, ny + Math.sign(this.vy) * r) || this.blocked(w, this.x, ny, r)) {
      if (this.vy > 0) {
        this.vy *= -0.5;
        this.vx *= 0.8;
        if (Math.abs(this.vy) < 40) this.vy = 0;
      } else this.vy *= -0.4;
      this.bounce(w);
    } else this.y = ny;
    // nasceu/foi empurrada para dentro de um objeto: sai pelo lado mais próximo
    this.escape(w, r);
    // contato com inimigos ao longo do percurso: explode uma única vez
    if (this.team === 0) {
      for (const e of w.enemies) {
        if (!e.alive || !e.canBeHit) continue;
        const hb = e.hitbox;
        if (segHitsRect(ox, oy, this.x, this.y, r, hb.x, hb.y, hb.w, hb.h)) {
          this.detonate(w);
          return;
        }
      }
    }
    if (this.fuse <= 0) {
      this.detonate(w);
      return;
    }
    if (this.y > L.pxH + 200) this.dead = true;
    if (w.fx.opt() && Math.random() < 0.35) w.fx.add(PK.Spark, this.x, this.y, rand.spread(20), rand.spread(20) - 20, 0.2, 5, '#ffb347', { size1: 1, front: true });
  }

  private blocked(w: World, x: number, y: number, r: number) {
    for (const s of w.solidRects) if (x + r > s.x && x - r < s.x + s.w && y + r > s.y && y - r < s.y + s.h) return true;
    return false;
  }

  private escape(w: World, r: number) {
    for (const s of w.solidRects) {
      if (!(this.x + r > s.x && this.x - r < s.x + s.w && this.y + r > s.y && this.y - r < s.y + s.h)) continue;
      const left = this.x + r - s.x;
      const right = s.x + s.w - (this.x - r);
      const top = this.y + r - s.y;
      const bottom = s.y + s.h - (this.y - r);
      const m = Math.min(left, right, top, bottom);
      if (m === top) {
        this.y = s.y - r;
        if (this.vy > 0) this.vy = Math.abs(this.vy) < 40 ? 0 : -this.vy * 0.5;
      } else if (m === bottom) {
        this.y = s.y + s.h + r;
        if (this.vy < 0) this.vy *= -0.4;
      } else if (m === left) {
        this.x = s.x - r;
        if (this.vx > 0) this.vx *= -0.55;
      } else {
        this.x = s.x + s.w + r;
        if (this.vx < 0) this.vx *= -0.55;
      }
    }
  }

  private bounce(w: World) {
    this.bounces++;
    w.audio('grenadeBounce', 0.5, this.x);
  }

  detonate(w: World) {
    if (this.dead) return;
    this.dead = true;
    w.explode(this.x, this.y, this.radius, this.dmg, this.team, { kb: 380, fromNomad: this.fromNomad, big: true });
    if (this.team === 0) w.fx.grenadeBlast(this.x, this.y, this.radius);
    this.dead = true;
  }

  draw(g: CanvasRenderingContext2D) {
    g.save();
    g.translate(this.x, this.y);
    g.rotate(this.rot);
    g.fillStyle = '#3d5a30';
    g.beginPath();
    g.arc(0, 0, 4.6, 0, TAU);
    g.fill();
    g.strokeStyle = '#170f2e';
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = '#7fb35a';
    g.fillRect(-1.5, -4.6, 3, 2);
    g.fillStyle = '#ffd23a';
    g.fillRect(-4.6, -0.8, 9.2, 1.6);
    g.restore();
    // pisca perto de explodir
    if (this.fuse < 0.5 && Math.floor(this.fuse * 14) % 2 === 0) {
      g.fillStyle = '#ff4a3a';
      g.beginPath();
      g.arc(this.x, this.y - 6, 2, 0, TAU);
      g.fill();
    }
  }
}
