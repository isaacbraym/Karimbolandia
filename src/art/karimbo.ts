/**
 * Karimbo: corpo procedural "chibi" + CABEÇA FOTOGRÁFICA (a pessoa da foto), com a MESMA roupa da foto:
 * camiseta bege, barriguinha, shorts e papete. Rig: pernas, shorts, tronco, braços, cabeça + orelhas.
 * O rosto é sempre desenhado por último (nada cobre a cara); as orelhas são camadas próprias.
 */
import { bake, drawSpr, glowSprite, OUT, rrPath, shadedRR, type Sprite } from './kit';
import { PAL } from './palette';
import { shade } from '../core/math';
import type { KarimboHeads } from './photo';
import { WEAPONS, type WeaponId } from '../game/weapons';

export interface KarimboArt {
  torso: Sprite;
  shorts: Sprite;
  legFront: Sprite;
  legBack: Sprite;
  armFront: Sprite;
  armBack: Sprite;
  weapons: Record<WeaponId, Sprite>;
  heads: KarimboHeads;
}

const S = 3;
const SHIRT = '#d2b892'; // camiseta bege da foto
const SKIN = '#c98a66';
const SHORTS = '#3b4763';

export function bakeKarimbo(heads: KarimboHeads): KarimboArt {
  // ---------------------------------------------------------------- tronco (camiseta + barriguinha)
  const torso = bake(
    28,
    20,
    (g) => {
      const path = () => {
        g.beginPath();
        g.moveTo(8, 1.2);
        g.quadraticCurveTo(14, 0, 20, 1.2); // ombros
        g.bezierCurveTo(24.5, 3.5, 26.6, 9, 25.6, 13); // lado direito → barriga
        g.bezierCurveTo(25, 16.6, 23, 18.8, 20, 19.2); // barriga → barra
        g.lineTo(8, 19.2);
        g.bezierCurveTo(5, 18.8, 3, 16.6, 2.4, 13);
        g.bezierCurveTo(1.4, 9, 3.5, 3.5, 8, 1.2);
        g.closePath();
      };
      path();
      const gr = g.createLinearGradient(0, 0, 0, 20);
      gr.addColorStop(0, shade(SHIRT, 0.12));
      gr.addColorStop(0.55, SHIRT);
      gr.addColorStop(1, shade(SHIRT, -0.2));
      g.fillStyle = gr;
      g.fill();
      // sombra do lado direito + brilho da barriga
      g.save();
      path();
      g.clip();
      g.fillStyle = 'rgba(80,50,20,0.16)';
      g.fillRect(18, 0, 10, 20);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath();
      g.ellipse(9, 11.5, 3.2, 5.6, 0.15, 0, Math.PI * 2);
      g.fill();
      // dobras da barriga e barra da camiseta
      g.strokeStyle = 'rgba(90,60,30,0.32)';
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(6, 15.5);
      g.quadraticCurveTo(14, 17.6, 22, 15.5);
      g.moveTo(9, 6);
      g.quadraticCurveTo(11, 9, 8.6, 12);
      g.stroke();
      g.restore();
      path();
      g.lineWidth = 1.2;
      g.strokeStyle = OUT;
      g.stroke();
      // gola em V (pele)
      g.beginPath();
      g.moveTo(10.4, 1);
      g.lineTo(17.6, 1);
      g.lineTo(14, 6.4);
      g.closePath();
      g.fillStyle = shade(SKIN, -0.1);
      g.fill();
      g.strokeStyle = shade(SHIRT, -0.4);
      g.lineWidth = 0.9;
      g.stroke();
    },
    { scale: S, ox: 14, oy: 20 }
  );

  // ---------------------------------------------------------------- shorts
  const shorts = bake(
    24,
    11,
    (g) => {
      shadedRR(g, 1.5, 0.6, 21, 9.6, 3, SHORTS);
      g.fillStyle = shade(SHORTS, -0.35);
      g.fillRect(2.4, 1.4, 19.2, 1.6); // cós
      g.strokeStyle = shade(SHORTS, -0.4);
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(12, 3);
      g.lineTo(12, 10); // costura central
      g.stroke();
      shadedRR(g, 3.6, 4.4, 4.6, 3.6, 1, shade(SHORTS, 0.12), { lw: 0.7 }); // bolso
      shadedRR(g, 15.8, 4.4, 4.6, 3.6, 1, shade(SHORTS, 0.12), { lw: 0.7 });
    },
    { scale: S, ox: 12, oy: 1 }
  );

  // ---------------------------------------------------------------- pernas (pele) + papete
  const mkLeg = (dark: boolean) =>
    bake(
      11,
      19,
      (g) => {
        const sk = dark ? shade(SKIN, -0.2) : SKIN;
        shadedRR(g, 2.2, 0, 6.2, 14, 2.6, sk);
        g.fillStyle = 'rgba(255,255,255,0.16)';
        g.fillRect(3, 1, 1.6, 10);
        // pé + dedos aparecendo (papete)
        g.beginPath();
        g.ellipse(7.6, 15.8, 2.6, 1.8, 0, 0, Math.PI * 2);
        g.fillStyle = sk;
        g.fill();
        g.strokeStyle = OUT;
        g.lineWidth = 0.9;
        g.stroke();
        // solado
        shadedRR(g, 0.4, 16.2, 10.4, 2.5, 1.2, dark ? '#221c28' : '#2b2430', { lw: 0.9, shine: false });
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(1.6, 16.6, 8, 0.6);
        // tiras da papete
        shadedRR(g, 1.4, 13.4, 6.2, 1.7, 0.8, '#3a3040', { lw: 0.7, shine: false });
        shadedRR(g, 0.6, 14.8, 3.2, 1.6, 0.8, '#3a3040', { lw: 0.7, shine: false });
        rrPath(g, 2.2, 0, 6.2, 14, 2.6);
        g.lineWidth = 1;
        g.strokeStyle = OUT;
        g.stroke();
      },
      { scale: S, ox: 5.5, oy: 1 }
    );
  const legFront = mkLeg(false);
  const legBack = mkLeg(true);

  // ---------------------------------------------------------------- braços: manga bege + antebraço de pele
  const mkArm = (dark: boolean) =>
    bake(
      19,
      8,
      (g) => {
        const sl = dark ? shade(SHIRT, -0.22) : SHIRT;
        const sk = dark ? shade(SKIN, -0.2) : SKIN;
        shadedRR(g, 4.6, 1.8, 8.6, 4.6, 2.2, sk);
        shadedRR(g, 0.4, 0.5, 6.6, 7, 3, sl);
        g.fillStyle = shade(sl, -0.3);
        g.fillRect(5.8, 1, 1.1, 6); // barra da manga
        g.beginPath();
        g.arc(14.6, 4.1, 2.7, 0, Math.PI * 2);
        g.fillStyle = sk;
        g.fill();
        g.strokeStyle = OUT;
        g.lineWidth = 0.9;
        g.stroke();
      },
      { scale: S, ox: 3, oy: 4 }
    );

  return { torso, shorts, legFront, legBack, armFront: mkArm(false), armBack: mkArm(true), weapons: bakeWeapons(), heads };
}

