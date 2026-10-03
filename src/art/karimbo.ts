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
import { progress } from '../core/storage';
import type { SkinId } from '../core/skinCatalog';
import { clothFinish } from './volume';

export interface KarimboArt {
  torso: Sprite;
  shorts: Sprite;
  legFront: Sprite;
  legBack: Sprite;
  armFront: Sprite;
  armBack: Sprite;
  weapons: Record<WeaponId, Sprite>;
  /** faquinha de cortar manteiga (golpe corpo a corpo) */
  knife: Sprite;
  heads: KarimboHeads;
  variants?: Partial<Record<SkinId, KarimboArt>>;
}

const S = 3;
const SKIN = '#c98a66';

/** Faquinha de cortar manteiga: lâmina larga de ponta redonda, cabo de madeira com rebites. */
function bakeKnife(): Sprite {
  return bake(
    26,
    9,
    (g) => {
      // cabo (empunhado na mão: pivô no começo do cabo)
      shadedRR(g, 0.6, 2.6, 8.6, 3.8, 1.6, '#8a5a30', { lw: 0.9 });
      g.fillStyle = '#e8d8b0';
      g.beginPath();
      g.arc(3, 4.5, 0.6, 0, Math.PI * 2);
      g.arc(6.4, 4.5, 0.6, 0, Math.PI * 2);
      g.fill();
      // guarda
      shadedRR(g, 8.4, 2, 1.6, 5, 0.6, '#9aa0b8', { lw: 0.7, shine: false });
      // lâmina de manteiga: reta em cima, ponta arredondada, serrilhado fino embaixo
      g.beginPath();
      g.moveTo(9.8, 2.2);
      g.lineTo(21, 2);
      g.quadraticCurveTo(25.6, 2.4, 25.2, 5);
      g.quadraticCurveTo(24.4, 7, 21, 6.8);
      g.lineTo(9.8, 6.4);
      g.closePath();
      const gr = g.createLinearGradient(0, 2, 0, 7);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.45, '#d6dbe8');
      gr.addColorStop(1, '#8a92ab');
      g.fillStyle = gr;
      g.fill();
      g.lineWidth = 0.9;
      g.strokeStyle = OUT;
      g.stroke();
      g.strokeStyle = 'rgba(40,30,70,0.45)';
      g.lineWidth = 0.5;
      g.beginPath();
      for (let x = 12; x < 21; x += 1.6) {
        g.moveTo(x, 6.4);
        g.lineTo(x + 0.8, 5.8);
      }
      g.stroke();
      // brilho na lâmina
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.fillRect(11, 2.8, 9, 0.8);
      // um restinho de manteiga
      g.fillStyle = '#ffe27a';
      g.beginPath();
      g.ellipse(22.6, 4.2, 1.6, 0.9, 0, 0, Math.PI * 2);
      g.fill();
    },
    { scale: S, ox: 1.5, oy: 4.5 }
  );
}

