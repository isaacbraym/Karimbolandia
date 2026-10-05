/**
 * Arte das espécies do lago (assada uma vez na tela de carregamento da selva, junto com a fauna).
 * Cada espécie vira uma pequena folha de 2 quadros (cauda para cima/para baixo) em 2 resoluções
 * (cópia reduzida uma vez, `high` só no bake). Por quadro: 1 `drawImage` por peixe (o poraquê usa
 * um por segmento). Nada de gradiente, filtro ou canvas criado durante o jogo.
 * Convenção das fotos: a arte olha para a ESQUERDA; o desenho espelha pela direção do peixe.
 */
import { makeCanvas } from '../kit';
import { Rng } from '../../core/math';
import { EEL_SEGMENTS, type LifeSpecies } from '../../game/lake/species';
import { fishScale, FISH_BACK_FADE, type Fish } from '../../game/water';

interface Look {
  /** altura / largura do corpo */
  aspect: number;
  back: string;
  mid: string;
  belly: string;
  /** faixas verticais: x (0..1 do focinho à cauda), largura, cor */
  bands?: [number, number, string][];
  /** faixa luminosa horizontal (neon/cardinal): y (0..1 da altura), espessura, cor */
  line?: [number, number, string];
  /** metade inferior tingida de x0 a x1 */
  lower?: [number, number, string];
  dorsal: number;
  anal: number;
  fin: string;
  tail: string;
  tailLen: number;
  /** ocelo na base da cauda (tucunaré) */
  ocelo?: boolean;
  barbels?: boolean;
  speckles?: string;
  /** padrão de listras onduladas (acará-disco) */
  waves?: string;
  /** escamas vermelhas na metade de trás (pirarucu) */
  redTail?: boolean;
  /** barbatana dorsal alta e filamentos (acará-bandeira) */
  filaments?: boolean;
}

const LOOKS: Record<Exclude<LifeSpecies, 'arraia' | 'poraque'>, Look> = {
  neon: {
    aspect: 0.3, back: '#17304f', mid: '#2f6fd6', belly: '#e9eef4', line: [0.38, 0.1, '#38f0ff'], lower: [0.5, 0.9, '#e22a2c'],
    dorsal: 0.12, anal: 0.16, fin: 'rgba(210,230,255,.55)', tail: 'rgba(210,230,255,.6)', tailLen: 0.22,
  },
  cardinal: {
    aspect: 0.32, back: '#20305a', mid: '#2f78d8', belly: '#e22a2c', line: [0.32, 0.1, '#38f0ff'], lower: [0.0, 1.0, '#e22a2c'],
    dorsal: 0.12, anal: 0.16, fin: 'rgba(255,120,120,.55)', tail: 'rgba(255,140,140,.6)', tailLen: 0.22,
  },
  bandeira: {
    aspect: 0.6, back: '#aab4b6', mid: '#e8eeee', belly: '#f4f4ee', bands: [[0.26, 0.07, '#1f2224'], [0.46, 0.07, '#1f2224'], [0.66, 0.06, '#1f2224']],
    dorsal: 0.55, anal: 0.5, fin: 'rgba(210,220,224,.5)', tail: 'rgba(210,220,224,.55)', tailLen: 0.2, filaments: true,
  },
  disco: {
    aspect: 0.95, back: '#b8641f', mid: '#d98a2f', belly: '#efc774', waves: '#38d2c8',
    dorsal: 0.16, anal: 0.16, fin: 'rgba(230,140,50,.6)', tail: 'rgba(230,140,50,.6)', tailLen: 0.2,
  },
  coridora: {
    aspect: 0.4, back: '#5a5a46', mid: '#9a8c68', belly: '#e6dbbd', speckles: '#2e2a20',
    dorsal: 0.3, anal: 0.12, fin: 'rgba(150,140,110,.8)', tail: 'rgba(150,140,110,.8)', tailLen: 0.2, barbels: true,
  },
  tucunare: {
    aspect: 0.3, back: '#51641e', mid: '#aaa82e', belly: '#ecdc74', bands: [[0.3, 0.07, '#3a3a16'], [0.46, 0.07, '#3a3a16'], [0.62, 0.07, '#3a3a16']],
    dorsal: 0.2, anal: 0.16, fin: 'rgba(200,170,40,.7)', tail: 'rgba(210,170,30,.85)', tailLen: 0.2, ocelo: true,
  },
  pirarucu: {
    aspect: 0.2, back: '#3a4234', mid: '#58604a', belly: '#b9b59a', redTail: true,
    dorsal: 0.14, anal: 0.12, fin: 'rgba(160,50,40,.85)', tail: 'rgba(190,50,40,.9)', tailLen: 0.18,
  },
};

