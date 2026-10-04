import type { World } from './world';
import type { PickupKind } from './level';
import { getArt } from '../art';
import { drawSpr, glowSprite } from '../art/kit';
import { PK } from './fx';
import { moveBody, newBody, type Body } from './physics';
import { music } from '../core/music';
import { progress } from '../core/storage';
import { pickupPathClear } from './pickupReach';

export class Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  id: number; // id de spawn (-1 = solto dinamicamente)
  itemId: number;
  body: Body | null = null;
  t = Math.random() * 6;
  alive = true;
  life = Infinity;
  magnet = false;
  collectDelay = 0;
  private glintLeft = .3;

  constructor(kind: PickupKind, x: number, y: number, id = -1, itemId = 0, drop = false) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.id = id;
    this.itemId = itemId;
    if (drop) {
      const b = newBody(10, 10);
      b.x = x;
      b.y = y;
      b.vx = (Math.random() - 0.5) * 160;
      b.vy = -260 - Math.random() * 80;
      this.body = b;
      this.collectDelay = 0.35;
      this.life = kind === 'token' ? 14 : 30;
    }
  }

  get radius() {
    return this.kind === 'relic' || this.kind === 'chest' ? 22 : this.kind === 'token' ? 13 : this.kind === 'note' ? 18 : this.kind === 'emblem' || this.kind === 'secret' ? 18 : this.kind === 'healthBig' ? 22 : 18;
  }

  update(w: World, dt: number) {
    if (!this.alive || dt <= 0) return;
    this.t += dt;
    if (this.collectDelay > 0) this.collectDelay -= dt;
    if (this.body) {
      const b = this.body;
      b.vy += 900 * dt;
      moveBody(b, dt, w.level, w.solidRects, true);
      if (b.onGround) b.vx *= 0.86;
      this.x = b.x;
      this.y = b.y;
      if (b.y > w.level.pxH + 100) this.alive = false;
    }
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
    if (!this.alive) return;
    this.updateGlints(w, dt);
    const p = w.player;
    if (!p.canCollect) return;
    const px = p.x;
    const py = p.y - p.body.h * 0.1;
    const dx = px - this.x;
    const dy = py - this.y;
    let d2 = dx * dx + dy * dy;
    const reach = this.radius + Math.max(p.body.w, 18) * 0.5;
    const collectRange2 = reach * reach + (p.body.h * 0.25) ** 2;
    const inMagnetRange = this.kind === 'token' && d2 < 70 * 70;
    if (this.collectDelay > 0 || (!inMagnetRange && d2 >= collectRange2)) return;
    if (!pickupPathClear(w.level, w.solidRects, this.x, this.y, px, py)) return;
    // ímã leve para tokens
    if (inMagnetRange) {
      const d = Math.sqrt(d2) || 1;
      const s = Math.min(d, 260 * dt * (1 + (70 - d) / 30));
      if (this.body) this.body = null;
      this.x += (dx / d) * s;
      this.y += (dy / d) * s;
      d2 = (px - this.x) ** 2 + (py - this.y) ** 2;
    }
    if (d2 < collectRange2) {
      if (w.collect(this)) this.alive = false;
    }
  }

  /** Simulation owns particle emission; drawing paused frames never fills the pool. */
  private updateGlints(w: World, dt: number) {
    const special = this.kind === 'emblem' || this.kind === 'secret';
    const health = this.kind === 'health' || this.kind === 'healthBig';
    if (!special && !health) return;
    const interval = special ? 1 / 3.6 : 1 / 3;
    this.glintLeft -= dt;
    if (!w.camera.visible(this.x, this.y, 40)) { this.glintLeft = interval;return; }
    if (this.glintLeft > 1e-9) return;
    // Keep cadence across frame rates, but never catch up with a burst after a long step.
    this.glintLeft += Math.max(1, Math.floor(-this.glintLeft / interval) + 1) * interval;
    if (!w.fx.opt()) return;
    w.fx.add(PK.Glint, this.x + (Math.random() - .5) * (special ? 22 : 18),
      this.y + (Math.random() - .5) * (special ? 22 : 16), 0, special ? -6 : -8,
      special ? .45 : .4, special ? 5 : 4, special ? '#fff2a0' : '#ffd0e0', { front: true });
  }

  draw(g: CanvasRenderingContext2D, w: World) {
    const art = getArt().pickups;
    const bob = this.body ? 0 : Math.sin(this.t * 3) * 2.2;
    const x = this.x;
    const y = this.y + bob;
    if (this.life < 4 && this.life !== Infinity && Math.floor(this.life * 8) % 2 === 0) return;
    if (this.kind === 'note') {
      // nota musical dourada pulsando na batida da música
      const b = music.beat();
      const pulse = 1 + 0.22 * Math.max(0, 1 - b * 4);
      const glow = glowSprite('#ffe27a', 32);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.45 + 0.35 * Math.max(0, 1 - b * 3);
      g.drawImage(glow.c, x - 22 * pulse, y - 22 * pulse, 44 * pulse, 44 * pulse);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.save();
      g.translate(x, y);
      g.scale(pulse, pulse);
      g.rotate(Math.sin(this.t * 2) * 0.15);
      g.fillStyle = '#ffd23a';
      g.strokeStyle = '#170f2e';
      g.lineWidth = 1.6;
      g.beginPath();
      g.ellipse(-3, 6, 6, 4.4, -0.4, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillRect(1.6, -10, 2.6, 16);
      g.strokeRect(1.6, -10, 2.6, 16);
      g.beginPath();
      g.moveTo(4.2, -10);
      g.quadraticCurveTo(12, -6, 9, 2);
      g.quadraticCurveTo(10, -4, 4.2, -5);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
      return;
    }
    if (this.kind === 'relic' || this.kind === 'chest') {
      drawTreasure(g, this.kind, x, y, this.t, this.kind === 'relic' && progress.relics.includes(this.itemId));
      return;
    }
    if (this.kind === 'token') {
      const sx = Math.cos(this.t * 5);
      drawSpr(g, art.token, x, y, { sx: Math.abs(sx) < 0.12 ? 0.12 : sx });
      return;
    }
    // brilho de fundo p/ itens especiais
    if (this.kind === 'emblem' || this.kind === 'secret') {
      const spr = glowSprite(this.kind === 'emblem' ? '#ffd23a' : '#7ff9ff', 32);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5 + 0.25 * Math.sin(this.t * 4);
      const r = this.kind === 'emblem' ? 24 : 30;
      g.drawImage(spr.c, x - r, y - r, r * 2, r * 2);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    if (this.kind === 'health' || this.kind === 'healthBig') {
      const big = this.kind === 'healthBig';
      const glow = glowSprite('#ff4a7a', 32);
      const pulse = 1 + 0.09 * Math.sin(this.t * 6);
      const r = (big ? 34 : 24) * pulse;
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5 + 0.2 * Math.sin(this.t * 4);
      g.drawImage(glow.c, x - r, y - r, r * 2, r * 2);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      drawSpr(g, art[this.kind], x, y, { sx: pulse, sy: pulse });
      return;
    }
    const spr = art[this.kind];
    if (spr) drawSpr(g, spr, x, y);
  }
}

/**
 * Relíquia de Atlântida (medalhão com tridente girando, brilho turquesa) e baú do tesouro.
 * Vetores simples por quadro; o brilho é o sprite pronto de glowSprite.
 */
function drawTreasure(g: CanvasRenderingContext2D, kind: 'relic' | 'chest', x: number, y: number, t: number, known: boolean) {
  const relic = kind === 'relic';
  const glow = glowSprite(relic ? '#7ff9e0' : '#ffd23a', 32);
  const pulse = 1 + 0.12 * Math.sin(t * 3);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = (known ? 0.25 : 0.6) * (0.75 + 0.25 * Math.sin(t * 2.4));
  const r = (relic ? 30 : 34) * pulse;
  g.drawImage(glow.c, x - r, y - r, r * 2, r * 2);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.save();
  g.translate(x, y);
  if (known) g.globalAlpha = 0.5;
  g.strokeStyle = '#170f2e';
  g.lineWidth = 1.4;
  if (relic) {
    g.scale(Math.cos(t * 1.6) * 0.25 + 0.85, 1);
    g.fillStyle = '#1aa79a';
    g.beginPath();
    g.arc(0, 0, 11, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.strokeStyle = '#d9b44a';
    g.lineWidth = 2.2;
    g.beginPath();
    g.arc(0, 0, 8.5, 0, Math.PI * 2);
    g.stroke();
    // tridente
    g.strokeStyle = '#fff4c2';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(0, 7);
    g.lineTo(0, -6);
    g.moveTo(-4.5, -6);
    g.lineTo(-4.5, -2);
    g.quadraticCurveTo(-4.5, 0.5, 0, 0.5);
    g.quadraticCurveTo(4.5, 0.5, 4.5, -2);
    g.lineTo(4.5, -6);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.globalAlpha *= 0.7;
    g.fillRect(-6, -7, 2.2, 2.2);
  } else {
    // baú de madeira com cintas douradas e moedas aparecendo
    g.fillStyle = '#7a4a2a';
    g.beginPath();
    g.roundRect(-13, -6, 26, 14, 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#9a6038';
    g.beginPath();
    g.moveTo(-13, -6);
    g.quadraticCurveTo(0, -17, 13, -6);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#e8b93a';
    g.fillRect(-9, -11, 3, 19);
    g.fillRect(6, -11, 3, 19);
    g.fillRect(-2.5, -3, 5, 6);
    g.fillStyle = '#ffe27a';
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(-6 + i * 4, -7 - Math.abs(Math.sin(t * 2 + i)) * 2, 2, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}
