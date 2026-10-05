/**
 * Desenho da água (fase 2). Lago: fundo em degradê pré-assado, silhuetas submersas em paralaxe,
 * fachos de luz, peixes em três profundidades, cáusticas, bolhas, plâncton e a superfície com
 * reflexos. Pântano: água turva por cima das pernas, lentilhas-d'água e vitórias-régias.
 * Tudo com texturas prontas — por quadro só há cópias de imagem e retângulos.
 */
import type { World } from '../game/world';
import type { WaterZone } from '../game/level';
import type { Fish } from '../game/water';
import { getJungle, type FishArt } from './jungle';
import { glowSprite, makeCanvas, softDot } from './kit';
import { Rng } from '../core/math';
import { GROUND_DEPTH } from './perspective';

interface Tex {
  lake: HTMLCanvasElement;
  swamp: HTMLCanvasElement;
  caustic: HTMLCanvasElement;
  surface: HTMLCanvasElement;
  bubble: HTMLCanvasElement;
  lily: HTMLCanvasElement[];
  ray: HTMLCanvasElement;
  far: HTMLCanvasElement;
  weed: HTMLCanvasElement;
  top: Record<'lake' | 'swamp', HTMLCanvasElement>;
}
let tex: Tex | null = null;

function grad(h: number, stops: [number, string][]) {
  const c = makeCanvas(2, h);
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, h);
  for (const [t, col] of stops) gr.addColorStop(t, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, 2, h);
  return c;
}

