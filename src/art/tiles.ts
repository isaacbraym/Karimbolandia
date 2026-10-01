/** Tiles autotile por tema (atlas baked) + renderizador otimizado (só o que está visível). */
import { bake, makeCanvas, OUT } from './kit';
import { PAL } from './palette';
import { Rng, shade, mixColor } from '../core/math';
import { Level, T, TILE } from '../game/level';

const CELL = 64; // px do atlas por tile (2x)
const N_MASK = 16;
const N_VAR = 2;
// colunas: [0..31] sólidos (mask*2+var), 32..34 one-way (esq, meio, dir), 35..36 hazard
const COLS = 37;

interface ThemeDef {
  base: string;
  dark: string;
  light: string;
  edge: string; // aresta superior
  accent: string; // neon/faixa
  detail: string;
}

const THEMES: ThemeDef[] = [
  // STREET — concreto urbano
  { base: '#4f5578', dark: '#33375a', light: '#6d749c', edge: '#8790b8', accent: '#ffb83a', detail: '#2a2d4a' },
  // STEEL — aço industrial
  { base: '#2f5566', dark: '#1d3947', light: '#4d7d90', edge: '#7fc4d8', accent: '#39f0ff', detail: '#16303c' },
  // RUINS — concreto rachado com musgo
  { base: '#5b5670', dark: '#3d394f', light: '#7c7796', edge: '#7fa060', accent: '#9ad14a', detail: '#2f2b40' },
  // HANGAR — painéis escuros com luz ciano
  { base: '#2a2f55', dark: '#191c38', light: '#454c80', edge: '#6a76c0', accent: '#ff3fb4', detail: '#12142b' },
];

export interface TileArt {
  atlas: HTMLCanvasElement;
  render(g: CanvasRenderingContext2D, level: Level, camX: number, camY: number, camW: number, camH: number, time: number): void;
}

