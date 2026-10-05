import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Level, T, TILE } from '../src/game/level';
import type { WaterZone } from '../src/game/level';
import { Waters, fishPass, fishScale, FISH_BACK_SCALE, type Fish } from '../src/game/water';

let disk: Map<string, string>;
beforeEach(() => {
  disk = new Map();
  vi.stubGlobal('localStorage', { get length() { return disk.size; }, key: (i: number) => [...disk.keys()][i] ?? null, getItem: (k: string) => disk.get(k) ?? null, setItem: (k: string, v: string) => disk.set(k, v) });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

function pond() {
  const L = new Level(40, 20);
  for (let y = 4; y < 16; y++) L.set(20, y, T.SOLID, 0); // parede no meio do lago
  const zone: WaterZone = { id: 0, kind: 'lake', x: 2 * TILE, y: 3 * TILE, w: 36 * TILE, h: 14 * TILE };
  const w = new Waters([zone], L, []);
  w.fish.length = 0;
  return { L, zone, w };
}
const fishAt = (zone: WaterZone, x: number, y: number, layer: 0 | 1 | 2, tx: number): Fish => ({
  kind: 0, x, y, vx: 0, vy: 0, size: 60, dir: 1, turn: 1, ph: 0, speed: 46, tx, ty: y, layer, lead: -1,
  offX: 0, offY: 0, wait: 0, scared: 0, zone, depth: 0, depthGoal: 0, clearT: 0, rockT: 0,
  species: 'photo', hug: 0, cool: 0, fx: 0, fy: 0, chaseT: 0, chase: -1, lane: 0, seg: null, rockNear: false,
});

describe('peixes do lago passam por trás das paredes', () => {
  for (const layer of [0, 1, 2] as const) it(`camada ${layer}: atravessa, encolhe dentro da pedra e volta`, () => {
    const { L, zone, w } = pond();
    const f = fishAt(zone, 10 * TILE, 9 * TILE, layer, 32 * TILE);
    w.fish.push(f);
    let inRock = 0, minScale = 1;
    for (let i = 0; i < 60 * 30 && f.x < 30 * TILE; i++) {
      f.tx = 32 * TILE; f.ty = 9 * TILE; f.wait = 0; // mantém o alvo do outro lado
      w.update(1 / 60, -9999, -9999, false, 0, 40 * TILE);
      if (L.solidAtPx(f.x, f.y)) {
        inRock++;
        expect(f.depth).toBeGreaterThanOrEqual(0.5);
        expect(fishPass(f)).toBe(layer === 0 ? 0 : 1); // nunca na frente da pedra
      }
      minScale = Math.min(minScale, fishScale(f));
    }
    expect(f.x).toBeGreaterThan(30 * TILE); // passou: não ficou travado
    expect(inRock).toBeGreaterThan(0);
    expect(minScale).toBeCloseTo(FISH_BACK_SCALE, 2);
    for (let i = 0; i < 90; i++) w.update(1 / 60, -9999, -9999, false, 0, 40 * TILE);
    expect(f.depth).toBeLessThan(0.05); // voltou ao tamanho normal
  });

  it('a borda da zona continua sendo limite', () => {
    const { zone, w } = pond();
    const f = fishAt(zone, 4 * TILE, 9 * TILE, 1, -50 * TILE);
    w.fish.push(f);
    for (let i = 0; i < 600; i++) { f.tx = -50 * TILE; w.update(1 / 60, -9999, -9999, false, 0, 40 * TILE); }
    expect(f.x).toBeGreaterThanOrEqual(zone.x);
  });

  it('seguidor mergulha junto com o líder (cardume atravessa em bloco)', () => {
    const { L, zone, w } = pond();
    const lead = fishAt(zone, 12 * TILE, 9 * TILE, 1, 32 * TILE);
    const fol = fishAt(zone, 11 * TILE, 9 * TILE, 1, 32 * TILE);
    fol.lead = 0; fol.offX = -20; fol.size = 30;
    w.fish.push(lead, fol);
    let seen = false;
    for (let i = 0; i < 60 * 30 && lead.x < 28 * TILE; i++) {
      lead.tx = 32 * TILE; lead.ty = 9 * TILE; lead.wait = 0;
      w.update(1 / 60, -9999, -9999, false, 0, 40 * TILE);
      if (L.solidAtPx(fol.x, fol.y)) { seen = true; expect(fol.depth).toBeGreaterThanOrEqual(0.5); }
    }
    expect(lead.x).toBeGreaterThan(24 * TILE);
    expect(seen).toBe(true);
  });

  it('no lago real nenhum peixe fica parado contra pedra', async () => {
    const { buildJungle } = await import('../src/game/level/jungle');
    const { World } = await import('../src/game/world');
    const world = new World(buildJungle());
    const water = world.water;
    let stuck = 0, samples = 0;
    for (let i = 0; i < 60 * 30; i++) {
      water.update(1 / 60, -9999, -9999, false, 0, 1e9);
      for (const f of water.fish) {
        if (f.wait > 0 || f.scared > 0) continue;
        samples++;
        if (Math.hypot(f.vx, f.vy) < 2 && world.level.solidAtPx(f.x + Math.sign(f.tx - f.x) * f.size * 0.4, f.y)) stuck++;
      }
    }
    expect(samples).toBeGreaterThan(1000);
    expect(stuck / samples).toBeLessThan(0.002);
  });
});