export function bakeKarimbo(heads: KarimboHeads, skin: SkinId = 'classic', equipment?: Pick<KarimboArt, 'weapons' | 'knife'>): KarimboArt {
  const SHIRT = skin === 'explorer' ? '#728848' : skin === 'neon' ? '#25243f' : '#d2b892';
  const SHORTS = skin === 'explorer' ? '#685137' : skin === 'neon' ? '#252d46' : '#3b4763';
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
      clothFinish(g, 3, 2, 22, 17, SHIRT);
      // Gola dobrada e costura de ombro acompanham o volume da camiseta.
      g.strokeStyle = shade(SHIRT, -0.38); g.lineWidth = .85;
      g.beginPath(); g.moveTo(7, 3); g.quadraticCurveTo(14, 6, 20, 3);
      g.moveTo(4, 5); g.lineTo(7, 6.5); g.stroke();
      g.strokeStyle = shade(SHIRT, .22); g.lineWidth = .6;
      g.beginPath(); g.moveTo(7, 2.2); g.quadraticCurveTo(14, 5, 20, 2.2); g.stroke();
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
      if (skin === 'explorer') {
        // Colete aberto, bolsos e fivela; o rosto continua descoberto.
        shadedRR(g, 4.2, 6, 7.2, 8.8, 1.4, '#9da76a', { lw: 0.7 });
        shadedRR(g, 16.6, 6, 7.2, 8.8, 1.4, '#9da76a', { lw: 0.7 });
        g.fillStyle = '#51452d';
        g.fillRect(4.8, 9, 6, 1);
        g.fillRect(17.2, 9, 6, 1);
        g.fillRect(4.8, 16.4, 18.4, 1.6);
        shadedRR(g, 12, 16, 4, 2.6, 0.4, '#d6bf72', { lw: 0.6 });
      } else if (skin === 'neon') {
        g.strokeStyle = '#39f0ff';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(5.5, 6); g.lineTo(10, 9); g.lineTo(10, 15.5);
        g.moveTo(22.5, 6); g.lineTo(18, 9); g.lineTo(18, 15.5);
        g.stroke();
        g.fillStyle = '#bd65ff';
        g.fillRect(6.5, 17, 15, 1.5);
        g.fillStyle = '#d4faff';
        g.fillRect(13.6, 7, 0.8, 11);
      }
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
      clothFinish(g, 2, 1, 20, 9, SHORTS);
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
        g.fillStyle = shade(sk, -0.22); g.fillRect(7, 4, .7, 7);
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
        if (skin !== 'classic') {
          shadedRR(g, 1.5, 0, 7.5, 13.8, 2, dark ? shade(SHORTS, -0.2) : SHORTS, { lw: 0.8 });
          shadedRR(g, 0.5, 12.2, 10, 5.3, 1.3, skin === 'explorer' ? '#493628' : '#373152', { lw: 0.8 });
          g.fillStyle = skin === 'explorer' ? '#c2a675' : '#39f0ff';
          g.fillRect(2.5, skin === 'explorer' ? 13.4 : 16, 6.2, 1);
          if (skin === 'neon') g.fillRect(6.8, 1, 1, 10);
        }
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
        if (skin !== 'classic') {
          g.fillStyle = skin === 'explorer' ? '#d6bf72' : '#39f0ff';
          g.fillRect(1.8, 2, 2, 3.6);
        }
        g.fillStyle = shade(sk, .22); g.fillRect(13.3, 2.4, 2.2, .7);
        g.strokeStyle = shade(sk, -.28); g.lineWidth = .45;
        g.beginPath(); g.moveTo(15.5, 4); g.lineTo(15.5, 5.5); g.moveTo(14.3, 4.2); g.lineTo(14.3, 5.7); g.stroke();
      },
      { scale: S, ox: 3, oy: 4 }
    );

  return { torso, shorts, legFront, legBack, armFront: mkArm(false), armBack: mkArm(true), weapons: equipment?.weapons ?? bakeWeapons(), knife: equipment?.knife ?? bakeKnife(), heads };
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
export type KState = 'idle' | 'run' | 'jump' | 'fall' | 'glide' | 'crouch' | 'hurt' | 'slide' | 'slam' | 'swim';

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
  squash?: number; // -1..1 (aterrissagem +, esticado no ar −)
  /** inclinação do corpo (rad, + = para a frente), vinda de mola (velocidade + aceleração) */
  lean?: number;
  /** atraso da cabeça (follow-through), px no rig */
  headLag?: [number, number];
  /** mola das orelhas: + = pontas para cima */
  earSpring?: number;
  /** 0..1 achatamento da virada */
  turn?: number;
  /** segundos parado (respiração / olhar em volta) */
  idleT?: number;
  /** 0..1 progresso do golpe corpo a corpo */
  melee?: number;
  /** golpe de baixo para cima (alterna com o de cima para baixo) */
  meleeUp?: boolean;
  /** 0..1 traje de mergulho (capacete de latão + cilindro de ar) */
  suit?: number;
  /** fase da batida de pernas no nado */
  swimPhase?: number;
  reload?: number;
  scope?: boolean;
  clap?: boolean;
  clapTime?: number;
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
  return [lx * facing * KSCALE, ly * KSCALE];
}

export const KARIMBO_SHOULDER_Y = SHOULDER_STAND[1];
/** Escala visual do herói (sprites maiores; hitbox acompanha em movement.ts). */
export const KSCALE = 1.2;

