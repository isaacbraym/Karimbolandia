/**
 * O Karimbo visto de COSTAS (câmera por cima do ombro): a nuca e as orelhas são a FOTO dele
 * (tools/cutout_karimbo_back: sem pescoço, orelhas separadas e ampliadas 1,35×, abertas para os lados e
 * com mola), por cima de costas e ombros desenhados para cada traje (a gola cobre a junção, por isso não
 * há pescoço). Braços de duas partes (cinemática inversa), luvas com perspectiva (encolhem ao esticar,
 * rastro no soco) e as poses do boxe: guarda, retos, cruzados em arco, ganchos por baixo, esquiva,
 * abaixar, apanhar, cair e a ORELHADA (giro com orelhas gigantes e o rosto aparecendo no meio do giro).
 *
 * Tudo é assado uma vez por traje; por quadro são ~12 `drawImage`/traços e nenhuma alocação.
 */
import { makeCanvas, drawSpr, type Sprite } from '../../kit';
import { imageToSprite, outlineSprite } from '../../photo';
import type { KarimboArt } from '../../karimbo';
import type { SkinId } from '../../../core/skinCatalog';
import type { KState } from '../../../game/minigames/boxing/sim/match';
import { PUNCHES, type PunchTier } from '../../../game/minigames/boxing/sim/rules';
import { getBackPhotos } from './backPhotos';
import { drawGlove, type GloveStyle, type GloveView } from './gloves';
import type { BoxLayout } from './layout';

const OUT = '#170f2e';
/** altura da cabeça (nuca ao topo) em unidades do corpo; a base do pescoço é a origem (0,0) */
const HEAD_H = 132;
const HEAD_OVERLAP = 18;
const EAR_K = 1.55;

interface SkinLook { shirt: string; shirt2: string; stripe: string; sleeve: 'short' | 'long' | 'elbow'; glow?: string }
const LOOK: Record<SkinId, SkinLook> = {
  classic: { shirt: '#d2b892', shirt2: '#b69a72', stripe: '#39f0ff', sleeve: 'short' },
  explorer: { shirt: '#728848', shirt2: '#566a34', stripe: '#c2a675', sleeve: 'elbow' },
  neon: { shirt: '#25243f', shirt2: '#14132a', stripe: '#39f0ff', sleeve: 'long', glow: '#39f0ff' },
  diver: { shirt: '#1d3f63', shirt2: '#122a45', stripe: '#ffb52e', sleeve: 'long' },
  atlante: { shirt: '#178a80', shirt2: '#0e6a62', stripe: '#ffe27a', sleeve: 'elbow' },
  jacare: { shirt: '#5f8a45', shirt2: '#3f6430', stripe: '#e2d8a4', sleeve: 'elbow' },
};

export interface BackPose {
  /** −1 esquerda … +1 direita (intensidade): a esquiva desloca e inclina o corpo */
  dodge: number;
  /** abaixar 0..1 */
  duck: number;
  /** apanhando 0..1 (recuo e tremida) */
  hurt: number;
  guard: boolean;
  /** golpe em curso */
  punch: { side: 'L' | 'R'; tier: PunchTier; phase: 'wind' | 'active' | 'recover'; k: number } | null;
  /** giro de 360° da ORELHADA (rad; 0 = sem giro) e crescimento das orelhas (1 = normal) */
  spin: number;
  ears: number;
  /** queda de costas 0..1 e progresso de levantar 0..1 */
  fall: number;
  getup: number;
  /** Fúria: orelhas e cabeça brilham */
  fury: boolean;
  time: number;
}

// ───────────────────────── assados ─────────────────────────
interface Bake {
  body: HTMLCanvasElement;
  head: Sprite;
  earL: Sprite; earR: Sprite;
  /** raiz de cada orelha em unidades do corpo (relativa à base do pescoço) */
  rootL: [number, number]; rootR: [number, number];
  skin: string;
  glow: HTMLCanvasElement;
  bk: number;
}
const cache = new Map<string, Bake>();
const BX = 132, BY = 12, BW = 264, BH = 214;

function sampleSkin(img: HTMLImageElement): string {
  const c = makeCanvas(1, 1), g = c.getContext('2d')!;
  g.drawImage(img, img.width * 0.3, img.height * 0.3, img.width * 0.4, img.height * 0.4, 0, 0, 1, 1);
  const d = g.getImageData(0, 0, 1, 1).data;
  return `rgb(${d[0]},${d[1]},${d[2]})`;
}