export function bakeWeapons(): Record<WeaponId, Sprite> {
  const w = {} as Record<WeaponId, Sprite>;
  // grip fica em (4, 5) — apontando para +x
  w.pistol = bake(
    16,
    10,
    (g) => {
      shadedRR(g, 1.5, 4, 5, 5.5, 1.2, '#3a3350');
      shadedRR(g, 2, 1.6, 12, 4.4, 1.3, '#59567a');
      g.fillStyle = PAL.neonAmber;
      g.fillRect(13, 2, 1.6, 1.3);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(3, 2.2, 8, 0.9);
    },
    { scale: S, ox: 4, oy: 5.5 }
  );
  w.rifle = bake(
    30,
    11,
    (g) => {
      shadedRR(g, 0.5, 3.4, 8, 4.6, 1.5, '#4a3b34');
      shadedRR(g, 7, 2.6, 15, 5, 1.4, '#3f4560');
      shadedRR(g, 21, 3.6, 8, 2.4, 1, '#2a2d40');
      shadedRR(g, 12, 6.8, 4, 4, 1, '#252838');
      shadedRR(g, 10, 0.8, 5, 2.4, 1, '#1a1c2b');
      g.fillStyle = PAL.foe.red;
      g.fillRect(12, 1.3, 1.4, 1.2);
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(8, 3, 12, 0.9);
    },
    { scale: S, ox: 8, oy: 5 }
  );
  w.shotgun = bake(
    31,
    11,
    (g) => {
      shadedRR(g, 0.5, 3.6, 8, 4.4, 1.5, '#7a4a2c');
      shadedRR(g, 7, 3.4, 10, 4.6, 1.2, '#3d4058');
      shadedRR(g, 8.5, 7, 7, 2.8, 1, '#a35d33');
      shadedRR(g, 16, 2.6, 14.5, 2.4, 1, '#565a78');
      shadedRR(g, 16, 5, 14.5, 2.4, 1, '#3d4058');
      g.fillStyle = PAL.neonAmber;
      g.fillRect(9, 2, 4.5, 1.2);
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(17, 3, 11, 0.7);
    },
    { scale: S, ox: 8, oy: 5.5 }
  );
  w.launcher = bake(
    32,
    14,
    (g) => {
      shadedRR(g, 0.5, 5, 7, 5.6, 1.6, '#3b4a3a');
      shadedRR(g, 6, 3, 21, 8, 2.6, '#5f8a4a');
      shadedRR(g, 24.5, 1.8, 7, 10.4, 2, '#3c5a30');
      g.fillStyle = '#ffd23a';
      g.fillRect(14, 3, 3, 8);
      g.fillStyle = '#0d1a0d';
      g.beginPath();
      g.ellipse(31, 7, 1.4, 3.6, 0, 0, Math.PI * 2);
      g.fill();
      shadedRR(g, 10, 10.4, 5, 3.4, 1, '#2d3a2b');
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(8, 3.6, 15, 1);
    },
    { scale: S, ox: 8, oy: 7 }
  );
  w.energy = bake(
    28,
    12,
    (g) => {
      g.beginPath();
      g.moveTo(1, 5);
      g.lineTo(8, 2.6);
      g.lineTo(22, 2.6);
      g.lineTo(27.5, 5.4);
      g.lineTo(22, 8.4);
      g.lineTo(9, 8.4);
      g.lineTo(4, 10.5);
      g.lineTo(2, 9);
      g.closePath();
      g.fillStyle = '#e9f6ff';
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 1;
      g.stroke();
      rrPath(g, 9, 3.6, 12, 3.6, 1.6);
      g.fillStyle = '#12c9ff';
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillRect(10, 4.2, 9, 1);
      g.fillStyle = PAL.neonCyan;
      g.beginPath();
      g.arc(26.5, 5.3, 1.6, 0, Math.PI * 2);
      g.fill();
    },
    { scale: S, ox: 6, oy: 6 }
  );
  return w;
}

