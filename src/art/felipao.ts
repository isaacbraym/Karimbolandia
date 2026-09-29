/**
 * Felipão: a PESSOA DA FOTO, equipada para batalha (exoesqueleto de guerra por cima da foto).
 * A foto de corpo inteiro é o corpo; a armadura é desenhada em camadas: rack de mísseis, propulsores,
 * tiras + reator no peito e canhões de ombro que giram para mirar.
 */
import { bake, drawSpr, glowSprite, shadedRR, poly, OUT, rrPath, softDot, type Sprite } from './kit';
import { imageToSprite, type Photos } from './photo';
import { PAL } from './palette';
import { shade } from '../core/math';

export const FELI_H = 158; // altura lógica do sprite
const IMG_H = 885;
const K = FELI_H / IMG_H;

export interface FelipaoArt {
  body: Sprite;
  rack: Sprite;
  pod: Sprite;
  straps: Sprite;
  reactor: Sprite;
  cannon: Sprite;
  cannonBroken: Sprite;
  w: number;
  h: number;
  /** pontos em px lógicos relativos ao pé-central (x=0 centro, y=0 chão; y negativo p/ cima) */
  head: [number, number];
  shoulderL: [number, number];
  shoulderR: [number, number];
  reactorPos: [number, number];
  footL: [number, number];
  footR: [number, number];
  rackPos: [number, number];
}

