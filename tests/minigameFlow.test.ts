import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newCtl } from './helpers/bot';
import { Input } from '../src/core/input';
import { TouchUI } from '../src/ui/touch';
import type { MinigameLoaders } from '../src/game/minigameFlow';
import type { MinigameResult, MinigameSession } from '../src/game/minigames/types';

let disk: Map<string, string>;
beforeEach(() => {
  disk = new Map();
  vi.stubGlobal('localStorage', { get length() { return disk.size; }, key: (i: number) => [...disk.keys()][i] ?? null, getItem: (k: string) => disk.get(k) ?? null, setItem: (k: string, v: string) => disk.set(k, v) });
  vi.stubGlobal('document', { createElement: () => ({ width: 1, height: 1, getContext: () => ({ drawImage() {}, imageSmoothingEnabled: true }) }) });
  vi.resetModules();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

/** Sessão falsa: acaba depois de `life` s com o resultado escolhido. */
function fakeSession(outcome: MinigameResult['outcome'], life = 1) {
  const log = { updates: 0, disposed: 0, resized: 0 };
  let t = 0;
  const s: MinigameSession = {
    get done() { return t >= life; },
    update(dt) { t += dt; log.updates++; },
    draw() {},
    resize() { log.resized++; },
    result: () => (t >= life ? { id: 'boxing', outcome, time: t, mistakes: 0 } : null),
    dispose() { log.disposed++; },
  };
  return { s, log };
}

async function setup(session: MinigameSession, fail = false) {
  const { World } = await import('../src/game/world');
  const { buildJungle } = await import('../src/game/level/jungle');
  const { MinigameFlow } = await import('../src/game/minigameFlow');
  const w = new World(buildJungle());
  w.director.cine = null;
  const input = new Input();
  const touchCalls: (string | null)[] = [];
  const special: boolean[] = [];
  const banners: string[] = [];
  const saved = vi.fn();
  const loaders: MinigameLoaders = {
    boxing: fail ? () => Promise.reject(new Error('rede')) : () => Promise.resolve({ create: () => session }),
    chase: () => Promise.resolve({ create: () => session }),
  };
  const flow = new MinigameFlow({
    input, quality: () => 'medium', view: () => ({ W: 640, H: 360 }),
    touchMode: (m) => touchCalls.push(m), touchSpecial: (on) => special.push(on), saved, banner: (t) => banners.push(t),
  }, loaders);
  return { w, flow, input, touchCalls, special, banners, saved };
}
const run = async (w: import('../src/game/world').World, flow: import('../src/game/minigameFlow').MinigameFlow, seconds: number) => {
  const ctl = newCtl();
  for (let i = 0; i < seconds * 60; i++) { flow.step(w, 1 / 60, ctl); if (i % 20 === 0) await Promise.resolve(); }
};

describe('MinigameFlow: congela o mundo e devolve tudo', () => {
  it('start congela o mundo durante o minijogo, entrega o resultado e restaura entrada/toque/música', async () => {
    const { s, log } = fakeSession('win');
    const { w, flow, input, touchCalls, special, saved } = await setup(s);
    w.setMusic('explore');
    const x0 = w.player.x, y0 = w.player.y, t0 = w.time;
    const done = vi.fn();
    expect(flow.start(w, 'boxing', done)).toBe(true);
    expect(flow.start(w, 'chase', vi.fn())).toBe(false); // um de cada vez
    await run(w, flow, 0.7);
    expect(flow.phase).toBe('live');
    expect(input.miniMode).toBe('boxing');
    expect(touchCalls).toContain('boxing');
    await run(w, flow, 0.5);
    expect(w.time).toBe(t0);
    expect(w.player.x).toBe(x0);
    expect(w.player.y).toBe(y0);
    await run(w, flow, 1.5);
    expect(done).toHaveBeenCalledTimes(1);
    expect(done.mock.calls[0][0].outcome).toBe('win');
    expect(log.disposed).toBe(1);
    expect(input.miniMode).toBeNull();
    expect(input.mouseActions).toBe(true);
    expect(touchCalls.at(-1)).toBeNull();
    expect(special.at(-1)).toBe(false);
    expect(w.musicState).toBe('explore');
    expect(saved).toHaveBeenCalledTimes(1); // salva só depois da vitória
    expect(flow.active).toBe(false);
  });

  it('reset no meio devolve controle, toque, música e resultado abort (nenhum prêmio), uma vez só', async () => {
    const { s, log } = fakeSession('win', 99);
    const { w, flow, input, touchCalls, saved } = await setup(s);
    w.setMusic('calm');
    const done = vi.fn();
    flow.start(w, 'boxing', done);
    await run(w, flow, 1);
    expect(flow.phase).toBe('live');
    w.setMusic('combat'); // a sessão mexeu na música
    flow.reset(w);
    flow.reset(w); // idempotente
    expect(done).toHaveBeenCalledTimes(1);
    expect(done.mock.calls[0][0]).toMatchObject({ id: 'boxing', outcome: 'abort' });
    expect(log.disposed).toBe(1);
    expect(input.miniMode).toBeNull();
    expect(input.mouseActions).toBe(true);
    expect(touchCalls.at(-1)).toBeNull();
    expect(w.musicState).toBe('calm');
    expect(w.camera.focus).toBeNull();
    expect(saved).not.toHaveBeenCalled();
    expect(flow.active).toBe(false);
  });

  it('reset durante o carregamento (antes de a sessão existir) também aborta limpo', async () => {
    const { s, log } = fakeSession('win');
    const { w, flow, input } = await setup(s);
    const done = vi.fn();
    flow.start(w, 'boxing', done);
    flow.step(w, 0.1, newCtl());
    flow.reset(w);
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'abort' }));
    expect(input.miniMode).toBeNull();
    expect(log.updates).toBe(0);
  });

  it('falha de import() devolve o controle com banner e resultado abort', async () => {
    const { s } = fakeSession('win');
    const { w, flow, banners, input } = await setup(s, true);
    const done = vi.fn();
    flow.start(w, 'boxing', done);
    await run(w, flow, 1);
    expect(flow.active).toBe(false);
    expect(banners).toContain('MINIJOGO INDISPONÍVEL');
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'abort' }));
    expect(input.miniMode).toBeNull();
    expect(w.camera.focus).toBeNull();
  });

  it('vitória não dá prêmio duas vezes e derrota não salva', async () => {
    const lose = fakeSession('lose');
    const a = await setup(lose.s);
    const doneL = vi.fn();
    a.flow.start(a.w, 'boxing', doneL);
    await run(a.w, a.flow, 3);
    expect(doneL).toHaveBeenCalledTimes(1);
    expect(doneL.mock.calls[0][0].outcome).toBe('lose');
    expect(a.saved).not.toHaveBeenCalled();
  });

  it('pausa: o Game simplesmente não chama step, então a sessão não avança', async () => {
    const { s, log } = fakeSession('win', 99);
    const { w, flow } = await setup(s);
    flow.start(w, 'boxing', vi.fn());
    await run(w, flow, 1);
    const n = log.updates;
    // (pausado: nenhum step)
    expect(log.updates).toBe(n);
    flow.resize(800, 400);
    expect(log.resized).toBe(1); // girar/redimensionar chega à sessão
  });
});

