import { World } from '../../src/game/world';
import { buildLevel } from '../../src/game/level/index';
import type { ControlState, Btn } from '../../src/core/input';
import { TILE } from '../../src/game/level';

const btn = (): Btn => ({ held: false, pressed: false, released: false });
export const newCtl = (): ControlState => ({
  moveX: 0, moveY: 0, aimVecX: 0, aimVecY: 0, mouseAim: null, padAim: null,
  jump: btn(), fire: btn(), grenade: btn(), special: btn(), next: btn(), prev: btn(), pause: btn(), device: 'kb',
});

export function makeWorld(): World {
  const w = new World(buildLevel());
  // mouse em coordenadas de mundo (o bot mira direto no alvo)
  w.screenToWorldFn = (x, y) => ({ x, y });
  w.invulnerable = true;
  return w;
}

export function armUp(w: World) {
  w.player.weapons.set('rifle', 300);
  w.player.weapons.set('shotgun', 48);
  w.player.weapons.set('launcher', 24);
  w.player.weapons.set('energy', 100);
  w.player.cur = 'rifle';
  w.player.grenades = 8;
}

export function teleport(w: World, tileX: number, row: number) {
  const cps = w.data.checkpoints;
  let idx = -1;
  for (let i = 0; i < cps.length; i++) if (cps[i].x <= tileX * TILE) idx = i;
  w.checkpointIdx = idx;
  w.player.reset(tileX * TILE + 16, row * TILE);
  w.cameraSnap();
}

/** Bot simples: mira no inimigo mais próximo, atira sempre, anda p/ frente e pula em obstáculos/buracos. */
export class Bot {
  t = 0;
  dirX = 1;
  constructor(private w: World, private o: { hold?: boolean; walk?: boolean; special?: boolean } = {}) {}

  step(dt: number, ctl: ControlState) {
    const w = this.w;
    const p = w.player;
    this.t += dt;
    // alvo
    let best: { x: number; y: number } | null = null;
    let bd = 1e9;
    for (const e of w.enemies) {
      if (!e.alive || !e.canBeHit) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd && d < 1500) {
        bd = d;
        best = { x: e.x, y: e.y - 6 };
      }
    }
    ctl.fire.held = true;
    ctl.mouseAim = best ?? { x: p.x + this.dirX * 200, y: p.y - 10 };
    ctl.moveX = this.o.hold ? 0 : this.o.walk === false ? 0 : this.dirX;
    // aproxima-se do alvo até uma distância confortável de tiro
    if (this.o.hold && best) {
      const dx = best.x - p.x;
      ctl.moveX = Math.abs(dx) > 360 ? Math.sign(dx) : 0;
      this.dirX = dx >= 0 ? 1 : -1;
    }
    // pula em paredes/bordas e periodicamente; planeia ao cair
    const b = p.body;
    const ahead = p.x + this.dirX * 40;
    const blocked = w.level.solidAtPx(ahead, p.y) || b.wallDir !== 0;
    const gapAhead = b.onGround && !w.level.solidAtPx(ahead, p.y + 40) && !w.level.solidAtPx(ahead, p.y + 72);
    ctl.jump.pressed = false;
    if (b.onGround && (blocked || gapAhead || Math.floor(this.t * 10) % 37 === 0)) {
      ctl.jump.held = true;
      ctl.jump.pressed = true;
    } else if (!b.onGround && b.vy > 80 && !p.glide && p.glideFuel > 0.3 && !p.nomad) {
      ctl.jump.held = true;
      ctl.jump.pressed = true;
    } else if (b.onGround) ctl.jump.held = false;
    ctl.grenade.pressed = Math.floor(this.t * 60) % 240 === 0;
    ctl.special.pressed = !!p.nomad && Math.floor(this.t * 60) % 200 === 0 && !!this.o.special;
  }
}

export function run(w: World, bot: Bot, ctl: ControlState, seconds: number, until?: () => boolean) {
  const dt = 1 / 60;
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    bot.step(dt, ctl);
    if (w.fx.hitStop > 0) w.fx.hitStop = 0;
    w.update(dt, ctl);
    ctl.jump.pressed = ctl.grenade.pressed = ctl.special.pressed = false;
    const p = w.player;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error(`NaN na posição do jogador em t=${i * dt}`);
    if (w.respawnRequested) w.respawn();
    if (until && until()) return i * dt;
  }
  return seconds;
}
