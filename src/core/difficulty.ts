/**
 * Três níveis de dificuldade. A partida congela o nível escolhido na criação do mundo (e o save
 * guarda qual era): mudar a configuração no menu só vale para a próxima partida.
 * NORMAL reproduz exatamente o equilíbrio histórico da campanha (testes de simulação dependem disso).
 */
export type DifficultyId = 'facil' | 'normal' | 'dificil';
export const DIFFICULTY_ORDER: DifficultyId[] = ['facil', 'normal', 'dificil'];

export interface DifficultyDef {
  id: DifficultyId;
  label: string;
  tag: string;
  description: string;
  /** vida dos inimigos comuns */
  enemyHp: number;
  /** vida do chefe (cresce menos que a dos comuns) */
  bossHp: number;
  /** dano recebido pelo Karimbo */
  playerDmg: number;
  /** velocidade com que os inimigos pensam e recarregam (1 = normal) */
  aggro: number;
  /** velocidade dos projéteis inimigos */
  bulletSpeed: number;
  /** dispersão da mira inimiga (maior = erra mais) */
  spread: number;
  /** peso das blindagens: 0 = toda arma acerta igual, 1 = resistências completas */
  armorWeight: number;
  /** chance de um inimigo comum surgir como ELITE (mais vida, blindado, prêmio maior) */
  eliteChance: number;
  /** a cada N soldados comuns a pé, um não aparece (0 = todos aparecem) */
  thinEvery: number;
  /** promove tropas comuns para tipos mais duros */
  promote: boolean;
  /** multiplica as fichas soltas pelos inimigos */
  tokens: number;
  /** multiplica a chance de vida/munição soltas */
  supply: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  facil: {
    id: 'facil', label: 'FÁCIL', tag: 'PASSEIO', description: 'Inimigos frágeis e lentos, mais munição e vida pelo caminho. Toda arma funciona bem.',
    enemyHp: 0.7, bossHp: 0.75, playerDmg: 0.55, aggro: 0.72, bulletSpeed: 0.85, spread: 1.6, armorWeight: 0.35,
    eliteChance: 0, thinEvery: 3, promote: false, tokens: 0.8, supply: 1.5,
  },
  normal: {
    id: 'normal', label: 'NORMAL', tag: 'AVENTURA', description: 'O equilíbrio original. Blindados resistem a armas leves; troque de arma conforme o alvo.',
    enemyHp: 1, bossHp: 1, playerDmg: 1, aggro: 1, bulletSpeed: 1, spread: 1, armorWeight: 0.6,
    eliteChance: 0.08, thinEvery: 4, promote: false, tokens: 1, supply: 1,
  },
  dificil: {
    id: 'dificil', label: 'DIFÍCIL', tag: 'GUERRA', description: 'Tropas maiores, elites blindadas, mira precisa e tiros rápidos. Escolher a arma certa é obrigatório.',
    enemyHp: 1.45, bossHp: 1.3, playerDmg: 1.4, aggro: 1.3, bulletSpeed: 1.15, spread: 0.6, armorWeight: 1,
    eliteChance: 0.28, thinEvery: 0, promote: true, tokens: 1.5, supply: 0.8,
  },
};

export const isDifficulty = (v: unknown): v is DifficultyId => typeof v === 'string' && v in DIFFICULTIES;

let current: DifficultyId = 'normal';
/** Nível da partida em andamento (lido pelos inimigos ao nascer). */
export const difficulty = (): DifficultyDef => DIFFICULTIES[current];
export const difficultyId = () => current;
export function setDifficulty(id: DifficultyId) {
  current = isDifficulty(id) ? id : 'normal';
}
