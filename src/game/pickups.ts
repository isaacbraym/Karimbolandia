import type { World } from './world';
import type { PickupKind } from './level';
import { getArt } from '../art';
import { drawSpr, glowSprite } from '../art/kit';
import { PK } from './fx';
import { moveBody, newBody, type Body } from './physics';
import { music } from '../core/music';

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
    return this.kind === 'token' ? 13 : this.kind === 'note' ? 18 : this.kind === 'emblem' || this.kind === 'secret' ? 18 : this.kind === 'healthBig' ? 22 : 18;
  }

  update(w: World, dt: number) {
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
    const p = w.player;
    if (!p.canCollect) return;
    const px = p.x;
    const py = p.y - p.body.h * 0.1;
    const dx = px - this.x;
    const dy = py - this.y;
    const d2 = dx * dx + dy * dy;
    // ímã leve para tokens
    if (this.kind === 'token' && d2 < 70 * 70 && this.collectDelay <= 0) {
      const d = Math.sqrt(d2) || 1;
      const s = 260 * dt;
      if (this.body) this.body = null;
      this.x += (dx / d) * s * (1 + (70 - d) / 30);
      this.y += (dy / d) * s * (1 + (70 - d) / 30);
    }
    const reach = this.radius + Math.max(p.body.w, 18) * 0.5;
    if (this.collectDelay <= 0 && d2 < reach * reach + (p.body.h * 0.25) ** 2) {
      if (w.collect(this)) this.alive = false;
    }
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
      if (Math.random() < 0.06) w.fx.add(PK.Glint, x + (Math.random() - 0.5) * 22, y + (Math.random() - 0.5) * 22, 0, -6, 0.45, 5, '#fff2a0', { front: true });
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
      if (Math.random() < 0.05) w.fx.add(PK.Glint, x + (Math.random() - 0.5) * 18, y + (Math.random() - 0.5) * 16, 0, -8, 0.4, 4, '#ffd0e0', { front: true });
      drawSpr(g, art[this.kind], x, y, { sx: pulse, sy: pulse });
      return;
    }
    const spr = art[this.kind];
    if (spr) drawSpr(g, spr, x, y);
  }
}
