import { afterEach, describe, expect, it, vi } from 'vitest';
import { FramePacer } from '../src/core/framePacing';
import { drawSprShrunk, type Sprite } from '../src/art/kit';
import { Game } from '../src/game/game';

afterEach(() => vi.unstubAllGlobals());

/** Carimbos de rAF reais oscilam ±0,3 ms; o gerador é fixo para o teste ser reprodutível. */
function stamps(hz: number, seconds: number, jitter: number) {
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
  return Array.from({ length: Math.round(hz * seconds) + 1 }, (_, i) => 1000 + (i * 1000) / hz + rnd() * jitter);
}
function cadence(hz: number, jitter: number) {
  const p = new FramePacer(), gaps: number[] = [];
  let last = NaN;
  for (const t of stamps(hz, 20, jitter)) if (p.take(t) !== null) { if (Number.isFinite(last)) gaps.push(Math.round((t - last) / (1000 / hz))); last = t; }
  return gaps;
}

describe('Ritmo de quadros sem engasgo artificial', () => {
  it.each([[60, 1], [120, 2], [120.016, 2], [119.98, 2], [240, 4]])('tela de %s Hz com jitter: sempre %i vsync(s) por quadro', (hz, n) => {
    const gaps = cadence(hz, 0.3);
    expect(gaps.length).toBeGreaterThan(1150);
    expect(gaps.every((g) => g === n)).toBe(true);
  });
  it('GPU lenta no começo não trava a estimativa da tela: depois volta ao teto de 60', () => {
    const p = new FramePacer(), v = 1000 / 120, drawn: number[] = [];
    let t = 0;
    for (let i = 0; i < 200; i++) { t += v * (i % 3 === 0 ? 3 : 2); if (p.take(t) !== null) drawn.push(t); }
    const start = t;
    for (let i = 0; i < 240; i++) { t += v; if (p.take(t) !== null) drawn.push(t); }
    const fast = drawn.filter((x) => x > start + 50);
    const gaps = fast.slice(1).map((x, i) => Math.round((x - fast[i]) / v));
    expect(gaps.every((g) => g === 2)).toBe(true);
    expect(p.vsync).toBeCloseTo(v, 1);
  });
  it.each([[90, 60], [144, 60]])('tela de %i Hz mantém a média de %i com jitter', (hz, fps) => {
    const p = new FramePacer();
    let n = 0;
    const ts = stamps(hz, 20, 0.3);
    for (const t of ts) if (p.take(t) !== null) n++;
    expect(n / 20).toBeGreaterThan(fps - 1);
    expect(n / 20).toBeLessThan(fps + 1);
  });
  it('pausa real de 300 ms ou 3 s fica no intervalo bruto; a física recebe 0', () => {
    const p = new FramePacer();
    p.take(0); p.take(16.67);
    expect(p.take(316.67)).toBe(0);
    expect(p.raw).toBeCloseTo(300);
    expect(p.take(333.34)).toBeCloseTo(16.67);
    expect(p.take(3341.1)).toBe(0);
    expect(p.raw).toBeCloseTo(3007.8, 1);
  });
  it('aba oculta/retorno não contamina o intervalo bruto', () => {
    const p = new FramePacer();
    p.take(0); p.take(16.67);
    p.reset(60000);
    expect(p.take(60000)).toBe(0);
    expect(Number.isNaN(p.raw)).toBe(true);
  });
  it('o loop real envia a pausa ativa ao painel de desempenho', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    vi.stubGlobal('document', { hidden: false, hasFocus: () => true });
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    const sample = vi.fn();
    const frame = Game.prototype as unknown as { frame: (now: number) => void };
    const game = Object.assign(Object.create(Game.prototype), { pacer: new FramePacer(), state: 'playing', world: { data: { stage: 1 } },
      frames: 0, lastFpsUpdate: 0, hud: { fps: 0 }, autoQuality: vi.fn(), step: vi.fn(), updateTouchState: vi.fn(), orientationBlocked: false,
      input: { poll: vi.fn(), state: { pause: { pressed: false } } }, render: vi.fn(), prof: { update: 0, render: 0 }, metrics: { sample },
      canvas: { width: 1600, height: 720 }, quality: 'high', renderScale: 1 });
    for (const t of [0, 16.67, 33.34, 333.34, 350]) frame.frame.call(game, t);
    const intervals = sample.mock.calls.map((c) => c[0]);
    expect(intervals.some((ms: number) => Math.abs(ms - 300) < 0.01)).toBe(true);
    expect(game.autoQuality.mock.calls.some((c: number[]) => Math.abs(c[0] - 0.3) < 1e-4)).toBe(true);
  });
});

describe('Custo de GPU do desenho reduzido', () => {
  it('o canvas principal usa suavização sem mipmap (bilinear)', () => {
    const g = { setTransform: vi.fn(), fillRect: vi.fn(), imageSmoothingEnabled: false, imageSmoothingQuality: 'medium', fillStyle: '' };
    const render = (Game.prototype as unknown as { render: (dt: number) => void }).render;
    render.call({ g, pxScale: 2, viewW: 800, viewH: 360 }, 0);
    expect(g.imageSmoothingEnabled).toBe(true);
    expect(g.imageSmoothingQuality).toBe('low');
  });
  it('ícone muito reduzido usa cópia pré-reduzida uma única vez, em alta qualidade', () => {
    const made: { width: number; height: number; ctx: { imageSmoothingQuality: string; drawImage: ReturnType<typeof vi.fn> } }[] = [];
    vi.stubGlobal('document', { createElement: () => {
      const c = { width: 0, height: 0, ctx: { imageSmoothingEnabled: false, imageSmoothingQuality: 'low', drawImage: vi.fn() }, getContext() { return this.ctx; } };
      made.push(c); return c;
    } });
    const spr = { c: { width: 336, height: 336 }, w: 112, h: 112, s: 3, ox: 56, oy: 112 } as unknown as Sprite;
    const g = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    drawSprShrunk(g, spr, 100, 50, 0.32, 2);
    drawSprShrunk(g, spr, 120, 50, 0.32, 2);
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({ width: 72, height: 72 });
    expect(made[0].ctx.imageSmoothingQuality).toBe('high');
    const calls = (g.drawImage as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toBe(made[0]);
    expect(calls[0].slice(1)).toEqual([100 - 56 * 0.32, 50 - 112 * 0.32, 112 * 0.32, 112 * 0.32]);
    drawSprShrunk(g, spr, 0, 0, 1.4, 2);
    expect(calls[2][0]).toBe(spr.c);
  });
});
