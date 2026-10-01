/**
 * Aparência dos civis: só DADOS (sem arte), gerados por semente. A simulação usa isto sem tocar em
 * canvas; a arte (src/art/civilians.ts) assa as peças a partir daqui no carregamento.
 */
import { Rng } from '../core/math';

export const SKINS = ['#f6d2b8', '#ecb894', '#d29a6e', '#b07448', '#87532f', '#5e3820'] as const;
export const HAIR_COLORS = ['#1c1424', '#3d2618', '#7a4420', '#d9a53a', '#e2384a', '#7a5cff', '#39c8e8', '#d8d4e0'] as const;
export const CLOTH = ['#39f0ff', '#ff4fd0', '#ffd23a', '#7a5cff', '#2fd68a', '#ff7a3a', '#e2384a', '#f2eeff', '#2f3a66', '#1f9b96', '#b13a8c', '#8c9a2a'] as const;
export const SHOES = ['#f2eeff', '#1c1424', '#e2384a', '#39f0ff', '#ffd23a', '#5d3b2a'] as const;

export type HairStyle = 'short' | 'long' | 'curly' | 'bun' | 'bald' | 'cap' | 'hat';
export type TopStyle = 'tee' | 'tank' | 'jacket' | 'dress' | 'overalls';
export type BottomStyle = 'pants' | 'skirt' | 'shorts';
export type Accessory = 'none' | 'glasses' | 'backpack' | 'headphones' | 'bag' | 'phone';
export type Build = 'avg' | 'tall' | 'short' | 'slim' | 'strong' | 'kid' | 'elder';

export interface CivLook {
  skin: number;
  hair: HairStyle;
  hairColor: number;
  top: TopStyle;
  topColor: number;
  topColor2: number;
  bottom: BottomStyle;
  bottomColor: number;
  shoe: number;
  acc: Accessory;
  build: Build;
}

const HAIRS: HairStyle[] = ['short', 'long', 'curly', 'bun', 'bald', 'cap', 'hat'];
const TOPS: TopStyle[] = ['tee', 'tank', 'jacket', 'dress', 'overalls'];
const BOTTOMS: BottomStyle[] = ['pants', 'skirt', 'shorts'];
const ACCS: Accessory[] = ['none', 'glasses', 'backpack', 'headphones', 'bag', 'phone'];
const BUILDS: Build[] = ['avg', 'tall', 'short', 'slim', 'strong', 'kid', 'elder'];

/** Chave única da combinação (dois civis nunca podem ter a mesma). */
export const lookKey = (l: CivLook) =>
  `${l.skin}|${l.hair}|${l.hairColor}|${l.top}|${l.topColor}|${l.topColor2}|${l.bottom}|${l.bottomColor}|${l.shoe}|${l.acc}|${l.build}`;

/** Gera uma aparência a partir da semente (determinística). */
export function rollLook(seed: number): CivLook {
  const r = new Rng(seed * 2654435761 + 17);
  const build = r.pick(BUILDS);
  const top = r.pick(TOPS);
  // vestido já cobre a parte de baixo: só saia/bermuda curta por baixo não faz sentido → "pernas" (skirt)
  const bottom: BottomStyle = top === 'dress' ? 'skirt' : top === 'overalls' ? 'pants' : r.pick(BOTTOMS);
  let hairColor = r.int(0, HAIR_COLORS.length - 2); // cinza fica para os idosos
  if (build === 'elder') hairColor = HAIR_COLORS.length - 1;
  let acc = r.pick(ACCS);
  if (build === 'kid' && acc === 'phone') acc = 'backpack';
  const topColor = r.int(0, CLOTH.length - 1);
  let topColor2 = r.int(0, CLOTH.length - 1);
  if (topColor2 === topColor) topColor2 = (topColor + 5) % CLOTH.length;
  let bottomColor = r.int(0, CLOTH.length - 1);
  if (bottomColor === topColor) bottomColor = (bottomColor + 3) % CLOTH.length;
  return {
    skin: r.int(0, SKINS.length - 1),
    hair: r.pick(HAIRS),
    hairColor,
    top,
    topColor,
    topColor2,
    bottom,
    bottomColor,
    shoe: r.int(0, SHOES.length - 1),
    acc,
    build,
  };
}

/**
 * Atribui uma aparência a cada civil garantindo que não há duas combinações iguais
 * (se a semente repetir uma combinação, rola de novo com a semente seguinte).
 */
export function assignLooks<T extends { seed: number; look?: CivLook }>(list: T[]) {
  const used = new Set<string>();
  for (const c of list) {
    let s = c.seed;
    let l = rollLook(s);
    while (used.has(lookKey(l))) l = rollLook(++s);
    used.add(lookKey(l));
    c.look = l;
  }
}

export interface BuildDims {
  k: number; // escala geral
  sy: number; // altura extra (pernas/tronco)
  sx: number; // largura do tronco
  head: number; // tamanho relativo da cabeça
  lean: number; // corcunda (rad)
}
const DIMS: Record<Build, BuildDims> = {
  avg: { k: 1, sy: 1, sx: 1, head: 1, lean: 0 },
  tall: { k: 1, sy: 1.1, sx: 0.96, head: 1, lean: 0 },
  short: { k: 0.94, sy: 0.92, sx: 1.04, head: 1, lean: 0 },
  slim: { k: 1, sy: 1.02, sx: 0.86, head: 0.96, lean: 0 },
  strong: { k: 1.04, sy: 1, sx: 1.18, head: 1, lean: 0 },
  kid: { k: 0.66, sy: 0.96, sx: 1, head: 1.28, lean: 0 },
  elder: { k: 0.96, sy: 0.96, sx: 1, head: 1, lean: 0.12 },
};
/** Proporções por porte (objetos fixos: nada é alocado por quadro). */
export const buildDims = (b: Build): BuildDims => DIMS[b];
