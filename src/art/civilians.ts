/**
 * Civis (moradores da cidade): figuras de ilustração com corpo contínuo (src/art/figure.ts) e rostos
 * assados por aparência em quatro expressões (calmo, falando, medo, alegria). O rig só calcula a
 * pose (pés, mãos, inclinação) — sem peças soltas girando nas juntas. Também assa os balões de fala.
 */
import { bake, drawSpr, OUT, rrPath, type Sprite } from './kit';
import { SOLDIER_SCALE } from './soldiers';
import { SKINS, HAIR_COLORS, CLOTH, SHOES, lookKey, buildDims, type CivLook, type BuildDims } from '../game/civLook';
import { PHRASES, SHOUTS, type CivAct } from '../game/civilians';
import { bakeFace, drawFigure, figureLook, newPose, type FaceHair, type FaceSpec, type FigureLook, type FigurePose } from './figure';

export interface CivArt {
  calm: Sprite;
  talk: Sprite;
  fear: Sprite;
  joy: Sprite;
  look: FigureLook;
  dims: BuildDims;
  pose: FigurePose;
  /** escala final no mundo (as proporções de criança já estão no corpo) */
  scale: number;
}

const cache = new Map<string, CivArt>();
const IRIS = ['#5a3a22', '#2f6d8a', '#3b7a3e', '#7a4f26', '#3a3550', '#8a5a2a'];

/** Assa as peças de cada aparência que existe na fase (chamado no carregamento). */
export function bakeCivilians(looks: (CivLook | undefined)[]) {
  for (const l of looks) {
    if (!l) continue;
    const k = lookKey(l);
    if (!cache.has(k)) cache.set(k, bakeOne(l));
  }
  bakeSpeech();
}

