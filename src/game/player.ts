import { newBody, moveBody, type Body } from './physics';
import type { World } from './world';
import type { ControlState } from '../core/input';
import { WEAPONS, WEAPON_ORDER, type WeaponId } from './weapons';
import { Bullet, Grenade } from './bullets';
import { clamp, approach, rand, TAU, damp, angleDiff } from '../core/math';
import { PK } from './fx';
import { T, TILE } from './level';
import { getArt } from '../art';
import { drawKarimbo, karimboMuzzle, type KState } from '../art/karimbo';
import { drawNomad } from '../art/nomad';
import { settings } from '../core/storage';
import {
  FOOT_W, FOOT_H, CROUCH_H, NOMAD_W, NOMAD_H, RUN, RUN_ACC, RUN_DEC, AIR_ACC, AIR_DEC, GRAV, JUMP_V, FALL_MAX, COYOTE, JUMP_BUF,
  GLIDE_FALL, GLIDE_FUEL, GLIDE_SPEED, CROUCH_SPEED, N_RUN, N_ACC, N_DEC, N_GRAV, N_JUMP,
} from './movement';

const SLIDE_T = 0.42; // s de deslize
const SLIDE_V = 430; // px/s no início do deslize

export { FOOT_W, FOOT_H, CROUCH_H, NOMAD_W, NOMAD_H };
export interface NomadState {
  hp: number;
  maxHp: number;
  dashT: number; // >0 durante o avanço
  dashKind: 0 | 1 | 2;
  dashDir: number;
  dashTime: number;
  window: number; // s restantes da janela do segundo avanço
  cooldown: number;
  dash1Uses: number;
  dash2Used: boolean;
  hitThisDash: object[];
  roll: number;
  boost: boolean; // impulso aéreo disponível
  fireCd: number;
  recoil: number;
  invuln: number;
  hurtFlash: number;
  lowWarn: number;
  nadeCd: number;
  turretTilt: number;
  smokeT: number;
  hintShown: boolean;
  /** Nômad de apoio (temporário): segundos restantes; Infinity = o Nômad principal */
  timeLeft: number;
  maxTime: number;
}

export type PlayerMode = 'foot' | 'mounting' | 'nomad' | 'dead';

export class Player {
  body: Body = newBody(FOOT_W, FOOT_H);
  mode: PlayerMode = 'foot';
  facing: 1 | -1 = 1;
  hp = 140; // +40% (aguenta mais tiros)
  maxHp = 140;
  invuln = 0;
  hurtT = 0;
  crouch = false;
  /** deslize (agachar correndo): passa por baixo dos tiros */
  slideT = 0;
  slideDir = 1;
  aim = 0;
  aimVis = 0;
  weapons: Map<WeaponId, number> = new Map([['pistol', Infinity]]);
  cur: WeaponId = 'pistol';
  grenades = 3;
  maxGrenades = 8;
  fireCd = 0;
  nadeCd = 0;
  kick = 0;
  // movimento
  coyote = 0;
  jumpBuf = 0;
  jumping = false;
  glide = false;
  glideFuel = GLIDE_FUEL;
  glideUsed = false;
  earGlide = 0; // 0..1
  glideT = 0;
  flapCd = 0;
  wasGround = true;
  landSquash = 0;
  runPhase = 0;
  stepAcc = 0;
  animT = 0;
  scarfT = 0;
  airTime = 0;
  lastSafe = { x: 0, y: 0 };
  safeT = 0;
  nomad: NomadState | null = null;
  // montagem
  mountT = 0;
  mountFrom = { x: 0, y: 0 };
  mountTo = { x: 0, y: 0 };
  // morte
  deadT = 0;
  /** onde morreu (para continuar de onde parou) */
  deathPos: { x: number; y: number } | null = null;
  deadVy = 0;
  deadRot = 0;
  respawnQueued = false;
  lockInput = false;
  justLanded = 0;
  fallCount = 0;
  aimAssistTarget: object | null = null;
  shootAnim = 0;
  lastDamageT = -99;

  constructor() {
    this.body.onGround = true;
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
  get mounted() {
    return this.mode === 'nomad';
  }
  get targetable() {
    return this.mode === 'foot' || this.mode === 'nomad';
  }
  get canCollect() {
    return this.mode === 'foot' || this.mode === 'nomad';
  }
  get hitbox() {
    const b = this.body;
    // hitbox de dano um pouco menor que o corpo (perdão)
    const iw = b.w * 0.82;
    const ih = b.h * 0.9;
    return { x: b.x - iw / 2, y: b.y - b.h / 2 + (b.h - ih), w: iw, h: ih };
  }
  get isDashing() {
    return !!this.nomad && this.nomad.dashT > 0;
  }
  get shoulder(): [number, number] {
    if (this.nomad) return [this.x + this.facing * 4, this.y - 26];
    return [this.x + this.facing * 2.5 * 1.2, this.feetY - 21.5 * 1.2 + (this.crouch ? 12 : 0)];
  }

  // ------------------------------------------------------------------ ciclo de vida
  reset(x: number, feetY: number) {
    this.body = newBody(FOOT_W, FOOT_H);
    this.body.x = x;
    this.body.y = feetY - FOOT_H / 2;
    this.mode = 'foot';
    this.nomad = null;
    this.hp = this.maxHp;
    this.invuln = 1.2;
    this.hurtT = 0;
    this.crouch = false;
    this.slideT = 0;
    this.glide = false;
    this.earGlide = 0;
    this.glideFuel = GLIDE_FUEL;
    this.deadT = 0;
    this.respawnQueued = false;
    this.lockInput = false;
    this.fireCd = 0.2;
    this.lastSafe = { x, y: feetY };
    this.safeT = 0;
    this.landSquash = 0;
  }

  resetInventory() {
    // começa com pistola + metralhadora + shotgun (munição LIMITADA: varie as armas!)
    this.weapons = new Map<WeaponId, number>([['pistol', Infinity], ['rifle', 110], ['shotgun', 16]]);
    this.cur = 'rifle';
    this.grenades = 4;
  }

  snapshot() {
    return { weapons: [...this.weapons.entries()], cur: this.cur, grenades: this.grenades, nomad: this.nomad && this.nomad.timeLeft === Infinity ? this.nomad.hp : -1 };
  }
  restore(s: ReturnType<Player['snapshot']>) {
    this.weapons = new Map(s.weapons as [WeaponId, number][]);
    this.cur = s.cur;
    this.grenades = s.grenades;
  }

  giveWeapon(id: WeaponId, w: World) {
    const d = WEAPONS[id];
    const have = this.weapons.get(id);
    if (have === undefined) {
      this.weapons.set(id, d.ammoStart);
      this.cur = id;
    } else {
      this.weapons.set(id, Math.min(d.ammoMax, have + d.ammoPickup));
      if (this.cur !== id) this.cur = id;
    }
    w.audio('weapon', 0.8, this.x);
  }

  /** Caixa de munição: reabastece TODAS as armas que você tem (metade da carga de cada). */
  addAmmo(w: World): boolean {
    let gained = false;
    for (const id of WEAPON_ORDER) {
      if (id === 'pistol') continue;
      const have = this.weapons.get(id);
      if (have === undefined) continue;
      const d = WEAPONS[id];
      if (have >= d.ammoMax) continue;
      this.weapons.set(id, Math.min(d.ammoMax, have + Math.ceil(d.ammoPickup * 0.6)));
      gained = true;
    }
    if (!gained) {
      if (this.grenades >= this.maxGrenades) return false;
      this.grenades = Math.min(this.maxGrenades, this.grenades + 2);
    }
    w.fx.popup(this.x, this.y - 40, '+MUNIÇÃO', '#9dff7a');
    return true;
  }

  heal(amount: number, w: World): boolean {
    if (this.mounted && this.nomad) return false;
    if (this.hp >= this.maxHp) return false;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    w.fx.popup(this.x, this.y - 40, `+${amount} VIDA`, '#ff8ab4');
    return true;
  }

  repairNomad(amount: number, w: World): boolean {
    if (!this.nomad) return false;
    if (this.nomad.hp >= this.nomad.maxHp) return false;
    this.nomad.hp = Math.min(this.nomad.maxHp, this.nomad.hp + amount);
    w.fx.popup(this.x, this.y - 50, '+REPARO', '#7ff9ff');
    return true;
  }

  // ------------------------------------------------------------------ dano
  tryHitByBullet(w: World, b: Bullet) {
    if (!this.targetable) return;
    const hb = this.hitbox;
    // segmento vs retângulo
    const r = b.r;
    const len = Math.hypot(b.x - b.px, b.y - b.py);
    const n = Math.max(1, Math.ceil(len / 6));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = b.px + (b.x - b.px) * t;
      const y = b.py + (b.y - b.py) * t;
      if (x >= hb.x - r && x <= hb.x + hb.w + r && y >= hb.y - r && y <= hb.y + hb.h + r) {
        if (this.isDashing) {
          // invulnerável no avanço: a bala é destruída com faísca
          w.fx.sparks(x, y, 4, '#7ff9ff', 160);
          b.dead = true;
          return;
        }
        if (this.invuln > 0) return; // atravessa durante i-frames (perdão)
        b.x = x;
        b.y = y;
        this.hit(w, b.dmg, Math.sign(b.vx) || 1, { kx: b.kb * 3 });
        if (b.explode) b.finish(w, true);
        else b.dead = true;
        return;
      }
    }
  }