function bodyCanvas(skin: SkinId, bk: number): HTMLCanvasElement {
  const lk = LOOK[skin] ?? LOOK.classic;
  const c = makeCanvas(Math.ceil(BW * bk), Math.ceil(BH * bk));
  const g = c.getContext('2d')!;
  g.scale(bk, bk);
  g.translate(BX, BY);
  g.lineJoin = 'round';
  // silhueta: trapézio, ombros arredondados, desce além da tela
  const path = (grow: number) => {
    g.beginPath();
    g.moveTo(-30 - grow, -4);
    g.quadraticCurveTo(-74, 6, -106 - grow, 34 - grow * 0.4);
    g.quadraticCurveTo(-128 - grow, 52, -122 - grow, 92);
    g.lineTo(-112 - grow, 200);
    g.lineTo(112 + grow, 200);
    g.lineTo(122 + grow, 92);
    g.quadraticCurveTo(128 + grow, 52, 106 + grow, 34 - grow * 0.4);
    g.quadraticCurveTo(74, 6, 30 + grow, -4);
    g.closePath();
  };
  g.fillStyle = OUT; path(3); g.fill();
  const gr = g.createLinearGradient(0, -4, 0, 200);
  gr.addColorStop(0, lk.shirt); gr.addColorStop(1, lk.shirt2);
  g.fillStyle = gr; path(0); g.fill();
  g.save(); path(0); g.clip();
  // luz no ombro e sombra no centro das costas
  g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.ellipse(-62, 52, 38, 22, -0.45, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.ellipse(64, 56, 30, 18, 0.45, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.26)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 14); g.lineTo(0, 200); g.stroke();
  // omoplatas
  g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(-18, 64); g.quadraticCurveTo(-50, 72, -64, 104); g.stroke();
  g.beginPath(); g.moveTo(18, 64); g.quadraticCurveTo(50, 72, 64, 104); g.stroke();
  // costura dos braços (cava)
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(-106, 36); g.quadraticCurveTo(-92, 76, -100, 130); g.stroke();
  g.beginPath(); g.moveTo(106, 36); g.quadraticCurveTo(92, 76, 100, 130); g.stroke();
  switch (skin) {
    case 'explorer':
      g.fillStyle = '#8a6a3c'; // alças do colete cruzando as costas e dois bolsos
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 20, 4); g.lineTo(s * 40, 4); g.lineTo(s * -4, 130); g.lineTo(s * -24, 130); g.closePath(); g.fill(); }
      g.fillStyle = '#566a34'; g.fillRect(-78, 120, 52, 40); g.fillRect(26, 120, 52, 40);
      g.strokeStyle = '#c2a675'; g.lineWidth = 1.6; g.strokeRect(-78, 120, 52, 40); g.strokeRect(26, 120, 52, 40);
      break;
    case 'neon':
      g.fillStyle = lk.stripe; g.fillRect(-3, 8, 6, 192);
      g.fillStyle = 'rgba(57,240,255,.28)'; g.fillRect(-7, 8, 14, 192);
      g.fillStyle = '#b86bff'; g.fillRect(-100, 62, 24, 5); g.fillRect(76, 62, 24, 5);
      break;
    case 'diver':
      // cilindro de ar nas costas, alças e faixas laranja do traje
      g.fillStyle = '#a8b4c4'; g.fillRect(-26, 40, 52, 140);
      g.fillStyle = '#cfd8e4'; g.fillRect(-26, 40, 14, 140);
      g.strokeStyle = OUT; g.lineWidth = 2.4; g.strokeRect(-26, 40, 52, 140);
      g.fillStyle = lk.stripe; g.fillRect(-26, 78, 52, 8); g.fillRect(-26, 128, 52, 8);
      g.fillStyle = '#e8262e'; g.fillRect(-7, 30, 14, 14); g.fillStyle = OUT; g.fillRect(-9, 26, 18, 6);
      g.fillStyle = lk.stripe; g.fillRect(-84, 6, 10, 150); g.fillRect(74, 6, 10, 150);
      break;
    case 'atlante':
      g.fillStyle = 'rgba(255,226,122,.5)';
      for (let r = 0; r < 7; r++) for (let q = -5; q <= 5; q++) {
        const x = q * 20 + (r % 2 ? 10 : 0), y = 26 + r * 24;
        g.beginPath(); g.arc(x, y, 9, 0, Math.PI); g.fill();
      }
      g.fillStyle = '#ffe27a'; g.fillRect(-4, 6, 8, 194); // nadadeira dorsal
      break;
    case 'jacare':
      g.fillStyle = '#3f6430';
      for (let i = 0; i < 8; i++) { const y = 20 + i * 24; g.beginPath(); g.moveTo(-12, y + 12); g.lineTo(0, y - 12); g.lineTo(12, y + 12); g.closePath(); g.fill(); }
      g.fillStyle = lk.stripe; g.fillRect(-100, 150, 200, 6);
      break;
    default:
      g.fillStyle = lk.stripe; g.fillRect(-100, 64, 34, 5); g.fillRect(66, 64, 34, 5); // listras da camiseta
  }
  g.restore();
  return c;
}

