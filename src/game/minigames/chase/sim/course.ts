/**
 * O percurso autorado da perseguição pela copa (sem sorteio por tentativa): uma lista fixa de
 * segmentos vira um `Level` próprio (galhos = plataformas de mão única) mais os dados do que mexe:
 * galhos que tremem, bromélias-mola, cipós, bichos-obstáculo e as "dicas de linha de corrida" que os
 * bots dos testes seguem. Simulação pura (sem arte): tudo em px de mundo, tile = 32.
 */
import { Level, T, TILE, THEME } from '../../../level';

export type HintAct = 'jump' | 'hold' | 'glide' | 'slide' | 'release';
/** `x` em px: quando o Karimbo passa daqui o bot perfeito faz `act` (hold = segurar o pulo por `dur` s) */
export interface Hint { x: number; act: HintAct; dur?: number }

export type HazardKind = 'sloth' | 'coati' | 'toucan' | 'snake' | 'hive';
export interface HazardDef { kind: HazardKind; x: number; y: number }
export interface SpringDef { x: number; y: number; w: number }
export interface VineDef { ax: number; ay: number; len: number }
export interface ShakyDef { x0: number; x1: number; row: number }
/** local de pouso perfeito (PERFEITO! = +15% de velocidade por 1,5 s) */
export interface PerfectSpot { x: number; y: number; w: number }
/** o macaco joga algo para trás quando passa por aqui */
export interface ThrowDef { x: number; kind: 'banana' | 'coconut' }

export interface Course {
  level: Level;
  /** largura útil (px) e fim do percurso (clareira) */
  length: number;
  endX: number;
  /** altura abaixo da qual se "cai da copa" (px) */
  floorY: number;
  spawn: { x: number; y: number };
  hints: Hint[];
  hazards: HazardDef[];
  springs: SpringDef[];
  vines: VineDef[];
  shaky: ShakyDef[];
  perfect: PerfectSpot[];
  throws: ThrowDef[];
  /** altura do galho principal em x (a linha do macaco): px do topo do galho */
  pathY: (x: number) => number;
  /** metros de pedaços de galho (decoração): [x0,x1,row] */
  branches: [number, number, number][];
}

const BASE_ROW = 20;
const H_TILES = 36;

type Seg =
  | { t: 'firm'; n: number }
  | { t: 'gap'; g: number; dRow?: number }
  | { t: 'shaky'; n: number }
  | { t: 'spring'; g: number; up: number }
  | { t: 'sloth'; n: number }
  | { t: 'coati'; n: number }
  | { t: 'toucan'; n: number }
  | { t: 'snake'; n: number }
  | { t: 'hive'; n: number }
  | { t: 'vine'; g: number }
  | { t: 'throw'; n: number; kind: 'banana' | 'coconut' };

/** O percurso: ≈ 410 tiles + a clareira final (≈ 13 000 px: um jogador perfeito leva ~52 s). Cada linha é um trecho da copa. */
export const SEGMENTS: readonly Seg[] = [
  { t: 'firm', n: 18 }, { t: 'gap', g: 3 }, { t: 'firm', n: 10 }, { t: 'gap', g: 4 }, { t: 'firm', n: 8 },
  { t: 'sloth', n: 14 }, { t: 'gap', g: 4, dRow: -1 }, { t: 'firm', n: 10 }, { t: 'throw', n: 12, kind: 'banana' },
  { t: 'gap', g: 4 }, { t: 'shaky', n: 9 }, { t: 'firm', n: 6 }, { t: 'coati', n: 22 }, { t: 'gap', g: 3 },
  { t: 'firm', n: 8 }, { t: 'gap', g: 5, dRow: 1 }, { t: 'firm', n: 10 }, { t: 'toucan', n: 16 },
  { t: 'spring', g: 5, up: 3 }, { t: 'firm', n: 8 }, { t: 'gap', g: 4 }, { t: 'shaky', n: 10 }, { t: 'firm', n: 6 },
  { t: 'vine', g: 11 }, { t: 'firm', n: 10 }, { t: 'throw', n: 14, kind: 'coconut' }, { t: 'gap', g: 4 }, { t: 'firm', n: 8 },
  { t: 'snake', n: 16 }, { t: 'gap', g: 4, dRow: -1 }, { t: 'firm', n: 10 }, { t: 'hive', n: 18 }, { t: 'gap', g: 5 },
  { t: 'firm', n: 8 }, { t: 'sloth', n: 14 }, { t: 'gap', g: 4 }, { t: 'shaky', n: 10 }, { t: 'gap', g: 3 }, { t: 'firm', n: 8 },
  { t: 'coati', n: 22 }, { t: 'gap', g: 4, dRow: 1 }, { t: 'firm', n: 8 }, { t: 'vine', g: 12 }, { t: 'firm', n: 10 },
];