describe('modo de entrada do boxe', () => {
  it('trocar de modo exige soltar o que estava apertado (nada de golpe fantasma)', () => {
    const input = new Input();
    input.touch.mini.jab = true; // dedo já em cima do botão quando o modo liga
    input.setMiniMode('boxing');
    input.poll();
    expect(input.state.mini!.jab.held).toBe(false);
    expect(input.state.mini!.jab.pressed).toBe(false);
    input.touch.active = true;
    input.touch.mini.jab = false;
    input.poll();
    input.touch.mini.jab = true;
    input.poll();
    expect(input.state.mini!.jab.pressed).toBe(true);
    input.setMiniMode(null);
    expect(input.state.mini).toBeUndefined();
    expect(input.miniMode).toBeNull();
  });

  it('o teclado do boxe: Q/W/E e J/K/L, A/D esquivam, S guarda, Espaço = especial', () => {
    const input = new Input();
    input.setMiniMode('boxing');
    const keys = (input as unknown as { keys: Set<string> }).keys;
    const map: [string, keyof NonNullable<typeof input.state.mini>][] = [
      ['KeyQ', 'jab'], ['KeyW', 'cruzE'], ['KeyE', 'ganchoE'], ['KeyJ', 'direto'], ['KeyK', 'cruzD'], ['KeyL', 'ganchoD'],
      ['KeyA', 'esqE'], ['KeyD', 'esqD'], ['KeyS', 'guarda'], ['Space', 'especial'],
    ];
    for (const [code, btn] of map) {
      keys.add(code);
      input.poll();
      expect(input.state.mini![btn].pressed, code).toBe(true);
      keys.delete(code);
      input.poll();
      expect(input.state.mini![btn].released, code).toBe(true);
    }
  });
});