function bakeFor(art: KarimboArt, skin: SkinId, bk: number): Bake | null {
  const ph = getBackPhotos();
  if (!ph) return null;
  const key = `${skin}|${bk}`;
  let b = cache.get(key);
  if (b) return b;
  const f = HEAD_H / ph.meta.head.h;
  const HEAD_W = ph.meta.head.w * f;
  const px = Math.max(1.4, bk * 1.1);
  const head = outlineSprite(imageToSprite(ph.head, HEAD_W, HEAD_H, HEAD_W / 2, HEAD_H - HEAD_OVERLAP, px), 0.7, HEAD_H * 0.86, OUT,
    // sem traço onde a orelha nasce (a cabeça se une à orelha desenhada atrás)
    [{ x: -2, y: HEAD_H * 0.5, w: 18, h: HEAD_H * 0.42 }, { x: HEAD_W - 16, y: HEAD_H * 0.5, w: 18, h: HEAD_H * 0.42 }]);
  const ear = (img: HTMLImageElement, m: BackMeta['earL']): Sprite => {
    const w = m.w * f, h = m.h * f;
    return outlineSprite(imageToSprite(img, w, h, m.rootX * f, m.rootY * f, px), 0.6);
  };
  type BackMeta = NonNullable<ReturnType<typeof getBackPhotos>>['meta'];
  const earL = ear(ph.earL, ph.meta.earL), earR = ear(ph.earR, ph.meta.earR);
  const root = (m: BackMeta['earL']): [number, number] => [(m.headX + m.rootX) * f - HEAD_W / 2, (m.headY + m.rootY) * f - (HEAD_H - HEAD_OVERLAP)];
  const glow = makeCanvas(96, 96), gg = glow.getContext('2d')!;
  const rg = gg.createRadialGradient(48, 48, 2, 48, 48, 48);
  rg.addColorStop(0, 'rgba(255,200,120,.95)'); rg.addColorStop(0.4, 'rgba(255,90,40,.5)'); rg.addColorStop(1, 'rgba(255,60,20,0)');
  gg.fillStyle = rg; gg.fillRect(0, 0, 96, 96);
  b = { body: bodyCanvas(skin, bk), head, earL, earR, rootL: root(ph.meta.earL), rootR: root(ph.meta.earR), skin: sampleSkin(ph.earL), glow, bk };
  cache.set(key, b);
  void art;
  return b;
}

// ───────────────────────── trajetória das luvas ─────────────────────────
const ease = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
interface GloveState { x: number; y: number; sc: number; rot: number; view: GloveView; trail: number }
const gs: [GloveState, GloveState] = [{ x: 0, y: 0, sc: 1, rot: 0, view: 'costas', trail: 0 }, { x: 0, y: 0, sc: 1, rot: 0, view: 'costas', trail: 0 }];
const REST = { L: [-104, -48, 1], R: [84, -16, 0.96] } as const;
const GUARD = { L: [-70, -96, 0.92], R: [68, -96, 0.92] } as const;

