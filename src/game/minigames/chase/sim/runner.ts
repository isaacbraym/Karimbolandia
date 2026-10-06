/**
 * O Karimbo correndo pela copa (sem arma): usa as MESMAS constantes de movimento do jogo base
 * (`movement.ts`) com colisão local de superfície curva. Corre sozinho para a frente, começando
 * 22% mais rápido (`CHASE_RUN`) e acelerando por `chasePace`. Controles: ←/stick esquerda = frear, ↓ = deslizar (corrida), pulo (altura variável,
 * coyote e buffer iguais ao jogo base), segurar o pulo no ar = planar com as orelhas, cipó = agarra ao
 * encostar, balança e solta com o pulo. Simulação pura.
 */
import { newBody, type Body } from '../../../physics';
import {
  AIR_ACC, AIR_DEC, COYOTE, CROUCH_H, FALL_MAX, FOOT_H, FOOT_W, GLIDE_FALL, GLIDE_FUEL, GLIDE_SPEED, GRAV, JUMP_BUF, JUMP_V,
  RUN, RUN_ACC, RUN_DEC,
} from '../../../movement';
import { approach } from '../../../../core/math';
import type { Course, VineDef } from './course';

/** o Karimbo na perseguição é 22% mais rápido que no jogo base */
export const CHASE_RUN = RUN * 1.22;
/** Aquecimento de 8 s, depois acelera gradualmente até +32% aos 48 s. */
export const chasePace = (t: number) => 1 + Math.min(1, Math.max(0, (t - 8) / 40)) * .32;
export const SLIDE_TIME = 0.45;
export const BRAKE = 0.35;
export const PERFECT_BOOST = 1.15;
export const PERFECT_TIME = 1.5;
/** mola da bromélia: vezes a velocidade do pulo */
export const SPRING_BOOST = 1.32;

export interface RunInput { moveX: number; down: boolean; jump: { held: boolean; pressed: boolean } }
export type RunState = 'run' | 'air' | 'glide' | 'slide' | 'stumble' | 'slip' | 'fallen' | 'vine';

export interface VineHold { def: VineDef; ang: number; av: number; t: number }

export class Runner {
  body: Body = newBody(FOOT_W, FOOT_H);
  facing = 1;
  state: RunState = 'run';
  coyote = 0;
  jumpBuf = 0;
  jumping = false;
  glideFuel = GLIDE_FUEL;
  glideT = 0;
  slideT = 0;
  stumbleT = 0;
  slipT = 0;
  /** invulnerável a obstáculos (depois de tropeçar ou reaparecer) */
  invuln = 0;
  boostT = 0;
  agitatedT = 0;
  fallT = 0;
  /** subindo pela mola: o pulo não encurta soltando o botão */
  springUp = false;
  vine: VineHold | null = null;
  private vineCd = 0;
  /** último galho firme pisado (ponto seguro para reaparecer) */
  lastSafe = { x: 0, y: 0 };
  /** quantos quadros no chão (para o "pousou" da arte) */
  landed = 0;
  wasGround = false;
  /** de onde veio a última aterrissagem boa (tile) — para o pouso perfeito */
  airStartX = 0;
  elapsed = 0;

  constructor(x: number, feetY: number) { this.place(x, feetY); }

  get x() { return this.body.x; }
  get y() { return this.body.y; }
  get feetY() { return this.body.y + this.body.h / 2; }

  place(x: number, feetY: number) {
    this.setHeight(FOOT_H);
    this.body.x = x;
    this.body.y = feetY - this.body.h / 2;
    this.body.vx = this.body.vy = 0;
    this.state = 'run';
    this.slideT = this.stumbleT = this.slipT = this.fallT = 0;
    this.vine = null;
    this.lastSafe = { x, y: feetY };
  }

  private setHeight(h: number) {
    const feet = this.body.y + this.body.h / 2;
    this.body.h = h;
    this.body.y = feet - h / 2;
  }

  /** Reaparece no último ponto seguro (um pouco para trás, com folga de invulnerabilidade). */
  respawn(course: Course) {
    const x = this.lastSafe.x - 64;
    const surface = course.surfaceY(x);
    this.place(surface === null ? this.lastSafe.x : x, surface ?? this.lastSafe.y);
    this.invuln = 1.2;
  }

  private maxSpeed() {
    return CHASE_RUN * chasePace(this.elapsed) * (this.boostT > 0 ? PERFECT_BOOST : 1) * (this.agitatedT > 0 ? 0.72 : 1);
  }

