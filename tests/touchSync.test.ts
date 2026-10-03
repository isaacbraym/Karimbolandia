import { describe, expect, it, vi } from 'vitest';
import { TouchUI } from '../src/ui/touch';

describe('Icone da arma nos controles de toque', () => {
  it('troca imagens do mesmo tamanho sem reatribuir src ao mudar apenas municao', () => {
    const setSrc = vi.fn();
    const image = { set src(value: string) { setSrc(value); } };
    const badge = { textContent: '', classList: { toggle: vi.fn() } };
    const swap = { querySelector: (selector: string) => selector === '.wicon' ? image : badge };
    const ui = Object.assign(Object.create(TouchUI.prototype), {
      buttons: new Map([['next', swap]]), lastSync: '', lastWeaponIcon: '',
    }) as TouchUI;
    const state = { weaponIcon: 'data:image/png;base64,AAAA', ammo: '8/12', lowAmmo: false, grenades: 2, dash01: 1 };
    ui.sync(state); ui.sync(state);
    expect(setSrc).toHaveBeenCalledTimes(1);
    const second = { ...state, weaponIcon: 'data:image/png;base64,BBBB' };
    expect(second.weaponIcon.length).toBe(state.weaponIcon.length);
    ui.sync(second);
    expect(setSrc).toHaveBeenLastCalledWith(second.weaponIcon);
    expect(setSrc).toHaveBeenCalledTimes(2);
    ui.sync({ ...second, ammo: '0/12', lowAmmo: true });
    expect(badge.textContent).toBe('0/12');
    expect(badge.classList.toggle).toHaveBeenLastCalledWith('low', true);
    expect(setSrc).toHaveBeenCalledTimes(2);
    ui.sync(state);
    expect(setSrc).toHaveBeenLastCalledWith(state.weaponIcon);
    expect(setSrc).toHaveBeenCalledTimes(3);
  });
});