export function bakeFelipao(p: Photos): FelipaoArt {
  const iw = p.felipao.width;
  const ih = p.felipao.height;
  const W = iw * (FELI_H / ih);
  const H = FELI_H;
  const k = FELI_H / ih;
  const body = imageToSprite(p.felipao, W, H, W / 2, H, p.felipao.width / W);
  const at = (x: number, y: number): [number, number] => [x * k - W / 2, y * k - H];
  const F = PAL.foe;

  const rack = bake(
    64,
    30,
    (g) => {
      // rack de mísseis atrás dos ombros (arco com 6 tubos)
      shadedRR(g, 1, 12, 62, 14, 5, '#3a4064');
      for (let i = 0; i < 6; i++) {
        const x = 6 + i * 9.6;
        shadedRR(g, x, 2 + Math.abs(i - 2.5) * 0.6, 8, 15, 2.5, '#59628a', { lw: 1 });
        g.fillStyle = '#150c22';
        g.beginPath();
        g.ellipse(x + 4, 3 + Math.abs(i - 2.5) * 0.6, 3, 1.5, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = F.red;
        g.beginPath();
        g.arc(x + 4, 4 + Math.abs(i - 2.5) * 0.6, 1.1, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = F.orange;
      g.fillRect(4, 20, 56, 2);
    },
    { scale: 3, ox: 32, oy: 24 }
  );

  const pod = bake(
    34,
    16,
    (g) => {
      shadedRR(g, 2, 2, 30, 10, 5, '#4a5074');
      shadedRR(g, 6, 9, 22, 6, 3, '#2c3252');
      g.fillStyle = F.orange;
      g.fillRect(5, 5.6, 24, 1.6);
      g.fillStyle = '#ffffff44';
      for (const x of [8, 26]) {
        g.beginPath();
        g.arc(x, 4, 0.9, 0, Math.PI * 2);
        g.fill();
      }
    },
    { scale: 3, ox: 17, oy: 4 }
  );

  const sw = W;
  const sh = H;
  const straps = bake(
    sw,
    sh,
    (g) => {
      // tiras cruzadas no tronco (posição relativa à foto)
      const [lx, ly] = [45 * k, 230 * k];
      const [rx, ry] = [480 * k, 190 * k];
      const [hx, hy] = [140 * k, 560 * k];
      const [ix, iy] = [420 * k, 560 * k];
      g.lineCap = 'round';
      g.strokeStyle = OUT;
      g.lineWidth = 8;
      g.beginPath();
      g.moveTo(lx, ly + 6);
      g.quadraticCurveTo((lx + ix) / 2 + 4, (ly + iy) / 2 + 12, ix, iy);
      g.stroke();
      g.beginPath();
      g.moveTo(rx - 4, ry + 8);
      g.quadraticCurveTo((rx + hx) / 2, (ry + hy) / 2 + 16, hx, hy);
      g.stroke();
      g.strokeStyle = '#c44a1e';
      g.lineWidth = 5.4;
      g.beginPath();
      g.moveTo(lx, ly + 6);
      g.quadraticCurveTo((lx + ix) / 2 + 4, (ly + iy) / 2 + 12, ix, iy);
      g.stroke();
      g.beginPath();
      g.moveTo(rx - 4, ry + 8);
      g.quadraticCurveTo((rx + hx) / 2, (ry + hy) / 2 + 16, hx, hy);
      g.stroke();
      g.strokeStyle = '#ffb35a';
      g.lineWidth = 1;
      g.setLineDash([3, 4]);
      g.beginPath();
      g.moveTo(lx, ly + 6);
      g.quadraticCurveTo((lx + ix) / 2 + 4, (ly + iy) / 2 + 12, ix, iy);
      g.stroke();
      g.beginPath();
      g.moveTo(rx - 4, ry + 8);
      g.quadraticCurveTo((rx + hx) / 2, (ry + hy) / 2 + 16, hx, hy);
      g.stroke();
      g.setLineDash([]);
      // cinto-armadura na cintura (por cima do short)
      shadedRR(g, 100 * k, 520 * k, 360 * k, 34 * k, 6, '#3a4064', { lw: 1.2 });
      g.fillStyle = F.orange;
      g.fillRect(110 * k, 530 * k, 340 * k, 4);
      // ombreiras
      shadedRR(g, lx - 14, ly - 6, 26, 20, 7, '#59628a');
      shadedRR(g, rx - 12, ry - 8, 26, 20, 7, '#59628a');
      g.fillStyle = F.orange;
      g.fillRect(lx - 10, ly + 2, 18, 2.4);
      g.fillRect(rx - 8, ry, 18, 2.4);
    },
    { scale: 3, ox: sw / 2, oy: sh }
  );

  const reactor = bake(
    30,
    30,
    (g) => {
      shadedRR(g, 2, 2, 26, 26, 11, '#3a4064', { lw: 1.6 });
      g.beginPath();
      g.arc(15, 15, 9, 0, Math.PI * 2);
      g.fillStyle = '#150c22';
      g.fill();
      g.beginPath();
      g.arc(15, 15, 7, 0, Math.PI * 2);
      const gr = g.createRadialGradient(13, 13, 1, 15, 15, 8);
      gr.addColorStop(0, '#fff8d8');
      gr.addColorStop(0.5, '#ffb83a');
      gr.addColorStop(1, '#e2501a');
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = '#ffffff55';
      g.lineWidth = 0.8;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.beginPath();
        g.moveTo(15 + Math.cos(a) * 9.6, 15 + Math.sin(a) * 9.6);
        g.lineTo(15 + Math.cos(a) * 12.4, 15 + Math.sin(a) * 12.4);
        g.stroke();
      }
    },
    { scale: 3, ox: 15, oy: 15 }
  );

  const mkCannon = (broken: boolean) =>
    bake(
      50,
      24,
      (g) => {
        shadedRR(g, 0.5, 4, 22, 17, 6, broken ? '#4a3a44' : '#59628a');
        shadedRR(g, 18, 6, 30, 12, 3, broken ? '#2c2430' : '#3a4064');
        shadedRR(g, 43, 4.4, 6.4, 15, 2, '#252a45');
        g.fillStyle = broken ? '#7a3a2a' : F.orange;
        g.fillRect(24, 8.4, 3.2, 7);
        g.fillStyle = '#0c0816';
        g.fillRect(47.6, 9.6, 1.6, 4.8);
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.fillRect(4, 5, 16, 2);
        if (broken) {
          poly(g, [[8, 4], [14, 10], [10, 12]], '#150c22', { outline: null });
          g.strokeStyle = '#ffb347';
          g.lineWidth = 0.9;
          g.beginPath();
          g.moveTo(12, 6);
          g.lineTo(18, 13);
          g.stroke();
        }
      },
      { scale: 3, ox: 9, oy: 12 }
    );

  return {
    body, rack, pod, straps, reactor, cannon: mkCannon(false), cannonBroken: mkCannon(true), w: W, h: H,
    head: at(301, 90),
    shoulderL: at(48, 225),
    shoulderR: at(478, 140),
    reactorPos: at(282, 400),
    footL: at(129, 860),
    footR: at(473, 868),
    rackPos: at(300, 118),
  };
}

export interface FPose {
  facing: 1 | -1;
  t: number;
  flash: boolean;
  alpha: number;
  lean: number; // rad, + = para frente (facing)
  squashY: number; // 1 = normal
  aimL: number; // ângulo mundo do canhão esquerdo (tela)
  aimR: number;
  charge: number; // 0..1 brilho das armas
  reactor: number; // 0..1
  phase: 1 | 2 | 3;
  thrust: number; // 0..1 chama dos propulsores
  rackOpen: number; // 0..1
  hover: number; // altura acima do chão (px)
  taunt: number; // 0..1 pulsa (rugido)
  shake: number;
  hp01: number;
  kickL: number;
  kickR: number;
}

export function drawFelipao(g: CanvasRenderingContext2D, a: FelipaoArt, x: number, feetY: number, p: FPose) {
  if (p.alpha <= 0.01) return;
  const prevA = g.globalAlpha;
  g.globalAlpha = prevA * p.alpha;
  // sombra no chão (fixa no chão, não acompanha o hover)
  {
    const sh = softDot('#000000', 16);
    const s = 1 - Math.min(0.5, p.hover / 220);
    g.globalAlpha = prevA * p.alpha * 0.5 * s;
    g.drawImage(sh.c, x - 62 * s, feetY - 6, 124 * s, 14);
    g.globalAlpha = prevA * p.alpha;
  }
  const bob = Math.sin(p.t * 2.2) * 2.4;
  const sx = (Math.random() - 0.5) * p.shake;
  const sy = (Math.random() - 0.5) * p.shake;
  const gy = feetY - p.hover - 4 + bob * 0.5;

  g.save();
  g.translate(x + sx, gy + sy);
  if (p.facing === -1) g.scale(-1, 1);
  const taunt = 1 + p.taunt * 0.045 * Math.sin(p.t * 40);
  g.rotate(p.lean);
  g.scale(taunt, p.squashY * taunt);
  const w = p.flash;

  // propulsores nos pés (com chama)
  for (const [fx, fy] of [a.footL, a.footR]) {
    if (p.thrust > 0.02) {
      const spr = glowSprite('#ffb347', 32);
      g.globalCompositeOperation = 'lighter';
      const len = 22 + p.thrust * 26 + Math.sin(p.t * 45) * 3;
      g.globalAlpha = prevA * p.alpha * (0.5 + p.thrust * 0.5);
      g.drawImage(spr.c, fx - 13, fy - 2, 26, len);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = prevA * p.alpha;
    }
    drawSpr(g, a.pod, fx, fy + 2, { white: w });
  }
  // rack de mísseis (atrás)
  drawSpr(g, a.rack, a.rackPos[0], a.rackPos[1] - p.rackOpen * 4, { white: w, sy: 1 + p.rackOpen * 0.1 });

  // corpo (foto)
  drawSpr(g, a.body, 0, 0, { white: w });
  drawSpr(g, a.straps, 0, 0, { white: w });
  // reator do peito
  {
    const [rx, ry] = a.reactorPos;
    const pulse = 0.6 + 0.4 * Math.sin(p.t * (4 + p.reactor * 10));
    const glow = glowSprite(p.phase === 3 && Math.sin(p.t * 30) > 0.7 ? '#ff5a3a' : '#ffb83a', 32);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = prevA * p.alpha * (0.35 + 0.5 * p.reactor + 0.15 * pulse);
    const r = 20 + p.reactor * 16;
    g.drawImage(glow.c, rx - r, ry - r, r * 2, r * 2);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = prevA * p.alpha;
    drawSpr(g, a.reactor, rx, ry, { white: w, sx: 1 + p.reactor * 0.12, sy: 1 + p.reactor * 0.12 });
  }
  // canhões de ombro
  const cannonFor = (pos: [number, number], aim: number, kick: number) => {
    g.save();
    g.translate(pos[0], pos[1]);
    // no espaço local (possivelmente espelhado) o ângulo tem que ser convertido
    let ang = p.facing === 1 ? aim : Math.PI - aim;
    ang -= p.lean * (p.facing === 1 ? 1 : -1) * 0;
    ang = Math.max(-Math.PI * 0.95, Math.min(Math.PI * 0.95, ang));
    g.rotate(ang);
    drawSpr(g, p.phase >= 2 && pos === a.shoulderR ? a.cannonBroken : a.cannon, -kick * 5, 0, { white: w });
    if (p.charge > 0.03) {
      const spr = glowSprite('#ffb347', 24);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = prevA * p.alpha * p.charge;
      g.drawImage(spr.c, 36, -10, 20, 20);
    }
    g.restore();
  };
  // (com o espelhamento, o canhão "esquerdo" da arte fica no lado oposto — trocamos os alvos)
  cannonFor(a.shoulderL, p.facing === 1 ? p.aimL : p.aimR, p.facing === 1 ? p.kickL : p.kickR);
  cannonFor(a.shoulderR, p.facing === 1 ? p.aimR : p.aimL, p.facing === 1 ? p.kickR : p.kickL);

  // danos: fumaça/faíscas nos estágios avançados
  if (p.phase >= 2) {
    g.globalCompositeOperation = 'lighter';
    if (Math.sin(p.t * 17) > 0.75) {
      g.fillStyle = '#ffd27a';
      g.fillRect(a.shoulderR[0] + Math.sin(p.t * 9) * 6, a.shoulderR[1] + 4, 2, 2);
    }
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
  g.globalAlpha = prevA;
  void shade;
  void rrPath;
}
