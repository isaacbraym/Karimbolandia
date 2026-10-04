import { getArt } from '../art';
import { weaponAttributes } from '../core/weaponAttributes';
import { tunedWeapon } from '../core/gearCatalog';
import { WEAPONS, type WeaponId } from '../game/weapons';

const number = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
export function weaponReveal(id: WeaponId, gear: string[], close: () => void) {
  const overlay = document.createElement('div'); overlay.className = 'overlay weapon-reveal';
  const card = document.createElement('section'); card.className = 'weapon-reveal-card';
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', 'weapon-reveal-title');
  const header = document.createElement('header');
  const badge = document.createElement('small'); badge.textContent = 'NOVA ARMA ADQUIRIDA';
  const title = document.createElement('h2'); title.id = 'weapon-reveal-title'; title.textContent = WEAPONS[id].name;
  header.append(badge, title);
  const art = document.createElement('div'); art.className = 'weapon-reveal-art';
  const canvas = document.createElement('canvas'); canvas.width = 560; canvas.height = 240; canvas.setAttribute('aria-hidden', 'true');
  const g = canvas.getContext('2d')!, sprite = getArt().karimbo.weapons[id];
  const scale = Math.min(400 / sprite.w, 130 / sprite.h, 8);
  g.imageSmoothingEnabled = true;
  g.drawImage(sprite.c, (canvas.width - sprite.w * scale) / 2, (canvas.height - sprite.h * scale) / 2, sprite.w * scale, sprite.h * scale);
  art.append(canvas);
  const stats = document.createElement('div'); stats.className = 'weapon-reveal-stats';
  for (const stat of weaponAttributes(id, gear)) {
    const row = document.createElement('div'); row.className = 'weapon-reveal-stat';
    const label = document.createElement('span'); label.textContent = stat.label;
    const value = document.createElement('strong'); value.textContent = stat.pellets > 1
      ? `${number(stat.perPellet!)} × ${stat.pellets}` : `${number(stat.current)} ${stat.unit}`.trim();
    const bar = document.createElement('div'); bar.className = 'weapon-reveal-bar';
    bar.setAttribute('role', 'meter'); bar.setAttribute('aria-label', stat.label); bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuenow', String(stat.current)); bar.setAttribute('aria-valuemax', String(stat.potential));
    bar.setAttribute('aria-valuetext', `${value.textContent}; máximo com melhorias: ${number(stat.potential)} ${stat.unit}`);
    const potential = document.createElement('i'); potential.className = 'weapon-reveal-potential'; potential.style.width = `${stat.capacity * 100}%`;
    const filled = document.createElement('i'); filled.className = 'weapon-reveal-filled'; filled.style.width = `${stat.filled * 100}%`;
    bar.append(potential, filled); row.append(label, value, bar); stats.append(row);
  }
  const footer = document.createElement('footer');
  const tip = document.createElement('p');
  const d = tunedWeapon(id, gear);
  tip.textContent = `Barra clara: atual • tracejada: potencial com o Sivirino.${d.explosive ? ` Explosão: ${number(d.explosive.dmg)} de dano.` : d.pellets > 1 ? ' Dano por projétil × quantidade.' : ''} Alcance nominal; obstáculos bloqueiam tiros.`;
  const button = document.createElement('button'); button.type = 'button'; button.className = 'btn primary'; button.textContent = 'CONTINUAR'; button.onclick = close;
  footer.append(tip, button); card.append(header, art, stats, footer); overlay.append(card);
  return { overlay, button };
}
