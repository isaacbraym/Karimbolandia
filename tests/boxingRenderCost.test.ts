import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Orçamento de desenho do boxe: ≤ 250 `drawImage` por quadro em todas as cenas (contexto falso que só conta). */
const spr = () => ({ c: { width: 100, height: 100 }, w: 40, h: 40, ox: 20, oy: 20, s: 2 });
// a mesma arte a cada chamada (como no jogo): os sprites têm cache próprio por identidade
const artOnce = { karimbo: { heads: { earNear: spr(), earFar: spr(), portrait: spr(), right: spr() }, variants: { jacare: { hood: spr() } } } };
vi.mock('../src/art/index', () => ({ getArt: () => artOnce }));
vi.mock('../src/art/village', () => ({ drawResident: (g: CanvasRenderingContext2D) => g.drawImage({} as CanvasImageSource, 0, 0, 10, 10) }));
const partsOnce = { torso: spr(), head: spr(), foot: spr() };
vi.mock('../src/art/dancingAlligator', () => ({ gatorParts: () => partsOnce, GATOR_GREEN: '#5f8a45', GATOR_SCALE: 0.56 }));

let draws = 0, canvases = 0;
const ctx = (): CanvasRenderingContext2D => new Proxy({} as object, {
  get(target, key) {
    if (key === 'drawImage') return () => { draws++; };
    if (key === 'getTransform') return () => ({ a: 2 });
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (key === 'measureText') return () => ({ width: 40 });
    if (key in target) return (target as Record<string | symbol, unknown>)[key];
    return () => {};
  },
  set(target, key, value) { (target as Record<string | symbol, unknown>)[key] = value; return true; },
}) as unknown as CanvasRenderingContext2D;

beforeEach(() => {
  draws = 0; canvases = 0;
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, key: () => null, length: 0 });
  vi.stubGlobal('document', { createElement: () => { canvases++; return { width: 1, height: 1, getContext: ctx }; } });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

describe('custo de desenho do boxe', () => {
  it('nenhuma cena passa de 250 drawImage por quadro (idle, ataques, ORELHADA, contagem, derrota)', async () => {
    const { BoxingMatch } = await import('../src/game/minigames/boxing/sim/match');
    const { Crowd } = await import('../src/game/minigames/boxing/sim/crowd');
    const { BoxingScene } = await import('../src/art/minigames/boxing/scene');
    const m = new BoxingMatch();
    const crowd = new Crowd();
    const scene = new BoxingScene(null, 667, 320);
    const g = ctx();
    const frame = () => { draws = 0; scene.update(1 / 60); crowd.update(1 / 60, true); scene.draw(g, m, crowd, 667, 320, 2); return draws; };
    const worst: Record<string, number> = {};
    const note = (k: string) => { worst[k] = Math.max(worst[k] ?? 0, frame()); };
    note('idle');
    for (const atk of ['patada', 'rabada', 'mordidona', 'cabecada'] as const) {
      (m as unknown as { startAttack: (k: string) => void }).startAttack(atk);
      for (let i = 0; i < 60; i++) { m.step(1 / 60, EMPTY); note(atk); }
    }
    m.g.hp = 0; m.step(1 / 60, EMPTY); m.tryOrelhada();
    for (let i = 0; i < 400 && m.cine !== 'none'; i++) { m.step(1 / 60, EMPTY); note(m.cine); }
    const l = new BoxingMatch(); l.k.hp = 0; l.step(1 / 60, EMPTY);
    for (let i = 0; i < 120; i++) { l.step(1 / 60, EMPTY); draws = 0; scene.draw(g, l, crowd, 667, 320, 2); worst.lose = Math.max(worst.lose ?? 0, draws); }
    for (const [k, v] of Object.entries(worst)) expect(v, k).toBeLessThanOrEqual(250);
    expect(Object.keys(worst).length).toBeGreaterThan(5);
  });
});

describe('letreiros do boxe', () => {
  it('o ORELHADA! pulsa por escala: nenhum canvas novo por quadro durante a cinemática', async () => {
    const { BoxingMatch } = await import('../src/game/minigames/boxing/sim/match');
    const { Crowd } = await import('../src/game/minigames/boxing/sim/crowd');
    const { BoxingScene } = await import('../src/art/minigames/boxing/scene');
    const m = new BoxingMatch();
    const crowd = new Crowd();
    const scene = new BoxingScene(null, 667, 320);
    const g = ctx();
    m.g.hp = 0; m.step(1 / 60, EMPTY); m.tryOrelhada();
    for (let i = 0; i < 12; i++) { m.step(1 / 60, EMPTY); scene.update(1 / 60); scene.draw(g, m, crowd, 667, 320, 2); }
    const warm = canvases;
    for (let i = 0; i < 60 && m.cine === 'orelhada' && m.cineT < 1.5; i++) { m.step(1 / 60, EMPTY); scene.update(1 / 60); scene.draw(g, m, crowd, 667, 320, 2); }
    expect(canvases - warm).toBeLessThanOrEqual(2);
  });
});

const EMPTY = Object.fromEntries(['jab', 'cruzE', 'ganchoE', 'direto', 'cruzD', 'ganchoD', 'esqE', 'esqD', 'abaixar', 'guarda', 'especial'].map((b) => [b, { held: false, pressed: false, released: false }])) as never;
