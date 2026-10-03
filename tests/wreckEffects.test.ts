import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/art', () => ({ getArt: () => ({ nomad: { wreck: {} } }) }));
vi.mock('../src/art/kit', async importOriginal => ({ ...await importOriginal<typeof import('../src/art/kit')>(), drawSpr: vi.fn() }));
import { drawSpr } from '../src/art/kit';
import { updateWreckEffects } from '../src/game/wreckEffects';
import { Fx } from '../src/game/fx';
import { makeWorld, newCtl } from './helpers/bot';

afterEach(() => vi.restoreAllMocks());
const visible = { visible: () => true };
function emissionSpies() {
  const fx = new Fx();
  return { fx, smoke: vi.spyOn(fx, 'smoke'), sparks: vi.spyOn(fx, 'sparks'), fire: vi.spyOn(fx, 'add') };
}
describe('efeitos dos destroços', () => {
  it('desenhar uma carcaça pausada não emite partículas nem muda seu relógio', () => {
    const w = makeWorld(), wreck = { x: 100, y: 500, t: 2 }, fx = vi.spyOn(w.fx, 'add');
    vi.spyOn(Math, 'random').mockReturnValue(0);
    for (let i = 0; i < 120; i++) w['drawWreck']({} as CanvasRenderingContext2D, wreck);
    expect(drawSpr).toHaveBeenCalledTimes(120);expect(fx.mock.calls.length).toBe(0);expect(wreck.t).toBe(2);
  });
  it('30,60 e120 passos por segundo emitem as mesmas quantidades por tempo de jogo', () => {
    const results: number[][] = [];
    for (const hz of [30, 60, 120]) {
      const { fx, smoke, sparks, fire } = emissionSpies(), wreck = { x: 200, y: 500, t: 0 };
      for (let i = 0; i < hz * 10; i++) updateWreckEffects([wreck], fx, visible, 1 / hz);
      results.push([smoke.mock.calls.length, sparks.mock.calls.length, fire.mock.calls.filter(c => c[0] === 2).length]);
      expect(wreck.t).toBeCloseTo(10);expect(fx.parts.length).toBeLessThan(fx.maxParts);
    }
    expect(results).toEqual([[90, 30, 42], [90, 30, 42], [90, 30, 42]]);
  });
  it('fora da câmera avança o relógio sem spawn e voltar não recupera emissões perdidas', () => {
    const { fx, smoke, sparks, fire } = emissionSpies(), wreck = { x: 200, y: 500, t: 0 };
    updateWreckEffects([wreck], fx, { visible: () => false }, 20);
    expect(wreck.t).toBe(20);expect(fire.mock.calls.length).toBe(0);
    updateWreckEffects([wreck], fx, visible, 1 / 60);
    expect(smoke.mock.calls.length).toBeLessThanOrEqual(1);expect(sparks.mock.calls.length).toBeLessThanOrEqual(1);
    expect(fire.mock.calls.length).toBeLessThanOrEqual(5);
  });
  it('um passo muito longo cria no máximo um lote de cada efeito; dt0 e qualidade sem cosméticos não emitem', () => {
    const { fx, smoke, sparks, fire } = emissionSpies(), wreck = { x: 200, y: 500, t: 0 };
    updateWreckEffects([wreck], fx, visible, 100);
    expect(smoke).toHaveBeenCalledTimes(1);expect(sparks).toHaveBeenCalledTimes(1);expect(fire.mock.calls.length).toBe(5);
    updateWreckEffects([wreck], fx, visible, 0);expect(wreck.t).toBe(100);expect(fire.mock.calls.length).toBe(5);
    vi.spyOn(fx, 'opt').mockReturnValue(false);updateWreckEffects([wreck], fx, visible, 1);
    expect(wreck.t).toBe(101);expect(fire.mock.calls.length).toBe(5);
  });
  it('World.update integra o relógio e emissões sem depender de desenhar a cena', () => {
    const w = makeWorld(), wreck = { x: w.player.x, y: w.player.feetY, t: 0 };
    w.wrecks = [wreck];w.enemies = [];w.pickups = [];w.pits = [];
    w.director.cine = null;w.director.triggered = new Set(w.data.triggers.map(t => t.id));
    w.camera.snapTo(wreck.x, wreck.y);
    const smoke = vi.spyOn(w.fx, 'smoke');
    for (let i = 0; i < 30; i++) w.update(1 / 60, newCtl());
    expect(wreck.t).toBeCloseTo(.5);
    expect(smoke.mock.calls.some(c => c[3] === '#2a2438')).toBe(true);
  });
});
