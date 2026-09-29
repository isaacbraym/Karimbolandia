/** Cena animada de fundo do menu: cidade rolando, Karimbo correndo com o Nômad, tiros e explosões. */
import { Level, T, THEME, TILE } from './level';
import { Fx, PK } from './fx';
import { getArt } from '../art';
import { drawKarimbo } from '../art/karimbo';
import { drawNomad } from '../art/nomad';
import { drawDrone } from '../art/robots';
import { rand } from '../core/math';

interface Bolt {
  x: number;
  y: number;
  vx: number;
  life: number;
}
interface Foe {
  x: number;
  y: number;
  vx: number;
  t: number;
  hp: number;
}

export class MenuScene {
  camX = 0;
  t = 0;
  fx = new Fx();
  level: Level;
  bolts: Bolt[] = [];
  foes: Foe[] = [];
  shotCd = 0;
  spawnCd = 1.2;
  nomadX = 0;

  constructor() {
    this.level = new Level(260, 10);
    for (let x = 0; x < 260; x++) {
      for (let y = 6; y < 10; y++) this.level.set(x, y, T.SOLID, x % 90 < 60 ? THEME.STREET : THEME.RUINS);
    }
    this.fx.density = 0.6;
  }

  update(dt: number, W: number) {
    this.t += dt;
    this.camX += dt * 90;
    if (this.camX > 260 * TILE - 2000) this.camX = 0;
    this.shotCd -= dt;
    this.spawnCd -= dt;
    const kx = W * 0.74;
    if (this.spawnCd <= 0) {
      this.spawnCd = rand.range(1.4, 2.6);
      this.foes.push({ x: this.camX + W + 60, y: 130 + rand.range(-30, 20), vx: rand.range(-60, -20), t: rand.range(0, 6), hp: 1 });
    }
    if (this.shotCd <= 0) {
      this.shotCd = 0.28;
      this.bolts.push({ x: this.camX + kx + 34, y: 154, vx: 620, life: 1.1 });
      this.fx.add(PK.Fire, this.camX + kx + 34, 154, 0, 0, 0.07, 9, '#ffb340', { size1: 3, front: true });
      this.fx.add(PK.Casing, this.camX + kx + 4, 148, -rand.range(30, 80), -rand.range(100, 160), 0.9, 2, '#e8b64a', { g: 900, bounce: 0.4, vr: 10, front: true });
    }
    for (const b of this.bolts) {
      b.x += b.vx * dt;
      b.life -= dt;
      for (const f of this.foes) {
        if (f.hp > 0 && Math.abs(b.x - f.x) < 14 && Math.abs(b.y - f.y) < 16) {
          f.hp = 0;
          b.life = 0;
          this.fx.explosion(f.x, f.y, 16);
        }
      }
    }
    this.bolts = this.bolts.filter((b) => b.life > 0);
    for (const f of this.foes) {
      f.x += f.vx * dt;
      f.t += dt;
    }
    this.foes = this.foes.filter((f) => f.hp > 0 && f.x > this.camX - 80);
    this.fx.update(dt, (x, y) => this.level.solidAtPx(x, y));
    // fumaça da esfera do Nômad
    this.nomadX = this.camX + W * 0.9;
    if (Math.random() < dt * 20) this.fx.add(PK.Dust, this.nomadX - 24, 6 * TILE - 2, -70, -rand.range(6, 30), 0.5, 8, '#b9b0c8', { size1: 3, a0: 0.6 });
  }

  draw(g: CanvasRenderingContext2D, W: number, H: number) {
    const art = getArt();
    const groundY = 224; // linha do chão na tela
    // câmera: x = camX, y tal que a linha 6 do tile fique em groundY
    const camY = 6 * TILE - groundY;
    art.bg.draw(g, { camX: this.camX, camY, viewW: W, viewH: H, time: this.t, sky: 0.12, ruin: 0.15, refY: camY, intensity: 1 }, 0.016);
    g.save();
    g.translate(-this.camX, -camY);
    art.tiles.render(g, this.level, this.camX, camY, W, H, this.t);
    const feet = 6 * TILE;
    // Nômad rolando
    drawNomad(g, art.nomad, art.karimbo.heads, this.nomadX, feet, {
      facing: 1, roll: this.t * 6, tilt: 0.05, aim: 0, recoil: 0, flash: false, t: this.t, vx: 200, vy: 0, onGround: true, dashing: 0,
      alpha: 1, hp01: 1, pilot: false, earFlap: 0, ready: true,
    });
    // Karimbo correndo
    const kx = this.camX + W * 0.74;
    drawKarimbo(g, art.karimbo, kx, feet, {
      facing: 1, state: 'run', t: this.t, runPhase: this.t * 13, speed01: 1, aim: 0, weapon: 'rifle', kick: (Math.sin(this.t * 22) + 1) / 2 * (this.shotCd > 0.12 ? 1 : 0),
      flash: false, earGlide: 0, vy: 0, alpha: 1, hasGun: true, scarf: this.t * 12,
    });
    // inimigos-drone
    for (const f of this.foes) drawDrone(g, art.robots, f.x, f.y, { facing: -1, t: f.t, flash: false, alpha: 1, aim: 0, charge: 0, kick: 0, phase: 0, moving: true, extra: 0, hp01: 1 });
    for (const b of this.bolts) {
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = '#ffc24d';
      g.lineWidth = 2.6;
      g.beginPath();
      g.moveTo(b.x - 16, b.y);
      g.lineTo(b.x, b.y);
      g.stroke();
      g.globalCompositeOperation = 'source-over';
    }
    this.fx.draw(g, false);
    this.fx.draw(g, true);
    g.restore();
    art.bg.drawForeground(g, { camX: this.camX, camY, viewW: W, viewH: H, time: this.t, sky: 0.12, ruin: 0.15, refY: camY, intensity: 1 }, 0.016);
    art.bg.drawVignette(g, W, H, 1);
  }
}
