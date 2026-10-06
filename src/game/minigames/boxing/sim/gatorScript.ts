/**
 * Os padrões do jacaré (estilo Punch-Out!!): cada round tem sequências AUTORADAS que o jogador aprende,
 * com pouca sorte (sorteio ponderado por PRNG de semente, nunca o mesmo padrão duas vezes seguidas).
 * Lógica pura: nenhum acesso a arte, relógio ou DOM.
 *
 * Round 1 ensina (patada → cabeçada → rabada), o round 2 mistura e acrescenta mordidona e chapelada, o
 * round 3 é o "Jacaré Furioso": sequências de três, o Giro da Roda e pensamento mais curto.
 */
import type { Rng } from '../../../../core/math';
import type { AttackKind } from './rules';

export interface PatternDef {
  steps: readonly AttackKind[];
  /** peso do sorteio */
  w: number;
  /** só vale a partir de tantos segundos de round (o round 1 vai revelando os golpes) */
  from?: number;
}
export interface RoundScript {
  patterns: readonly PatternDef[];
  /** pausa de "pensar" entre padrões (s): mínimo e máximo */
  think: readonly [number, number];
  /** de quantos em quantos padrões ele provoca (abre a janela das estrelas) */
  tauntEvery: number;
  /** pausa extra entre os golpes de um mesmo padrão (além da recuperação) */
  stepGap: number;
}

export const SCRIPT: Record<1 | 2 | 3, RoundScript> = {
  1: {
    patterns: [
      { steps: ['patada'], w: 4 },
      { steps: ['patada', 'patada'], w: 3, from: 8 },
      { steps: ['cabecada'], w: 3, from: 14 },
      { steps: ['rabada'], w: 2, from: 28 },
      { steps: ['patada', 'cabecada'], w: 2, from: 40 },
    ],
    think: [0.55, 1.0],
    tauntEvery: 4,
    stepGap: 0.12,
  },
  2: {
    patterns: [
      { steps: ['patada', 'patada'], w: 2 },
      { steps: ['cabecada'], w: 2 },
      { steps: ['rabada'], w: 2 },
      { steps: ['mordidona'], w: 3 },
      { steps: ['patada', 'rabada'], w: 2 },
      { steps: ['chapelada'], w: 3 },
      { steps: ['cabecada', 'mordidona'], w: 2, from: 25 },
    ],
    think: [0.4, 0.75],
    tauntEvery: 4,
    stepGap: 0.08,
  },
  3: {
    patterns: [
      { steps: ['patada', 'patada', 'patada'], w: 2 },
      { steps: ['patada', 'cabecada', 'rabada'], w: 2 },
      { steps: ['mordidona'], w: 2 },
      { steps: ['chapelada', 'patada'], w: 2 },
      { steps: ['giro'], w: 3 },
      { steps: ['rabada', 'mordidona'], w: 2 },
      { steps: ['patada', 'patada', 'mordidona'], w: 1 },
    ],
    think: [0.25, 0.5],
    tauntEvery: 5,
    stepGap: 0.04,
  },
};

/** Sorteia o próximo padrão do round (peso + desbloqueio por tempo + sem repetir o anterior). */
export function pickPattern(round: 1 | 2 | 3, elapsed: number, rng: Rng, last: number): { index: number; steps: readonly AttackKind[] } {
  const list = SCRIPT[round].patterns;
  let total = 0;
  for (let i = 0; i < list.length; i++) if (i !== last && (list[i].from ?? 0) <= elapsed) total += list[i].w;
  let r = rng.next() * total;
  for (let i = 0; i < list.length; i++) {
    if (i === last || (list[i].from ?? 0) > elapsed) continue;
    r -= list[i].w;
    if (r <= 0) return { index: i, steps: list[i].steps };
  }
  return { index: 0, steps: list[0].steps };
}