export function drawKarimbo(g: CanvasRenderingContext2D, art: KarimboArt, x: number, y: number, p: KPose, skin: SkinId = progress.equippedSkin) {
  art = art.variants?.[skin] ?? art;
  if (p.alpha <= 0.01) return;
  const prevA = g.globalAlpha;
  g.globalAlpha = prevA * p.alpha;
  g.save();
  g.translate(x, y);
  if (p.facing === -1) g.scale(-1, 1);
  g.scale(KSCALE, KSCALE);
  // corpo inteiro: inclinação (pivô nos pés) e achatamento da virada
  if (p.lean) g.rotate(p.lean);
  const turnK = p.turn ?? 0;
  if (turnK > 0.001) g.scale(1 - turnK * 0.42, 1 + turnK * 0.06);

  const w = p.flash;
  const running = p.state === 'run';
  const crouch = p.state === 'crouch';
  const glide = p.state === 'glide';
  const c = p.runPhase;
  const idle = p.state === 'idle';
  // corrida: dois "quiques" por ciclo; parado: respiração
  const bob = running ? -Math.abs(Math.sin(c)) * 2.1 : idle ? Math.sin(p.t * 2.6) * 0.55 : 0;
  const breath = idle ? Math.sin(p.t * 2.6) * 0.022 : 0;
  const recoil = (p.kick ?? 0) * 1.1; // o tronco recua com o disparo
  const [lagX, lagY] = p.headLag ?? [0, 0];
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
  } else if (p.state === 'slide') {
    // deslize: pernas esticadas para a frente, corpo baixo e jogado para trás
    legF = 1.45;
    legB = 1.05;
    legSy = 0.92;
    hipY = -8;
    torsoDrop = 10;
  } else if (p.state === 'swim') {
    // nado: pernas batendo (crawl), joelhos soltos
    const k = (p.swimPhase ?? p.t * 3) * 2.3;
    legF = 0.35 + Math.sin(k) * 0.55;
    legB = 0.1 - Math.sin(k) * 0.55;
    hipY = -13;
  } else if (p.state === 'slam') {
    // ORELHADA: pernas encolhidas, corpo compacto
    legF = 1.2;
    legB = -1.05;
    legSy = 0.8;
    hipY = -11;
    torsoDrop = 3;
  }
  const bodyRot = p.state === 'slide' ? -0.34 : p.state === 'slam' ? 0.14 : 0;

  g.save();
  g.rotate(hurtRot + bodyRot);
  g.scale(sqX, sqY);

  const sh = SHOULDER_STAND;
  const shY = sh[1] + torsoDrop + bob - breath * 10;
  const reload=p.reload??0;
  const reloadWeight=reload>0?Math.sin(Math.PI*reload):0;
  // Sequência do Animator_AI: aproximar, buscar carregador, encaixar, retomar mira.
  if(reloadWeight>0)drawSpr(g,art.armBack,sh[0]-3,shY+1,{rot:1.25-Math.sin(Math.PI*Math.min(1,reload*1.6))*.9,white:w});
  // braço de trás (só quando sem arma)
  if (!p.hasGun&&!p.clap) drawSpr(g, art.armBack, sh[0] - 4, shY + 0.5, { rot: 1.1 + Math.sin(c) * (running ? 0.5 : 0), white: w });
  // cilindro de ar nas costas (traje de mergulho)
  const suit = p.suit ?? 0;
  if (suit > 0.02) {
    const dg = diveGear(art);
    const s = Math.max(0, easeOutBack(Math.min(1, suit)));
    drawSpr(g, dg.tank, -6.5, shY + 3, { sx: s, sy: s, white: w });
  }
  // pernas + shorts + tronco (barriga por cima do shorts)
  drawSpr(g, art.legBack, -2.6, hipY + bob * 0.5, { rot: legB, sy: legSy, white: w });
  drawSpr(g, art.legFront, 2.6, hipY + bob * 0.5, { rot: legF, sy: legSy, white: w });
  drawSpr(g, art.shorts, 0, hipY - 1 + bob * 0.5, { white: w, sy: legSy > 0.9 ? 1 : 0.85 });
  drawSpr(g, art.torso, -recoil * 0.6, -12 + torsoDrop + bob, { white: w, rot: glide ? -0.1 : running ? 0.07 : 0, sy: 1 + breath, sx: 1 - breath * 0.4 });

  // braço da frente + arma (ANTES da cabeça: nada cobre o rosto)
  if (p.hasGun) {
    let a = localAim(p.aim, p.facing);
    if(reloadWeight>0)a=a*(1-reloadWeight)+.5*reloadWeight;
    const m = p.melee ?? 0;
    if (m > 0) {
      // golpe de faca: antecipação curta e corte em arco (alternando de cima / de baixo)
      const k = m < 0.2 ? -m / 0.2 : (m - 0.2) / 0.8;
      const e = 1 - Math.pow(1 - Math.max(0, k), 3);
      if (p.meleeUp) a = k < 0 ? 0.7 - k * 0.5 : 1.1 - 2.4 * e;
      else a = k < 0 ? -0.6 + k * 0.7 : -1.3 + 2.4 * e;
    }
    g.save();
    g.translate(sh[0] - recoil, shY);
    g.rotate(a);
    drawSpr(g, art.armFront, 0, 0, { white: w });
    // durante o golpe a arma some e a faquinha aparece na mão (como no Metal Slug)
    if (m > 0) drawSpr(g, art.knife, ARM_LEN - 1, 0.2, { white: w });
    else drawSpr(g, art.weapons[p.weapon], ARM_LEN - 1.5 - p.kick * 3.2, 0.3, { white: w });
    if(m<=0&&p.scope){g.fillStyle='#374653';g.fillRect(ARM_LEN+4,-5,7,3);g.fillStyle='#8de6ea';g.fillRect(ARM_LEN+10,-5,2,3);}
    if(m<=0&&reload>.2&&reload<.6){
      const ry=4+(1-Math.sin(Math.PI*(reload-.2)/.4))*7,rx=ARM_LEN-3;
      if(p.weapon==='shotgun'){g.fillStyle='#ba4f40';g.fillRect(rx,ry,3,7);g.fillStyle='#e3bb65';g.fillRect(rx,ry+5,3,2);}
      else if(p.weapon==='launcher'){g.fillStyle='#90b568';g.fillRect(rx-1,ry,5,8);g.fillStyle='#e3bb65';g.fillRect(rx-1,ry+6,5,2);}
      else if(p.weapon==='energy'){g.fillStyle='#384a63';g.fillRect(rx-1,ry,5,7);g.fillStyle='#7ff9ff';g.fillRect(rx,ry+1,3,4);}
      else {g.fillStyle='#7e8b9b';g.fillRect(rx,ry,p.weapon==='rifle'?5:4,p.weapon==='rifle'?9:7);g.fillStyle='#b8c5cf';g.fillRect(rx,ry,3,1);}
    }
    g.restore();
  } else {
    if(!p.clap)drawSpr(g, art.armFront, sh[0], shY, { rot: 0.9 + Math.sin(c + 3) * (running ? 0.5 : 0), white: w });
    if(p.clap){
      const open=(1-Math.cos((p.clapTime??p.t)*Math.PI*2/.6))*.5;
      for(const s of [-1,1]) {
        const sx=s*5,sy=shY+1,ex=s*(2+open*8),ey=shY+5;
        g.save();g.translate(sx,sy);g.rotate(Math.atan2(ey-sy,ex-sx));
        drawSpr(g,s>0?art.armFront:art.armBack,0,0,{sx:Math.hypot(ex-sx,ey-sy)/ARM_LEN,white:w});g.restore();
      }
    }
  }

  // cabeça (rosto sempre em destaque, por cima de tudo) + orelhas atrás dela
  const hd = art.heads;
  const aimLocal = localAim(p.aim, p.facing);
  const lookAround = idle && (p.idleT ?? 0) > 3.5 ? Math.sin(((p.idleT ?? 0) - 3.5) * 1.1) * 0.07 : 0;
  const headRot =
    hurtRot * 1.4 + (glide ? -0.06 : 0) + Math.sin(p.t * 2.2) * 0.012 + (running ? Math.sin(c - 0.5) * 0.035 : 0) + (p.hasGun ? aimLocal * 0.1 : 0) + lookAround - lagX * 0.02 + reloadWeight*.08;
  const hx = 1.0 + lagX - recoil * 0.8;
  const hy = -26.5 + torsoDrop + bob * 1.15 + lagY - breath * 12;
  g.save();
  g.translate(hx, hy);
  g.rotate(headRot);
  if (suit > 0.02) {
    // capacete de mergulho: o rosto aparece pela escotilha de vidro
    const dg = diveGear(art);
    const s = Math.max(0.01, easeOutBack(Math.min(1, suit)));
    // mangueira do cilindro até o capacete
    g.strokeStyle = '#2b2a3a';
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(-6.5 - hx, shY + 3 - hy - 8);
    g.quadraticCurveTo(-12, dg.cy + 4, dg.cx - dg.r * 0.8 * s, dg.cy + dg.r * 0.2);
    g.stroke();
    drawSpr(g, dg.back, dg.cx, dg.cy, { sx: s, sy: s, white: w });
    if (suit > 0.55) {
      g.save();
      g.beginPath();
      g.arc(dg.px, dg.py, dg.pr * s, 0, Math.PI * 2);
      g.clip();
      drawSpr(g, hd.right, 0, 0, { white: w });
      g.restore();
    } else {
      drawEars(g, art, p, w);
      drawSpr(g, hd.right, 0, 0, { white: w });
    }
    drawSpr(g, dg.front, dg.cx, dg.cy, { sx: s, sy: s, white: w });
  } else {
    drawEars(g, art, p, w);
    drawSpr(g, hd.right, 0, 0, { white: w });
  }
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
  const e = Math.max(0, easeOutBack(eg));
  // cresce PARA OS LADOS (largura muito maior que a altura): a base continua parecendo orelha
  const sx = 1.3 + (4.1 - 1.3) * e;
  const sy = 1.3 + (1.85 - 1.3) * e;
  const lift = Math.max(-0.3, Math.min(0.3, -p.vy / 700));
  const flap = eg > 0.03 ? (Math.sin(p.t * 15) * 0.09 + Math.sin(p.t * 52) * 0.03) * eg : 0;
  const tilt = 0.06 + eg * (0.1 + lift * 0.25); // quase horizontais, levemente para cima
  const wob = 1 + (eg > 0.5 ? Math.sin(p.t * 30) * 0.02 : 0);
  const [nx, ny] = hd.earRootNear;
  const [fx, fy] = hd.earRootFar;
  // mola: sobem na queda, caem na subida, quicam ao pousar; tremidinha ocasional parado
  const twitch = p.state === 'idle' && Math.sin(p.t * 0.9) > 0.985 ? Math.sin(p.t * 60) * 0.08 : 0;
  const spring = (p.earSpring ?? 0) + twitch;
  // orelha de trás: mais fina pela perspectiva
  const farW = 0.55 + eg * 0.35;
  drawSpr(g, hd.earFar, fx, fy, { rot: tilt + flap * 0.9 + spring, sx: sx * farW * wob, sy, white });
  drawSpr(g, hd.earNear, nx, ny, { rot: -tilt + flap - spring, sx: sx * 0.95 * wob, sy, white });
}

