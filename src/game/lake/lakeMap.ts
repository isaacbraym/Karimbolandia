/**
 * Minimapa do lago (simulação pura): grade de células de 2 tiles sobre o lago raso + Atlântida.
 * Revela um círculo ao redor do Karimbo (só quando ele muda de célula), conta % sobre as células
 * com água, descobre marcos e salva tudo num bitset em base64 (≈ 500 caracteres). Sem arte nem DOM.
 */
import { TILE, type Level, type WaterZone } from '../level';
import { ATLANTIS_LANDMARKS, LAKE_TOP } from '../level/atlantis';

export const LAKE_CELL_TILES = 2;
export const LAKE_REVEAL_TILES = 5;
const CELL = LAKE_CELL_TILES * TILE;
const REVEAL_CELLS = LAKE_REVEAL_TILES / LAKE_CELL_TILES;
const B64 = /^[A-Za-z0-9+/]*={0,2}$/;

export interface LandmarkInfo { id: string; name: string }

export class LakeMap {
  readonly x0: number; // origem em células
  readonly y0: number;
  readonly cols: number;
  readonly rows: number;
  /** 1 = célula com água livre */
  readonly water: Uint8Array;
  /** 1 = explorada */
  readonly seen: Uint8Array;
  /** muda quando algo é revelado (o desenho só refaz o que mudou) */
  version = 0;
  /** muda quando o mapa é trocado por inteiro (carregar/zerar): o desenho recompõe tudo */
  epoch = 0;
  private readonly zones: WaterZone[];
  private totalWater = 0;
  private seenWater = 0;
  private lastCell = -1;
  private fresh: number[] = [];
  private lmSeen: Uint8Array;
  private lmPending: LandmarkInfo[] = [];
  private lmCells: Int32Array;

  /** Só existe quando a fase tem o lago principal (fase 2); senão null. */
  static create(level: Level, zones: readonly WaterZone[]): LakeMap | null {
    const main = zones.filter((z) => z.kind === 'lake' && (z.surface ?? z.y) === LAKE_TOP * TILE);
    return main.length ? new LakeMap(level, main) : null;
  }