/** Posição, tamanho e visão de uma luva em unidades do corpo. `T` = alvo (cabeça do jacaré) em unidades do corpo. */
function glovePos(out: GloveState, side: 'L' | 'R', p: BackPose, T: { x: number; y: number }) {
  const rest = p.guard ? GUARD[side] : REST[side];
  const bob = Math.sin(p.time * 3.2 + (side === 'L' ? 0 : 1.7)) * 3;
  out.x = rest[0]; out.y = rest[1] + bob; out.sc = rest[2]; out.rot = 0; out.view = 'costas'; out.trail = 0;
  const pu = p.punch;
  if (!pu || pu.side !== side) return;
  const dir = side === 'L' ? -1 : 1;
  // ponto de chegada por tipo de golpe e controle da curva
  const hx = T.x, hy = T.y;
  let ex = hx, ey = hy, cx = 0, cy = 0, endSc = 0.56;
  switch (pu.tier) {
    case 'jab': ex = hx - 10; ey = hy + 6; break;
    case 'direto': ex = hx + 10; ey = hy + 6; endSc = 0.54; break;
    case 'cruzado': ex = hx - dir * 30; ey = hy + 12; cx = rest[0] + dir * 170; cy = (rest[1] + ey) / 2 + 20; break;
    case 'gancho': ex = hx - dir * 8; ey = hy + 50; cx = (rest[0] + ex) / 2; cy = rest[1] + 140; endSc = 0.62; break;
  }
  // u: 0 = descanso, 1 = extensão total; no preparo recua (antecipação)
  let u: number;
  if (pu.phase === 'wind') u = -(pu.tier === 'jab' ? 0.12 : pu.tier === 'direto' ? 0.2 : 0.3) * easeOut(pu.k);
  else if (pu.phase === 'active') u = 1 + 0.04 * Math.sin(pu.k * Math.PI);
  else u = 1 - ease(pu.k);
  const uu = Math.max(-0.4, u);
  const t = Math.max(0, Math.min(1, uu));
  let x: number, y: number;
  if (pu.tier === 'jab' || pu.tier === 'direto') { x = rest[0] + (ex - rest[0]) * uu; y = rest[1] + (ey - rest[1]) * uu; }
  else { const q = 1 - t; x = q * q * rest[0] + 2 * q * t * cx + t * t * ex + (uu < 0 ? (ex - rest[0]) * uu : 0); y = q * q * rest[1] + 2 * q * t * cy + t * t * ey + (uu < 0 ? (ey - rest[1]) * uu : 0); }
  out.x = x; out.y = y;
  out.sc = rest[2] + (endSc - rest[2]) * Math.max(0, uu) + (uu < 0 ? 0.08 * -uu : 0);
  out.rot = pu.tier === 'cruzado' ? dir * (-0.9 + 1.4 * t) * Math.sin(Math.PI * Math.min(1, t * 1.1)) : pu.tier === 'gancho' ? -dir * 0.5 * Math.sin(Math.PI * t) : dir * -0.05;
  out.view = pu.phase === 'active' ? 'quente' : pu.tier === 'cruzado' && t > 0.18 && t < 0.88 ? 'perfil' : 'costas';
  out.trail = pu.phase === 'recover' ? 0.35 * (1 - pu.k) : pu.phase === 'active' ? 0.6 : 0.2 * Math.max(0, -uu);
}

// ───────────────────────── desenho ─────────────────────────
interface Tmp { x: number; y: number }
const elbow: Tmp = { x: 0, y: 0 };
const T: Tmp = { x: 0, y: 0 };

/** Duas partes: ombro → cotovelo → pulso (cinemática inversa), cotovelo para baixo e para fora. */
function armIK(sx: number, sy: number, wx: number, wy: number, side: -1 | 1, a: number, b: number) {
  const dx = wx - sx, dy = wy - sy;
  let d = Math.hypot(dx, dy);
  const reach = a + b - 2;
  if (d > reach) { d = reach; }
  const dd = Math.max(Math.abs(a - b) + 2, d);
  const cosA = (a * a + dd * dd - b * b) / (2 * a * dd);
  const ang = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const base = Math.atan2(dy, dx);
  // o cotovelo fica do lado de baixo/fora: gira conforme o lado
  const th = base + side * ang * (dy < 0 ? 1 : -1) * -1;
  elbow.x = sx + Math.cos(th) * a;
  elbow.y = sy + Math.sin(th) * a;
}

/** Membro afunilado (largura w0 → w1) com contorno: dá a perspectiva do braço que se afasta da câmera. */
function limb(g: CanvasRenderingContext2D, x0: number, y0: number, w0: number, x1: number, y1: number, w1: number, color: string) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d, ny = dx / d;
  const draw = (grow: number, c: string) => {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(x0 + nx * (w0 / 2 + grow), y0 + ny * (w0 / 2 + grow));
    g.lineTo(x1 + nx * (w1 / 2 + grow), y1 + ny * (w1 / 2 + grow));
    g.arc(x1, y1, w1 / 2 + grow, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
    g.lineTo(x0 - nx * (w0 / 2 + grow), y0 - ny * (w0 / 2 + grow));
    g.arc(x0, y0, w0 / 2 + grow, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true);
    g.closePath();
    g.fill();
  };
  draw(2.6, OUT);
  draw(0, color);
}

