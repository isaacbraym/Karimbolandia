import { Enemy, type HurtInfo } from './enemy';
import type { World } from '../world';
import type { EnemySpawn } from '../level';
import { TILE, T } from '../level';
import { clamp, rand, approach, angleDiff, damp } from '../../core/math';
import { getArt } from '../../art';
import { drawFelipao, FELI_LAYOUT } from '../../art/felipao';

const CRUMBLE_WARN = 2; // s de aviso antes do chão cair
import { PK } from '../fx';

type BState =
  | 'enter' | 'idle' | 'cannon' | 'missiles' | 'summon' | 'dash' | 'pound' | 'beam' | 'stun' | 'transition' | 'dying';

/** FELIPÃO — chefe em 3 fases. */
export class Felipao extends Enemy {
  phase: 1 | 2 | 3 = 1;
  state: BState = 'enter';
  st = 0; // tempo no estado
  hover = 6;
  hoverVy = 0;
  lean = 0;
  squash = 1;
  charge = 0;
  reactor = 0.2;
  thrust = 0;
  rackOpen = 0;
  taunt = 0;
  shake = 0;
  aimL = Math.PI;
  aimR = Math.PI;
  kickL = 0;
  kickR = 0;
  restT = 1.4;
  lastAtk = '';
  atkCount = 0;
  dir: 1 | -1 = -1;
  homeX: number;
  floorY: number;
  rect = { x: 0, y: 0, w: 0, h: 0 };
  swayT = 0;
  // ataques
  shots = 0;
  shotGap = 0;
  shotSide = 0;
  missilesLeft = 0;
  missileGap = 0;
  poundStage = 0;
  poundsLeft = 0;
  targetX = 0;
  beamAng = 0;
  beamStart = 0;
  beamEnd = 0;
  beamHitCd = 0;
  beamOn = false;
  beamEndPt: [number, number] = [0, 0];
  dashGo = false;
  supplyT = 10;
  dyingT = 0;
  minionId = 90000;
  crumbledCenter = false;
  /** desabamento anunciado: os tiles piscam por 2 s antes de cair (dá tempo de escapar) */
  pendingCrumble: { kind: 'center' | 'plats'; t: number; tiles: [number, number][] } | null = null;
  burpCd = 2;
  /** mola da barriga */
  jig = 0;
  jigV = 0;
  private lastFlash = 0;
  rage = 0;
  burpPuff = 0;
  crumbledPlats = false;
  transitionTo: 2 | 3 = 2;
  vulnerableMul = 1;
  critFlash = 0;
  faceVis = -1; // virada contínua (1 = direita, -1 = esquerda)
  walkPhase = 0;
  walking = 0;
  prevX = 0;
  prevSin = 0;
  stepCd = 0;

  constructor(spawn: EnemySpawn) {
    super(spawn, { hp: 3600, w: 84, h: 140, score: 5000, wake: 2000, tokens: [0, 0], metal: false });
    this.isBoss = true;
    this.flying = true;
    this.gravity = 0;
    this.floorY = spawn.y;
    this.homeX = spawn.x;
    this.facing = -1;
    this.body.x = spawn.x;
    this.body.y = -400;
    this.hover = 0;
    this.canBeHit = true;
  }

  // ------------------------------------------------------------------ utilidades
  private get bx() {
    return this.body.x;
  }
  private setBody() {
    this.body.y = this.floorY - this.hover - this.body.h / 2;
  }
  private go(s: BState) {
    this.state = s;
    this.st = 0;
  }
  private art() {
    return getArt().felipao;
  }
  private shoulder(which: 'L' | 'R'): [number, number] {
    const a = FELI_LAYOUT;
    const p = which === 'L' ? a.shoulderL : a.shoulderR;
    return [this.bx + this.facing * p[0], this.floorY - this.hover + p[1] - 4];
  }
  private reactorPos(): [number, number] {
    const a = FELI_LAYOUT;
    return [this.bx + this.facing * a.reactorPos[0], this.floorY - this.hover + a.reactorPos[1] - 4];
  }
  private rackPos(): [number, number] {
    const a = FELI_LAYOUT;
    return [this.bx + this.facing * a.rackPos[0], this.floorY - this.hover + a.rackPos[1] - 4];
  }
  private get tempo() {
    return this.phase === 1 ? 1 : this.phase === 2 ? 0.85 : 0.7;
  }
  get invulnerableNow() {
    return this.state === 'enter' || this.state === 'transition' || this.state === 'dying';
  }

