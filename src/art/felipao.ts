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
const IMG_W = 560; // dimensões do recorte exportado (public/assets/img/felipao.webp)
const IMG_H = 885;
const K = FELI_H / IMG_H;
const LW = IMG_W * K;
const at0 = (x: number, y: number): [number, number] => [x * K - LW / 2, y * K - FELI_H];

/** Pontos de referência do corpo (px lógicos; x=0 no centro, y=0 no chão) — usados pela IA do chefe. */
export const FELI_LAYOUT = {
  head: at0(301, 90),
  shoulderL: at0(48, 225),
  shoulderR: at0(478, 140),
  reactorPos: at0(282, 400),
  footL: at0(129, 860),
  footR: at0(473, 868),
  rackPos: at0(300, 118),
  hipL: at0(190, 640),
  hipR: at0(430, 652),
};

export interface FelipaoArt {
  body: Sprite; // (legado) foto inteira
  upper: Sprite;
  legL: Sprite;
  legR: Sprite;
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
  const upper = imageToSprite(p.felipaoUpper, W, H, W / 2, H, p.felipaoUpper.width / W);
  const legL = imageToSprite(p.felipaoLegL, W, H, W / 2, H, p.felipaoLegL.width / W);
  const legR = imageToSprite(p.felipaoLegR, W, H, W / 2, H, p.felipaoLegR.width / W);
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
    body, upper, legL, legR, rack, pod, straps, reactor, cannon: mkCannon(false), cannonBroken: mkCannon(true), w: W, h: H,
    ...FELI_LAYOUT,
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
  /** virada de lado contínua: 1 = olhando p/ a direita da arte, -1 = esquerda (passa por ~0) */
  faceX: number;
  walk: number; // fase do passo (rad)
  walking: number; // 0..1 quanto está andando
  /** mola da barriga (−0.1..0.1): positivo = achatado (passo/impacto) */
  jiggle?: number;
  /** 0..1 arroto (tronco joga para trás) */
  burp?: number;
  /** 0..1 fúria (fase 3): aura vermelha */
  rage?: number;
}

