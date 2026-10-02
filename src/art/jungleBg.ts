/**
 * Fundo da selva (fase 2): céu filtrado pela névoa, serras distantes com cachoeiras, várias camadas
 * de copas e troncos em paralaxe, faixas de neblina, pássaros, fachos de luz, pólen e folhas caindo.
 * Tudo assado em faixas que se repetem; por quadro só há cópias de imagem (nada de degradê novo).
 */
import { makeCanvas, glowSprite, softDot } from './kit';
import { Rng, clamp, mixColor } from '../core/math';
import type { BgState } from './background';

interface Layer {
  c: HTMLCanvasElement;
  w: number;
  h: number;
  f: number;
  fy: number;
  foot: string;
  /** cor do "ar" entre as camadas (neblina) */
  haze: string;
}

const DAY = ['#3e9ee0', '#74c0ee', '#b6e2f2', '#e8f6e6'];
/** profundidade do bando de araras (fração do movimento da câmera) */
const FLOCK_P = 0.55;
const DUSK = ['#24304f', '#56506e', '#c9707a', '#f0a25e'];

function vGrad(cols: string[], h = 256) {
  const c = makeCanvas(2, h);
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, h);
  cols.forEach((col, i) => gr.addColorStop(i / (cols.length - 1), col));
  g.fillStyle = gr;
  g.fillRect(0, 0, 2, h);
  return c;
}

