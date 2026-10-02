import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const jungle = vi.hoisted(() => ({ loaded: false, load: vi.fn() }));
vi.mock('../src/art/jungle', () => ({ getJungle: () => jungle.loaded ? {} : null, loadJungle: jungle.load }));
vi.mock('../src/core/audio', () => ({ audio: { init: vi.fn(), play: vi.fn() } }));
import { Game } from '../src/game/game';
import { SaveSession } from '../src/game/saveSession';
import { freshSave } from '../src/game/save';

beforeEach(() => { jungle.loaded = false; jungle.load.mockReset(); });
afterEach(() => vi.restoreAllMocks());

describe('Carregamento de fase cancelado', () => {
  it('não inicia uma fase atrasada depois de voltar da seleção', async () => {
    let finish!: () => void;
    jungle.load.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    const menus = { setStageLoading: vi.fn(), toast: vi.fn(), hideAll: vi.fn() };
    // Exercise the real loading path without constructing a renderer or DOM.
    const game = Object.assign(Object.create(Game.prototype), { playRequest: 0, base: './', quality: 'low', menus }) as Game;
    game.play(true, 2, freshSave(2), new SaveSession(null));
    expect(menus.setStageLoading).toHaveBeenCalledWith(true);
    game.cancelStageStart();
    jungle.loaded = true;
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(game.stage).toBeUndefined();
    expect(menus.hideAll).not.toHaveBeenCalled();
    expect(menus.toast).not.toHaveBeenCalledWith('Não foi possível carregar a selva');
  });
});
