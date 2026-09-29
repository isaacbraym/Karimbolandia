import { Rng } from '../../core/math';
import {
  Level, T, TILE, THEME,
  type EnemySpawn, type EnemyType, type PropSpawn, type PropKind, type LootKind, type PickupSpawn, type PickupKind,
  type Checkpoint, type Arena, type CamZone, type DecoSpawn, type Trigger, type SecretRoom, type LevelData, type Wave,
} from '../level';

export const G = 32; // linha do chão principal
export const LEVEL_H = 46;

type EOpts = Partial<Omit<EnemySpawn, 'id' | 'type' | 'x' | 'y'>>;

/** Construtor de fase: coordenadas em TILES (x = coluna; y = linha da SUPERFÍCIE onde os pés pisam). */
export class LevelBuilder {
  level: Level;
  enemies: EnemySpawn[] = [];
  props: PropSpawn[] = [];
  pickups: PickupSpawn[] = [];
  checkpoints: Checkpoint[] = [];
  arenas: Arena[] = [];
  camZones: CamZone[] = [];
  decos: DecoSpawn[] = [];
  triggers: Trigger[] = [];
  secretRooms: SecretRoom[] = [];
  sections: { name: string; x: number; y: number }[] = [];
  atmosphere: { x: number; sky: number; ruin: number }[] = [];
  playerStart = { x: 0, y: 0 };
  nomadSpawn = { x: 0, y: 0 };
  finishX = 0;
  private eid = 0;
  private pid = 0;
  private kid = 0;
  theme: number = THEME.STREET;

  constructor(width: number, height = LEVEL_H) {
    this.level = new Level(width, height);
  }