export interface LifeSheet {
  /** mips[nível][quadro]; nível 0 = maior */
  mips: HTMLCanvasElement[][];
  /** largura/altura lógicas da folha (em unidades de "largura do peixe = 1") */
  aspect: number;
  /** largura em px do nível 0 */
  px: number;
}

export interface LifeArt {
  sheets: Record<Exclude<LifeSpecies, 'arraia' | 'poraque'>, LifeSheet>;
  ray: LifeSheet;
  eelHead: HTMLCanvasElement;
  eelBody: HTMLCanvasElement;
  eelArcs: HTMLCanvasElement[];
  glow: Record<'neon' | 'cardinal', HTMLCanvasElement>;
  sand: HTMLCanvasElement;
}
let art: LifeArt | null = null;
export const getLifeArt = () => art;

const TAU = Math.PI * 2;

/** Altura/largura da folha: o corpo mais as nadadeiras, que sobem e descem além dele. */
const lookAspect = (L: Look) => L.aspect * (1 + 2 * Math.max(L.dorsal, L.anal)) + 0.03;

/** Corpo + nadadeiras de um peixe de perfil, olhando para a ESQUERDA, em largura `W` px. */
function paintFish(g: CanvasRenderingContext2D, L: Look, W: number, frame: number, seed: number) {
  const H = W * L.aspect; // altura do corpo
  const bodyW = W * (1 - L.tailLen);
  const cy = (W * lookAspect(L)) / 2;
  const hb = H / 2;
  g.save();
  // nadadeiras (atrás do corpo)
  g.fillStyle = L.fin;
  g.beginPath();
  g.moveTo(bodyW * 0.3, cy - hb * 0.85);
  g.quadraticCurveTo(bodyW * 0.5, cy - hb - H * L.dorsal, bodyW * 0.82, cy - hb * 0.55);
  g.lineTo(bodyW * 0.5, cy - hb * 0.6);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(bodyW * 0.45, cy + hb * 0.8);
  g.quadraticCurveTo(bodyW * 0.62, cy + hb + H * L.anal, bodyW * 0.84, cy + hb * 0.55);
  g.lineTo(bodyW * 0.58, cy + hb * 0.55);
  g.closePath();
  g.fill();
  if (L.filaments) {
    g.strokeStyle = 'rgba(225,232,235,.7)';
    g.lineWidth = Math.max(1, W * 0.02);
    g.beginPath();
    g.moveTo(bodyW * 0.3, cy + hb * 0.8);
    g.quadraticCurveTo(bodyW * 0.22, cy + hb + H * 0.3, bodyW * 0.28, cy + hb + H * 0.5);
    g.stroke();
  }
  // cauda (dois quadros: levantada / abaixada)
  const sw = frame === 0 ? -0.22 : 0.22;
  g.save();
  g.translate(bodyW * 0.96, cy);
  g.rotate(sw);
  g.fillStyle = L.tail;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(W * L.tailLen * 1.1, -hb * 0.95);
  g.quadraticCurveTo(W * L.tailLen * 0.7, 0, W * L.tailLen * 1.1, hb * 0.95);
  g.closePath();
  g.fill();
  if (L.ocelo) {
    g.fillStyle = '#e8b81c';
    g.beginPath();
    g.arc(W * L.tailLen * 0.28, 0, hb * 0.34, 0, TAU);
    g.fill();
    g.strokeStyle = '#161408';
    g.lineWidth = Math.max(1, W * 0.012);
    g.stroke();
  }
  g.restore();
  // corpo (degradê pré-assado nesta folha)
  const gr = g.createLinearGradient(0, cy - hb, 0, cy + hb);
  gr.addColorStop(0, L.back);
  gr.addColorStop(0.45, L.mid);
  gr.addColorStop(1, L.belly);
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(0, cy);
  g.bezierCurveTo(bodyW * 0.06, cy - hb * 1.02, bodyW * 0.5, cy - hb * 1.08, bodyW, cy - hb * 0.12);
  g.lineTo(bodyW, cy + hb * 0.12);
  g.bezierCurveTo(bodyW * 0.5, cy + hb * 1.08, bodyW * 0.08, cy + hb * 1.0, 0, cy);
  g.closePath();
  g.fill();
  g.save();
  g.clip();
  if (L.lower) {
    g.fillStyle = L.lower[2];
    g.globalAlpha = 0.95;
    g.fillRect(bodyW * L.lower[0], cy + hb * (L.line ? 0.05 : -0.35), bodyW * (L.lower[1] - L.lower[0]), hb * 1.2);
    g.globalAlpha = 1;
  }
  if (L.redTail) {
    g.fillStyle = 'rgba(190,48,38,.9)';
    g.fillRect(bodyW * 0.58, cy - hb * 1.2, bodyW * 0.5, hb * 2.4);
    g.strokeStyle = 'rgba(40,10,10,.35)';
    g.lineWidth = Math.max(0.6, W * 0.006);
    for (let x = bodyW * 0.1; x < bodyW; x += W * 0.03) { g.beginPath(); g.arc(x, cy, hb * 0.5, -1.2, 1.2); g.stroke(); }
  }
  for (const [x, w, col] of L.bands ?? []) { g.fillStyle = col; g.fillRect(bodyW * x, cy - hb * 1.5, bodyW * w, hb * 3); }
  if (L.waves) {
    g.strokeStyle = L.waves;
    g.lineWidth = Math.max(1, W * 0.02);
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      for (let x = 0; x <= bodyW; x += bodyW / 12) {
        const y = cy - hb * 0.8 + k * hb * 0.4 + Math.sin(x / bodyW * 9 + k) * hb * 0.08;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  if (L.speckles) {
    const r = new Rng(seed);
    g.fillStyle = L.speckles;
    for (let i = 0; i < 28; i++) { g.beginPath(); g.arc(r.range(bodyW * 0.1, bodyW * 0.9), cy + r.range(-hb * 0.8, hb * 0.3), Math.max(0.6, W * 0.012), 0, TAU); g.fill(); }
  }
  if (L.line) {
    g.fillStyle = L.line[2];
    g.fillRect(bodyW * 0.1, cy - hb + hb * 2 * L.line[0] - hb * L.line[1], bodyW * 0.7, hb * 2 * L.line[1]);
  }
  g.restore();
  // brilho do dorso e olho
  g.fillStyle = 'rgba(255,255,255,.22)';
  g.beginPath();
  g.ellipse(bodyW * 0.4, cy - hb * 0.5, bodyW * 0.28, hb * 0.14, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#f4f1e2';
  g.beginPath();
  g.arc(bodyW * 0.14, cy - hb * 0.18, Math.max(1.2, hb * 0.2), 0, TAU);
  g.fill();
  g.fillStyle = '#10141a';
  g.beginPath();
  g.arc(bodyW * 0.13, cy - hb * 0.18, Math.max(0.8, hb * 0.11), 0, TAU);
  g.fill();
  if (L.barbels) {
    g.strokeStyle = '#8c7e5c';
    g.lineWidth = Math.max(0.8, W * 0.01);
    g.beginPath();
    g.moveTo(bodyW * 0.01, cy + hb * 0.15);
    g.lineTo(-W * 0.04, cy + hb * 0.55);
    g.moveTo(bodyW * 0.02, cy + hb * 0.25);
    g.lineTo(-W * 0.02, cy + hb * 0.72);
    g.stroke();
  }
  g.restore();
}

/** Arraia vista de cima/de lado: disco com ocelos laranja e cauda fina (asas batendo em 2 quadros). */
function paintRay(g: CanvasRenderingContext2D, W: number, frame: number) {
  const H = W * 0.42;
  const cy = H * 0.5;
  const disc = W * 0.72;
  const lift = frame === 0 ? -H * 0.07 : H * 0.07;
  g.save();
  g.strokeStyle = '#3a2f26';
  g.lineWidth = Math.max(1.2, W * 0.025);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(disc * 0.8, cy);
  g.quadraticCurveTo(W * 0.9, cy - lift * 2, W, cy + lift);
  g.stroke();
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#6a5338');
  gr.addColorStop(1, '#2f241a');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(0, cy);
  g.quadraticCurveTo(disc * 0.16, cy - H * 0.5 + lift * 2, disc * 0.5, cy - H * 0.38);
  g.quadraticCurveTo(disc * 0.9, cy - H * 0.5 - lift * 2, disc, cy);
  g.quadraticCurveTo(disc * 0.9, cy + H * 0.5 + lift * 2, disc * 0.5, cy + H * 0.38);
  g.quadraticCurveTo(disc * 0.16, cy + H * 0.5 - lift * 2, 0, cy);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)';
  g.lineWidth = Math.max(0.8, W * 0.012);
  g.stroke();
  // ocelos laranja
  const r = new Rng(17);
  for (let i = 0; i < 9; i++) {
    const x = disc * (0.22 + r.next() * 0.58);
    const y = cy + (r.next() - 0.5) * H * 0.5;
    g.fillStyle = '#ef8d22';
    g.beginPath();
    g.arc(x, y, W * 0.028 + r.next() * W * 0.016, 0, TAU);
    g.fill();
    g.fillStyle = '#5a2a10';
    g.beginPath();
    g.arc(x, y, W * 0.012, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#f3efe0';
  g.beginPath();
  g.arc(disc * 0.16, cy - H * 0.08, Math.max(1.3, W * 0.022), 0, TAU);
  g.fill();
  g.fillStyle = '#10141a';
  g.beginPath();
  g.arc(disc * 0.15, cy - H * 0.08, Math.max(0.8, W * 0.011), 0, TAU);
  g.fill();
  g.restore();
}

function sheet(paint: (g: CanvasRenderingContext2D, W: number, frame: number) => void, aspect: number, px: number): LifeSheet {
  const mips: HTMLCanvasElement[][] = [];
  let first: HTMLCanvasElement[] = [];
  for (let level = 0; level < 2; level++) {
    const W = Math.max(16, Math.round(px / (level + 1)));
    const frames: HTMLCanvasElement[] = [];
    for (let fr = 0; fr < 2; fr++) {
      const c = makeCanvas(W, Math.max(2, Math.round(W * aspect)));
      const g = c.getContext('2d')!;
      if (level === 0) paint(g, W, fr);
      else {
        // cópia reduzida da maior (filtragem boa só aqui, no bake)
        g.imageSmoothingQuality = 'high';
        g.drawImage(first[fr], 0, 0, c.width, c.height);
      }
      frames.push(c);
    }
    if (level === 0) first = frames;
    mips.push(frames);
  }
  return { mips, aspect, px };
}

function glowDisc(color: string) {
  const c = makeCanvas(64, 64);
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
}

/** Assa todas as espécies (chamado uma vez em `loadJungle`). */
export function prepareLakeLife(): LifeArt {
  if (art) return art;
  const sheets = {} as LifeArt['sheets'];
  const pxBySpecies: Record<keyof typeof LOOKS, number> = { neon: 96, cardinal: 96, bandeira: 160, disco: 144, coridora: 96, tucunare: 256, pirarucu: 384 };
  let seed = 5;
  for (const k of Object.keys(LOOKS) as (keyof typeof LOOKS)[]) {
    const L = LOOKS[k];
    sheets[k] = sheet((g, W, fr) => paintFish(g, L, W, fr, seed), lookAspect(L), pxBySpecies[k]);
    seed += 11;
  }
  const ray = sheet(paintRay, 0.42, 192);
  // poraquê: cabeça e segmento do corpo (desenhados girados ao longo do corpo)
  const eelHead = makeCanvas(48, 28);
  {
    const g = eelHead.getContext('2d')!;
    const gr = g.createLinearGradient(0, 0, 0, 28);
    gr.addColorStop(0, '#2c3226');
    gr.addColorStop(1, '#8a5a24');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(24, 14, 23, 12, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#f2ecc0';
    g.beginPath();
    g.arc(12, 9, 3.2, 0, TAU);
    g.fill();
    g.fillStyle = '#10141a';
    g.beginPath();
    g.arc(11, 9, 1.7, 0, TAU);
    g.fill();
  }
  const eelBody = makeCanvas(40, 24);
  {
    const g = eelBody.getContext('2d')!;
    const gr = g.createLinearGradient(0, 0, 0, 24);
    gr.addColorStop(0, '#262c20');
    gr.addColorStop(0.65, '#4a4a2a');
    gr.addColorStop(1, '#d4822c');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(20, 12, 19, 10, 0, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.12)';
    g.beginPath();
    g.ellipse(20, 6, 12, 2.4, 0, 0, TAU);
    g.fill();
  }
  // arcos elétricos (dois desenhos zigue-zague com brilho; escolhidos por quadro, nada de caminho novo)
  const eelArcs: HTMLCanvasElement[] = [];
  for (let k = 0; k < 2; k++) {
    const c = makeCanvas(96, 40);
    const g = c.getContext('2d')!;
    const r = new Rng(300 + k * 9);
    for (const [w, col] of [[5, 'rgba(90,230,255,.28)'], [2.4, 'rgba(190,250,255,.85)'], [1, '#ffffff']] as [number, string][]) {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(2, 20);
      for (let x = 10; x < 96; x += 10) g.lineTo(x, 20 + r.range(-14, 14));
      g.stroke();
    }
    eelArcs.push(c);
  }
  const sand = makeCanvas(16, 16);
  {
    const g = sand.getContext('2d')!;
    const gr = g.createRadialGradient(8, 8, 0, 8, 8, 8);
    gr.addColorStop(0, 'rgba(214,194,150,.8)');
    gr.addColorStop(1, 'rgba(214,194,150,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 16, 16);
  }
  art = { sheets, ray, eelHead, eelBody, eelArcs, glow: { neon: glowDisc('rgba(60,200,255,.9)'), cardinal: glowDisc('rgba(255,70,70,.8)') }, sand };
  return art;
}

function pickMip(s: LifeSheet, need: number): HTMLCanvasElement[] {
  // o maior nível só quando a tela realmente precisa (largura em px da tela > metade do nível 0)
  return need > s.px * 0.5 ? s.mips[0] : s.mips[1];
}

/** Desenha um peixe de espécie (1 drawImage; o poraquê, 1 por segmento). */
export function drawLifeFish(g: CanvasRenderingContext2D, a: LifeArt, f: Fish, k: number, t: number) {
  const size = f.size * fishScale(f);
  const sp = f.species as LifeSpecies;
  if (sp === 'poraque') { drawEel(g, a, f, size, t); return; }
  const sheet = sp === 'arraia' ? a.ray : a.sheets[sp];
  const frames = pickMip(sheet, size * k);
  const frame = Math.sin(f.ph * (sp === 'arraia' ? 0.5 : 1)) > 0 ? 0 : 1;
  const img = frames[frame];
  let sx = -f.turn;
  if (Math.abs(sx) < 0.18) sx = sx < 0 ? -0.18 : 0.18;
  const tilt = Math.max(-0.42, Math.min(0.42, f.vy / 150)) * f.dir * (sp === 'arraia' || sp === 'coridora' ? 0.4 : 1);
  const h = size * sheet.aspect;
  g.save();
  if (f.depth > 0.001) g.globalAlpha *= 1 - FISH_BACK_FADE * f.depth;
  g.translate(f.x, f.y + Math.sin(f.ph * 0.35) * 1.1);
  g.rotate(tilt);
  g.scale(sx, 1);
  g.drawImage(img, -size / 2, -h / 2, size, h);
  g.restore();
}

function drawEel(g: CanvasRenderingContext2D, a: LifeArt, f: Fish, size: number, t: number) {
  const seg = f.seg!;
  const gap = size / (EEL_SEGMENTS + 0.5);
  g.save();
  if (f.depth > 0.001) g.globalAlpha *= 1 - FISH_BACK_FADE * f.depth;
  // do rabo para a cabeça (a cabeça fica por cima)
  for (let i = EEL_SEGMENTS - 1; i >= 0; i--) {
    const x = seg[i * 2];
    const y = seg[i * 2 + 1] + Math.sin(t * 5 + i * 0.9) * gap * 0.22;
    const px = i === 0 ? x - (seg[2] - x) : seg[(i - 1) * 2];
    const py = i === 0 ? y - (seg[3] - y) : seg[(i - 1) * 2 + 1];
    const ang = Math.atan2(py - y, px - x);
    const w = i === 0 ? gap * 1.7 : gap * (1.25 - i * 0.07);
    const h = i === 0 ? gap * 1.0 : w * 0.6 * (1 - i * 0.05);
    g.save();
    g.translate(x, y);
    g.rotate(ang + (i === 0 ? Math.PI : Math.PI));
    g.drawImage(i === 0 ? a.eelHead : a.eelBody, -w / 2, -h / 2, w, h);
    g.restore();
  }
  // cintilação elétrica: surtos curtos (composição `lighter`, sprites prontos)
  const burst = Math.sin(t * 2.3 + f.ph) > 0.82;
  if (burst) {
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.75;
    const arc = a.eelArcs[Math.floor(t * 18) & 1];
    g.drawImage(arc, f.x - size * 0.5, f.y - size * 0.14, size, size * 0.42);
    g.globalAlpha = 0.45;
    g.drawImage(a.glow.neon, f.x - size * 0.45, f.y - size * 0.45, size * 0.9, size * 0.9);
  }
  g.restore();
}
