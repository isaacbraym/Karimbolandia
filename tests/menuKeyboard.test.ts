import { afterEach, describe, expect, it, vi } from 'vitest';
import { Input } from '../src/core/input';
import { Menus } from '../src/ui/menus';

afterEach(() => vi.unstubAllGlobals());
describe('Teclado nos menus', () => {
  it('deixa select, slider, Tab e ativação nativa dos botões fora dos atalhos do jogo', () => {
    class Control {
      constructor(readonly tag: string) {}
      closest(selector: string) { return selector.split(',').some(s => s.trim() === this.tag) ? this : null; }
    }
    const listeners = new Map<string, (event: unknown) => void>();
    vi.stubGlobal('Element', Control);
    vi.stubGlobal('window', { addEventListener: (key: string, fn: (e: unknown) => void) => listeners.set(key, fn) });
    vi.stubGlobal('document', { addEventListener: vi.fn() });
    const input = new Input(); input.enabled = false; input.onMenuKey = vi.fn();
    input.attach({ addEventListener: vi.fn() } as unknown as HTMLElement);
    const key = (code: string, tag: string) => listeners.get('keydown')!({ code, target: new Control(tag) });
    key('ArrowDown', 'select'); key('Enter', 'select'); key('ArrowRight', 'input');
    key('Tab', 'button'); key('Enter', 'button'); key('Space', 'button');
    expect(input.onMenuKey).not.toHaveBeenCalled();
    key('ArrowDown', 'button'); key('Escape', 'select');
    expect(input.onMenuKey).toHaveBeenCalledTimes(2);
  });
  it('ativação pelo gamepad respeita o botão focado pelo Tab ou clique', () => {
    const a = { click: vi.fn() }, b = { click: vi.fn() };
    vi.stubGlobal('document', { activeElement: b });
    const menus = Object.assign(Object.create(Menus.prototype), { focusable: [a, b], focusIdx: 0 }) as Menus;
    menus.handleKey('Enter');
    expect(a.click).not.toHaveBeenCalled(); expect(b.click).toHaveBeenCalledOnce();
  });
});
