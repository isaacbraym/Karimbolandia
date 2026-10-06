import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeWorld } from './helpers/bot';

const views = vi.hoisted(() => [] as { done: () => void; dispose: ReturnType<typeof vi.fn> }[]);
vi.mock('../src/ui/aimTutorial', () => ({ AimTutorial: class {
  dispose = vi.fn(); update = vi.fn();
  constructor(_parent: HTMLElement, _device: string, readonly done: () => void) { views.push(this); }
} }));
beforeEach(() => {
  views.length = 0;
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {} });
  vi.stubGlobal('location', { search: '' }); vi.stubGlobal('window', {});
  vi.resetModules();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function setup() {
  const { Game } = await import('../src/game/game');
  const game = new Game({ getContext: () => ({}) } as unknown as HTMLCanvasElement, {} as HTMLElement);
  const w = makeWorld(); w.director.cine = null; w.narrator.enabled = false;
  game.world = w; game.state = 'playing';
  game.menus = { hidePause: vi.fn() } as unknown as typeof game.menus;
  const pause = vi.spyOn(game, 'pause').mockImplementation(() => { game.state = 'paused'; game.input.enabled = false; });
  const resume = vi.spyOn(game, 'resume').mockImplementation(() => { game.state = 'playing'; game.input.enabled = true; });
  const api = game as unknown as { aimPending: boolean; aimTutorial: unknown; aimOpening: boolean; cancelAimTutorial(): void; step(w: typeof game.world, dt: number): void };
  Object.assign(game, { flow: { active: false }, mini: { active: false } });
  return { game, w, pause, resume, api };
}
describe('janela de mira: fluxo e cancelamento', { timeout: 30000 }, () => {
  it('abre antes de simular a fase e só devolve o controle ao confirmar', async () => {
    const { game, w, api, pause, resume } = await setup();
    const update = vi.spyOn(w, 'update'); api.aimPending = true;
    api.step(w, 1 / 60);
    expect(update).not.toHaveBeenCalled(); expect(pause).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(views).toHaveLength(1));
    expect(game.state).toBe('paused'); expect(game.input.enabled).toBe(false);
    views[0].done();
    expect(views[0].dispose).toHaveBeenCalledOnce(); expect(resume).toHaveBeenCalledOnce();
    expect(game.input.enabled).toBe(true); expect(api.aimTutorial).toBeNull();
  });
  it('cancelar enquanto o módulo carrega impede uma janela atrasada em outro mundo', async () => {
    const { game, api } = await setup(); game.showAimTutorial(); api.cancelAimTutorial(); game.world = null;
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(views).toHaveLength(0); expect(api.aimOpening).toBe(false); expect(api.aimTutorial).toBeNull();
  });
  it('cancelar a janela aberta remove a interface sem retomar a partida anterior', async () => {
    const { game, api, resume } = await setup(); game.showAimTutorial();
    await vi.waitFor(() => expect(views).toHaveLength(1)); api.cancelAimTutorial();
    expect(views[0].dispose).toHaveBeenCalledOnce(); expect(resume).not.toHaveBeenCalled();
    expect(api.aimPending).toBe(false); expect(api.aimTutorial).toBeNull();
  });
});
