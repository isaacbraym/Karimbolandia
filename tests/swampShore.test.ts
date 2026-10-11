import { describe, expect, it } from 'vitest';
import { buildJungle } from '../src/game/level/jungle';
import { ForestTrail, scenicGround, scenicWetlandGround } from '../src/art/forestTrail';
import { SWAMP_DEPTH, swampRearDepth, swampRearPoint, swampSurfaceContains } from '../src/art/swampShore';
import { TILE, T, THEME } from '../src/game/level';

describe('Composição das margens do brejo', () => {
  it('há solo dos dois lados de cada margem e em todo leito raso, sem apagar a água física', () => {
    const d = buildJungle(), trail = new ForestTrail(d.level), before = JSON.stringify(d.water);
    for (const z of d.water.filter(z => z.kind === 'swamp')) {
      for (let x = z.x - 16; x <= z.x + z.w + 16; x += 16) expect(trail.hasSoil(x)).toBe(true);
      const col = z.x / TILE;
      expect(scenicGround(d.level, col, d.level.reliefRow)).toBe(false);
      expect(d.level.get(col, d.level.reliefRow)).toBe(T.EMPTY);
      expect(d.level.get(col, d.level.reliefRow + 1)).toBe(T.SOLID);
      expect(scenicWetlandGround(d.level, col, d.level.reliefRow + 1)).toBe(true);
      expect(scenicWetlandGround(d.level, col, d.level.reliefRow + 3)).toBe(true);
      expect(scenicWetlandGround(d.level, col, d.level.reliefRow - 2)).toBe(false);
    }
    const lake = d.water.find(z => z.kind === 'lake' && z.surface === undefined)!;
    expect(trail.hasSoil(lake.x + lake.w / 2)).toBe(false);
    expect(scenicWetlandGround(d.level, lake.x / TILE, d.level.reliefRow + 1)).toBe(false);
    expect(JSON.stringify(d.water)).toBe(before);
  });

  it('a margem se fecha em enseadas nas pontas e não forma uma linha horizontal no fundo', () => {
    const d = buildJungle();
    for (const z of d.water.filter(z => z.kind === 'swamp')) {
      expect(swampRearPoint(z, z.x)).toEqual({ x: z.x, y: z.y });
      expect(swampRearPoint(z, z.x + z.w)).toEqual({ x: z.x + z.w, y: z.y });
      const depths: number[] = [];
      for (let x = z.x + 100; x < z.x + z.w - 100; x += 4) {
        depths.push(swampRearDepth(z, x));
        const p = swampRearPoint(z, x);
        expect(swampSurfaceContains(z, p.x, p.y + 2)).toBe(true);
        expect(swampSurfaceContains(z, p.x, p.y - 2)).toBe(false);
      }
      expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(15);
      expect(Math.max(...depths)).toBeLessThanOrEqual(SWAMP_DEPTH.y);
      expect(swampSurfaceContains(z, z.x - 1, z.y)).toBe(false);
      expect(swampSurfaceContains(z, z.x + z.w + 1, z.y)).toBe(false);
    }
  });

  it('o leito contínuo não esconde plataformas de madeira sobre o pântano', () => {
    const d = buildJungle(); let planks = 0;
    for (const z of d.level.scenicWetlands) for (let col = z.x / TILE; col < (z.x + z.w) / TILE; col++) {
      for (let row = d.level.reliefRow - 6; row < d.level.reliefRow; row++) {
        if (d.level.themeAt(col, row) !== THEME.WOOD || d.level.get(col, row) === T.EMPTY) continue;
        planks++; expect(scenicWetlandGround(d.level, col, row)).toBe(false);
      }
    }
    expect(planks).toBeGreaterThan(10);
  });
});