export function buildCourse(): Course {
  const segs = SEGMENTS;
  // largura = soma dos tiles + folga
  let total = 8;
  for (const s of segs) total += 'n' in s ? s.n : s.g;
  const W = total + 40;
  const level = new Level(W, H_TILES);
  level.reliefRow = H_TILES + 8; // sem relevo suave: tudo é galho
  const hints: Hint[] = [];
  const hazards: HazardDef[] = [];
  const springs: SpringDef[] = [];
  const vines: VineDef[] = [];
  const shaky: ShakyDef[] = [];
  const perfect: PerfectSpot[] = [];
  const throws: ThrowDef[] = [];
  const branches: [number, number, number][] = [];
  const rowAt: { x0: number; x1: number; row: number }[] = [];
  let x = 6;
  let row = BASE_ROW;
  const lay = (x0: number, n: number, r: number, theme: number = THEME.WOOD) => {
    for (let i = 0; i < n; i++) level.set(x0 + i, r, T.ONEWAY, theme);
    branches.push([x0, x0 + n, r]);
    rowAt.push({ x0, x1: x0 + n, row: r });
  };
  // ponto de partida
  const spawn = { x: 8 * TILE, y: BASE_ROW * TILE };
  const px = (tx: number) => tx * TILE;
  for (const s of segs) {
    switch (s.t) {
      case 'firm': lay(x, s.n, row); x += s.n; break;
      case 'gap': {
        // pular uns 1,3 tile antes da borda: com o pulo longo cai 1-2 tiles depois do outro lado
        hints.push({ x: px(x) - 44, act: 'hold', dur: 0.55 });
        if (s.g >= 5) hints.push({ x: px(x) + 24, act: 'glide', dur: 1 }); // vão largo: planar com as orelhas
        x += s.g; row += s.dRow ?? 0;
        perfect.push({ x: px(x), y: row * TILE, w: 40 });
        break;
      }
      case 'shaky': shaky.push({ x0: x, x1: x + s.n, row }); lay(x, s.n, row, THEME.MUD); x += s.n; break;
      case 'spring': {
        // bromélia-mola no fim do galho anterior: quica alto até o galho de cima
        springs.push({ x: px(x) - 28, y: row * TILE, w: 56 });
        x += s.g; row -= s.up;
        break;
      }
      case 'sloth': {
        lay(x, s.n, row);
        hazards.push({ kind: 'sloth', x: px(x + 7), y: row * TILE });
        hints.push({ x: px(x + 7) - 105, act: 'hold', dur: 0.5 }); // pula por cima (ou cai na barriga e quica)
        x += s.n; break;
      }
      case 'coati': {
        lay(x, s.n, row);
        hazards.push({ kind: 'coati', x: px(x + s.n - 3), y: row * TILE });
        // o bando que vem correndo é reativo: o bot do teste pula quando ele chega perto
        x += s.n; break;
      }
      case 'toucan': {
        lay(x, s.n, row);
        hazards.push({ kind: 'toucan', x: px(x + 9), y: row * TILE });
        // o tucano vem voando contra o Karimbo: reativo (desliza por baixo)
        x += s.n; break;
      }
      case 'snake': {
        lay(x, s.n, row);
        hazards.push({ kind: 'snake', x: px(x + 8), y: row * TILE });
        hints.push({ x: px(x + 8) - 62, act: 'slide' });
        x += s.n; break;
      }
      case 'hive': {
        lay(x, s.n, row);
        hazards.push({ kind: 'hive', x: px(x + 7), y: row * TILE });
        hints.push({ x: px(x + 7) - 62, act: 'slide' });
        x += s.n; break;
      }
      case 'vine': {
        // vão largo com um cipó no meio: pula, agarra, balança e solta para o outro lado
        vines.push({ ax: px(x + s.g / 2), ay: (row - 9) * TILE, len: 8.4 * TILE });
        hints.push({ x: px(x) - 24, act: 'hold', dur: 0.45 }, { x: px(x + s.g) - 60, act: 'release' });
        x += s.g;
        perfect.push({ x: px(x), y: row * TILE, w: 40 });
        break;
      }
      case 'throw': {
        lay(x, s.n, row);
        throws.push({ x: px(x + 2), kind: s.kind });
        if (s.kind === 'banana') hints.push({ x: px(x + 7) - 100, act: 'hold', dur: 0.5 }); // pula a casca (o coco rola e é reativo)
        x += s.n; break;
      }
    }
  }
  const lastRow = row;
  // clareira final (chão largo onde a briga de desenho animado acontece)
  lay(x, 30, lastRow, THEME.EARTH);
  const endX = px(x + 12);
  const pathY = (wx: number) => {
    const tx = Math.floor(wx / TILE);
    for (const r of rowAt) if (tx >= r.x0 && tx < r.x1) return r.row * TILE;
    // no vão: o macaco salta; mantém a altura do galho anterior
    let best = BASE_ROW * TILE;
    for (const r of rowAt) if (r.x1 <= tx) best = r.row * TILE;
    return best;
  };
  return { level, length: px(W), endX, floorY: (BASE_ROW + 12) * TILE, spawn, hints, hazards, springs, vines, shaky, perfect, throws, pathY, branches };
}