export function bakeTiles(): TileArt {
  const atlas = makeCanvas(COLS * CELL, THEMES.length * CELL);
  const ag = atlas.getContext('2d')!;
  THEMES.forEach((th, ti) => {
    for (let mask = 0; mask < N_MASK; mask++) {
      for (let v = 0; v < N_VAR; v++) {
        const cell = bake(TILE, TILE, (g) => drawSolid(g, th, ti, mask, v), { scale: 2 });
        ag.drawImage(cell.c, (mask * N_VAR + v) * CELL, ti * CELL);
      }
    }
    for (let k = 0; k < 3; k++) {
      const cell = bake(TILE, TILE, (g) => drawOneWay(g, th, k), { scale: 2 });
      ag.drawImage(cell.c, (32 + k) * CELL, ti * CELL);
    }
    for (let k = 0; k < 2; k++) {
      const cell = bake(TILE, TILE, (g) => drawHazard(g, th, k), { scale: 2 });
      ag.drawImage(cell.c, (35 + k) * CELL, ti * CELL);
    }
  });

  // ---- cache de blocos: 8×8 tiles viram UMA imagem (≈300 drawImage/quadro → ≈12–24)
  const CH = 8;
  const CPX = CH * CELL; // 512 px (2x, igual ao atlas)
  interface Chunk { c: HTMLCanvasElement | null; empty: boolean; hazards: number[]; used: number }
  const chunks = new Map<number, Chunk>();
  let cacheRev = -1;
  let cacheLevel: Level | null = null;
  let frame = 0;
  const pool: HTMLCanvasElement[] = [];
  const MAX_CHUNKS = 40;

  const drawTile = (g: CanvasRenderingContext2D, level: Level, tx: number, ty: number, ox: number, oy: number, k: number, time: number) => {
    const t = level.tiles[ty * level.w + tx];
    if (t === T.EMPTY) return;
    const th = level.theme[ty * level.w + tx];
    const sy = th * CELL;
    const dx = (tx * TILE - ox) * k;
    const dy = (ty * TILE - oy) * k;
    if (t === T.SOLID) {
      const up = level.get(tx, ty - 1) === T.SOLID ? 1 : 0;
      const rt = level.get(tx + 1, ty) === T.SOLID ? 2 : 0;
      const dn = level.get(tx, ty + 1) === T.SOLID ? 4 : 0;
      const lf = level.get(tx - 1, ty) === T.SOLID ? 8 : 0;
      const mask = up | rt | dn | lf;
      const v = (tx * 7 + ty * 13 + ((tx * ty) & 3)) & 1;
      g.drawImage(atlas, (mask * N_VAR + v) * CELL, sy, CELL, CELL, dx, dy, (TILE + 0.6) * k, (TILE + 0.6) * k);
    } else if (t === T.ONEWAY) {
      const l = level.get(tx - 1, ty) === T.ONEWAY;
      const r = level.get(tx + 1, ty) === T.ONEWAY;
      const kk = !l ? 0 : !r ? 2 : 1;
      g.drawImage(atlas, (32 + kk) * CELL, sy, CELL, CELL, dx, dy, (TILE + 0.6) * k, TILE * k);
    } else if (t === T.HAZARD) {
      const kk = Math.floor(time * 6 + tx) % 2;
      g.drawImage(atlas, (35 + kk) * CELL, sy, CELL, CELL, dx, dy, TILE * k, TILE * k);
    }
  };

  const buildChunk = (level: Level, cx: number, cy: number): Chunk => {
    const hazards: number[] = [];
    let any = false;
    for (let ty = cy * CH; ty < cy * CH + CH && ty < level.h; ty++) {
      for (let tx = cx * CH; tx < cx * CH + CH && tx < level.w; tx++) {
        const t = level.tiles[ty * level.w + tx];
        if (t === T.HAZARD) hazards.push(ty * level.w + tx);
        else if (t !== T.EMPTY) any = true;
      }
    }
    if (!any) return { c: null, empty: true, hazards, used: frame };
    const c = pool.pop() ?? makeCanvas(CPX + 2, CPX + 2);
    const cg = c.getContext('2d')!;
    cg.clearRect(0, 0, c.width, c.height);
    const k = CELL / TILE;
    for (let ty = cy * CH; ty < cy * CH + CH && ty < level.h; ty++) {
      for (let tx = cx * CH; tx < cx * CH + CH && tx < level.w; tx++) {
        if (level.tiles[ty * level.w + tx] === T.HAZARD) continue;
        drawTile(cg, level, tx, ty, cx * CH * TILE, cy * CH * TILE, k, 0);
      }
    }
    return { c, empty: false, hazards, used: frame };
  };

  const dropChunk = (key: number) => {
    const ch = chunks.get(key);
    if (ch?.c) pool.push(ch.c);
    chunks.delete(key);
  };

  const render = (g: CanvasRenderingContext2D, level: Level, camX: number, camY: number, camW: number, camH: number, time: number) => {
    frame++;
    if (cacheLevel !== level || cacheRev !== level.rev) {
      for (const k of [...chunks.keys()]) dropChunk(k);
      cacheLevel = level;
      cacheRev = level.rev;
      level.dirtyChunks.clear();
    }
    if (level.dirtyChunks.size) {
      for (const k of level.dirtyChunks) dropChunk(k);
      level.dirtyChunks.clear();
    }
    const cx0 = Math.max(0, Math.floor((camX - TILE) / (CH * TILE)));
    const cx1 = Math.min(Math.ceil(level.w / CH) - 1, Math.floor((camX + camW + TILE) / (CH * TILE)));
    const cy0 = Math.max(0, Math.floor((camY - TILE) / (CH * TILE)));
    const cy1 = Math.min(Math.ceil(level.h / CH) - 1, Math.floor((camY + camH + TILE) / (CH * TILE)));
    let built = 0;
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const key = cy * 4096 + cx;
        let ch = chunks.get(key);
        if (!ch) {
          if (built >= 2) {
            // limite de montagem por quadro (sem engasgos): desenha tile a tile por enquanto
            for (let ty = cy * CH; ty < cy * CH + CH && ty < level.h; ty++) for (let tx = cx * CH; tx < cx * CH + CH && tx < level.w; tx++) drawTile(g, level, tx, ty, 0, 0, 1, time);
            continue;
          }
          ch = buildChunk(level, cx, cy);
          chunks.set(key, ch);
          built++;
        }
        ch.used = frame;
        if (ch.c) g.drawImage(ch.c, 0, 0, CPX + 0.6 * (CELL / TILE), CPX + 0.6 * (CELL / TILE), cx * CH * TILE, cy * CH * TILE, CH * TILE + 0.6, CH * TILE + 0.6);
        for (const i of ch.hazards) drawTile(g, level, i % level.w, Math.floor(i / level.w), 0, 0, 1, time);
      }
    }
    // LRU: descarta blocos longe da câmera
    if (chunks.size > MAX_CHUNKS) {
      const arr = [...chunks.entries()].sort((a, b) => a[1].used - b[1].used);
      for (let i = 0; i < arr.length - MAX_CHUNKS; i++) dropChunk(arr[i][0]);
    }
  };
  const renderLegacy = (g: CanvasRenderingContext2D, level: Level, camX: number, camY: number, camW: number, camH: number, time: number) => {
    const x0 = Math.max(0, Math.floor(camX / TILE) - 1);
    const x1 = Math.min(level.w - 1, Math.floor((camX + camW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(camY / TILE) - 1);
    const y1 = Math.min(level.h - 1, Math.floor((camY + camH) / TILE) + 1);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = level.tiles[ty * level.w + tx];
        if (t === T.EMPTY) continue;
        const th = level.theme[ty * level.w + tx];
        const sy = th * CELL;
        if (t === T.SOLID) {
          const up = level.get(tx, ty - 1) === T.SOLID ? 1 : 0;
          const rt = level.get(tx + 1, ty) === T.SOLID ? 2 : 0;
          const dn = level.get(tx, ty + 1) === T.SOLID ? 4 : 0;
          const lf = level.get(tx - 1, ty) === T.SOLID ? 8 : 0;
          const mask = up | rt | dn | lf;
          const v = (tx * 7 + ty * 13 + ((tx * ty) & 3)) & 1;
          g.drawImage(atlas, (mask * N_VAR + v) * CELL, sy, CELL, CELL, tx * TILE, ty * TILE, TILE + 0.6, TILE + 0.6);
        } else if (t === T.ONEWAY) {
          const l = level.get(tx - 1, ty) === T.ONEWAY;
          const r = level.get(tx + 1, ty) === T.ONEWAY;
          const k = !l ? 0 : !r ? 2 : 1;
          g.drawImage(atlas, (32 + k) * CELL, sy, CELL, CELL, tx * TILE, ty * TILE, TILE + 0.6, TILE);
        } else if (t === T.HAZARD) {
          const k = Math.floor(time * 6 + tx) % 2;
          g.drawImage(atlas, (35 + k) * CELL, sy, CELL, CELL, tx * TILE, ty * TILE, TILE, TILE);
        }
      }
    }
  };
  void renderLegacy;
  return { atlas, render };
}

