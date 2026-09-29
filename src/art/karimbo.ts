/**
 * Karimbo: corpo procedural "chibi" + CABEÇA FOTOGRÁFICA (a pessoa da foto).
 * Rig: pernas, tronco, braços e cabeça com poses (idle/run/jump/glide/crouch/hurt).
 */
import { bake, drawSpr, glowSprite, OUT, rrPath, shadedRR, poly, type Sprite } from './kit';
import { PAL } from './palette';
import { shade } from '../core/math';
import type { KarimboHeads } from './photo';
import { WEAPONS, type WeaponId } from '../game/weapons';

export interface KarimboArt {
  torso: Sprite;
  legFront: Sprite;
  legBack: Sprite;
  armFront: Sprite;
  armBack: Sprite;
  scarfTail: Sprite;
  weapons: Record<WeaponId, Sprite>;
  heads: KarimboHeads;
}

const S = 3;

export function bakeKarimbo(heads: KarimboHeads): KarimboArt {
  const K = PAL.k;
  const torso = bake(
    22,
    22,
    (g) => {
      // camisa
      shadedRR(g, 3, 3, 16, 18, 4.5, K.shirt);
      // colete
      shadedRR(g, 4, 4, 14, 14, 3.5, K.vest);
      g.strokeStyle = shade(K.vest, -0.4);
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(11, 5);
      g.lineTo(11, 17);
      g.stroke();
      // bolsos
      shadedRR(g, 5.2, 10.5, 4.2, 4.6, 1, shade(K.vest, -0.15), { lw: 0.8 });
      shadedRR(g, 12.6, 10.5, 4.2, 4.6, 1, shade(K.vest, -0.15), { lw: 0.8 });
      // cinto + fivela
      shadedRR(g, 3, 17, 16, 4, 1.3, '#3b3346', { lw: 1 });
      shadedRR(g, 9.2, 17.2, 3.6, 3.6, 0.8, '#ffd23a', { lw: 0.8 });
      // cachecol (gola)
      poly(g, [[4, 2.5], [18, 2.5], [16, 7.5], [11, 10], [6, 7.5]], K.scarf);
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.fillRect(5, 3, 12, 1.4);
    },
    { scale: S, ox: 11, oy: 22 }
  );

  const legFront = bake(
    10,
    18,
    (g) => {
      shadedRR(g, 1.5, 0, 7, 13, 2.5, K.pants);
      shadedRR(g, 2.4, 6.2, 5.2, 3, 1.2, shade(K.pants, 0.25), { lw: 0.7 });
      shadedRR(g, 0.4, 11, 9.6, 6.6, 2.4, K.boot);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.fillRect(1.4, 11.6, 5, 1.2);
      g.fillStyle = '#231a22';
      g.fillRect(0.6, 16.2, 9.2, 1.4);
    },
    { scale: S, ox: 5, oy: 1 }
  );
  const legBack = bake(
    10,
    18,
    (g) => {
      shadedRR(g, 1.5, 0, 7, 13, 2.5, shade(K.pants, -0.22));
      shadedRR(g, 0.4, 11, 9.6, 6.6, 2.4, shade(K.boot, -0.2));
      g.fillStyle = '#231a22';
      g.fillRect(0.6, 16.2, 9.2, 1.4);
    },
    { scale: S, ox: 5, oy: 1 }
  );

  const mkArm = (dark: boolean) =>
    bake(
      18,
      8,
      (g) => {
        const sl = dark ? shade(K.shirt, -0.25) : K.shirt;
        const sk = dark ? shade(PAL.skinK, -0.22) : PAL.skinK;
        shadedRR(g, 3.5, 1.6, 8, 5, 2.2, sk);
        shadedRR(g, 0.4, 0.6, 7.4, 6.8, 3, sl);
        shadedRR(g, 10.6, 1.4, 6.4, 5.2, 2.2, PAL.k.glove);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(1.4, 1.2, 4.6, 1.2);
      },
      { scale: S, ox: 3, oy: 4 }
    );
  const armFront = mkArm(false);
  const armBack = mkArm(true);

  const scarfTail = bake(
    16,
    7,
    (g) => {
      poly(g, [[0, 1.5], [14, 0.5], [16, 3.3], [13, 6.4], [0, 5.6]], K.scarf);
      g.strokeStyle = shade(K.scarf, -0.35);
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(3, 3.2);
      g.lineTo(13, 3.2);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(1, 1.8, 11, 0.9);
    },
    { scale: S, ox: 0.5, oy: 3.5 }
  );

  return { torso, legFront, legBack, armFront, armBack, scarfTail, weapons: bakeWeapons(), heads };
}