  constructor(level: Level, zones: readonly WaterZone[]) {
    this.zones = zones.filter((z) => z.kind === 'lake' && (z.surface ?? z.y) === LAKE_TOP * TILE);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const z of this.zones) {
      minX = Math.min(minX, z.x); minY = Math.min(minY, z.surface ?? z.y);
      maxX = Math.max(maxX, z.x + z.w); maxY = Math.max(maxY, z.y + z.h);
    }
    if (!this.zones.length) { minX = minY = maxX = maxY = 0; }
    this.x0 = Math.floor(minX / CELL);
    this.y0 = Math.floor(minY / CELL);
    this.cols = Math.max(1, Math.ceil(maxX / CELL) - this.x0);
    this.rows = Math.max(1, Math.ceil(maxY / CELL) - this.y0);
    this.water = new Uint8Array(this.cols * this.rows);
    this.seen = new Uint8Array(this.cols * this.rows);
    // célula de água = alguma amostra (centro e quartos) dentro de uma zona e fora da pedra
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const px = (this.x0 + cx) * CELL, py = (this.y0 + cy) * CELL;
        let wet = false;
        for (let k = 0; k < 5 && !wet; k++) {
          const sx = px + (k === 0 ? 0.5 : k % 2 ? 0.25 : 0.75) * CELL;
          const sy = py + (k === 0 ? 0.5 : k < 3 ? 0.25 : 0.75) * CELL;
          wet = this.inZones(sx, sy) && !level.solidAtPx(sx, sy);
        }
        if (wet) { this.water[cy * this.cols + cx] = 1; this.totalWater++; }
      }
    }
    this.lmSeen = new Uint8Array(ATLANTIS_LANDMARKS.length);
    this.lmCells = new Int32Array(ATLANTIS_LANDMARKS.length);
    ATLANTIS_LANDMARKS.forEach((m, i) => { this.lmCells[i] = this.cellOf(m.tx * TILE + TILE / 2, m.ty * TILE); });
  }

  private inZones(x: number, y: number) {
    for (const z of this.zones) if (x >= z.x && x < z.x + z.w && y >= (z.surface ?? z.y) && y <= z.y + z.h) return true;
    return false;
  }
  private cellOf(px: number, py: number) {
    const cx = Math.floor(px / CELL) - this.x0, cy = Math.floor(py / CELL) - this.y0;
    return cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows ? -1 : cy * this.cols + cx;
  }

  contains(px: number, py: number) { return this.inZones(px, py); }
  /** A célula do ponto já foi explorada. */
  isSeen(px: number, py: number) { const i = this.cellOf(px, py); return i >= 0 && this.seen[i] === 1; }
  /** A célula do ponto tem água livre (para as telas e os testes). */
  isWater(px: number, py: number) { const i = this.cellOf(px, py); return i >= 0 && this.water[i] === 1; }

  /** Chamado a cada quadro: só trabalha quando o Karimbo muda de célula. Devolve quantas células novas. */
  reveal(px: number, py: number): number {
    const c = this.cellOf(px, py);
    if (c < 0 || c === this.lastCell) return 0;
    this.lastCell = c;
    const cx = c % this.cols, cy = (c / this.cols) | 0;
    const R = Math.ceil(REVEAL_CELLS);
    let added = 0;
    for (let dy = -R; dy <= R; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= this.rows) continue;
      for (let dx = -R; dx <= R; dx++) {
        const x = cx + dx;
        if (x < 0 || x >= this.cols || dx * dx + dy * dy > REVEAL_CELLS * REVEAL_CELLS + 0.01) continue;
        const i = y * this.cols + x;
        if (this.seen[i]) continue;
        this.seen[i] = 1;
        this.fresh.push(i);
        added++;
        if (this.water[i]) this.seenWater++;
      }
    }
    if (added) {
      this.version++;
      for (let k = 0; k < this.lmCells.length; k++) {
        if (this.lmSeen[k] || this.lmCells[k] < 0 || !this.seen[this.lmCells[k]]) continue;
        this.lmSeen[k] = 1;
        this.lmPending.push({ id: ATLANTIS_LANDMARKS[k].id, name: ATLANTIS_LANDMARKS[k].name });
      }
    }
    return added;
  }

  /** Copia (sem alocar) os índices revelados desde a última leitura e os esquece. */
  newlySeen(out: number[]): number {
    out.length = 0;
    for (let i = 0; i < this.fresh.length; i++) out.push(this.fresh[i]);
    const n = this.fresh.length;
    this.fresh.length = 0;
    return n;
  }
  /** Próximo marco recém-descoberto (para o banner `DESCOBERTO!`), ou null. */
  takeLandmark(): LandmarkInfo | null { return this.lmPending.shift() ?? null; }

  /** 0..100: arredondado, mas nunca 0 depois de explorar algo nem 100 antes de explorar tudo */
  percent(): number {
    if (!this.totalWater || !this.seenWater) return 0;
    if (this.seenWater >= this.totalWater) return 100;
    return Math.min(99, Math.max(1, Math.round((100 * this.seenWater) / this.totalWater)));
  }
  landmarkSeen(id: string): boolean {
    const k = ATLANTIS_LANDMARKS.findIndex((m) => m.id === id);
    return k >= 0 && this.lmSeen[k] === 1;
  }
  landmarkCell(k: number) { return this.lmCells[k]; }

  /** Base64 do bitset de células exploradas; undefined se nada foi visto. */
  toSave(): string | undefined {
    if (!this.seen.some((v) => v)) return undefined;
    const bytes = new Uint8Array(Math.ceil(this.seen.length / 8));
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i]) bytes[i >> 3] |= 1 << (i & 7);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  /** Tolerante: texto inválido ou de outro tamanho (mapa mudou de versão) é ignorado sem lançar. */
  load(s: string | undefined) {
    if (!s || s.length > 1024 || !B64.test(s)) return;
    let raw: string;
    try { raw = atob(s); } catch { return; }
    if (raw.length !== Math.ceil(this.seen.length / 8)) return;
    this.reset();
    for (let i = 0; i < this.seen.length; i++) {
      if (!(raw.charCodeAt(i >> 3) & (1 << (i & 7)))) continue;
      this.seen[i] = 1;
      if (this.water[i]) this.seenWater++;
    }
    for (let k = 0; k < this.lmCells.length; k++) if (this.lmCells[k] >= 0 && this.seen[this.lmCells[k]]) this.lmSeen[k] = 1;
    this.fresh.length = 0;
    this.lmPending.length = 0;
    this.version++;
    this.epoch++;
  }

  reset() {
    this.seen.fill(0);
    this.seenWater = 0;
    this.lastCell = -1;
    this.fresh.length = 0;
    this.lmSeen.fill(0);
    this.lmPending.length = 0;
    this.version++;
    this.epoch++;
  }
}
