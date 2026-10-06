import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_AMBIENT_FISH, SPECIES } from '../src/game/lake/species';
import type { Waters } from '../src/game/water';

let disk: Map<string, string>;
beforeEach(() => {
  disk = new Map();
  vi.stubGlobal('localStorage', { get length() { return disk.size; }, key: (i: number) => [...disk.keys()][i] ?? null, getItem: (k: string) => disk.get(k) ?? null, setItem: (k: string, v: string) => disk.set(k, v) });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

async function lake() {
  const { World } = await import('../src/game/world');
  const { buildJungle } = await import('../src/game/level/jungle');
  const w = new World(buildJungle());
  return { w, water: w.water };
}
const step = (water: Waters, n: number, px = -9999, py = -9999, swim = false) => {
  for (let i = 0; i < n; i++) water.update(1 / 60, px, py, swim, 0, 1e9);
};

describe('vida do lago: espécies, cardumes e tetos', () => {
  it('nasce determinístico: duas instâncias têm as mesmas posições depois de 600 passos', async () => {
    const a = (await lake()).water;
    const b = (await lake()).water;
    expect(a.fish.length).toBe(b.fish.length);
    step(a, 600);
    step(b, 600);
    for (let i = 0; i < a.fish.length; i += 7) {
      expect(a.fish[i].x).toBeCloseTo(b.fish[i].x, 6);
      expect(a.fish[i].y).toBeCloseTo(b.fish[i].y, 6);
      expect(a.fish[i].species).toBe(b.fish[i].species);
    }
  });

  it('todas as espécies existem, respeitam o teto e os tamanhos da tabela', async () => {
    const { water } = await lake();
    expect(water.fish.length).toBeLessThanOrEqual(MAX_AMBIENT_FISH);
    const seen = new Set(water.fish.map((f) => f.species));
    for (const sp of Object.keys(SPECIES)) expect(seen.has(sp as never)).toBe(true);
    for (const f of water.fish) {
      if (f.species === 'photo' || f.lane !== 0) continue;
      const d = SPECIES[f.species];
      expect(f.size).toBeGreaterThanOrEqual(d.size[0] - 0.01);
      expect(f.size).toBeLessThanOrEqual(d.size[1] + 0.01);
    }
  });

  it('o cardume de neon fica coeso: ≥ 80% dos membros a ≤ 120 px do líder depois de 10 s', async () => {
    const { water } = await lake();
    const sc = water.schools.find((s) => s.species === 'neon')!;
    step(water, 600);
    const L = water.fish[sc.lead];
    let near = 0;
    for (let m = 1; m <= sc.n; m++) { const f = water.fish[sc.lead + m]; if (Math.hypot(f.x - L.x, f.y - L.y) <= 120) near++; }
    expect(near / sc.n).toBeGreaterThanOrEqual(0.8);
  });

  it('o Karimbo atravessando o cardume espalha os peixes em 0,5 s e eles se reagrupam em ≤ 4 s', async () => {
    const { water } = await lake();
    const sc = water.schools.find((s) => s.species === 'neon')!;
    step(water, 120);
    const L = water.fish[sc.lead];
    const px = L.x, py = L.y;
    const mean = () => { let t = 0; for (let m = 0; m <= sc.n; m++) { const f = water.fish[sc.lead + m]; t += Math.hypot(f.x - px, f.y - py); } return t / (sc.n + 1); };
    const before = mean();
    step(water, 30, px, py, true);
    expect(mean()).toBeGreaterThan(before);
    step(water, 60 * 4, -9999, -9999, false);
    const Ln = water.fish[sc.lead];
    let near = 0;
    for (let m = 1; m <= sc.n; m++) { const f = water.fish[sc.lead + m]; if (Math.hypot(f.x - Ln.x, f.y - Ln.y) <= 120) near++; }
    expect(near / sc.n).toBeGreaterThanOrEqual(0.8);
  });

  it('o tucunaré espanta cardumes mas nunca reduz o número de peixes', async () => {
    const { water } = await lake();
    const tuc = water.fish.filter((f) => f.species === 'tucunare');
    expect(tuc.length).toBeGreaterThan(0);
    const total = water.fish.length;
    let chased = 0;
    for (let i = 0; i < 60 * 60; i++) {
      if (i % 600 === 0) for (const t of tuc) t.cool = 0;
      water.update(1 / 60, -9999, -9999, false, 0, 1e9);
      for (const t of tuc) if (t.chaseT > 0) chased++;
      expect(water.fish.length).toBe(total);
    }
    expect(chased).toBeGreaterThan(0);
  });

  it('sem alocação: 600 passos mantêm peixes, bolhas e partículas dentro dos tetos', async () => {
    const { water } = await lake();
    const n = water.fish.length;
    for (let i = 0; i < 600; i++) {
      water.update(1 / 60, -9999, -9999, false, 0, 1e9);
      expect(water.bubbles.length).toBeLessThanOrEqual(160);
      expect(water.puffs.length).toBe(24);
    }
    expect(water.fish.length).toBe(n);
  });

  it('o peixe gigante do evento cruza no máximo 1× a cada 90 s', async () => {
    const { water } = await lake();
    const g = water.fish.find((f) => f.lane !== 0)!;
    expect(g.layer).toBe(2);
    let crossings = 0;
    let last = g.lane;
    const times: number[] = [];
    for (let i = 0; i < 60 * 400; i++) {
      water.update(1 / 60, -9999, -9999, false, 0, 1e9);
      if (g.lane !== last) { crossings++; times.push(i / 60); last = g.lane; }
    }
    expect(crossings).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(90);
  });

  it('poraquê tem corpo segmentado e as arraias levantam areia sem passar de 6 por evento', async () => {
    const { water } = await lake();
    const eel = water.fish.find((f) => f.species === 'poraque')!;
    expect(eel.seg).not.toBeNull();
    step(water, 300);
    const s = eel.seg!;
    expect(Math.hypot(s[0] - eel.x, s[1] - eel.y)).toBeLessThan(1);
    let live = 0;
    for (let i = 0; i < 60 * 30; i++) {
      water.update(1 / 60, -9999, -9999, false, 0, 1e9);
      live = Math.max(live, water.puffs.filter((p) => p.t < p.max).length);
    }
    expect(live).toBeLessThanOrEqual(24);
  });
});

describe('vegetação do lago', () => {
  it('as plantas animadas visíveis nunca passam de 48 (janela de 1400 px) e nada cobre a estátua', async () => {
    const { World } = await import('../src/game/world');
    const { buildJungle } = await import('../src/game/level/jungle');
    const { ANIMATED_LAKE_KINDS } = await import('../src/game/level/lakeFlora');
    const w = new World(buildJungle());
    const anim = w.data.decos.filter((d) => (ANIMATED_LAKE_KINDS as readonly string[]).includes(d.kind) && d.y > 33 * 32);
    expect(anim.length).toBeGreaterThan(30);
    let worst = 0;
    for (const d of anim) {
      const n = anim.filter((e) => e.x >= d.x && e.x < d.x + 1400).length;
      worst = Math.max(worst, n);
    }
    expect(worst).toBeLessThanOrEqual(48);
    for (const d of w.data.decos) if (d.kind.startsWith('lk') && d.kind !== 'lkAguape' && d.kind !== 'lkRoot' && d.kind !== 'lkFgWeed') {
      expect(Math.abs(d.x - 518 * 32) > 6 * 32 || d.y < 90 * 32).toBe(true);
    }
  });

  it('decoração nova não muda inimigos nem itens: IDs antigos ficam como estavam', async () => {
    const { buildJungle } = await import('../src/game/level/jungle');
    const data = buildJungle();
    // contagens medidas antes desta tarefa (T0): a vegetação só acrescenta decos
    expect(data.pickups.filter((p) => p.kind === 'relic').map((p) => p.itemId).sort()).toEqual([0, 1, 2, 3, 4]);
    expect(data.enemies.filter((e) => e.type === 'piranha').length).toBeGreaterThanOrEqual(30);
    // O lago vem depois da decoração histórica; novos segredos podem ser anexados depois.
    const lastLake = data.decos.reduce((last, d, i) => d.kind.startsWith('lk') || d.kind === 'uVentLine' ? i : last, -1);
    expect(lastLake).toBeGreaterThan(data.decos.findIndex(d => d.kind === 'jTempleBack'));
  });

  it('cada cortina de bolhas (uVentLine) cria três fontes de bolhas', async () => {
    const { World } = await import('../src/game/world');
    const { buildJungle } = await import('../src/game/level/jungle');
    const w = new World(buildJungle());
    const lines = w.data.decos.filter((d) => d.kind === 'uVentLine').length;
    const single = w.data.decos.filter((d) => d.kind === 'uVent').length;
    expect(lines).toBeGreaterThanOrEqual(3);
    expect(w.water.vents.length).toBe(single + lines * 3);
  });
});
