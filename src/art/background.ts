/**
 * Cenário de fundo em camadas de parallax (todas geradas proceduralmente):
 *  A céu • B naves distantes • C skyline • D prédios grandes • E rodovias/pontes •
 *  F batalhas distantes • G estruturas próximas • (I primeiro plano via decoração/fog).
 */
import { makeCanvas, softDot, glowSprite } from './kit';
import { Rng, clamp, lerp, mixColor, hexToRgb } from '../core/math';

interface Layer {
  c: HTMLCanvasElement;
  w: number; // largura lógica
  h: number;
  scale: number; // px por px lógico
  f: number; // fator de parallax horizontal
  fy: number; // fator vertical
  foot: string; // cor abaixo da imagem
}

export interface BgState {
  canopy?: number;
  camX: number;
  camY: number;
  viewW: number;
  viewH: number;
  time: number;
  sky: number; // 0 = pôr do sol, 0.5 = crepúsculo, 1 = noite/guerra
  ruin: number; // 0..1: mistura da camada próxima (industrial → ruínas verdes)
  refY: number;
  intensity: number; // 0..1 quantidade de efeitos dinâmicos
  /** câmera debaixo d'água (a selva tira folhas/pólen/fachos) */
  under?: number;
}

const SKY_STOPS: string[][] = [
  ['#1a1147', '#3b1a78', '#8a2f95', '#ef5a7a', '#ffa25c'], // pôr do sol
  ['#0f0b3a', '#251258', '#5a2382', '#b0407e', '#e57a5e'], // crepúsculo
  ['#050418', '#0d0a30', '#1c1050', '#4a1a58', '#9a2f4a'], // noite de guerra
];

export class Background {
  layers: Record<string, Layer> = {};
  layersRuin!: Layer;
  stars!: HTMLCanvasElement;
  planet!: HTMLCanvasElement;
  ships: { x: number; y: number; s: number; dir: number; kind: number; ph: number }[] = [];
  flashes: { x: number; y: number; t: number; r: number }[] = [];
  flashCd = 1;
  lights: { x: number; a: number; da: number; hue: string }[] = [];
  bakeScale: number;
  private rng = new Rng(2027);
  embers: { x: number; y: number; vx: number; vy: number; s: number; ph: number }[] = [];

  constructor(bakeScale = 1.5) {
    this.bakeScale = bakeScale;
    this.build();
  }

  private build() {
    const bs = this.bakeScale;
    this.stars = this.makeStars(640, 360);
    this.planet = this.makePlanet();
    this.layers.far = this.skyline(2000, 170, 'far', bs * 0.8);
    this.layers.big = this.skyline(2400, 300, 'big', bs);
    this.layers.hwy = this.highways(2400, 160, bs);
    this.layers.near = this.nearStructures(2600, 320, bs, false);
    this.layersRuin = this.nearStructures(2600, 320, bs, true);
    const r = new Rng(9);
    for (let i = 0; i < 6; i++) this.ships.push({ x: r.range(0, 2400), y: r.range(20, 150), s: r.range(0.5, 1.3), dir: r.chance(0.5) ? 1 : -1, kind: r.int(0, 2), ph: r.range(0, 6) });
    for (let i = 0; i < 3; i++) this.lights.push({ x: r.range(60, 580), a: r.range(-2.2, -1.0), da: r.range(0.15, 0.4) * (r.chance(0.5) ? 1 : -1), hue: r.pick(['#ffd7a8', '#a8f0ff', '#ffb0e0']) });
    for (let i = 0; i < 34; i++) this.embers.push({ x: r.range(0, 640), y: r.range(0, 360), vx: r.range(-14, 6), vy: r.range(-26, -6), s: r.range(0.8, 2), ph: r.range(0, 6) });
  }

  // ------------------------------------------------------------------ geração
  private makeStars(w: number, h: number) {
    const c = makeCanvas(w * 2, h * 2);
    const g = c.getContext('2d')!;
    const r = new Rng(77);
    for (let i = 0; i < 160; i++) {
      const x = r.range(0, w * 2);
      const y = r.range(0, h * 1.2);
      const s = r.chance(0.12) ? 2.2 : 1.2;
      g.globalAlpha = r.range(0.35, 1);
      g.fillStyle = r.chance(0.2) ? '#ffd7f0' : '#ffffff';
      g.fillRect(x, y, s, s);
    }
    return c;
  }

