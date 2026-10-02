import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { makeWorld } from './helpers/bot';

beforeEach(() => {
  const stored = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => stored.set(k, v) });
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', {});
  vi.resetModules();
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function makeGame() {
  const { Game } = await import('../src/game/game');
  const canvas = { getContext: () => ({}) } as unknown as HTMLCanvasElement;
  return new Game(canvas, {} as HTMLElement);
}
// Exercita a mesma gravação usada pelo pagehide sem inicializar áudio, arte ou loop de render.
const saveOnExit = (game: unknown) => (game as { saveGame(): void }).saveGame();

describe('Saída preserva o save mais recente', () => {
  it('não sobrescreve no menu o progresso atualizado por outra aba', async () => {
    const game = await makeGame();
    const { writeSave, freshSave, loadSave } = await import('../src/game/save');
    game.world = makeWorld();
    game.world.tokens = 4;
    game.state = 'playing';
    saveOnExit(game);
    expect(loadSave()?.tokens).toBe(4);
    game.state = 'menu';
    writeSave({ ...freshSave(2), tokens: 47, score: 19000 });
    saveOnExit(game);
    expect(loadSave()?.stage).toBe(2);
    expect(loadSave()?.tokens).toBe(47);
    expect(loadSave()?.score).toBe(19000);
  });

  it('não ressuscita uma partida excluída quando a aba no menu fecha', async () => {
    const game = await makeGame();
    const { clearSave, loadSave } = await import('../src/game/save');
    game.world = makeWorld();
    game.state = 'playing';
    saveOnExit(game);
    game.state = 'menu';
    clearSave();
    saveOnExit(game);
    expect(loadSave()).toBeNull();
  });

  it.each(['playing', 'paused', 'comic'] as const)('continua salvando uma partida em %s', async state => {
    const game = await makeGame();
    const { loadSave } = await import('../src/game/save');
    game.world = makeWorld();
    game.world.tokens = 21;
    game.world.score = 5678;
    game.state = state;
    saveOnExit(game);
    expect(loadSave()?.tokens).toBe(21);
    expect(loadSave()?.score).toBe(5678);
  });
});
