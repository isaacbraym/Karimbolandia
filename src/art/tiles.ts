/** Tiles autotile por tema (atlas baked) + renderizador otimizado (só o que está visível). */
import { bake, makeCanvas, OUT, shadedRR } from './kit';
import { PAL } from './palette';
import { Rng, shade, mixColor } from '../core/math';
import { Level, T, TILE } from '../game/level';
import { GROUND_DEPTH } from './perspective';

const CELL = 64; // px do atlas por tile (2x)
const N_MASK = 16;
const N_VAR = 2;
// colunas: [0..31] sólidos (mask*2+var), 32..34 one-way (esq, meio, dir), 35..36 hazard,
// 37..38 franja de capim/folhas que cresce no tile vazio ACIMA do chão (só temas da selva)
const COLS = 39;

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
  // EARTH — terra escura da selva com raízes e pedrinhas (topo de capim)
  { base: '#5a3a26', dark: '#3a2418', light: '#7a5236', edge: '#5fa83a', accent: '#8fd65a', detail: '#2e1c12' },
  // WOOD — tábuas/troncos (plataformas, pontes, estacas)
  { base: '#8a5a32', dark: '#5a361c', light: '#b07a46', edge: '#c89458', accent: '#d9b27a', detail: '#3e2412' },
  // TEMPLE — blocos de pedra antiga com musgo
  { base: '#6f7a6a', dark: '#4a544a', light: '#929e8a', edge: '#6fae44', accent: '#9ad14a', detail: '#3a4238' },
  // MUD — lama do pântano / fundo do lago
  { base: '#3e3a26', dark: '#29261a', light: '#5a5436', edge: '#5a6a2a', accent: '#7a8a3a', detail: '#201e14' },
];
const JUNGLE0 = 4;

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
      const cell = bake(TILE, TILE, (g) => (ti >= JUNGLE0 ? drawPlank(g, th, k) : drawOneWay(g, th, k)), { scale: 2 });
      ag.drawImage(cell.c, (32 + k) * CELL, ti * CELL);
    }
    for (let k = 0; k < 2; k++) {
      const cell = bake(TILE, TILE, (g) => (ti >= JUNGLE0 ? drawStakes(g, th, k) : drawHazard(g, th, k)), { scale: 2 });
      ag.drawImage(cell.c, (35 + k) * CELL, ti * CELL);
    }
    if (ti >= JUNGLE0) {
      for (let k = 0; k < 2; k++) {
        const cell = bake(TILE, TILE, (g) => drawFringe(g, th, ti, k), { scale: 2 });
        ag.drawImage(cell.c, (37 + k) * CELL, ti * CELL);
      }
    }
  });

  // ---- cache de blocos: 8×8 tiles viram UMA imagem (≈300 drawImage/quadro → ≈12–24)
  const CH = 8;
  const CPX = CH * CELL; // 512 px (2x, igual ao atlas)
  const OVERHANG = 38 * (CELL / TILE); // largura do caminho em perspectiva + contorno
  const DOWNHANG = CELL + 2; // face lateral pode nascer na borda inferior do bloco
  interface Chunk { c: HTMLCanvasElement | null; empty: boolean; hazards: number[]; used: number }
  const chunks = new Map<number, Chunk>();
  let cacheRev = -1;
  let cacheLevel: Level | null = null;
  let frame = 0;
  const pool: HTMLCanvasElement[] = [];
  const MAX_CHUNKS = 40;

  const drawTile = (g: CanvasRenderingContext2D, level: Level, tx: number, ty: number, ox: number, oy: number, k: number, time: number) => {
    const t = level.tiles[ty * level.w + tx];
    if (t === T.EMPTY) {
      const below = level.get(tx, ty + 1);
      if (below === T.SOLID || below === T.ONEWAY) {
        const th = THEMES[level.themeAt(tx, ty + 1)];
        const x = (tx * TILE - ox) * k, y = ((ty + 1) * TILE - oy) * k;
        const rel = ty + 1 === level.reliefRow && below === T.SOLID;
        const h0 = rel ? level.relief[tx] * k : 0;
        const h1 = rel ? level.relief[tx + 1] * k : 0;
        // Face do relevo e topo em perspectiva; linha de contato legível.
        if (h0 > 0 || h1 > 0) {
          g.fillStyle = th.base;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h0);
          g.lineTo(x + TILE * k, y - h1); g.lineTo(x + TILE * k, y); g.fill();
        }
        const d = (below === T.ONEWAY ? 20 : GROUND_DEPTH.x) * k;
        const back = (below === T.ONEWAY ? 12 : GROUND_DEPTH.y) * k;
        g.fillStyle = th.light;
        g.beginPath(); g.moveTo(x, y - h0); g.lineTo(x + TILE * k, y - h1);
        g.lineTo(x + TILE * k + d, y - h1 - back); g.lineTo(x + d, y - h0 - back); g.closePath(); g.fill();
        if (level.get(tx + 1, ty + 1) === T.EMPTY) {
          const height = (below === T.ONEWAY ? 7 : TILE) * k;
          g.fillStyle = th.dark;
          g.beginPath(); g.moveTo(x + TILE * k, y - h1);
          g.lineTo(x + TILE * k + d, y - h1 - back);
          g.lineTo(x + TILE * k + d, y + height - back); g.lineTo(x + TILE * k, y + height); g.closePath(); g.fill();
          g.strokeStyle = th.edge; g.lineWidth = .8 * k; g.stroke();
        }
        g.strokeStyle = th.edge; g.lineWidth = 1.4 * k;
        g.beginPath(); g.moveTo(x, y - h0); g.lineTo(x + TILE * k, y - h1); g.stroke();
        // Juntas diagonais, folhas e pedrinhas pequenas no plano de cima.
        g.strokeStyle = th.dark; g.lineWidth = 0.65 * k;
        g.beginPath(); g.moveTo(x, y - h0); g.lineTo(x + d, y - h0 - back); g.stroke();
        g.strokeStyle = 'rgba(255,245,214,.25)'; g.lineWidth = .8 * k;
        g.beginPath(); g.moveTo(x+d, y-h0-back); g.lineTo(x+TILE*k+d,y-h1-back); g.stroke();
        g.strokeStyle = 'rgba(35,30,22,.13)';
        g.beginPath();g.moveTo(x+d*.48,y-h0-back*.48);g.lineTo(x+TILE*k+d*.48,y-h1-back*.48);g.stroke();
        if (th === THEMES[4] || th === THEMES[7]) {
          g.fillStyle = tx % 3 ? '#91a24e' : '#a89060';
          g.beginPath(); g.ellipse(x + 18 * k, y - (h0 + h1) / 2 - 4 * k, 3 * k, 1.2 * k, -0.35, 0, Math.PI * 2); g.fill();
        }
      }
      // capim/samambaia crescendo sobre o chão da selva (desenhado no tile vazio de cima)
      if (ty + 1 < level.h && level.tiles[(ty + 1) * level.w + tx] === T.SOLID) {
        const tb = level.theme[(ty + 1) * level.w + tx];
        if (tb >= JUNGLE0 && tb !== 5) {
          const v = (tx * 5 + ty * 3) & 1;
          const rise = ty + 1 === level.reliefRow ? (level.relief[tx] + level.relief[tx + 1]) / 2 : 0;
          g.drawImage(atlas, (37 + v) * CELL, tb * CELL, CELL, CELL, (tx * TILE - ox) * k, (ty * TILE - oy - rise) * k, (TILE + 0.6) * k, TILE * k);
        }
      }
      return;
    }
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
        else if (ty + 1 < level.h && (level.get(tx, ty + 1) === T.SOLID || level.get(tx, ty + 1) === T.ONEWAY)) any = true;
      }
    }
    if (!any) return { c: null, empty: true, hazards, used: frame };
    const c = pool.pop() ?? makeCanvas(CPX + OVERHANG, CPX + DOWNHANG);
    const cg = c.getContext('2d')!;
    cg.clearRect(0, 0, c.width, c.height);
    const k = CELL / TILE;
    for (let ty = cy * CH; ty < cy * CH + CH && ty < level.h; ty++) {
      // Le dessus projeté du voisin de gauche peut entrer dans ce bloc.
      if (cx > 0 && level.get(cx * CH - 1, ty) === T.EMPTY) drawTile(cg, level, cx * CH - 1, ty, cx * CH * TILE, cy * CH * TILE, k, 0);
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
        if (ch.c) g.drawImage(ch.c, 0, 0, CPX + OVERHANG, CPX + DOWNHANG, cx * CH * TILE, cy * CH * TILE, CH * TILE + OVERHANG / (CELL / TILE), CH * TILE + DOWNHANG / (CELL / TILE));
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
  } else if (ti >= JUNGLE0) {
    drawJungleTexture(g, th, ti, rng, v);
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
    } else if (ti >= JUNGLE0) {
      drawJungleTop(g, th, ti, rng);
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
    if (ti >= JUNGLE0 && ti !== 5 && rng.chance(0.7)) {
      // raízes/musgo pendurados sob a borda
      g.strokeStyle = ti === 6 ? '#5c9a38' : '#4a2e1c';
      g.lineWidth = 1.4;
      g.beginPath();
      const x = rng.range(4, 28);
      g.moveTo(x, TILE - 3);
      g.quadraticCurveTo(x + rng.range(-4, 4), TILE + 3, x + rng.range(-3, 3), TILE - 0.5);
      g.stroke();
    }
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

// ------------------------------------------------------------------ selva (fase 2)
/** Miolo dos blocos da selva: terra com raízes/pedrinhas, tábuas, pedra do templo, lama. */
function drawJungleTexture(g: CanvasRenderingContext2D, th: ThemeDef, ti: number, rng: Rng, v: number) {
  if (ti === 4) {
    // terra: grãos, pedrinhas e raízes finas
    for (let i = 0; i < 18; i++) {
      g.fillStyle = rng.chance(0.5) ? 'rgba(255,220,170,0.07)' : 'rgba(0,0,0,0.13)';
      g.fillRect(rng.range(0, 30), rng.range(0, 30), rng.range(1.5, 5), rng.range(1, 3));
    }
    for (let i = 0; i < 3; i++) {
      const x = rng.range(3, 29);
      const y = rng.range(6, 28);
      g.fillStyle = '#7a6a5a';
      g.beginPath();
      g.ellipse(x, y, rng.range(1.6, 3.2), rng.range(1.2, 2.2), 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(x - 1, y - 1.4, 1.4, 0.8);
    }
    if (v === 1) {
      g.strokeStyle = '#6e4a2c';
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(0, rng.range(8, 20));
      g.bezierCurveTo(10, rng.range(4, 26), 22, rng.range(4, 26), TILE, rng.range(8, 24));
      g.stroke();
    }
  } else if (ti === 5) {
    // madeira: tábuas com veios e pregos
    for (let y = 0; y < TILE; y += 8) {
      g.fillStyle = (y / 8) % 2 ? shade(th.base, 0.06) : shade(th.base, -0.04);
      g.fillRect(0, y, TILE, 8);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(0, y + 7, TILE, 1);
      g.strokeStyle = 'rgba(60,30,10,0.3)';
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(rng.range(0, 8), y + rng.range(2, 6));
      g.lineTo(rng.range(18, 32), y + rng.range(2, 6));
      g.stroke();
      g.fillStyle = '#c8c4b8';
      g.fillRect(2, y + 3, 1.2, 1.2);
      g.fillRect(TILE - 3.4, y + 3, 1.2, 1.2);
    }
  } else if (ti === 6) {
    // pedra do templo: blocos talhados, rachaduras, musgo e um entalhe de vez em quando
    g.strokeStyle = th.detail;
    g.lineWidth = 1.1;
    g.strokeRect(0.6, 0.6, TILE - 1.2, TILE / 2 - 0.6);
    g.beginPath();
    g.moveTo(TILE / 2, TILE / 2);
    g.lineTo(TILE / 2, TILE);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(1.4, 1.4, TILE - 2.8, 2);
    g.fillRect(1.4, TILE / 2 + 1, TILE / 2 - 2.4, 2);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = 'rgba(110,170,70,0.28)';
      g.beginPath();
      g.ellipse(rng.range(0, 32), rng.range(0, 32), rng.range(2, 5), rng.range(1, 2.4), 0, 0, Math.PI * 2);
      g.fill();
    }
    if (v === 1) {
      // lasca quebrada no canto
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.beginPath();
      g.moveTo(TILE, TILE * 0.55);
      g.lineTo(TILE * 0.78, TILE * 0.7);
      g.lineTo(TILE, TILE * 0.85);
      g.closePath();
      g.fill();
    } else {
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(rng.range(4, 12), TILE / 2 + 2);
      g.lineTo(rng.range(6, 14), TILE - 3);
      g.stroke();
    }
  } else {
    // lama: manchas úmidas e bolhinhas
    for (let i = 0; i < 16; i++) {
      g.fillStyle = rng.chance(0.4) ? 'rgba(150,160,80,0.12)' : 'rgba(0,0,0,0.16)';
      g.beginPath();
      g.ellipse(rng.range(0, 32), rng.range(0, 32), rng.range(2, 6), rng.range(1, 3), 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 3; i++) g.fillRect(rng.range(2, 28), rng.range(2, 28), 1.2, 1.2);
  }
}

/** Borda de cima exposta: capim, folhinhas e flores (terra), musgo (pedra), lodo (lama). */
function drawJungleTop(g: CanvasRenderingContext2D, th: ThemeDef, ti: number, rng: Rng) {
  if (ti === 5) {
    g.fillStyle = th.edge;
    g.fillRect(0, 0, TILE, 3);
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fillRect(0, 0, TILE, 1);
    return;
  }
  const grass = ti === 7 ? '#5a6a2a' : '#4f9a32';
  const grassL = ti === 7 ? '#7a8a3a' : '#7cc94a';
  g.fillStyle = grass;
  g.fillRect(0, 0, TILE, 5);
  g.fillStyle = grassL;
  g.fillRect(0, 0, TILE, 2);
  // franja irregular descendo pela terra
  for (let x = 0; x < TILE; x += 2.5) {
    g.fillStyle = rng.chance(0.5) ? grass : shade(grass, -0.15);
    g.fillRect(x, 4, 2, rng.range(1, 5));
  }
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.fillRect(0, 5.5, TILE, 1.4);
}

/** Capim e folhagem crescendo para cima, no tile vazio sobre o chão (base em y = TILE). */
function drawFringe(g: CanvasRenderingContext2D, th: ThemeDef, ti: number, k: number) {
  const rng = new Rng(ti * 31 + k * 7 + 3);
  const swamp = ti === 7;
  const temple = ti === 6;
  const cols = swamp ? ['#5f7a2e', '#7a9a3a', '#4a6424'] : temple ? ['#5c9a38', '#7bbd4c', '#4a8030'] : ['#4f9a32', '#7cc94a', '#3e7f28', '#9ad85c'];
  // tufos de capim
  const n = temple ? 7 : 14;
  for (let i = 0; i < n; i++) {
    const x = rng.range(0, TILE);
    const h = rng.range(3, temple ? 7 : swamp ? 12 : 10);
    const lean = rng.range(-2.5, 2.5);
    g.strokeStyle = rng.pick(cols);
    g.lineWidth = rng.range(1, 1.8);
    g.beginPath();
    g.moveTo(x, TILE + 0.5);
    g.quadraticCurveTo(x + lean * 0.3, TILE - h * 0.6, x + lean, TILE - h);
    g.stroke();
  }
  if (!swamp && !temple) {
    // folhinhas largas e uma flor de vez em quando
    for (let i = 0; i < 2; i++) {
      const x = rng.range(4, 28);
      g.fillStyle = rng.pick(cols);
      g.beginPath();
      g.ellipse(x, TILE - 3, rng.range(3, 5), 1.8, rng.range(-0.6, 0.6), 0, Math.PI * 2);
      g.fill();
    }
    if (k === 1) {
      const x = rng.range(6, 26);
      g.strokeStyle = '#3e7f28';
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(x, TILE);
      g.lineTo(x + 0.6, TILE - 9);
      g.stroke();
      const fc = rng.pick(['#ff5a7a', '#ffd23a', '#ff8ad4', '#ffffff']);
      g.fillStyle = fc;
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.arc(x + 0.6 + Math.cos(i * 1.26) * 1.8, TILE - 9 + Math.sin(i * 1.26) * 1.8, 1.3, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#ffe9a0';
      g.fillRect(x, TILE - 9.6, 1.2, 1.2);
    }
  }
  void th;
}

/** Ponte/plataforma de tábuas com cordas (one-way da selva). */
function drawPlank(g: CanvasRenderingContext2D, th: ThemeDef, k: number) {
  // tábuas
  for (let x = 0; x < TILE; x += 8) {
    const c = (x / 8) % 2 ? shade(th.base, 0.08) : shade(th.base, -0.05);
    g.fillStyle = c;
    g.fillRect(x + 0.4, 3, 7.2, 6);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(x + 0.4, 3, 7.2, 1.2);
    g.strokeStyle = OUT;
    g.lineWidth = 0.8;
    g.strokeRect(x + 0.4, 3, 7.2, 6);
  }
  // corda-guia e amarras
  g.strokeStyle = '#c8a46a';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(0, 10.4);
  g.lineTo(TILE, 10.4);
  g.stroke();
  g.strokeStyle = '#8a6a3a';
  g.lineWidth = 1;
  for (let x = 4; x < TILE; x += 8) {
    g.beginPath();
    g.moveTo(x, 8);
    g.lineTo(x + 1.5, 11.5);
    g.stroke();
  }
  // estacas nas pontas
  if (k !== 1) {
    const x = k === 0 ? 1.5 : TILE - 5.5;
    shadedRR(g, x, 0, 4, 22, 1.2, th.dark, { lw: 0.9 });
  }
}

/** Armadilha dos mercenários: estacas de madeira afiadas. */
function drawStakes(g: CanvasRenderingContext2D, th: ThemeDef, k: number) {
  g.fillStyle = '#3a2418';
  g.fillRect(0, TILE - 6, TILE, 6);
  for (let i = 0; i < 4; i++) {
    const x = i * 8 + 4;
    const tip = 6 + ((i + k) % 2) * 3;
    g.beginPath();
    g.moveTo(x - 3, TILE - 4);
    g.lineTo(x - 0.6, tip);
    g.lineTo(x + 0.6, tip);
    g.lineTo(x + 3, TILE - 4);
    g.closePath();
    g.fillStyle = i % 2 ? '#a8763e' : th.base;
    g.fill();
    g.strokeStyle = OUT;
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = '#e8d6b0';
    g.fillRect(x - 0.8, tip, 1.6, 3);
    // corda amarrando
    g.fillStyle = '#c8a46a';
    g.fillRect(x - 3, TILE - 9, 6, 1.4);
  }
}
