/**
 * Regras do Boxe 2.0 (simulação headless): tabelas de golpes, guardas, ataques do jacaré com cor de
 * defesa, rounds, quedas, estrelas, Fúria e dificuldade. Os números nascem do plano
 * (docs/boxe-jacare/PLANO_BOXE_2.md) e são calibrados por bots (tests/boxing.test.ts): quem lê os sinais
 * vence, quem só martela perde, quem só se esquiva perde por pontos.
 *
 * Os tempos de telegrafia são múltiplos de meia batida (132 bpm): os golpes do jacaré caem no ritmo da
 * música e do coro, o que também ajuda a prever o próximo.
 */
import type { DifficultyId } from '../../../../core/difficulty';

export const BPM = 132;
export const BEAT = 60 / BPM;
export const HALF = BEAT / 2;

// ───────────────────────── golpes do Karimbo ─────────────────────────
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
  /** parada de impacto (s) quando o golpe acerta */
  stop: number;
}

export const PUNCHES: Record<Punch, PunchDef> = {
  jab: { side: 'L', tier: 'jab', dmg: 5, energy: 5, wind: 0.06, active: 0.06, recover: 0.14, stop: 0.034 },
  direto: { side: 'R', tier: 'direto', dmg: 9, energy: 8, wind: 0.10, active: 0.07, recover: 0.20, stop: 0.05 },
  cruzE: { side: 'L', tier: 'cruzado', dmg: 14, energy: 12, wind: 0.16, active: 0.08, recover: 0.28, stop: 0.084 },
  cruzD: { side: 'R', tier: 'cruzado', dmg: 15, energy: 13, wind: 0.17, active: 0.08, recover: 0.30, stop: 0.084 },
  ganchoE: { side: 'L', tier: 'gancho', dmg: 18, energy: 16, wind: 0.22, active: 0.08, recover: 0.36, stop: 0.117 },
  ganchoD: { side: 'R', tier: 'gancho', dmg: 19, energy: 17, wind: 0.23, active: 0.08, recover: 0.38, stop: 0.117 },
};

export type Guard = 'alta' | 'baixa' | 'aberta' | 'tonto' | 'cobertura' | 'ataque';
/** fração do dano que passa pela guarda do jacaré, por tipo de golpe */
export const GUARD_PASS: Record<Guard, Record<PunchTier, number>> = {
  /** o gancho abre a guarda alta ("SAI DA GUARDA COM O GANCHO!") */
  alta: { jab: 0.3, direto: 0.3, cruzado: 0.6, gancho: 1 },
  baixa: { jab: 1, direto: 1, cruzado: 1, gancho: 0.3 },
  aberta: { jab: 1, direto: 1, cruzado: 1, gancho: 1 },
  tonto: { jab: 1.5, direto: 1.5, cruzado: 1.5, gancho: 1.5 },
  /** no meio do bote ele está comprometido, mas não indefeso: leva metade */
  ataque: { jab: 0.5, direto: 0.5, cruzado: 0.5, gancho: 0.5 },
  /** ele leu o soco repetido e se fechou todo: quase nada passa */
  cobertura: { jab: 0.1, direto: 0.1, cruzado: 0.15, gancho: 0.2 },
};
/** o MESMO tipo de soco READ_HITS vezes em READ_WINDOW s: o jacaré LÊ, se cobre e contra-ataca (ideia da luta do VIVA) */
export const READ_HITS = 3;
export const READ_WINDOW = 3;
export const COVER_TIME = 1.1;
/** compat (HUD antigo): marcas do 2º e do 3º round na barra do jacaré */
export const PHASE2_AT = 0.6;
export const PHASE3_AT = 0.25;

// ───────────────────────── ataques do jacaré ─────────────────────────
export type AttackKind = 'patada' | 'cabecada' | 'rabada' | 'mordidona' | 'chapelada' | 'giro' | 'contrape';
/** cor da telegrafia = como se defender (leitura instantânea) */
export type DefenseColor = 'amarelo' | 'laranja' | 'vermelho';
export interface AttackDef {
  /** telegrafia (s) até o primeiro impacto */
  tele: number;
  dmg: number;
  color: DefenseColor;
  /** guarda segura (25% do dano; no tempo certo, 0%) */
  guard: boolean;
  /** abaixar (só a cabeçada) */
  duck: boolean;
  /** janela de contra-ataque (s) depois da defesa bem-sucedida do último golpe */
  counter: number;
  /** golpes seguintes: tempo (s) desde o impacto anterior e dano de cada um */
  more?: readonly { gap: number; dmg: number }[];
  /** lados de onde cada golpe vem (−1 esq, +1 dir): a esquiva precisa ser PARA O LADO OPOSTO */
  sides?: readonly (-1 | 1)[];
  /** gíria da fala/balão */
  label: string;
}
export const ATTACKS: Record<AttackKind, AttackDef> = {
  patada: { tele: BEAT, dmg: 8, color: 'amarelo', guard: true, duck: false, counter: 0.5, label: 'PATADA' },
  cabecada: { tele: HALF * 3, dmg: 10, color: 'laranja', guard: false, duck: true, counter: 0.6, label: 'CABEÇADA' },
  rabada: { tele: HALF * 3, dmg: 14, color: 'vermelho', guard: false, duck: false, counter: 0.8, label: 'RABADA' },
  mordidona: { tele: BEAT * 2, dmg: 22, color: 'vermelho', guard: false, duck: false, counter: 1.2, label: 'MORDIDONA' },
  chapelada: { tele: HALF * 3, dmg: 8, color: 'amarelo', guard: true, duck: false, counter: 0.5, more: [{ gap: BEAT, dmg: 6 }], label: 'CHAPELADA' },
  giro: { tele: BEAT, dmg: 9, color: 'vermelho', guard: false, duck: false, counter: 1.5, more: [{ gap: HALF * 3, dmg: 9 }, { gap: HALF * 3, dmg: 9 }], sides: [-1, 1, -1], label: 'GIRO DA RODA' },
  contrape: { tele: 0.30, dmg: 10, color: 'amarelo', guard: true, duck: false, counter: 0.5, label: 'CONTRAPÉ' },
};

