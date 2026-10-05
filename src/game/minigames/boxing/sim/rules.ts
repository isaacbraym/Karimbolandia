/**
 * Regras do boxe (simulação headless): tabelas de golpes, guardas, ataques do jacaré, fases e
 * dificuldade. Os números são os do plano; ajustados por teste de bots (defensivo vence, afobado perde).
 */
import type { DifficultyId } from '../../../../core/difficulty';

export type Punch = 'jab' | 'direto' | 'cruzE' | 'cruzD' | 'ganchoE' | 'ganchoD';
export type PunchTier = 'jab' | 'direto' | 'cruzado' | 'gancho';
export const PUNCH_BUTTONS: readonly Punch[] = ['jab', 'direto', 'cruzE', 'cruzD', 'ganchoE', 'ganchoD'];

export interface PunchDef {
  side: 'L' | 'R';
  tier: PunchTier;
  dmg: number;
  energy: number;
  /** preparo, ativo e recuperação (s) */
  wind: number;
  active: number;
  recover: number;
}

export const PUNCHES: Record<Punch, PunchDef> = {
  jab: { side: 'L', tier: 'jab', dmg: 4, energy: 5, wind: 0.06, active: 0.06, recover: 0.14 },
  direto: { side: 'R', tier: 'direto', dmg: 7, energy: 8, wind: 0.10, active: 0.07, recover: 0.20 },
  cruzE: { side: 'L', tier: 'cruzado', dmg: 10, energy: 12, wind: 0.16, active: 0.08, recover: 0.28 },
  cruzD: { side: 'R', tier: 'cruzado', dmg: 11, energy: 13, wind: 0.17, active: 0.08, recover: 0.30 },
  ganchoE: { side: 'L', tier: 'gancho', dmg: 13, energy: 16, wind: 0.22, active: 0.08, recover: 0.36 },
  ganchoD: { side: 'R', tier: 'gancho', dmg: 14, energy: 17, wind: 0.23, active: 0.08, recover: 0.38 },
};

export type Guard = 'alta' | 'baixa' | 'aberta' | 'tonto' | 'cobertura' | 'ataque';
/** fração do dano que passa pela guarda do jacaré, por tipo de golpe */
export const GUARD_PASS: Record<Guard, Record<PunchTier, number>> = {
  alta: { jab: 0.2, direto: 0.2, cruzado: 0.6, gancho: 1 },
  baixa: { jab: 1, direto: 1, cruzado: 1, gancho: 0.3 },
  aberta: { jab: 1, direto: 1, cruzado: 1, gancho: 1 },
  tonto: { jab: 1.5, direto: 1.5, cruzado: 1.5, gancho: 1.5 },
  /** o jacaré lê o soco repetido e se fecha todo: quase nada passa */
  /** no meio do bote ele está comprometido, mas não indefeso: leva metade */
  ataque: { jab: 0.5, direto: 0.5, cruzado: 0.5, gancho: 0.5 },
  cobertura: { jab: 0.1, direto: 0.1, cruzado: 0.15, gancho: 0.2 },
};
/** acertos seguidos em até COVER_WINDOW s fazem o jacaré se cobrir (e contra-atacar logo em seguida) */
export const COVER_HITS = 3;
export const COVER_WINDOW = 2.2;
export const COVER_TIME = 1.1;

export type AttackKind = 'patada' | 'rabada' | 'mordidona' | 'cabecada' | 'contrape';
export interface AttackDef {
  /** telegrafia (s) até o impacto */
  tele: number;
  dmg: number;
  /** janela de contra-ataque (s) quando o Karimbo esquiva */
  counter: number;
  /** a guarda do Karimbo segura? (a rabada não) */
  guardable: boolean;
}
export const ATTACKS: Record<AttackKind, AttackDef> = {
  patada: { tele: 0.45, dmg: 8, counter: 0.5, guardable: true },
  rabada: { tele: 0.70, dmg: 14, counter: 0.8, guardable: false },
  mordidona: { tele: 0.90, dmg: 22, counter: 1.2, guardable: true },
  cabecada: { tele: 0.60, dmg: 10, counter: 0.6, guardable: true },
  contrape: { tele: 0.30, dmg: 10, counter: 0.5, guardable: true },
};

/** Karimbo */
export const K_HP = 100;
export const K_ENERGY = 100;
export const ENERGY_REGEN = 22;
export const ENERGY_REGEN_DELAY = 0.5;
/** sem energia os golpes ficam 40% mais lentos */
export const TIRED_SLOW = 1.4;
export const DODGE_INVULN = 0.30;
export const DODGE_COOLDOWN = 0.25;
export const PERFECT_WINDOW = 0.25;
export const GUARD_DAMAGE = 0.25;
export const COMBO_GAP = 0.45;
export const COMBO_FINISH_BONUS = 1.25;
/** acertos seguidos sem levar golpe que deixam o jacaré tonto */
export const DIZZY_STREAK = 5;
export const DIZZY_TIME = 1.5;
export const COUNTER_MULT = 2;
export const PERFECT_SLOWMO = 0.3;

/** Jacaré */
export const G_HP = 160;
export const GROGGY_TIME = 5;
export const GROGGY_RECOVER = 0.12;
export const ORELHADA_TIME = 2.4;
export const COUNT_TIME = 1.5;
/** fases por fração de vida */
export const PHASE2_AT = 0.6;
export const PHASE3_AT = 0.25;

export interface DiffScale { gatorDmg: number; tele: number; gatorHp: number }
export const DIFF: Record<DifficultyId, DiffScale> = {
  facil: { gatorDmg: 0.7, tele: 1.25, gatorHp: 0.85 },
  normal: { gatorDmg: 1, tele: 1, gatorHp: 1 },
  dificil: { gatorDmg: 1.25, tele: 0.85, gatorHp: 1.15 },
};
/** telegrafia por fase (a fase 1 é a base) */
export const PHASE_TELE = [1, 1, 0.9, 0.8] as const;