  // ------------------------------------------------------------------ terreno
  setTheme(t: number) {
    this.theme = t;
  }
  fill(x: number, y: number, w: number, h: number, tile: number = T.SOLID, theme = this.theme) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.level.set(x + i, y + j, tile, theme);
  }
  clear(x: number, y: number, w: number, h: number) {
    this.fill(x, y, w, h, T.EMPTY, 0);
  }
  /** Chão sólido em [x0,x1) da linha `row` até o fundo. */
  ground(x0: number, x1: number, row = G, theme = this.theme) {
    this.fill(x0, row, x1 - x0, this.level.h - row, T.SOLID, theme);
  }
  /** Abre um poço (remove chão) em [x0,x1) a partir da linha `row`. */
  pit(x0: number, x1: number, row = G) {
    this.clear(x0, row, x1 - x0, this.level.h - row);
  }
  block(x: number, y: number, w: number, h: number, theme = this.theme) {
    this.fill(x, y, w, h, T.SOLID, theme);
  }
  plat(x: number, y: number, w: number, theme = this.theme) {
    this.fill(x, y, w, 1, T.ONEWAY, theme);
  }
  spikes(x: number, y: number, w: number, theme = this.theme) {
    this.fill(x, y, w, 1, T.HAZARD, theme);
  }
  /** Escada de plataformas one-way: n degraus de `run` tiles, sobe `rise` linhas por degrau. */
  stairs(x: number, y: number, n: number, run: number, rise: number, w = 4, theme = this.theme) {
    for (let i = 0; i < n; i++) this.plat(x + i * run, y - i * rise, w, theme);
  }
  /** Ilha/ledge sólido de espessura t. */
  ledge(x: number, y: number, w: number, t = 2, theme = this.theme) {
    this.block(x, y, w, t, theme);
  }

  // ------------------------------------------------------------------ helpers de posição
  px(x: number) {
    return x * TILE + TILE / 2;
  }
  py(row: number) {
    return row * TILE;
  }

  // ------------------------------------------------------------------ entidades
  enemy(type: EnemyType, x: number, row: number, o: EOpts = {}): EnemySpawn {
    const s: EnemySpawn = { id: this.eid++, type, x: this.px(x), y: this.py(row), ...o };
    this.enemies.push(s);
    return s;
  }
  /** Inimigos que só entram quando a arena inicia (ondas). Retorna o id. */
  arenaEnemy(arena: string, wave: number, type: EnemyType, x: number, row: number, o: EOpts = {}): number {
    const s = this.enemy(type, x, row, { ...o, arena, wave });
    return s.id;
  }
  prop(kind: PropKind, x: number, row: number, o: Partial<Omit<PropSpawn, 'id' | 'kind' | 'x' | 'y'>> = {}): PropSpawn {
    const s: PropSpawn = { id: this.pid++, kind, x: this.px(x), y: this.py(row), ...o };
    this.props.push(s);
    return s;
  }
  crate(x: number, row: number, loot: LootKind = 'random', big = false) {
    return this.prop(big ? 'crateBig' : 'crate', x, row, { loot });
  }
  pickup(kind: PickupKind, x: number, row: number, itemId = 0): PickupSpawn {
    const s: PickupSpawn = { id: this.kid++, kind, x: this.px(x), y: row * TILE, itemId };
    this.pickups.push(s);
    return s;
  }
  token(x: number, row: number) {
    return this.pickup('token', x, row);
  }
  /** Linha de moedas. */
  tokens(x: number, row: number, n: number, dx = 1, dy = 0) {
    for (let i = 0; i < n; i++) this.token(x + i * dx, row + i * dy);
  }
  /** Arco de moedas (mostra a trajetória de um pulo/planeio). */
  tokenArc(x0: number, row0: number, x1: number, rowPeak: number, n: number) {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const y = row0 + (rowPeak - row0) * 4 * t * (1 - t);
      this.token(x0 + (x1 - x0) * t, y);
    }
  }
  emblem(id: number, x: number, row: number) {
    return this.pickup('emblem', x, row, id);
  }
  secret(id: number, x: number, row: number) {
    return this.pickup('secret', x, row, id);
  }
  checkpoint(name: string, x: number, row: number) {
    this.checkpoints.push({ id: this.checkpoints.length, x: this.px(x), y: this.py(row), name });
  }
  deco(kind: string, x: number, row: number, layer: 'back' | 'front' = 'back', o: { flip?: boolean; scale?: number } = {}) {
    this.decos.push({ kind, x: this.px(x), y: this.py(row), layer, ...o });
  }
  trigger(id: string, x0: number, y0: number, w: number, h: number, once = true) {
    this.triggers.push({ id, rect: { x: x0 * TILE, y: y0 * TILE, w: w * TILE, h: h * TILE }, once });
  }
  secretRoom(id: string, x: number, y: number, w: number, h: number) {
    this.secretRooms.push({ id, rect: { x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE } });
  }
  camZone(x: number, y: number, w: number, h: number, zoom?: number) {
    this.camZones.push({ rect: { x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE }, zoom });
  }
  section(name: string, x: number, row: number) {
    this.sections.push({ name, x: this.px(x), y: this.py(row) });
  }
  atmos(x: number, sky: number, ruin = 0) {
    this.atmosphere.push({ x: x * TILE, sky, ruin });
  }

  /**
   * Arena com ondas. Cada onda é uma lista de [tipo, x, linha, opts]. Inimigos podem entrar
   * caindo (`drop`) ou correndo pela lateral (`fromSide`).
   */
  arena(o: {
    id: string;
    x0: number;
    x1: number;
    top: number; // linha do topo da área travada (câmera)
    bottom: number; // linha do fundo
    trigger: number; // tile x de ativação
    banner?: string;
    soft?: boolean;
    dropRow?: number;
    waves: { delay: number; e: [EnemyType, number, number, EOpts?][] }[];
  }) {
    const waves: Wave[] = o.waves.map((w, wi) => ({
      delay: w.delay,
      spawns: w.e.map(([type, x, row, opts]) => this.arenaEnemy(o.id, wi, type, x, row, opts ?? {})),
    }));
    this.arenas.push({
      id: o.id,
      rect: { x: o.x0 * TILE, y: o.top * TILE, w: (o.x1 - o.x0) * TILE, h: (o.bottom - o.top) * TILE },
      waves,
      triggerX: o.trigger * TILE,
      banner: o.banner,
      soft: o.soft,
      dropY: o.dropRow !== undefined ? o.dropRow * TILE : undefined,
    });
  }

  /**
   * Bolsão secreto: um "vale" no chão com escadas de saída nos dois lados e uma câmara escondida
   * sob a rua, lacrada por uma parede quebrável (ou reforçada, só o avanço do Nômad quebra).
   * Retorna a caixa da câmara. Nunca bloqueia o caminho crítico (o vale é atravessável).
   */
  pocket(x: number, o: { depth?: number; w?: number; chamberW?: number; dashOnly?: boolean; id: string; row?: number; theme?: number } = { id: 'pocket' }) {
    const depth = o.depth ?? 4;
    const w = o.w ?? 8;
    const cw = o.chamberW ?? 9;
    const row = o.row ?? G;
    const floor = row + depth;
    this.clear(x, row, w, depth);
    // escadas de saída (uma em cada lado)
    this.plat(x, floor - 2, 3, o.theme);
    this.plat(x + w - 3, floor - 2, 3, o.theme);
    // câmara sob a rua
    this.clear(x + w, floor - 3, cw, 3);
    this.prop('wall', x + w, floor, { h: 96, dashOnly: o.dashOnly, secret: true, loot: 'none', hp: o.dashOnly ? 140 : 55 });
    this.secretRoom(o.id, x + w + 1, floor - 3, cw - 1, 3);
    return { x0: x + w + 1, x1: x + w + cw, floor };
  }

  /** Decoração de rua automática (fachadas, postes, neons, vapor) com semente estável. */
  dress(x0: number, x1: number, row = G, o: { seed?: number; density?: number; ruin?: boolean; noFacade?: boolean } = {}) {
    const r = new Rng((o.seed ?? 1) * 7919 + x0);
    const d = o.density ?? 1;
    for (let x = x0 + 4; x < x1 - 2; x += Math.round(r.range(11, 17) / d)) {
      if (!o.noFacade && r.chance(0.7)) this.deco('facade', x, row, 'back', { flip: r.chance(0.5) });
    }
    for (let x = x0 + 8; x < x1 - 2; x += Math.round(r.range(20, 30) / d)) this.deco('lampPost', x, row, 'back');
    for (let x = x0 + 12; x < x1 - 2; x += Math.round(r.range(26, 40) / d)) {
      const k = r.pick(['neonSign', 'neonSign', 'hologram', 'banner']);
      this.deco(k, x, k === 'neonSign' ? row - 4 : row, 'back');
    }
    for (let x = x0 + 16; x < x1 - 2; x += Math.round(r.range(34, 50) / d)) {
      this.deco(r.pick(['steam', 'fireBarrel', 'pipes', 'crateStack', 'wreckCar']), x, row, 'back');
    }
    if (o.ruin) {
      for (let x = x0 + 5; x < x1 - 2; x += Math.round(r.range(9, 16) / d)) this.deco(r.pick(['plant', 'plant', 'vine']), x, row, 'back');
    }
    for (let x = x0 + 22; x < x1 - 2; x += Math.round(r.range(44, 70) / d)) this.deco('fgCable', x, row - 6, 'front');
    for (let x = x0 + 30; x < x1 - 2; x += Math.round(r.range(70, 100) / d)) this.deco(o.ruin ? 'fgLeaves' : 'fgFence', x, row, 'front');
  }

  build(bossArenaId = 'boss'): LevelData {
    return {
      level: this.level,
      playerStart: this.playerStart,
      nomadSpawn: this.nomadSpawn,
      enemies: this.enemies,
      props: this.props,
      pickups: this.pickups,
      checkpoints: this.checkpoints,
      arenas: this.arenas,
      camZones: this.camZones,
      decos: this.decos,
      triggers: this.triggers,
      secretRooms: this.secretRooms,
      bossArenaId,
      finishX: this.finishX,
      atmosphere: this.atmosphere,
      sections: this.sections,
    };
  }
}