// ------------------------------------------------------------------ traje de mergulho
interface DiveGear {
  back: Sprite;
  front: Sprite;
  tank: Sprite;
  /** centro do capacete e da escotilha (coordenadas do pivô da cabeça) */
  cx: number;
  cy: number;
  r: number;
  px: number;
  py: number;
  pr: number;
}
const gearCache = new WeakMap<KarimboArt, DiveGear>();

/** Capacete de escafandro de latão (estilo clássico) assado uma vez, no tamanho da cabeça. */
function diveGear(art: KarimboArt): DiveGear {
  const hit = gearCache.get(art);
  if (hit) return hit;
  const hd = art.heads.right;
  const cx = hd.w / 2 - hd.ox;
  const cy = hd.h / 2 - hd.oy - hd.h * 0.03;
  const r = Math.max(hd.w, hd.h) * 0.5;
  const pox = r * 0.1;
  const poy = r * 0.04;
  const pr = r * 0.76;
  const S = 2 * r + 8;
  const o = S / 2;
  const brass = '#c8933a';
  const brassL = '#f2c96a';
  const brassD = '#7a521c';
  const back = bake(
    S,
    S,
    (g) => {
      // esfera de latão
      const gr = g.createRadialGradient(o - r * 0.35, o - r * 0.4, r * 0.1, o, o, r);
      gr.addColorStop(0, brassL);
      gr.addColorStop(0.55, brass);
      gr.addColorStop(1, brassD);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(o, o, r, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 1.4;
      g.strokeStyle = OUT;
      g.stroke();
      // interior escuro atrás do rosto
      g.fillStyle = '#16212e';
      g.beginPath();
      g.arc(o + pox, o + poy, pr, 0, Math.PI * 2);
      g.fill();
      // janelinha lateral (atrás)
      g.fillStyle = '#1d3a4a';
      g.beginPath();
      g.arc(o - r * 0.62, o - r * 0.08, r * 0.2, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = brassD;
      g.lineWidth = 1.6;
      g.stroke();
    },
    { scale: 3, ox: o, oy: o }
  );
  const front = bake(
    S,
    S + 8,
    (g) => {
      const ex = o + pox;
      const ey = o + poy;
      // vidro: reflexo azulado e brilhos
      g.fillStyle = 'rgba(150,220,255,0.10)';
      g.beginPath();
      g.arc(ex, ey, pr, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(ex, ey, pr * 0.8, Math.PI * 1.08, Math.PI * 1.42);
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.3)';
      g.lineWidth = 0.9;
      g.beginPath();
      g.arc(ex, ey, pr * 0.62, Math.PI * 1.15, Math.PI * 1.3);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.ellipse(ex + pr * 0.42, ey + pr * 0.45, pr * 0.12, pr * 0.06, -0.6, 0, Math.PI * 2);
      g.fill();
      // aro de latão da escotilha + parafusos
      g.lineWidth = r * 0.12;
      g.strokeStyle = brass;
      g.beginPath();
      g.arc(ex, ey, pr + r * 0.07, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = r * 0.05;
      g.strokeStyle = brassL;
      g.beginPath();
      g.arc(ex, ey, pr + r * 0.1, Math.PI * 1.05, Math.PI * 1.6);
      g.stroke();
      g.lineWidth = 1;
      g.strokeStyle = OUT;
      g.beginPath();
      g.arc(ex, ey, pr + r * 0.15, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(ex, ey, pr - 0.2, 0, Math.PI * 2);
      g.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        const bx = ex + Math.cos(a) * (pr + r * 0.07);
        const by = ey + Math.sin(a) * (pr + r * 0.07);
        g.fillStyle = brassD;
        g.beginPath();
        g.arc(bx, by, r * 0.045, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = brassL;
        g.fillRect(bx - r * 0.02, by - r * 0.03, r * 0.025, r * 0.025);
      }
      // grade de proteção (três barras)
      g.strokeStyle = 'rgba(122,82,28,0.9)';
      g.lineWidth = r * 0.045;
      for (const dy of [-0.45, 0, 0.45]) {
        const hw = Math.sqrt(Math.max(0, 1 - dy * dy)) * pr;
        g.beginPath();
        g.moveTo(ex - hw * 0.15, ey + dy * pr);
        g.lineTo(ex + hw * 0.15, ey + dy * pr);
        g.stroke();
      }
      // válvula no topo
      shadedRR(g, o - r * 0.16, o - r - 4, r * 0.32, 6, 1.5, brass, { lw: 1 });
      g.fillStyle = '#e2384a';
      g.fillRect(o - r * 0.06, o - r - 6, r * 0.12, 2.4);
      // gola/peitoral (assenta nos ombros)
      g.beginPath();
      g.ellipse(o - r * 0.05, o + r * 0.95, r * 0.66, r * 0.2, 0, 0, Math.PI * 2);
      const cg = g.createLinearGradient(0, o + r * 0.62, 0, o + r * 1.22);
      cg.addColorStop(0, brassL);
      cg.addColorStop(1, brassD);
      g.fillStyle = cg;
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = OUT;
      g.stroke();
      for (let i = -2; i <= 2; i++) {
        g.fillStyle = brassD;
        g.beginPath();
        g.arc(o - r * 0.05 + i * r * 0.26, o + r * 0.97, r * 0.04, 0, Math.PI * 2);
        g.fill();
      }
    },
    { scale: 3, ox: o, oy: o }
  );
  const tank = bake(
    10,
    22,
    (g) => {
      shadedRR(g, 1, 2, 8, 19, 3.6, '#d8d4e4', { lw: 1 });
      g.fillStyle = '#e2384a';
      g.fillRect(1.6, 7, 6.8, 2);
      g.fillRect(1.6, 14, 6.8, 2);
      shadedRR(g, 3, 0, 4, 3, 1, '#7a7890', { lw: 0.8 });
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.fillRect(2.4, 4, 1.4, 14);
    },
    { scale: 3, ox: 5, oy: 2 }
  );
  const out: DiveGear = { back, front, tank, cx, cy, r, px: cx + pox, py: cy + poy, pr };
  gearCache.set(art, out);
  return out;
}

export { glowSprite };