function drawSolid(g: CanvasRenderingContext2D, th: ThemeDef, ti: number, mask: number, v: number) {
  const rng = new Rng(ti * 1000 + mask * 10 + v + 7);
  const up = !!(mask & 1);
  const rt = !!(mask & 2);
  const dn = !!(mask & 4);
  const lf = !!(mask & 8);
  // base
  const gr = g.createLinearGradient(0, 0, 0, TILE);
  gr.addColorStop(0, shade(th.base, 0.05));
  gr.addColorStop(1, shade(th.base, -0.12));
  g.fillStyle = gr;
  g.fillRect(0, 0, TILE, TILE);

  // textura por tema
  if (ti === 0) {
    // concreto: manchas + linhas de junta
    for (let i = 0; i < 14; i++) {
      g.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
      g.fillRect(rng.range(0, 30), rng.range(0, 30), rng.range(2, 8), rng.range(1, 4));
    }
    g.strokeStyle = th.detail;
    g.globalAlpha = 0.5;
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, TILE - 1, TILE - 1);
    g.globalAlpha = 1;
    if (v === 1) {
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.beginPath();
      g.moveTo(rng.range(6, 26), 0);
      g.lineTo(rng.range(6, 26), rng.range(10, 20));
      g.lineTo(rng.range(6, 26), TILE);
      g.stroke();
    }
  } else if (ti === 1) {
    // aço: placas com rebites e frisos
    g.strokeStyle = th.detail;
    g.lineWidth = 1.2;
    g.strokeRect(1, 1, TILE - 2, TILE - 2);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(3, 3, TILE - 6, 5);
    for (const [x, y] of [[4, 4], [TILE - 4, 4], [4, TILE - 4], [TILE - 4, TILE - 4]]) {
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.beginPath();
      g.arc(x, y, 1.2, 0, Math.PI * 2);
      g.fill();
    }
    if (v === 1) {
      g.strokeStyle = 'rgba(0,0,0,0.22)';
      g.beginPath();
      g.moveTo(TILE / 2, 3);
      g.lineTo(TILE / 2, TILE - 3);
      g.stroke();
      g.fillStyle = th.accent;
      g.globalAlpha = 0.5;
      g.fillRect(TILE / 2 - 1, 12, 2, 8);
      g.globalAlpha = 1;
    }
  } else if (ti === 2) {
    // ruínas: manchas de musgo, ferragens
    for (let i = 0; i < 16; i++) {
      g.fillStyle = rng.chance(0.4) ? 'rgba(120,170,80,0.10)' : 'rgba(0,0,0,0.09)';
      g.fillRect(rng.range(0, 30), rng.range(0, 30), rng.range(2, 9), rng.range(1, 5));
    }
    g.strokeStyle = th.detail;
    g.globalAlpha = 0.55;
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, TILE - 1, TILE - 1);
    g.globalAlpha = 1;
    if (v === 1) {
      g.strokeStyle = '#8a4a2a';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(rng.range(4, 28), rng.range(0, 6));
      g.lineTo(rng.range(4, 28), rng.range(12, 26));
      g.stroke();
    }
  } else {
    // hangar: painéis e luzes
    g.strokeStyle = th.detail;
    g.lineWidth = 1.4;
    g.strokeRect(1, 1, TILE - 2, TILE - 2);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(2, 2, TILE - 4, 3);
    g.fillStyle = th.accent;
    g.globalAlpha = 0.85;
    g.fillRect(4, TILE - 6, TILE - 8, 1.6);
    g.globalAlpha = 1;
    if (v === 1) {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 0; i < 4; i++) g.fillRect(8, 8 + i * 4, TILE - 16, 1.4);
    }
  }

  // arestas voltadas para o vazio
  if (!up) {
    g.fillStyle = th.edge;
    g.fillRect(0, 0, TILE, 4.5);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(0, 0, TILE, 1.6);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 4.5, TILE, 1.6);
    if (ti === 0) {
      // faixa amarela tracejada (asfalto)
      g.fillStyle = th.accent;
      for (let x = 2; x < TILE; x += 10) g.fillRect(x, 1.4, 6, 1.6);
    } else if (ti === 1) {
      g.fillStyle = th.accent;
      g.fillRect(0, 2.4, TILE, 1.4);
      g.globalAlpha = 0.35;
      g.fillRect(0, 4, TILE, 3);
      g.globalAlpha = 1;
    } else if (ti === 2) {
      // musgo/grama
      g.fillStyle = '#6fae44';
      g.fillRect(0, 0, TILE, 4);
      g.fillStyle = '#93d060';
      g.fillRect(0, 0, TILE, 2);
      for (let x = 0; x < TILE; x += 3) {
        const h = rng.range(2, 6);
        g.fillStyle = rng.chance(0.5) ? '#7bbd4c' : '#5c9a38';
        g.fillRect(x, 3, 2, h);
      }
    } else {
      g.fillStyle = th.accent;
      g.fillRect(0, 2, TILE, 1.2);
      g.globalAlpha = 0.3;
      g.fillRect(0, 3, TILE, 4);
      g.globalAlpha = 1;
    }
  }
  if (!dn) {
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, TILE - 5, TILE, 5);
    g.fillStyle = th.dark;
    g.fillRect(0, TILE - 2, TILE, 2);
    if (ti === 2 && rng.chance(0.6)) {
      g.fillStyle = '#5c9a38';
      const x = rng.range(3, 26);
      g.fillRect(x, TILE - 3, 2, rng.range(5, 12));
    }
  }
  if (!lf) {
    g.fillStyle = th.edge;
    g.globalAlpha = 0.5;
    g.fillRect(0, 0, 2, TILE);
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(2, 0, 1.4, TILE);
  }
  if (!rt) {
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(TILE - 3, 0, 3, TILE);
    g.fillStyle = mixColor(th.dark, '#000000', 0.3);
    g.fillRect(TILE - 1.5, 0, 1.5, TILE);
  }
  // contorno preto nas bordas expostas
  g.strokeStyle = OUT;
  g.lineWidth = 1.6;
  g.beginPath();
  if (!up) {
    g.moveTo(0, 0.8);
    g.lineTo(TILE, 0.8);
  }
  if (!dn) {
    g.moveTo(0, TILE - 0.8);
    g.lineTo(TILE, TILE - 0.8);
  }
  if (!lf) {
    g.moveTo(0.8, 0);
    g.lineTo(0.8, TILE);
  }
  if (!rt) {
    g.moveTo(TILE - 0.8, 0);
    g.lineTo(TILE - 0.8, TILE);
  }
  g.stroke();
}