  // ------------------------------------------------------------------ dano
  hurt(w: World, dmg: number, info: HurtInfo): number {
    if (!this.alive || this.invulnerableNow) {
      w.fx.sparks(info.x, info.y, 3, '#ffffff', 150);
      w.audio('hitMetal', 0.5, this.x);
      return 0;
    }
    let d = dmg;
    // cabeça: crítico (o rosto do chefe é o ponto fraco)
    const top = this.body.y - this.body.h / 2;
    if (info.y < top + 44 && info.type === 'bullet') {
      d *= 1.6;
      this.critFlash = 0.25;
      w.fx.popup(info.x, info.y - 8, 'CRÍTICO!', '#ff8ab4', 9);
      w.fx.sparks(info.x, info.y, 6, '#ffb0d0', 220);
    }
    if (this.state === 'stun') d *= 1.3;
    this.hp -= d;
    if (this.flashCd <= 0) {
      this.flash = 0.05;
      this.flashCd = 0.16;
    }
    this.awake = true;
    w.audio('bossHit', 0.5, this.x);
    w.fx.sparks(info.x, info.y, 4, '#ffe0a0', 200, -info.dir, 0, 1.6);
    if (info.type !== 'explosion') w.fx.addHitStop(0.008);
    // transições de fase
    const pct = this.hp / this.maxHp;
    if (this.phase === 1 && pct <= 0.66) this.beginTransition(w, 2);
    else if (this.phase === 2 && pct <= 0.33) this.beginTransition(w, 3);
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'dying';
      this.kill(w, info);
    }
    return d;
  }

  private beginTransition(w: World, to: 2 | 3) {
    this.transitionTo = to;
    this.go('transition');
    this.beamOn = false;
    this.dashGo = false;
    this.contactDmg = 0;
    this.thrust = 0;
    this.rackOpen = 0;
    this.charge = 0;
    // limpa projéteis inimigos e minions
    w.bullets = w.bullets.filter((b) => b.team === 0);
    for (const e of w.enemies) if (e.alive && !e.isBoss) e.kill(w);
    w.audio('bossPhase', 1);
    w.fx.addShake(9, 0.9);
    w.fx.addFlash(0.5, '#ffffff');
    w.fx.explosion(this.x + 10, this.y - 40, 30);
    w.fx.debris(this.x, this.y - 40, 16, ['#59628a', '#3a4064', '#ff8a2a'], 380);
    // suprimentos
    w.spawnDrop('health', this.rect.x + this.rect.w / 2 - 40, this.floorY - 90);
    w.spawnDrop('healthBig', this.rect.x + this.rect.w / 2 + 40, this.floorY - 90);
    w.spawnDrop('ammo', this.rect.x + this.rect.w / 2, this.floorY - 100);
    w.spawnDrop('nade', this.rect.x + this.rect.w / 2 + 70, this.floorY - 100);
    w.director.setBossPhase(to);
    this.doBurp(w, true);
    w.hooks.onBanner?.(to === 2 ? 'FÚRIA!' : 'ÚLTIMA CARTADA!', to === 2 ? 'Felipão está mais agressivo' : 'Equipamento danificado — cuidado!', 2.4);
  }

  // ------------------------------------------------------------------ atualização
  update(w: World, dt: number) {
    this.tickCommon(dt);
    const p = w.player;
    const arenaDef = w.data.arenas.find((a) => a.id === 'boss')!;
    this.rect = arenaDef.rect;
    this.st += dt;
    this.swayT += dt;
    if (this.critFlash > 0) this.critFlash -= dt;
    this.kickL = approach(this.kickL, 0, dt * 8);
    this.kickR = approach(this.kickR, 0, dt * 8);
    this.charge = approach(this.charge, this.state === 'cannon' || this.state === 'dash' || this.state === 'pound' ? this.charge : 0, dt * 3);
    this.reactor = damp(this.reactor, this.targetReactor(), 4, dt);
    this.taunt = this.state === 'transition' || this.state === 'summon' || this.state === 'enter' ? Math.min(1, this.taunt + dt * 4) : Math.max(0, this.taunt - dt * 4);
    this.shake = Math.max(0, this.shake - dt * 8);
    this.contactDmg = this.state === 'dash' && this.dashGo ? 24 : this.state === 'pound' && this.poundStage === 2 ? 26 : 10;
    if (this.state === 'stun' || this.state === 'transition' || this.state === 'enter') this.contactDmg = 0;
    this.beamHitCd -= dt;
    this.burpCd -= dt;
    // mola da barriga: passos e tiros fazem quicar
    if (this.flash > 0 && this.lastFlash <= 0) this.jigV += 0.35;
    this.lastFlash = this.flash;
    this.jigV += (-300 * this.jig - 11 * this.jigV) * dt;
    this.jig = clamp(this.jig + this.jigV * dt, -0.09, 0.09);
    this.rage = approach(this.rage, this.phase === 3 && this.state !== 'dying' ? 1 : 0, dt * 1.5);
    if (this.rage > 0.5 && Math.random() < dt * 9) {
      // vapor de raiva saindo da cabeça
      const [hx, hy] = FELI_LAYOUT.head;
      w.fx.add(PK.Smoke, this.bx + this.faceVis * hx + rand.spread(26), this.floorY - this.hover + hy - 10, rand.spread(30), -rand.range(40, 90), rand.range(0.6, 1), 10, '#ffe0e0', { size1: 26, a0: 0.35 });
    }
    if (this.burpPuff > 0) this.burpPuff -= dt;
    this.updateCrumbleWarning(w, dt);
    this.supplyT -= dt;
    if (this.supplyT <= 0 && this.state !== 'enter' && this.state !== 'transition') {
      this.supplyT = 15;
      w.spawnDrop('ammo', this.rect.x + rand.range(200, this.rect.w - 200), this.rect.y + 20);
      if (rand.chance(0.85)) w.spawnDrop('health', this.rect.x + rand.range(200, this.rect.w - 200), this.rect.y + 20);
    }
    // fumaça/faíscas conforme o dano
    if (this.phase >= 2 && this.state !== 'dying' && Math.random() < dt * (this.phase === 3 ? 12 : 5)) {
      const [sx, sy] = this.shoulder('R');
      w.fx.smoke(sx, sy, 1, this.phase === 3 ? '#231d30' : '#4d4560', 9, 36, 0.9);
      if (this.phase === 3 && Math.random() < 0.5) w.fx.sparks(this.x + rand.spread(30), this.y - rand.range(20, 60), 3, '#ffd27a', 180);
    }
    // olha para o jogador (exceto durante alguns estados)
    if (this.state !== 'dash' && this.state !== 'enter' && this.state !== 'dying' && this.state !== 'pound' && Math.abs(p.x - this.bx) > 40) this.facing = p.x >= this.bx ? 1 : -1;
    // virada de lado animada (passa por uma "fatia" fina)
    this.faceVis += clamp(this.facing - this.faceVis, -dt * 8, dt * 8);
    // canhões acompanham o jogador
    const [lx, ly] = this.shoulder('L');
    const [rx, ry] = this.shoulder('R');
    const tL = Math.atan2(p.y - 12 - ly, p.x - lx);
    const tR = Math.atan2(p.y - 12 - ry, p.x - rx);
    this.aimL += clamp(angleDiff(this.aimL, tL), -5 * dt, 5 * dt);
    this.aimR += clamp(angleDiff(this.aimR, tR), -5 * dt, 5 * dt);

    switch (this.state) {
      case 'enter': this.doEnter(w, dt); break;
      case 'idle': this.doIdle(w, dt); break;
      case 'cannon': this.doCannon(w, dt); break;
      case 'missiles': this.doMissiles(w, dt); break;
      case 'summon': this.doSummon(w, dt); break;
      case 'dash': this.doDash(w, dt); break;
      case 'pound': this.doPound(w, dt); break;
      case 'beam': this.doBeam(w, dt); break;
      case 'stun': this.doStun(w, dt); break;
      case 'transition': this.doTransition(w, dt); break;
      default: break;
    }
    this.lean = damp(this.lean, this.targetLean(), 8, dt);
    this.squash = damp(this.squash, this.targetSquash(), 12, dt);
    this.thrust = damp(this.thrust, this.targetThrust(), 10, dt);
    this.rackOpen = damp(this.rackOpen, this.state === 'missiles' ? 1 : 0, 10, dt);
    this.setBody();
    this.stepCycle(w, dt);
    // estabilidade do corpo dentro do palco
    this.body.x = clamp(this.body.x, this.rect.x + 60, this.rect.x + this.rect.w - 60);
    // partículas do propulsor
    if (this.thrust > 0.3 && w.fx.opt() && Math.random() < dt * 40) {
      for (const f of [FELI_LAYOUT.footL, FELI_LAYOUT.footR]) {
        w.fx.add(PK.Fire, this.bx + this.facing * f[0], this.floorY - this.hover + 6, rand.spread(20), 80, 0.25, 8, '#ffb347', { size1: 2 });
      }
    }
  }

  /** Ciclo de caminhada: pernas alternadas e cada passo faz o chão (e a tela) tremer. */
  private stepCycle(w: World, dt: number) {
    const spd = Math.abs(this.bx - this.prevX) / Math.max(dt, 1e-4);
    this.prevX = this.bx;
    const grounded = this.hover < 4 && this.state !== 'enter' && this.state !== 'transition';
    this.walking += ((grounded ? Math.min(1, spd / 55) : 0) - this.walking) * Math.min(1, dt * 10);
    this.walkPhase += Math.min(spd, 320) * dt * 0.052;
    this.stepCd -= dt;
    const sn = Math.sin(this.walkPhase);
    if (sn * this.prevSin < 0 && this.walking > 0.3 && grounded && this.stepCd <= 0) {
      this.stepCd = 0.16;
      w.fx.addShake(this.state === 'dash' ? 3.4 : 2.6, 0.17);
      this.jigV += this.state === 'dash' ? 1.1 : 0.8;
      w.audio('stomp', this.state === 'dash' ? 0.5 : 0.7, this.bx);
      if (this.burpCd <= 0 && rand.chance(this.state === 'dash' ? 0.2 : 0.5)) this.doBurp(w, false);
      const fx = this.bx + (sn > 0 ? -1 : 1) * 34 * this.faceVis;
      for (let i = 0; i < 5; i++) w.fx.add(PK.Dust, fx + rand.spread(14), this.floorY - 2, rand.spread(70), -rand.range(6, 26), 0.5, 8, '#b9b0c8', { size1: 3, a0: 0.6 });
      if (w.fx.opt()) w.fx.add(PK.Ring, fx, this.floorY - 3, 0, 0, 0.25, 6, '#e8e0ff', { size1: 26, a0: 0.4, front: true });
    }
    this.prevSin = sn;
  }

  private targetReactor() {
    switch (this.state) {
      case 'beam': return 1;
      case 'cannon': case 'missiles': return 0.55;
      case 'stun': return 0.05;
      case 'transition': return 1;
      default: return 0.25 + (this.phase - 1) * 0.1;
    }
  }
  private targetLean() {
    if (this.state === 'dash') return this.dashGo ? 0.16 * this.dir * this.facing * 1 : -0.1 * this.dir * this.facing * -1;
    if (this.state === 'cannon' && this.charge > 0.5) return -0.03;
    if (this.state === 'stun') return -0.08;
    return Math.sin(this.swayT * 1.7) * 0.012;
  }
  private targetSquash() {
    if (this.state === 'pound' && this.poundStage === 0) return 0.95;
    if (this.state === 'stun') return 0.97;
    if (this.state === 'dash' && !this.dashGo) return 0.93;
    return 1;
  }
  private targetThrust() {
    if (this.state === 'dash') return this.dashGo ? 1 : 0.5 + this.st * 0.3;
    if (this.state === 'pound') return this.poundStage === 3 ? 0 : 0.9;
    if (this.state === 'enter') return 1;
    if (this.state === 'stun') return 0;
    return 0.12;
  }

  // ------------------------------------------------------------------ estados
  private doEnter(w: World, dt: number) {
    // cai do céu e pousa com estrondo
    this.hoverVy += 1600 * dt;
    if (this.st === dt) this.hover = 520;
    this.hover = Math.max(0, this.hover - Math.max(60, this.hoverVy) * dt * 0.9);
    this.shake = 2;
    if (this.hover <= 0 && this.st > 0.3) {
      this.hover = 0;
      this.hoverVy = 0;
      w.fx.addShake(12, 0.6);
      this.jigV += 2.4;
      w.audio('slam', 1);
      w.fx.addFlash(0.25, '#ffffff');
      for (let i = 0; i < 16; i++) w.fx.add(PK.Dust, this.bx + rand.spread(90), this.floorY - 2, rand.spread(240), -rand.range(10, 50), 0.7, 12, '#b9b0c8', { size1: 4, a0: 0.8 });
      w.fx.add(PK.Ring, this.bx, this.floorY - 4, 0, 0, 0.5, 10, '#ffffff', { size1: 120, a0: 0.9, front: true });
      this.go('idle');
      this.restT = 1.6;
      w.after(0.5, () => this.doBurp(w, true));
    }
  }

  private doIdle(w: World, dt: number) {
    const p = w.player;
    // paira mantendo distância de combate do jogador (sempre visível na câmera)
    const side = this.bx >= p.x ? 1 : -1;
    const keep = clamp(w.camera.w * 0.5 - 40, 250, 430);
    let tx = p.x + side * (keep + Math.sin(this.swayT * 0.7) * 60);
    tx = clamp(tx, this.rect.x + 150, this.rect.x + this.rect.w - 150);
    this.body.vx = approach(this.body.vx, clamp((tx - this.bx) * 1.2, -115, 115) * (this.phase === 3 ? 1.3 : 1), 380 * dt);
    this.body.x += this.body.vx * dt;
    this.hover = approach(this.hover, 0, 40 * dt);
    this.restT -= dt;
    if (this.restT <= 0 && p.targetable) this.pickAttack(w);
  }

  private pickAttack(w: World) {
    const opts: string[] = ['cannon', 'missiles'];
    if (this.phase === 1) opts.push('summon', 'cannon');
    if (this.phase >= 2) opts.push('dash', 'pound', 'cannon');
    if (this.phase === 3) opts.push('beam', 'pound', 'missiles');
    let pick = rand.pick(opts);
    if (pick === this.lastAtk) pick = rand.pick(opts);
    if (pick === 'summon' && w.enemies.filter((e) => e.alive && !e.isBoss).length >= 3) pick = 'cannon';
    this.lastAtk = pick;
    this.atkCount++;
    switch (pick) {
      case 'cannon': this.go('cannon'); this.shots = 0; this.shotGap = 0; this.charge = 0; break;
      case 'missiles': this.go('missiles'); this.missilesLeft = 0; this.missileGap = 0; break;
      case 'summon': this.go('summon'); break;
      case 'dash': this.go('dash'); this.dashGo = false; this.dir = w.player.x >= this.bx ? 1 : -1; break;
      case 'pound': this.go('pound'); this.poundStage = 0; this.poundsLeft = this.phase === 3 ? 2 : 1; this.targetX = w.player.x; break;
      case 'beam': this.go('beam'); this.beamOn = false; break;
    }
    this.restT = (this.phase === 1 ? 1.5 : this.phase === 2 ? 1.1 : 0.85);
  }

  private doCannon(w: World, dt: number) {
    const tele = 0.85 * this.tempo;
    this.hover = approach(this.hover, 0, 40 * dt);
    if (this.st < tele) {
      this.charge = clamp(this.st / tele, 0, 1);
      return;
    }
    this.charge = 0.7;
    const total = this.phase === 1 ? 8 : this.phase === 2 ? 10 : 14;
    this.shotGap -= dt;
    if (this.shots < total && this.shotGap <= 0) {
      const side = this.shotSide++ % 2 === 0 ? 'L' : 'R';
      const [sx, sy] = this.shoulder(side);
      const aim = side === 'L' ? this.aimL : this.aimR;
      const a = aim + rand.spread(0.03);
      const mx = sx + Math.cos(aim) * 34;
      const my = sy + Math.sin(aim) * 34;
      this.fireBullet(w, mx, my, a, 400, 8, 'bossShell');
      this.muzzleFlash(w, mx, my, a, 1.8);
      if (side === 'L') this.kickL = 1;
      else this.kickR = 1;
      w.audio('turretShot', 0.9, this.x);
      w.fx.addShake(1.4, 0.08);
      this.shots++;
      this.shotGap = 0.13 * this.tempo + 0.03;
    }
    if (this.shots >= total && this.shotGap <= -0.2) {
      this.charge = 0;
      this.go('idle');
    }
  }

  private doMissiles(w: World, dt: number) {
    this.hover = approach(this.hover, 0, 40 * dt);
    const tele = 0.75 * this.tempo;
    if (this.st < tele) return;
    const total = this.phase === 1 ? 4 : this.phase === 2 ? 5 : 7;
    this.missileGap -= dt;
    if (this.missilesLeft < total && this.missileGap <= 0) {
      const [rx, ry] = this.rackPos();
      const i = this.missilesLeft;
      const spreadA = -Math.PI / 2 + (i - (total - 1) / 2) * 0.32 + rand.spread(0.08);
      this.fireBullet(w, rx + (i - total / 2) * 8, ry - 6, spreadA, 250, 20, 'missile', { homing: 1.3 + this.phase * 0.2, turnDelay: 0.45, life: 4.2, explode: { radius: 58, dmg: 21 } });
      w.audio('missile', 0.7, this.x);
      w.fx.smoke(rx, ry - 8, 2, '#8b8499', 8, 30, 0.6);
      this.missilesLeft++;
      this.missileGap = 0.17 * this.tempo;
    }
    if (this.missilesLeft >= total && this.missileGap <= -0.5) this.go('idle');
  }

  private doSummon(w: World, dt: number) {
    this.hover = approach(this.hover, 0, 40 * dt);
    if (this.st > 0.9 && !this.summoned) {
      this.summoned = true;
      const r = this.rect;
      const list: { type: 'rifle' | 'drone' | 'shotgun'; x: number; y: number }[] = [
        { type: 'rifle', x: r.x + 90, y: this.floorY },
        { type: rand.chance(0.5) ? 'drone' : 'shotgun', x: r.x + r.w - 90, y: this.floorY },
      ];
      for (const s of list) {
        if (w.enemies.filter((e) => e.alive && !e.isBoss).length >= 3) break;
        const y = s.type === 'drone' ? this.floorY - 120 : this.rect.y + 10;
        const e = w.spawnEnemy({ id: this.minionId++, type: s.type, x: s.x, y, arena: 'boss', drop: s.type !== 'drone' });
        if (s.type !== 'drone') e.body.vy = 200;
        w.fx.add(PK.Ring, s.x, y, 0, 0, 0.4, 6, '#ff8ad4', { size1: 40, a0: 0.8, front: true });
      }
      w.audio('alarm', 0.6);
    }
    if (this.st > 1.8) {
      this.summoned = false;
      this.go('idle');
    }
  }
  summoned = false;

  private doDash(w: World, dt: number) {
    const tele = 0.95 * this.tempo;
    const speed = this.phase === 3 ? 760 : 640;
    if (!this.dashGo) {
      this.hover = 0;
      this.charge = clamp(this.st / tele, 0, 1);
      this.shake = 1.4;
      this.facing = this.dir;
      if (this.st > tele) {
        this.dashGo = true;
        this.st = 0;
        this.body.vx = this.dir * speed;
        w.audio('dash2', 1, this.x);
        w.fx.addShake(6, 0.3);
      }
      return;
    }
    this.charge = 0;
    this.body.x += this.dir * speed * dt;
    this.hover = 0;
    this.facing = this.dir;
    w.fx.add(PK.Dust, this.bx - this.dir * 40, this.floorY - 2, -this.dir * 40, -12, 0.5, 10, '#b9b0c8', { size1: 3, a0: 0.7 });
    if (Math.random() < 0.6) w.fx.add(PK.Spark, this.bx - this.dir * 34, this.floorY - 2, -this.dir * rand.range(100, 260), -rand.range(30, 150), 0.3, 8, '#ffd27a', { size1: 1.4, g: 500, front: true });
    const edge = this.dir === 1 ? this.rect.x + this.rect.w - 70 : this.rect.x + 70;
    if ((this.dir === 1 && this.bx >= edge) || (this.dir === -1 && this.bx <= edge) || this.st > 1.6) {
      this.dashGo = false;
      w.fx.addShake(10, 0.5);
      w.audio('slam', 1, this.x);
      w.fx.addHitStop(0.06);
      // destroços caem do teto
      const n = this.phase === 3 ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const x = this.rect.x + rand.range(90, this.rect.w - 90);
        w.after(i * 0.16, () => {
          w.spawnEnemyBullet(x, this.rect.y - 10, Math.PI / 2, 60, 12, 'bossShell', { gravity: 700, life: 3, r: 7, color: '#d9d4ef', trail: '#8a7fb0' });
          w.fx.add(PK.Dust, x, this.rect.y + 6, 0, 30, 0.5, 8, '#b9b0c8', { size1: 3, a0: 0.6 });
        });
      }
      for (let i = 0; i < 12; i++) w.fx.add(PK.Dust, this.bx + this.dir * 40, this.floorY - 4, rand.spread(160), -rand.range(10, 80), 0.7, 11, '#b9b0c8', { size1: 4, a0: 0.8 });
      this.go('stun');
    }
  }

  private doStun(w: World, dt: number) {
    this.hover = approach(this.hover, 0, 60 * dt);
    this.body.x += this.body.vx * dt;
    this.body.vx = approach(this.body.vx, 0, 600 * dt);
    if (Math.random() < dt * 18) w.fx.sparks(this.bx + rand.spread(30), this.y - rand.range(0, 50), 2, '#ffd27a', 160);
    if (Math.random() < dt * 8) w.fx.smoke(this.bx + rand.spread(30), this.y - 20, 1, '#4d4560', 9, 34, 0.8);
    if (this.st > (this.phase === 3 ? 1.1 : 1.5)) this.go('idle');
  }

  private doPound(w: World, dt: number) {
    const p = w.player;
    switch (this.poundStage) {
      case 0: {
        // sobe e persegue o X do jogador
        const rise = 0.75 * this.tempo;
        this.hover = 6 + 130 * clamp(this.st / rise, 0, 1) * (2 - clamp(this.st / rise, 0, 1));
        this.targetX = damp(this.targetX, p.x, 5, dt);
        this.body.x += clamp((this.targetX - this.bx) * 4, -320, 320) * dt;
        this.charge = 0.5;
        if (this.st > rise) {
          this.poundStage = 1;
          this.st = 0;
          this.lockX = this.bx;
        }
        break;
      }
      case 1: {
        // paira parado sobre o alvo (telegrafo: sombra/aviso no chão)
        this.hover = 136 + Math.sin(this.st * 20) * 2;
        this.shake = 1.6;
        if (this.st > 0.5 * this.tempo) {
          this.poundStage = 2;
          this.st = 0;
          this.hoverVy = 0;
        }
        break;
      }
      case 2: {
        // mergulho
        this.hoverVy += 3800 * dt;
        this.hover -= this.hoverVy * dt;
        if (this.hover <= 0) {
          this.hover = 0;
          this.impact(w);
          this.poundStage = 3;
          this.st = 0;
        }
        break;
      }
      case 3: {
        this.hover = 0;
        if (this.st > 0.55) {
          this.poundsLeft--;
          if (this.poundsLeft > 0) {
            this.poundStage = 0;
            this.st = 0;
            this.targetX = p.x;
          } else this.go(this.phase >= 2 ? 'stun' : 'idle');
        }
        break;
      }
    }
  }
  lockX = 0;

  private impact(w: World) {
    this.jigV += 2.2;
    w.audio('slam', 1);
    w.fx.addShake(13, 0.6);
    w.fx.addHitStop(0.07);
    w.fx.addFlash(0.2, '#ffffff');
    for (const dir of [-1, 1]) {
      this.fireBullet(w, this.bx + dir * 30, this.floorY - 8, dir === 1 ? 0 : Math.PI, 300, 20, 'enemy', { life: 2.2, r: 6, color: '#ffe0b0', trail: '#ff8a2a' });
    }
    for (let i = 0; i < 18; i++) w.fx.add(PK.Dust, this.bx + rand.spread(80), this.floorY - 2, rand.spread(260), -rand.range(10, 60), 0.8, 12, '#b9b0c8', { size1: 4, a0: 0.8 });
    w.fx.add(PK.Ring, this.bx, this.floorY - 4, 0, 0, 0.45, 12, '#ffd9a0', { size1: 100, a0: 0.9, front: true });
    w.fx.debris(this.bx, this.floorY - 6, 14, ['#5a5674', '#7d7896', '#3d3a55'], 340);
    // dano de pisão direto embaixo
    const p = w.player;
    if (p.targetable && Math.abs(p.x - this.bx) < 56 && p.feetY > this.floorY - 30) p.hit(w, 24, Math.sign(p.x - this.bx) || 1, { kx: 260, ky: -340 });
    // destruição parcial do palco
    if (!this.pendingCrumble) {
      if (this.phase >= 2 && !this.crumbledCenter) {
        this.crumbledCenter = true;
        this.warnCrumble(w, 'center');
      } else if (this.phase === 3 && !this.crumbledPlats) {
        this.crumbledPlats = true;
        this.warnCrumble(w, 'plats');
      }
    }
  }

  /** Arroto de monstro (com baforada visível saindo da boca). */
  private doBurp(w: World, big: boolean) {
    this.burpCd = big ? 3 : rand.range(2.2, 4.2);
    this.burpPuff = big ? 1.1 : 0.6;
    w.audio(big ? 'burpBig' : 'burp', big ? 1.1 : 0.95, this.bx);
    const [hx, hy] = FELI_LAYOUT.head;
    const mx = this.bx + this.faceVis * (hx + 18);
    const my = this.floorY - this.hover + hy + 40;
    for (let i = 0; i < (big ? 9 : 5); i++) {
      w.fx.add(PK.Smoke, mx, my, this.facing * rand.range(40, 110), -rand.range(10, 50), rand.range(0.7, 1.3), rand.range(8, 14), '#b8d890', { size1: 28, a0: 0.45 });
    }
    if (big) w.fx.addShake(3, 0.4);
  }

  /** Coleta os tiles que vão cair. */
  private crumbleTiles(kind: 'center' | 'plats'): [number, number][] {
    const cc = Math.round((this.rect.x + this.rect.w / 2) / TILE);
    const out: [number, number][] = [];
    const L = this.levelRef!;
    if (kind === 'center') {
      const row = Math.round(this.floorY / TILE);
      for (let c = cc - 3; c <= cc + 3; c++) for (let r = row; r < row + 3; r++) if (L.get(c, r) === T.SOLID) out.push([c, r]);
    } else {
      const row = Math.round(this.floorY / TILE) - 5;
      for (const side of [-1, 1]) {
        for (let c = cc + side * 8 - 2; c <= cc + side * 8 + 1; c++) {
          for (let r = row - 1; r <= row + 1; r++) if (L.get(c, r) === T.ONEWAY || L.get(c, r) === T.SOLID) out.push([c, r]);
        }
      }
    }
    return out;
  }
  levelRef: World['level'] | null = null;

  private warnCrumble(w: World, kind: 'center' | 'plats') {
    this.levelRef = w.level;
    this.pendingCrumble = { kind, t: CRUMBLE_WARN, tiles: this.crumbleTiles(kind) };
    w.hooks.onBanner?.('CUIDADO!', kind === 'center' ? 'O chão vai desabar — saia do meio!' : 'As plataformas vão cair!', 1.8);
    w.audio('warning', 1);
    w.audio('burpBig', 0.9, this.bx);
  }

  private updateCrumbleWarning(w: World, dt: number) {
    const pc = this.pendingCrumble;
    if (!pc) return;
    if (this.state === 'dying') {
      this.pendingCrumble = null;
      return;
    }
    const before = pc.t;
    pc.t -= dt;
    // bipes cada vez mais rápidos + rachaduras soltando poeira
    const step = pc.t > 1 ? 0.5 : 0.25;
    if (Math.floor(before / step) !== Math.floor(pc.t / step)) w.audio('warning', 0.45);
    if (Math.random() < dt * 18 && pc.tiles.length) {
      const [c, r] = pc.tiles[Math.floor(Math.random() * pc.tiles.length)];
      w.fx.add(PK.Dust, c * TILE + Math.random() * TILE, r * TILE, rand.spread(20), -rand.range(10, 40), 0.6, 6, '#c9b8a0', { size1: 3, a0: 0.7 });
    }
    w.fx.addShake(0.8 + (1 - pc.t / CRUMBLE_WARN) * 1.6, 0.05);
    if (pc.t <= 0) {
      this.pendingCrumble = null;
      if (pc.kind === 'center') this.crumble(w, -3, 3);
      else this.crumblePlatforms(w);
    }
  }

  /** Destrói o "miolo" do piso do palco (buraco central). */
  private crumble(w: World, c0: number, c1: number) {
    const cc = Math.round((this.rect.x + this.rect.w / 2) / TILE);
    const row = Math.round(this.floorY / TILE);
    const L = w.level;
    w.hooks.onBanner?.('O CHÃO DESABA!', undefined, 1.6);
    w.audio('bigExplosion', 0.9);
    for (let c = cc + c0; c <= cc + c1; c++) {
      for (let r = row; r < row + 3; r++) {
        if (L.get(c, r) === T.SOLID) {
          L.set(c, r, T.EMPTY, 0);
          w.fx.debris(c * TILE + 16, r * TILE + 16, 3, ['#5a5674', '#7d7896', '#3d3a55'], 220);
          w.fx.smoke(c * TILE + 16, r * TILE + 16, 1, '#6b6480', 12, 20, 1);
        }
      }
    }
    w.fx.addShake(9, 0.6);
    w.lastCrumbleTime = w.time;
  }
  private crumblePlatforms(w: World) {
    const cc = Math.round((this.rect.x + this.rect.w / 2) / TILE);
    const row = Math.round(this.floorY / TILE) - 5;
    const L = w.level;
    for (const side of [-1, 1]) {
      for (let c = cc + side * 8 - 2; c <= cc + side * 8 + 1; c++) {
        for (let r = row - 1; r <= row + 1; r++) {
          if (L.get(c, r) === T.ONEWAY || L.get(c, r) === T.SOLID) {
            L.set(c, r, T.EMPTY, 0);
            w.fx.debris(c * TILE + 16, r * TILE + 16, 2, ['#5a5674', '#7d7896'], 200);
          }
        }
      }
    }
    w.audio('explosion', 0.9);
    w.fx.addShake(6, 0.4);
  }

  private doBeam(w: World, dt: number) {
    const p = w.player;
    const tele = 1.5;
    const sweep = 1.75;
    const [rx, ry] = this.reactorPos();
    this.hover = approach(this.hover, 0, 40 * dt);
    if (this.st === dt) {
      w.audio('laserCharge', 1);
      // varredura: começa apontando para o chão à frente e sobe até quase horizontal
      const toward = p.x >= this.bx ? 0 : Math.PI;
      const dirSign = toward === 0 ? 1 : -1;
      const floorAngle = Math.atan2(this.floorY - ry, 300 * dirSign);
      this.beamStart = floorAngle;
      this.beamEnd = toward === 0 ? -0.22 : Math.PI + 0.22;
      // ajusta para a direção correta (para a esquerda o ângulo fica entre π/2 e π)
      if (toward === Math.PI) this.beamStart = Math.atan2(this.floorY - ry, -300);
      this.beamAng = this.beamStart;
    }
    if (this.st < tele) {
      this.charge = clamp(this.st / tele, 0, 1);
      this.beamOn = false;
      this.shake = 1 + this.charge * 1.5;
      return;
    }
    if (!this.beamOn) {
      this.beamOn = true;
      w.audio('laserFire', 1);
      w.fx.addShake(5, 0.3);
    }
    const t = clamp((this.st - tele) / sweep, 0, 1);
    this.beamAng = this.beamStart + (this.beamEnd - this.beamStart) * (t * t * (3 - 2 * t));
    // ponto final do feixe (até o cenário)
    const len = 1100;
    const ex = rx + Math.cos(this.beamAng) * len;
    const ey = ry + Math.sin(this.beamAng) * len;
    const hit = w.level.rayHit(rx, ry, ex, ey);
    const tt = hit >= 0 ? hit : 1;
    this.beamEndPt = [rx + (ex - rx) * tt, ry + (ey - ry) * tt];
    if (Math.random() < 0.8) w.fx.add(PK.Spark, this.beamEndPt[0], this.beamEndPt[1], rand.spread(200), -rand.range(60, 240), 0.3, 8, '#ffe0a0', { size1: 1.4, g: 600, front: true });
    if (Math.random() < 0.4) w.fx.add(PK.Fire, this.beamEndPt[0], this.beamEndPt[1], 0, 0, 0.2, 14, '#ffb347', { size1: 3, front: true });
    // dano ao jogador
    if (p.targetable && this.beamHitCd <= 0) {
      const px = p.x - rx;
      const py = p.y - 4 - ry;
      const dx = Math.cos(this.beamAng);
      const dy = Math.sin(this.beamAng);
      const along = px * dx + py * dy;
      const perp = Math.abs(px * dy - py * dx);
      const segLen = Math.hypot(this.beamEndPt[0] - rx, this.beamEndPt[1] - ry);
      if (along > 0 && along < segLen && perp < 15 + p.body.h * 0.2) {
        this.beamHitCd = 0.25;
        p.hit(w, 20, Math.sign(px) || 1, { kx: 160, ky: -260 });
      }
    }
    if (this.st > tele + sweep) {
      this.beamOn = false;
      this.charge = 0;
      this.go('stun');
    }
  }

  private doTransition(w: World, dt: number) {
    this.hover = approach(this.hover, 30, 60 * dt);
    this.shake = 2.5;
    this.charge = 0;
    if (Math.random() < dt * 14) w.fx.sparks(this.bx + rand.spread(40), this.y - rand.range(-10, 60), 3, '#ffd27a', 220);
    if (Math.random() < dt * 6) w.fx.explosion(this.bx + rand.spread(40), this.y - rand.range(-10, 60), 10);
    if (this.st > 1.1 && !this.roared) {
      this.roared = true;
      w.audio('bossRoar', 1);
      w.fx.addShake(6, 0.6);
    }
    if (this.st > 2.5) {
      this.roared = false;
      this.phase = this.transitionTo;
      this.hp = Math.min(this.hp, this.maxHp * (this.phase === 2 ? 0.66 : 0.33));
      this.hover = 0;
      this.go('idle');
      this.restT = 1.0;
    }
  }
  roared = false;

  // ------------------------------------------------------------------ morte
  protected onDeath(w: World) {
    void w;
  }

  // ------------------------------------------------------------------ desenho
  draw(g: CanvasRenderingContext2D, w: World) {
    const a = this.art();
    const feet = this.floorY;
    // telegrafos no chão
    if (this.alive) this.drawTelegraphs(g, w);
    const dying = this.dyingT > 0;
    drawFelipao(g, a, this.bx, feet, {
      facing: this.facing,
      t: this.t,
      flash: this.flash > 0 || (this.critFlash > 0.1 && Math.floor(this.t * 30) % 2 === 0),
      alpha: 1,
      lean: this.lean,
      squashY: this.squash,
      aimL: this.aimL,
      aimR: this.aimR,
      charge: this.charge,
      reactor: this.reactor,
      phase: this.phase,
      thrust: this.thrust,
      rackOpen: this.rackOpen,
      hover: this.hover,
      taunt: this.taunt,
      shake: this.shake + (dying ? 3 : 0),
      hp01: this.hp / this.maxHp,
      kickL: this.kickL,
      kickR: this.kickR,
      faceX: this.faceVis,
      walk: this.walkPhase,
      walking: this.walking,
      jiggle: this.jig,
      burp: this.burpPuff > 0 ? Math.sin(Math.min(1, this.burpPuff / 0.6) * Math.PI) : 0,
      rage: this.rage,
    });
    if (this.beamOn && this.alive) this.drawBeam(g);
  }

  private drawTelegraphs(g: CanvasRenderingContext2D, w: World) {
    void w;
    const pc = this.pendingCrumble;
    if (pc) {
      // tiles piscando (mais rápido perto do fim) com rachaduras
      const k = 1 - pc.t / CRUMBLE_WARN;
      const hz = 4 + k * 10;
      const on = Math.sin(this.t * hz * Math.PI * 2) > -0.2;
      g.save();
      for (const [c, r] of pc.tiles) {
        const x = c * TILE;
        const y = r * TILE;
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = on ? `rgba(255,${Math.round(90 - k * 60)},40,${0.35 + k * 0.35})` : 'rgba(255,200,60,0.08)';
        g.fillRect(x, y, TILE, TILE);
        g.globalCompositeOperation = 'source-over';
        g.strokeStyle = 'rgba(20,6,10,0.8)';
        g.lineWidth = 1.6;
        const s = (c * 7 + r * 13) % 5;
        g.beginPath();
        g.moveTo(x + 4 + s, y + 2);
        g.lineTo(x + 14, y + 12 + s);
        g.lineTo(x + 10 + s, y + 22);
        g.lineTo(x + 22, y + TILE - 2);
        g.moveTo(x + 14, y + 12 + s);
        g.lineTo(x + TILE - 3, y + 8);
        g.stroke();
      }
      // seta de aviso acima da área
      const xs = pc.tiles.map((t) => t[0]);
      const rs = pc.tiles.map((t) => t[1]);
      if (xs.length) {
        const cx = ((Math.min(...xs) + Math.max(...xs) + 1) / 2) * TILE;
        const top = Math.min(...rs) * TILE;
        g.fillStyle = on ? '#ff4a3a' : '#ffd23a';
        g.font = '400 22px "Lilita One", Impact, sans-serif';
        g.textAlign = 'center';
        g.fillText('⚠', cx, top - 12 - Math.sin(this.t * 10) * 3);
        g.font = '400 13px "Lilita One", Impact, sans-serif';
        g.fillText(String(Math.max(0, pc.t).toFixed(1)), cx, top - 36);
      }
      g.restore();
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 24);
    if (this.state === 'dash' && !this.dashGo) {
      const x0 = this.bx;
      const x1 = this.dir === 1 ? this.rect.x + this.rect.w - 30 : this.rect.x + 30;
      const y = this.floorY - 22;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const t = clamp(this.st / 0.95, 0, 1);
      const grd = g.createLinearGradient(x0, 0, x1, 0);
      grd.addColorStop(0, `rgba(255,70,50,${0.15 + 0.4 * t})`);
      grd.addColorStop(1, 'rgba(255,70,50,0.05)');
      g.fillStyle = grd;
      g.fillRect(Math.min(x0, x1), y, Math.abs(x1 - x0), 22);
      g.strokeStyle = `rgba(255,200,180,${0.3 + 0.5 * pulse})`;
      g.lineWidth = 1.5;
      g.strokeRect(Math.min(x0, x1), y, Math.abs(x1 - x0), 22);
      g.restore();
    }
    if (this.state === 'pound' && (this.poundStage === 0 || this.poundStage === 1)) {
      const x = this.poundStage === 1 ? this.lockX : this.bx;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const t = this.poundStage === 1 ? 0.5 + this.st : 0.25;
      g.strokeStyle = `rgba(255,90,60,${0.35 + 0.5 * pulse * (this.poundStage === 1 ? 1 : 0.4)})`;
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(x, this.floorY - 3, 58, 8, 0, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = `rgba(255,70,50,${0.12 + 0.2 * Math.min(1, t)})`;
      g.fill();
      g.restore();
    }
    if (this.state === 'beam' && !this.beamOn && this.charge > 0) {
      const [rx, ry] = this.reactorPos();
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(255,120,90,${0.15 + 0.5 * this.charge * pulse})`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(rx, ry);
      g.lineTo(rx + Math.cos(this.beamStart) * 500, ry + Math.sin(this.beamStart) * 500);
      g.stroke();
      g.restore();
    }
  }

  private drawBeam(g: CanvasRenderingContext2D) {
    const [rx, ry] = this.reactorPos();
    const [ex, ey] = this.beamEndPt;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    const flick = 0.85 + Math.random() * 0.3;
    g.strokeStyle = 'rgba(255,90,40,0.35)';
    g.lineWidth = 22 * flick;
    g.beginPath();
    g.moveTo(rx, ry);
    g.lineTo(ex, ey);
    g.stroke();
    g.strokeStyle = 'rgba(255,180,90,0.7)';
    g.lineWidth = 11 * flick;
    g.stroke();
    g.strokeStyle = '#fff6dc';
    g.lineWidth = 4.4 * flick;
    g.stroke();
    g.restore();
  }
}
