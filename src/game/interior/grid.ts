/** Grade do cômodo: terreno, ocupação por móveis, linha de visada e caminho (A* em 8 direções). */
export interface Cell { x: number; y: number }

export interface Footprint { gx: number; gy: number; w: number; h: number; solid?: boolean; tall?: boolean }

const WALL = 1, SQUEAK = 2;

export class Grid {
  readonly w: number;
  readonly h: number;
  private terrain: Uint8Array;
  private block: Uint8Array;
  private tall: Uint8Array;

  /** `rows`: um string por linha (y); '.' piso, 's' tábua rangente, '#' parede/vazio. */
  constructor(rows: readonly string[], furniture: readonly Footprint[] = []) {
    this.h = rows.length;
    this.w = Math.max(...rows.map((r) => r.length));
    this.terrain = new Uint8Array(this.w * this.h);
    this.block = new Uint8Array(this.w * this.h);
    this.tall = new Uint8Array(this.w * this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = rows[y][x] ?? '#';
        this.terrain[y * this.w + x] = c === '#' || c === ' ' ? WALL : c === 's' ? SQUEAK : 0;
      }
    }
    for (const f of furniture) this.place(f);
  }

  place(f: Footprint) {
    for (let y = f.gy; y < f.gy + f.h; y++) {
      for (let x = f.gx; x < f.gx + f.w; x++) {
        if (!this.inBounds(x, y)) continue;
        if (f.solid !== false) this.block[y * this.w + x] = 1;
        if (f.tall) this.tall[y * this.w + x] = 1;
      }
    }
  }

  inBounds(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  isWall(x: number, y: number) { return !this.inBounds(x, y) || (this.terrain[y * this.w + x] & WALL) !== 0; }
  isSolid(x: number, y: number) { return this.isWall(x, y) || this.block[y * this.w + x] === 1; }
  walkable(x: number, y: number) { return !this.isSolid(x, y); }
  squeaky(x: number, y: number) { return this.inBounds(x, y) && (this.terrain[y * this.w + x] & SQUEAK) !== 0; }
  /** Parede ou móvel alto bloqueia a visão. Com `furniture=false` só as paredes (ruído). */
  blocksSight(x: number, y: number, furniture = true) {
    return this.isWall(x, y) || (furniture && this.tall[y * this.w + x] === 1);
  }
}

export const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** Linha de visada (Bresenham). A origem e o destino nunca bloqueiam; só o que fica entre eles. */
export function hasLine(g: Grid, x0: number, y0: number, x1: number, y1: number, furniture = true): boolean {
  let x = x0, y = y0;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (x !== x1 || y !== y1) {
    const e2 = err * 2;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if ((x !== x1 || y !== y1) && g.blocksSight(x, y, furniture)) return false;
  }
  return true;
}

const DIRS: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];

/**
 * Caminho mais curto de `from` até o primeiro de `goals`, em 8 direções sem cortar quina.
 * Devolve as células a percorrer (sem a de partida); `[]` se já está num objetivo; `null` se inalcançável.
 * A grade é minúscula (≤ ~100 células), então Dijkstra por varredura é mais simples que heap e igualmente rápido.
 */
export function findPath(g: Grid, from: Cell, goals: readonly Cell[], extraBlock?: (x: number, y: number) => boolean): Cell[] | null {
  const goalSet = new Set(goals.map((c) => c.y * g.w + c.x));
  const start = from.y * g.w + from.x;
  if (goalSet.has(start)) return [];
  const n = g.w * g.h;
  const dist = new Float32Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  dist[start] = 0;
  const open = (x: number, y: number) => g.walkable(x, y) && !(extraBlock && extraBlock(x, y));
  for (let iter = 0; iter < n; iter++) {
    let cur = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; cur = i; }
    if (cur < 0) return null;
    if (goalSet.has(cur)) {
      const out: Cell[] = [];
      for (let i = cur; i !== start; i = prev[i]) out.push({ x: i % g.w, y: Math.floor(i / g.w) });
      return out.reverse();
    }
    done[cur] = 1;
    const cx = cur % g.w, cy = Math.floor(cur / g.w);
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!open(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!open(cx + dx, cy) || !open(cx, cy + dy))) continue;
      const ni = ny * g.w + nx, nd = dist[cur] + (dx !== 0 && dy !== 0 ? 1.4142 : 1);
      if (nd < dist[ni]) { dist[ni] = nd; prev[ni] = cur; }
    }
  }
  return null;
}

/** Células livres vizinhas (8 direções) à pegada, preferindo as ortogonais. */
export function adjacentCells(g: Grid, f: Footprint): Cell[] {
  const out: Cell[] = [];
  for (let y = f.gy - 1; y <= f.gy + f.h; y++) {
    for (let x = f.gx - 1; x <= f.gx + f.w; x++) {
      const inside = x >= f.gx && x < f.gx + f.w && y >= f.gy && y < f.gy + f.h;
      if (!inside && g.walkable(x, y)) out.push({ x, y });
    }
  }
  const corner = (c: Cell) => (c.x < f.gx || c.x >= f.gx + f.w) && (c.y < f.gy || c.y >= f.gy + f.h) ? 1 : 0;
  return out.sort((a, b) => corner(a) - corner(b));
}
