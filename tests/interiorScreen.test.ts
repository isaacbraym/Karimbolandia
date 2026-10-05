import { afterEach, describe, expect, it, vi } from 'vitest';
import room from '../src/game/interior/rooms/palafitaVigia';
import { InteriorSim } from '../src/game/interior/sim';
import { InteriorStore } from '../src/game/interiorStore';
import { InteriorRenderer } from '../src/art/interior/renderer';
import { TILE_H } from '../src/game/interior/iso';

afterEach(() => vi.unstubAllGlobals());

/** Contexto 2D que aceita qualquer chamada (o teste mede geometria, não pixels). */
function fakeCtx(scale = 2): CanvasRenderingContext2D {
  const any: unknown = new Proxy(function () {}, {
    get: (_t, k) => (k === 'getTransform' ? () => ({ a: scale }) : any),
    apply: () => any,
    set: () => true,
  });
  return any as CanvasRenderingContext2D;
}
function setup() {
  const made: { width: number; height: number }[] = [];
  vi.stubGlobal('document', { createElement: () => { const c = { width: 0, height: 0, getContext: () => fakeCtx() }; made.push(c); return c; } });
  const sim = new InteriorSim(room, new InteriorStore(), { legacy: () => false }, 7);
  return { sim, r: new InteriorRenderer(sim, null, 'high'), made };
}

describe('Interior em tela cheia no celular', () => {
  it('a sala ocupa bem mais da tela que antes (escala de "caber tudo" era ~0,93)', () => {
    const { r } = setup();
    r.fit(800, 360);
    expect(r.s).toBeGreaterThan(1.3);
    const bw = (r.w + r.h) * 28 + 28;
    expect(bw * r.s).toBeLessThanOrEqual(800);
    expect(bw * r.s).toBeGreaterThan(800 * 0.7);
  });
  it('a câmera acompanha o Karimbo na vertical sem sair dos limites da sala', () => {
    const { r, sim } = setup();
    const cam = r as unknown as { follow(t: number): void };
    r.fit(800, 360);
    sim.px = 0.5; sim.py = 0.5;
    for (let i = 0; i < 120; i++) cam.follow(i / 60);
    const back = r.toScreen(sim.px, sim.py)[1], oyBack = r.oy;
    sim.px = r.w - 0.5; sim.py = r.h - 0.5;
    for (let i = 120; i < 300; i++) cam.follow(i / 60);
    const front = r.toScreen(sim.px, sim.py)[1], oyFront = r.oy;
    const lim = r as unknown as { oyMin: number; oyMax: number };
    expect(back).toBeGreaterThan(0); expect(back).toBeLessThan(360);
    expect(front).toBeGreaterThan(0); expect(front).toBeLessThan(360);
    expect(oyFront).toBeLessThan(oyBack); // rolou para mostrar a frente da sala
    for (const oy of [oyBack, oyFront]) { expect(oy).toBeGreaterThanOrEqual(lim.oyMin - 1e-6); expect(oy).toBeLessThanOrEqual(lim.oyMax + 1e-6); }
    // nos limites, a frente da laje continua dentro da tela
    expect(oyFront + (r.w + r.h) * TILE_H / 2 * r.s).toBeLessThan(360);
  });
  it('casca e móveis são reassados na resolução real da tela (sem borrar a sala ampliada)', () => {
    const { r, made } = setup();
    r.fit(800, 360);
    (r as unknown as { ensureBake(g: CanvasRenderingContext2D): void }).ensureBake(fakeCtx(2));
    expect(r.shell.bake).toBeGreaterThanOrEqual(3);
    expect(r.shell.floor.width).toBeCloseTo(r.shell.w * r.shell.bake, -1);
    expect(made.length).toBeGreaterThan(0);
  });
});
