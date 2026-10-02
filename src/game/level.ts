import type { Rect } from '../core/math';
import type { CivLook } from './civLook';

export const TILE = 32;
export const VIEW_H = 360;

export const T = { EMPTY: 0, SOLID: 1, ONEWAY: 2, HAZARD: 3 } as const;
export type TileId = (typeof T)[keyof typeof T];

/** Temas visuais (afetam só a arte dos tiles). */
export const THEME = { STREET: 0, STEEL: 1, RUINS: 2, HANGAR: 3, EARTH: 4, WOOD: 5, TEMPLE: 6, MUD: 7 } as const;
/** temas da selva (fase 2): chão de terra, madeira, pedra do templo e lama do pântano */
export const isJungleTheme = (th: number) => th >= 4;

export class Level {
  readonly w: number;
  readonly h: number;
  readonly tiles: Uint8Array;
  readonly theme: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.tiles = new Uint8Array(w * h);
    this.theme = new Uint8Array(w * h);
  }

  get(tx: number, ty: number): number {
    if (tx < 0 || tx >= this.w) return T.SOLID;
    if (ty < 0 || ty >= this.h) return T.EMPTY;
    return this.tiles[ty * this.w + tx];
  }
  /** muda sempre que o mapa inteiro é trocado (reinício) → invalida os blocos em cache */
  rev = 0;
  /** blocos (8×8 tiles) alterados desde o último desenho: "cx,cy" */
  dirtyChunks = new Set<number>();
  set(tx: number, ty: number, t: number, theme = 0) {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
    const i = ty * this.w + tx;
    this.tiles[i] = t;
    this.theme[i] = theme;
    // o autotile dos vizinhos também muda: marca os blocos em volta
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.dirtyChunks.add(((ty + dy) >> 3) * 4096 + ((tx + dx) >> 3));
  }
  themeAt(tx: number, ty: number) {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return 0;
    return this.theme[ty * this.w + tx];
  }
  isSolid(tx: number, ty: number) {
    return this.get(tx, ty) === T.SOLID;
  }
  /** Ponto (em px) dentro de tile sólido? */
  solidAtPx(x: number, y: number) {
    return this.get(Math.floor(x / TILE), Math.floor(y / TILE)) === T.SOLID;
  }
  get pxW() {
    return this.w * TILE;
  }
  get pxH() {
    return this.h * TILE;
  }

  /**
   * Raycast em tiles (DDA). Retorna fração t∈[0,1] do primeiro tile SÓLIDO atingido, ou -1.
   * `oneWayBlocks`: plataformas one-way bloqueiam (usado por granadas quando descem).
   */
  rayHit(x0: number, y0: number, x1: number, y1: number): number {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.0001) return this.solidAtPx(x0, y0) ? 0 : -1;
    const steps = Math.ceil(len / 8);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (this.solidAtPx(x0 + dx * t, y0 + dy * t)) return t;
    }
    return -1;
  }

  /** Primeira coordenada Y de chão sólido/one-way abaixo de (x,y). */
  groundBelow(x: number, y: number, maxDist = 2000): number | null {
    const tx = Math.floor(x / TILE);
    let ty = Math.floor(y / TILE);
    const end = Math.min(this.h - 1, ty + Math.ceil(maxDist / TILE));
    for (; ty <= end; ty++) {
      const t = this.get(tx, ty);
      if (t === T.SOLID || t === T.ONEWAY) return ty * TILE;
    }
    return null;
  }
}

// ------------------------------------------------------------------ dados de fase
export type EnemyType =
  | 'rifle' | 'shotgun' | 'shield' | 'jetpack' | 'sniper' | 'drone' | 'turret' | 'heavy' | 'spider' | 'minimech' | 'roller'
  | 'boss';

export interface EnemySpawn {
  id: number;
  type: EnemyType;
  x: number; // px, centro
  y: number; // px, pés (base) — drones/jetpack: centro do voo
  facing?: -1 | 1;
  arena?: string; // pertence a uma arena/onda (não spawna sozinho)
  wave?: number;
  ceiling?: boolean; // torreta no teto
  wall?: -1 | 1; // torreta na parede
  idle?: boolean; // parado até ver o jogador
  patrol?: number; // metade da largura de patrulha em px
  drop?: boolean; // entra caindo do céu (paraquedas/jato)
  fromSide?: -1 | 1; // entra correndo pela lateral
}

export type PropKind =
  | 'crate' | 'crateBig' | 'barrel' | 'barricade' | 'container' | 'terminal' | 'sign' | 'lamp'
  | 'wall' | 'door' | 'vehicle' | 'pipe' | 'shutter' | 'generator' | 'speaker';

export type LootKind =
  | 'none' | 'ammo' | 'health' | 'nade' | 'points' | 'rifle' | 'shotgun' | 'launcher' | 'energy'
  | 'repair' | 'random' | 'tokens' | 'emblem' | 'secret';

export interface PropSpawn {
  id: number;
  kind: PropKind;
  x: number; // px centro
  y: number; // px base
  w?: number;
  h?: number;
  loot?: LootKind;
  lootId?: number; // id de emblema/segredo quando loot = emblem|secret
  solid?: boolean;
  hp?: number;
  secret?: boolean; // revela segredo ao quebrar (mais estilhaços/brilho)
  dashOnly?: boolean; // só o avanço do Nômad quebra
  explosive?: boolean;
  critical?: boolean; // parte do caminho crítico: NUNCA destrutível
}