/** Copa de árvore: aglomerado de círculos com luz por cima e sombra embaixo. */
function crown(g: CanvasRenderingContext2D, r: Rng, x: number, y: number, rad: number, col: string, light: string, dark: string) {
  const n = 5 + r.int(0, 3);
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) blobs.push([x + r.range(-1, 1) * rad * 0.9, y + r.range(-0.6, 0.5) * rad * 0.6, rad * r.range(0.45, 0.75)]);
  g.fillStyle = dark;
  for (const [bx, by, br] of blobs) {
    g.beginPath();
    g.arc(bx, by + br * 0.18, br, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = col;
  for (const [bx, by, br] of blobs) {
    g.beginPath();
    g.arc(bx, by, br * 0.94, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = light;
  for (const [bx, by, br] of blobs) {
    g.beginPath();
    g.arc(bx - br * 0.25, by - br * 0.3, br * 0.5, 0, Math.PI * 2);
    g.fill();
  }
}

/** Folha alongada (palmeira/bananeira) desenhada como lâmina curva. */
function leaf(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, wid: number, col: string) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.5, -wid, len, wid * 0.4);
  g.quadraticCurveTo(len * 0.5, wid * 0.6, 0, 0);
  g.fill();
  g.restore();
}

export class JungleBackground {
  private layers: Layer[] = [];
  private day: HTMLCanvasElement;
  private dusk: HTMLCanvasElement;
  private mist: HTMLCanvasElement;
  private fog: HTMLCanvasElement;
  private shaft: HTMLCanvasElement;
  private leafSpr: HTMLCanvasElement;
  private cloud: HTMLCanvasElement;
  private clouds: { x: number; y: number; s: number; v: number }[] = [];
  /** bandos de araras/papagaios cruzando a tela de vez em quando */
  private flock: { x: number; y: number; vx: number; ph: number; s: number; col: number }[] = [];
  private flockCd = 4;
  private parrots: HTMLCanvasElement[] = [];
  private birds: { x: number; y: number; s: number; v: number; ph: number }[] = [];
  private motes: { x: number; y: number; vx: number; vy: number; s: number; ph: number }[] = [];
  private leaves: { x: number; y: number; vy: number; ph: number; s: number; rot: number }[] = [];
  private vig: HTMLCanvasElement | null = null;
  private vigKey = '';
  private bs: number;

  constructor(bakeScale = 1.5) {
    this.bs = bakeScale;
    this.day = vGrad(DAY);
    this.dusk = vGrad(DUSK);
    this.mist = vGrad(['rgba(225,240,225,0)', 'rgba(225,240,225,0.75)', 'rgba(225,240,225,0)'], 64);
    this.fog = vGrad(['rgba(200,230,210,0)', 'rgba(190,225,200,0.38)'], 64);
    this.shaft = this.makeShaft();
    this.leafSpr = this.makeLeaf();
    this.cloud = this.makeCloud();
    for (const [body, wing, tail] of [['#e2382a', '#2a6ad8', '#ffd23a'], ['#2a8ad8', '#ffd23a', '#2a6ad8'], ['#3fbf4a', '#e2382a', '#2a8ad8']]) this.parrots.push(this.makeParrot(body, wing, tail));
    this.layers.push(this.mountains(1900, 230, 0.05, 0.03));
    this.layers.push(this.canopy(2100, 250, 0.13, 0.07, 0));
    this.layers.push(this.canopy(2300, 300, 0.24, 0.12, 1));
    this.layers.push(this.trunks(2400, 360, 0.38, 0.18, 0));
    this.layers.push(this.trunks(2600, 400, 0.55, 0.26, 1));
    const r = new Rng(31);
    for (let i = 0; i < 7; i++) this.birds.push({ x: r.range(0, 1400), y: r.range(30, 120), s: r.range(0.6, 1.1), v: r.range(18, 34), ph: r.range(0, 6) });
    for (let i = 0; i < 46; i++) this.motes.push({ x: r.range(0, 800), y: r.range(0, 360), vx: r.range(-6, 6), vy: r.range(-8, 3), s: r.range(0.7, 1.8), ph: r.range(0, 6) });
    for (let i = 0; i < 6; i++) this.clouds.push({ x: r.range(0, 1600), y: r.range(14, 90), s: r.range(0.6, 1.3), v: r.range(3, 7) });
    for (let i = 0; i < 7; i++) this.leaves.push({ x: r.range(0, 800), y: r.range(-360, 360), vy: r.range(18, 34), ph: r.range(0, 6), s: r.range(0.7, 1.3), rot: r.range(0, 6) });
  }

  // ------------------------------------------------------------------ geração
  private strip(W: number, H: number) {
    const s = this.bs;
    const c = makeCanvas(W * s, H * s);
    const g = c.getContext('2d')!;
    g.scale(s, s);
    return { c, g };
  }

  private mountains(W: number, H: number, f: number, fy: number): Layer {
    const { c, g } = this.strip(W, H);
    const r = new Rng(5);
    const ridge = (base: number, amp: number, col: string, seed: number) => {
      const rr = new Rng(seed);
      const pts: number[] = [];
      const n = 26;
      for (let i = 0; i <= n; i++) pts.push(base - amp * (0.4 + 0.6 * Math.abs(Math.sin(i * 0.9 + seed))) * rr.range(0.6, 1));
      pts[n] = pts[0];
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, H);
      for (let i = 0; i <= n; i++) {
        const x = (i / n) * W;
        const px = ((i - 0.5) / n) * W;
        if (i === 0) g.lineTo(x, pts[i]);
        else g.quadraticCurveTo(px, pts[i - 1] - amp * 0.15, x, pts[i]);
      }
      g.lineTo(W, H);
      g.closePath();
      g.fill();
    };
    ridge(H * 0.55, 90, '#9cc5bd', 3);
    // cachoeiras distantes nas encostas
    for (let i = 0; i < 4; i++) {
      const x = r.range(80, W - 80);
      const y0 = H * 0.42 + r.range(-10, 20);
      g.fillStyle = 'rgba(240,255,250,0.7)';
      g.fillRect(x, y0, 2.2, r.range(40, 70));
      g.fillStyle = 'rgba(240,255,250,0.35)';
      g.fillRect(x - 2, y0 + 10, 6, 50);
    }
    ridge(H * 0.75, 70, '#7fae9f', 11);
    return { c, w: W, h: H, f, fy, foot: '#7fae9f', haze: '#cfe6d2' };
  }

  private canopy(W: number, H: number, f: number, fy: number, k: number): Layer {
    const { c, g } = this.strip(W, H);
    const r = new Rng(40 + k);
    const col = k ? '#4f8a62' : '#6fa284';
    const light = k ? '#6aa476' : '#88b897';
    const dark = k ? '#3d7150' : '#5d917a';
    // massa contínua da floresta + copas por cima
    g.fillStyle = dark;
    g.fillRect(0, H * 0.55, W, H * 0.45);
    for (let x = -60; x < W + 60; x += r.range(34, 60)) {
      const rad = r.range(34, 64) * (k ? 1.2 : 1);
      const y = H * 0.5 + r.range(-30, 30);
      for (const ox of [0, W, -W]) if (x + ox > -120 && x + ox < W + 120) crown(g, new Rng(Math.floor(x * 13 + k)), x + ox, y, rad, col, light, dark);
    }
    // palmeiras despontando acima da copa
    for (let i = 0; i < 9; i++) {
      const x = r.range(40, W - 40);
      const top = H * 0.2 + r.range(0, 40);
      g.strokeStyle = dark;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x, H * 0.5);
      g.quadraticCurveTo(x + r.range(-10, 10), (top + H * 0.5) / 2, x + r.range(-6, 6), top);
      g.stroke();
      for (let j = 0; j < 7; j++) leaf(g, x, top, r.range(26, 40), -Math.PI + (j / 6) * Math.PI + r.range(-0.2, 0.2), 6, col);
    }
    // cipós caindo da copa
    g.strokeStyle = dark;
    g.lineWidth = 1.2;
    for (let i = 0; i < 26; i++) {
      const x = r.range(0, W);
      g.beginPath();
      g.moveTo(x, H * 0.55);
      g.quadraticCurveTo(x + r.range(-8, 8), H * 0.75, x + r.range(-4, 4), H * r.range(0.8, 1));
      g.stroke();
    }
    return { c, w: W, h: H, f, fy, foot: dark, haze: k ? '#b6d6b8' : '#c3dcc4' };
  }

  private trunks(W: number, H: number, f: number, fy: number, k: number): Layer {
    const { c, g } = this.strip(W, H);
    const r = new Rng(70 + k);
    const bark = k ? '#1f3a2a' : '#2e4f3a';
    const barkL = k ? '#2c4d38' : '#3f6a4d';
    const leafC = k ? '#1d4a2c' : '#2d6040';
    const leafL = k ? '#2d643c' : '#3f7d52';
    const leafD = k ? '#123020' : '#20462f';
    // copa contínua no alto
    for (let x = -40; x < W + 40; x += r.range(40, 70)) crown(g, new Rng(Math.floor(x * 7 + 3 + k)), x, r.range(10, 40), r.range(46, 80), leafC, leafL, leafD);
    // troncos
    const n = k ? 7 : 11;
    for (let i = 0; i < n; i++) {
      const x = (i + r.range(0.1, 0.9)) * (W / n);
      const tw = (k ? r.range(26, 44) : r.range(14, 26));
      g.fillStyle = bark;
      g.beginPath();
      g.moveTo(x - tw / 2, 20);
      g.lineTo(x + tw / 2, 20);
      g.lineTo(x + tw * 0.62, H);
      g.lineTo(x - tw * 0.62, H);
      g.closePath();
      g.fill();
      // raízes tabulares
      g.beginPath();
      g.moveTo(x - tw * 0.6, H - 50);
      g.quadraticCurveTo(x - tw * 1.4, H - 12, x - tw * 2.2, H);
      g.lineTo(x - tw * 0.4, H);
      g.closePath();
      g.moveTo(x + tw * 0.6, H - 40);
      g.quadraticCurveTo(x + tw * 1.3, H - 10, x + tw * 2, H);
      g.lineTo(x + tw * 0.4, H);
      g.closePath();
      g.fill();
      // luz lateral + casca
      g.fillStyle = barkL;
      g.fillRect(x - tw / 2 + 2, 20, tw * 0.22, H - 20);
      g.strokeStyle = 'rgba(0,0,0,0.18)';
      g.lineWidth = 1;
      for (let y = 40; y < H; y += r.range(14, 26)) {
        g.beginPath();
        g.moveTo(x - tw * 0.3, y);
        g.lineTo(x + tw * 0.2, y + 3);
        g.stroke();
      }
      // musgo/epífitas
      g.fillStyle = leafL;
      for (let j = 0; j < 3; j++) {
        const yy = r.range(60, H - 80);
        g.beginPath();
        g.ellipse(x + r.range(-tw * 0.4, tw * 0.4), yy, r.range(5, 10), r.range(3, 5), 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // lianas penduradas entre os troncos
    g.strokeStyle = leafD;
    g.lineWidth = k ? 2.4 : 1.6;
    for (let i = 0; i < (k ? 10 : 16); i++) {
      const x0 = r.range(0, W);
      const x1 = x0 + r.range(60, 180);
      const sag = r.range(40, 120);
      g.beginPath();
      g.moveTo(x0, 40);
      g.quadraticCurveTo((x0 + x1) / 2, 40 + sag, x1, 40);
      g.stroke();
    }
    // samambaias e arbustos no chão
    for (let x = 0; x < W; x += r.range(10, 22)) {
      const h = r.range(14, 34) * (k ? 1.4 : 1);
      for (let j = 0; j < 5; j++) leaf(g, x, H, h, -Math.PI / 2 + (j - 2) * 0.45 + r.range(-0.15, 0.15), 4 + (k ? 2 : 0), j % 2 ? leafC : leafD);
    }
    return { c, w: W, h: H, f, fy, foot: k ? '#10241a' : '#1b3426', haze: k ? '#8fb79a' : '#a6c8ad' };
  }

  private makeShaft() {
    const c = makeCanvas(64, 256);
    const g = c.getContext('2d')!;
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, 'rgba(255,246,200,0.9)');
    gr.addColorStop(1, 'rgba(255,246,200,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(22, 0);
    g.lineTo(42, 0);
    g.lineTo(64, 256);
    g.lineTo(0, 256);
    g.closePath();
    g.fill();
    return c;
  }

  private makeLeaf() {
    const c = makeCanvas(24, 12);
    const g = c.getContext('2d')!;
    g.fillStyle = '#6a9a3c';
    g.beginPath();
    g.moveTo(1, 6);
    g.quadraticCurveTo(12, -2, 23, 6);
    g.quadraticCurveTo(12, 14, 1, 6);
    g.fill();
    g.strokeStyle = '#3f6a22';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(2, 6);
    g.lineTo(22, 6);
    g.stroke();
    return c;
  }

  private makeCloud() {
    const c = makeCanvas(240, 90);
    const g = c.getContext('2d')!;
    const r = new Rng(8);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.arc(40 + i * 20 + r.range(-6, 6), 54 + r.range(-14, 6), r.range(18, 30), 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(190,215,235,0.55)';
    g.fillRect(30, 62, 180, 14);
    return c;
  }

  /** Arara (corpo + asa) virada para a direita; as asas batem por escala vertical. */
  private makeParrot(body: string, wing: string, tail: string) {
    const c = makeCanvas(64, 64);
    const g = c.getContext('2d')!;
    g.translate(32, 32);
    // cauda longa
    g.fillStyle = tail;
    g.beginPath();
    g.moveTo(-6, 0);
    g.lineTo(-30, 4);
    g.lineTo(-28, 8);
    g.lineTo(-4, 4);
    g.closePath();
    g.fill();
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(2, 1, 11, 5.6, -0.1, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(13, -2, 4.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f2f2f2';
    g.beginPath();
    g.arc(15, -3, 2.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1a1a1a';
    g.fillRect(15, -3.6, 1.4, 1.4);
    g.fillStyle = '#2a2a2a';
    g.beginPath();
    g.moveTo(17, -2);
    g.quadraticCurveTo(22, -1, 18, 3);
    g.closePath();
    g.fill();
    return c;
  }

  // ------------------------------------------------------------------ desenho
  draw(g: CanvasRenderingContext2D, s: BgState, dt: number) {
    const W = s.viewW;
    const H = s.viewH;
    const dusk = clamp(s.sky, 0, 1);
    // céu
    g.drawImage(this.day, 0, 0, 2, 256, 0, 0, W, H);
    if (dusk > 0.01) {
      g.globalAlpha = dusk;
      g.drawImage(this.dusk, 0, 0, 2, 256, 0, 0, W, H);
      g.globalAlpha = 1;
    }
    // sol difuso na névoa
    {
      const sun = glowSprite(dusk > 0.5 ? '#ffb070' : '#fff4c0', 32);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.8 - dusk * 0.4;
      const sx = W * 0.7 - s.camX * 0.004;
      const sy = H * (0.18 + dusk * 0.3) - (s.camY - s.refY) * 0.01;
      g.drawImage(sun.c, sx - 160, sy - 160, 320, 320);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    // nuvens de dia de sol
    if (dusk < 0.6) {
      g.globalAlpha = 0.85 * (1 - dusk);
      for (const c of this.clouds) {
        c.x += c.v * dt;
        const span = 1700;
        const x = (((c.x - s.camX * 0.02) % span) + span) % span - 240;
        const y = c.y - (s.camY - s.refY) * 0.015;
        g.drawImage(this.cloud, x, y, 240 * c.s, 90 * c.s);
      }
      g.globalAlpha = 1;
    }
    const mistK = 0.2 + s.ruin * 0.6;
    for (let i = 0; i < this.layers.length; i++) {
      const L = this.layers[i];
      this.drawLayer(g, L, s, dusk);
      if (i === 0) this.drawBirds(g, s, dt);
      // neblina entre as camadas (mais forte no pântano)
      if (i < 4) {
        const dy = -(s.camY - s.refY) * L.fy;
        const y = H + dy + 6 - L.h * (0.32 + i * 0.05);
        g.globalAlpha = mistK * (0.55 - i * 0.08);
        g.drawImage(this.mist, 0, 0, 2, 64, -10, y, W + 20, 70 + i * 10);
        g.globalAlpha = 1;
      }
    }
  }

  private drawLayer(g: CanvasRenderingContext2D, L: Layer, s: BgState, dusk: number) {
    const off = s.camX * L.f;
    let x0 = -(off % L.w);
    if (x0 > 0) x0 -= L.w;
    const dy = -(s.camY - s.refY) * L.fy;
    const yBottom = s.viewH + dy + 6;
    const y = yBottom - L.h;
    if (yBottom < s.viewH) {
      g.fillStyle = L.foot;
      g.fillRect(0, yBottom - 1, s.viewW, s.viewH - yBottom + 2);
    }
    for (let x = x0; x < s.viewW; x += L.w) g.drawImage(L.c, x, y, L.w, L.h);
    if (dusk > 0.05) {
      g.globalAlpha = 0.32 * dusk;
      g.fillStyle = '#0e1028';
      g.fillRect(0, Math.max(0, y), s.viewW, s.viewH - Math.max(0, y));
      g.globalAlpha = 1;
    }
  }

  private drawBirds(g: CanvasRenderingContext2D, s: BgState, dt: number) {
    g.strokeStyle = 'rgba(40,60,60,0.7)';
    g.lineWidth = 1.2;
    for (const b of this.birds) {
      b.x += b.v * dt;
      const span = 1500;
      const x = (((b.x - s.camX * 0.05) % span) + span) % span - 100;
      const y = b.y + Math.sin(s.time * 0.7 + b.ph) * 6 - (s.camY - s.refY) * 0.03;
      const f = Math.sin(s.time * 9 + b.ph) * 3 * b.s;
      const w = 6 * b.s;
      g.beginPath();
      g.moveTo(x - w, y - f);
      g.quadraticCurveTo(x - w * 0.4, y - 1, x, y + 1);
      g.quadraticCurveTo(x + w * 0.4, y - 1, x + w, y - f);
      g.stroke();
    }
  }

  /** Primeiro plano em tela: fachos de luz, pólen, folhas caindo e neblina rasteira. */
  drawForeground(g: CanvasRenderingContext2D, s: BgState, dt: number) {
    const W = s.viewW;
    const H = s.viewH;
    const dusk = clamp(s.sky, 0, 1);
    const t = s.time;
    if (s.under && s.under > 0.5) return;
    // fachos de luz entre as copas
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const x = ((i * 260 + 90 - s.camX * 0.18) % 1040 + 1040) % 1040 - 160;
      g.globalAlpha = (0.07 + 0.04 * Math.sin(t * 0.5 + i * 1.7)) * (1 - dusk * 0.6);
      g.drawImage(this.shaft, x, -20, 150, H + 40);
    }
    // pólen / esporos dourados
    const dot = softDot(dusk > 0.55 ? '#c8ff7a' : '#fff2b0', 16);
    for (const m of this.motes) {
      m.x += (m.vx + Math.sin(t * 0.6 + m.ph) * 6) * dt;
      m.y += (m.vy + Math.cos(t * 0.8 + m.ph) * 4) * dt;
      if (m.y < -6) m.y = H + 6;
      if (m.y > H + 6) m.y = -6;
      const x = ((m.x - s.camX * 0.6) % (W + 40) + W + 40) % (W + 40) - 20;
      // a câmera subindo/descendo (pulo) também desloca o pólen: ele fica "no ar", não grudado na tela
      const my = (((m.y - (s.camY - s.refY) * 0.6) % (H + 12)) + H + 12) % (H + 12) - 6;
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + m.ph * 3);
      g.globalAlpha = (dusk > 0.55 ? 0.8 : 0.45) * tw;
      const r = m.s * (dusk > 0.55 ? 2.4 : 1.8);
      g.drawImage(dot.c, x - r, my - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // folhas caindo
    for (const l of this.leaves) {
      l.y += l.vy * dt;
      l.rot += dt * 1.6;
      if (l.y > H + 20) {
        l.y = -20;
        l.x = Math.random() * 900;
      }
      const x = ((l.x - s.camX * 0.8 + Math.sin(t * 1.3 + l.ph) * 22) % (W + 60) + W + 60) % (W + 60) - 30;
      g.save();
      g.translate(x, (((l.y - (s.camY - s.refY) * 0.8) % (H + 40)) + H + 40) % (H + 40) - 20);
      g.rotate(Math.sin(l.rot) * 0.9);
      g.scale(l.s, l.s * (0.5 + 0.5 * Math.abs(Math.cos(l.rot * 1.3))));
      g.globalAlpha = 0.85;
      g.drawImage(this.leafSpr, -12, -6, 24, 12);
      g.restore();
    }
    g.globalAlpha = 1;
    // araras cruzando a tela
    this.drawFlock(g, s, dt);
    // neblina rasteira
    g.globalAlpha = 0.35 + s.ruin * 0.5;
    g.drawImage(this.fog, 0, 0, 2, 64, 0, H * 0.7, W, H * 0.3);
    g.globalAlpha = 1;
  }

  private drawFlock(g: CanvasRenderingContext2D, s: BgState, dt: number) {
    const W = s.viewW;
    if (!this.flock.length) {
      this.flockCd -= dt;
      if (this.flockCd <= 0) {
        this.flockCd = 12 + Math.random() * 16;
        const dir = Math.random() < 0.5 ? 1 : -1;
        const n = 3 + Math.floor(Math.random() * 4);
        const y0 = 30 + Math.random() * 90;
        const col = Math.floor(Math.random() * this.parrots.length);
        for (let i = 0; i < n; i++) {
          this.flock.push({ x: s.camX * FLOCK_P + (dir > 0 ? -40 - i * 34 : W + 40 + i * 34), y: y0 + (i % 2) * 16 + Math.random() * 10, vx: dir * (230 + Math.random() * 40), ph: Math.random() * 6, s: 0.8 + Math.random() * 0.35, col: (col + (i % 3 === 2 ? 1 : 0)) % this.parrots.length });
        }
      }
      return;
    }
    for (let i = this.flock.length - 1; i >= 0; i--) {
      const b = this.flock[i];
      b.x += b.vx * dt;
      b.ph += dt * 13;
      // em profundidade: acompanha a câmera (andar/pular) como o resto do cenário, sem "travar" no ar
      const sx = b.x - s.camX * FLOCK_P;
      const y = b.y + Math.sin(b.ph * 0.25) * 6 - (s.camY - s.refY) * 0.4;
      const dir = b.vx > 0 ? 1 : -1;
      const flap = Math.sin(b.ph);
      g.save();
      g.translate(sx, y);
      g.scale(dir * b.s, b.s);
      // asa de trás
      g.fillStyle = '#1d4a9a';
      g.beginPath();
      g.moveTo(-2, -1);
      g.quadraticCurveTo(-8, -1 - flap * 16, -16, -flap * 22);
      g.lineTo(6, -1);
      g.closePath();
      g.fill();
      g.drawImage(this.parrots[b.col], -32, -32, 64, 64);
      // asa da frente
      g.fillStyle = b.col === 0 ? '#2a6ad8' : b.col === 1 ? '#ffd23a' : '#e2382a';
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(-4, -flap * 20, -12, -flap * 26 + 4);
      g.lineTo(8, 1);
      g.closePath();
      g.fill();
      g.restore();
      if (sx < -160 || sx > W + 160) this.flock.splice(i, 1);
    }
  }

  drawVignette(g: CanvasRenderingContext2D, W: number, H: number, strength = 1) {
    const key = `${Math.round(W)}x${Math.round(H)}`;
    if (!this.vig || this.vigKey !== key) {
      const c = makeCanvas(W, H);
      const cg = c.getContext('2d')!;
      const gr = cg.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
      gr.addColorStop(0, 'rgba(4,18,10,0)');
      gr.addColorStop(1, 'rgba(4,18,10,0.6)');
      cg.fillStyle = gr;
      cg.fillRect(0, 0, W, H);
      this.vig = c;
      this.vigKey = key;
    }
    g.globalAlpha = strength;
    g.drawImage(this.vig, 0, 0, W, H);
    g.globalAlpha = 1;
  }
}

void mixColor;
