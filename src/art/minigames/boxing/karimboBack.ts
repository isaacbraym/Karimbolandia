/**
 * O Karimbo visto de COSTAS (câmera atrás dele, estilo Punch-Out!!): nuca e cabelo procedurais (não
 * há foto de costas), as orelhas da foto ABERTAS PARA OS LADOS (sprites espelhados, com o tom do verso
 * assado uma vez), ombros, costas com o traje equipado e luvas vermelhas. Corpo, luvas e orelhas são
 * assados uma vez por traje; por quadro só há cópias de imagem, rotação e os traços dos braços.
 */
import { makeCanvas, type Sprite } from '../../kit';
import type { KarimboArt } from '../../karimbo';
import type { SkinId } from '../../../core/skinCatalog';
import type { KState } from '../../../game/minigames/boxing/sim/match';
import { PUNCHES } from '../../../game/minigames/boxing/sim/rules';

const SHIRT: Record<SkinId, [string, string]> = {
  classic: ['#d2b892', '#39f0ff'], explorer: ['#728848', '#c2a675'], neon: ['#25243f', '#39f0ff'],
  diver: ['#1d3f63', '#ffb52e'], atlante: ['#178a80', '#ffe27a'], jacare: ['#5f8a45', '#e2d8a4'],
};
const SKIN = '#c98a66';
const HAIR = '#1b1210';
const K = 2.5; // resolução do bake

export interface BackPose {
  /** −1 esquerda … +1 direita (intensidade): a esquiva desloca e inclina o corpo */
  dodge: number;
  hurt: number;
  guard: boolean;
  /** golpe em curso: lado e progresso 0..1 */
  punchSide: 'L' | 'R' | null;
  punchK: number;
  punchReach: number;
  /** giro de 360° da ORELHADA (rad; 0 = sem giro) e crescimento das orelhas (1 = normal) */
  spin: number;
  ears: number;
  /** queda de costas (derrota) 0..1 */
  fall: number;
  time: number;
}

interface BackBake { body: HTMLCanvasElement; glove: HTMLCanvasElement; gloveHot: HTMLCanvasElement; earNear: HTMLCanvasElement; earFar: HTMLCanvasElement }
const cache = new Map<string, BackBake>();
// o corpo cobre x ∈ [-130, 130], y ∈ [-165, 195] em unidades lógicas, origem na base do pescoço
const BX = 130, BY = 165, BW = 260, BH = 360;

function gloveCanvas(hot: boolean) {
  const c = makeCanvas(56 * K, 52 * K), g = c.getContext('2d')!;
  g.scale(K, K);
  g.translate(28, 26);
  g.fillStyle = '#170f2e';
  g.beginPath(); g.ellipse(0, 0, 25, 23, 0, 0, Math.PI * 2); g.fill();
  const gr = g.createRadialGradient(-7, -8, 3, 0, 0, 24);
  gr.addColorStop(0, hot ? '#ff9a8a' : '#ff6a5a');
  gr.addColorStop(1, '#c4202e');
  g.fillStyle = gr;
  g.beginPath(); g.ellipse(0, 0, 22, 20, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.4)';
  g.beginPath(); g.ellipse(-8, -9, 8, 4, -0.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f3efe2';
  g.fillRect(-22, 14, 44, 7);
  return c;
}

function tone(s: Sprite) {
  const c = makeCanvas(s.c.width, s.c.height), g = c.getContext('2d')!;
  g.drawImage(s.c, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(95,40,30,.16)';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

function bodyCanvas(skin: SkinId) {
  const [shirt, stripe] = SHIRT[skin] ?? SHIRT.classic;
  const c = makeCanvas(BW * K, BH * K), g = c.getContext('2d')!;
  g.scale(K, K);
  g.translate(BX, BY);
  // costas e ombros
  g.fillStyle = '#170f2e';
  g.beginPath(); g.moveTo(-112, 66); g.quadraticCurveTo(-120, 4, -66, -6); g.lineTo(66, -6); g.quadraticCurveTo(120, 4, 112, 66); g.lineTo(100, 190); g.lineTo(-100, 190); g.closePath(); g.fill();
  g.fillStyle = shirt;
  g.beginPath(); g.moveTo(-106, 66); g.quadraticCurveTo(-113, 8, -64, -1); g.lineTo(64, -1); g.quadraticCurveTo(113, 8, 106, 66); g.lineTo(95, 190); g.lineTo(-95, 190); g.closePath(); g.fill();
  const gr = g.createLinearGradient(0, -10, 0, 190);
  gr.addColorStop(0, 'rgba(255,255,255,.1)');
  gr.addColorStop(1, 'rgba(0,0,0,.28)');
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, 14); g.lineTo(0, 190); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.14)';
  g.beginPath(); g.ellipse(-48, 46, 34, 20, -0.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = stripe;
  g.fillRect(-100, 20, 34, 6); g.fillRect(66, 20, 34, 6);
  if (skin === 'jacare') {
    g.fillStyle = '#3f6430';
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-14, 22 + i * 24); g.lineTo(0, 8 + i * 24); g.lineTo(14, 22 + i * 24); g.closePath(); g.fill(); }
  }
  // pescoço
  g.fillStyle = '#170f2e'; g.fillRect(-27, -42, 54, 46);
  g.fillStyle = SKIN; g.fillRect(-24, -42, 48, 44);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-24, -4, 48, 8);
  // cabeça de costas: cabelo escuro com brilho
  g.fillStyle = '#170f2e';
  g.beginPath(); g.ellipse(0, -96, 49, 54, 0, 0, Math.PI * 2); g.fill();
  const hg = g.createRadialGradient(-14, -118, 6, 0, -96, 52);
  hg.addColorStop(0, '#3a2820');
  hg.addColorStop(1, HAIR);
  g.fillStyle = hg;
  g.beginPath(); g.ellipse(0, -96, 46, 51, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.12)';
  g.beginPath(); g.ellipse(-14, -122, 18, 6, -0.3, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.2;
  g.beginPath(); g.arc(0, -96, 36, 2.1, 2.9); g.moveTo(26, -70); g.quadraticCurveTo(0, -56, -26, -70); g.stroke();
  return c;
}