function textures(): Tex {
  if (tex) return tex;
  const lake = grad(256, [[0, '#4fb3a8'], [0.12, '#2f8f94'], [0.45, '#1a5f78'], [0.8, '#0e3552'], [1, '#081c33']]);
  const swamp = grad(32, [[0, 'rgba(120,128,60,0.62)'], [0.3, 'rgba(70,84,36,0.82)'], [1, 'rgba(38,46,20,0.94)']]);
  // cáusticas: rede de linhas claras que se repete sem emenda
  const caustic = makeCanvas(128, 128);
  {
    const g = caustic.getContext('2d')!;
    const r = new Rng(12);
    g.strokeStyle = 'rgba(220,255,250,0.55)';
    g.lineCap = 'round';
    for (let i = 0; i < 30; i++) {
      const x = r.range(0, 128);
      const y = r.range(0, 128);
      const rad = r.range(10, 26);
      g.lineWidth = r.range(0.8, 2.2);
      for (const ox of [-128, 0, 128]) {
        for (const oy of [-128, 0, 128]) {
          g.beginPath();
          g.ellipse(x + ox, y + oy, rad, rad * r.range(0.5, 0.9), r.range(0, 3), r.range(0, 3), r.range(3.5, 6));
          g.stroke();
        }
      }
    }
  }
  // superfície: linha clara, reflexos ondulados e o brilho por baixo
  const surface = makeCanvas(256, 24);
  {
    const g = surface.getContext('2d')!;
    const gr = g.createLinearGradient(0, 3, 0, 24);
    gr.addColorStop(0, 'rgba(200,255,250,0.45)');
    gr.addColorStop(1, 'rgba(200,255,250,0)');
    g.fillStyle = gr;
    g.fillRect(0, 3, 256, 21);
    g.fillStyle = 'rgba(235,255,255,0.85)';
    g.fillRect(0, 2, 256, 1.6);
    const r = new Rng(3);
    for (let i = 0; i < 22; i++) {
      const x = r.range(0, 256);
      const w = r.range(6, 22);
      g.fillStyle = `rgba(255,255,255,${r.range(0.35, 0.8).toFixed(2)})`;
      g.fillRect(x, r.range(0, 1.5), w, 1);
      if (x + w > 256) g.fillRect(x - 256, 0.5, w, 1);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x + 3, r.range(5, 12), w * 0.6, 0.8);
    }
  }
  const bubble = makeCanvas(32, 32);
  {
    const g = bubble.getContext('2d')!;
    g.strokeStyle = 'rgba(230,255,255,0.85)';
    g.lineWidth = 2.4;
    g.beginPath();
    g.arc(16, 16, 12, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(200,250,255,0.18)';
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.arc(11, 11, 3.6, 0, Math.PI * 2);
    g.fill();
  }
  const lily: HTMLCanvasElement[] = [];
  for (let k = 0; k < 3; k++) {
    const c = makeCanvas(48, 22);
    const g = c.getContext('2d')!;
    g.translate(24, 12);
    g.fillStyle = k === 2 ? '#4f8a34' : '#5f9a3a';
    g.beginPath();
    g.ellipse(0, 0, 20, 7.5, 0, 0.25, Math.PI * 2 - 0.05);
    g.lineTo(0, 0);
    g.closePath();
    g.fill();
    g.strokeStyle = '#2f5a1e';
    g.lineWidth = 1.2;
    g.stroke();
    g.strokeStyle = 'rgba(200,255,150,0.35)';
    g.lineWidth = 0.8;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(i * 1.2 + 0.8) * 16, Math.sin(i * 1.2 + 0.8) * 6);
      g.stroke();
    }
    if (k === 0) {
      // flor
      for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 ? '#ffd0e6' : '#ff9cc8';
        g.beginPath();
        g.ellipse(-4 + Math.cos(i) * 3, -5 + Math.sin(i) * 1.4, 2.4, 4.6, i * 0.5, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#ffe27a';
      g.beginPath();
      g.arc(-4, -5, 1.6, 0, Math.PI * 2);
      g.fill();
    }
    lily.push(c);
  }
  const ray = makeCanvas(48, 256);
  {
    const g = ray.getContext('2d')!;
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, 'rgba(210,255,240,0.9)');
    gr.addColorStop(1, 'rgba(210,255,240,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(14, 0);
    g.lineTo(34, 0);
    g.lineTo(48, 256);
    g.lineTo(0, 256);
    g.closePath();
    g.fill();
  }
  // silhuetas submersas distantes (pedras, colunas do templo, troncos afundados)
  const far = makeCanvas(1024, 400);
  {
    const g = far.getContext('2d')!;
    g.scale(2, 2);
    const r = new Rng(44);
    g.fillStyle = 'rgba(14,52,66,0.85)';
    g.beginPath();
    g.moveTo(0, 200);
    for (let x = 0; x <= 512; x += 16) g.lineTo(x, 150 + Math.sin(x * 0.03) * 14 + r.range(-6, 6));
    g.lineTo(512, 200);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(16,58,72,0.8)';
    for (let i = 0; i < 4; i++) {
      const x = r.range(30, 480);
      const h = r.range(40, 110);
      g.fillRect(x, 160 - h, r.range(12, 22), h);
      g.fillRect(x - 6, 160 - h, r.range(24, 34), 7);
    }
    g.strokeStyle = 'rgba(18,64,70,0.9)';
    g.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      const x = r.range(0, 512);
      g.beginPath();
      g.moveTo(x, 170);
      g.quadraticCurveTo(x + r.range(-14, 14), 120, x + r.range(-8, 8), r.range(70, 120));
      g.stroke();
    }
  }
  // lentilha-d'água (faixa que se repete)
  const weed = makeCanvas(256, 6);
  {
    const g = weed.getContext('2d')!;
    const r = new Rng(9);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = r.chance(0.5) ? '#8fbf4a' : '#6f9f34';
      g.beginPath();
      g.ellipse(r.range(0, 256), r.range(1.5, 4.5), r.range(1, 2.4), r.range(0.6, 1.2), 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const top = { lake: surfaceTexture('lake'), swamp: surfaceTexture('swamp') };
  tex = { lake, swamp, caustic, surface, bubble, lily, ray, far, weed, top };
  return tex;
}

/** Textura periódica assada uma vez; o cisalhamento acompanha a projeção dos tiles. */
function surfaceTexture(kind: 'lake' | 'swamp') {
  const c = makeCanvas(256, 64), g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, kind === 'lake' ? '#3b9693' : '#526b35');
  gr.addColorStop(1, kind === 'lake' ? '#64b9a8' : '#7b8b47');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 64);
  for (let row = 0; row < 5; row++) {
    g.strokeStyle = row % 2 ? 'rgba(225,255,221,.25)' : 'rgba(15,58,46,.24)';
    g.lineWidth = 2; g.beginPath();
    for (let x = 0; x <= 256; x += 4) {
      const y = 7 + row * 12 + Math.sin(x * Math.PI / 64 + row * 1.7) * 2.5;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  return c;
}

/** A câmara profunda reutiliza a superfície do lago: não cria um segundo espelho d'água. */
export function waterSurfaceBounds(z: WaterZone) {
  return z.surface === undefined ? { x: z.x, y: z.y - GROUND_DEPTH.y,
    w: z.w + GROUND_DEPTH.x, h: GROUND_DEPTH.y } : null;
}

function drawSurfacePlane(g: CanvasRenderingContext2D, w: World, z: WaterZone, T: Tex) {
  const bounds = waterSurfaceBounds(z), cam = w.camera;
  if (!bounds || bounds.y > cam.y + cam.h + 40 || z.y < cam.y - 40
    || bounds.x > cam.x + cam.w + 40 || bounds.x + bounds.w < cam.x - 40) return;
  const { x: dx, y: dy } = GROUND_DEPTH;
  const x0 = Math.max(z.x, cam.x - dx - 40), x1 = Math.min(z.x + z.w, cam.x + cam.w + 40);
  g.save(); g.beginPath();
  g.moveTo(z.x, z.y); g.lineTo(z.x + z.w, z.y);
  g.lineTo(z.x + z.w + dx, z.y - dy); g.lineTo(z.x + dx, z.y - dy); g.closePath(); g.clip();
  g.save(); g.transform(1, 0, -dx / dy, 1, 0, z.y);
  // Fase em coordenadas do mundo: mover a câmera não desloca ondas ou reflexos.
  const off = (w.time * 13) % 256;
  for (let x = Math.floor((x0 - off) / 256) * 256 + off; x < x1; x += 256)
    g.drawImage(T.top[z.kind], x, -dy, 256, dy);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = z.kind === 'lake' ? .22 : .12;
  const reverse = (-w.time * 9) % 128;
  for (let x = Math.floor((x0 - reverse) / 128) * 128 + reverse; x < x1; x += 128)
    g.drawImage(T.caustic, x, -dy, 128, dy);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.restore();
  if (z.kind === 'swamp') {
    const n = Math.floor(z.w / 100);
    for (let i = 0; i < n; i++) {
      const h = (z.id * 7919 + i * 104729) >>> 0;
      const x = z.x + 25 + h % Math.max(1, z.w - 50);
      if (x < x0 - 25 || x > x1 + 25) continue;
      const depth = .35 + (h % 47) / 100;
      const y = z.y - dy * depth + Math.sin(w.time * 1.4 + i) * .6;
      g.drawImage(T.lily[h % 3], x + dx * depth - 17, y - 8, 34, 15.5);
    }
  }
  g.restore();
}

// ------------------------------------------------------------------ peixes
function drawFish(g: CanvasRenderingContext2D, fa: FishArt, f: Fish, k: number, t: number) {
  const w = f.size;
  const h = (w * fa.h) / fa.w;
  // cópia reduzida mais próxima (nunca menor que o necessário na tela)
  const need = w * k;
  let mip = fa.mips[0];
  for (const m of fa.mips) if (m.width >= need) mip = m;
  const ms = mip.width / fa.w;
  const tailX = fa.w * fa.tailX;
  const tailY = fa.h * fa.tailY;
  let sx = -f.turn; // a foto olha para a esquerda
  if (Math.abs(sx) < 0.18) sx = sx < 0 ? -0.18 : 0.18;
  const tilt = Math.max(-0.42, Math.min(0.42, f.vy / 150)) * f.dir;
  const sc = w / fa.w;
  g.save();
  g.translate(f.x, f.y + Math.sin(f.ph * 0.35) * 1.2);
  g.rotate(tilt);
  g.scale(sx * sc, sc);
  g.translate(-fa.w / 2, -fa.h / 2);
  // corpo (até um pouco depois do início da cauda)
  const bodyW = tailX + fa.w * 0.04;
  g.drawImage(mip, 0, 0, bodyW * ms, fa.h * ms, 0, 0, bodyW, fa.h);
  // cauda balançando (pivô na base)
  const sw = Math.sin(f.ph) * 0.26 + Math.sin(f.ph * 0.5 + 1) * 0.06;
  const tx0 = tailX - fa.w * 0.04;
  g.translate(tailX, tailY);
  g.rotate(sw);
  g.drawImage(mip, tx0 * ms, 0, (fa.w - tx0) * ms, fa.h * ms, tx0 - tailX, -tailY, fa.w - tx0, fa.h);
  g.restore();
  void h;
  void t;
}

function fishLayer(g: CanvasRenderingContext2D, w: World, layer: 0 | 1 | 2) {
  const j = getJungle();
  if (!j) return;
  const k = g.getTransform().a;
  const cam = w.camera;
  for (const f of w.water.fish) {
    if (f.layer !== layer || !cam.visible(f.x, f.y, f.size)) continue;
    drawFish(g, j.fish[f.kind], f, k, w.time);
  }
}

// ------------------------------------------------------------------ camadas
function visRect(w: World, z: WaterZone, m = 24) {
  const c = w.camera;
  const x0 = Math.max(z.x, c.x - m);
  const x1 = Math.min(z.x + z.w, c.x + c.w + m);
  const y0 = Math.max(z.y, c.y - m);
  const y1 = Math.min(z.y + z.h, c.y + c.h + m);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x0, x1, y0, y1 };
}

