import { GEAR, magazineCapacity, tunedWeapon } from './gearCatalog';
import { WEAPON_ORDER, type WeaponId } from '../game/weapons';
import { TILE } from '../game/level';

const maxGear = GEAR.map(item => item.id);
const values = (id: WeaponId, gear: string[]) => {
  const d = tunedWeapon(id, gear);
  return [d.dmg * d.pellets, d.speed * d.life / TILE, magazineCapacity(id, gear), 1 / d.rate];
};
const ceilings = [0, 1, 2, 3].map(i => Math.max(...WEAPON_ORDER.map(id => values(id, maxGear)[i])));
/** Mesma escala entre armas; a parte vazia destacada usa os upgrades reais da oficina. */
export function weaponAttributes(id: WeaponId, gear: string[]) {
  const d = tunedWeapon(id, gear), current = values(id, gear), potential = values(id, maxGear);
  return ['Dano', 'Alcance', 'Carregador', 'Cadência'].map((label, i) => ({
    label, current: current[i], potential: potential[i],
    filled: Math.min(1, current[i] / ceilings[i]), capacity: Math.min(1, potential[i] / ceilings[i]),
    unit: ['', 'blocos', 'tiros', 'tiros/s'][i],
    pellets: i === 0 ? d.pellets : 1,
    perPellet: i === 0 ? d.dmg : undefined,
  }));
}
