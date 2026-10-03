import { magazineCapacity, tunedWeapon, type GearItem } from './gearCatalog';

const number = (value: number, digits: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: digits });
/** Comparação dos mesmos atributos usados em combate, sem alterar equipamento ou saldo. */
export function gearPreview(item: GearItem, gear: string[]): string {
  const afterGear = [...new Set([...gear, item.id])];
  const before = tunedWeapon(item.weapon, gear), after = tunedWeapon(item.weapon, afterGear);
  const change = (a: number, b: number, digits = 1) => `${number(a, digits)} → ${number(b, digits)}`;
  switch (item.kind) {
    case 'unlock': {
      const loaded = Math.min(magazineCapacity(item.weapon, gear), before.ammoStart);
      return `${loaded} carregados • ${before.ammoStart - loaded} de reserva`;
    }
    case 'mag': return `${change(magazineCapacity(item.weapon, gear), magazineCapacity(item.weapon, afterGear))} no carregador`;
    case 'rate': return `${change(1 / before.rate, 1 / after.rate)} tiros/s`;
    case 'damage': {
      const impact = `${change(before.dmg, after.dmg, 2)} ${before.pellets > 1 ? `dano × ${before.pellets} projéteis` : 'dano'}`;
      return before.explosive && after.explosive ? `${impact} • ${change(before.explosive.dmg, after.explosive.dmg, 2)} explosão` : impact;
    }
    case 'scope': return before.spread > 0
      ? `${number(before.spread * 180 / Math.PI, 1)}° → ${number(after.spread * 180 / Math.PI, 1)}° • alcance +15%`
      : 'Já sem dispersão • alcance +15%';
    case 'pierce': return `${change(before.pierce, after.pierce)} perfurações por tiro`;
    default: return item.detail;
  }
}
