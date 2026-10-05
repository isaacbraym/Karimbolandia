import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Orçamento de `drawImage` do lago no pior enquadramento (praça de Atlântida, com o menor zoom que
 * a revelação do Pensador usa: 900 px de mundo na largura). Contexto falso que só conta chamadas.
 */
const fakeFish = () => ({ mips: [{ width: 256, height: 150 }, { width: 128, height: 75 }, { width: 64, height: 38 }], w: 256, h: 150, tailX: 0.79, tailY: 0.45 });
vi.mock('../src/art/jungle', async (orig) => ({
  ...(await orig<typeof import('../src/art/jungle')>()),
  getJungle: () => ({ fish: [fakeFish(), fakeFish()], thinker: {}, piranhas: [], bg: {}, bandits: {}, banditVariants: [] }),
}));

let disk: Map<string, string>;
let draws = 0;
const ctx = (): CanvasRenderingContext2D => new Proxy({ canvas: null } as object, {
  get(target, key) {
    if (key === 'drawImage') return () => { draws++; };
    if (key === 'getTransform') return () => ({ a: 1.6 });
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (key in target) return (target as Record<string | symbol, unknown>)[key];
    return () => {};
  },
  set(target, key, value) { (target as Record<string | symbol, unknown>)[key] = value; return true; },
}) as unknown as CanvasRenderingContext2D;

beforeEach(() => {
  disk = new Map();
  draws = 0;
  vi.stubGlobal('localStorage', { get length() { return disk.size; }, key: (i: number) => [...disk.keys()][i] ?? null, getItem: (k: string) => disk.get(k) ?? null, setItem: (k: string, v: string) => disk.set(k, v) });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

describe('custo de desenho do lago', () => {
  it('a praça de Atlântida com o menor zoom da revelação cabe no orçamento de drawImage', async () => {
    const { World } = await import('../src/game/world');
    const { buildJungle } = await import('../src/game/level/jungle');
    const w = new World(buildJungle());
    vi.stubGlobal('document', { createElement: () => ({ width: 1, height: 1, getContext: ctx }) });
    const { prepareLakeLife } = await import('../src/art/lake/lakeLife');
    prepareLakeLife();
    const { drawWaterBack, drawWaterFront } = await import('../src/art/waterDraw');
    // todos os cardumes e o Karimbo na praça: pior caso de peixes visíveis
    const cx = 518 * 32, cy = 96 * 32;
    w.camera.zoom = 640 / 900;
    w.camera.x = cx - w.camera.w / 2;
    w.camera.y = cy - w.camera.h * 0.58;
    const sc = w.water.schools.filter((s) => w.water.fish[s.lead].zone.surface !== undefined);
    sc.forEach((s, i) => { for (let m = 0; m <= s.n; m++) { const f = w.water.fish[s.lead + m]; f.x = cx + (i - 3) * 60 + (m % 6) * 10; f.y = cy - 80 + (m % 5) * 14; } });
    const g = ctx();
    drawWaterBack(g, w);
    drawWaterFront(g, w);
    const visible = w.water.fish.filter((f) => w.camera.visible(f.x, f.y, f.size)).length;
    expect(visible).toBeGreaterThan(150); // o enquadramento realmente estressa
    // Orçamento (T2): medido 314 drawImage com 236 peixes visíveis (≈ 1 por peixe + 78 de neve, halos,
    // superfície, bolhas e areia). Teto 360; só aumentar com justificativa e nova medição.
    expect(draws).toBeLessThanOrEqual(360);
    expect(draws - visible).toBeLessThanOrEqual(110); // além dos peixes: neve, halos, superfície, bolhas e areia
  });
});
