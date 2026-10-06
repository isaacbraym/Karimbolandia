import type { LevelBuilder } from './builder';
import { TILE, T, THEME } from '../level';

/** Quarteirões autorados: intervalos abertos revelam a cidade distante. Tudo é cenário. */
export const CITY_BLOCKS = [
  { x: -80, w: 170, h: 210 }, { x: 400, w: 150, h: 175 },
  { x: 1230, w: 180, h: 235 }, { x: 1920, w: 160, h: 192 },
  { x: 2710, w: 200, h: 225 }, { x: 3420, w: 145, h: 172 },
  { x: 4200, w: 190, h: 228 }, { x: 5040, w: 170, h: 185 }, { x: 5740, w: 170, h: 205 },
] as const;
export const CITY_GARDENS = [250, 870, 1510, 2210, 3160, 3870, 4650, 5500] as const;

export function dressCitySample(b: LevelBuilder) {
  const end = b.level.scenicStreet!.x1;
  // As fachadas antigas não se empilham sobre os novos quarteirões.
  b.decos = b.decos.filter(d => d.x >= end || d.kind !== 'facade');
  for (const d of b.decos) if (d.x < end && (d.kind === 'pcPole' || d.kind === 'pcDebris')) d.scale = (d.scale ?? 1) * .65;
  for (const x of CITY_GARDENS) {
    const supported = (wx: number) => {
      const col = Math.floor(wx / TILE), row = b.level.reliefRow;
      return b.level.get(col, row) === T.SOLID && b.level.get(col, row - 1) !== T.SOLID
        && b.level.themeAt(col, row) <= THEME.STEEL;
    };
    if (!supported(x - 58) || !supported(x + 59)) continue;
    b.decos.push({ kind: 'streetTree', x, y: 32 * TILE - 32, layer: 'back', scale: .95 });
    b.decos.push({ kind: 'plant', x: x + 40, y: 32 * TILE - 24, layer: 'back', scale: .6 });
    if (supported(x + 85) && supported(x + 145)) b.decos.push({ kind: 'bench', x: x + 115, y: 32 * TILE - 25, layer: 'back', scale: 1.1 });
  }
}
