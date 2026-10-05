/**
 * Espécies do lago (simulação pura, sem arte): tabela de tamanhos/velocidades/grupos e o plano
 * determinístico de nascimento. O comportamento por quadro vive em `Waters.update` (water.ts) e é
 * O(n): cardumes são líder + seguidores em treliça, nunca boids O(n²).
 * A arte de cada espécie está em `art/lake/lakeLife.ts` (assada na tela de carregamento da selva).
 */
export type FishSpecies = 'photo' | 'neon' | 'cardinal' | 'bandeira' | 'disco' | 'coridora' | 'tucunare' | 'pirarucu' | 'arraia' | 'poraque';
export type LifeSpecies = Exclude<FishSpecies, 'photo'>;

/** Teto de peixes ambientes (fotos + espécies). A fase já nascia com 648; as espécies acrescentam ~400. */
export const MAX_AMBIENT_FISH = 1100;
/** Peixes só são simulados a no máximo esta distância (px) da câmera: o resto fica congelado. */
export const FISH_SIM_MARGIN = 700;

export interface SpeciesDef {
  /** tamanho (largura em px no mundo) mínimo e máximo */
  size: [number, number];
  speed: number;
  /** camada de desenho padrão */
  layer: 0 | 1 | 2;
  /** altura (px) acima do leito: > 0 = nada rente ao fundo */
  hug: number;
  /** membros por grupo [min, max] (1 = solitário) */
  group: [number, number];
}

export const SPECIES: Record<LifeSpecies, SpeciesDef> = {
  neon: { size: [11, 14], speed: 62, layer: 1, hug: 0, group: [24, 36] },
  cardinal: { size: [12, 15], speed: 58, layer: 1, hug: 0, group: [20, 28] },
  bandeira: { size: [34, 46], speed: 24, layer: 1, hug: 0, group: [3, 5] },
  disco: { size: [30, 38], speed: 22, layer: 1, hug: 0, group: [2, 2] },
  coridora: { size: [14, 18], speed: 34, layer: 1, hug: 5, group: [6, 10] },
  tucunare: { size: [60, 80], speed: 42, layer: 1, hug: 0, group: [1, 1] },
  pirarucu: { size: [180, 230], speed: 26, layer: 0, hug: 0, group: [1, 1] },
  arraia: { size: [70, 90], speed: 22, layer: 1, hug: 9, group: [1, 1] },
  poraque: { size: [110, 125], speed: 30, layer: 1, hug: 0, group: [1, 1] },
};

/** Segmentos do corpo do poraquê (cabeça incluída). */
export const EEL_SEGMENTS = 6;

/** Cooldowns do tucunaré entre perseguições (s) e do peixe gigante entre travessias. */
export const TUCUNARE_COOLDOWN: [number, number] = [25, 40];
export const GIANT_COOLDOWN = 90;

/** Onde cada grupo nasce: 'any' = água livre; 'floor' = rente ao leito; 'near' = em torno de um ponto (tiles). */
export interface SpawnReq {
  species: LifeSpecies;
  groups: number;
  where: 'any' | 'floor' | 'near';
  /** only for 'near': centro em tiles [tx, ty] */
  at?: [number, number][];
  /** camada forçada (padrão = a da espécie) */
  layer?: 0 | 1 | 2;
}

/** Lago raso da selva (onde cai a cachoeira): vida de rio. */
export const SHALLOW_PLAN: SpawnReq[] = [
  { species: 'neon', groups: 4, where: 'any' },
  { species: 'bandeira', groups: 3, where: 'any' },
  { species: 'coridora', groups: 2, where: 'floor' },
  { species: 'tucunare', groups: 3, where: 'any' },
  { species: 'arraia', groups: 1, where: 'floor' },
];

/** Atlântida: cardumes reluzentes no breu, ruínas e fendas. */
export const DEEP_PLAN: SpawnReq[] = [
  { species: 'neon', groups: 3, where: 'any' },
  { species: 'cardinal', groups: 4, where: 'any' },
  { species: 'disco', groups: 4, where: 'near', at: [[470, 100], [516, 98], [562, 98], [594, 98]] },
  { species: 'coridora', groups: 3, where: 'floor' },
  { species: 'pirarucu', groups: 2, where: 'any', layer: 0 },
  { species: 'arraia', groups: 2, where: 'floor' },
  // câmara do canto e cofre sob o leito
  { species: 'poraque', groups: 2, where: 'near', at: [[606, 96], [595, 106]] },
];

/** Peixe gigante do evento: cruza o palácio na camada da frente, no máximo 1× a cada GIANT_COOLDOWN s. */
export const GIANT_LANE = { x0: 470, x1: 612, y: 92 };
