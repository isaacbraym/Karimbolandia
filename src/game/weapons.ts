import type { SfxName } from '../core/audio';

export type WeaponId = 'pistol' | 'rifle' | 'shotgun' | 'launcher' | 'energy';
export const WEAPON_ORDER: WeaponId[] = ['pistol', 'rifle', 'shotgun', 'launcher', 'energy'];

export interface WeaponDef {
  id: WeaponId;
  name: string;
  dmg: number;
  rate: number; // s entre disparos
  speed: number;
  spread: number; // rad (total)
  pellets: number;
  life: number; // s
  ammoMax: number; // Infinity = ilimitada
  ammoPickup: number;
  ammoStart: number;
  recoil: number; // impulso no atirador (px/s)
  shake: number;
  kb: number; // knockback nos inimigos
  gravity: number;
  radius: number; // raio do projétil (px)
  explosive?: { radius: number; dmg: number };
  pierce: number;
  color: string;
  trail: string;
  len: number; // comprimento do sprite da arma
  muzzle: number; // distância da mão até a boca
  sfx: SfxName;
  casing: boolean;
  speedVar?: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: 'pistol', name: 'PISTOLA', dmg: 10, rate: 0.24, speed: 780, spread: 0.02, pellets: 1, life: 0.7,
    ammoMax: Infinity, ammoPickup: 0, ammoStart: Infinity, recoil: 20, shake: 0, kb: 60, gravity: 0, radius: 2.4,
    pierce: 0, color: '#ffe9a0', trail: '#ffb340', len: 13, muzzle: 14, sfx: 'pistol', casing: true,
  },
  rifle: {
    id: 'rifle', name: 'RIFLE', dmg: 7, rate: 0.08, speed: 860, spread: 0.06, pellets: 1, life: 0.75,
    ammoMax: 144, ammoPickup: 24, ammoStart: 36, recoil: 14, shake: 0, kb: 40, gravity: 0, radius: 2.2,
    pierce: 0, color: '#fff2b0', trail: '#ffc24d', len: 24, muzzle: 24, sfx: 'rifle', casing: true,
  },
  shotgun: {
    id: 'shotgun', name: 'SHOTGUN', dmg: 7, rate: 0.62, speed: 640, speedVar: 180, spread: 0.34, pellets: 8, life: 0.36,
    ammoMax: 24, ammoPickup: 4, ammoStart: 6, recoil: 190, shake: 3, kb: 240, gravity: 0, radius: 2.2,
    pierce: 0, color: '#ffe3a0', trail: '#ff9a3a', len: 25, muzzle: 26, sfx: 'shotgun', casing: true,
  },
  launcher: {
    id: 'launcher', name: 'LANÇA-GRANADAS', dmg: 30, rate: 0.78, speed: 460, spread: 0.02, pellets: 1, life: 2.2,
    ammoMax: 12, ammoPickup: 2, ammoStart: 3, recoil: 150, shake: 3.5, kb: 300, gravity: 260, radius: 4.5,
    explosive: { radius: 68, dmg: 70 }, pierce: 0, color: '#c8ffb0', trail: '#9dff7a', len: 26, muzzle: 24, sfx: 'launcher', casing: false,
  },
  energy: {
    id: 'energy', name: 'PLASMA', dmg: 18, rate: 0.19, speed: 1150, spread: 0.0, pellets: 1, life: 0.55,
    ammoMax: 48, ammoPickup: 8, ammoStart: 12, recoil: 30, shake: 0.6, kb: 120, gravity: 0, radius: 4,
    pierce: 3, color: '#7ff9ff', trail: '#2ad0ff', len: 22, muzzle: 22, sfx: 'energy', casing: false,
  },
};

/** Classe de proteção do alvo: carne (soldados), mecânico leve (drones) e blindado (tanques). */
export type ArmorClass = 'flesh' | 'mech' | 'armor';
export const ARMOR_LABEL: Record<ArmorClass, string> = { flesh: 'soldados', mech: 'robôs leves', armor: 'blindados' };

/**
 * Eficácia bruta de cada arma contra cada classe (1 = dano cheio). A dificuldade decide quanto
 * disso vale (DifficultyDef.armorWeight): no FÁCIL quase tudo acerta igual; no DIFÍCIL é integral.
 */
export const WEAPON_EFFECT: Record<WeaponId, Record<ArmorClass, number>> = {
  pistol: { flesh: 1, mech: 1, armor: 0.55 },
  rifle: { flesh: 1, mech: 0.9, armor: 0.5 },
  shotgun: { flesh: 1.15, mech: 1.1, armor: 0.7 },
  launcher: { flesh: 1, mech: 1.25, armor: 1.4 },
  energy: { flesh: 0.9, mech: 1.4, armor: 1.6 },
};
export function weaponEffect(id: WeaponId, armor: ArmorClass, weight: number) {
  return 1 + (WEAPON_EFFECT[id][armor] - 1) * weight;
}

export interface WeaponInfo {
  tier: 'COMUM' | 'RARA' | 'ÉPICA' | 'LENDÁRIA';
  tierColor: string;
  role: string;
  lore: string;
}
/** Texto da oficina: o que a arma faz bem e para que serve. */
export const WEAPON_INFO: Record<WeaponId, WeaponInfo> = {
  pistol: { tier: 'COMUM', tierColor: '#cfd6e6', role: 'Reserva infinita', lore: 'Nunca acaba a munição. Precisa e confiável, mas fraca contra blindados.' },
  rifle: { tier: 'RARA', tierColor: '#5ad1ff', role: 'Rajada contínua', lore: 'Cadência altíssima para limpar soldados em sequência. Ruim contra blindagem.' },
  shotgun: { tier: 'RARA', tierColor: '#5ad1ff', role: 'Curto alcance', lore: 'Oito projéteis que derrubam qualquer um de perto e empurram longe.' },
  launcher: { tier: 'ÉPICA', tierColor: '#c78bff', role: 'Explosivo de área', lore: 'Granadas em arco que destroem grupos e tanques. Cuidado com a recarga lenta.' },
  energy: { tier: 'LENDÁRIA', tierColor: '#ffcf4a', role: 'Perfura e derrete aço', lore: 'Feixe de plasma que atravessa vários inimigos e ignora escudos.' },
};