  /** Dano ao jogador (Karimbo ou Nômad). dir = lado de onde veio (empurra no sentido). */
  hit(w: World, dmg: number, dir: number, o: { kx?: number; ky?: number; ignoreInvuln?: boolean; fall?: boolean } = {}) {
    if (!this.targetable) return;
    if (this.isDashing) return;
    if (this.invuln > 0 && !o.ignoreInvuln) return;
    w.stats.damageTaken += dmg;
    this.lastDamageT = w.time;
    if (this.nomad) {
      const n = this.nomad;
      n.hp -= dmg * 0.85;
      n.invuln = 0.45;
      n.hurtFlash = 0.1;
      this.invuln = 0.45;
      this.body.vx += dir * (o.kx ?? 90) * 0.4;
      w.fx.addShake(3.5, 0.2);
      w.fx.addHitStop(0.03);
      w.fx.sparks(this.x, this.y - 10, 8, '#ffd27a', 240);
      w.audio('nomadHurt', 1, this.x);
      if (n.hp <= 0) this.ejectNomad(w);
      return;
    }
    this.hp -= dmg;
    this.invuln = 1.7;
    this.hurtT = 0.28;
    this.body.vx = dir * (o.kx ? Math.min(o.kx, 240) : 160);
    this.body.vy = o.ky ?? -230;
    this.glide = false;
    w.fx.addShake(3.2, 0.22);
    w.fx.addHitStop(0.05);
    w.fx.sparks(this.x, this.y - 12, 8, '#ffb0b0', 230);
    w.audio('hurt', 0.9, this.x);
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(w);
    }
  }

  die(w: World) {
    if (this.mode === 'dead') return;
    this.deathPos = { x: this.x, y: this.feetY };
    this.mode = 'dead';
    this.deadT = 0;
    this.deadVy = -520;
    this.deadRot = 0;
    this.glide = false;
    this.earGlide = 0;
    w.stats.deaths++;
    w.audio('die', 1, this.x);
    w.fx.addShake(6, 0.4);
    w.fx.smoke(this.x, this.y, 4, '#6b6480', 10);
    w.onPlayerDied();
    w.music('silence');
  }

  /** Gasta uma vida: revive no ponto da morte (ou no último ponto seguro se o local for inválido). */
  revive(w: World) {
    const L = w.level;
    let x = this.lastSafe.x;
    let y = this.lastSafe.y;
    const d = this.deathPos;
    if (d) {
      const inside = L.solidAtPx(d.x, d.y - 8) || L.solidAtPx(d.x, d.y - 30) || L.solidAtPx(d.x, d.y - 50);
      const gy = L.groundBelow(d.x, d.y - 40, 260);
      if (!inside && gy !== null && d.y < w.deathY() - 40) {
        x = d.x;
        y = Math.min(d.y, gy);
      }
    }
    const facing = this.facing;
    this.reset(x, y);
    this.facing = facing;
    this.invuln = 3;
    this.deathPos = null;
  }

  // ------------------------------------------------------------------ Nômad
  startMount(w: World, nomadX: number, nomadFeetY: number) {
    this.mode = 'mounting';
    this.mountT = 0;
    this.mountFrom = { x: this.x, y: this.y };
    this.mountTo = { x: nomadX, y: nomadFeetY - NOMAD_H / 2 };
    this.lockInput = true;
    this.body.vx = this.body.vy = 0;
    this.glide = false;
    this.earGlide = 0;
  }

  private finishMount(w: World) {
    const feet = this.mountTo.y + NOMAD_H / 2;
    this.body = newBody(NOMAD_W, NOMAD_H);
    this.body.x = this.mountTo.x;
    this.body.y = feet - NOMAD_H / 2 - 0.5;
    this.body.onGround = true;
    this.mode = 'nomad';
    this.lockInput = false;
    this.crouch = false;
    const keep = this.nomad;
    this.nomad = keep ?? newNomad();
    this.invuln = 0.8;
    w.onNomadMounted();
  }

  ejectNomad(w: World, expired = false) {
    const n = this.nomad;
    if (!n) return;
    const temp = n.timeLeft !== Infinity;
    const x = this.x;
    const y = this.y;
    w.fx.explosion(x, y - 10, 46);
    w.fx.explosion(x + 20, y + 10, 30);
    w.fx.addFlash(0.6, '#ffd9a0');
    w.fx.addShake(9, 0.6);
    w.audio('nomadDeath', 1.2, x);
    w.audio('eject', 1, x);
    w.fx.debris(x, y, 26, ['#8c9a2a', '#3a3a4a', '#5b6580', '#ffd23a'], 380);
    w.wrecks.push({ x, y: this.feetY, t: 0 });
    this.nomad = null;
    this.mode = 'foot';
    this.body = newBody(FOOT_W, FOOT_H);
    this.body.x = x;
    this.body.y = y - 20;
    this.body.vy = -560;
    this.body.vx = -this.facing * 120;
    this.invuln = 2.2;
    this.glideFuel = GLIDE_FUEL;
    this.hurtT = 0.2;
    if (!temp) w.nomadLost = true;
    w.onNomadLost(temp, expired);
  }

  /** Karimbo salta para fora e o Nômad fica estacionado (evento de seção 11). */
  dismount(w: World, parkX: number) {
    if (!this.nomad) return;
    w.parkedNomad = { x: this.x, y: this.feetY, facing: this.facing, hp: this.nomad.hp };
    const x = this.x;
    const feet = this.feetY;
    this.nomad = null;
    this.mode = 'foot';
    this.body = newBody(FOOT_W, FOOT_H);
    this.body.x = x + this.facing * 26;
    this.body.y = feet - FOOT_H / 2 - 30;
    this.body.vy = -380;
    this.body.vx = this.facing * 90;
    this.invuln = 1;
    w.audio('eject', 0.8, x);
    void parkX;
  }

  // ------------------------------------------------------------------ atualização
  update(w: World, dt: number, ctl: ControlState) {
    this.animT += dt;
    this.scarfT += dt * (8 + Math.abs(this.body.vx) * 0.03);
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.nadeCd > 0) this.nadeCd -= dt;
    this.kick = approach(this.kick, 0, dt * 9);
    this.shootAnim = Math.max(0, this.shootAnim - dt);
    if (this.landSquash > 0) this.landSquash = Math.max(0, this.landSquash - dt * 5);

    if (this.mode === 'dead') {
      this.updateDead(w, dt);
      return;
    }
    if (this.mode === 'mounting') {
      this.updateMounting(w, dt);
      return;
    }
    const c = this.lockInput ? nullControls : ctl;
    if (this.nomad) this.updateNomad(w, dt, c);
    else this.updateFoot(w, dt, c);

    // queda no abismo
    if (this.y > w.deathY()) this.fellIntoPit(w);
    // espinhos/hazard
    this.checkHazards(w);
    // último ponto seguro
    if (this.body.onGround && !this.body.onOneWay) {
      this.safeT += dt;
      if (this.safeT > 0.35 && w.isSafeSpot(this.x, this.feetY)) {
        this.lastSafe = { x: this.x, y: this.feetY };
      }
    } else this.safeT = 0;
  }

  private updateDead(w: World, dt: number) {
    this.deadT += dt;
    this.deadVy += 1600 * dt;
    this.body.y += this.deadVy * dt;
    this.body.x += this.body.vx * dt;
    this.body.vx *= 0.98;
    this.deadRot += dt * 9 * (this.facing === 1 ? -1 : 1);
    if (this.deadT > 1.7 && !this.respawnQueued) {
      this.respawnQueued = true;
      w.requestRespawn();
    }
  }

  private updateMounting(w: World, dt: number) {
    this.mountT += dt / 0.85;
    const t = clamp(this.mountT, 0, 1);
    const e = 1 - (1 - t) * (1 - t);
    this.body.x = this.mountFrom.x + (this.mountTo.x - this.mountFrom.x) * e;
    const arc = -Math.sin(t * Math.PI) * 46;
    this.body.y = this.mountFrom.y + (this.mountTo.y - this.mountFrom.y) * e + arc;
    this.facing = this.mountTo.x >= this.mountFrom.x ? 1 : -1;
    if (this.mountT >= 1) this.finishMount(w);
  }

  // ------------------------------------------------------------------ mira
  private computeAim(w: World, ctl: ControlState, sx: number, sy: number) {
    let aim = this.facing === 1 ? 0 : Math.PI;
    let manual = false;
    if (ctl.mouseAim) {
      const m = w.screenToWorld(ctl.mouseAim.x, ctl.mouseAim.y);
      aim = Math.atan2(m.y - sy, m.x - sx);
      manual = true;
      if (Math.abs(Math.cos(aim)) > 0.12) this.facing = Math.cos(aim) >= 0 ? 1 : -1;
    } else if (ctl.padAim) {
      aim = Math.atan2(ctl.padAim.y, ctl.padAim.x);
      manual = true;
      if (Math.abs(Math.cos(aim)) > 0.12) this.facing = Math.cos(aim) >= 0 ? 1 : -1;
    } else {
      const ax = ctl.aimVecX;
      const ay = ctl.aimVecY;
      if (Math.abs(ax) > 0.3) this.facing = ax > 0 ? 1 : -1;
      const mag = Math.hypot(ax, ay);
      const air = !this.body.onGround;
      if (mag > 0.4) {
        let a = Math.atan2(ay, Math.abs(ax) < 0.3 ? 0 : ax);
        if (Math.abs(ax) < 0.3) {
          // vertical puro
          if (ay < -0.5) a = -Math.PI / 2;
          else if (ay > 0.5 && air) a = Math.PI / 2;
          else a = this.facing === 1 ? 0 : Math.PI;
        } else {
          // 8 direções
          const q = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
          a = q;
          if (!air && a > 0.1 && Math.abs(ax) >= 0.3) {
            // no chão, "para baixo diagonal" vira agachar/frente
            a = ax > 0 ? 0 : Math.PI;
          }
        }
        aim = a;
        // vertical puro mantém facing; diagonal segue ax
      }
    }
    // assistência de mira (toque/teclado)
    if (!manual && settings.aimAssist) aim = this.assistAim(w, aim, sx, sy);
    return aim;
  }

  private assistAim(w: World, aim: number, sx: number, sy: number) {
    let best: number | null = null;
    let bd = 0.3; // ±17°
    for (const e of w.enemies) {
      if (!e.alive || !e.awake || !e.canBeHit) continue;
      const dx = e.x - sx;
      const dy = e.y - sy;
      const d2 = dx * dx + dy * dy;
      if (d2 > 430 * 430 || d2 < 30 * 30) continue;
      const a = Math.atan2(dy, dx);
      const diff = Math.abs(angleDiff(aim, a));
      if (diff < bd) {
        bd = diff;
        best = a;
      }
    }
    if (best === null) return aim;
    return best;
  }

  // ------------------------------------------------------------------ Karimbo a pé
  private updateFoot(w: World, dt: number, ctl: ControlState) {
    const b = this.body;
    const hurt = this.hurtT > 0;
    const wasCrouch = this.crouch;

    // agachar
    const wantCrouch = b.onGround && ctl.moveY > 0.6 && !hurt;
    if (wantCrouch && !wasCrouch) {
      this.setCrouch(true, w);
      if (Math.abs(b.vx) > RUN * 0.7 && this.slideT <= 0) {
        this.slideT = SLIDE_T;
        this.slideDir = b.vx > 0 ? 1 : -1;
        this.facing = this.slideDir as 1 | -1;
        w.audio('land', 0.8, this.x);
        w.fx.add(PK.Ring, this.x, this.feetY - 4, 0, 0, 0.25, 6, '#e9e2ff', { size1: 26, a0: 0.5, front: true });
      }
    }
    if (this.slideT > 0) {
      this.slideT -= dt;
      if (!this.crouch || hurt) this.slideT = 0;
    }
    else if (!wantCrouch && wasCrouch && this.canStand(w)) this.setCrouch(false, w);
    if (this.crouch && !b.onGround) this.setCrouch(false, w);

    // horizontal
    let tx = 0;
    if (!hurt) tx = ctl.moveX * (this.crouch ? CROUCH_SPEED : this.glide ? GLIDE_SPEED : RUN);
    const grounded = b.onGround;
    const acc = grounded ? (Math.abs(tx) > 0 ? RUN_ACC : RUN_DEC) : Math.abs(tx) > 0 ? AIR_ACC : AIR_DEC;
    if (this.slideT > 0 && grounded) {
      // deslize: arranque forte que perde força
      const k = this.slideT / SLIDE_T;
      b.vx = this.slideDir * (CROUCH_SPEED + (SLIDE_V - CROUCH_SPEED) * k);
      if (Math.random() < dt * 40) w.fx.add(PK.Dust, this.x - this.slideDir * 10, this.feetY - 1, -this.slideDir * rand.range(30, 90), -rand.range(6, 30), 0.35, 6, '#b9b0c8', { size1: 2, a0: 0.6 });
      if (Math.random() < dt * 20) w.fx.add(PK.Spark, this.x, this.feetY - 1, -this.slideDir * rand.range(60, 160), -rand.range(20, 80), 0.2, 4, '#ffd27a', { size1: 1, g: 500, front: true });
    } else if (!hurt || grounded) b.vx = approach(b.vx, tx, acc * dt);

    // timers de pulo
    if (grounded) {
      this.coyote = COYOTE;
      this.glideFuel = GLIDE_FUEL;
      this.glideUsed = false;
      this.airTime = 0;
    } else {
      this.coyote -= dt;
      this.airTime += dt;
    }
    if (ctl.jump.pressed) this.jumpBuf = JUMP_BUF;
    else this.jumpBuf -= dt;

    // descer plataforma one-way: baixo + pulo
    if (grounded && b.onOneWay && ctl.moveY > 0.6 && ctl.jump.pressed && !hurt) {
      b.dropTimer = 0.24;
      b.y += 2;
      this.jumpBuf = 0;
      this.coyote = 0;
    }

    // pulo
    if (this.jumpBuf > 0 && this.coyote > 0 && !hurt) {
      b.vy = -JUMP_V;
      this.jumping = true;
      this.jumpBuf = 0;
      this.coyote = 0;
      b.onGround = false;
      this.setCrouch(false, w);
      w.audio('jump', 0.7, this.x);
      w.fx.add(PK.Dust, this.x, this.feetY, -b.vx * 0.1, -6, 0.35, 8, '#b9b0c8', { size1: 2, a0: 0.5 });
    }
    // altura variável
    if (this.jumping && !ctl.jump.held && b.vy < -150) {
      b.vy *= 0.55;
      this.jumping = false;
    }
    if (b.vy >= 0) this.jumping = false;

    // EAR GLIDE: apertar pulo de novo no ar
    if (!grounded && this.coyote <= 0 && ctl.jump.pressed && !this.glide && this.glideFuel > 0.15 && !hurt) {
      this.startGlide(w);
    }
    if (this.glide) {
      this.glideT += dt;
      if (!ctl.jump.held || grounded || this.glideFuel <= 0 || hurt) {
        this.stopGlide(w);
      } else {
        this.glideFuel -= dt;
        // desaceleração da queda (com leve sustentação inicial)
        const target = GLIDE_FALL + Math.sin(this.glideT * 6) * 6;
        if (b.vy > target) b.vy = approach(b.vy, target, 2600 * dt);
        else b.vy += 900 * dt * 0.2; // subindo: continua a subir levemente
        if (Math.random() < 0.35 && w.fx.opt()) {
          w.fx.add(PK.Dust, this.x + rand.spread(24), this.y - 18 + rand.spread(6), 0, 8, 0.35, 5, '#e9e2ff', { size1: 1, a0: 0.4 });
        }
      }
    } else {
      // gravidade normal
      b.vy = Math.min(FALL_MAX, b.vy + GRAV * dt);
      if (b.vy < 0 && !ctl.jump.held) b.vy += GRAV * 0.6 * dt; // corte mais firme
    }
    // ear glide anim
    this.earGlide = damp(this.earGlide, this.glide ? 1 : 0, this.glide ? 18 : 22, dt);
    if (this.earGlide < 0.02 && !this.glide) this.earGlide = 0;

    // ---- colisão
    const wasGround = b.onGround;
    const preVy = b.vy;
    moveBody(b, dt, w.level, w.solidRects, true);
    if (b.onGround && !wasGround && preVy > 220) this.onLand(w, preVy);
    if (b.hitCeil) this.jumping = false;

    // ---- mira + armas
    const [sx, sy] = this.shoulder;
    this.aim = this.computeAim(w, ctl, sx, sy);
    this.aimVis = this.aim;
    if (ctl.next.pressed) this.cycleWeapon(1, w);
    if (ctl.prev.pressed) this.cycleWeapon(-1, w);
    if (!hurt) {
      if (ctl.fire.held) this.shoot(w);
      if (ctl.grenade.pressed) this.throwGrenade(w);
    }

    // animação de corrida
    if (grounded && Math.abs(b.vx) > 20) {
      this.runPhase += dt * (8 + Math.abs(b.vx) * 0.035);
      this.stepAcc += Math.abs(b.vx) * dt;
      if (this.stepAcc > 34) {
        this.stepAcc = 0;
        w.audio('step', 0.5, this.x);
        if (w.fx.opt()) w.fx.add(PK.Dust, this.x - this.facing * 4, this.feetY - 1, -this.facing * 14, -6, 0.3, 5, '#b9b0c8', { size1: 1, a0: 0.4 });
      }
    } else if (grounded) this.runPhase = damp(this.runPhase, Math.round(this.runPhase / Math.PI) * Math.PI, 12, dt);
    this.wasGround = b.onGround;
  }

  private startGlide(w: World) {
    this.glide = true;
    this.glideT = 0;
    this.glideUsed = true;
    const b = this.body;
    if (b.vy > -60) b.vy = -110; // pequeno impulso do "abrir de orelhas"
    w.audio('flap', 0.9, this.x);
    w.fx.add(PK.Ring, this.x, this.y - 18, 0, 0, 0.3, 6, '#e9e2ff', { size1: 30, a0: 0.5, front: true });
    w.fx.sparks(this.x, this.y - 18, 8, '#ffffff', 160);
  }
  private stopGlide(w: World) {
    if (!this.glide) return;
    this.glide = false;
    void w;
  }

  private onLand(w: World, vy: number) {
    this.landSquash = clamp(vy / 700, 0.25, 1);
    this.justLanded = 0.1;
    w.audio('land', clamp(vy / 600, 0.3, 1), this.x);
    if (this.glide) this.stopGlide(w);
    for (let i = 0; i < 5; i++) {
      w.fx.add(PK.Dust, this.x + rand.spread(10), this.feetY - 1, rand.spread(70), -rand.range(6, 24), 0.4, 7, '#b9b0c8', { size1: 2, a0: 0.55 });
    }
    if (vy > 640) w.fx.addShake(1.2, 0.1);
  }

  private setCrouch(c: boolean, w: World) {
    if (this.crouch === c) return;
    const b = this.body;
    const feet = b.y + b.h / 2;
    this.crouch = c;
    b.h = c ? CROUCH_H : FOOT_H;
    b.y = feet - b.h / 2;
    void w;
  }
  private canStand(w: World) {
    const b = this.body;
    const feet = b.y + b.h / 2;
    const top = feet - FOOT_H;
    for (const dx of [-b.w / 2 + 1, 0, b.w / 2 - 1]) {
      if (w.level.solidAtPx(b.x + dx, top + 1)) return false;
      if (w.level.solidAtPx(b.x + dx, top + 20)) return false;
    }
    return true;
  }

  private cycleWeapon(dir: number, w: World) {
    const owned = WEAPON_ORDER.filter((id) => this.weapons.has(id) && (this.weapons.get(id)! > 0 || id === 'pistol'));
    if (owned.length < 2) return;
    let i = owned.indexOf(this.cur);
    if (i < 0) i = 0;
    i = (i + dir + owned.length) % owned.length;
    this.cur = owned[i];
    w.audio('uiClick', 0.6, this.x);
    w.fx.popup(this.x, this.y - 44, WEAPONS[this.cur].name, '#ffffff', 8);
  }

  // ------------------------------------------------------------------ armas
  private shoot(w: World) {
    if (this.fireCd > 0) return;
    if (this.nomad) {
      this.nomadShoot(w);
      return;
    }
    const d = WEAPONS[this.cur];
    const ammo = this.weapons.get(this.cur) ?? 0;
    if (ammo <= 0) {
      this.cur = 'pistol';
      return;
    }
    this.fireCd = d.rate;
    if (ammo !== Infinity) {
      this.weapons.set(this.cur, ammo - 1);
      if (ammo - 1 <= 0) {
        w.fx.popup(this.x, this.y - 44, 'SEM MUNIÇÃO', '#ff8a8a', 8);
      }
    }
    const [mx, my] = karimboMuzzle(this.facing, this.aim, this.cur, this.crouch, this.kick);
    const ox = this.x + mx;
    const oy = this.feetY + my;
    const wallT = w.level.rayHit(this.x, oy, ox, oy); // boca dentro da parede → sai do corpo
    const spawnX = wallT >= 0 ? this.x : ox;
    for (let i = 0; i < d.pellets; i++) {
      const spread = d.pellets > 1 ? (rand.next() - 0.5) * d.spread * (0.6 + i * 0.05) : (rand.next() - 0.5) * d.spread;
      const a = this.aim + spread;
      const sp = d.speed + (d.speedVar ? rand.spread(d.speedVar) : 0);
      w.spawnPlayerBullet(
        spawnX,
        oy,
        Math.cos(a) * sp,
        Math.sin(a) * sp,
        {
          kind: this.cur === 'launcher' ? 'rocket' : this.cur === 'energy' ? 'plasma' : d.pellets > 1 ? 'shell' : 'std',
          team: 0,
          dmg: d.dmg,
          life: d.life * (d.pellets > 1 ? rand.range(0.85, 1.1) : 1),
          r: d.radius,
          pierce: d.pierce,
          gravity: d.gravity,
          kb: d.kb,
          color: d.color,
          trail: d.trail,
          explode: d.explosive ?? null,
          dmgProps: this.cur === 'launcher' ? 30 : d.dmg,
        }
      );
    }
    this.kick = 1;
    this.shootAnim = 0.12;
    // recuo no atirador
    const rc = d.recoil;
    if (rc > 60 || !this.body.onGround) this.body.vx -= Math.cos(this.aim) * rc * (this.body.onGround ? 0.6 : 1);
    // efeitos
    w.audio(d.sfx, 0.85, this.x);
    w.fx.add(PK.Fire, ox, oy, 0, 0, 0.07, d.pellets > 1 ? 15 : 10, d.trail, { size1: 4, front: true });
    if (d.pellets > 1 || this.cur === 'launcher') {
      w.fx.smoke(ox, oy, 2, '#8b8499', 6, 20, 0.5);
      w.fx.sparks(ox, oy, 5, '#ffd27a', 260, Math.cos(this.aim), Math.sin(this.aim), 0.7);
    }
    if (d.casing) {
      w.fx.add(PK.Casing, this.x, oy - 2, -this.facing * rand.range(40, 90), -rand.range(120, 200), 0.9, 2, '#e8b64a', { g: 900, bounce: 0.45, vr: rand.spread(20), front: true });
    }
    if (d.shake > 0) w.fx.addShake(d.shake, 0.12);
    w.noteShot();
  }

  private throwGrenade(w: World) {
    if (this.grenades <= 0 || this.nadeCd > 0) return;
    this.grenades--;
    this.nadeCd = this.nomad ? 0.7 : 0.55;
    const [sx, sy] = this.shoulder;
    // arco: mira para cima segue a mira; senão lança para frente e para cima
    let a = this.aim;
    if (Math.sin(a) > -0.25) a = this.facing === 1 ? -0.62 : -Math.PI + 0.62;
    const spd = this.nomad ? 520 : 470;
    const vx = Math.cos(a) * spd + this.body.vx * 0.4;
    const vy = Math.sin(a) * spd - 60;
    w.grenades.push(new Grenade(sx + Math.cos(a) * 10, sy + Math.sin(a) * 6, vx, vy, 0, !!this.nomad));
    w.audio('grenadeThrow', 0.8, this.x);
    this.kick = 0.6;
  }

  // ------------------------------------------------------------------ Nômad
  private nomadShoot(w: World) {
    const n = this.nomad!;
    if (n.fireCd > 0) return;
    n.fireCd = 0.56;
    this.fireCd = 0.56;
    n.recoil = 1;
    const aim = this.aim;
    const [ax, ay] = nomadMuzzle(this.facing, aim, 0);
    const [bx, by] = nomadMuzzle(this.facing, aim, 1);
    const fire = (mx: number, my: number, delay: number) => {
      const ox = this.x + mx;
      const oy = this.y + my;
      const wall = w.level.rayHit(this.x, oy, ox, oy) >= 0;
      const spawnX = wall ? this.x : ox;
      w.after(delay, () => {
        for (let i = 0; i < 9; i++) {
          const a = aim + (rand.next() - 0.5) * 0.44;
          const sp = 640 + rand.spread(140);
          w.spawnPlayerBullet(spawnX, oy, Math.cos(a) * sp, Math.sin(a) * sp, {
            kind: 'nomadShell', team: 0, dmg: 9, life: rand.range(0.3, 0.4), r: 3, kb: 320, color: '#fff0b8', trail: '#ff9a3a', fromNomad: true, dmgProps: 12, pierce: 1,
          });
        }
        w.fx.add(PK.Fire, ox, oy, 0, 0, 0.1, 22, '#ffb347', { size1: 6, front: true });
        w.fx.add(PK.Fire, ox, oy, 0, 0, 0.06, 12, '#fff2c0', { size1: 3, front: true });
        w.fx.smoke(ox, oy, 3, '#9a93aa', 9, 22, 0.6);
        w.fx.sparks(ox, oy, 8, '#ffd27a', 320, Math.cos(aim), Math.sin(aim), 0.9);
        w.audio('nomadShot', 1, this.x);
      });
    };
    fire(ax, ay, 0);
    fire(bx, by, 0.045);
    this.body.vx -= Math.cos(aim) * 105;
    w.fx.addShake(5, 0.16);
    w.fx.addHitStop(0.035);
    w.noteShot();
  }

  private updateNomad(w: World, dt: number, ctl: ControlState) {
    const n = this.nomad!;
    const b = this.body;
    if (n.fireCd > 0) n.fireCd -= dt;
    if (n.invuln > 0) n.invuln -= dt;
    if (n.hurtFlash > 0) n.hurtFlash -= dt;
    n.recoil = approach(n.recoil, 0, dt * 6);
    if (n.window > 0) n.window -= dt;
    if (n.cooldown > 0) n.cooldown -= dt;
    n.smokeT += dt;
    const lowFrac = n.hp / n.maxHp;

    // ---- dano contínuo visual e alarme
    if (lowFrac < 0.4 && Math.random() < dt * (lowFrac < 0.2 ? 18 : 8)) {
      w.fx.smoke(this.x + rand.spread(16), this.y - 14, 1, lowFrac < 0.2 ? '#231d30' : '#4d4560', 8, 34, 0.9);
      if (lowFrac < 0.25) w.fx.sparks(this.x + rand.spread(16), this.y - 10, 2, '#ffd27a', 140);
    }
    if (lowFrac < 0.25) {
      n.lowWarn += dt;
      w.setAlarm(true);
    } else w.setAlarm(false);

    // ---- avanço (dash)
    if (n.dashT > 0) {
      this.updateDash(w, dt, n);
    } else if (ctl.special.pressed && !this.lockInput) {
      this.tryDash(w, n, ctl);
    }

    const dashing = n.dashT > 0;
    let tx = ctl.moveX * N_RUN;
    const grounded = b.onGround;
    if (grounded) {
      this.coyote = COYOTE;
      n.boost = true;
    } else this.coyote -= dt;
    if (ctl.jump.pressed) this.jumpBuf = JUMP_BUF;
    else this.jumpBuf -= dt;

    if (!dashing) {
      const acc = grounded ? (Math.abs(tx) > 0 ? N_ACC : N_DEC) : Math.abs(tx) > 0 ? 780 : 260;
      b.vx = approach(b.vx, tx, acc * dt);
      // descer one-way
      if (grounded && b.onOneWay && ctl.moveY > 0.6 && ctl.jump.pressed) {
        b.dropTimer = 0.26;
        b.y += 2;
        this.jumpBuf = 0;
        this.coyote = 0;
      }
      if (this.jumpBuf > 0 && this.coyote > 0) {
        b.vy = -N_JUMP;
        this.jumpBuf = 0;
        this.coyote = 0;
        this.jumping = true;
        w.audio('nomadHop', 0.9, this.x);
        w.fx.smoke(this.x, this.feetY, 3, '#b9b0c8', 8, 10, 0.4);
      } else if (!grounded && ctl.jump.pressed && n.boost && this.coyote <= 0) {
        // propulsor aéreo (uma vez por salto)
        n.boost = false;
        b.vy = Math.min(b.vy, -380);
        w.audio('thruster', 0.9, this.x);
        w.fx.sparks(this.x, this.feetY, 10, '#ffb347', 220, 0, 1, 1.2);
        w.fx.add(PK.Fire, this.x, this.feetY - 4, 0, 60, 0.3, 16, '#ffb347', { size1: 3 });
      }
      if (this.jumping && !ctl.jump.held && b.vy < -160) {
        b.vy *= 0.6;
        this.jumping = false;
      }
      if (b.vy >= 0) this.jumping = false;
      b.vy = Math.min(FALL_MAX, b.vy + N_GRAV * dt);
    }

    this.nomadCrush(w, dt);
    const wasGround = b.onGround;
    const preVy = b.vy;
    moveBody(b, dt, w.level, w.solidRects, true);
    if (b.onGround && !wasGround && preVy > 200) {
      w.audio('land', 1, this.x);
      w.fx.addShake(2, 0.12);
      for (let i = 0; i < 8; i++) w.fx.add(PK.Dust, this.x + rand.spread(20), this.feetY - 1, rand.spread(110), -rand.range(6, 30), 0.5, 9, '#b9b0c8', { size1: 3, a0: 0.6 });
    }

    // rolagem da esfera
    n.roll += (b.vx * dt) / 24;
    // partículas de poeira/faíscas
    const sp = Math.abs(b.vx);
    if (grounded && sp > 60) {
      if (Math.random() < dt * (sp / 8)) {
        w.fx.add(PK.Dust, this.x - Math.sign(b.vx) * 14, this.feetY - 2, -b.vx * 0.15, -rand.range(8, 26), 0.5, 8, '#b9b0c8', { size1: 3, a0: 0.55 });
      }
      if (sp > 190 && Math.random() < dt * 14) {
        w.fx.add(PK.Spark, this.x - Math.sign(b.vx) * 16, this.feetY - 1, -b.vx * 0.3 + rand.spread(30), -rand.range(40, 110), 0.25, 6, '#ffd27a', { size1: 1, g: 500, front: true });
      }
    }
    w.rollSound(grounded ? sp / N_RUN : 0);

    // mira
    const [sx, sy] = [this.x, this.y - 16];
    this.aim = this.computeAim(w, ctl, sx, sy);
    n.turretTilt = damp(n.turretTilt, -clamp(Math.atan2(Math.sin(this.aim), Math.abs(Math.cos(this.aim)) + 0.05), -1.0, 1.0) * 0.5, 14, dt);
    if (ctl.fire.held && !dashing) this.shoot(w);
    if (ctl.grenade.pressed && !dashing) this.throwGrenade(w);
    this.wasGround = b.onGround;
    if (grounded) this.airTime = 0;
    else this.airTime += dt;
  }

  /**
   * O Nômad é um robô grande: caixas, barris, barricadas e afins quebram só de encostar ou
   * pousar em cima (sem precisar atirar). Pousar sobre inimigos também os esmaga.
   */
  private nomadCrush(w: World, dt: number) {
    const b = this.body;
    const ahead = Math.abs(b.vx) * dt * 2 + 8;
    const x0 = b.x - b.w / 2 - (b.vx < 0 ? ahead : 4);
    const x1 = b.x + b.w / 2 + (b.vx > 0 ? ahead : 4);
    const y0 = b.y - b.h / 2 - 4;
    const y1 = b.y + b.h / 2 + (b.vy > 0 ? b.vy * dt * 2 + 6 : 3);
    let crushed = 0;
    for (const p of w.props) {
      if (!p.alive || !p.hittable || p.dashOnly || p.barrier) continue;
      const r = p.rect;
      if (r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0) {
        p.hurt(w, 999, 'melee', Math.sign(p.x - b.x) || this.facing);
        if (!p.alive) crushed++;
      }
    }
    if (crushed) {
      w.audio('crush', 1, this.x);
      w.fx.addShake(3.5, 0.18);
      w.fx.addHitStop(0.025);
      b.vx *= 0.92; // quase não perde embalo
      w.rebuildSolids(); // libera o caminho já neste passo
    }
    // pisão: cair em cima de inimigos
    if (b.vy > 160) {
      for (const e of w.enemies) {
        if (!e.alive || !e.canBeHit || e.isBoss) continue;
        const eb = e.hitbox;
        const feet = b.y + b.h / 2;
        if (Math.abs(e.x - b.x) < b.w / 2 + eb.w / 2 - 4 && feet > eb.y - 6 && feet < eb.y + eb.h * 0.6) {
          e.hurt(w, 80, { kx: Math.sign(e.x - b.x) * 360, ky: -200, x: e.x, y: eb.y, type: 'dash', dir: Math.sign(e.x - b.x) || 1 });
          b.vy = -380; // quica
          w.audio('dashHit', 1, e.x);
          w.fx.addShake(5, 0.2);
          w.fx.add(PK.Ring, e.x, eb.y, 0, 0, 0.3, 8, '#ffe27a', { size1: 50, a0: 0.8, front: true });
          w.fx.popup(e.x, eb.y - 20, 'ESMAGADO!', '#ffe27a', 10);
          break;
        }
      }
    }
  }

  private tryDash(w: World, n: NomadState, ctl: ControlState) {
    void ctl;
    // segundo avanço (secreto): dentro de 5 s depois do primeiro
    if (n.window > 0 && n.dashKind === 1 && !n.dash2Used) {
      this.startDash(w, n, 2);
      return;
    }
    if (n.cooldown <= 0 && n.window <= 0) this.startDash(w, n, 1);
  }

  private startDash(w: World, n: NomadState, kind: 1 | 2) {
    n.dashKind = kind;
    n.dashT = kind === 1 ? 0.3 : 0.44;
    n.dashTime = n.dashT;
    n.dashDir = this.facing;
    n.hitThisDash = [];
    const b = this.body;
    b.vx = this.facing * (kind === 1 ? 820 : 1120);
    b.vy = Math.min(b.vy, 0) * 0.3 - (kind === 2 ? 30 : 0);
    this.invuln = Math.max(this.invuln, n.dashT + 0.1);
    if (kind === 1) {
      n.window = 5;
      n.dash1Uses++;
      n.dash2Used = false;
      w.stats.dashes++;
    } else {
      n.dash2Used = true;
      n.window = 0;
      w.progressDashDiscovered();
      w.stats.dashes++;
      w.fx.slowmo = 0.16;
      w.fx.slowScale = 0.35;
      w.fx.addFlash(0.25, '#ffb060');
    }
    w.audio(kind === 1 ? 'dash' : 'dash2', 1, this.x);
    w.fx.addShake(kind === 1 ? 4 : 8, 0.3);
    w.fx.add(PK.Ring, this.x, this.y, 0, 0, 0.35, 10, kind === 1 ? '#7ff9ff' : '#ffb060', { size1: kind === 1 ? 60 : 90, a0: 0.8, front: true });
  }

  private updateDash(w: World, dt: number, n: NomadState) {
    const b = this.body;
    n.dashT -= dt;
    const t = n.dashT / n.dashTime;
    const speed = n.dashKind === 1 ? 820 : 1120;
    b.vx = n.dashDir * speed * (0.55 + 0.45 * t);
    b.vy = b.onGround ? 0 : b.vy + 400 * dt * 0.25;
    this.facing = n.dashDir as 1 | -1;
    // rastro
    const col = n.dashKind === 1 ? '#7ff9ff' : '#ffb060';
    for (let i = 0; i < (n.dashKind === 1 ? 2 : 4); i++) {
      w.fx.add(PK.Fire, this.x - n.dashDir * (10 + i * 12), this.y - 4 + rand.spread(14), -n.dashDir * 30, rand.spread(20), 0.3, n.dashKind === 1 ? 14 : 20, col, { size1: 2 });
    }
    w.fx.add(PK.Spark, this.x - n.dashDir * 20, this.feetY - 2, -n.dashDir * rand.range(60, 220), -rand.range(20, 120), 0.3, 8, '#fff2b0', { size1: 1.4, g: 500, front: true });
    w.speedLines = 0.25;
    // dano/empurrão em quem toca
    const hb = { x: this.x - 42, y: this.y - 46, w: 84, h: 96 };
    const kbx = n.dashDir * (n.dashKind === 1 ? 640 : 900);
    for (const e of w.enemies) {
      if (!e.alive || !e.canBeHit || n.hitThisDash.includes(e)) continue;
      const eb = e.hitbox;
      if (hb.x < eb.x + eb.w && hb.x + hb.w > eb.x && hb.y < eb.y + eb.h && hb.y + hb.h > eb.y) {
        n.hitThisDash.push(e);
        const dmg = n.dashKind === 1 ? 55 : 90;
        e.hurt(w, dmg, { kx: kbx, ky: -260, x: e.x, y: e.y, type: 'dash', dir: n.dashDir });
        w.fx.addHitStop(0.06);
        w.fx.addShake(6, 0.2);
        w.audio('dashHit', 1, e.x);
        w.fx.sparks(e.x, e.y, 12, '#ffffff', 340);
        w.fx.add(PK.Ring, e.x, e.y, 0, 0, 0.25, 8, '#ffffff', { size1: 38, a0: 0.8, front: true });
      }
    }
    for (const p of w.props) {
      if (!p.alive || !p.hittable) continue;
      const r = p.rect;
      if (hb.x < r.x + r.w && hb.x + hb.w > r.x && hb.y < r.y + r.h && hb.y + hb.h > r.y) {
        p.hurt(w, 999, 'dash', n.dashDir);
      }
    }
    if (b.wallDir !== 0 && n.dashT > 0.06) {
      // bateu em parede sólida: encerra com impacto
      n.dashT = 0.001;
      w.fx.addShake(7, 0.25);
      w.fx.sparks(this.x + n.dashDir * 26, this.y, 14, '#ffd27a', 320, -n.dashDir, 0, 2);
      w.audio('dashHit', 1, this.x);
    }
    if (n.dashT <= 0) this.endDash(w, n);
  }

  private endDash(w: World, n: NomadState) {
    n.dashT = 0;
    this.body.vx *= 0.35;
    if (n.dashKind === 2) {
      // onda de choque final
      w.explode(this.x + n.dashDir * 26, this.y + 10, 96, 90, 0, { kb: 460, fromNomad: true, big: false, noProps: false, silent: true });
      w.fx.add(PK.Ring, this.x + n.dashDir * 26, this.y + 14, 0, 0, 0.5, 12, '#ffb060', { size1: 110, a0: 0.9, front: true });
      w.fx.addShake(9, 0.35);
      n.cooldown = 3.4;
      n.window = 0;
    } else {
      // janela de 5 s continua; sem 2º avanço o primeiro só volta após a janela
      n.cooldown = 0;
    }
  }

  private fellIntoPit(w: World) {
    this.fallCount++;
    w.audio('hurt', 0.6, this.x);
    w.fx.addShake(3, 0.2);
    const n = this.nomad;
    const s = this.lastSafe;
    this.body.vx = this.body.vy = 0;
    this.body.x = s.x;
    this.body.y = s.y - this.body.h / 2 - 1;
    w.fx.addFlash(0.35, '#000000');
    this.invuln = 1.5;
    w.stats.pitFalls++;
    if (n) {
      n.hp -= 35;
      n.hurtFlash = 0.2;
      if (n.hp <= 0) this.ejectNomad(w);
    } else {
      this.hp -= 20;
      if (this.hp <= 0) {
        this.hp = 0;
        this.die(w);
      }
    }
    w.cameraSnap();
  }

  private checkHazards(w: World) {
    if (this.invuln > 0 || this.mode === 'dead') return;
    const b = this.body;
    const feet = b.y + b.h / 2 - 3;
    const tx0 = Math.floor((b.x - b.w / 2 + 3) / TILE);
    const tx1 = Math.floor((b.x + b.w / 2 - 3) / TILE);
    const ty = Math.floor(feet / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      if (w.level.get(tx, ty) === T.HAZARD) {
        this.hit(w, 14, -this.facing, { kx: 120, ky: -380 });
        return;
      }
    }
  }

  // ------------------------------------------------------------------ desenho
  draw(g: CanvasRenderingContext2D, w: World) {
    const art = getArt();
    const blink = this.invuln > 0 && !this.isDashing && Math.floor(this.animT * 18) % 2 === 0 && this.mode !== 'dead';
    const alpha = blink ? 0.4 : 1;
    const b = this.body;
    if (this.mode === 'nomad' && this.nomad) {
      const n = this.nomad;
      drawNomad(g, art.nomad, art.karimbo.heads, this.x, this.feetY, {
        facing: this.facing,
        roll: n.roll,
        tilt: n.turretTilt,
        aim: this.aim,
        recoil: n.recoil,
        flash: n.hurtFlash > 0,
        t: this.animT,
        vx: b.vx,
        vy: b.vy,
        onGround: b.onGround,
        dashing: n.dashT > 0 ? n.dashKind : 0,
        alpha,
        hp01: n.hp / n.maxHp,
        pilot: true,
        earFlap: Math.min(1, Math.abs(b.vx) / 400 + (n.dashT > 0 ? 1 : 0)),
        ready: n.cooldown <= 0 && n.window <= 0,
      });
      return;
    }
    if (this.mode === 'mounting') {
      drawKarimbo(g, art.karimbo, this.x, this.y + FOOT_H / 2, {
        facing: this.facing, state: 'jump', t: this.animT, runPhase: 0, speed01: 0, aim: this.facing === 1 ? 0 : Math.PI, weapon: this.cur,
        kick: 0, flash: false, earGlide: 0, vy: -100, alpha: 1, hasGun: false, scarf: this.scarfT,
      });
      return;
    }
    if (this.mode === 'dead') {
      g.save();
      g.translate(this.x, this.feetY - 24);
      g.rotate(this.deadRot);
      drawKarimbo(g, art.karimbo, 0, 24, {
        facing: this.facing, state: 'hurt', t: this.animT, runPhase: 0, speed01: 0, aim: 0, weapon: this.cur, kick: 0, flash: false,
        earGlide: 0, vy: 0, alpha: 1, hasGun: false, scarf: this.scarfT * 2,
      });
      g.restore();
      return;
    }
    let st: KState = 'idle';
    if (this.hurtT > 0) st = 'hurt';
    else if (this.glide) st = 'glide';
    else if (!b.onGround) st = b.vy < 0 ? 'jump' : 'fall';
    else if (this.crouch) st = 'crouch';
    else if (Math.abs(b.vx) > 25) st = 'run';
    drawKarimbo(g, art.karimbo, this.x, this.feetY, {
      facing: this.facing,
      state: st,
      t: this.animT,
      runPhase: this.runPhase,
      speed01: Math.abs(b.vx) / RUN,
      aim: this.aimVis,
      weapon: this.cur,
      kick: this.kick,
      flash: this.hurtT > 0.2,
      earGlide: this.earGlide,
      vy: b.vy,
      alpha,
      hasGun: true,
      scarf: this.scarfT,
      squash: this.landSquash * (b.onGround ? 1 : 0),
    });
    // barra de "combustível" do glide (sutil)
    if (this.glide || (this.glideUsed && !b.onGround && this.glideFuel < GLIDE_FUEL * 0.999 && this.glideFuel > 0)) {
      const f = clamp(this.glideFuel / GLIDE_FUEL, 0, 1);
      g.globalAlpha = 0.75;
      g.fillStyle = '#170f2e';
      g.fillRect(this.x - 11, this.feetY - 84, 22, 3);
      g.fillStyle = f > 0.3 ? '#9dfcff' : '#ff8a8a';
      g.fillRect(this.x - 10, this.feetY - 83.2, 20 * f, 1.4);
      g.globalAlpha = 1;
    }
    void w;
  }
}

