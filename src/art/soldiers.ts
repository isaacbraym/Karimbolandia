/** Soldados da Legião: rig de peças baked em 5 estilos (rifle, shotgun, escudo, jetpack, sniper). */
import { bake, drawSpr, glowSprite, shadedRR, shadedEllipse, poly, OUT, rrPath, type Sprite } from './kit';
import { PAL } from './palette';
import { shade } from '../core/math';
import { WEAPONS } from '../game/weapons';

export type SoldierStyle = 'rifle' | 'shotgun' | 'shield' | 'jetpack' | 'sniper';

export interface SoldierArt {
  head: Sprite;
  torso: Sprite;
  legF: Sprite;
  legB: Sprite;
  armF: Sprite;
  armB: Sprite;
  gun: Sprite;
  extra: Sprite | null; // mochila / escudo
  gunLen: number;
  gunGrip: number;
}

const S = 2;

interface StyleDef {
  armor: string;
  armorDark: string;
  trim: string;
  visor: string;
  cloth: string;
  boot: string;
  helm: string;
}

const STYLES: Record<SoldierStyle, StyleDef> = {
  rifle: { armor: '#b13a8c', armorDark: '#6e2358', trim: '#ff8a2a', visor: '#ff6a2a', cloth: '#3a2a5a', boot: '#241a3a', helm: '#5a2f8a' },
  shotgun: { armor: '#e0552a', armorDark: '#8a2f18', trim: '#ffd23a', visor: '#ffe27a', cloth: '#3b2a2a', boot: '#251a1a', helm: '#7a2a1a' },
  shield: { armor: '#2f4fb0', armorDark: '#1c2f70', trim: '#7ff9ff', visor: '#7ff9ff', cloth: '#1c2244', boot: '#141a33', helm: '#26397f' },
  jetpack: { armor: '#3d8a9a', armorDark: '#245560', trim: '#ffd23a', visor: '#ff8ad4', cloth: '#22303a', boot: '#161f28', helm: '#2b6572' },
  sniper: { armor: '#3d6a52', armorDark: '#23402f', trim: '#e2384a', visor: '#ff4a4a', cloth: '#1c2a24', boot: '#121a16', helm: '#25402f' },
};

