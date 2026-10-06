/**
 * O jacaré boxeador, de frente (redesenho do boxe 2.0): barril de peito com placas de barriga, calção de
 * lutador, chapéu de palha com fita e o sino da roda no pescoço, cabeça com mandíbula que abre de verdade,
 * olhos de cinco expressões, braços de duas partes (cinemática inversa) e luvas verdes com garras.
 * Tudo assado uma vez; por quadro são ~20 desenhos e nenhuma alocação.
 *
 * A pose vem do estado da simulação (`GatorPose`): dança no ritmo, guardas legíveis (alta, baixa, aberta,
 * tonto, cobertura) e os ataques com telegrafia que o jogador aprende a ler: PATADA (a luva vai para trás e
 * dispara na câmera), CABEÇADA (tira o chapéu e investe com a cabeça), RABADA (o rabo levanta com poeira e
 * varre a tela), MORDIDONA (a boca abre em duas batidas e a cabeça desaba na câmera), CHAPELADA (o chapéu
 * voa e volta como bumerangue) e o GIRO DA RODA (gira com a cauda varrendo de um lado e do outro).
 * As partes que passam POR CIMA do Karimbo (luva, rabo, cabeça, chapéu no impacto) saem na passada tardia.
 */
import { bake, drawSpr, type Sprite } from '../../kit';
import type { AttackKind, Guard } from '../../../game/minigames/boxing/sim/rules';
import { ATTACKS, BPM } from '../../../game/minigames/boxing/sim/rules';
import type { GMode } from '../../../game/minigames/boxing/sim/match';
import { drawGlove } from './gloves';
import { newArm, solveArm, depthScale, type Cam } from './armRig';

const OUT = '#170f2e';
const GREEN = '#5f8a45', GREEN_D = '#46702f', GREEN_L = '#86ad5e';
const BELLY = '#efe6b4', BELLY_D = '#c9bd84';
const TAU = Math.PI * 2;

export interface GatorPose {
  mode: GMode;
  guard: Guard;
  attack: AttackKind | null;
  /** índice do golpe em curso num ataque de vários golpes (chapelada, giro) */
  hitIdx: number;
  /** 0..1 durante a telegrafia (1 = impacto) */
  tele01: number;
  /** segundos desde o último impacto do jacaré (grande = parado) */
  since: number;
  lastAttack: AttackKind | null;
  lastIdx: number;
  /** mão do golpe (alterna a cada ataque) */
  hand: -1 | 1;
  round: 1 | 2 | 3;
  time: number;
  /** reação ao soco que levou: força 0..1 (decai), lado do soco e tipo (0 jab, 1 direto, 2 cruzado, 3 gancho) */
  react: number; reactSide: -1 | 1; reactTier: 0 | 1 | 2 | 3;
  fury: boolean;
  champion: boolean;
  /** o chapéu caiu (nocaute) */
  hatOff: boolean;
  /** abertura do juiz: mostra o jacaré sem dançar */
  still: boolean;
}

// ───────────────────────── assados ─────────────────────────
interface Parts {
  torso: Sprite; shorts: Sprite; headUp: Sprite; jaw: Sprite; foot: Sprite; hat: Sprite; bell: Sprite;
  eyes: Sprite[];
  bk: number;
}
let parts: Parts | null = null;
let partsK = 0;
let partsChamp = false;