/** Arte de uma aparência já assada (null se não existe: o desenho apenas pula). */
export function civArtFor(look: CivLook | undefined): CivArt | null {
  if (!look) return null;
  return cache.get(lookKey(look)) ?? null;
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Converte a aparência sorteada em rosto + corpo. */
export function civSpecs(l: CivLook): { face: FaceSpec; body: FigureLook } {
  const h = hash(lookKey(l));
  const skin = SKINS[l.skin];
  const hairC = HAIR_COLORS[l.hairColor];
  const top = CLOTH[l.topColor];
  const top2 = CLOTH[l.topColor2];
  const kid = l.build === 'kid';
  const elder = l.build === 'elder';
  const feminine = l.hair === 'long' || l.hair === 'bun' || l.top === 'dress' || l.bottom === 'skirt';
  let hairStyle: FaceHair = l.hair;
  if (l.hair === 'short' && h % 3 === 0) hairStyle = 'spiky';
  if (l.hair === 'curly' && l.skin >= 3 && h % 2 === 0) hairStyle = 'afro';
  if (kid && l.hair === 'bun') hairStyle = 'puffs';
  if (l.hair === 'long' && l.skin >= 4 && h % 3 === 1) hairStyle = 'braids';
  const face: FaceSpec = {
    skin, hair: hairC, hairStyle, accent: top2, iris: IRIS[h % IRIS.length], kid, elder,
    lashes: feminine && !elder,
    beard: kid || feminine ? 'none' : elder ? 'mustache' : l.build === 'strong' && h % 2 ? 'full' : h % 5 === 0 ? 'stubble' : h % 7 === 0 ? 'mustache' : 'none',
    glasses: l.acc === 'glasses', headphones: l.acc === 'headphones',
    earring: feminine && h % 3 === 0 ? '#ffd23a' : undefined,
    freckles: l.skin <= 1 && (l.hairColor === 2 || l.hairColor === 3 || h % 4 === 0),
  };
  const d = buildDims(l.build);
  const slim = l.build === 'slim';
  const strong = l.build === 'strong';
  const short = l.build === 'short';
  const tall = l.build === 'tall';
  const body = figureLook({
    skin, top, top2,
    sleeve: l.top === 'jacket' ? 1 : l.top === 'tank' || l.top === 'dress' ? 0 : 0.5,
    bottom: l.top === 'overalls' ? top : CLOTH[l.bottomColor],
    bottomKind: l.top === 'dress' ? 'dress' : l.bottom === 'skirt' ? 'skirt' : l.bottom === 'shorts' ? 'shorts' : 'pants',
    shoe: SHOES[l.shoe],
    limb: kid ? 2.9 : strong ? 4.1 : slim ? 3 : 3.4,
    thigh: kid ? 6 : tall ? 10.6 : short ? 8.6 : 9.6,
    shin: kid ? 5.6 : tall ? 10 : short ? 8 : 9,
    torso: kid ? 9 : tall ? 12.8 : short ? 11.4 : 12,
    shoulder: kid ? 9.4 : strong ? 15 : slim ? 10.6 : 12.2,
    hip: kid ? 8.4 : strong ? 11.6 : slim ? 9 : feminine ? 11 : 10.2,
    arm: kid ? 5 : tall ? 7.4 : 6.8,
    fore: kid ? 5 : tall ? 7.2 : 6.6,
    headScale: kid ? 1.4 : 1.14 * d.head,
    belly: strong || elder ? 1.2 : 0,
    pack: l.acc === 'backpack' ? CLOTH[(l.topColor2 + 4) % CLOTH.length] : undefined,
    bag: l.acc === 'bag' ? CLOTH[(l.topColor2 + 6) % CLOTH.length] : undefined,
    necklace: feminine && h % 4 === 1 ? '#ffe9a0' : undefined,
  });
  return { face, body };
}

function bakeOne(l: CivLook): CivArt {
  const { face, body } = civSpecs(l);
  const calm = bakeFace(face, 'calm');
  return {
    calm, talk: bakeFace(face, 'talk'), fear: bakeFace(face, 'fear'), joy: bakeFace(face, 'joy'),
    look: body, dims: buildDims(l.build), pose: newPose(calm),
    scale: SOLDIER_SCALE * 0.9 * (l.build === 'kid' ? 1 : buildDims(l.build).k),
  };
}

// ------------------------------------------------------------------ rig animado
export interface CivPoseSrc {
  facing: -1 | 1;
  act: CivAct;
  t: number;
  hop: number;
  crouch: number;
  runPhase: number;
  phase: number;
}

/** Desenha o civil com pés em (x, y). Nada é alocado aqui (a pose é reaproveitada). */
export function drawCivilian(g: CanvasRenderingContext2D, a: CivArt, x: number, y: number, c: CivPoseSrc, talking: boolean) {
  const d = a.dims;
  const P = a.pose;
  const t = c.t;
  const act = c.act;
  const cr = c.crouch;
  const run = act === 'run';
  const air = c.hop > 0.5;
  const tremble = act === 'cower' ? Math.sin(t * 47) * 0.45 : 0;
  const L = a.look;
  const reach = L.arm + L.fore;
  const w = t * 9 + c.phase * 6;
  // base: em pé, respirando, peso alternando de leve
  const sway = Math.sin(t * 1.3 + c.phase * 7);
  P.lean = d.lean + sway * 0.02;
  P.hipDrop = 0;
  P.hipX = sway * 0.4;
  P.breath = act === 'idle' || act === 'help' ? Math.sin(t * 2.4 + c.phase * 6) * 0.025 : 0;
  P.footBX = -2.4;
  P.footBY = 0;
  P.footFX = 2.6;
  P.footFY = 0;
  P.handBX = -2.2 + sway * 0.4;
  P.handBY = reach * 0.9;
  P.handFX = 2.6 - sway * 0.4;
  P.handFY = reach * 0.9;
  P.headTilt = Math.sin(t * 0.9 + c.phase * 9) * 0.04;
  P.head = a.calm;
  switch (act) {
    case 'cheer': {
      const pump = Math.sin(t * 11 + c.phase * 4);
      P.lean = -0.06;
      P.handFX = 4.5 + pump;
      P.handFY = -reach * 0.98 - pump * 0.6;
      P.handBX = -8;
      P.handBY = -reach * 0.5 + pump;
      P.headTilt = -0.12;
      P.head = a.joy;
      break;
    }
    case 'help':
      // acena com os dois braços: "aqui, Karimbo!"
      P.handFX = 6.5 + Math.sin(w) * 2.6;
      P.handFY = -reach * 0.96;
      P.handBX = -6 - Math.sin(w) * 2.6;
      P.handBY = -reach * 0.9;
      P.headTilt = -0.08 + Math.sin(w) * 0.04;
      P.head = a.talk;
      break;
    case 'run': {
      const ph = c.runPhase;
      const s = Math.sin(ph);
      P.lean = 0.2;
      P.footFX = 1 + s * 6;
      P.footFY = -Math.max(0, -Math.cos(ph)) * 3.4;
      P.footBX = 1 - s * 6;
      P.footBY = -Math.max(0, Math.cos(ph)) * 3.4;
      P.hipDrop = Math.abs(Math.cos(ph)) * 0.8;
      // pânico: mãos para o alto
      P.handFX = 5.5 + s * 2;
      P.handFY = -reach * 0.95;
      P.handBX = -5.5 - s * 2;
      P.handBY = -reach * 0.85;
      P.headTilt = 0.1;
      P.head = a.fear;
      break;
    }
    case 'cower':
      // agachado abraçando os joelhos, olhando para os lados
      P.lean = 0.42 * cr + d.lean;
      P.hipDrop = (L.thigh + L.shin) * 0.42 * cr;
      P.footFX = 3.2;
      P.footBX = -2.6;
      P.handFX = 4 + Math.sin(t * 30) * 0.3;
      P.handFY = reach * 0.62;
      P.handBX = 2.4;
      P.handBY = reach * 0.55;
      P.headTilt = 0.06;
      P.head = a.fear;
      break;
  }
  if (air) {
    P.footFX = 3;
    P.footFY = -3.2;
    P.footBX = -1.6;
    P.footBY = -2.2;
  }
  if (talking) P.head = Math.sin(t * 20) > -0.25 ? a.talk : P.head === a.talk ? a.calm : P.head;
  g.save();
  g.translate(x + tremble, y - c.hop);
  if (c.facing === -1) g.scale(-1, 1);
  g.scale(a.scale, a.scale);
  drawFigure(g, L, P);
  g.restore();
}

// ------------------------------------------------------------------ balões de fala
const DISPLAY = '"Lilita One", "Arial Black", Impact, sans-serif';
let speech: Sprite[] | null = null;

/** Balão pré-desenhado da frase i (null antes do carregamento). */
export function speechSprite(i: number): Sprite | null {
  return speech ? speech[i] ?? null : null;
}

function bakeSpeech() {
  if (speech) return;
  speech = PHRASES.map((txt, i) => bakeBalloon(txt, SHOUTS.includes(i)));
}

function bakeBalloon(text: string, shout: boolean): Sprite {
  // mede e quebra as linhas num canvas descartável (só no carregamento)
  const font = `400 ${shout ? 9.5 : 9}px ${DISPLAY}`;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = font;
  const maxW = 118;
  const lines: string[] = [];
  let cur = '';
  for (const wd of text.split(' ')) {
    const test = cur ? cur + ' ' + wd : wd;
    if (probe.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = wd;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  let tw = 0;
  for (const ln of lines) tw = Math.max(tw, probe.measureText(ln).width);
  const lh = 10.5;
  const bw = Math.ceil(tw + (shout ? 22 : 16));
  const bh = Math.ceil(lines.length * lh + (shout ? 14 : 9));
  const pad = shout ? 5 : 3;
  const W = bw + pad * 2;
  const H = bh + pad * 2 + 9;
  return bake(
    W,
    H,
    (g) => {
      const x0 = pad;
      const y0 = pad;
      const cx = x0 + bw / 2;
      const cy = y0 + bh / 2;
      g.fillStyle = '#ffffff';
      g.strokeStyle = OUT;
      g.lineWidth = 1.6;
      // rabicho apontando para o falante (embaixo, à esquerda)
      const tipX = W * 0.32;
      g.beginPath();
      g.moveTo(cx - 12, y0 + bh - 3);
      g.lineTo(tipX, H - 1);
      g.lineTo(cx - 2, y0 + bh - 3);
      g.closePath();
      g.fill();
      g.stroke();
      g.beginPath();
      if (shout) {
        const n = 20;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2;
          const rr = i % 2 ? 1 : 1.14;
          const px = cx + Math.cos(ang) * (bw / 2) * rr;
          const py = cy + Math.sin(ang) * (bh / 2) * rr;
          if (i) g.lineTo(px, py);
          else g.moveTo(px, py);
        }
        g.closePath();
      } else rrPath(g, x0, y0, bw, bh, Math.min(9, bh / 2));
      g.fill();
      g.stroke();
      // refaz o rabicho por cima da borda (sem a linha do balão cortando)
      g.beginPath();
      g.moveTo(cx - 10.6, y0 + bh - 4);
      g.lineTo(tipX + 0.6, H - 3);
      g.lineTo(cx - 3.2, y0 + bh - 4);
      g.closePath();
      g.fill();
      g.fillStyle = shout ? '#b0182f' : OUT;
      g.font = font;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (let i = 0; i < lines.length; i++) g.fillText(lines[i], cx, cy - ((lines.length - 1) * lh) / 2 + i * lh + 0.5);
    },
    { scale: 4, ox: Math.round(W * 0.32), oy: H }
  );
}