export function bakeSoldier(style: SoldierStyle): SoldierArt {
  const d = STYLES[style];
  const head = bake(
    22,
    22,
    (g) => {
      // capacete
      g.beginPath();
      g.ellipse(11, 11.5, 9.2, 9.6, 0, 0, Math.PI * 2);
      g.fillStyle = shade(d.helm, 0.0);
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = OUT;
      g.stroke();
      // brilho
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath();
      g.ellipse(8.6, 6.4, 4.6, 2.4, -0.4, 0, Math.PI * 2);
      g.fill();
      if (style === 'sniper') {
        // capuz + faixa
        poly(g, [[2, 12], [6, 3], [16, 3], [20, 12], [16, 9], [6, 9]], shade(d.helm, -0.15));
      }
      // viseira (voltada p/ a frente = +x)
      g.save();
      rrPath(g, 9.4, 8.2, 11, style === 'jetpack' ? 6 : 5.2, 2.6);
      g.fillStyle = '#120c26';
      g.fill();
      g.clip();
      g.fillStyle = d.visor;
      g.globalAlpha = 0.95;
      g.fillRect(11, 9.2, 9, style === 'jetpack' ? 3.4 : 2.6);
      g.globalAlpha = 0.5;
      g.fillStyle = '#ffffff';
      g.fillRect(11.4, 9.4, 3, 1);
      g.restore();
      rrPath(g, 9.4, 8.2, 11, style === 'jetpack' ? 6 : 5.2, 2.6);
      g.lineWidth = 0.9;
      g.strokeStyle = OUT;
      g.stroke();
      // detalhe frontal (respirador)
      if (style === 'shotgun') {
        shadedRR(g, 12, 13.6, 8, 4.4, 1.5, '#3b2a2a', { lw: 0.8 });
      }
      // antena / crista
      if (style === 'rifle') {
        g.strokeStyle = d.trim;
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(5, 3);
        g.lineTo(2, -0.5);
        g.stroke();
      }
    },
    { scale: S, ox: 11, oy: 17 }
  );

  const torso = bake(
    22,
    22,
    (g) => {
      const wide = style === 'shotgun' ? 1 : 0;
      shadedRR(g, 3 - wide, 2, 16 + wide * 2, 19, 4.4, d.armor);
      // peitoral
      shadedRR(g, 5, 3.6, 12, 9, 3, shade(d.armor, 0.12), { lw: 0.9 });
      g.fillStyle = d.trim;
      g.fillRect(9.6, 4.6, 2.8, 6);
      // cinto
      shadedRR(g, 3, 16.6, 16, 4, 1.4, d.armorDark, { lw: 1 });
      g.fillStyle = d.trim;
      g.fillRect(9.4, 17.2, 3.2, 2.8);
      if (style === 'shotgun') {
        // ombreiras grandes
        shadedRR(g, 0.4, 1.4, 7, 6.4, 2.6, d.armorDark);
        shadedRR(g, 14.6, 1.4, 7, 6.4, 2.6, d.armorDark);
        g.fillStyle = d.trim;
        g.fillRect(2, 6.6, 4, 1.2);
      }
      if (style === 'sniper') {
        // bandoleira
        g.strokeStyle = '#191510';
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(4, 3);
        g.lineTo(18, 17);
        g.stroke();
        g.fillStyle = d.trim;
        g.fillRect(10, 9, 2, 2);
      }
    },
    { scale: S, ox: 11, oy: 22 }
  );

  const legF = bake(
    10,
    17,
    (g) => {
      shadedRR(g, 1.5, 0, 7, 12, 2.4, d.cloth);
      shadedRR(g, 2.4, 6, 5.2, 3.2, 1.2, d.armor, { lw: 0.7 });
      shadedRR(g, 0.4, 10.6, 9.6, 6.2, 2.2, d.boot);
      g.fillStyle = d.trim;
      g.fillRect(1, 11.4, 8, 1);
    },
    { scale: S, ox: 5, oy: 1 }
  );
  const legB = bake(
    10,
    17,
    (g) => {
      shadedRR(g, 1.5, 0, 7, 12, 2.4, shade(d.cloth, -0.2));
      shadedRR(g, 0.4, 10.6, 9.6, 6.2, 2.2, shade(d.boot, -0.15));
    },
    { scale: S, ox: 5, oy: 1 }
  );
  const mkArm = (dark: boolean) =>
    bake(
      17,
      8,
      (g) => {
        const a = dark ? shade(d.armor, -0.25) : d.armor;
        shadedRR(g, 0.4, 0.6, 8, 6.8, 3, a);
        shadedRR(g, 7, 1.6, 6, 4.8, 2, dark ? shade(d.cloth, -0.1) : d.cloth);
        shadedRR(g, 11.4, 1.4, 5, 5.2, 2, '#1b1424');
      },
      { scale: S, ox: 3, oy: 4 }
    );

  // arma (mesma família visual do jogador, cores da Legião)
  const gunDef = style === 'shotgun' ? WEAPONS.shotgun : style === 'sniper' ? WEAPONS.rifle : WEAPONS.rifle;
  const gunLen = style === 'sniper' ? 34 : style === 'shotgun' ? 24 : 22;
  const gun = bake(
    gunLen + 6,
    11,
    (g) => {
      if (style === 'sniper') {
        shadedRR(g, 0.5, 3.4, 9, 4.4, 1.4, '#2a2a34');
        shadedRR(g, 8, 3.2, 20, 3.6, 1.2, '#3a3a48');
        shadedRR(g, 26, 3.8, 9, 2.2, 1, '#22222c');
        shadedRR(g, 12, 0.8, 9, 3, 1.2, '#15151c');
        g.fillStyle = d.visor;
        g.fillRect(20, 1.6, 1.6, 1.2);
      } else if (style === 'shotgun') {
        shadedRR(g, 0.5, 3.6, 7, 4.2, 1.4, '#5a3a2a');
        shadedRR(g, 6, 3.2, 8, 4.6, 1.2, '#3b2a2a');
        shadedRR(g, 14, 3, 12, 2.4, 1, '#666a80');
        shadedRR(g, 14, 5.2, 12, 2.4, 1, '#4a4e64');
        g.fillStyle = d.trim;
        g.fillRect(7, 2, 4, 1.2);
      } else {
        shadedRR(g, 0.5, 3.6, 7, 4.4, 1.4, '#2b2440');
        shadedRR(g, 6.4, 3, 12, 5, 1.4, '#3f3a63');
        shadedRR(g, 17, 3.8, 6, 2.4, 1, '#25203c');
        shadedRR(g, 11, 7.6, 3.4, 3.2, 1, '#1b1730');
        g.fillStyle = d.trim;
        g.fillRect(8, 2.2, 5, 1);
      }
    },
    { scale: S, ox: 6, oy: 5.4 }
  );

  let extra: Sprite | null = null;
  if (style === 'jetpack') {
    extra = bake(
      14,
      20,
      (g) => {
        shadedRR(g, 1, 1, 12, 15, 3, '#4a5a6a');
        shadedRR(g, 1.6, 12, 4.4, 6.4, 1.6, '#2b333d');
        shadedRR(g, 8, 12, 4.4, 6.4, 1.6, '#2b333d');
        g.fillStyle = d.trim;
        g.fillRect(3, 3, 8, 1.4);
        g.fillRect(3, 6, 8, 1.4);
      },
      { scale: S, ox: 12, oy: 3 }
    );
  } else if (style === 'shield') {
    extra = bake(
      16,
      40,
      (g) => {
        // escudo antitumulto: placa curva com brilho energético
        g.beginPath();
        g.moveTo(3, 1);
        g.quadraticCurveTo(15, 3, 15, 20);
        g.quadraticCurveTo(15, 37, 3, 39);
        g.closePath();
        g.fillStyle = 'rgba(80,200,255,0.30)';
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = '#7ff9ff';
        g.stroke();
        g.lineWidth = 0.7;
        g.strokeStyle = 'rgba(255,255,255,0.6)';
        for (let y = 6; y < 36; y += 6) {
          g.beginPath();
          g.moveTo(5, y);
          g.lineTo(13.5, y + 2);
          g.stroke();
        }
        g.strokeStyle = OUT;
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(3, 1);
        g.quadraticCurveTo(15, 3, 15, 20);
        g.quadraticCurveTo(15, 37, 3, 39);
        g.stroke();
        // haste central
        shadedRR(g, 1.5, 16, 3.6, 8, 1, '#1c2f70', { lw: 0.8 });
      },
      { scale: S, ox: 2, oy: 34 }
    );
  }

  return { head, torso, legF, legB, armF: mkArm(false), armB: mkArm(true), gun, extra, gunLen, gunGrip: 6 };
  void gunDef;
}