const grad = (g: CanvasRenderingContext2D, x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, stops: [number, string][]) => {
  const gr = g.createRadialGradient(x0, y0, r0, x1, y1, r1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
};

function bakeParts(bk: number, champion: boolean): Parts {
  const torso = bake(104, 96, (g) => {
    g.translate(52, 48);
    // barril do peito
    const body = (grow: number) => {
      g.beginPath();
      g.moveTo(-40 - grow, -40 - grow);
      g.bezierCurveTo(-56 - grow, -30, -56 - grow, 10, -42 - grow, 36 + grow);
      g.bezierCurveTo(-30, 48 + grow, 30, 48 + grow, 42 + grow, 36 + grow);
      g.bezierCurveTo(56 + grow, 10, 56 + grow, -30, 40 + grow, -40 - grow);
      g.bezierCurveTo(20, -50 - grow, -20, -50 - grow, -40 - grow, -40 - grow);
      g.closePath();
    };
    g.fillStyle = OUT; body(2.6); g.fill();
    g.fillStyle = grad(g, -16, -24, 4, 0, 0, 64, [[0, GREEN_L], [0.5, GREEN], [1, '#3a5a28']]); body(0); g.fill();
    // barriga creme com placas
    g.fillStyle = OUT; g.beginPath(); g.ellipse(0, 6, 30.5, 42, 0, 0, TAU); g.fill();
    g.fillStyle = grad(g, -8, -10, 4, 0, 6, 46, [[0, '#fbf6d2'], [0.7, BELLY], [1, BELLY_D]]); g.beginPath(); g.ellipse(0, 6, 28.4, 40, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(120,104,50,.7)'; g.lineWidth = 1.4;
    for (let y = -26; y <= 38; y += 9.2) { g.beginPath(); g.moveTo(-24 + Math.abs(y) * 0.1, y); g.quadraticCurveTo(0, y + 4.4, 24 - Math.abs(y) * 0.1, y); g.stroke(); }
    // escamas do peito e dos lados
    g.fillStyle = 'rgba(40,70,30,.35)';
    for (const [x, y] of [[-40, -14], [-44, 4], [-40, 24], [40, -14], [44, 4], [40, 24], [-34, -30], [34, -30]] as [number, number][]) { g.beginPath(); g.ellipse(x, y, 4.2, 2.8, 0, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.ellipse(-24, -30, 12, 5.2, -0.5, 0, TAU); g.fill();
  }, { scale: bk, ox: 52, oy: 48 });

  const shorts = bake(96, 46, (g) => {
    g.translate(48, 0);
    const col = champion ? '#e8c868' : '#e0a63a';
    const col2 = champion ? '#fff3a0' : '#f3c868';
    g.fillStyle = OUT;
    g.beginPath(); g.moveTo(-38, 0); g.lineTo(38, 0); g.lineTo(45, 40); g.lineTo(6, 44); g.lineTo(0, 30); g.lineTo(-6, 44); g.lineTo(-45, 40); g.closePath(); g.fill();
    g.fillStyle = col;
    g.beginPath(); g.moveTo(-36, 1.4); g.lineTo(36, 1.4); g.lineTo(42.6, 38); g.lineTo(5.4, 41.6); g.lineTo(0, 29); g.lineTo(-5.4, 41.6); g.lineTo(-42.6, 38); g.closePath(); g.fill();
    g.fillStyle = col2; g.fillRect(-36, 22, 78, 3.6);
    // cós vermelho com o nome
    g.fillStyle = OUT; g.fillRect(-39, -2, 78, 15);
    g.fillStyle = '#d9503a'; g.fillRect(-37.4, -0.6, 74.8, 12);
    g.fillStyle = '#fff3d0'; g.font = '700 8.4px "Lilita One",Impact,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(champion ? 'CAMPEÃO' : 'JACARÉ', 0, 5.6);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-36, 13, 74, 3);
    if (champion) { g.fillStyle = OUT; g.fillRect(-14, -5, 28, 20); g.fillStyle = '#ffd23a'; g.fillRect(-12.4, -3.4, 24.8, 17); g.fillStyle = '#c4202e'; g.beginPath(); g.arc(0, 5.2, 5, 0, TAU); g.fill(); }
  }, { scale: bk, ox: 48, oy: 0 });

  const headUp = bake(112, 92, (g) => {
    g.translate(56, 46);
    // crânio, bochechas e focinho
    const blob = (cx: number, cy: number, rx: number, ry: number, grow: number, fill: string | CanvasGradient) => {
      g.fillStyle = OUT; g.beginPath(); g.ellipse(cx, cy, rx + grow, ry + grow, 0, 0, TAU); g.fill();
      g.fillStyle = fill; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
    };
    blob(0, -4, 40, 33, 2.4, grad(g, -14, -22, 3, 0, -2, 46, [[0, GREEN_L], [0.55, GREEN], [1, GREEN_D]]));
    blob(0, 10, 45, 27, 2.4, grad(g, -14, 0, 3, 0, 10, 50, [[0, GREEN_L], [0.6, GREEN], [1, GREEN_D]]));
    // focinho largo, apontado para a câmera
    blob(0, 17, 34, 23, 2.4, grad(g, -8, 6, 2, 0, 17, 40, [[0, '#a8d878'], [0.6, '#7fae56'], [1, '#5f8a45']]));
    // bumbos dos olhos
    for (const s of [-1, 1]) {
      g.fillStyle = OUT; g.beginPath(); g.ellipse(s * 27, -27, 16.2, 14.6, 0, 0, TAU); g.fill();
      g.fillStyle = grad(g, s * 24, -32, 2, s * 27, -27, 16, [[0, GREEN_L], [1, GREEN]]); g.beginPath(); g.ellipse(s * 27, -27, 13.8, 12.2, 0, 0, TAU); g.fill();
    }
    // escamas da testa
    g.fillStyle = GREEN_D;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(i * 9, -39 + Math.abs(i) * 1.8, 5.2, 3.4, 0, 0, TAU); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1; g.stroke(); }
    // narinas
    g.fillStyle = OUT;
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 10, 5, 3.4, 2.4, s * 0.4, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.4)';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 9, 3.6, 1.4, 0.9, 0, 0, TAU); g.fill(); }
    // linha do sorriso e dentes de cima
    g.strokeStyle = OUT; g.lineWidth = 2.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-31, 25); g.quadraticCurveTo(0, 34, 31, 25); g.stroke();
    g.fillStyle = '#fffaf0';
    for (const x of [-27, -20, -13, 13, 20, 27]) { g.beginPath(); g.moveTo(x - 3, 26.6 - Math.abs(x) * 0.02); g.lineTo(x, 33 + (Math.abs(x) < 20 ? 1.4 : 0)); g.lineTo(x + 3, 26.6); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1; g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(-16, -14, 14, 5, -0.3, 0, TAU); g.fill();
  }, { scale: bk, ox: 56, oy: 46 });

  const jaw = bake(78, 36, (g) => {
    g.translate(39, 4);
    g.fillStyle = OUT; g.beginPath(); g.ellipse(0, 10, 37.4, 14.6, 0, 0, TAU); g.fill();
    g.fillStyle = grad(g, -8, 4, 2, 0, 10, 40, [[0, '#8fc063'], [1, GREEN]]); g.beginPath(); g.ellipse(0, 10, 35, 12.2, 0, 0, TAU); g.fill();
    // língua e dentes de baixo
    g.fillStyle = '#e8627a'; g.beginPath(); g.ellipse(0, 5, 17, 5.6, 0, 0, TAU); g.fill();
    g.fillStyle = '#fffaf0';
    for (const x of [-28, -21, -14, 14, 21, 28]) { g.beginPath(); g.moveTo(x - 2.8, 7); g.lineTo(x, 0); g.lineTo(x + 2.8, 7); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.9; g.stroke(); }
  }, { scale: bk, ox: 39, oy: 4 });

  // olhos: normal (pupila de fenda), bravo, tonto, fechado, morto
  const eye = (kind: number, spin = 0) => bake(34, 30, (g) => {
    g.translate(17, 15);
    const lid = (open: number) => { g.fillStyle = GREEN; g.beginPath(); g.ellipse(0, -9 + open, 15, 8, 0, Math.PI, 0); g.fill(); };
    if (kind === 3) { g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(-11, 2); g.quadraticCurveTo(0, 9, 11, 2); g.stroke(); return; }
    if (kind === 4) { g.strokeStyle = OUT; g.lineWidth = 3.2; g.beginPath(); g.moveTo(-9, -8); g.lineTo(9, 8); g.moveTo(9, -8); g.lineTo(-9, 8); g.stroke(); return; }
    g.fillStyle = OUT; g.beginPath(); g.ellipse(0, 0, 14.6, 13, 0, 0, TAU); g.fill();
    g.fillStyle = kind === 1 ? '#fff0e0' : '#ffffff'; g.beginPath(); g.ellipse(0, 0, 12.8, 11.2, 0, 0, TAU); g.fill();
    if (kind === 2) {
      g.strokeStyle = OUT; g.lineWidth = 1.8; g.beginPath();
      for (let a = 0; a < 14; a += 0.3) { const r = 1 + a * 0.75, x = Math.cos(a + spin) * r, y = Math.sin(a + spin) * r; if (a === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke(); return;
    }
    // íris amarela e pupila em fenda
    g.fillStyle = kind === 1 ? '#ff6a3a' : '#e8c846'; g.beginPath(); g.ellipse(1, 1, 8, 8.6, 0, 0, TAU); g.fill();
    g.fillStyle = OUT; g.beginPath(); g.ellipse(1, 1, 2.6, 7.4, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(-2.6, -3.4, 2, 0, TAU); g.fill();
    if (kind === 1) { g.fillStyle = OUT; g.beginPath(); g.moveTo(-15, -10); g.lineTo(15, -3.4); g.lineTo(15, -12); g.lineTo(-15, -14); g.closePath(); g.fill(); g.fillStyle = GREEN_D; g.beginPath(); g.moveTo(-13, -10.6); g.lineTo(13, -4.6); g.lineTo(13, -11); g.lineTo(-13, -12.6); g.closePath(); g.fill(); }
    else lid(0);
  }, { scale: bk, ox: 17, oy: 15 });
  const eyes = [eye(0), eye(1), eye(2, 0), eye(3), eye(4), eye(2, 2.1)];

  const foot = bake(40, 22, (g) => {
    g.translate(20, 14);
    g.fillStyle = OUT; g.beginPath(); g.ellipse(0, 0, 19, 8.8, 0, 0, TAU); g.fill();
    g.fillStyle = GREEN; g.beginPath(); g.ellipse(0, 0, 16.6, 6.4, 0, 0, TAU); g.fill();
    for (const x of [-11, 0, 11]) { g.fillStyle = OUT; g.beginPath(); g.moveTo(x - 3.4, 3); g.lineTo(x, 12); g.lineTo(x + 3.4, 3); g.closePath(); g.fill(); g.fillStyle = '#fbf6e4'; g.beginPath(); g.moveTo(x - 1.8, 3.4); g.lineTo(x, 9.8); g.lineTo(x + 1.8, 3.4); g.closePath(); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(-4, -2.6, 8, 2, 0, 0, TAU); g.fill();
  }, { scale: bk, ox: 20, oy: 12 });

  const hat = bake(92, 46, (g) => {
    g.translate(46, 34);
    // aba e copa de palha trançada com fita vermelha
    g.fillStyle = OUT; g.beginPath(); g.ellipse(0, 0, 44, 11.4, 0, 0, TAU); g.fill();
    g.fillStyle = '#e8cf8a'; g.beginPath(); g.ellipse(0, 0, 41.6, 9, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(140,100,40,.55)'; g.lineWidth = 1;
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(0, 0, 41.6 - Math.abs(i) * 1, 9, 0, i * 0.4, i * 0.4 + 0.5); g.stroke(); }
    g.fillStyle = OUT; g.beginPath(); g.moveTo(-24, -1); g.quadraticCurveTo(-22, -26, 0, -27); g.quadraticCurveTo(22, -26, 24, -1); g.closePath(); g.fill();
    g.fillStyle = '#f2dc9c'; g.beginPath(); g.moveTo(-22.4, -1.6); g.quadraticCurveTo(-20.6, -24, 0, -25); g.quadraticCurveTo(20.6, -24, 22.4, -1.6); g.closePath(); g.fill();
    g.fillStyle = '#d9503a'; g.fillRect(-23, -9, 46, 6.6);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-8, -18, 8, 3, -0.3, 0, TAU); g.fill();
    g.strokeStyle = '#d9503a'; g.lineWidth = 3; g.beginPath(); g.moveTo(22, -7); g.quadraticCurveTo(34, -2, 38, 8); g.stroke();
  }, { scale: bk, ox: 46, oy: 22 });

  const bell = bake(20, 24, (g) => {
    g.translate(10, 3);
    g.fillStyle = OUT; g.beginPath(); g.moveTo(-8, 15); g.quadraticCurveTo(-8, 2, 0, 0.6); g.quadraticCurveTo(8, 2, 8, 15); g.closePath(); g.fill();
    g.fillStyle = '#e8c868'; g.beginPath(); g.moveTo(-6.4, 13.6); g.quadraticCurveTo(-6.4, 3.4, 0, 2); g.quadraticCurveTo(6.4, 3.4, 6.4, 13.6); g.closePath(); g.fill();
    g.fillStyle = '#fff3b0'; g.fillRect(-3.6, 5, 2, 6.4);
    g.fillStyle = OUT; g.beginPath(); g.arc(0, 16.6, 2.3, 0, TAU); g.fill();
  }, { scale: bk, ox: 10, oy: 3 });

  return { torso, shorts, headUp, jaw, foot, hat, bell, eyes, bk };
}

// ───────────────────────── pose ─────────────────────────
interface Pose {
  bx: number; by: number; brot: number; bsx: number; bsy: number;
  hx: number; hy: number; hrot: number; hs: number; jaw: number; eye: number;
  gx: [number, number]; gy: [number, number]; gs: [number, number]; grot: [number, number]; gview: [number, number];
  /** a luva i sai na passada tardia (por cima do Karimbo) */
  glate: [boolean, boolean];
  tail: number; tailBig: number; tailSide: number;
  /** 0 na cabeça, 1 na mão, 2 voando, 3 caído */
  hat: number; hatX: number; hatY: number; hatS: number; hatRot: number;
  headLate: boolean; stars: boolean; dust: number; flash: number;
}
const P: Pose = {
  bx: 0, by: 0, brot: 0, bsx: 1, bsy: 1, hx: 0, hy: 0, hrot: 0, hs: 1, jaw: 0, eye: 0,
  gx: [0, 0], gy: [0, 0], gs: [1, 1], grot: [0, 0], gview: [0, 0], glate: [false, false],
  tail: 0, tailBig: 0, tailSide: 1, hat: 0, hatX: 0, hatY: 0, hatS: 1, hatRot: 0, headLate: false, stars: false, dust: 0, flash: 0,
};
/** posição suavizada das luvas (só nas transições de guarda; os ataques escrevem direto) */
const sm = { gx: [-26, 26], gy: [-132, -132], gs: [1, 1] };
/** Luvas das guardas. A boca fica em x ±37, y −140…−104 (cabeça em −156): as luvas das guardas abertas ficam nas bochechas e NUNCA sobre ela; só a cobertura tapa o rosto de propósito. */
export const GATOR_GUARD: Record<Guard, [number, number, number][]> = {
  alta: [[-56, -146, 1.0], [56, -146, 1.0]],
  baixa: [[-58, -74, 1.0], [58, -74, 1.0]],
  aberta: [[-76, -108, 0.95], [76, -108, 0.95]],
  tonto: [[-58, -62, 0.9], [58, -62, 0.9]],
  cobertura: [[-18, -128, 1.2], [18, -128, 1.2]],
  ataque: [[-60, -138, 1.0], [60, -138, 1.0]],
};
const ease = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Calcula a pose (em P) a partir do estado da luta. */
function computePose(p: GatorPose, dt: number) {
  const t = p.time;
  const beat = (t * BPM) / 60;
  const bob = p.still ? 0 : Math.abs(Math.sin(beat * Math.PI)) * 3.2;
  P.bx = p.still ? 0 : Math.sin(beat * Math.PI * 0.5) * 5;
  P.by = -bob; P.brot = Math.sin(beat * Math.PI * 0.5) * 0.02; P.bsx = 1; P.bsy = 1 + bob * 0.003;
  P.hx = 0; P.hy = 0; P.hrot = Math.sin(beat * Math.PI * 0.5 + 1) * 0.025; P.hs = 1; P.jaw = 0; P.eye = p.fury || p.round === 3 ? 1 : 0;
  P.tail = 0.2 + Math.sin(t * 2.4) * 0.14; P.tailBig = 0; P.tailSide = 1;
  P.hat = p.hatOff ? 3 : 0; P.hatX = 0; P.hatY = 0; P.hatS = 1; P.hatRot = Math.sin(beat * Math.PI * 0.5) * 0.03;
  P.headLate = false; P.stars = false; P.dust = 0; P.flash = 0;
  P.glate[0] = P.glate[1] = false;
  const g0 = GATOR_GUARD[p.guard] ?? GATOR_GUARD.alta;
  const k = 1 - Math.exp(-14 * dt);
  for (let i = 0; i < 2; i++) {
    sm.gx[i] += (g0[i][0] - sm.gx[i]) * k; sm.gy[i] += (g0[i][1] - sm.gy[i]) * k; sm.gs[i] += (g0[i][2] - sm.gs[i]) * k;
    P.gx[i] = sm.gx[i]; P.gy[i] = sm.gy[i] - (p.still ? 0 : bob * (i ? 1 : 0.7)); P.gs[i] = sm.gs[i]; P.grot[i] = 0; P.gview[i] = 0;
  }
  // humores
  if (p.mode === 'taunt') {
    P.bx = Math.sin(t * 7) * 10; P.by = -Math.abs(Math.sin(t * 7)) * 6; P.brot = Math.sin(t * 7) * 0.07; P.hrot = Math.sin(t * 7) * 0.14; P.jaw = 0.25 + 0.1 * Math.sin(t * 14);
    P.tail = 0.4 + Math.sin(t * 8) * 0.4; P.eye = 0;
    P.hatRot = Math.sin(t * 7) * 0.12; P.hatY = -Math.abs(Math.sin(t * 7)) * 4;
  } else if (p.mode === 'dizzy' || p.mode === 'groggy') {
    P.bx = Math.sin(t * 3.6) * 12; P.brot = Math.sin(t * 3.6) * 0.07; P.hrot = Math.sin(t * 3.6) * 0.18; P.hy = 4; P.jaw = 0.2; P.eye = 2; P.stars = true;
    P.hatRot = P.hrot * 1.4; P.hatX = P.hx + Math.sin(t * 3.6) * 3;
  } else if (p.mode === 'cover') {
    P.bsx = 0.94; P.bsy = 0.96; P.hy = 8; P.hs = 0.94; P.eye = 1;
  }
  // ───── ataques: telegrafia (tele01 0..1) e depois do impacto (since)
  const tele = p.mode === 'tele';
  const atk = tele ? p.attack : p.since < 0.55 ? p.lastAttack : null;
  const idx = tele ? p.hitIdx : p.lastIdx;
  if (atk) {
    const def = ATTACKS[atk];
    const w = tele ? ease(p.tele01) : 1;
    const hit = tele ? 0 : p.since;
    const h = p.hand;
    const out = clamp(hit / 0.12);           // 0 → 1: o golpe dispara
    const back = ease(clamp((hit - 0.12) / 0.4)); // 0 → 1: volta à guarda
    P.eye = def.color === 'vermelho' ? 1 : P.eye;
    switch (atk) {
      case 'patada': case 'contrape': {
        const i = h < 0 ? 0 : 1;
        if (tele) {
          P.gx[i] = h * (50 + 22 * w); P.gy[i] = -132 - 26 * w; P.gs[i] = 1 + 0.14 * w; P.grot[i] = -h * 0.5 * w;
          P.brot = -h * 0.08 * w; P.bx = h * 12 * w; P.hrot = -h * 0.12 * w;
        } else {
          // dispara na câmera (a luva cresce 2,8× e vai para o canto do Karimbo)
          const e = easeOut(out) * (1 - back);
          P.gx[i] = mix(h * 72, -62, e); P.gy[i] = mix(-158, -58, e); P.gs[i] = 1.14 + 1.7 * e; P.grot[i] = mix(-h * 0.5, h * 0.3, e); P.gview[i] = e > 0.2 ? 2 : 0;
          P.glate[i] = e > 0.05;
          P.bsy = 1 + 0.06 * e; P.brot = h * 0.12 * e; P.bx = -h * 8 * e; P.hrot = h * 0.1 * e;
          P.flash = e > 0.5 ? 0.5 : 0;
        }
        break;
      }
      case 'cabecada': {
        if (tele) {
          // tira o chapéu com a mão e inclina a cabeça para trás
          P.hat = 1; P.hatX = -52 * w; P.hatY = -168 - 14 * w; P.hatRot = -0.5 * w;
          P.gx[0] = -52 * w - 8; P.gy[0] = -154 - 10 * w; P.gs[0] = 1.05;
          P.hrot = 0.28 * w; P.hy = -8 * w; P.hs = 1 - 0.08 * w; P.bsy = 1 - 0.03 * w; P.eye = 1;
        } else {
          const e = easeOut(out) * (1 - back);
          P.hat = 1; P.hatX = -52 * (1 - back); P.hatY = -176 + 20 * back; P.hatRot = -0.5 * (1 - back);
          P.gx[0] = -52 * (1 - back) - 8 + back * 20; P.gy[0] = -154 + 30 * back; P.gs[0] = 1.05;
          P.hs = 1 + 0.7 * e; P.hy = 28 * e; P.hrot = -0.36 * e; P.headLate = e > 0.05; P.jaw = 0.1 * e;
          P.flash = e > 0.6 ? 0.45 : 0;
        }
        break;
      }
      case 'rabada': {
        if (tele) {
          // gira o tronco, o rabo sobe e levanta poeira na base
          P.bsx = 1 - 0.18 * w; P.brot = h * -0.08 * w; P.tail = -0.2 - 1.15 * w; P.tailSide = h; P.dust = w; P.hy = 3 * w; P.hrot = h * 0.1 * w;
          P.gx[0] = -52 - 10 * w; P.gy[0] = -122; P.gx[1] = 52 + 10 * w; P.gy[1] = -122;
        } else {
          const e = easeOut(out), r = back;
          P.tail = mix(-1.35, 1.25, e); P.tailBig = e * (1 - r); P.tailSide = h; P.bsx = 0.84 + 0.16 * r; P.brot = h * 0.16 * e * (1 - r);
          P.hrot = -h * 0.12 * e;
        }
        break;
      }
      case 'mordidona': {
        if (tele) {
          // a cabeça sobe e a boca abre em duas batidas
          P.hy = -16 * w; P.hs = 1 - 0.1 * w; P.hrot = 0; P.jaw = ease(clamp(w * 1.15)); P.eye = 1; P.bsy = 1 - 0.04 * w;
          P.gx[0] = -64 - 10 * w; P.gy[0] = -120; P.gx[1] = 64 + 10 * w; P.gy[1] = -120;
          P.tail = 0.4 + Math.sin(t * 30) * 0.15 * w; // o rabo treme de ansiedade
        } else {
          const e = easeOut(out), r = back;
          P.hs = mix(0.9, 2.3, e) * (1 - r) + r; P.hy = mix(-16, 66, e) * (1 - r); P.jaw = hit < 0.14 ? 1 : clamp(1 - (hit - 0.14) / 0.1) * (1 - r);
          P.headLate = e * (1 - r) > 0.04; P.eye = 1; P.flash = hit > 0.12 && hit < 0.22 ? 0.55 : 0;
        }
        break;
      }
      case 'chapelada': {
        const first = idx === 0;
        const i = 1;
        if (tele && first) {
          // levanta o chapéu com a mão direita
          P.hat = 1; P.hatX = 58 * w; P.hatY = -150 - 34 * w; P.hatRot = 0.5 * w + Math.sin(t * 26) * 0.05 * w;
          P.gx[i] = 58 * w; P.gy[i] = -140 - 30 * w; P.gs[i] = 1.1; P.brot = -0.06 * w; P.hrot = 0.1 * w;
        } else if (tele) {
          // o chapéu volta (bumerangue): vem da câmera para a cabeça
          const r = w;
          P.hat = 2; P.hatS = mix(2.2, 1, r); P.hatX = mix(-46, 0, r); P.hatY = mix(-20, -190, r); P.hatRot = mix(1.4, 0, r); P.headLate = false;
          P.hatS = P.hatS; P.glate[i] = false;
        } else if (first) {
          // lança: o chapéu voa na direção da câmera, girando
          const e = easeOut(out) * (1 - back * 0.1);
          P.hat = 2; P.hatS = 1 + 1.4 * e; P.hatX = mix(58, -46, e); P.hatY = mix(-190, -20, e); P.hatRot = e * 5.5;
          P.gx[i] = mix(58, 20, e); P.gy[i] = mix(-170, -130, e); P.gs[i] = 1.1; P.grot[i] = 0;
          P.glate[1] = false; P.flash = e > 0.6 ? 0.45 : 0;
        } else {
          // segundo golpe: o chapéu encosta na cabeça e pousa
          const e = 1 - ease(clamp(hit / 0.3));
          P.hat = e > 0.02 ? 2 : 0; P.hatS = 1 + 0.5 * e; P.hatX = -24 * e; P.hatY = mix(-190, -120, e); P.hatRot = e * 2;
        }
        // o chapéu em voo sempre vai na passada tardia
        break;
      }
      case 'giro': {
        // gira de lado a lado com o rabo varrendo: o lado muda a cada golpe
        const sideOf = ATTACKS.giro.sides?.[idx] ?? 1;
        if (tele) {
          P.bsx = 1 - 0.36 * w; P.brot = sideOf * 0.1 * w; P.tail = -0.4 - 0.9 * w; P.tailSide = sideOf; P.dust = w * 0.6; P.hrot = sideOf * 0.14 * w; P.eye = 1;
          P.gx[0] = -64; P.gx[1] = 64; P.gy[0] = P.gy[1] = -116;
        } else {
          const e = easeOut(out), r = back;
          P.bsx = 0.64 + 0.36 * r; P.tail = mix(-1.3, 1.2, e); P.tailBig = e * (1 - r); P.tailSide = sideOf; P.brot = sideOf * 0.2 * e * (1 - r); P.eye = 1;
        }
        break;
      }
    }
  }
  // reação ao soco que levou: a cabeça sacode no sentido do golpe
  if (p.react > 0.01) {
    const r = p.react, s = p.reactSide;
    switch (p.reactTier) {
      case 0: P.hx += -s * 3 * r; P.hrot += -s * 0.07 * r; break;
      case 1: P.hs *= 1 - 0.07 * r; P.hy += 3 * r; P.bsy *= 1 - 0.02 * r; break;
      case 2: P.hx += -s * 12 * r; P.hrot += -s * 0.34 * r; P.bx += -s * 6 * r; P.jaw = Math.max(P.jaw, 0.25 * r); break;
      default: P.hy += -9 * r; P.hrot += s * 0.18 * r; P.hs *= 1 + 0.04 * r; P.jaw = Math.max(P.jaw, 0.4 * r); P.by += -3 * r; break;
    }
    P.eye = P.eye === 0 ? 3 : P.eye; // aperta os olhos quando apanha
  }
  // coloca a suavização no ponto atual (nada de "pulo" depois do golpe)
  if (atk) for (let i = 0; i < 2; i++) { sm.gx[i] = P.gx[i]; sm.gy[i] = P.gy[i]; sm.gs[i] = P.gs[i]; }
}

// ───────────────────────── desenho ─────────────────────────
/**
 * Braço do jacaré (de frente): a câmera está à frente e um pouco acima, então a frente do lutador (z) vem para
 * a câmera (z < 0) e o que chega perto aparece mais embaixo. O cotovelo fica baixo e para fora da guarda.
 */
const CAMG: Cam = { kx: 0, ky: -0.3, F: 300 };
const BONE_GA = 44, BONE_GB = 42, SHOULDER_G = { x: 46, y: -118 };
const gArm = newArm();
/** a boca (focinho + mandíbula fechada) em coordenadas do corpo do jacaré: nenhuma guarda aberta pode passar por aqui */
export const GATOR_MOUTH = { x0: -37, x1: 37, y0: -140, y1: -104 };
/** Geometria 2D (tela) do braço do jacaré para uma luva em (gx, gy) com escala gs: cotovelo e punho. Usada pelo desenho e pelos testes. */
export function gatorArmGeom(sd: -1 | 1, gx: number, gy: number, gsc: number) {
  const z = gloveZ(gsc);
  solveArm(gArm, sd * SHOULDER_G.x, SHOULDER_G.y, 0, gx - CAMG.kx * z, gy + 6 * gsc - CAMG.ky * z, z, BONE_GA, BONE_GB, sd * 0.35, 1, -0.5, 1.5);
  return { sx: sd * SHOULDER_G.x, sy: SHOULDER_G.y, ex: gArm.ex + CAMG.kx * gArm.ez, ey: gArm.ey + CAMG.ky * gArm.ez, wx: gArm.wx + CAMG.kx * gArm.wz, wy: gArm.wy + CAMG.ky * gArm.wz, stretch: gArm.stretch };
}
/** profundidade do punho: a luva da guarda fica um pouco à frente; a que voa para a câmera, bem mais */
const gloveZ = (scale: number) => -34 - 130 * Math.max(0, scale - 0.95);

function limb(g: CanvasRenderingContext2D, x0: number, y0: number, w0: number, x1: number, y1: number, w1: number, light: string, dark: string) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  const path = (grow: number) => {
    g.beginPath();
    g.moveTo(x0 + nx * (w0 / 2 + grow), y0 + ny * (w0 / 2 + grow));
    g.lineTo(x1 + nx * (w1 / 2 + grow), y1 + ny * (w1 / 2 + grow));
    g.arc(x1, y1, w1 / 2 + grow, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
    g.lineTo(x0 - nx * (w0 / 2 + grow), y0 - ny * (w0 / 2 + grow));
    g.arc(x0, y0, w0 / 2 + grow, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true);
    g.closePath();
  };
  g.fillStyle = OUT; path(2.6); g.fill();
  const gr = g.createLinearGradient(x0 + nx * w0 / 2, y0 + ny * w0 / 2, x0 - nx * w0 / 2, y0 - ny * w0 / 2);
  gr.addColorStop(0, light); gr.addColorStop(1, dark);
  g.fillStyle = gr; path(0); g.fill();
}

/** Rabo em segmentos afunilados com espinhos; `big` = varrendo por cima (passada tardia, maior). */
function drawTail(g: CanvasRenderingContext2D, rootX: number, rootY: number, ang: number, side: number, scale: number, t: number) {
  const N = 9;
  let x = rootX, y = rootY, a = side > 0 ? Math.PI * 0.82 : Math.PI * 0.18;
  a += (side > 0 ? -1 : 1) * ang * 0.9;
  let w = 30 * scale;
  for (let i = 0; i < N; i++) {
    const wave = Math.sin(t * 3 + i * 0.7) * 0.07 * (i / N);
    a += (side > 0 ? 1 : -1) * (0.13 + wave);
    const len = 17 * scale;
    const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
    const nw = w * 0.82;
    limb(g, x, y, w, nx, ny, nw, i % 2 ? GREEN : GREEN_L, GREEN_D);
    // espinhos no dorso
    if (i % 2 === 0 && i < N - 2) {
      g.fillStyle = '#3a5a28';
      const px = x + Math.cos(a - Math.PI / 2) * (w / 2), py = y + Math.sin(a - Math.PI / 2) * (w / 2);
      g.beginPath(); g.moveTo(px - 3.5 * scale, py); g.lineTo(px + Math.cos(a - Math.PI / 2) * 8 * scale, py + Math.sin(a - Math.PI / 2) * 8 * scale); g.lineTo(px + 3.5 * scale, py); g.closePath(); g.fill();
    }
    x = nx; y = ny; w = nw;
  }
}

/** Estrelinhas girando sobre a cabeça (tonto/grogue). */
function drawStars(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  g.fillStyle = '#ffd23a';
  for (let i = 0; i < 3; i++) {
    const a = t * 3.2 + (i * TAU) / 3, sx = x + Math.cos(a) * 36, sy = y + Math.sin(a) * 9;
    g.beginPath();
    for (let j = 0; j < 10; j++) { const an = -Math.PI / 2 + (j * Math.PI) / 5, r = j % 2 ? 2.8 : 6.2; g.lineTo(sx + Math.cos(an) * r, sy + Math.sin(an) * r); }
    g.closePath(); g.fill();
    g.strokeStyle = OUT; g.lineWidth = 0.8; g.stroke();
  }
}

/** Poeira levantada pelo rabo (poucas elipses que crescem e somem). */
function drawDust(g: CanvasRenderingContext2D, x: number, y: number, amt: number, t: number) {
  g.fillStyle = 'rgba(214,190,150,.55)';
  for (let i = 0; i < 4; i++) {
    const k = ((t * 1.7 + i * 0.25) % 1), r = (5 + 12 * k) * amt;
    g.globalAlpha = (1 - k) * 0.7 * amt;
    g.beginPath(); g.arc(x + (i - 1.5) * 12 + Math.sin(t * 3 + i) * 3, y - k * 20, r, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
}

function drawHead(g: CanvasRenderingContext2D, b: Parts, x: number, y: number, scale: number, rot: number, jaw: number, eye: number, t: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(scale, scale);
  const open = jaw;
  // boca aberta por trás da parte de cima
  if (open > 0.03) {
    const mh = 4 + open * 30;
    g.fillStyle = OUT; g.beginPath(); g.ellipse(0, 30 + mh * 0.2, 31, mh * 0.55 + 3, 0, 0, TAU); g.fill();
    g.fillStyle = '#6a1424'; g.beginPath(); g.ellipse(0, 30 + mh * 0.2, 28.6, mh * 0.55, 0, 0, TAU); g.fill();
    g.fillStyle = '#e8627a'; g.beginPath(); g.ellipse(0, 36 + mh * 0.3, 14, mh * 0.2, 0, 0, TAU); g.fill();
  }
  drawSpr(g, b.jaw, 0, 28 + open * 26, { sy: 1 + open * 0.1 });
  drawSpr(g, b.headUp, 0, 0, {});
  // olhos sobre os bumbos (o tonto gira a espiral)
  const kind = eye === 2 ? (Math.floor(t * 5) % 2 ? 5 : 2) : eye;
  for (const s of [-1, 1]) drawSpr(g, b.eyes[kind], s * 27, -27, { sx: s > 0 && (kind === 2 || kind === 5) ? -1 : 1 });
  g.restore();
}

/**
 * Desenha o jacaré com os pés em (x, y) e escala `s`. `late`: passada tardia (as partes que vão por cima do
 * Karimbo no impacto); sem `late`, o resto do corpo.
 */
export function drawGatorBoxer(g: CanvasRenderingContext2D, x: number, y: number, s: number, p: GatorPose, k: number, late: boolean, dt = 1 / 60) {
  const bk = Math.max(1.2, Math.round(s * k * 1.15 * 4) / 4);
  if (!parts || partsK !== bk || partsChamp !== p.champion) { parts = bakeParts(bk, p.champion); partsK = bk; partsChamp = p.champion; }
  const b = parts;
  if (!late) computePose(p, dt);
  const gs = 'jacare' as const;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  if (!late) {
    // sombra
    g.fillStyle = 'rgba(8,16,10,.38)'; g.beginPath(); g.ellipse(P.bx * 0.4, 3, 64 - Math.abs(P.by) * 2, 9, 0, 0, TAU); g.fill();
    // rabo (atrás do corpo)
    if (P.tailBig < 0.15) drawTail(g, -4 + P.bx * 0.5, -52, P.tail, P.tailSide, 1, p.time);
    if (P.dust > 0.05) drawDust(g, P.tailSide > 0 ? -24 : 24, -6, P.dust, p.time);
    // pernas e pés
    for (const sd of [-1, 1] as const) {
      limb(g, sd * 17 + P.bx * 0.5, -42, 22, sd * 28, -9, 16, sd < 0 ? GREEN_D : GREEN, GREEN_D);
      drawSpr(g, b.foot, sd * 31, -2, { flip: sd < 0 });
    }
    g.save();
    g.translate(P.bx, P.by);
    g.rotate(P.brot);
    g.scale(P.bsx, P.bsy);
    drawSpr(g, b.shorts, 0, -68);
    drawSpr(g, b.torso, 0, -96);
    drawSpr(g, b.bell, 0, -128);
    // braços (ombro → cotovelo → punho em 3D); a luva só entra aqui se não for da passada tardia
    for (let i = 0; i < 2; i++) {
      const sd: -1 | 1 = i === 0 ? -1 : 1;
      const { sx, sy, ex, ey, wx, wy } = gatorArmGeom(sd, P.gx[i], P.gy[i], P.gs[i]);
      const fe = depthScale(gArm.ez, CAMG.F), fw = depthScale(gArm.wz, CAMG.F);
      limb(g, sx, sy, 28, ex, ey, 24 * fe, GREEN_L, GREEN);
      limb(g, ex, ey, 24 * fe, wx, wy, (17 + 5 * Math.min(1.6, P.gs[i])) * fw, GREEN, GREEN_D);
      g.fillStyle = GREEN; g.beginPath(); g.arc(ex, ey, 12 * fe - 0.4, 0, TAU); g.fill();
    }
    // chapéu de palha na nuca (atrás da cabeça: os bumbos dos olhos ficam à vista); na mão ou caído nos ataques
    if (P.hat === 0 && !P.headLate) {
      g.save(); g.translate(P.hx, -156 + P.hy); g.rotate(P.hrot); g.scale(P.hs, P.hs);
      drawSpr(g, b.hat, P.hatX, -43 + P.hatY, { rot: P.hatRot });
      g.restore();
    }
    if (P.hat === 1) drawSpr(g, b.hat, P.hatX, P.hatY, { rot: P.hatRot, sx: 0.9, sy: 0.9 });
    if (P.hat === 3) drawSpr(g, b.hat, 74, -8, { rot: 0.4, sx: 0.9, sy: 0.7 });
    // cabeça (e a mandíbula, que abre)
    if (!P.headLate) drawHead(g, b, P.hx, -156 + P.hy, P.hs, P.hrot, P.jaw, P.eye, p.time);
    // luvas (por cima da cabeça nas guardas altas)
    for (let i = 0; i < 2; i++) {
      if (P.glate[i]) continue;
      const sd: -1 | 1 = i === 0 ? -1 : 1;
      drawGlove(g, gs, P.gview[i] === 2 ? 'quente' : P.gview[i] === 1 ? 'perfil' : 'costas', k * s * 1.3, P.gx[i], P.gy[i], 48 * P.gs[i], P.grot[i], 1, sd > 0);
    }
    if (P.stars) drawStars(g, P.hx, -200 + P.hy, p.time);
    g.restore();
  } else {
    // ───── passada tardia: por cima do Karimbo
    g.translate(P.bx, P.by);
    if (P.tailBig > 0.15) {
      // o rabo varre a tela inteira de um lado ao outro
      g.save();
      g.globalAlpha = 0.96;
      drawTail(g, -4, -52, P.tail, P.tailSide, 1 + 1.5 * P.tailBig, p.time);
      g.restore();
    }
    if (P.headLate) drawHead(g, b, P.hx, -156 + P.hy, P.hs, P.hrot, P.jaw, P.eye, p.time);
    if (P.hat === 2) drawSpr(g, b.hat, P.hatX, P.hatY, { rot: P.hatRot, sx: P.hatS, sy: P.hatS });
    for (let i = 0; i < 2; i++) {
      if (!P.glate[i]) continue;
      const sd: -1 | 1 = i === 0 ? -1 : 1;
      drawGlove(g, gs, P.gview[i] === 2 ? 'quente' : 'costas', k * s * 1.3 * Math.min(2.2, P.gs[i]), P.gx[i], P.gy[i], 48 * P.gs[i], P.grot[i], 1, sd > 0);
    }
  }
  g.restore();
}

/** O impacto de um ataque do jacaré cobre a tela com um clarão curto: a cena lê isto depois do desenho. */
export const gatorFlash = () => P.flash;