  private makePlanet() {
    const S = 2;
    const c = makeCanvas(320 * S, 320 * S);
    const g = c.getContext('2d')!;
    g.scale(S, S);
    // planeta com anel gigante
    const cx = 130;
    const cy = 170;
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.35);
    // anel de trás
    g.strokeStyle = 'rgba(255,190,220,0.35)';
    g.lineWidth = 9;
    g.beginPath();
    g.ellipse(0, 0, 130, 26, 0, Math.PI, Math.PI * 2);
    g.stroke();
    g.restore();
    const gr = g.createRadialGradient(cx - 30, cy - 30, 8, cx, cy, 78);
    gr.addColorStop(0, '#ffd9f2');
    gr.addColorStop(0.35, '#d76fb8');
    gr.addColorStop(0.75, '#7a2f8f');
    gr.addColorStop(1, '#2a1060');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cy, 78, 0, Math.PI * 2);
    g.fill();
    // faixas
    g.save();
    g.beginPath();
    g.arc(cx, cy, 78, 0, Math.PI * 2);
    g.clip();
    g.globalAlpha = 0.18;
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) g.fillRect(cx - 80, cy - 60 + i * 26, 160, 5 + (i % 2) * 3);
    g.globalAlpha = 0.35;
    g.fillStyle = '#12093a';
    g.beginPath();
    g.arc(cx + 42, cy + 28, 90, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // anel da frente
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.35);
    g.strokeStyle = 'rgba(255,210,235,0.6)';
    g.lineWidth = 8;
    g.beginPath();
    g.ellipse(0, 0, 130, 26, 0, 0, Math.PI);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(0, 0, 122, 22, 0, 0, Math.PI);
    g.stroke();
    g.restore();
    return c;
  }

  private skyline(W: number, H: number, kind: 'far' | 'big', bs: number): Layer {
    const c = makeCanvas(W * bs, H * bs);
    const g = c.getContext('2d')!;
    g.scale(bs, bs);
    const rng = new Rng(kind === 'far' ? 11 : 12);
    const far = kind === 'far';
    const baseTop = far ? '#4a2f86' : '#3a2c73';
    const baseBot = far ? '#2c1c66' : '#1c1450';
    let x = -20;
    const buildings: { x: number; w: number; h: number }[] = [];
    while (x < W + 40) {
      const bw = far ? rng.range(22, 60) : rng.range(50, 130);
      const bh = far ? rng.range(40, 130) : rng.range(90, 270);
      buildings.push({ x, w: bw, h: bh });
      x += bw + rng.range(far ? -6 : 2, far ? 8 : 26);
    }
    const drawB = (b: { x: number; w: number; h: number }, ox: number) => {
      const top = H - b.h;
      const gr = g.createLinearGradient(0, top, 0, H);
      gr.addColorStop(0, baseTop);
      gr.addColorStop(1, baseBot);
      g.fillStyle = gr;
      const bx = b.x + ox;
      g.fillRect(bx, top, b.w, b.h + 2);
      // sombra lateral
      g.fillStyle = 'rgba(0,0,20,0.28)';
      g.fillRect(bx + b.w * 0.68, top, b.w * 0.32, b.h + 2);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(bx, top, b.w, 2);
      if (!far) {
        // coroamento escalonado (prédios altos ganham recuos no topo)
        if (b.h > 140 && rng.chance(0.5)) {
          const sw = b.w * rng.range(0.45, 0.7);
          const sh = rng.range(14, 30);
          g.fillStyle = baseTop;
          g.fillRect(bx + (b.w - sw) * 0.4, top - sh, sw, sh + 1);
          g.fillStyle = 'rgba(0,0,20,0.28)';
          g.fillRect(bx + (b.w - sw) * 0.4 + sw * 0.68, top - sh, sw * 0.32, sh + 1);
          g.fillStyle = 'rgba(255,170,140,0.22)';
          g.fillRect(bx + (b.w - sw) * 0.4, top - sh, sw, 1.5);
        }
        // pilastras, faixas de andar e luz do pôr do sol na quina esquerda
        g.fillStyle = 'rgba(255,255,255,0.035)';
        for (let px = bx + 8; px < bx + b.w - 4; px += 16) g.fillRect(px, top, 1.5, b.h);
        g.fillStyle = 'rgba(255,255,255,0.05)';
        for (let yy = top + 14; yy < H - 8; yy += 22) g.fillRect(bx, yy, b.w, 2);
        g.fillStyle = 'rgba(255,150,120,0.22)';
        g.fillRect(bx, top, 1.5, b.h);
        // janelas: grade apagada inteira + salas acesas em grupos (andares inteiros às vezes)
        const cols = Math.floor(b.w / 8);
        for (let yy = top + 12, floor = 0; yy < H - 12; yy += 10, floor++) {
          const litFloor = rng.chance(0.08);
          const tint = rng.pick(['#ffb83a', '#ffd89a', '#39f0ff', '#ff8ad4']);
          for (let cx = 0; cx < cols; cx++) {
            const roll = rng.next();
            const on = litFloor ? roll < 0.75 : roll < 0.14;
            g.fillStyle = on ? (litFloor ? tint : roll < 0.05 ? '#39f0ff' : roll < 0.1 ? '#ffb83a' : '#ff8ad4') : 'rgba(8,4,32,0.45)';
            g.globalAlpha = on ? 0.85 : 1;
            g.fillRect(bx + 4 + cx * 8, yy, 4, 5);
            if (on) {
              g.globalAlpha = 0.18;
              g.fillRect(bx + 3 + cx * 8, yy - 1, 6, 7);
            }
            g.globalAlpha = 1;
          }
        }
        // caixa d'água ou máquinas no telhado
        if (rng.chance(0.35)) {
          const tx = bx + b.w * rng.range(0.55, 0.75);
          g.fillStyle = '#1a1248';
          g.fillRect(tx - 6, top - 12, 12, 10);
          g.fillRect(tx - 5, top - 2, 1.5, 2);
          g.fillRect(tx + 3.5, top - 2, 1.5, 2);
          g.fillStyle = 'rgba(255,170,140,0.25)';
          g.fillRect(tx - 6, top - 12, 1.5, 10);
        }
        // letreiro neon vertical
        if (b.h > 150 && rng.chance(0.55)) {
          const nx = bx + b.w - 9;
          const ny = top + rng.range(20, b.h * 0.5);
          const col = rng.pick(['#ff3fb4', '#39f0ff', '#b6ff3a', '#ffb83a']);
          g.fillStyle = col;
          g.globalAlpha = 0.28;
          g.fillRect(nx - 5, ny - 4, 14, 58);
          g.globalAlpha = 1;
          g.fillRect(nx, ny, 4, 50);
          g.fillStyle = '#ffffff';
          g.globalAlpha = 0.7;
          g.fillRect(nx + 1, ny, 1.4, 50);
          g.globalAlpha = 1;
        }
        // topo: antena / heliponto / caixa
        if (rng.chance(0.6)) {
          g.strokeStyle = '#150e40';
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(bx + b.w * 0.3, top);
          g.lineTo(bx + b.w * 0.3, top - rng.range(14, 40));
          g.stroke();
          g.fillStyle = '#ff3a4a';
          g.beginPath();
          g.arc(bx + b.w * 0.3, top - 30, 1.6, 0, 6.3);
          g.fill();
        }
        // dano: rombo aberto + brilho de fogo
        if (b.h > 170 && rng.chance(0.4)) {
          const dx = bx + b.w * rng.range(0.2, 0.6);
          const dy = top + rng.range(10, 60);
          g.fillStyle = '#0e0a2e';
          g.beginPath();
          g.moveTo(dx, dy);
          g.lineTo(dx + 22, dy + 6);
          g.lineTo(dx + 12, dy + 36);
          g.lineTo(dx - 4, dy + 22);
          g.closePath();
          g.fill();
          g.fillStyle = 'rgba(255,120,40,0.55)';
          g.fillRect(dx + 2, dy + 20, 8, 6);
        }
      } else if (rng.chance(0.4)) {
        g.fillStyle = '#ffb83a';
        g.globalAlpha = 0.6;
        g.fillRect(bx + rng.range(4, b.w - 6), top + rng.range(8, 30), 2, 2);
        g.globalAlpha = 1;
      }
    };
    for (const b of buildings) {
      drawB(b, 0);
      if (b.x + b.w > W) drawB(b, -W);
      if (b.x < 0) drawB(b, W);
    }
    // névoa na base
    const fog = g.createLinearGradient(0, H - 60, 0, H);
    fog.addColorStop(0, 'rgba(120,60,140,0)');
    fog.addColorStop(1, far ? 'rgba(150,70,150,0.55)' : 'rgba(110,50,140,0.5)');
    g.fillStyle = fog;
    g.fillRect(0, H - 60, W, 60);
    return { c, w: W, h: H, scale: bs, f: far ? 0.07 : 0.16, fy: far ? 0.03 : 0.07, foot: far ? '#4a2260' : '#3a1c5c' };
  }

  private highways(W: number, H: number, bs: number): Layer {
    const c = makeCanvas(W * bs, H * bs);
    const g = c.getContext('2d')!;
    g.scale(bs, bs);
    const rng = new Rng(21);
    const deckY = H - 62;
    // pilares
    for (let x = 30; x < W; x += 110) {
      const gr = g.createLinearGradient(0, deckY, 0, H);
      gr.addColorStop(0, '#2c2260');
      gr.addColorStop(1, '#1a1245');
      g.fillStyle = gr;
      g.fillRect(x, deckY, 14, H - deckY);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(x, deckY, 3, H - deckY);
    }
    // vãos com arcos
    g.strokeStyle = '#3a2f7a';
    g.lineWidth = 4;
    for (let x = 30; x < W; x += 110) {
      g.beginPath();
      g.moveTo(x + 14, deckY + 6);
      g.quadraticCurveTo(x + 62, deckY + 44, x + 110, deckY + 6);
      g.stroke();
    }
    // tabuleiro
    const dg = g.createLinearGradient(0, deckY - 8, 0, deckY + 6);
    dg.addColorStop(0, '#4a3c94');
    dg.addColorStop(1, '#241a58');
    g.fillStyle = dg;
    g.fillRect(0, deckY - 8, W, 14);
    g.fillStyle = '#ffb83a';
    g.globalAlpha = 0.7;
    for (let x = 0; x < W; x += 18) g.fillRect(x, deckY - 3, 8, 1.4);
    g.globalAlpha = 1;
    // postes com luz
    for (let x = 12; x < W; x += 55) {
      g.fillStyle = '#1a1245';
      g.fillRect(x, deckY - 30, 2, 24);
      g.fillStyle = '#ffd7a8';
      g.fillRect(x - 3, deckY - 32, 8, 2);
      g.globalAlpha = 0.22;
      g.fillStyle = '#ffd7a8';
      g.beginPath();
      g.moveTo(x - 3, deckY - 30);
      g.lineTo(x + 5, deckY - 30);
      g.lineTo(x + 18, deckY - 8);
      g.lineTo(x - 16, deckY - 8);
      g.closePath();
      g.fill();
      g.globalAlpha = 1;
    }
    // um trecho quebrado (ruína de guerra)
    void rng;
    return { c, w: W, h: H, scale: bs, f: 0.3, fy: 0.13, foot: '#1a1245' };
  }

  private nearStructures(W: number, H: number, bs: number, ruin: boolean): Layer {
    const c = makeCanvas(W * bs, H * bs);
    const g = c.getContext('2d')!;
    g.scale(bs, bs);
    const rng = new Rng(ruin ? 41 : 31);
    const col1 = ruin ? '#251f4a' : '#1d1846';
    const col2 = ruin ? '#171235' : '#120e34';
    const acc = ruin ? '#8fd05a' : '#39f0ff';
    let x = 0;
    while (x < W) {
      const kind = rng.int(0, 4);
      const w = rng.range(70, 190);
      const h = rng.range(90, 300);
      const top = H - h;
      if (kind === 0) {
        // torre/reservatório cilíndrico
        const gr = g.createLinearGradient(x, 0, x + w * 0.6, 0);
        gr.addColorStop(0, '#2c2560');
        gr.addColorStop(1, col2);
        g.fillStyle = gr;
        g.fillRect(x + 10, top + 20, w * 0.6, h - 20);
        g.beginPath();
        g.ellipse(x + 10 + w * 0.3, top + 20, w * 0.3, 10, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.07)';
        g.fillRect(x + 14, top + 22, 5, h - 24);
        g.fillStyle = acc;
        g.globalAlpha = 0.55;
        for (let yy = top + 50; yy < H - 20; yy += 46) g.fillRect(x + 10, yy, w * 0.6, 2);
        g.globalAlpha = 1;
      } else if (kind === 1) {
        // guindaste treliçado
        g.strokeStyle = col1;
        g.lineWidth = 3;
        const mastX = x + 24;
        g.beginPath();
        g.moveTo(mastX, H);
        g.lineTo(mastX, top);
        g.moveTo(mastX + 14, H);
        g.lineTo(mastX + 14, top);
        g.stroke();
        g.lineWidth = 1.4;
        for (let yy = top; yy < H - 12; yy += 14) {
          g.beginPath();
          g.moveTo(mastX, yy);
          g.lineTo(mastX + 14, yy + 14);
          g.moveTo(mastX + 14, yy);
          g.lineTo(mastX, yy + 14);
          g.stroke();
        }
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(mastX - 20, top + 8);
        g.lineTo(mastX + w * 0.85, top + 8);
        g.stroke();
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(mastX + w * 0.8, top + 8);
        g.lineTo(mastX + w * 0.8, top + 50);
        g.stroke();
        g.fillStyle = '#ff3a4a';
        g.beginPath();
        g.arc(mastX + 7, top - 3, 2, 0, 6.3);
        g.fill();
      } else if (kind === 2) {
        // prédio industrial com chaminés e passarelas
        const gr = g.createLinearGradient(0, top, 0, H);
        gr.addColorStop(0, col1);
        gr.addColorStop(1, col2);
        g.fillStyle = gr;
        g.fillRect(x, top + 30, w, h - 30);
        g.fillRect(x + 10, top + 8, 14, 30);
        g.fillRect(x + w - 28, top, 14, 40);
        g.fillStyle = 'rgba(255,255,255,0.05)';
        g.fillRect(x, top + 30, w, 3);
        g.fillStyle = acc;
        g.globalAlpha = 0.85;
        for (let i = 0; i < 6; i++) g.fillRect(x + 8 + i * (w - 16) / 6, top + 50, 8, 4);
        g.globalAlpha = 1;
        g.strokeStyle = col1;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x - 30, top + h * 0.5);
        g.lineTo(x + w + 30, top + h * 0.5);
        g.stroke();
        g.lineWidth = 1;
        for (let xx = x - 30; xx < x + w + 30; xx += 8) {
          g.beginPath();
          g.moveTo(xx, top + h * 0.5);
          g.lineTo(xx, top + h * 0.5 - 8);
          g.stroke();
        }
        g.fillStyle = '#ff5a3a';
        g.beginPath();
        g.arc(x + w - 21, top - 3, 2, 0, 6.3);
        g.fill();
      } else if (kind === 3) {
        // cachoeira artificial descendo de uma estrutura
        const gr = g.createLinearGradient(0, top + 30, 0, H);
        gr.addColorStop(0, col1);
        gr.addColorStop(1, col2);
        g.fillStyle = gr;
        g.fillRect(x, top + 30, w * 0.5, h - 30);
        g.fillRect(x + w * 0.5 + 24, top + 60, w * 0.35, h - 60);
        const wg = g.createLinearGradient(0, top + 34, 0, H);
        wg.addColorStop(0, 'rgba(140,240,255,0.85)');
        wg.addColorStop(1, 'rgba(110,190,255,0.25)');
        g.fillStyle = wg;
        g.fillRect(x + w * 0.5, top + 34, 24, h - 34);
        g.fillStyle = 'rgba(255,255,255,0.5)';
        for (let i = 0; i < 6; i++) g.fillRect(x + w * 0.5 + 3 + (i % 3) * 7, top + 40 + i * 26, 2, 16);
        g.fillStyle = 'rgba(255,255,255,0.4)';
        g.beginPath();
        g.ellipse(x + w * 0.5 + 12, H - 6, 22, 8, 0, 0, 6.3);
        g.fill();
        g.fillStyle = acc;
        g.globalAlpha = 0.7;
        g.fillRect(x + 4, top + 44, w * 0.5 - 8, 2);
        g.globalAlpha = 1;
      } else {
        // torre de comunicação com parabólica
        g.fillStyle = col1;
        g.fillRect(x + 20, top, 8, h);
        g.beginPath();
        g.moveTo(x + 4, H);
        g.lineTo(x + 24, top + 40);
        g.lineTo(x + 44, H);
        g.closePath();
        g.fill();
        g.beginPath();
        g.ellipse(x + 40, top + 14, 22, 9, -0.5, 0, 6.3);
        g.fillStyle = '#2c2560';
        g.fill();
        g.fillStyle = acc;
        g.beginPath();
        g.arc(x + 24, top - 2, 2.2, 0, 6.3);
        g.fill();
      }
      // vegetação sobre estruturas (ruínas)
      if (ruin) {
        for (let i = 0; i < 9; i++) {
          const vx = x + rng.range(0, w);
          const vy = top + rng.range(30, h * 0.7);
          g.fillStyle = rng.chance(0.5) ? '#3a7a3a' : '#2c6030';
          g.beginPath();
          g.ellipse(vx, vy, rng.range(6, 16), rng.range(5, 12), 0, 0, 6.3);
          g.fill();
          g.strokeStyle = '#3a7a3a';
          g.lineWidth = 1.2;
          g.beginPath();
          g.moveTo(vx, vy);
          g.lineTo(vx + rng.range(-3, 3), vy + rng.range(10, 40));
          g.stroke();
        }
      }
      x += w + rng.range(-10, 60);
    }
    // base sólida e névoa
    g.fillStyle = col2;
    g.fillRect(0, H - 14, W, 14);
    const fog = g.createLinearGradient(0, H - 90, 0, H);
    fog.addColorStop(0, 'rgba(90,40,120,0)');
    fog.addColorStop(1, 'rgba(90,40,120,0.6)');
    g.fillStyle = fog;
    g.fillRect(0, H - 90, W, 90);
    return { c, w: W, h: H, scale: bs, f: 0.42, fy: 0.2, foot: col2 };
  }

  // ------------------------------------------------------------------ desenho
  private skyColors(t: number): string[] {
    const a = clamp(t, 0, 1) * 2;
    const i = Math.min(1, Math.floor(a));
    const f = a - i;
    return SKY_STOPS[i].map((c, k) => mixColor(c, SKY_STOPS[i + 1][k], f));
  }

  draw(g: CanvasRenderingContext2D, s: BgState, dt: number) {
    const W = s.viewW;
    const H = s.viewH;
    // A — céu, estrelas, planeta e sol: mudam muito devagar → imagem em cache, refeita a cada
    // poucos quadros ou quando a câmera desloca o bastante para se notar (economiza ~6 preenchimentos
    // de tela cheia por quadro, sem diferença visível)
    this.drawFarCached(g, s);
    // B — naves distantes
    this.drawShips(g, s, dt);
    // C, D
    this.drawLayer(g, this.layers.far, s);
    this.drawSearchlights(g, s, dt);
    this.drawLayer(g, this.layers.big, s);
    // F — batalhas distantes (flashes + colunas de fumaça)
    this.drawBattles(g, s, dt);
    // E — rodovias
    this.drawLayer(g, this.layers.hwy, s);
    this.drawTraffic(g, s);
    // G — estruturas próximas (industrial ou ruínas). Antes as duas camadas eram desenhadas juntas,
    // com transparência, durante quase toda a segunda metade da fase (dobro de pintura de tela no
    // celular — era o que fazia o jogo engasgar a partir das ruínas). Agora só uma, e a mistura
    // acontece apenas na curta faixa de transição.
    const ru = s.ruin < 0.3 ? 0 : s.ruin > 0.7 ? 1 : (s.ruin - 0.3) / 0.4;
    if (ru < 0.999) this.drawLayer(g, this.layers.near, s, 1 - ru);
    if (ru > 0.001) this.drawLayer(g, this.layersRuin, s, ru);
  }

  private farC: HTMLCanvasElement | null = null;
  private farX = 1e9;
  private farY = 1e9;
  private farSky = -1;
  private farAge = 99;
  private farK = 0;
  private drawFarCached(g: CanvasRenderingContext2D, s: BgState) {
    const W = s.viewW;
    const H = s.viewH;
    const m = g.getTransform();
    const k = m.a;
    const cw = Math.max(1, Math.round(W * k));
    const ch = Math.max(1, Math.round(H * k));
    if (!this.farC) this.farC = document.createElement('canvas');
    const c = this.farC;
    const moved = Math.abs(s.camX - this.farX) * 0.01 * k > 0.6 || Math.abs(s.camY - this.farY) * 0.01 * k > 0.6;
    this.farAge++;
    if (c.width !== cw || c.height !== ch || this.farK !== k || Math.abs(s.sky - this.farSky) > 0.004 || moved || this.farAge >= 4) {
      if (c.width !== cw || c.height !== ch) {
        c.width = cw;
        c.height = ch;
      }
      const cg = c.getContext('2d')!;
      cg.setTransform(k, 0, 0, k, 0, 0);
      cg.globalAlpha = 1;
      cg.globalCompositeOperation = 'source-over';
      this.paintFar(cg, s);
      this.farX = s.camX;
      this.farY = s.camY;
      this.farSky = s.sky;
      this.farK = k;
      this.farAge = 0;
    }
    g.drawImage(c, 0, 0, W, H);
  }

  private paintFar(g: CanvasRenderingContext2D, s: BgState) {
    const W = s.viewW;
    const H = s.viewH;
    const cols = this.skyColors(s.sky);
    const gr = g.createLinearGradient(0, 0, 0, H * 0.92);
    cols.forEach((c, i) => gr.addColorStop(i / (cols.length - 1), c));
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    // estrelas (mais visíveis quando escuro)
    const starA = clamp(0.25 + s.sky * 0.85, 0, 1);
    g.globalAlpha = starA;
    const sx = -((s.camX * 0.01) % 640);
    g.drawImage(this.stars, sx, 0, 1280, 360);
    g.drawImage(this.stars, sx + 1280, 0, 1280, 360);
    g.globalAlpha = 1;
    // planeta gigante + halo
    {
      const px = W - 230 - s.camX * 0.006;
      const py = 6 - (s.camY - s.refY) * 0.01;
      const halo = glowSprite('#ff7ac0', 32);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.18 * (1 - s.sky * 0.4);
      g.drawImage(halo.c, px - 30, py + 10, 320, 320);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.drawImage(this.planet, px, py, 260, 260);
    }
    // sol baixo (brilho no horizonte)
    {
      const sun = glowSprite('#ffb070', 32);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5 * (1 - s.sky * 0.75);
      const sxp = W * 0.28 - s.camX * 0.004;
      g.drawImage(sun.c, sxp - 190, H * 0.5, 380, 260);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
  }

  private drawLayer(g: CanvasRenderingContext2D, L: Layer, s: BgState, alpha = 1) {
    if (alpha <= 0.01) return;
    const off = s.camX * L.f;
    let x0 = -(off % L.w);
    if (x0 > 0) x0 -= L.w;
    const dy = -(s.camY - s.refY) * L.fy;
    const yBottom = s.viewH + dy + 6;
    const y = yBottom - L.h;
    g.globalAlpha = alpha;
    // preenche abaixo da imagem (câmera descendo)
    if (yBottom < s.viewH) {
      g.fillStyle = L.foot;
      g.fillRect(0, yBottom - 1, s.viewW, s.viewH - yBottom + 2);
    }
    for (let x = x0; x < s.viewW; x += L.w) g.drawImage(L.c, x, y, L.w, L.h);
    g.globalAlpha = 1;
    // tinge com o "clima" (mais escuro à noite)
    if (s.sky > 0.05) {
      g.globalAlpha = 0.32 * s.sky * alpha;
      g.fillStyle = '#06041e';
      g.fillRect(0, Math.max(0, y), s.viewW, s.viewH - Math.max(0, y));
      g.globalAlpha = 1;
    }
  }

  private drawShips(g: CanvasRenderingContext2D, s: BgState, dt: number) {
    const t = s.time;
    for (const sh of this.ships) {
      sh.x += sh.dir * (8 + sh.s * 6) * dt;
      const span = 900;
      const px = ((sh.x - s.camX * 0.03) % span + span) % span - 120;
      const py = sh.y - (s.camY - s.refY) * 0.02;
      g.save();
      g.translate(px, py);
      g.scale(sh.dir * sh.s, sh.s);
      g.fillStyle = '#231a5a';
      if (sh.kind === 0) {
        // cruzador
        g.beginPath();
        g.moveTo(-40, 0);
        g.lineTo(-20, -8);
        g.lineTo(30, -6);
        g.lineTo(48, 2);
        g.lineTo(20, 8);
        g.lineTo(-30, 7);
        g.closePath();
        g.fill();
        g.fillRect(-10, -14, 22, 8);
      } else if (sh.kind === 1) {
        // caça
        g.beginPath();
        g.moveTo(-16, 0);
        g.lineTo(0, -7);
        g.lineTo(20, 0);
        g.lineTo(0, 5);
        g.closePath();
        g.fill();
        g.fillRect(-22, -2, 8, 3);
      } else {
        // nave-mãe achatada
        g.beginPath();
        g.ellipse(0, 0, 60, 9, 0, 0, Math.PI * 2);
        g.fill();
        g.fillRect(-26, -14, 52, 8);
      }
      // luzes piscando
      const on = Math.sin(t * 3 + sh.ph) > 0;
      g.fillStyle = on ? '#ff3a4a' : '#ffd23a';
      g.fillRect(-4, 2, 2, 2);
      g.fillRect(24, -2, 2, 2);
      g.globalCompositeOperation = 'lighter';
      const gl = softDot('#39f0ff', 16);
      g.globalAlpha = 0.6;
      g.drawImage(gl.c, -50, -6, 16, 12);
      g.restore();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  private drawSearchlights(g: CanvasRenderingContext2D, s: BgState, dt: number) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const l of this.lights) {
      l.a += l.da * dt;
      if (l.a < -2.4 || l.a > -0.75) l.da *= -1;
      const x = ((l.x - s.camX * 0.1) % 700 + 700) % 700 - 30;
      const y = s.viewH * 0.78 - (s.camY - s.refY) * 0.08;
      g.fillStyle = l.hue;
      g.globalAlpha = 0.07 + 0.03 * s.sky;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(l.a - 0.06) * 420, y + Math.sin(l.a - 0.06) * 420);
      g.lineTo(x + Math.cos(l.a + 0.06) * 420, y + Math.sin(l.a + 0.06) * 420);
      g.closePath();
      g.fill();
    }
    g.restore();
    g.globalAlpha = 1;
  }

  private drawBattles(g: CanvasRenderingContext2D, s: BgState, dt: number) {
    this.flashCd -= dt;
    if (this.flashCd <= 0) {
      this.flashCd = this.rng.range(0.8, 3.2) / Math.max(0.3, s.intensity);
      this.flashes.push({ x: this.rng.range(0, 900), y: this.rng.range(0.45, 0.72), t: 0, r: this.rng.range(18, 46) });
      if (this.flashes.length > 6) this.flashes.shift();
    }
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const f of this.flashes) {
      f.t += dt;
      const life = 0.7;
      if (f.t > life) continue;
      const k = 1 - f.t / life;
      const x = ((f.x - s.camX * 0.26) % 900 + 900) % 900 - 120;
      const y = s.viewH * f.y - (s.camY - s.refY) * 0.12;
      const spr = glowSprite('#ff9a4a', 32);
      const r = f.r * (1.4 - k * 0.6);
      g.globalAlpha = k * k * 0.85;
      g.drawImage(spr.c, x - r, y - r, r * 2, r * 2);
    }
    g.restore();
    // colunas de fumaça distantes
    g.globalAlpha = 0.35;
    const smoke = softDot('#3a2a5a', 16);
    for (let i = 0; i < 5; i++) {
      const x = ((i * 240 + 60 - s.camX * 0.22) % 1200 + 1200) % 1200 - 200;
      const baseY = s.viewH * 0.78 - (s.camY - s.refY) * 0.1;
      for (let k = 0; k < 6; k++) {
        const r = 16 + k * 7;
        g.drawImage(smoke.c, x + Math.sin(s.time * 0.4 + k + i) * 8 + k * 3, baseY - k * 26, r * 2, r * 2);
      }
    }
    g.globalAlpha = 1;
  }

  private drawTraffic(g: CanvasRenderingContext2D, s: BgState) {
    const L = this.layers.hwy;
    const dy = -(s.camY - s.refY) * L.fy;
    const y = s.viewH + dy + 6 - L.h + (L.h - 62) - 5;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const spd = 26 + (i % 3) * 14;
      const dir = i % 2 === 0 ? 1 : -1;
      const wrap = 1100;
      const x = ((i * 173 + s.time * spd * dir - s.camX * L.f) % wrap + wrap) % wrap - 200;
      g.fillStyle = dir === 1 ? '#ffe9a8' : '#ff5a5a';
      g.globalAlpha = 0.9;
      g.fillRect(x, y - (dir === 1 ? 2 : 0), 5, 2);
      g.globalAlpha = 0.25;
      g.fillRect(x - dir * 8, y - 1, 14, 3);
    }
    g.restore();
    g.globalAlpha = 1;
  }

  /** Primeiro plano: fog rasteiro, brasas e vinheta (chamado depois do mundo). */
  drawForeground(g: CanvasRenderingContext2D, s: BgState, dt: number) {
    const W = s.viewW;
    const H = s.viewH;
    // brasas/cinzas flutuando
    g.globalCompositeOperation = 'lighter';
    for (const e of this.embers) {
      e.x += (e.vx - 8) * dt;
      e.y += e.vy * dt;
      if (e.y < -10) {
        e.y = H + 10;
        e.x = Math.random() * (W + 80);
      }
      if (e.x < -10) e.x = W + 10;
      const tw = 0.5 + 0.5 * Math.sin(s.time * 3 + e.ph);
      g.globalAlpha = 0.6 * tw * clamp(s.intensity, 0.2, 1);
      g.fillStyle = e.ph > 3 ? '#ffb347' : '#ff7a4a';
      g.fillRect(e.x, e.y, e.s, e.s);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // fog rasteiro suave (base) — degradê criado uma vez
    if (!this.fogC) {
      this.fogC = makeCanvas(2, 64);
      const fg = this.fogC.getContext('2d')!;
      const fog = fg.createLinearGradient(0, 0, 0, 64);
      fog.addColorStop(0, 'rgba(80,30,110,0)');
      fog.addColorStop(1, 'rgba(80,30,110,0.28)');
      fg.fillStyle = fog;
      fg.fillRect(0, 0, 2, 64);
    }
    g.drawImage(this.fogC, 0, 0, 2, 64, 0, H * 0.72, W, H * 0.28);
  }

  private fogC: HTMLCanvasElement | null = null;
  /** Vinheta e correção de cor (uma vez, em cache por tamanho). */
  private vig: HTMLCanvasElement | null = null;
  private vigKey = '';
  drawVignette(g: CanvasRenderingContext2D, W: number, H: number, strength = 1) {
    const key = `${Math.round(W)}x${Math.round(H)}`;
    if (!this.vig || this.vigKey !== key) {
      const c = makeCanvas(W, H);
      const cg = c.getContext('2d')!;
      const gr = cg.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, Math.max(W, H) * 0.72);
      gr.addColorStop(0, 'rgba(6,2,20,0)');
      gr.addColorStop(1, 'rgba(6,2,20,0.55)');
      cg.fillStyle = gr;
      cg.fillRect(0, 0, W, H);
      this.vig = c;
      this.vigKey = key;
    }
    g.globalAlpha = strength;
    g.drawImage(this.vig, 0, 0, W, H);
    g.globalAlpha = 1;
  }

  colorAt(t: number) {
    return hexToRgb(this.skyColors(t)[2]);
  }
}

void lerp;