export function bakeWeapons(): Record<WeaponId, Sprite> {
  const w = {} as Record<WeaponId, Sprite>;
  // grip fica em (4, 5) — apontando para +x
  w.pistol = bake(
    16,
    10,
    (g) => {
      shadedRR(g, 1.5, 4, 5, 5.5, 1.2, '#3a3350'); // cabo
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
      shadedRR(g, 0.5, 3.4, 8, 4.6, 1.5, '#4a3b34'); // coronha
      shadedRR(g, 7, 2.6, 15, 5, 1.4, '#3f4560'); // corpo
      shadedRR(g, 21, 3.6, 8, 2.4, 1, '#2a2d40'); // cano
      shadedRR(g, 12, 6.8, 4, 4, 1, '#252838'); // carregador
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
      shadedRR(g, 8.5, 7, 7, 2.8, 1, '#a35d33'); // pump
      shadedRR(g, 16, 2.6, 14.5, 2.4, 1, '#565a78'); // cano 1
      shadedRR(g, 16, 5, 14.5, 2.4, 1, '#3d4058'); // cano 2
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
      shadedRR(g, 24.5, 1.8, 7, 10.4, 2, '#3c5a30'); // boca larga
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
      poly(g, [[1, 5], [8, 2.6], [22, 2.6], [27.5, 5.4], [22, 8.4], [9, 8.4], [4, 10.5], [2, 9]], '#e9f6ff');
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
  scarf: number; // fase do lenço
  blink?: boolean; // piscando na invulnerabilidade
  squash?: number; // -1..1 (aterrissagem)
}

const SHOULDER_STAND: [number, number] = [2.5, -28.5];
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
  const air = p.state === 'jump' || p.state === 'fall' || glide;
  const c = p.runPhase;
  const bob = running ? -Math.abs(Math.sin(c)) * 1.8 : p.state === 'idle' ? Math.sin(p.t * 3) * 0.5 : 0;
  const squash = p.squash ?? 0;
  const sqY = 1 - squash * 0.14;
  const sqX = 1 + squash * 0.1;
  let hurtRot = 0;
  if (p.state === 'hurt') hurtRot = -0.22;

  let legF = 0;
  let legB = 0;
  let legSy = 1;
  let hipY = -15;
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
    hipY = -9.5;
    torsoDrop = 9.5;
  } else if (p.state === 'hurt') {
    legF = 0.5;
    legB = -0.5;
  }

  g.save();
  g.rotate(hurtRot);
  g.scale(sqX, sqY);

  // sombra do lenço (cauda) atrás
  const flutter = Math.sin(p.scarf * 1) * 0.25 + (running ? 0.3 : 0) + (air ? -0.35 + Math.min(0.5, Math.abs(p.vy) / 900) : 0);
  drawSpr(g, art.scarfTail, -7, -29 + torsoDrop + bob, { rot: Math.PI + flutter * -1 + 0.15, white: w });

  // braço de trás
  const sh = SHOULDER_STAND;
  const shY = sh[1] + torsoDrop + bob;
  if (!p.hasGun) {
    drawSpr(g, art.armBack, sh[0] - 4, shY + 0.5, { rot: 1.1 + Math.sin(c) * (running ? 0.5 : 0), white: w });
  }
  // perna de trás
  drawSpr(g, art.legBack, -2.2, hipY + bob * 0.5, { rot: legB, sy: legSy, white: w });
  // torso
  drawSpr(g, art.torso, 0, -14 + torsoDrop + bob, { white: w, rot: glide ? -0.12 : running ? 0.06 : 0 });
  // perna da frente
  drawSpr(g, art.legFront, 2.2, hipY + bob * 0.5, { rot: legF, sy: legSy, white: w });

  // cabeça (fotográfica)
  const hd = art.heads;
  const headRot = hurtRot * 1.4 + (glide ? -0.06 : 0) + Math.sin(p.t * 2.2) * 0.012 + (running ? Math.sin(c) * 0.03 : 0);
  const aimLocal = localAim(p.aim, p.facing);
  const lookUp = p.hasGun ? aimLocal * 0.16 : 0;
  const hx = 1.0;
  const hy = -25.5 + torsoDrop + bob * 1.15 - (crouch ? 0.5 : 0);

  // orelhas gigantes (EAR GLIDE) — por cima da cabeça (cobrem as orelhas normais), sobem em escala/ângulo
  const eg = p.earGlide;
  drawSpr(g, hd.right, hx, hy, { rot: headRot + lookUp, white: w });
  if (eg > 0.01) drawGlideEars(g, art, hx, hy, headRot + lookUp, eg, p, w);

  // braço da frente + arma
  if (p.hasGun) {
    const a = aimLocal;
    const kick = p.kick;
    g.save();
    g.translate(sh[0], shY);
    g.rotate(a);
    drawSpr(g, art.armFront, 0, 0, { white: w });
    const wp = art.weapons[p.weapon];
    const kx = ARM_LEN - 1.5 - kick * 3.2;
    drawSpr(g, wp, kx, 0.3, { white: w });
    g.restore();
  } else {
    drawSpr(g, art.armFront, sh[0], shY, { rot: 0.9 + Math.sin(c + 3) * (running ? 0.5 : 0), white: w });
  }
  g.restore();
  g.restore();
  g.globalAlpha = prevA;
}

function drawGlideEars(g: CanvasRenderingContext2D, art: KarimboArt, hx: number, hy: number, headRot: number, eg: number, p: KPose, white: boolean) {
  const hd = art.heads;
  // escala cresce com easeOutBack; vibra rápido
  const grow = eg < 1 ? 1 + 2.6 * (1 - Math.pow(1 - eg, 3)) * (1 + 0.15 * Math.sin(eg * Math.PI)) : 3.6;
  const flutter = Math.sin(p.t * 58) * 0.09 * eg + Math.sin(p.t * 21) * 0.05 * eg;
  const lift = Math.max(-0.5, Math.min(0.5, -p.vy / 700)); // subindo abre mais p/ cima
  const open = (1.32 + lift * 0.45) * eg; // ~75°
  g.save();
  g.translate(hx, hy);
  g.rotate(headRot);
  // orelha próxima (esquerda da imagem)
  const [nx, ny] = hd.earRootNear;
  drawSpr(g, hd.earL, nx, ny, { rot: -open + flutter, sx: grow * 0.92, sy: grow, white });
  const [fx, fy] = hd.earRootFar;
  drawSpr(g, hd.earR, fx, fy, { rot: open - flutter, sx: grow * 0.92, sy: grow, white });
  g.restore();
}

// re-export utilitário
export { glowSprite };
