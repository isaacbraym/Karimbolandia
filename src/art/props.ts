/** Props destrutíveis/decorativos e pickups (baked). */
import { bake, shadedRR, shadedEllipse, poly, rrPath, OUT, glowSprite, type Sprite } from './kit';
import { PAL } from './palette';
import { shade } from '../core/math';
import type { PropKind, PickupKind } from '../game/level';
import type { WeaponId } from '../game/weapons';
import { bakeWeapons } from './karimbo';
import { prism } from './volume';

const S = 2;

export function bakeProps(): Record<PropKind, Sprite> {
  const out = {} as Record<PropKind, Sprite>;

  const crate = (w: number, base: string) =>
    bake(w, w, (g) => {
      const front = w - 7;
      prism(g, 1, 5, front, w - 6, 5, -4, base, 1.1);
      g.strokeStyle = shade(base, -0.45);
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(3, 7);
      g.lineTo(front - 1, w - 3);
      g.moveTo(front - 1, 7);
      g.lineTo(3, w - 3);
      g.stroke();
      g.strokeStyle = shade(base, 0.25);
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(3, 8.4);
      g.lineTo(front - 2.4, w - 3);
      g.stroke();
      // cantoneiras metálicas
      g.fillStyle = '#3a3f55';
      for (const [x, y] of [[1, 5], [front - 4, 5], [1, w - 6], [front - 4, w - 6]]) g.fillRect(x, y, 4, 4);
      g.fillStyle = PAL.neonAmber;
      g.fillRect(w / 2 - 3, w / 2 - 1, 6, 2);
      g.fillRect(w / 2 - 1, w / 2 - 3, 2, 6);
    }, { scale: S, ox: w / 2, oy: w });
  out.crate = crate(30, '#b07a44');
  out.crateBig = crate(46, '#9c6a3a');

  out.barrel = bake(24, 32, (g) => {
    shadedRR(g, 1.5, 1.5, 21, 29, 6, '#e2384a');
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(1.5, 9, 21, 2);
    g.fillRect(1.5, 21, 21, 2);
    g.fillStyle = '#ffd23a';
    g.beginPath();
    g.moveTo(12, 11);
    g.lineTo(17, 20);
    g.lineTo(7, 20);
    g.closePath();
    g.fill();
    g.fillStyle = OUT;
    g.fillRect(11.2, 13.4, 1.6, 3.6);
    g.fillRect(11.2, 17.6, 1.6, 1.4);
    rrPath(g, 1.5, 1.5, 21, 29, 6);
    g.lineWidth = 1.3;
    g.strokeStyle = OUT;
    g.stroke();
  }, { scale: S, ox: 12, oy: 32 });

  out.barricade = bake(52, 34, (g) => {
    shadedRR(g, 2, 4, 48, 26, 3, '#7f89a8');
    // listras de alerta
    g.save();
    rrPath(g, 2, 4, 48, 26, 3);
    g.clip();
    g.fillStyle = PAL.neonAmber;
    for (let x = -30; x < 60; x += 14) {
      g.beginPath();
      g.moveTo(x, 30);
      g.lineTo(x + 7, 30);
      g.lineTo(x + 25, 4);
      g.lineTo(x + 18, 4);
      g.closePath();
      g.fill();
    }
    g.restore();
    rrPath(g, 2, 4, 48, 26, 3);
    g.lineWidth = 1.4;
    g.strokeStyle = OUT;
    g.stroke();
    shadedRR(g, 4, 30, 8, 3.6, 1, '#3a3f55');
    shadedRR(g, 40, 30, 8, 3.6, 1, '#3a3f55');
  }, { scale: S, ox: 26, oy: 34 });

  out.container = bake(96, 64, (g) => {
    shadedRR(g, 1, 1, 94, 62, 3, '#37909f');
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.lineWidth = 1.2;
    for (let x = 8; x < 92; x += 6) {
      g.beginPath();
      g.moveTo(x, 4);
      g.lineTo(x, 60);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.fillRect(2, 2, 92, 5);
    shadedRR(g, 70, 10, 22, 44, 2, '#2a7180', { lw: 1 });
    g.fillStyle = PAL.foe.magenta;
    g.fillRect(8, 26, 46, 12);
    g.fillStyle = '#fff';
    g.font = 'bold 9px sans-serif';
    g.fillText('LEGIÃO', 13, 35.6);
    rrPath(g, 1, 1, 94, 62, 3);
    g.lineWidth = 1.5;
    g.strokeStyle = OUT;
    g.stroke();
  }, { scale: S, ox: 48, oy: 64 });

  out.terminal = bake(26, 36, (g) => {
    shadedRR(g, 3, 8, 20, 27, 3, '#4a5074');
    shadedRR(g, 5, 10, 16, 12, 2, '#0e0a22');
    g.fillStyle = PAL.neonCyan;
    g.globalAlpha = 0.9;
    g.fillRect(7, 12, 12, 1.6);
    g.fillRect(7, 15, 9, 1.6);
    g.fillRect(7, 18, 11, 1.6);
    g.globalAlpha = 1;
    g.fillStyle = PAL.neonMagenta;
    g.fillRect(6, 26, 4, 2);
    g.fillStyle = PAL.neonAmber;
    g.fillRect(12, 26, 4, 2);
    shadedRR(g, 8, 1, 10, 8, 2, '#3a3f55');
  }, { scale: S, ox: 13, oy: 36 });

  out.sign = bake(40, 26, (g) => {
    shadedRR(g, 2, 2, 36, 20, 4, '#1a1236');
    g.strokeStyle = PAL.neonMagenta;
    g.lineWidth = 1.6;
    rrPath(g, 4, 4, 32, 16, 3);
    g.stroke();
    g.fillStyle = PAL.neonCyan;
    g.font = 'bold 11px sans-serif';
    g.textAlign = 'center';
    g.fillText('KAR!', 20, 16);
    g.fillStyle = OUT;
    g.fillRect(9, 22, 3, 4);
    g.fillRect(28, 22, 3, 4);
  }, { scale: S, ox: 20, oy: 26 });

  out.lamp = bake(12, 60, (g) => {
    shadedRR(g, 4.4, 8, 3.4, 52, 1.4, '#4a5074');
    shadedRR(g, 1, 2, 10, 7, 3, '#5f678c');
    g.fillStyle = PAL.neonAmber;
    g.fillRect(2.4, 7, 7.2, 2);
  }, { scale: S, ox: 6, oy: 60 });

  out.wall = bake(32, 96, (g) => {
    shadedRR(g, 1, 1, 30, 94, 2, '#7a7594');
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.lineWidth = 1.2;
    for (const y of [24, 48, 72]) {
      g.beginPath();
      g.moveTo(1, y);
      g.lineTo(31, y);
      g.stroke();
    }
    // rachaduras (pista visual de parede frágil)
    g.strokeStyle = '#2a2640';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(16, 4);
    g.lineTo(12, 20);
    g.lineTo(19, 34);
    g.lineTo(13, 52);
    g.lineTo(20, 70);
    g.lineTo(15, 92);
    g.stroke();
    g.fillStyle = PAL.neonAmber;
    g.globalAlpha = 0.8;
    for (let i = 0; i < 3; i++) g.fillRect(3, 6 + i * 28, 5, 2);
    g.globalAlpha = 1;
    rrPath(g, 1, 1, 30, 94, 2);
    g.lineWidth = 1.4;
    g.strokeStyle = OUT;
    g.stroke();
  }, { scale: S, ox: 16, oy: 96 });

  out.door = out.wall;

  out.vehicle = bake(110, 44, (g) => {
    // carro-hover abandonado
    poly(g, [[4, 30], [8, 18], [30, 14], [42, 4], [80, 4], [96, 16], [106, 22], [106, 34], [4, 34]], '#a64a2a');
    g.strokeStyle = OUT;
    g.lineWidth = 1.4;
    g.stroke();
    poly(g, [[34, 14], [44, 7], [62, 7], [62, 14]], 'rgba(120,200,230,0.6)');
    poly(g, [[66, 14], [66, 7], [80, 7], [90, 14]], 'rgba(120,200,230,0.6)');
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.fillRect(8, 20, 90, 3);
    g.fillStyle = '#2a2440';
    g.fillRect(10, 30, 92, 6);
    for (const x of [24, 84]) {
      shadedEllipse(g, x, 36, 9, 6, '#3a3f55');
      g.fillStyle = PAL.neonCyan;
      g.globalAlpha = 0.6;
      g.fillRect(x - 6, 40, 12, 2);
      g.globalAlpha = 1;
    }
    g.fillStyle = '#ffd23a';
    g.fillRect(102, 24, 4, 4);
    g.fillStyle = PAL.foe.red;
    g.fillRect(4, 24, 3, 4);
    // marcas de tiro
    g.fillStyle = '#1a1230';
    for (const [x, y] of [[50, 22], [58, 26], [70, 20]]) {
      g.beginPath();
      g.arc(x, y, 1.6, 0, Math.PI * 2);
      g.fill();
    }
  }, { scale: S, ox: 55, oy: 44 });

  out.pipe = bake(24, 64, (g) => {
    shadedRR(g, 8, 0, 8, 64, 3, '#7f89a8');
    shadedRR(g, 5, 14, 14, 6, 2, '#586082');
    shadedRR(g, 5, 42, 14, 6, 2, '#586082');
    g.fillStyle = PAL.foe.red;
    g.beginPath();
    g.arc(12, 30, 3.4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = OUT;
    g.lineWidth = 1;
    g.stroke();
  }, { scale: S, ox: 12, oy: 64 });

  out.shutter = bake(32, 96, (g) => {
    shadedRR(g, 1, 1, 30, 94, 2, '#8a92ab');
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 6; y < 94; y += 6) g.fillRect(2, y, 28, 1.6);
    g.fillStyle = PAL.neonAmber;
    g.fillRect(4, 84, 24, 4);
    rrPath(g, 1, 1, 30, 94, 2);
    g.lineWidth = 1.4;
    g.strokeStyle = OUT;
    g.stroke();
  }, { scale: S, ox: 16, oy: 96 });

  out.generator = bake(44, 40, (g) => {
    shadedRR(g, 2, 8, 40, 30, 4, '#e0a020');
    g.fillStyle = OUT;
    for (let x = -10; x < 50; x += 12) {
      g.beginPath();
      g.moveTo(x, 38);
      g.lineTo(x + 6, 38);
      g.lineTo(x + 16, 26);
      g.lineTo(x + 10, 26);
      g.closePath();
      g.fill();
    }
    shadedRR(g, 8, 12, 14, 10, 2, '#0e0a22', { lw: 1 });
    g.fillStyle = PAL.neonCyan;
    g.fillRect(10, 15, 10, 1.4);
    g.fillRect(10, 18, 7, 1.4);
    shadedRR(g, 28, 3, 8, 8, 2, '#5f678c');
    g.fillStyle = PAL.foe.red;
    g.beginPath();
    g.arc(32, 26, 2.2, 0, Math.PI * 2);
    g.fill();
  }, { scale: S, ox: 22, oy: 40 });

  out.speaker = bake(28, 40, (g) => {
    shadedRR(g, 2, 2, 24, 37, 3, '#3a3f55');
    for (const [cx, cy, r] of [[14, 12, 7], [14, 28, 5]] as const) {
      shadedEllipse(g, cx, cy, r, r, '#20233a');
      g.fillStyle = PAL.neonMagenta;
      g.beginPath();
      g.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
      g.fill();
    }
  }, { scale: S, ox: 14, oy: 40 });

  return out;
}

// ------------------------------------------------------------------------------------------
export function bakePickups(): Record<PickupKind, Sprite> {
  const out = {} as Record<PickupKind, Sprite>;
  const W = bakeWeapons();

  out.token = bake(16, 16, (g) => {
    shadedEllipse(g, 8, 8, 6.6, 6.6, '#ffd23a');
    g.beginPath();
    g.arc(8, 8, 4.4, 0, Math.PI * 2);
    g.strokeStyle = '#b8801a';
    g.lineWidth = 1;
    g.stroke();
    // "orelha" estilizada no centro
    g.fillStyle = '#b8801a';
    g.beginPath();
    g.moveTo(6.4, 11);
    g.quadraticCurveTo(5, 6, 8, 4.6);
    g.quadraticCurveTo(10.6, 4.6, 9.8, 8);
    g.quadraticCurveTo(9.2, 10, 8, 11);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(4.4, 3.6, 3, 1.2);
  }, { scale: 3, ox: 8, oy: 8 });

  out.emblem = bake(28, 28, (g) => {
    // emblema: escudo-estrela dourado com "K"
    const c = 14;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 13 : 7;
      g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r + 0.5);
    }
    g.closePath();
    const gr = g.createLinearGradient(0, 0, 0, 28);
    gr.addColorStop(0, '#fff2a0');
    gr.addColorStop(0.5, '#ffc93a');
    gr.addColorStop(1, '#d68a16');
    g.fillStyle = gr;
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = OUT;
    g.stroke();
    g.beginPath();
    g.arc(c, c + 0.5, 5.4, 0, Math.PI * 2);
    g.fillStyle = '#1f6a94';
    g.fill();
    g.strokeStyle = OUT;
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = '#fff';
    g.font = 'bold 8px sans-serif';
    g.textAlign = 'center';
    g.fillText('K', c, c + 3.4);
  }, { scale: 3, ox: 14, oy: 14 });

  out.secret = bake(30, 34, (g) => {
    // ORELHA DOURADA (colecionável secreto)
    g.beginPath();
    g.moveTo(12, 31);
    g.bezierCurveTo(3, 24, 2, 8, 12, 3);
    g.bezierCurveTo(22, -1, 27, 9, 22, 18);
    g.bezierCurveTo(20, 23, 20, 27, 16, 31);
    g.bezierCurveTo(15, 32, 13, 32, 12, 31);
    g.closePath();
    const gr = g.createLinearGradient(4, 2, 26, 32);
    gr.addColorStop(0, '#fff8c8');
    gr.addColorStop(0.45, '#ffd23a');
    gr.addColorStop(1, '#c67a10');
    g.fillStyle = gr;
    g.fill();
    g.lineWidth = 1.6;
    g.strokeStyle = OUT;
    g.stroke();
    g.strokeStyle = '#b8760e';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(12, 24);
    g.bezierCurveTo(7, 19, 7, 10, 13, 7);
    g.bezierCurveTo(18, 5, 20, 10, 17, 15);
    g.bezierCurveTo(15, 18, 15, 21, 13, 23);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.ellipse(9, 9, 2, 4.4, -0.5, 0, Math.PI * 2);
    g.fill();
  }, { scale: 3, ox: 15, oy: 17 });

  // CORAÇÃO (cura pequena) — bem evidente
  const heart = (g: CanvasRenderingContext2D, cx: number, cy: number, sz: number, c0: string, c1: string) => {
    g.beginPath();
    g.moveTo(cx, cy + sz * 0.92);
    g.bezierCurveTo(cx - sz * 1.35, cy + sz * 0.1, cx - sz * 0.95, cy - sz * 0.95, cx, cy - sz * 0.32);
    g.bezierCurveTo(cx + sz * 0.95, cy - sz * 0.95, cx + sz * 1.35, cy + sz * 0.1, cx, cy + sz * 0.92);
    g.closePath();
    const gr = g.createLinearGradient(0, cy - sz, 0, cy + sz);
    gr.addColorStop(0, c0);
    gr.addColorStop(1, c1);
    g.fillStyle = gr;
    g.fill();
  };
  out.health = bake(30, 28, (g) => {
    heart(g, 15, 13.5, 11.5, '#ff7a96', '#d81e4a');
    g.lineWidth = 1.8;
    g.strokeStyle = OUT;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.beginPath();
    g.ellipse(9.4, 8.4, 3.2, 2, -0.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.arc(20.4, 8, 1.1, 0, Math.PI * 2);
    g.fill();
  }, { scale: 3, ox: 15, oy: 14 });

  // CORAÇÃO GRANDE (cura grande): dourado com cruz
  out.healthBig = bake(42, 38, (g) => {
    heart(g, 21, 18.5, 16.5, '#ffd0e0', '#ff2f6a');
    g.lineWidth = 2.4;
    g.strokeStyle = '#ffd23a';
    g.stroke();
    g.lineWidth = 1.2;
    g.strokeStyle = OUT;
    g.stroke();
    g.fillStyle = '#ffffff';
    g.fillRect(19, 12, 4, 13);
    g.fillRect(14.5, 16.5, 13, 4);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.ellipse(12.5, 10.5, 4, 2.4, -0.6, 0, Math.PI * 2);
    g.fill();
  }, { scale: 3, ox: 21, oy: 19 });

  out.ammo = bake(24, 20, (g) => {
    shadedRR(g, 1.5, 4, 21, 14.5, 2.4, '#5c6a34');
    g.fillStyle = PAL.neonAmber;
    g.fillRect(3, 6, 18, 2);
    for (let i = 0; i < 5; i++) {
      g.fillStyle = '#ffd77a';
      g.fillRect(4 + i * 3.6, 10, 2.4, 6);
      g.fillStyle = '#b8801a';
      g.fillRect(4 + i * 3.6, 10, 2.4, 1.6);
    }
    shadedRR(g, 8, 1, 8, 4, 1.4, '#3a3f55');
  }, { scale: 3, ox: 12, oy: 11 });

  out.nade = bake(24, 20, (g) => {
    for (const [x, y] of [[7, 12], [17, 12], [12, 7.4]] as const) {
      shadedEllipse(g, x, y, 4.8, 5.4, '#4a6a3a');
      g.fillStyle = '#ffd23a';
      g.fillRect(x - 4.4, y - 1, 8.8, 1.6);
      g.fillStyle = '#8a8fa8';
      g.fillRect(x - 1.4, y - 7, 2.8, 2.4);
    }
  }, { scale: 3, ox: 12, oy: 10 });

  const cap = (id: WeaponId, letter: string, color: string) =>
    bake(30, 24, (g) => {
      shadedRR(g, 1.5, 2, 27, 20, 6, color);
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.fillRect(3, 3, 24, 4);
      // silhueta da arma
      const w = W[id];
      g.drawImage(w.c, 3, 6, 18, (w.h / w.w) * 18);
      g.fillStyle = '#fff';
      g.font = 'bold 9px sans-serif';
      g.textAlign = 'center';
      g.strokeStyle = OUT;
      g.lineWidth = 2.4;
      g.strokeText(letter, 23.6, 20.4);
      g.fillText(letter, 23.6, 20.4);
    }, { scale: 3, ox: 15, oy: 12 });
  out.rifle = cap('rifle', 'R', '#3a86c8');
  out.shotgun = cap('shotgun', 'S', '#e0662a');
  out.launcher = cap('launcher', 'G', '#5aa040');
  out.energy = cap('energy', 'P', '#8a4ad0');

  out.repair = bake(26, 24, (g) => {
    shadedEllipse(g, 13, 12, 10.6, 10.6, '#1f6a94');
    // chave inglesa
    g.save();
    g.translate(13, 12);
    g.rotate(-0.6);
    g.fillStyle = '#e9eef8';
    g.fillRect(-1.6, -8, 3.2, 16);
    g.beginPath();
    g.arc(0, -8, 3.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1f6a94';
    g.fillRect(-1.2, -12, 2.4, 4.6);
    g.beginPath();
    g.arc(0, 8, 3, 0, Math.PI * 2);
    g.fillStyle = '#e9eef8';
    g.fill();
    g.restore();
    g.strokeStyle = OUT;
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(13, 12, 10.6, 0, Math.PI * 2);
    g.stroke();
  }, { scale: 3, ox: 13, oy: 12 });

  void glowSprite;
  return out;
}