// ------------------------------------------------------------------------------------------
export type KState = 'idle' | 'run' | 'jump' | 'fall' | 'glide' | 'crouch' | 'hurt';

export interface KPose {
  facing: 1 | -1;
  state: KState;
  t: number; // relógio de animação
  runPhase: number; // fase do ciclo de corrida (rad)
  speed01: number;
  aim: number; // ângulo de mira (mundo, rad)
  weapon: WeaponId;
  kick: number; // recuo da arma 0..1
  flash: boolean;
  earGlide: number; // 0..1 (transformação das orelhas)
  vy: number;
  alpha: number;
  hasGun: boolean;
  scarf?: number; // (legado, sem uso)
  blink?: boolean;
  squash?: number; // -1..1 (aterrissagem)
}

// ombro abaixo do queixo: o braço/arma nunca cobre o rosto
const SHOULDER_STAND: [number, number] = [2.5, -21.5];
const ARM_LEN = 13.5;

/** Ângulo local (rig virado p/ direita) a partir do ângulo de mira do mundo. */
export function localAim(aim: number, facing: 1 | -1) {
  let a = facing === 1 ? aim : Math.PI - aim;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return Math.max(-Math.PI * 0.62, Math.min(Math.PI * 0.62, a));
}

/** Posição da boca da arma, relativa aos pés do Karimbo, em coordenadas de MUNDO. */
export function karimboMuzzle(facing: 1 | -1, aim: number, weapon: WeaponId, crouch: boolean, kick = 0): [number, number] {
  const a = localAim(aim, facing);
  const def = WEAPONS[weapon];
  const sy = SHOULDER_STAND[1] + (crouch ? 10 : 0);
  const d = ARM_LEN + def.muzzle - kick * 3.5;
  const lx = SHOULDER_STAND[0] + Math.cos(a) * d;
  const ly = sy + Math.sin(a) * d - 0.5;
  return [lx * facing, ly];
}

export const KARIMBO_SHOULDER_Y = SHOULDER_STAND[1];

