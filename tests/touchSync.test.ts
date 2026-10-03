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
  it('mostra progresso sem writes a cada quadro e libera toque preso ao desabilitar recarga', () => {
    const setProperty=vi.fn(),setAttribute=vi.fn(),remove=vi.fn();
    const button={disabled:false,dataset:{pid:'4'} as Record<string,string>,style:{setProperty},setAttribute,classList:{toggle:vi.fn(),remove}};
    const held={reload:true};
    const ui=Object.assign(Object.create(TouchUI.prototype),{buttons:new Map([['reload',button]]),releaseTimers:new Map(),input:{touch:{held}},lastSync:'',lastWeaponIcon:''}) as TouchUI;
    const state={weaponIcon:'',ammo:'↻',lowAmmo:true,grenades:2,dash01:1,canReload:false,reloading:true,reload01:.5};
    ui.sync(state);
    expect(button.disabled).toBe(true);expect(held.reload).toBe(false);expect(button.dataset.pid).toBeUndefined();expect(remove).toHaveBeenCalledWith('down');
    expect(setAttribute).toHaveBeenLastCalledWith('aria-label','Recarregando • 50%');
    expect(setProperty).toHaveBeenLastCalledWith('--reload','0.5');
    ui.sync({...state,reload01:.51});expect(setProperty).toHaveBeenCalledTimes(1);
    ui.sync({...state,reload01:.76});expect(setAttribute).toHaveBeenLastCalledWith('aria-label','Recarregando • 75%');
    ui.sync({...state,ammo:'2/12',canReload:true,reloading:false,reload01:0});
    expect(button.disabled).toBe(false);expect(setAttribute).toHaveBeenLastCalledWith('aria-label','Recarregar arma');
    ui.sync({...state,ammo:'18/0',canReload:false,reloading:false,reload01:0});
    expect(button.disabled).toBe(true);expect(setAttribute).toHaveBeenLastCalledWith('aria-label','Recarregar arma • indisponível');
  });
});
