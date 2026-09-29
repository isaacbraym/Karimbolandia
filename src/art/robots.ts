/** Robôs da Legião: drone, torreta, robô pesado, aranha e mini-mech (peças baked + partes animadas). */
import { bake, drawSpr, glowSprite, shadedRR, shadedEllipse, poly, OUT, rrPath, type Sprite } from './kit';
import { PAL } from './palette';
import { shade } from '../core/math';

const S = 2;

export interface RobotArt {
  drone: Sprite;
  turretBase: Sprite;
  turretHead: Sprite;
  turretBarrel: Sprite;
  heavyTorso: Sprite;
  heavyHead: Sprite;
  heavyCannon: Sprite;
  heavyClaw: Sprite;
  heavyLeg: Sprite;
  heavyLegB: Sprite;
  spiderBody: Sprite;
  mechCockpit: Sprite;
  mechTorso: Sprite;
  mechCannon: Sprite;
  mechPod: Sprite;
  mechFoot: Sprite;
}

const F = PAL.foe;

export function bakeRobots(): RobotArt {
  // ---------------------------------------------------------------- drone
  const drone = bake(
    36,
    28,
    (g) => {
      // casco inferior
      shadedEllipse(g, 17, 16, 14, 8.5, '#565c7a');
      // faixa magenta
      g.save();
      g.beginPath();
      g.ellipse(17, 16, 14, 8.5, 0, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = F.magenta;
      g.fillRect(2, 15.6, 30, 2.6);
      g.restore();
      // cúpula
      g.beginPath();
      g.ellipse(17, 11.5, 9.5, 6.8, 0, Math.PI, 0);
      g.closePath();
      g.fillStyle = '#7a82a6';
      g.fill();
      g.lineWidth = 1.1;
      g.strokeStyle = OUT;
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.beginPath();
      g.ellipse(14, 8.6, 4.4, 1.9, -0.3, 0, Math.PI * 2);
      g.fill();
      // olho
      g.beginPath();
      g.arc(27, 15.6, 4.6, 0, Math.PI * 2);
      g.fillStyle = '#1a0f22';
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = OUT;
      g.stroke();
      g.beginPath();
      g.arc(27.6, 15.4, 3.2, 0, Math.PI * 2);
      g.fillStyle = F.visor;
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(28.6, 14.4, 1, 0, Math.PI * 2);
      g.fill();
      // canhão inferior
      shadedRR(g, 21, 22.4, 11, 3.8, 1.4, '#39405a');
      shadedRR(g, 5, 22, 8, 4, 1.4, '#39405a');
      // antena
      g.strokeStyle = OUT;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(11, 5);
      g.lineTo(9, 1.4);
      g.stroke();
      g.fillStyle = F.red;
      g.beginPath();
      g.arc(9, 1.4, 1.2, 0, Math.PI * 2);
      g.fill();
    },
    { scale: S, ox: 18, oy: 14 }
  );

  // ---------------------------------------------------------------- torreta
  const turretBase = bake(
    40,
    16,
    (g) => {
      poly(g, [[3, 16], [8, 5], [32, 5], [37, 16]], '#4a5074');
      shadedRR(g, 8, 1, 24, 7, 2, '#5f678c');
      g.fillStyle = 'rgba(255,255,255,0.2)';
      g.fillRect(9, 2, 22, 1.4);
      g.fillStyle = F.orange;
      g.fillRect(6, 13.2, 28, 1.8);
      for (const x of [10, 16, 24, 30]) {
        g.fillStyle = '#ffffff33';
        g.beginPath();
        g.arc(x, 10.4, 0.9, 0, Math.PI * 2);
        g.fill();
      }
    },
    { scale: S, ox: 20, oy: 16 }
  );
  const turretHead = bake(
    28,
    22,
    (g) => {
      g.beginPath();
      g.ellipse(14, 12, 12, 9.5, 0, Math.PI, 0);
      g.lineTo(26, 20);
      g.lineTo(2, 20);
      g.closePath();
      const gr = g.createLinearGradient(0, 2, 0, 20);
      gr.addColorStop(0, '#8087ac');
      gr.addColorStop(1, '#484e72');
      g.fillStyle = gr;
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = OUT;
      g.stroke();
      // sensor
      g.beginPath();
      g.arc(14, 13, 4.2, 0, Math.PI * 2);
      g.fillStyle = '#120a1e';
      g.fill();
      g.beginPath();
      g.arc(14, 13, 2.8, 0, Math.PI * 2);
      g.fillStyle = F.red;
      g.fill();
      g.fillStyle = '#fff';
      g.fillRect(15, 11.6, 1.2, 1.2);
    },
    { scale: S, ox: 14, oy: 20 }
  );
  const turretBarrel = bake(
    24,
    9,
    (g) => {
      shadedRR(g, 0.5, 1.6, 20, 5.8, 1.6, '#3a4064');
      shadedRR(g, 17, 1, 6, 7, 1.4, '#252a45');
      g.fillStyle = F.orange;
      g.fillRect(4, 2.4, 2.4, 1.2);
      g.fillStyle = '#0c0816';
      g.fillRect(21.6, 3, 1.4, 3);
    },
    { scale: S, ox: 3, oy: 4.5 }
  );

  // ---------------------------------------------------------------- robô pesado
  const heavyTorso = bake(
    56,
    52,
    (g) => {
      shadedRR(g, 6, 4, 44, 40, 9, '#5d6588');
      shadedRR(g, 10, 8, 36, 20, 6, '#7a84ad', { lw: 1 });
      // núcleo
      g.beginPath();
      g.arc(28, 18, 6.5, 0, Math.PI * 2);
      g.fillStyle = '#150c22';
      g.fill();
      g.beginPath();
      g.arc(28, 18, 4.6, 0, Math.PI * 2);
      g.fillStyle = F.orange;
      g.fill();
      g.fillStyle = '#fff5cf';
      g.beginPath();
      g.arc(27, 17, 1.8, 0, Math.PI * 2);
      g.fill();
      // placas e listras
      g.fillStyle = F.magenta;
      g.fillRect(8, 31, 40, 3.4);
      g.fillStyle = F.orange;
      for (let i = 0; i < 6; i++) g.fillRect(10 + i * 7, 36, 4, 3);
      // rebites
      for (const [x, y] of [[13, 12], [43, 12], [13, 26], [43, 26]]) {
        g.fillStyle = '#ffffff44';
        g.beginPath();
        g.arc(x, y, 1, 0, Math.PI * 2);
        g.fill();
      }
      // escapamentos
      shadedRR(g, 2, 8, 8, 12, 3, '#3a4064');
      shadedRR(g, 46, 8, 8, 12, 3, '#3a4064');
    },
    { scale: S, ox: 28, oy: 46 }
  );
  const heavyHead = bake(
    26,
    22,
    (g) => {
      shadedRR(g, 3, 4, 20, 16, 6, '#6a739a');
      g.fillStyle = '#100a1c';
      rrPath(g, 5, 9, 20, 6, 3);
      g.fill();
      g.fillStyle = F.visor;
      g.fillRect(9, 10.6, 14, 2.6);
      g.fillStyle = '#ffffff88';
      g.fillRect(10, 10.8, 4, 1);
      g.strokeStyle = OUT;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(8, 4);
      g.lineTo(6, 0.5);
      g.stroke();
    },
    { scale: S, ox: 13, oy: 20 }
  );
  const heavyCannon = bake(
    46,
    20,
    (g) => {
      shadedRR(g, 0.5, 4, 22, 13, 4, '#586082');
      shadedRR(g, 18, 5.4, 26, 10, 3, '#3a4064');
      shadedRR(g, 39, 3.4, 6.5, 14, 2, '#252a45');
      g.fillStyle = F.orange;
      g.fillRect(24, 7, 3, 6);
      g.fillStyle = '#0c0816';
      g.fillRect(43.6, 8, 1.6, 4.4);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(4, 5, 16, 1.8);
    },
    { scale: S, ox: 7, oy: 10.5 }
  );
  const heavyClaw = bake(
    20,
    34,
    (g) => {
      shadedRR(g, 3, 0.6, 14, 14, 5, '#586082');
      shadedRR(g, 5, 11, 10, 14, 3, '#3a4064');
      // garra
      poly(g, [[3, 24], [10, 33.4], [17, 24], [14, 22], [10, 28], [6, 22]], '#8890b8');
      g.fillStyle = F.orange;
      g.fillRect(5, 15, 10, 2);
    },
    { scale: S, ox: 10, oy: 5 }
  );
  const mkLeg = (dark: boolean) =>
    bake(
      22,
      38,
      (g) => {
        const c = dark ? '#454c6c' : '#586082';
        shadedRR(g, 4, 0, 14, 22, 5, c);
        shadedRR(g, 5.5, 18, 11, 14, 3, shade(c, -0.15));
        shadedRR(g, 0.4, 30.4, 21, 7.4, 3, '#2c3252');
        g.fillStyle = F.orange;
        g.fillRect(3, 31.8, 16, 1.4);
      },
      { scale: S, ox: 11, oy: 3 }
    );

  // ---------------------------------------------------------------- aranha
  const spiderBody = bake(
    36,
    24,
    (g) => {
      shadedEllipse(g, 18, 13, 14, 8.5, '#6a3a4f');
      g.save();
      g.beginPath();
      g.ellipse(18, 13, 14, 8.5, 0, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = F.red;
      g.fillRect(6, 12, 24, 2.4);
      g.restore();
      // "cabeça" com olhos
      shadedEllipse(g, 28, 12, 6.4, 5.4, '#4a2a3a');
      for (const [x, y, r] of [[30, 10, 1.7], [30, 13.4, 1.7], [27, 10.6, 1.2]] as const) {
        g.fillStyle = F.visor;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      // espinhos
      for (const x of [9, 14, 19]) poly(g, [[x, 6], [x + 2, 1.4], [x + 4, 6]], '#8a4a63', { lw: 0.9 });
    },
    { scale: S, ox: 18, oy: 12 }
  );

  // ---------------------------------------------------------------- mini-mech
  const mechCockpit = bake(
    28,
    24,
    (g) => {
      // cabine com piloto
      shadedRR(g, 4, 8, 20, 14, 4, '#7d5aa8');
      g.beginPath();
      g.ellipse(14, 10, 9.4, 8, 0, Math.PI, 0);
      g.closePath();
      g.fillStyle = 'rgba(120,230,255,0.45)';
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = OUT;
      g.stroke();
      // piloto (capacete)
      g.beginPath();
      g.arc(15, 9.6, 3.8, 0, Math.PI * 2);
      g.fillStyle = F.purple;
      g.fill();
      g.lineWidth = 0.9;
      g.strokeStyle = OUT;
      g.stroke();
      g.fillStyle = F.visor;
      g.fillRect(15, 8.6, 3.8, 1.6);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath();
      g.ellipse(10, 5.6, 3.6, 1.4, -0.5, 0, Math.PI * 2);
      g.fill();
    },
    { scale: S, ox: 14, oy: 22 }
  );
  const mechTorso = bake(
    40,
    30,
    (g) => {
      shadedRR(g, 3, 3, 34, 25, 6, '#8a4a9a');
      shadedRR(g, 7, 6, 26, 11, 4, '#a765b8', { lw: 1 });
      g.fillStyle = F.orange;
      g.fillRect(6, 21, 28, 3);
      g.fillStyle = '#ffffff44';
      for (const x of [8, 32]) {
        g.beginPath();
        g.arc(x, 10, 1, 0, Math.PI * 2);
        g.fill();
      }
      shadedRR(g, 15, 13, 10, 5, 2, '#2a1a40', { lw: 0.9 });
      g.fillStyle = F.red;
      g.fillRect(17, 14.4, 6, 2);
    },
    { scale: S, ox: 20, oy: 26 }
  );
  const mechCannon = bake(
    36,
    14,
    (g) => {
      shadedRR(g, 0.5, 2.4, 14, 9, 3, '#6e3a80');
      shadedRR(g, 12, 3.4, 22, 7, 2, '#3b2452');
      shadedRR(g, 30, 2.4, 5.4, 9, 1.5, '#241638');
      g.fillStyle = F.orange;
      g.fillRect(16, 5, 2.4, 4);
      g.fillStyle = '#0c0816';
      g.fillRect(34, 5.4, 1.4, 3.4);
    },
    { scale: S, ox: 5, oy: 7 }
  );
  const mechPod = bake(
    18,
    16,
    (g) => {
      shadedRR(g, 1, 3, 16, 11, 3, '#5a2f6c');
      for (let i = 0; i < 4; i++) {
        const x = 3.4 + (i % 2) * 6.6;
        const y = 5 + Math.floor(i / 2) * 4.6;
        g.beginPath();
        g.arc(x + 1.6, y + 1.4, 1.8, 0, Math.PI * 2);
        g.fillStyle = '#150c22';
        g.fill();
        g.fillStyle = F.red;
        g.beginPath();
        g.arc(x + 1.6, y + 1.4, 1, 0, Math.PI * 2);
        g.fill();
      }
    },
    { scale: S, ox: 9, oy: 14 }
  );
  const mechFoot = bake(
    22,
    9,
    (g) => {
      shadedRR(g, 1, 1, 20, 7, 3, '#4a2a5c');
      g.fillStyle = F.orange;
      g.fillRect(3, 2.4, 14, 1.2);
    },
    { scale: S, ox: 8, oy: 7 }
  );

  return {
    drone, turretBase, turretHead, turretBarrel, heavyTorso, heavyHead, heavyCannon, heavyClaw,
    heavyLeg: mkLeg(false), heavyLegB: mkLeg(true), spiderBody, mechCockpit, mechTorso, mechCannon, mechPod, mechFoot,
  };
}

// ------------------------------------------------------------------------------------------
export interface RPose {
  facing: 1 | -1;
  t: number;
  flash: boolean;
  alpha: number;
  aim: number;
  charge: number; // 0..1
  kick: number;
  phase: number; // fase da caminhada
  moving: boolean;
  extra: number; // uso específico
  hp01: number;
}

const rot = (aim: number, facing: 1 | -1, lim = Math.PI * 0.55) => {
  let a = facing === 1 ? aim : Math.PI - aim;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return Math.max(-lim, Math.min(lim, a));
};

export function drawDrone(g: CanvasRenderingContext2D, a: RobotArt, x: number, y: number, p: RPose) {
  g.save();
  g.globalAlpha *= p.alpha;
  g.translate(x, y);
  if (p.facing === -1) g.scale(-1, 1);
  const bob = Math.sin(p.t * 3.4) * 1.2;
  g.rotate(Math.sin(p.t * 2) * 0.05 + p.extra * 0.35);
  drawSpr(g, a.drone, 0, bob, { white: p.flash });
  // rotores
  const spin = Math.abs(Math.cos(p.t * 42));
  g.fillStyle = 'rgba(210,225,255,0.4)';
  g.beginPath();
  g.ellipse(0, -10 + bob, 5 + 14 * spin, 1.6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.fillRect(-1, -12 + bob, 2, 3);
  // carga do tiro
  if (p.charge > 0.05) {
    const spr = glowSprite('#ff8ad4', 24);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha *= p.charge;
    g.drawImage(spr.c, 22 - 8, 8 - 8 + bob, 16, 16);
  }
  g.restore();
}

export function drawTurret(g: CanvasRenderingContext2D, a: RobotArt, x: number, feetY: number, p: RPose, ceiling: boolean, wall: -1 | 0 | 1) {
  g.save();
  g.globalAlpha *= p.alpha;
  g.translate(x, feetY);
  if (ceiling) g.scale(1, -1);
  if (wall) g.rotate(wall === 1 ? -Math.PI / 2 : Math.PI / 2);
  drawSpr(g, a.turretBase, 0, 0, { white: p.flash });
  // cabeça + cano apontam p/ o alvo (aim no espaço do mundo → local)
  let ang = p.aim;
  if (ceiling) ang = -ang;
  if (wall === 1) ang += Math.PI / 2;
  else if (wall === -1) ang -= Math.PI / 2;
  g.save();
  g.translate(0, -13);
  drawSpr(g, a.turretHead, 0, 0, { white: p.flash });
  g.rotate(ang);
  drawSpr(g, a.turretBarrel, 9 - p.kick * 3, 0, { white: p.flash });
  if (p.charge > 0.05) {
    const spr = glowSprite('#ff4a4a', 24);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha *= p.charge;
    g.drawImage(spr.c, 19, -6, 12, 12);
  }
  g.restore();
  g.restore();
}

export function drawHeavy(g: CanvasRenderingContext2D, a: RobotArt, x: number, feetY: number, p: RPose) {
  g.save();
  g.globalAlpha *= p.alpha;
  g.translate(x, feetY);
  if (p.facing === -1) g.scale(-1, 1);
  g.scale(1.22, 1.22);
  const c = p.phase;
  const w = p.flash;
  const bob = p.moving ? -Math.abs(Math.sin(c)) * 1.6 : Math.sin(p.t * 2) * 0.5;
  const lift = p.extra; // 0..1 levantando a perna p/ pisão
  // pernas
  drawSpr(g, a.heavyLegB, -8, -34 + bob * 0.4, { rot: p.moving ? -Math.sin(c) * 0.36 : -0.06, white: w });
  drawSpr(g, a.heavyLeg, 8, -34 + bob * 0.4, { rot: p.moving ? Math.sin(c) * 0.36 : 0.06 - lift * 0.9, white: w, sy: 1 - lift * 0.15 });
  // garra (traseira)
  drawSpr(g, a.heavyClaw, -20, -50 + bob, { rot: 0.2 + Math.sin(p.t * 2) * 0.05, white: w });
  drawSpr(g, a.heavyTorso, 0, -33 + bob, { white: w, rot: p.moving ? 0.03 : 0 });
  drawSpr(g, a.heavyHead, 6, -60 + bob * 1.2, { white: w });
  // canhão do braço
  g.save();
  g.translate(17, -49 + bob);
  g.rotate(rot(p.aim, p.facing, 0.9) - p.kick * 0.05);
  drawSpr(g, a.heavyCannon, -p.kick * 5, 0, { white: w });
  if (p.charge > 0.02) {
    const spr = glowSprite('#ffb347', 24);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha *= p.charge;
    g.drawImage(spr.c, 32, -9, 18, 18);
  }
  g.restore();
  g.restore();
}

export function drawSpider(g: CanvasRenderingContext2D, a: RobotArt, x: number, feetY: number, p: RPose) {
  g.save();
  g.globalAlpha *= p.alpha;
  g.translate(x, feetY);
  if (p.facing === -1) g.scale(-1, 1);
  const c = p.phase;
  const crouch = p.extra; // 0..1 agachando para o salto
  const bodyY = -12 + crouch * 6 + (p.moving ? Math.sin(c * 2) * 0.8 : 0);
  // pernas (4 pares), 2 segmentos
  const legs: [number, number, number][] = [
    [6, 1, 0],
    [2, -1, Math.PI * 0.5],
    [-2, 1, Math.PI],
    [-6, -1, Math.PI * 1.5],
  ];
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const side of [0, 1]) {
    for (const [hx, , ph] of legs) {
      const dirx = hx > 0 ? 1 : -1;
      const step = p.moving ? Math.sin(c * 1.4 + ph + side * Math.PI) : 0;
      const lift = p.moving ? Math.max(0, Math.cos(c * 1.4 + ph + side * Math.PI)) : 0;
      const sx = hx * 0.9;
      const sy = bodyY + 2;
      const fx = sx + dirx * 9 + step * 4;
      const fy = -1 - lift * 4;
      const kx = sx + dirx * 8 + (fx - sx) * 0.15;
      const ky = sy - 9 - crouch * 2;
      g.strokeStyle = OUT;
      g.lineWidth = 3.6;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(kx, ky);
      g.lineTo(fx, fy);
      g.stroke();
      g.strokeStyle = p.flash ? '#ffffff' : side ? '#5a2f43' : '#8a4a63';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(kx, ky);
      g.lineTo(fx, fy);
      g.stroke();
      g.fillStyle = F.orange;
      g.fillRect(kx - 0.8, ky - 0.8, 1.6, 1.6);
    }
  }
  drawSpr(g, a.spiderBody, 0, bodyY, { white: p.flash });
  g.restore();
}

export function drawMiniMech(g: CanvasRenderingContext2D, a: RobotArt, x: number, feetY: number, p: RPose) {
  g.save();
  g.globalAlpha *= p.alpha;
  g.translate(x, feetY);
  if (p.facing === -1) g.scale(-1, 1);
  const c = p.phase;
  const w = p.flash;
  const bob = p.moving ? -Math.abs(Math.sin(c)) * 1.6 : Math.sin(p.t * 2.4) * 0.4;
  // pernas digitígradas (2 segmentos)
  for (const ph of [0, Math.PI]) {
    const s = p.moving ? Math.sin(c + ph) : 0;
    const l = p.moving ? Math.max(0, Math.cos(c + ph)) : 0;
    const hipx = ph === 0 ? 6 : -6;
    const hipy = -26 + bob;
    const kx = hipx + 9 + s * 3;
    const ky = hipy + 10;
    const fx = hipx - 3 + s * 9;
    const fy = -3 - l * 6;
    g.strokeStyle = OUT;
    g.lineWidth = 5.4;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(hipx, hipy);
    g.lineTo(kx, ky);
    g.lineTo(fx, fy);
    g.stroke();
    g.strokeStyle = w ? '#fff' : ph === 0 ? '#8a4a9a' : '#5f3470';
    g.lineWidth = 3.4;
    g.beginPath();
    g.moveTo(hipx, hipy);
    g.lineTo(kx, ky);
    g.lineTo(fx, fy);
    g.stroke();
    drawSpr(g, a.mechFoot, fx + 1, fy + 3, { white: w });
  }
  drawSpr(g, a.mechTorso, 0, -22 + bob, { white: w });
  drawSpr(g, a.mechCockpit, 2, -34 + bob, { white: w });
  drawSpr(g, a.mechPod, -12, -38 + bob, { white: w, rot: -0.15 - p.extra * 0.5 });
  // canhão
  g.save();
  g.translate(13, -27 + bob);
  g.rotate(rot(p.aim, p.facing, 0.85));
  drawSpr(g, a.mechCannon, -p.kick * 4, 0, { white: w });
  if (p.charge > 0.02) {
    const spr = glowSprite('#ffb347', 24);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha *= p.charge;
    g.drawImage(spr.c, 26, -7, 14, 14);
  }
  g.restore();
  g.restore();
}

void PAL;