export function drawKarimbo(g: CanvasRenderingContext2D, art: KarimboArt, x: number, y: number, p: KPose) {
  if (p.alpha <= 0.01) return;
  const prevA = g.globalAlpha;
  g.globalAlpha = prevA * p.alpha;
  g.save();
  g.translate(x, y);
  if (p.facing === -1) g.scale(-1, 1);

  const w = p.flash;
  const running = p.state === 'run';
  const crouch = p.state === 'crouch';
  const glide = p.state === 'glide';
  const c = p.runPhase;
  const bob = running ? -Math.abs(Math.sin(c)) * 1.7 : p.state === 'idle' ? Math.sin(p.t * 3) * 0.5 : 0;
  const squash = p.squash ?? 0;
  const sqY = 1 - squash * 0.14;
  const sqX = 1 + squash * 0.1;
  const hurtRot = p.state === 'hurt' ? -0.22 : 0;

  let legF = 0;
  let legB = 0;
  let legSy = 1;
  let hipY = -13;
  let torsoDrop = 0;
  if (running) {
    legF = Math.sin(c) * 0.95;
    legB = -Math.sin(c) * 0.95;
  } else if (p.state === 'jump') {
    legF = 0.75;
    legB = -0.35;
  } else if (p.state === 'fall') {
    legF = 0.35 + Math.sin(p.t * 9) * 0.05;
    legB = -0.25;
  } else if (glide) {
    legF = 0.12 + Math.sin(p.t * 20) * 0.06;
    legB = -0.1 + Math.cos(p.t * 20) * 0.06;
  } else if (crouch) {
    legF = 0.75;
    legB = -0.7;
    legSy = 0.62;
    hipY = -9;
    torsoDrop = 9;
  } else if (p.state === 'hurt') {
    legF = 0.5;
    legB = -0.5;
  }

  g.save();
  g.rotate(hurtRot);
  g.scale(sqX, sqY);

  const sh = SHOULDER_STAND;
  const shY = sh[1] + torsoDrop + bob;
  // braço de trás (só quando sem arma)
  if (!p.hasGun) drawSpr(g, art.armBack, sh[0] - 4, shY + 0.5, { rot: 1.1 + Math.sin(c) * (running ? 0.5 : 0), white: w });
  // pernas + shorts + tronco (barriga por cima do shorts)
  drawSpr(g, art.legBack, -2.6, hipY + bob * 0.5, { rot: legB, sy: legSy, white: w });
  drawSpr(g, art.legFront, 2.6, hipY + bob * 0.5, { rot: legF, sy: legSy, white: w });
  drawSpr(g, art.shorts, 0, hipY - 1 + bob * 0.5, { white: w, sy: legSy > 0.9 ? 1 : 0.85 });
  drawSpr(g, art.torso, 0, -12 + torsoDrop + bob, { white: w, rot: glide ? -0.1 : running ? 0.05 : 0 });

  // braço da frente + arma (ANTES da cabeça: nada cobre o rosto)
  if (p.hasGun) {
    const a = localAim(p.aim, p.facing);
    g.save();
    g.translate(sh[0], shY);
    g.rotate(a);
    drawSpr(g, art.armFront, 0, 0, { white: w });
    drawSpr(g, art.weapons[p.weapon], ARM_LEN - 1.5 - p.kick * 3.2, 0.3, { white: w });
    g.restore();
  } else {
    drawSpr(g, art.armFront, sh[0], shY, { rot: 0.9 + Math.sin(c + 3) * (running ? 0.5 : 0), white: w });
  }

  // cabeça (rosto sempre em destaque, por cima de tudo) + orelhas atrás dela
  const hd = art.heads;
  const aimLocal = localAim(p.aim, p.facing);
  const headRot = hurtRot * 1.4 + (glide ? -0.06 : 0) + Math.sin(p.t * 2.2) * 0.012 + (running ? Math.sin(c) * 0.03 : 0) + (p.hasGun ? aimLocal * 0.1 : 0);
  const hx = 1.0;
  const hy = -26.5 + torsoDrop + bob * 1.15;
  g.save();
  g.translate(hx, hy);
  g.rotate(headRot);
  drawEars(g, art, p, w);
  drawSpr(g, hd.right, 0, 0, { white: w });
  g.restore();

  g.restore();
  g.restore();
  g.globalAlpha = prevA;
}

const easeOutBack = (t: number) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/**
 * Orelhas: em repouso são ampliadas (1.3x) e levemente abertas; no EAR GLIDE crescem (com
 * overshoot), abrem como asas apontando para cima/fora e vibram. Sempre a mesma textura da foto.
 */
function drawEars(g: CanvasRenderingContext2D, art: KarimboArt, p: KPose, white: boolean) {
  const hd = art.heads;
  const eg = Math.max(0, Math.min(1, p.earGlide));
  const grow = 1.3 + (3.6 - 1.3) * Math.max(0, easeOutBack(eg));
  const lift = Math.max(-0.4, Math.min(0.4, -p.vy / 600));
  const flap = eg > 0.03 ? (Math.sin(p.t * 15) * 0.13 + Math.sin(p.t * 52) * 0.035) * eg : 0;
  const open = 0.1 + eg * (0.95 + lift * 0.35);
  // ondulação de "membrana": o comprimento pulsa um pouco
  const pulse = 1 + (eg > 0.5 ? Math.sin(p.t * 30) * 0.025 : 0);
  const [nx, ny] = hd.earRootNear;
  const [fx, fy] = hd.earRootFar;
  // orelha de trás (lado oposto ao rosto): mais fina pela perspectiva, cresce até ~0.95
  const farW = 0.55 + eg * 0.4;
  drawSpr(g, hd.earFar, fx, fy, { rot: open + flap * 0.9, sx: grow * farW * pulse, sy: grow * pulse, white });
  drawSpr(g, hd.earNear, nx, ny, { rot: -open + flap, sx: grow * 0.95 * pulse, sy: grow * pulse, white });
}

export { glowSprite };