/**
 * Desenha o Karimbo de costas no layout `L` (base do pescoço em L.karimbo). `k` = pixels de tela por
 * unidade lógica; `glove` = estilo das luvas.
 */
export function drawKarimboBack(g: CanvasRenderingContext2D, art: KarimboArt, skin: SkinId, L: BoxLayout, p: BackPose, k: number, glove: GloveStyle = 'karimbo') {
  const s = L.karimbo.s;
  const bk = Math.max(0.75, Math.round(s * k * 1.1 * 4) / 4);
  const b = bakeFor(art, skin, bk);
  if (!b) return;
  const lk = LOOK[skin] ?? LOOK.classic;
  const dodgeX = p.dodge * L.W * 0.12;
  const duck = p.duck;
  const spinS = p.spin ? Math.cos(p.spin) : 1;
  const front = spinS < -0.05;
  const widthK = Math.abs(spinS) < 0.12 ? 0.12 : Math.abs(spinS);
  const hurtShake = p.hurt > 0 ? Math.sin(p.time * 70) * 3 * p.hurt : 0;
  const ax = L.karimbo.x + dodgeX + hurtShake * s;
  const ay = L.karimbo.y + duck * 50 * s + p.hurt * 14 * s + p.fall * 150 * s;
  // alvo em unidades do corpo (a cabeça do jacaré, onde os socos chegam)
  T.x = (L.target.x - L.karimbo.x) / s;
  T.y = (L.head.y - L.karimbo.y) / s;
  g.save();
  g.translate(ax, ay);
  g.rotate(p.dodge * 0.17 + p.fall * 1.05 + (p.getup > 0 ? Math.sin(p.time * 22) * 0.04 * p.getup : 0));
  g.scale(s * (p.spin ? widthK : 1) * (1 + p.hurt * 0.05), s * (1 - duck * 0.12 + p.hurt * 0.04));
  const ug = 1 / 1; void ug;

  // ---- luvas e braços (mais longe da câmera que os ombros): desenhados ANTES do corpo
  const sk = b.skin;
  const sleeveColor = lk.shirt;
  for (let i = 0; i < 2; i++) {
    const side: 'L' | 'R' = i === 0 ? 'L' : 'R';
    const st = gs[i];
    glovePos(st, side, p, T);
    const sgn: -1 | 1 = side === 'L' ? -1 : 1;
    const sx = sgn * 92, sy = 34;
    // pulso = abaixo do punho da luva (a luva é desenhada com a base do cuff em (x, y))
    const wx = st.x, wy = st.y + 8 * st.sc;
    armIK(sx, sy, wx, wy, sgn, 112, 104);
    // braço de cima (manga) e antebraço (pele; manga longa também cobre): afunilam para longe da câmera
    const w0 = 36, wE = 28 * (0.55 + 0.45 * st.sc), wW = 14 + 14 * st.sc;
    const longSleeve = lk.sleeve === 'long';
    const mx = sx + (elbow.x - sx) * 0.55, my = sy + (elbow.y - sy) * 0.55;
    if (lk.sleeve === 'short') { limb(g, sx, sy, w0, mx, my, w0 * 0.88, sleeveColor); limb(g, mx, my, w0 * 0.88, elbow.x, elbow.y, wE, sk); }
    else limb(g, sx, sy, w0, elbow.x, elbow.y, wE, sleeveColor);
    limb(g, elbow.x, elbow.y, wE, wx, wy, wW, longSleeve ? sleeveColor : sk);
    if (lk.sleeve !== 'short' && lk.glow) { g.strokeStyle = lk.glow; g.lineWidth = 3; g.beginPath(); g.moveTo(sx + sgn * -6, sy + 6); g.lineTo(elbow.x, elbow.y); g.stroke(); }
    // rastro do soco: dois fantasmas mais claros atrás
    if (st.trail > 0.05) {
      const px = st.x - (st.x - REST[side][0]) * 0.18, py = st.y - (st.y - REST[side][1]) * 0.18;
      drawGlove(g, glove, 'costas', k * s * 1.3, px, py, 74 * st.sc * 0.95, st.rot, st.trail * 0.45, side === 'R');
    }
    drawGlove(g, glove, st.view, k * s * 1.3, st.x, st.y, 74 * st.sc, st.rot, 1, side === 'R');
  }

  // ---- corpo (costas e ombros)
  g.drawImage(b.body, -BX, -BY, BW, BH);

  // ---- orelhas (atrás da cabeça), abertas para os lados; mola: balançam com o corpo
  const swing = -p.dodge * 0.35 + (p.hurt > 0 ? Math.sin(p.time * 55) * 0.18 * p.hurt : 0) + Math.sin(p.time * 2.3) * 0.025;
  const earK = EAR_K * p.ears;
  const earFlap = p.ears > 1.2 ? Math.sin(p.time * 8) * 0.06 : 0;
  if (!front) {
    for (const side of [-1, 1] as const) {
      const root = side < 0 ? b.rootL : b.rootR;
      const spr = side < 0 ? b.earL : b.earR;
      drawSpr(g, spr, root[0], root[1] - HEAD_OVERLAP * 0 , { rot: swing + side * (0.02 + earFlap + (p.ears > 1.2 ? 0.28 : 0)), sx: earK * (p.ears > 1.2 ? 1.5 : 1), sy: earK });
    }
  }
  // ---- cabeça (foto de costas, ou a de frente quando o giro da ORELHADA mostra o rosto)
  const headY = -p.duck * 8 + (p.hurt > 0 ? -4 * p.hurt : 0);
  if (p.fury) {
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 + 0.2 * Math.sin(p.time * 14);
    g.drawImage(b.glow, -92, -150, 184, 184);
    g.restore();
  }
  g.save();
  g.translate(0, headY);
  g.rotate(swing * 0.2 + (p.hurt > 0 ? -0.1 * p.hurt : 0));
  if (front) {
    const fh = art.heads.front;
    drawSpr(g, fh, 0, -44, { sx: 2.9, sy: 2.9, rot: 0 });
    for (const side of [-1, 1] as const) drawSpr(g, side < 0 ? art.heads.earNear : art.heads.earFar, side * 54, -34, { rot: side * 0.3, sx: side * earK * 3.2, sy: earK * 3.2 });
  } else drawSpr(g, b.head, 0, 0);
  g.restore();
  // ---- gola do traje: um arco sob a nuca (o Karimbo não tem pescoço de costas)
  g.lineCap = 'round';
  g.strokeStyle = OUT; g.lineWidth = 13; g.beginPath(); g.moveTo(-42, 1); g.quadraticCurveTo(0, 24, 42, 1); g.stroke();
  g.strokeStyle = lk.shirt2; g.lineWidth = 8.4; g.stroke();
  if (skin === 'neon' || skin === 'diver' || skin === 'atlante') { g.strokeStyle = lk.stripe; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-36, 4); g.quadraticCurveTo(0, 25, 36, 4); g.stroke(); }
  // capuz de caça do jacaré (a cabeça de um jacaré vista de trás, por cima do cabelo)
  if (skin === 'jacare' && !front) {
    g.fillStyle = OUT; g.beginPath(); g.ellipse(0, -112 + headY, 42, 24, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#5f8a45'; g.beginPath(); g.ellipse(0, -111 + headY, 38.5, 21, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#3f6430'; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 10 - 4, -111 + headY); g.lineTo(i * 10, -126 + headY + Math.abs(i) * 3); g.lineTo(i * 10 + 4, -111 + headY); g.closePath(); g.fill(); }
  }
  g.restore();
}

/** Mapeia o estado do Karimbo na sessão para a pose de desenho. */
export function backPoseOf(k: KState, time: number, extra: { spin?: number; ears?: number; fall?: number; fury?: boolean } = {}): BackPose {
  let punch: BackPose['punch'] = null;
  if (k.action === 'punch' && k.punch) {
    const def = PUNCHES[k.punch];
    punch = { side: def.side, tier: def.tier, phase: k.pPhase, k: Math.max(0, Math.min(1, k.pT / Math.max(1e-6, k.pLen))) };
  }
  const dodge = k.action === 'dodge' ? k.dodgeDir * Math.sin(Math.min(1, 1 - k.dodgeT / 0.32) * Math.PI) : 0;
  const duck = k.action === 'duck' ? Math.min(1, 1 - Math.max(0, k.duckT) / 0.42 + 0.35) : 0;
  const down = k.action === 'down';
  return {
    dodge, duck, hurt: Math.min(1, k.hurtT / 0.38), guard: k.guarding, punch,
    spin: extra.spin ?? 0, ears: extra.ears ?? 1, fall: extra.fall ?? (down ? 0.8 : 0), getup: down ? k.getup : 0, fury: !!extra.fury, time,
  };
}