// ───────────────────────── Karimbo ─────────────────────────
export const K_HP = 100;
export const K_ENERGY = 100;
export const ENERGY_REGEN = 22;
export const ENERGY_REGEN_DELAY = 0.5;
/** defender/esquivar com sucesso devolve energia (premia o ritmo, pune quem só martela) */
export const ENERGY_ON_DEFEND = 14;
/** sem energia os golpes ficam 40% mais lentos */
export const TIRED_SLOW = 1.4;
export const DODGE_INVULN = 0.32;
/** recarga curta (intervalo mínimo entre esquivas = invulnerabilidade + recarga = 0,54 s): o Giro da Roda precisa ser esquivável */
export const DODGE_COOLDOWN = 0.22;
/** esquiva/abaixar começados até 0,18 s antes do impacto = PERFEITO (câmera lenta + janela de contra-ataque) */
export const PERFECT_WINDOW = 0.18;
export const DUCK_MIN = 0.42;
export const DUCK_COOLDOWN = 0.2;
export const GUARD_DAMAGE = 0.25;
/** guarda apertada até 0,22 s antes do impacto = DEFESA PERFEITA: dano zero (regra da luta do VIVA) */
export const PERFECT_GUARD_WINDOW = 0.22;
export const COMBO_GAP = 0.45;
export const COMBO_FINISH_BONUS = 1.25;
/** acertos seguidos sem levar golpe que deixam o jacaré tonto */
export const DIZZY_STREAK = 5;
export const DIZZY_TIME = 1.5;
export const COUNTER_MULT = 2;
export const PERFECT_SLOWMO = 0.3;
/** socos guardados durante a recuperação (entrada nunca se perde) */
export const BUFFER_TIME = 0.3;

// ───────────────────────── estrelas de orelha e Fúria ─────────────────────────
export const MAX_STARS = 3;
/** dano da ORELHADA carregada: base × (1 + estrelas), ignora a guarda */
export const CARGA_DMG = 32;
export const CARGA_WIND = 0.45;
export const CARGA_TIME = 0.9;
export const FURY_MAX = 100;
export const FURY_HIT = 7;
export const FURY_PERFECT = 14;
export const FURY_COMBO = 10;
export const FURY_LOSS_ON_HIT = 25;
export const FURY_DECAY = 2.5;
export const FURY_TIME = 6;
/** Fúria: socos 30% mais rápidos (tempo × 0,77) e +25% de dano */
export const FURY_SPEED = 0.77;
export const FURY_DMG = 1.25;

// ───────────────────────── jacaré e a luta ─────────────────────────
/** calibrado por varredura de bots: o leitor perfeito termina em ~115 s (round 2), um jogador mais lento em ~150 s; cada soco que passa tira cerca de 1–2% da barra (o dano subiu 35% e a guarda alta deixa passar 30% dos retos depois do relato "a vida quase não desce") */
export const G_HP = 1000;
export const ROUNDS = 3;
export const ROUND_TIME = 60;
export const BREAK_TIME = 8;
export const INTRO_TIME = 2.4;
export const BREAK_HEAL = 0.15;
/** vida ao levantar depois do 1º, 2º e 3º nocaute do jacaré (fração da vida máxima) */
export const G_RISE = [0.7, 0.45, 0.3] as const;
export const KD_G_TIME = 3.6;
/** o golpe final: janela de ORELHADA com o jacaré grogue (após o 3º nocaute ou no 3º round) */
export const GROGGY_TIME = 4.5;
export const GROGGY_RECOVER = 0.25;
export const ORELHADA_TIME = 2.4;
export const COUNT_TIME = 1.5;
/** Karimbo no chão: toques para levantar antes do 10 */
export const K_RISE = [0.35, 0.25] as const;
export const KD_K_COUNT = 10;
export const KD_K_STEP = 0.7;
export const GETUP_PER_TAP = 0.17;
export const GETUP_DECAY = 0.12;
export const MAX_KD_K = 3;
/** pontos dos juízes (empate favorece o campeão) */
export const KD_POINTS = 150;

export interface DiffScale { gatorDmg: number; tele: number; gatorHp: number }
export const DIFF: Record<DifficultyId, DiffScale> = {
  facil: { gatorDmg: 0.7, tele: 1.3, gatorHp: 0.85 },
  normal: { gatorDmg: 1, tele: 1, gatorHp: 1 },
  dificil: { gatorDmg: 1.25, tele: 0.85, gatorHp: 1.15 },
};
/** telegrafia por round (o round 3 é o "Jacaré Furioso": 20% mais curta) */
export const ROUND_TELE = [1, 1, 0.9, 0.8] as const;
/** revanche: o Jacaré Campeão */
export const CHAMPION = { hp: 1.25, tele: 0.92, dmg: 1.1 } as const;
