import { describe, expect, it } from 'vitest';
import { ForestLight } from '../src/game/forestLight';
import { buildJungle } from '../src/game/level/jungle';
import { TILE } from '../src/game/level';

const jungle = buildJungle();
describe('Iluminacao pela cobertura da floresta', () => {
  it('mantem clareiras e trechos densos na floresta real, com feixes espacados', () => {
    const light = new ForestLight(jungle);
    expect(Math.min(...light.patches.map(p => p.shade))).toBeLessThan(.1);
    expect(Math.max(...light.patches.map(p => p.shade))).toBeGreaterThan(.8);
    expect(light.rays.length).toBeGreaterThan(0);
    light.rays.forEach((ray, i) => {
      expect(ray.shade).toBeLessThan(.45);
      if (i) expect(ray.x - light.rays[i - 1].x).toBeGreaterThanOrEqual(640);
    });
  });
  it('nao aplica mata a fase urbana nem conta vegetacao frontal como copa', () => {
    expect(new ForestLight({ ...jungle, stage: 1 }).patches).toEqual([]);
    const light = new ForestLight({ ...jungle, decos: [
      { kind: 'jTree', x: 150 * TILE, y: 1000, layer: 'front' },
      { kind: 'jTree', x: 150 * TILE, y: 1000, layer: 'back', par: .5 },
    ] });
    expect(light.patches.every(p => p.shade === 0)).toBe(true);
  });
  it('interpola sombra sem degraus e respeita o tamanho das copas', () => {
    const light = new ForestLight({ ...jungle, decos: [
      { kind: 'jTree', x: 150 * TILE, y: 1000, layer: 'back', scale: 1 },
    ] });
    expect(light.shadeAt(150 * TILE)).toBeCloseTo(.95);
    expect(light.shadeAt(150 * TILE + 64)).toBeCloseTo((light.patches[0].shade + light.patches[1].shade) / 2);
    expect(light.shadeAt(150 * TILE + 256)).toBe(0);
    expect(Math.abs(light.shadeAt(150 * TILE + 128 - .01) - light.shadeAt(150 * TILE + 128 + .01))).toBeLessThan(.001);
  });
});