export const newNomad = (): NomadState => ({
  hp: 450, // +50%
  maxHp: 450,
  dashT: 0,
  dashKind: 0,
  dashDir: 1,
  dashTime: 0.3,
  window: 0,
  cooldown: 0,
  dash1Uses: 0,
  dash2Used: false,
  hitThisDash: [],
  roll: 0,
  boost: true,
  fireCd: 0,
  recoil: 0,
  invuln: 0,
  hurtFlash: 0,
  lowWarn: 0,
  nadeCd: 0,
  turretTilt: 0,
  smokeT: 0,
  hintShown: false,
  timeLeft: Infinity,
  maxTime: Infinity,
});

/**
 * Bocas das duas shotguns do Nômad (relativas ao centro do corpo, mundo).
 * (Arte original olha p/ esquerda: canhão distante na ponta, canhão próximo mais atrás.)
 */
export function nomadMuzzle(facing: 1 | -1, aim: number, which: 0 | 1): [number, number] {
  const a = facing === 1 ? aim : Math.PI - aim;
  const base = which === 0 ? [47, -48] : [-11, -54];
  const len = which === 0 ? 10 : 24;
  const lx = base[0] + Math.cos(a) * len;
  const ly = base[1] + Math.sin(a) * len * 0.9;
  return [lx * facing, ly];
}

const nullControls: ControlState = {
  moveX: 0, moveY: 0, aimVecX: 0, aimVecY: 0, mouseAim: null, padAim: null,
  jump: { held: false, pressed: false, released: false },
  fire: { held: false, pressed: false, released: false },
  grenade: { held: false, pressed: false, released: false },
  special: { held: false, pressed: false, released: false },
  next: { held: false, pressed: false, released: false },
  prev: { held: false, pressed: false, released: false },
  pause: { held: false, pressed: false, released: false },
  device: 'kb',
};

void TAU;