function baked(art: KarimboArt, skin: SkinId): BackBake {
  let b = cache.get(skin);
  if (!b) {
    b = { body: bodyCanvas(skin), glove: gloveCanvas(false), gloveHot: gloveCanvas(true), earNear: tone(art.heads.earNear), earFar: tone(art.heads.earFar) };
    cache.set(skin, b);
  }
  return b;
}

/** (x, y) = base do pescoço, `s` = escala (≈ largura da cena / 640). */
export function drawKarimboBack(g: CanvasRenderingContext2D, art: KarimboArt, skin: SkinId, x: number, y: number, s: number, p: BackPose) {
  const b = baked(art, skin);
  const shirt = (SHIRT[skin] ?? SHIRT.classic)[0];
  const dx = p.dodge * 62 * s;
  const rot = p.dodge * 0.16 + p.fall * 0.9 + (p.hurt > 0 ? Math.sin(p.time * 60) * 0.03 : 0);
  const sx = p.spin ? Math.cos(p.spin) : 1;
  g.save();
  g.translate(x + dx, y + p.fall * 90 * s);
  g.rotate(rot);
  g.scale(s * (Math.abs(sx) < 0.15 ? 0.15 * Math.sign(sx || 1) : sx), s * (1 + p.fall * 0.25));
  g.drawImage(b.body, -BX, -BY, BW, BH);
  // orelhas abertas PARA OS LADOS (por cima da cabeça, saindo da silhueta); crescem na ORELHADA
  const hd = art.heads;
  const ew = hd.earNear.w * 4.2 * p.ears, eh = hd.earNear.h * 4.2 * (1 + (p.ears - 1) * 0.25);
  const flap = p.ears > 1.2 ? Math.sin(p.time * 7) * 0.05 : 0;
  for (const side of [-1, 1] as const) {
    g.save();
    g.translate(side * 50, -86);
    g.rotate(side * (0.3 + flap));
    g.scale(side, 1);
    const spr = side === 1 ? hd.earNear : hd.earFar;
    g.drawImage(side === 1 ? b.earNear : b.earFar, -spr.ox * (ew / spr.w), -spr.oy * (eh / spr.h), ew, eh);
    g.restore();
  }
  // chapéu de caça da skin Jacaré (a cabeça de jacaré, vista de trás)
  const hood = art.variants?.jacare?.hood;
  if (skin === 'jacare' && hood) g.drawImage(hood.c, -hood.ox * 1.7 + 8, -hood.oy * 1.7 - 124, hood.w * 1.7, hood.h * 1.7);
  // braços (traços) e luvas (imagens prontas)
  g.lineCap = 'round';
  for (const side of [-1, 1] as const) {
    const letter = side === -1 ? 'L' : 'R';
    const restX = side * 82, restY = 104;
    let gx = restX, gy = restY, gs = 1;
    if (p.guard) { gx = side * 40; gy = -70; gs = 1.05; }
    if (p.punchSide === letter) {
      const k = Math.sin(Math.min(1, p.punchK) * Math.PI * 0.5);
      gx = restX + (side * -56 - restX) * k;
      gy = restY + (-150 - restY) * k * p.punchReach;
      gs = 1 - 0.42 * k;
    }
    g.strokeStyle = '#170f2e'; g.lineWidth = 36;
    g.beginPath(); g.moveTo(side * 86, 36); g.quadraticCurveTo(side * 112, (36 + gy) / 2, gx, gy); g.stroke();
    g.strokeStyle = shirt; g.lineWidth = 31; g.stroke();
    g.drawImage(p.punchSide === letter && p.punchK > 0.5 ? b.gloveHot : b.glove, gx - 28 * gs, gy - 26 * gs, 56 * gs, 52 * gs);
  }
  g.restore();
}

/** Mapeia o estado do Karimbo na sessão para a pose de desenho. */
export function backPoseOf(k: KState, time: number, extra: { spin?: number; ears?: number; fall?: number } = {}): BackPose {
  let punchK = 0, side: 'L' | 'R' | null = null, reach = 1;
  if (k.action === 'punch' && k.punch) {
    const def = PUNCHES[k.punch];
    side = def.side;
    reach = def.tier === 'gancho' ? 0.8 : def.tier === 'cruzado' ? 0.95 : 1;
    punchK = k.pPhase === 'wind' ? (k.pT / Math.max(1e-6, k.pLen)) * 0.6 : k.pPhase === 'active' ? 1 : 1 - (k.pT / Math.max(1e-6, k.pLen)) * 0.9;
  }
  const dodge = k.action === 'dodge' ? k.dodgeDir * Math.sin(Math.min(1, 1 - k.dodgeT / 0.3) * Math.PI) : 0;
  return { dodge, hurt: k.hurtT, guard: k.guarding, punchSide: side, punchK, punchReach: reach, spin: extra.spin ?? 0, ears: extra.ears ?? 1, fall: extra.fall ?? 0, time };
}
