import { describe, expect, it } from 'vitest';
import { GEAR, gearItem, tunedWeapon, magazineCapacity } from '../src/core/gearCatalog';
import { gearPreview } from '../src/core/gearPreview';

describe('Comparacao das melhorias antes de comprar', () => {
  it('exibe aumentos reais de carregador e cadencia, inclusive no segundo nivel', () => {
    const gear = ['pistol.mag.1'];
    expect(magazineCapacity('pistol', gear)).toBe(12);
    expect(gearPreview(gearItem('pistol.mag.2')!, gear)).toBe('12 → 16 no carregador');
    expect(gearPreview(gearItem('rifle.rate.1')!, [])).toBe('12,5 → 14,2 tiros/s');
    expect(gear).toEqual(['pistol.mag.1']);
  });
  it('explica o dano por projetil da shotgun e o dano de explosao do lancador', () => {
    expect(gearPreview(gearItem('shotgun.damage.1')!, [])).toBe('7 → 8,05 dano × 8 projéteis');
    expect(gearPreview(gearItem('launcher.damage.1')!, [])).toBe('30 → 34,5 dano • 60 → 69 explosão');
    expect(tunedWeapon('launcher', ['launcher.damage.1']).explosive!.dmg).toBe(69);
  });
  it('nao promete reduzir dispersao inexistente e inclui perfuracoes ja presentes no plasma', () => {
    expect(gearPreview(gearItem('energy.scope.1')!, [])).toBe('Já sem dispersão • alcance +15%');
    expect(gearPreview(gearItem('energy.pierce.1')!, [])).toBe('3 → 4 perfurações por tiro');
    expect(gearPreview(gearItem('pistol.scope.1')!, [])).toBe('1,1° → 0,6° • alcance +15%');
  });
  it('todas as opcoes geram comparacoes legiveis sem modificar a tabela global', () => {
    const before = JSON.stringify(GEAR);
    for (const item of GEAR) expect(gearPreview(item, [])).not.toMatch(/NaN|Infinity|undefined/);
    expect(JSON.stringify(GEAR)).toBe(before);
    expect(gearPreview(gearItem('rifle.unlock.1')!, [])).toBe('18 carregados • 18 de reserva');
  });
});
