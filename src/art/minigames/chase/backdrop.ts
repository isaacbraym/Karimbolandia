/**
 * Fundo da perseguição pela copa: céu de fim de tarde, silhuetas de árvores ao longe, copa média e
 * uma faixa de folhas por cima da tela. Tudo é assado UMA vez (com gradientes), e cada quadro só copia
 * imagens com paralaxe: nenhum gradiente, canvas ou fonte é criado durante o jogo.
 */
import { makeCanvas } from '../../kit';
import { Rng } from '../../../core/math';
import { livingTree, sprig } from './trees';
import type { LeafPalette } from '../../foliage';

const LAYER_W = 1280;

function rng(seed: number) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export interface ChaseBackdrop {
  sky: HTMLCanvasElement;
  far: HTMLCanvasElement;
  mid: HTMLCanvasElement;
  near: HTMLCanvasElement;
  leaves: HTMLCanvasElement;
  rays: HTMLCanvasElement;
  W: number;
  H: number;
}

/** Folhagem: moitas redondas e sobrepostas, com luz no alto. */
function crowns(g: CanvasRenderingContext2D, w: number, y0: number, h: number, base: string, light: string, seed: number, density: number, size: number) {
  const r = rng(seed);
  const n = Math.round(w / density);
  for (let i = 0; i < n; i++) {
    const x = (i / n) * w + (r() - 0.5) * density, y = y0 + r() * h * 0.5, rr = size * (0.6 + r() * 0.8);
    // desenha também deslocado de ±w nas bordas: a camada emenda sem costura na repetição
    for (const o of [0, -w, w]) {
      if (o && x + o + rr < 0 || o && x + o - rr > w) continue;
      g.fillStyle = base;
      g.beginPath(); g.ellipse(x + o, y + rr * 0.3, rr, rr * 0.8, 0, 0, Math.PI * 2); g.fill();
      // Silhueta irregular de folhas pequenas, com luz filtrada nas pontas da copa.
      for (let j = 0; j < 42; j++) {
        const a = j * 2.4, d = rr * Math.sqrt(r()) * .94;
        const lx = x + o + Math.cos(a) * d, ly = y + rr * .25 + Math.sin(a) * d * .75;
        g.fillStyle = j % 3 ? base : light; g.globalAlpha = j % 3 ? .8 : .65;
        g.beginPath(); g.ellipse(lx, ly, rr * (.13 + r() * .13), rr * .11, a, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    }
  }
}

/** Camadas mais altas que a tela (1,5×) e com a base preenchida: a câmera sobe e desce sem mostrar o céu por baixo. */
function layer(H: number, fill: string, build: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = makeCanvas(LAYER_W, Math.round(H * 1.5)), g = c.getContext('2d')!;
  const haze = g.createLinearGradient(0, H * .45, 0, H * 1.15);
  haze.addColorStop(0, 'rgba(0,0,0,0)'); haze.addColorStop(1, fill);
  g.fillStyle = haze; g.fillRect(0, 0, LAYER_W, H * 1.5);
  build(g);
  return c;
}

function forest(g: CanvasRenderingContext2D, H: number, seed: number, n: number, pal: LeafPalette, scale: number) {
  const r = new Rng(seed);
  for (let i = 0; i < n; i++) {
    const x = i * LAYER_W / n + r.range(-35, 35), base = H * r.range(1.1, 1.5);
    const h = H * r.range(.85, 1.6) * scale, w = r.range(20, 38) * scale;
    const kind = i % 4;
    for (const offset of [-LAYER_W, 0, LAYER_W]) {
      if (x + offset < -h * .35 || x + offset > LAYER_W + h * .35) continue;
      livingTree(g, new Rng(seed + i), x + offset, base, h, w, kind, pal);
    }
  }
}

export function bakeBackdrop(W: number, H: number): ChaseBackdrop {
  const sky = makeCanvas(W, H), sg = sky.getContext('2d')!;
  const grad = sg.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#3f8f7a');
  grad.addColorStop(0.45, '#9ccf8e');
  grad.addColorStop(0.8, '#e9d98c');
  grad.addColorStop(1, '#f5c06b');
  sg.fillStyle = grad; sg.fillRect(0, 0, W, H);
  const sun = sg.createRadialGradient(W * 0.72, H * 0.34, 4, W * 0.72, H * 0.34, H * 0.7);
  sun.addColorStop(0, 'rgba(255,248,200,.95)'); sun.addColorStop(0.25, 'rgba(255,230,150,.45)'); sun.addColorStop(1, 'rgba(255,230,150,0)');
  sg.fillStyle = sun; sg.fillRect(0, 0, W, H);
  const far = layer(H, '#6fae8a', (g) => {
    forest(g, H, 114, 13, { dark: '#558f7d', mids: ['#6ca993', '#83b49a', '#77aa98'], light: '#bdd4ab' }, .8);
    crowns(g, LAYER_W, H * 0.34, H * 0.7, '#5b9c7e', '#86c29a', 11, 90, 70);
    const mist = g.createLinearGradient(0, 0, 0, H * 1.4);
    mist.addColorStop(0, 'rgba(255,240,190,0)'); mist.addColorStop(1, 'rgba(255,240,190,.45)');
    g.fillStyle = mist; g.fillRect(0, 0, LAYER_W, H * 1.5);
  });
  const mid = layer(H, '#2c6044', (g) => {
    forest(g, H, 23, 5, { dark: '#244b3a', mids: ['#396b4a', '#44845c', '#5b9768'], light: '#aad68a' }, 1);
    crowns(g, LAYER_W, H * .96, H * .3, '#2f6b4a', '#58a066', 31, 85, 60);
  });
  const near = layer(H, '#1c4631', (g) => {
    forest(g, H, 47, 3, { dark: '#183c2c', mids: ['#285c3e', '#34754d', '#448252'], light: '#9bc177' }, 1.25);
    crowns(g, LAYER_W, H * 1.13, H * .3, '#1f4a35', '#3f8a52', 47, 110, 80);
    const r = rng(5);
    for (let i = 0; i < 7; i++) {
      const x = r() * LAYER_W, y = H * (0.45 + r() * 0.3);
      g.strokeStyle = '#1b3b2b'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 14, y * 0.5, x - 6, y); g.stroke();
      sprig(g, new Rng(i + 40), x - 6, y - 12, 45, -1.7);
    }
  });
  const leaves = layer(Math.max(80, H * 0.28), 'rgba(0,0,0,0)', (g) => {
    const r = rng(77);
    for (let i = 0; i < 38; i++) {
      const x = r() * LAYER_W, y = r() * 26, rr = 22 + r() * 34, rot = (r() - 0.5) * 0.9;
      for (const o of [0, -LAYER_W, LAYER_W]) {
        if (o && (x + o + rr < 0 || x + o - rr > LAYER_W)) continue;
        g.fillStyle = i % 3 ? '#1d5a34' : '#2f7a3f';
        g.beginPath(); g.ellipse(x + o, y, rr, rr * 0.55, rot, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(190,240,120,.35)';
        g.beginPath(); g.ellipse(x + o - rr * 0.2, y - rr * 0.18, rr * 0.55, rr * 0.2, -0.3, 0, Math.PI * 2); g.fill();
      }
    }
  });
  // fachos de luz entre as folhas (assados num só canvas, desenhados com 'lighter' leve)
  const rays = makeCanvas(W, H), rg = rays.getContext('2d')!;
  for (let i = 0; i < 5; i++) {
    const x = W * (0.1 + i * 0.2), w = 30 + (i % 3) * 22;
    const gr = rg.createLinearGradient(x, 0, x + w * 2, H);
    gr.addColorStop(0, 'rgba(255,245,190,.38)'); gr.addColorStop(1, 'rgba(255,245,190,0)');
    rg.fillStyle = gr;
    rg.beginPath(); rg.moveTo(x, 0); rg.lineTo(x + w, 0); rg.lineTo(x + w * 2.6, H); rg.lineTo(x + w * 1.1, H); rg.closePath(); rg.fill();
  }
  return { sky, far, mid, near, leaves, rays, W, H };
}

/** Copia uma camada em repetição horizontal (2–3 cópias) com deslocamento de paralaxe. */
export function drawLayer(g: CanvasRenderingContext2D, c: HTMLCanvasElement, W: number, H: number, camX: number, par: number, y: number, scale = 1) {
  const w = LAYER_W * scale;
  if (H > 0) y = Math.min(0, Math.max(y, H - c.height * scale));
  let x = -((camX * par) % w);
  if (x > 0) x -= w;
  for (; x < W; x += w) g.drawImage(c, x, y, w, c.height * scale);
}