export function drawFelipao(g: CanvasRenderingContext2D, a: FelipaoArt, x: number, feetY: number, p: FPose) {
  if (p.alpha <= 0.01) return;
  const prevA = g.globalAlpha;
  g.globalAlpha = prevA * p.alpha;
  // sombra no chão (fixa no chão, não acompanha o pulo)
  {
    const sh = softDot('#000000', 16);
    const s = 1 - Math.min(0.5, p.hover / 220);
    g.globalAlpha = prevA * p.alpha * 0.5 * s;
    g.drawImage(sh.c, x - 62 * s, feetY - 6, 124 * s, 14);
    g.globalAlpha = prevA * p.alpha;
  }
  const fa = p.flash ? 0.55 : 0;
  const walk = p.walk;
  const wk = p.walking;
  // ciclo de caminhada: pernas alternadas, corpo sobe/desce e balança
  const sL = Math.sin(walk);
  const sR = -sL;
  const air = p.hover > 4;
  // Suspensão também tem vida: recolhe as pernas na subida e estabiliza no ar.
  const tuck = Math.min(1, p.hover / 100);
  const airborneStep = Math.sin(p.t * 4.2) * 0.07;
  const brace = p.charge * (1 - wk) * 0.08;
  const angL = air ? 0.12 + tuck * 0.27 + airborneStep : sL * 0.43 * wk + brace;
  const angR = air ? -0.1 - tuck * 0.2 - airborneStep : sR * 0.43 * wk - brace;
  const liftL = air ? tuck * 4 : Math.max(0, Math.cos(walk)) * 9 * wk;
  const liftR = air ? tuck * 6 : Math.max(0, -Math.cos(walk)) * 9 * wk;
  const bob = (air ? 0 : -Math.abs(sL) * 4.6 * wk) + Math.sin(p.t * 2.2) * 0.8 * (1 - wk);
  const sway = sL * 0.04 * wk; // peso de um lado para o outro
  // virada de lado: escala horizontal contínua (passa por uma "fatia" fina)
  const fx = Math.abs(p.faceX) < 0.16 ? 0.16 * (p.faceX < 0 ? -1 : 1) : p.faceX;
  const turning = 1 - Math.min(1, Math.abs(p.faceX));
  const gy = feetY - p.hover - (air ? 4 : 0);

  g.save();
  g.translate(x, gy);
  g.scale(fx, 1);
  const w = false;
  const taunt = 1 + p.taunt * 0.045 * Math.sin(p.t * 40);
  g.rotate(p.lean * (fx < 0 ? -1 : 1) * 0 + p.lean);
  g.scale(taunt, p.squashY * taunt * (1 - turning * 0.04));
  const shx = (Math.random() - 0.5) * p.shake;
  const shy = (Math.random() - 0.5) * p.shake;
  g.translate(shx, shy);

  // aura de fúria (fase 3), atrás de tudo
  if ((p.rage ?? 0) > 0.01) {
    const r = p.rage ?? 0;
    const glow = glowSprite('#ff2a2a', 32);
    const pulse = 0.75 + 0.25 * Math.sin(p.t * 7);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = prevA * p.alpha * 0.42 * r * pulse;
    const hh = FELI_H;
    g.drawImage(glow.c, -LW * 0.62, -hh * 1.02, LW * 1.24, hh * 1.1);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = prevA * p.alpha;
  }
  // pernas (atrás do tronco); botas/propulsores acompanham a perna
  const drawLeg = (spr: Sprite, hip: [number, number], foot: [number, number], ang: number, lift: number) => {
    g.save();
    g.translate(hip[0], hip[1] - lift);
    g.rotate(ang);
    g.translate(-hip[0], -hip[1]);
    if (p.thrust > 0.02) {
      const glow = glowSprite('#ffb347', 32);
      g.globalCompositeOperation = 'lighter';
      const len = 20 + p.thrust * 26 + Math.sin(p.t * 45) * 3;
      g.globalAlpha = prevA * p.alpha * (0.5 + p.thrust * 0.5);
      g.drawImage(glow.c, foot[0] - 13, foot[1] - 2, 26, len);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = prevA * p.alpha;
    }
    drawSpr(g, spr, 0, 0, { flash: fa });
    drawSpr(g, a.pod, foot[0], foot[1] + 2, { flash: fa, sx: 0.8, sy: 0.8 });
    g.restore();
  };
  drawLeg(a.legL, FELI_LAYOUT.hipL, FELI_LAYOUT.footL, angL, liftL);
  drawLeg(a.legR, FELI_LAYOUT.hipR, FELI_LAYOUT.footR, angR, liftR);

  // tronco e armadura
  g.save();
  g.translate(0, bob);
  g.translate(FELI_LAYOUT.hipL[0] * 0.5 + FELI_LAYOUT.hipR[0] * 0.5, FELI_LAYOUT.hipL[1]);
  g.rotate(sway - (p.burp ?? 0) * 0.1);
  // barriga com mola (quica a cada passo/impacto) + respiração
  {
    const j = p.jiggle ?? 0;
    const br = Math.sin(p.t * 2.3) * 0.012 * (1 - wk * 0.7);
    const bu = (p.burp ?? 0) * 0.035;
    g.scale(1 + j * 0.55 - br * 0.4, 1 - j + br + bu);
  }
  g.translate(-(FELI_LAYOUT.hipL[0] * 0.5 + FELI_LAYOUT.hipR[0] * 0.5), -FELI_LAYOUT.hipL[1]);

  drawSpr(g, a.rack, a.rackPos[0], a.rackPos[1] - p.rackOpen * 4, { flash: fa, sy: 1 + p.rackOpen * 0.1 });
  drawSpr(g, a.upper, 0, 0, { flash: fa });
  drawSpr(g, a.straps, 0, 0, { flash: fa });
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
    drawSpr(g, a.reactor, rx, ry, { flash: fa, sx: 1 + p.reactor * 0.12, sy: 1 + p.reactor * 0.12 });
  }
  // canhões de ombro
  const cannonFor = (pos: [number, number], aim: number, kick: number, broken: boolean) => {
    g.save();
    g.translate(pos[0], pos[1]);
    let ang = p.facing === 1 ? aim : Math.PI - aim;
    ang = Math.max(-Math.PI * 0.95, Math.min(Math.PI * 0.95, ang));
    g.rotate(ang);
    drawSpr(g, broken ? a.cannonBroken : a.cannon, -kick * 5, 0, { flash: fa });
    if (p.charge > 0.03) {
      const spr = glowSprite('#ffb347', 24);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = prevA * p.alpha * p.charge;
      g.drawImage(spr.c, 36, -10, 20, 20);
    }
    g.restore();
  };
  cannonFor(a.shoulderL, p.facing === 1 ? p.aimL : p.aimR, p.facing === 1 ? p.kickL : p.kickR, false);
  cannonFor(a.shoulderR, p.facing === 1 ? p.aimR : p.aimL, p.facing === 1 ? p.kickR : p.kickL, p.phase >= 2);
  if (p.phase >= 2) {
    g.globalCompositeOperation = 'lighter';
    if (Math.sin(p.t * 17) > 0.75) {
      g.fillStyle = '#ffd27a';
      g.fillRect(a.shoulderR[0] + Math.sin(p.t * 9) * 6, a.shoulderR[1] + 4, 2, 2);
    }
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
  g.restore();
  g.globalAlpha = prevA;
  void shade;
  void rrPath;
  void w;
}