function element() {
  const listeners = new Map<string, (e: PointerEvent) => void>();
  const classes = new Set<string>();
  return {
    dataset: {} as Record<string, string>, style: { transform: '' },
    classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c), contains: (c: string) => classes.has(c), toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) },
    setPointerCapture: vi.fn(), getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100 }),
    querySelector: () => element(), addEventListener: (type: string, fn: (e: PointerEvent) => void) => listeners.set(type, fn),
    emit(type: string, pointerId = 1, clientX = 50) { listeners.get(type)!({ type, pointerId, clientX, clientY: 50, preventDefault() {} } as PointerEvent); },
  };
}

describe('toque do boxe: cada dedo é dono do seu botão (Foco 3)', () => {
  function touchSetup() {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout });
    const input = new Input();
    vi.spyOn(input, 'haptic').mockImplementation(() => {});
    const els = { jab: element(), direto: element(), ganchoE: element(), zone: element() };
    const ui = Object.assign(Object.create(TouchUI.prototype), {
      input, releaseTimers: new Map(), zone: { id: -1, x: 0, t: 0, timer: 0, swiped: false },
    }) as TouchUI;
    (ui as any).bindMini(els.jab, 'jab');
    (ui as any).bindMini(els.direto, 'direto');
    (ui as any).bindMini(els.ganchoE, 'ganchoE');
    (ui as any).bindMiniZone(els.zone);
    input.setMiniMode('boxing');
    return { input, els, ui };
  }

  it('dois dedos (JAB e DIRETO) ao mesmo tempo geram as duas bordas', () => {
    const { input, els } = touchSetup();
    els.jab.emit('pointerdown', 1);
    els.direto.emit('pointerdown', 2);
    input.poll();
    expect(input.state.mini!.jab.pressed).toBe(true);
    expect(input.state.mini!.direto.pressed).toBe(true);
  });

  it('pointercancel num botão não solta o outro', () => {
    const { input, els } = touchSetup();
    els.jab.emit('pointerdown', 1);
    els.direto.emit('pointerdown', 2);
    els.jab.emit('pointercancel', 1);
    input.poll();
    expect(input.state.mini!.jab.held).toBe(false);
    expect(input.state.mini!.direto.held).toBe(true);
    els.direto.emit('lostpointercapture', 2);
    input.poll();
    expect(input.state.mini!.direto.held).toBe(false);
  });

  it('um segundo dedo no mesmo botão não rouba a posse do primeiro', () => {
    const { input, els } = touchSetup();
    els.jab.emit('pointerdown', 1);
    els.jab.emit('pointerdown', 2);
    els.jab.emit('pointerup', 2);
    expect(els.jab.dataset.pid).toBe('1');
    expect(input.touch.mini.jab).toBe(true);
  });

  it('toque curto entre dois quadros ainda vale um golpe (tolerância de 45 ms)', () => {
    const { input, els } = touchSetup();
    els.jab.emit('pointerdown', 1);
    els.jab.emit('pointerup', 1);
    input.poll();
    expect(input.state.mini!.jab.pressed).toBe(true);
    vi.advanceTimersByTime(46);
    input.poll();
    expect(input.state.mini!.jab.released).toBe(true);
  });

  it('esquiva por gesto com o outro dedo segurando GANCHO', () => {
    const { input, els } = touchSetup();
    els.ganchoE.emit('pointerdown', 1);
    els.zone.emit('pointerdown', 2, 100);
    vi.advanceTimersByTime(100);
    els.zone.emit('pointermove', 2, 40); // −60 px em 100 ms
    input.poll();
    expect(input.state.mini!.esqE.pressed).toBe(true);
    expect(input.state.mini!.ganchoE.held).toBe(true); // o outro dedo continua no gancho
    els.zone.emit('pointerup', 2);
    expect(input.state.mini!.ganchoE.held).toBe(true);
  });

  it('segurar parado ≥ 180 ms vira guarda enquanto segurar; soltar desliga', () => {
    const { input, els } = touchSetup();
    els.zone.emit('pointerdown', 1, 50);
    input.poll();
    expect(input.state.mini!.guarda.held).toBe(false);
    vi.advanceTimersByTime(190);
    input.poll();
    expect(input.state.mini!.guarda.held).toBe(true);
    els.zone.emit('pointerup', 1);
    input.poll();
    expect(input.state.mini!.guarda.held).toBe(false);
  });

  it('deslizar devagar demais (> 250 ms) não esquiva', () => {
    const { input, els } = touchSetup();
    els.zone.emit('pointerdown', 1, 100);
    vi.advanceTimersByTime(300);
    els.zone.emit('pointermove', 1, 20);
    input.poll();
    expect(input.state.mini!.esqE.pressed).toBe(false);
  });
});

