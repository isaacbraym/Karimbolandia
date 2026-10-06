/**
 * Nota final da luta (S / A / B / C): premia vencer sem apanhar, esquivar no tempo, usar as estrelas e
 * acabar cedo, e pune quedas. Só vale para vitórias; derrota é sempre C. Lógica pura.
 */
export type Grade = 'S' | 'A' | 'B' | 'C';

export interface FightStats {
  win: boolean;
  /** como acabou */
  by: 'orelhada' | 'ko' | 'decision' | 'tko';
  time: number;
  damageTaken: number;
  /** vida máxima do Karimbo (para normalizar o dano) */
  maxHp: number;
  perfects: number;
  starsUsed: number;
  knockdownsTaken: number;
}

export function gradePoints(s: FightStats): number {
  if (!s.win) return 0;
  const taken = Math.min(1, s.damageTaken / (s.maxHp * 2));
  let p = 40;
  p += 25 * (1 - taken);
  p += Math.min(15, s.perfects * 3);
  p += Math.min(8, s.starsUsed * 4);
  p += s.by === 'orelhada' ? 12 : s.by === 'ko' ? 8 : 0;
  p -= 10 * s.knockdownsTaken;
  p -= Math.max(0, s.time - 170) / 4;
  return Math.max(0, Math.min(100, p));
}

export function gradeOf(s: FightStats): Grade {
  if (!s.win) return 'C';
  const p = gradePoints(s);
  return p >= 88 ? 'S' : p >= 72 ? 'A' : p >= 56 ? 'B' : 'C';
}