// ------------------------------------------------------------------------------------------
export type SState = 'idle' | 'run' | 'crouch' | 'jump' | 'hurt' | 'bash' | 'fly';

export interface SPose {
  facing: 1 | -1;
  state: SState;
  t: number;
  runPhase: number;
  aim: number;
  aiming: boolean; // arma erguida
  flash: boolean;
  alpha: number;
  kick: number;
  charge: number; // 0..1 telegrafo (brilho na arma)
  shieldUp?: boolean;
  jet?: number; // 0..1 chama do jetpack
  rot?: number;
  style: SoldierStyle;
  squash?: number;
}

const SHOULDER: [number, number] = [2.2, -27];

export function soldierMuzzle(facing: 1 | -1, aim: number, art: SoldierArt, crouch: boolean, kick = 0): [number, number] {
  let a = facing === 1 ? aim : Math.PI - aim;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  a = Math.max(-Math.PI * 0.6, Math.min(Math.PI * 0.6, a));
  const sy = SHOULDER[1] + (crouch ? 9 : 0);
  const d = 12 + art.gunLen - 6 - kick * 2.6;
  return [(SHOULDER[0] + Math.cos(a) * d) * facing, sy + Math.sin(a) * d - 0.4];
}

export function drawSoldier(g: CanvasRenderingContext2D, art: SoldierArt, x: number, y: number, p: SPose) {
  if (p.alpha <= 0.01) return;
  const prevA = g.globalAlpha;
  g.globalAlpha = prevA * p.alpha;
  g.save();
  g.translate(x, y);
  if (p.facing === -1) g.scale(-1, 1);
  if (p.rot) g.rotate(p.rot);
  const w = p.flash;
  const running = p.state === 'run';
  const crouch = p.state === 'crouch';
  const fly = p.state === 'fly';
  const c = p.runPhase;
  const bob = running ? -Math.abs(Math.sin(c)) * 1.5 : p.state === 'idle' ? Math.sin(p.t * 2.6) * 0.4 : 0;
  let legF = 0;
  let legB = 0;
  let hipY = -13;
  let drop = 0;
  let legSy = 1;
  if (running) {
    legF = Math.sin(c) * 0.9;
    legB = -legF;
  } else if (p.state === 'jump') {
    legF = 0.7;
    legB = -0.4;
  } else if (fly) {
    legF = 0.25 + Math.sin(p.t * 8) * 0.06;
    legB = -0.2;
  } else if (crouch) {
    legF = 0.7;
    legB = -0.65;
    legSy = 0.62;
    hipY = -8;
    drop = 9;
  } else if (p.state === 'hurt') {
    legF = 0.5;
    legB = -0.5;
  }
  const S0 = art;
  const sx = SHOULDER[0];
  const sy = SHOULDER[1] + drop + bob;

  // extras atrás (mochila jet)
  if (S0.extra && p.style === 'jetpack') {
    drawSpr(g, S0.extra, -6, -26 + drop + bob, { white: w });
    if ((p.jet ?? 0) > 0.02) {
      const j = p.jet ?? 0;
      g.globalCompositeOperation = 'lighter';
      const spr = glowSprite('#ffb347', 24);
      for (const ox of [-8.5, -3.6]) {
        const len = 12 + j * 10 + Math.sin(p.t * 40 + ox) * 2;
        g.globalAlpha = prevA * p.alpha * (0.6 + 0.4 * j);
        g.drawImage(spr.c, ox - 4, -10 + drop + bob, 8, len);
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = prevA * p.alpha;
    }
  }
  // braço de trás
  drawSpr(g, S0.armB, sx - 4.5, sy + 0.5, { rot: p.aiming ? 0.15 : 1.0 + Math.sin(c) * (running ? 0.5 : 0), white: w });
  drawSpr(g, S0.legB, -2, hipY + bob * 0.5, { rot: legB, sy: legSy, white: w });
  drawSpr(g, S0.torso, 0, -13 + drop + bob, { white: w, rot: running ? 0.07 : 0 });
  drawSpr(g, S0.legF, 2, hipY + bob * 0.5, { rot: legF, sy: legSy, white: w });
  drawSpr(g, S0.head, 1.4, -26 + drop + bob * 1.1, { white: w, rot: p.state === 'hurt' ? -0.25 : 0 });

  // braço da frente + arma
  let a = p.facing === 1 ? p.aim : Math.PI - p.aim;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  a = Math.max(-Math.PI * 0.6, Math.min(Math.PI * 0.6, a));
  if (!p.aiming) a = 0.55;
  g.save();
  g.translate(sx, sy);
  g.rotate(a);
  drawSpr(g, S0.armF, 0, 0, { white: w });
  const kx = 11 - p.kick * 2.6;
  drawSpr(g, S0.gun, kx, 0.4, { white: w });
  if (p.charge > 0.05) {
    // brilho de "carregando" na boca
    const spr = glowSprite(p.style === 'sniper' ? '#ff4a4a' : '#ffb347', 24);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = prevA * p.alpha * p.charge;
    const gx = kx + S0.gunLen - 6;
    g.drawImage(spr.c, gx - 6, -6, 12, 12);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = prevA * p.alpha;
  }
  g.restore();

  // escudo
  if (S0.extra && p.style === 'shield') {
    const up = p.shieldUp !== false;
    g.save();
    g.translate(11 + (p.state === 'bash' ? 6 : 0), -8 + drop + bob);
    if (!up) g.rotate(0.9), g.translate(-2, 9);
    drawSpr(g, S0.extra, 0, 0, { white: w, alpha: up ? 1 : 0.8 });
    g.restore();
  }
  g.restore();
  g.globalAlpha = prevA;
}

void shadedEllipse;
void PAL;
