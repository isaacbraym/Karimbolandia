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
    id: 'pistol', name: 'PISTOLA', dmg: 9, rate: 0.24, speed: 780, spread: 0.02, pellets: 1, life: 0.7,
    ammoMax: Infinity, ammoPickup: 0, ammoStart: Infinity, recoil: 20, shake: 0, kb: 60, gravity: 0, radius: 2.4,
    pierce: 0, color: '#ffe9a0', trail: '#ffb340', len: 13, muzzle: 14, sfx: 'pistol', casing: true,
  },
  rifle: {
    id: 'rifle', name: 'RIFLE', dmg: 6, rate: 0.08, speed: 860, spread: 0.06, pellets: 1, life: 0.75,
    ammoMax: 300, ammoPickup: 90, ammoStart: 120, recoil: 14, shake: 0, kb: 40, gravity: 0, radius: 2.2,
    pierce: 0, color: '#fff2b0', trail: '#ffc24d', len: 24, muzzle: 24, sfx: 'rifle', casing: true,
  },
  shotgun: {
    id: 'shotgun', name: 'SHOTGUN', dmg: 7, rate: 0.62, speed: 640, speedVar: 180, spread: 0.34, pellets: 8, life: 0.36,
    ammoMax: 48, ammoPickup: 12, ammoStart: 16, recoil: 190, shake: 3, kb: 240, gravity: 0, radius: 2.2,
    pierce: 0, color: '#ffe3a0', trail: '#ff9a3a', len: 25, muzzle: 26, sfx: 'shotgun', casing: true,
  },
  launcher: {
    id: 'launcher', name: 'LANÇA-GRANADAS', dmg: 30, rate: 0.78, speed: 460, spread: 0.02, pellets: 1, life: 2.2,
    ammoMax: 24, ammoPickup: 6, ammoStart: 8, recoil: 150, shake: 3.5, kb: 300, gravity: 260, radius: 4.5,
    explosive: { radius: 66, dmg: 60 }, pierce: 0, color: '#c8ffb0', trail: '#9dff7a', len: 26, muzzle: 24, sfx: 'launcher', casing: false,
  },
  energy: {
    id: 'energy', name: 'PLASMA', dmg: 17, rate: 0.19, speed: 1150, spread: 0.0, pellets: 1, life: 0.55,
    ammoMax: 100, ammoPickup: 30, ammoStart: 40, recoil: 30, shake: 0.6, kb: 120, gravity: 0, radius: 4,
    pierce: 3, color: '#7ff9ff', trail: '#2ad0ff', len: 22, muzzle: 22, sfx: 'energy', casing: false,
  },
};
