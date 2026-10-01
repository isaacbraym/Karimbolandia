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
import { makeCanvas, softDot } from './kit';
import { Rng } from '../core/math';

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
  tex = { lake, swamp, caustic, surface, bubble, lily, ray, far, weed };
  return tex;
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
export function drawWaterBack(g: CanvasRenderingContext2D, w: World) {
  const T = textures();
  const t = w.time;
  for (const z of w.water.zones) {
    if (z.kind !== 'lake') continue;
    const v = visRect(w, z);
    if (!v) continue;
    const sy = ((v.y0 - z.y) / z.h) * 256;
    const sh = Math.max(0.5, ((v.y1 - v.y0) / z.h) * 256);
    g.drawImage(T.lake, 0, sy, 2, sh, v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    g.save();
    g.beginPath();
    g.rect(z.x, z.y, z.w, z.h);
    g.clip();
    // silhuetas submersas em paralaxe
    const ox = w.camera.x * 0.35;
    const fw = 512;
    let x = ox + Math.floor((v.x0 - ox) / fw) * fw;
    for (; x < v.x1; x += fw) g.drawImage(T.far, x, z.y + z.h - 200, fw, 200);
    // fachos de luz descendo da superfície
    g.globalCompositeOperation = 'lighter';
    const n = Math.max(3, Math.round(z.w / 260));
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
    g.restore();
  }
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
      for (let layer = 0; layer < 2; layer++) {
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
    if (z.y > cam.y - 30 && z.y < cam.y + cam.h + 30) {
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
