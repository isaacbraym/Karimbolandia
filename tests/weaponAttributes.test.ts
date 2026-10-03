import { describe, expect, it } from 'vitest';
import { weaponAttributes } from '../src/core/weaponAttributes';
import { GEAR, magazineCapacity, tunedWeapon } from '../src/core/gearCatalog';
import { WEAPON_ORDER } from '../src/game/weapons';
import { TILE } from '../src/game/level';
import { Input } from '../src/core/input';

describe('Apresentação de novas armas', () => {
  it('mostra os valores usados no combate e potencial existente para cada arma', () => {
    for (const id of WEAPON_ORDER) {
      const gear = [`${id}.damage.1`, `${id}.scope.1`, `${id}.mag.1`];
      const d = tunedWeapon(id, gear), stats = weaponAttributes(id, gear);
      expect(stats.map(s => s.current)).toEqual([d.dmg * d.pellets, d.speed * d.life / TILE, magazineCapacity(id, gear), 1 / d.rate]);
      for (const stat of stats) { expect(stat.potential).toBeGreaterThanOrEqual(stat.current); expect(stat.filled).toBeGreaterThan(0); expect(stat.filled).toBeLessThanOrEqual(stat.capacity); expect(stat.capacity).toBeLessThanOrEqual(1); }
      const upgraded = weaponAttributes(id, GEAR.map(item => item.id));
      for (const stat of upgraded) { expect(stat.filled).toBe(stat.capacity); expect(stat.current).toBe(stat.potential); }
    }
  });
  it('separa dano por projétil da soma da shotgun e mantém uma escala comum entre armas', () => {
    const shotgun = weaponAttributes('shotgun', []), rifle = weaponAttributes('rifle', []);
    expect(shotgun[0].perPellet).toBe(7); expect(shotgun[0].pellets).toBe(8); expect(shotgun[0].current).toBe(56);
    expect(shotgun[0].current / shotgun[0].filled).toBeCloseTo(rifle[0].current / rifle[0].filled);
  });
  it('não transforma melhoria de outra arma em ganho fictício', () => {
    expect(weaponAttributes('rifle', ['shotgun.damage.1', 'energy.mag.1'])).toEqual(weaponAttributes('rifle', []));
  });
  it('botão de toque mantido ao fechar precisa ser solto antes de voltar a atirar', () => {
    const input = new Input(); input.touch.active = true; input.touch.held.fire = true;
    input.poll(); expect(input.state.fire.held).toBe(true);
    input.suppressHeldActions(); input.poll(); expect(input.state.fire.held).toBe(false); expect(input.state.fire.pressed).toBe(false);
    input.touch.held.fire = false; input.poll(); input.touch.held.fire = true; input.poll(); expect(input.state.fire.pressed).toBe(true);
  });
});