function drawOneWay(g: CanvasRenderingContext2D, th: ThemeDef, k: number) {
  const x0 = k === 0 ? 1 : 0;
  const x1 = k === 2 ? TILE - 1 : TILE;
  g.fillStyle = th.dark;
  g.fillRect(x0, 8, x1 - x0, 4);
  // grade
  g.fillStyle = shade(th.base, 0.2);
  g.fillRect(x0, 2, x1 - x0, 6);
  g.fillStyle = th.edge;
  g.fillRect(x0, 2, x1 - x0, 1.8);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  for (let x = x0 + 3; x < x1 - 1; x += 5) g.fillRect(x, 4, 2, 3);
  g.fillStyle = th.accent;
  g.globalAlpha = 0.9;
  g.fillRect(x0, 8.4, x1 - x0, 1.2);
  g.globalAlpha = 1;
  // suportes
  g.fillStyle = shade(th.dark, 0.1);
  if (k !== 1) g.fillRect(k === 0 ? 3 : TILE - 6, 12, 3, 9);
  g.strokeStyle = OUT;
  g.lineWidth = 1.3;
  g.strokeRect(x0 + 0.6, 2.6, x1 - x0 - 1.2, 9);
}

function drawHazard(g: CanvasRenderingContext2D, th: ThemeDef, k: number) {
  g.fillStyle = th.dark;
  g.fillRect(0, TILE - 8, TILE, 8);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const x = i * (TILE / n);
    g.beginPath();
    g.moveTo(x + 1, TILE - 8);
    g.lineTo(x + TILE / n / 2, 6 + (i % 2) * 2);
    g.lineTo(x + TILE / n - 1, TILE - 8);
    g.closePath();
    const gr = g.createLinearGradient(0, 6, 0, TILE - 8);
    gr.addColorStop(0, '#e6ebff');
    gr.addColorStop(1, '#6a719a');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = OUT;
    g.lineWidth = 1.2;
    g.stroke();
    // ponta vermelha piscando
    g.fillStyle = k ? '#ff6a4a' : '#e2384a';
    g.beginPath();
    g.moveTo(x + TILE / n / 2 - 1.6, 11);
    g.lineTo(x + TILE / n / 2, 6 + (i % 2) * 2);
    g.lineTo(x + TILE / n / 2 + 1.6, 11);
    g.fill();
  }
  g.fillStyle = PAL.neonAmber;
  for (let x = 2; x < TILE; x += 8) g.fillRect(x, TILE - 4, 4, 2);
}