/** Atrás das decorações e dos tiles: o corpo d'água do lago e o que fica longe dentro dele. */
export function waterDepthRange(z: WaterZone, zones: readonly WaterZone[]) {
  const top = z.surface ?? z.y;
  let bottom = z.y + z.h;
  for (const other of zones) if (other.kind === 'lake' && (other.surface ?? other.y) === top
    && other.x <= z.x + z.w && other.x + other.w >= z.x) bottom = Math.max(bottom, other.y + other.h);
  return { top, span: bottom - top };
}

export function drawWaterBack(g: CanvasRenderingContext2D, w: World) {
  const T = textures();
  const t = w.time;
  for (const z of w.water.zones) {
    drawSurfacePlane(g, w, z, T);
    if (z.kind !== 'lake') continue;
    const v = visRect(w, z);
    if (!v) continue;
    // câmaras fundas: o degradê é medido da superfície real até o fundo de toda a coluna
    const { top, span } = waterDepthRange(z, w.water.zones);
    const sy = ((v.y0 - top) / span) * 256;
    const sh = Math.max(0.5, ((v.y1 - v.y0) / span) * 256);
    // câmara funda: fundo opaco (a selva lá de cima não aparece através da água)
    if (z.surface !== undefined || span > z.h) {
      g.fillStyle = '#062035';
      g.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    }
    g.drawImage(T.lake, 0, sy, 2, sh, v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    g.save();
    g.beginPath();
    g.rect(z.x, z.y, z.w, z.h);
    g.clip();
    // silhuetas submersas em paralaxe
    const ox = w.camera.x * 0.35;
    const fw = 512;
    let x = ox + Math.floor((v.x0 - ox) / fw) * fw;
    for (; x < v.x1; x += fw) g.drawImage(T.far, x, top + span - 200, fw, 200);
    // fachos de luz descendo da superfície (não existem no breu da câmara funda)
    g.globalCompositeOperation = 'lighter';
    const n = z.surface === undefined ? Math.max(3, Math.round(z.w / 260)) : 0;
    for (let i = 0; i < n; i++) {
      const rx = z.x + (i + 0.5) * (z.w / n) + Math.sin(t * 0.21 + i * 1.9) * 46;
      if (rx < v.x0 - 120 || rx > v.x1 + 120) continue;
      g.globalAlpha = 0.1 + 0.07 * Math.sin(t * 0.6 + i * 2.3);
      g.drawImage(T.ray, rx - 50, z.y - 4, 100 + (i % 2) * 40, Math.min(z.h, 320));
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    fishLayer(g, w, 0);
    // névoa da profundidade sobre os peixes distantes
    g.globalAlpha = 0.38;
    g.fillStyle = '#123f52';
    g.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    g.globalAlpha = 1;
    fishLayer(g, w, 1);
    if (z.surface !== undefined || span > z.h) abyss(g, z, v, 1, { top, span });
    g.restore();
  }
}

/** Escurece a câmara funda em faixas (sem gradiente por quadro): quanto mais fundo, mais breu. */
export function abyss(g: CanvasRenderingContext2D, z: WaterZone, v: { x0: number; x1: number; y0: number; y1: number }, k0 = 1,
  range = { top: z.surface ?? z.y, span: z.y + z.h - (z.surface ?? z.y) }) {
  const { top, span } = range;
  g.fillStyle = '#020c1c';
  const band = 48;
  for (let y = Math.floor(v.y0 / band) * band; y < v.y1; y += band) {
    const k = Math.min(1, Math.max(0, (y - top) / span));
    g.globalAlpha = (0.12 + k * 0.5) * k0;
    const start = Math.max(y, v.y0), end = Math.min(y + band, v.y1);
    g.fillRect(v.x0, start, v.x1 - v.x0, end - start);
  }
  g.globalAlpha = 1;
}

/** Na frente de tudo (antes das decorações da frente): tom da água, luz, bolhas e superfície. */
export function drawWaterFront(g: CanvasRenderingContext2D, w: World) {
  const T = textures();
  const t = w.time;
  const cam = w.camera;
  for (const z of w.water.zones) {
    const v = visRect(w, z, 40);
    if (!v) continue;
    if (z.kind === 'lake') {
      g.save();
      g.beginPath();
      g.rect(z.x, z.y, z.w, z.h);
      g.clip();
      // tom verde-azulado sobre o que está dentro d'água (Karimbo, pedras, peixes do meio)
      g.globalAlpha = 0.2;
      g.fillStyle = '#1f8a94';
      g.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
      g.globalAlpha = 1;
      // cáusticas: duas redes se movendo em sentidos opostos, mais fortes perto da superfície
      g.globalCompositeOperation = 'lighter';
      const top = z.y;
      for (let layer = 0; layer < (z.surface === undefined ? 2 : 0); layer++) {
        const dx = (layer ? -t * 9 : t * 13) % 128;
        const dy = (layer ? t * 4 : -t * 3) % 128;
        for (let row = 0; row < 3; row++) {
          const y = top + row * 128 + dy - 128;
          if (y + 128 < v.y0 || y > v.y1) continue;
          g.globalAlpha = (layer ? 0.06 : 0.09) * (1 - row * 0.3);
          let x = Math.floor((v.x0 - dx) / 128) * 128 + dx;
          for (; x < v.x1; x += 128) g.drawImage(T.caustic, x, y, 128, 128);
        }
      }
      // plâncton
      const dot = softDot('#d8fff0', 16);
      for (let i = 0; i < 40; i++) {
        const px = z.x + ((i * 977.3 + t * (4 + (i % 3) * 3)) % z.w);
        const py = z.y + 8 + ((i * 613.7 + Math.sin(t * 0.5 + i) * 18 + t * 2) % (z.h - 16));
        if (px < v.x0 || px > v.x1 || py < v.y0 || py > v.y1) continue;
        g.globalAlpha = 0.25 + 0.2 * Math.sin(t * 1.7 + i);
        const r = 1 + (i % 3) * 0.6;
        g.drawImage(dot.c, px - r, py - r, r * 2, r * 2);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      fishLayer(g, w, 2);
      // breu do fundo também por cima das ruínas e do Karimbo (os cristais brilham por cima)
      const range = waterDepthRange(z, w.water.zones);
      if (z.surface !== undefined || range.span > z.h) abyss(g, z, v, 0.9, range);
      g.restore();
    } else {
      // pântano: água turva cobrindo as pernas
      const sy = 0;
      g.drawImage(T.swamp, 0, sy, 2, 32, z.x, z.y, z.w, z.h + 1);
      // lentilha-d'água e vitórias-régias boiando
      g.globalAlpha = 0.85;
      for (let x = z.x; x < z.x + z.w; x += 256) g.drawImage(T.weed, 0, 0, Math.min(256, z.x + z.w - x), 6, x, z.y - 2, Math.min(256, z.x + z.w - x), 6);
      g.globalAlpha = 1;
      const n = Math.floor(z.w / 70);
      for (let i = 0; i < n; i++) {
        const h = (z.id * 7919 + i * 104729) >>> 0;
        const lx = z.x + 20 + (h % Math.max(1, z.w - 40));
        if (lx < cam.x - 40 || lx > cam.x + cam.w + 40) continue;
        const bob = Math.sin(t * 1.4 + i * 2.1) * 0.8;
        const L = T.lily[h % 3];
        g.drawImage(L, lx - 18, z.y - 8 + bob, 36, 16.5);
      }
    }
    // superfície com reflexos (lago e pântano)
    if (z.surface === undefined && z.y > cam.y - 30 && z.y < cam.y + cam.h + 30) {
      const sx0 = Math.max(z.x, cam.x - 40);
      const sx1 = Math.min(z.x + z.w, cam.x + cam.w + 40);
      const alpha = z.kind === 'lake' ? 1 : 0.45;
      for (let pass = 0; pass < 2; pass++) {
        const off = ((pass ? -t * 7 : t * 11) % 256 + 256) % 256;
        g.globalAlpha = alpha * (pass ? 0.5 : 0.9);
        let x = sx0 - ((sx0 - z.x + off) % 256);
        for (; x < sx1; x += 256) {
          const a = Math.max(x, sx0);
          const b = Math.min(x + 256, sx1);
          if (b <= a) continue;
          g.drawImage(T.surface, a - x, 0, b - a, 24, a, z.y - 2 + pass * 2, b - a, z.kind === 'lake' ? 24 : 8);
        }
      }
      g.globalAlpha = 1;
    }
  }
  // bolhas
  for (const b of w.water.bubbles) {
    if (!cam.visible(b.x, b.y, 10)) continue;
    const r = b.r;
    g.globalAlpha = Math.min(1, b.life * 4) * 0.85;
    g.drawImage(T.bubble, b.x - r, b.y - r, r * 2, r * 2);
  }
  g.globalAlpha = 1;
  // ondinhas na superfície
  g.strokeStyle = '#e8fff8';
  for (const r of w.water.ripples) {
    if (!cam.visible(r.x, r.y, 60)) continue;
    const k = r.t / r.max;
    g.globalAlpha = (1 - k) * 0.7;
    g.lineWidth = 1.4 * (1 - k) + 0.4;
    g.beginPath();
    g.ellipse(r.x, r.y, 3 + r.r * k * 1.6, 1 + r.r * k * 0.28, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
}

/** Luzes por cima do breu: cristais de Atlântida e a lanterna do capacete do traje. */
let crystals: { x: number; y: number }[] | null = null;
let crystalsOf: unknown = null;
export function drawDeepLights(g: CanvasRenderingContext2D, w: World) {
  if (!w.water.zones.some((z) => z.surface !== undefined)) return;
  if (crystalsOf !== w.data) {
    crystalsOf = w.data;
    crystals = w.data.decos.filter((d) => d.kind === 'aCrystal').map((d) => ({ x: d.x, y: d.y }));
  }
  const glow = glowSprite('#7ff9e0', 32);
  g.globalCompositeOperation = 'lighter';
  for (const c of crystals!) {
    if (!w.camera.visible(c.x, c.y - 30, 120)) continue;
    const p = 0.7 + 0.3 * Math.sin(w.time * 1.8 + c.x);
    g.globalAlpha = 0.35 * p;
    g.drawImage(glow.c, c.x - 90, c.y - 130, 180, 180);
  }
  const pl = w.player;
  if (pl.swimming && pl.suitOn && pl.depthRows > 12) {
    const lamp = glowSprite('#fff4d0', 32);
    const k = Math.min(1, (pl.depthRows - 12) / 10);
    g.globalAlpha = 0.42 * k;
    g.drawImage(lamp.c, pl.x + pl.facing * 30 - 80, pl.y - 110, 160, 160);
    g.globalAlpha = 0.25 * k;
    g.drawImage(lamp.c, pl.x - 40, pl.y - 75, 80, 80);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}
