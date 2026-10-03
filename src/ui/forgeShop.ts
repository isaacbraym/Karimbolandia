/**
 * Peças visuais da oficina do Tomé: miniaturas das armas, barras de atributo com prévia da
 * melhoria e a tabela de eficácia contra cada tipo de inimigo. Tudo DOM simples, criado só quando
 * a oficina abre (nada roda por quadro).
 */
import { getArt } from '../art';
import { weaponAttributes } from '../core/weaponAttributes';
import { ARMOR_LABEL, WEAPON_EFFECT, weaponEffect, type ArmorClass, type WeaponId } from '../game/weapons';

const fmt = (n: number, digits = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: digits });

/** Sprite da arma desenhado num canvas (escala nítida, centralizado). */
export function weaponCanvas(id: WeaponId, w: number, h: number, pad = 6) {
  const c = document.createElement('canvas');
  c.width = w * 2;
  c.height = h * 2;
  c.setAttribute('aria-hidden', 'true');
  const g = c.getContext('2d');
  const s = getArt().karimbo.weapons[id];
  if (g && s) {
    const k = Math.min((c.width - pad * 4) / s.w, (c.height - pad * 4) / s.h, 10);
    g.imageSmoothingEnabled = true;
    g.drawImage(s.c, (c.width - s.w * k) / 2, (c.height - s.h * k) / 2, s.w * k, s.h * k);
  }
  return c;
}

/**
 * Quatro barras na mesma escala entre todas as armas. `after` (opcional) mostra em verde quanto a
 * melhoria em foco acrescenta, para a compra ser uma decisão visual.
 */
export function attributeBars(id: WeaponId, gear: string[], after?: string[]) {
  const box = document.createElement('div');
  box.className = 'forge-bars';
  const now = weaponAttributes(id, gear);
  const next = after ? weaponAttributes(id, after) : null;
  now.forEach((stat, i) => {
    const row = document.createElement('div');
    row.className = 'forge-bar-row';
    const label = document.createElement('span');
    label.textContent = stat.label;
    const value = document.createElement('strong');
    const cur = stat.pellets > 1 ? `${fmt(stat.perPellet!)}×${stat.pellets}` : `${fmt(stat.current)}${stat.unit ? ' ' + stat.unit : ''}`;
    const gain = next && next[i].current > stat.current + 1e-6;
    value.textContent = gain
      ? `${cur} → ${next[i].pellets > 1 ? `${fmt(next[i].perPellet!)}×${next[i].pellets}` : fmt(next[i].current)}`
      : cur;
    if (gain) value.className = 'gain';
    const bar = document.createElement('div');
    bar.className = 'forge-bar';
    bar.setAttribute('role', 'meter');
    bar.setAttribute('aria-label', stat.label);
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(stat.potential));
    bar.setAttribute('aria-valuenow', String(stat.current));
    const cap = document.createElement('i');
    cap.className = 'cap';
    cap.style.width = `${stat.capacity * 100}%`;
    const add = document.createElement('i');
    add.className = 'add';
    add.style.width = `${(gain ? next![i].filled : stat.filled) * 100}%`;
    const fill = document.createElement('i');
    fill.className = 'fill';
    fill.style.width = `${stat.filled * 100}%`;
    bar.append(cap, add, fill);
    row.append(label, value, bar);
    box.append(row);
  });
  return box;
}

/** Eficácia real (já com o peso da dificuldade atual) contra soldados, robôs leves e blindados. */
export function effectChips(id: WeaponId, weight: number) {
  const box = document.createElement('div');
  box.className = 'forge-effect';
  for (const armor of Object.keys(WEAPON_EFFECT[id]) as ArmorClass[]) {
    const k = weaponEffect(id, armor, weight);
    const chip = document.createElement('span');
    chip.className = `forge-chip ${k > 1.05 ? 'strong' : k < 0.95 ? 'weak' : ''}`;
    chip.textContent = `${ARMOR_LABEL[armor]} ${Math.round(k * 100)}%`;
    chip.title = k > 1.05 ? 'Forte contra' : k < 0.95 ? 'Fraca contra' : 'Dano normal';
    box.append(chip);
  }
  return box;
}

/** Bolinhas de nível de uma trilha de melhoria (● comprado, ○ disponível). */
export function pips(owned: number, total: number) {
  const s = document.createElement('span');
  s.className = 'forge-pips';
  s.setAttribute('aria-label', `${owned} de ${total}`);
  for (let i = 0; i < total; i++) {
    const p = document.createElement('i');
    if (i < owned) p.className = 'on';
    s.append(p);
  }
  return s;
}