describe('revisão T5–T8: robustez da entrada e do fluxo', () => {
  it('teclas já seguradas ao entrar no boxe só valem depois de soltas', () => {
    const input = new Input();
    const keys = (input as unknown as { keys: Set<string>; down: Set<string> });
    keys.keys.add('KeyD'); keys.down.add('KeyD'); keys.keys.add('KeyS'); keys.down.add('KeyS');
    input.setMiniMode('boxing');
    input.poll();
    expect(input.state.mini!.esqD.pressed).toBe(false);
    expect(input.state.mini!.guarda.held).toBe(false);
    keys.keys.delete('KeyD'); keys.down.delete('KeyD'); keys.keys.delete('KeyS'); keys.down.delete('KeyS');
    input.poll();
    keys.keys.add('KeyD'); keys.down.add('KeyD');
    input.poll();
    expect(input.state.mini!.esqD.pressed).toBe(true);
  });

  it('sessão que lança exceção no quadro: aborta uma vez, descarta e devolve tudo', async () => {
    const log = { disposed: 0 };
    const s: MinigameSession = {
      done: false, update() { throw new Error('boom'); }, draw() {}, resize() {}, result: () => null, dispose() { log.disposed++; },
    };
    const { w, flow, input, touchCalls } = await setup(s);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const done = vi.fn();
    flow.start(w, 'boxing', done);
    await run(w, flow, 2);
    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'abort' }));
    expect(log.disposed).toBe(1);
    expect(input.miniMode).toBeNull();
    expect(touchCalls.at(-1)).toBeNull();
    expect(flow.active).toBe(false);
  });

  it('descarte que lança exceção não deixa o jogo preso no modo do minijogo', async () => {
    const s: MinigameSession = {
      get done() { return true; }, update() {}, draw() {}, resize() {}, result: () => ({ id: 'boxing', outcome: 'win', time: 1, mistakes: 0 }), dispose() { throw new Error('dispose'); },
    };
    const { w, flow, input } = await setup(s);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const done = vi.fn();
    flow.start(w, 'boxing', done);
    await run(w, flow, 3);
    expect(done).toHaveBeenCalledTimes(1);
    expect(input.miniMode).toBeNull();
    expect(flow.active).toBe(false);
  });
});