  /** Um quadro. Devolve eventos de "chegou/pulou/pousou" para a arte e o som. */
  step(dt: number, inp: RunInput, course: Course, ev: RunnerEvents) {
    const b = this.body;
    this.elapsed += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.boostT > 0) this.boostT -= dt;
    if (this.agitatedT > 0) this.agitatedT -= dt;
    if (this.vineCd > 0) this.vineCd -= dt;
    if (this.fallT > 0) {
      this.fallT -= dt;
      if (this.fallT <= 0) { this.respawn(course); ev.respawn(); }
      return;
    }
    if (this.vine) { this.stepVine(dt, inp, ev); return; }
    const grounded = b.onGround;
    // ---- tempos de pulo
    if (grounded) { this.coyote = COYOTE; this.glideFuel = GLIDE_FUEL; this.glideT = 0; } else this.coyote -= dt;
    if (inp.jump.pressed) this.jumpBuf = JUMP_BUF; else this.jumpBuf -= dt;
    if (this.stumbleT > 0) { this.stumbleT -= dt; if (this.stumbleT <= 0 && this.state === 'stumble') this.state = 'run'; }
    if (this.slipT > 0) { this.slipT -= dt; if (this.slipT <= 0 && this.state === 'slip') this.state = 'run'; }
    const control = this.stumbleT <= 0 && this.slipT <= 0;
    // ---- deslizar (↓ correndo no chão)
    if (control && grounded && inp.down && this.slideT <= 0 && this.state !== 'slide') {
      this.slideT = SLIDE_TIME;
      this.state = 'slide';
      this.setHeight(CROUCH_H);
      ev.slide();
    }
    if (this.slideT > 0) {
      this.slideT -= dt;
      if (this.slideT <= 0 || !grounded) this.endSlide();
    }
    // ---- velocidade horizontal
    let target = this.maxSpeed();
    if (this.state === 'glide') target = Math.min(target, GLIDE_SPEED * 1.15);
    if (inp.moveX < -0.3) target *= BRAKE;
    if (this.stumbleT > 0) target *= 0.3;
    if (this.slipT > 0) target = CHASE_RUN * 1.3;
    if (this.slideT > 0) target = Math.max(target, CHASE_RUN * 1.05);
    const acc = grounded ? (b.vx < target ? RUN_ACC : RUN_DEC) : b.vx < target ? AIR_ACC : AIR_DEC;
    b.vx = approach(b.vx, target, acc * dt);
    // ---- pulo
    if (control && this.jumpBuf > 0 && this.coyote > 0 && this.state !== 'slide') {
      b.vy = -JUMP_V;
      this.jumping = true;
      this.jumpBuf = 0;
      this.coyote = 0;
      this.airStartX = b.x;
      b.onGround = false;
      ev.jump();
    }
    if (this.jumping && !inp.jump.held && b.vy < -150) { b.vy *= 0.55; this.jumping = false; }
    if (b.vy >= 0) this.jumping = false;
    // ---- planar com as orelhas: apertar de novo no ar (como no jogo base)
    if (control && !grounded && this.coyote <= 0 && inp.jump.pressed && this.state !== 'glide' && this.glideFuel > 0.15) {
      this.state = 'glide';
      this.glideT = 0;
      ev.glide();
    }
    if (this.state === 'glide') {
      this.glideT += dt;
      if (!inp.jump.held || grounded || this.glideFuel <= 0) this.state = 'air';
      else {
        this.glideFuel -= dt;
        const tf = GLIDE_FALL + Math.sin(this.glideT * 6) * 6;
        if (b.vy > tf) b.vy = approach(b.vy, tf, 2600 * dt); else b.vy += 900 * dt * 0.2;
      }
    }
    if (this.state !== 'glide') {
      b.vy = Math.min(FALL_MAX, b.vy + GRAV * dt);
      if (b.vy < 0 && !inp.jump.held && !this.springUp) b.vy += GRAV * 0.6 * dt;
      if (b.vy >= 0) this.springUp = false;
    }
    // ---- colisão
    const preVy = b.vy;
    const oldX = b.x, oldFeet = this.feetY, attached = b.onGround;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.onGround = false;
    const surface = course.surfaceY(b.x);
    if (surface !== null && attached && course.surfaceY(oldX) !== null && preVy >= 0) {
      b.y = surface - b.h / 2; b.vy = 0; b.onGround = true;
    } else if (preVy >= 0) {
      // Varredura curta acompanha também a subida do galho durante uma aterrissagem.
      const n = Math.max(1, Math.ceil(Math.abs(b.x - oldX) / 8));
      const newFeet = this.feetY;
      for (let i = 1; i <= n; i++) {
        const u = i / n, sx = oldX + (b.x - oldX) * u, sy = course.surfaceY(sx);
        if (sy !== null && oldFeet <= sy + 2 && oldFeet + (newFeet - oldFeet) * u >= sy) {
          if (surface !== null) { b.y = surface - b.h / 2; b.vy = 0; b.onGround = true; }
          break;
        }
      }
    }
    if (b.onGround) {
      if (!this.wasGround && preVy > 120) { this.landed = 1; ev.land(preVy); }
      if (this.state === 'air' || this.state === 'glide' || this.state === 'run') this.state = this.slideT > 0 ? 'slide' : 'run';
    } else if (this.state === 'run') this.state = 'air';
    this.wasGround = b.onGround;
    // cipó: no ar, perto da corda
    if (!b.onGround && this.vineCd <= 0 && this.stumbleT <= 0) this.tryGrab(course);
    // queda da copa
    if (b.y - b.h / 2 > course.floorY && this.fallT <= 0) { this.fallT = 0.8; this.state = 'fallen'; ev.fall(); }
  }

  private endSlide() {
    this.slideT = 0;
    if (this.state === 'slide') this.state = 'run';
    this.setHeight(FOOT_H);
  }

  /** Tropeçou num bicho: perde velocidade (sem queda). */
  stumble() {
    if (this.invuln > 0 || this.state === 'fallen') return false;
    this.stumbleT = 0.6;
    this.state = 'stumble';
    this.invuln = 1.1;
    this.body.vx *= 0.3;
    if (this.slideT > 0) this.endSlide();
    return true;
  }

  /** Escorregou na casca de banana: arranca para a frente sem controle (pode cair do galho). */
  slip() {
    if (this.invuln > 0 || this.state === 'fallen') return false;
    this.slipT = 0.6;
    this.state = 'slip';
    this.invuln = 0.9;
    if (this.slideT > 0) this.endSlide();
    return true;
  }

  private tryGrab(course: Course) {
    const b = this.body;
    for (const v of course.vines) {
      const dx = b.x - v.ax, dy = b.y - v.ay;
      const d = Math.hypot(dx, dy);
      if (dy > 40 && d >= v.len - 36 && d <= v.len + 18 && Math.abs(dx) < v.len * 0.9) {
        // agarra: velocidade tangencial vira velocidade angular
        const ang = Math.atan2(dx, dy);
        const vt = b.vx * Math.cos(ang) - b.vy * Math.sin(ang);
        this.vine = { def: v, ang, av: vt / v.len, t: 0 };
        this.state = 'vine';
        this.jumping = false;
        this.glideFuel = GLIDE_FUEL;
        return;
      }
    }
  }

  private stepVine(dt: number, inp: RunInput, ev: RunnerEvents) {
    const v = this.vine!, b = this.body;
    v.t += dt;
    const L = v.def.len;
    v.av += (-(GRAV * 0.7) / L) * Math.sin(v.ang) * dt;
    v.av += 1.1 * dt; // o Karimbo se impulsiona para a frente: balança sempre para o outro lado
    v.av *= 1 - 0.1 * dt;
    v.ang += v.av * dt;
    b.x = v.def.ax + L * Math.sin(v.ang);
    b.y = v.def.ay + L * Math.cos(v.ang);
    b.vx = v.av * L * Math.cos(v.ang);
    b.vy = -v.av * L * Math.sin(v.ang);
    if (inp.jump.pressed || v.t > 2.4 || v.ang > 1.1) this.releaseVine(ev);
  }

  releaseVine(ev: RunnerEvents) {
    if (!this.vine) return;
    const b = this.body;
    b.vx = Math.max(b.vx * 1.05, CHASE_RUN * 0.8);
    b.vy = Math.min(b.vy - 120, -160);
    this.vine = null;
    this.state = 'air';
    this.vineCd = 0.5;
    this.coyote = 0;
    this.glideFuel = GLIDE_FUEL;
    ev.jump();
  }

  /** Mola da bromélia: quica alto (e a folha afunda na arte). */
  spring() {
    this.body.vy = -JUMP_V * SPRING_BOOST;
    this.springUp = true;
    this.body.onGround = false;
    this.jumping = false;
    this.coyote = 0;
    this.glideFuel = GLIDE_FUEL;
  }

  /** Pouso perfeito: +15% de velocidade por 1,5 s. */
  perfect() { this.boostT = PERFECT_TIME; }
}

export interface RunnerEvents {
  jump(): void;
  land(vy: number): void;
  glide(): void;
  slide(): void;
  fall(): void;
  respawn(): void;
}