export type PickupKind =
  | 'token' | 'emblem' | 'secret' | 'health' | 'healthBig' | 'ammo' | 'nade' | 'rifle' | 'shotgun' | 'launcher'
  | 'energy' | 'repair' | 'note';

export interface PickupSpawn {
  id: number;
  kind: PickupKind;
  x: number;
  y: number; // centro
  itemId?: number; // emblema 0..9, segredo 0..2
}

export interface Checkpoint {
  id: number;
  x: number;
  y: number; // pés
  name: string;
}

export interface Wave {
  delay: number; // s após início / após onda anterior limpa
  spawns: number[]; // ids de EnemySpawn
}

export interface Arena {
  id: string;
  rect: Rect; // px — câmera trava dentro; barreiras nas laterais
  waves: Wave[];
  /** x de entrada (jogador cruzando ativa) */
  triggerX: number;
  banner?: string;
  music?: 'combat' | 'boss';
  /** sem barreiras físicas (só trava câmera) */
  soft?: boolean;
  /** y (px) onde inimigos "caem" (arenas com teto); padrão: topo da câmera */
  dropY?: number;
}

export interface CamZone {
  rect: Rect; // quando o jogador está dentro: câmera limitada a este retângulo
  zoom?: number;
}

export interface DecoSpawn {
  kind: string; // chave da arte de decoração
  x: number;
  y: number; // base
  layer: 'back' | 'front';
  flip?: boolean;
  scale?: number;
  /** paralaxe de primeiro plano (0 = parado no mundo; 0.3 = passa 30% mais rápido, "perto da câmera") */
  par?: number;
}

export interface Trigger {
  id: string;
  rect: Rect;
  once: boolean;
}

export interface SecretRoom {
  id: string;
  rect: Rect; // área "escondida": ao entrar, revela e toca jingle
}

/** Comportamento base de um civil (morador da cidade). */
export type CivMood = 'cheer' | 'help' | 'flee' | 'scared';

export interface CivilianSpawn {
  id: number;
  x: number; // px centro
  y: number; // px pés (chão sólido)
  mood: CivMood;
  facing: -1 | 1;
  /** pedindo ajuda ajoelhado / abaixado */
  kneel?: boolean;
  seed: number;
  /** aparência única (preenchida ao montar a fase) */
  look?: CivLook;
}

/** Água: pântano (raso, anda devagar) ou lago (fundo, nada com traje de mergulho). y = superfície. */
export interface WaterZone {
  id: number;
  kind: 'swamp' | 'lake';
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Cipó de balançar: preso em (x, y) px, com `len` px de comprimento. */
export interface VineSpawn {
  id: number;
  x: number;
  y: number;
  len: number;
}

/** Porta/entrada: apertando ↑ (ou ↓) parado nela, o Karimbo vai para (tx, ty) — pés. */
export interface DoorSpawn {
  id: number;
  x: number;
  y: number; // pés
  tx: number;
  ty: number;
  /** 'in' = entrada do templo, 'out' = saída */
  kind: 'in' | 'out';
}

/** Tambor tribal (trampolim musical): topo em (x, y) px, largura w px. */
export interface DrumSpawn {
  id: number;
  x: number;
  y: number;
  w: number;
  /** tambor tribal (selva) ou caixa de som (boate da cidade) */
  style?: 'drum' | 'speaker';
}

/** Laser da boate: coluna (x px) de y0 a y1 que liga/desliga na batida (`phase` 0 = tempos ímpares). */
export interface BeamSpawn {
  id: number;
  x: number;
  y0: number;
  y1: number;
  phase: 0 | 1;
}

/** Interior (templo): fundo de pedra, escuridão com luz em volta do Karimbo e das tochas. */
export interface RoomZone {
  x: number;
  y: number;
  w: number;
  h: number;
  /** estilo do interior: templo (escuro, tochas) ou boate (neon) */
  kind?: 'temple' | 'club';
}

export interface LevelData {
  /** 1 = cidade (Felipão), 2 = selva */
  stage: number;
  water: WaterZone[];
  vines: VineSpawn[];
  doors: DoorSpawn[];
  rooms: RoomZone[];
  drums: DrumSpawn[];
  beams: BeamSpawn[];
  level: Level;
  playerStart: { x: number; y: number };
  nomadSpawn: { x: number; y: number };
  enemies: EnemySpawn[];
  props: PropSpawn[];
  pickups: PickupSpawn[];
  checkpoints: Checkpoint[];
  arenas: Arena[];
  camZones: CamZone[];
  decos: DecoSpawn[];
  triggers: Trigger[];
  secretRooms: SecretRoom[];
  bossArenaId: string;
  finishX: number;
  /** atmosfera por x (px): interpola cor/hora do dia */
  atmosphere: { x: number; sky: number; ruin: number }[];
  /** seções para debug/teleporte */
  sections: { name: string; x: number; y: number }[];
  /** moradores da cidade (não são alvos nem sólidos) */
  civilians: CivilianSpawn[];
}
