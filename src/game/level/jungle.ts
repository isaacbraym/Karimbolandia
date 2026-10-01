/**
 * FASE 2 — SELVA (prévia do cenário): selva densa, pântanos, ruínas de um templo, a cachoeira com o
 * lago (o Karimbo cai nele e veste o traje de mergulho) e o acampamento dos bandidos.
 * As mecânicas de plataforma (estilo Donkey Kong / Mario) entram depois; aqui o foco é o cenário.
 */
import { Rng } from '../../core/math';
import { THEME, TILE, type LevelData } from '../level';
import { G, LEVEL_H, LevelBuilder } from './builder';

export const JUNGLE_W = 476;

/** Lago: colunas [LAKE_X0, LAKE_X1), superfície na linha LAKE_TOP, fundo na linha LAKE_FLOOR. */
export const LAKE_X0 = 264;
export const LAKE_X1 = 340;
export const LAKE_TOP = 34;
export const LAKE_FLOOR = 44;

/** Poços do pântano (1 tile de fundo, água até a coxa). */
const SWAMPS: [number, number][] = [
  [72, 85],
  [93, 107],
  [119, 133],
  [146, 160],
];

const inSwamp = (x: number) => SWAMPS.some(([a, b]) => x >= a - 1 && x < b + 1);
const inLake = (x: number) => x >= LAKE_X0 - 1 && x < LAKE_X1 + 1;

/** Vegetação automática da selva (camadas de trás e da frente), com semente estável. */
function dressJungle(b: LevelBuilder, x0: number, x1: number, o: { seed: number; row?: number; dense?: number; temple?: boolean; camp?: boolean }) {
  const r = new Rng(o.seed * 7919 + x0);
  const row = o.row ?? G;
  const d = o.dense ?? 1;
  const free = (x: number) => !inSwamp(x) && !inLake(x);
  // árvores gigantes ao fundo (troncos com raízes tabulares)
  for (let x = x0 + 3; x < x1 - 2; x += Math.round(r.range(10, 16) / d)) {
    if (!free(x)) continue;
    b.deco(o.temple && r.chance(0.3) ? 'jPillar' : r.chance(0.78) ? 'jTree' : 'jPalm', x, row, 'back', { flip: r.chance(0.5) });
  }
  // fachos de luz atravessando a copa
  for (let x = x0 + 6; x < x1 - 2; x += Math.round(r.range(18, 30) / d)) b.deco('jLightShaft', x, row, 'back', { flip: r.chance(0.5) });
  // plantas no chão
  const ground = o.camp
    ? ['jFern', 'jBush', 'jRock', 'jStump', 'jCrates', 'jFern']
    : o.temple
      ? ['jFern', 'jRock', 'jStoneHead', 'jBush', 'jFern', 'jRoots', 'jTotem']
      : ['jFern', 'jFern', 'jBush', 'jBanana', 'jRock', 'jStump', 'jRoots', 'jFlowers', 'jBanana'];
  for (let x = x0 + 2; x < x1 - 1; x += Math.round(r.range(3, 6) / d)) {
    if (!free(x)) continue;
    b.deco(r.pick(ground), x, row, 'back', { flip: r.chance(0.5) });
  }
  // cipós pendurados (balançam) e vaga-lumes
  for (let x = x0 + 4; x < x1 - 1; x += Math.round(r.range(7, 12) / d)) b.deco('jVine', x, row - 5 - r.int(0, 2), 'back', { flip: r.chance(0.5) });
  for (let x = x0 + 8; x < x1 - 1; x += Math.round(r.range(16, 26) / d)) b.deco('jFireflies', x, row - 2, 'back');
  // primeiro plano: folhas gigantes embaixo e cipós escuros em cima
  for (let x = x0 + 14; x < x1 - 2; x += Math.round(r.range(30, 46) / d)) {
    if (free(x)) b.deco('jFgLeaves', x, row + 2, 'front', { flip: r.chance(0.5), scale: 0.62 });
  }
  for (let x = x0 + 18; x < x1 - 2; x += Math.round(r.range(30, 48) / d)) b.deco('jFgVines', x, row - 11, 'front', { flip: r.chance(0.5) });
}

/** Pântano: poço raso com lama no fundo, água turva, juncos, raízes de mangue e troncos boiando. */
function swamps(b: LevelBuilder) {
  const r = new Rng(4242);
  for (const [x0, x1] of SWAMPS) {
    b.clear(x0, G, x1 - x0, 1);
    b.fill(x0, G + 1, x1 - x0, 2, 1, THEME.MUD);
    b.waterZone('swamp', x0, x1, G, G + 1, 7);
    // juncos nas margens, mangue e tronco flutuante (plataforma de madeira)
    b.deco('jReeds', x0, G + 1, 'back');
    b.deco('jReeds', x1 - 1, G + 1, 'back', { flip: true });
    for (let x = x0 + 2; x < x1 - 2; x += r.int(3, 5)) b.deco(r.chance(0.5) ? 'jReeds' : 'jLily', x, G + 1, r.chance(0.3) ? 'front' : 'back', { flip: r.chance(0.5) });
    b.deco('jMangrove', Math.floor((x0 + x1) / 2) + r.int(-2, 2), G + 1, 'back', { flip: r.chance(0.5) });
    b.deco('jMist', Math.floor((x0 + x1) / 2), G, 'front');
  }
}

export function buildJungle(): LevelData {
  const b = new LevelBuilder(JUNGLE_W, LEVEL_H);
  b.stage = 2;
  b.setTheme(THEME.EARTH);
  b.ground(0, JUNGLE_W);

  // ================================================================ A — ORLA DA SELVA (0–64)
  b.playerStart = { x: b.px(4), y: b.py(G) };
  b.nomadSpawn = { x: -99999, y: 0 }; // sem Nômad na selva
  b.section('Orla da selva', 4, G);
  b.atmos(0, 0, 0.1);
  b.trigger('hint:move', 5, 0, 3, LEVEL_H);
  b.trigger('hint:shoot', 22, 0, 3, LEVEL_H);
  b.trigger('hint:jump', 38, 0, 3, LEVEL_H);
  b.deco('jSign', 10, G, 'back');
  b.tokens(12, G - 1, 6);
  // montinho de terra com raízes e troncos caídos
  b.block(18, G - 1, 6, 1);
  b.plat(28, G - 3, 4, THEME.WOOD);
  b.plat(34, G - 5, 4, THEME.WOOD);
  b.tokens(34, G - 6, 4);
  b.enemy('rifle', 31, G, { idle: true, facing: -1 });
  b.crate(44, G, 'ammo');
  b.block(48, G - 1, 4, 1);
  b.enemy('rifle', 56, G, { patrol: 50, facing: -1 });
  b.crate(60, G, 'random');
  b.checkpoint('Orla da selva', 64, G);
  dressJungle(b, 0, 70, { seed: 1, dense: 1.1 });

  // ================================================================ B — PÂNTANO (64–176)
  b.section('Pântano', 66, G);
  b.atmos(70, 0.04, 0.55);
  swamps(b);
  // troncos boiando sobre o pântano
  b.plat(76, G - 2, 4, THEME.WOOD);
  // ponte de corda atravessando o pântano
  b.plat(117, G - 2, 18, THEME.WOOD);
  b.deco('jPost', 117, G - 2, 'back');
  b.deco('jPost', 134, G - 2, 'back', { flip: true });
  b.plat(151, G - 2, 4, THEME.WOOD);
  // palafita (casa de bandido sobre estacas)
  b.plat(97, G - 3, 8, THEME.WOOD);
  b.plat(99, G - 6, 4, THEME.WOOD);
  b.deco('jHut', 101, G - 3, 'back');
  b.enemy('sniper', 101, G - 6, { facing: -1, idle: true });
  b.enemy('rifle', 88, G, { facing: -1, patrol: 40 });
  b.enemy('shotgun', 112, G, { facing: -1, patrol: 50 });
  b.crate(110, G, 'health');
  b.checkpoint('Pântano', 113, G);
  b.enemy('rifle', 139, G, { facing: -1, patrol: 60 });
  b.enemy('shotgun', 166, G, { facing: -1, idle: true });
  b.crate(163, G, 'random');
  b.tokenArc(84, G - 1, 92, G - 4, 6);
  b.tokenArc(132, G - 1, 145, G - 4, 8);
  b.tokens(152, G - 3, 3);
  dressJungle(b, 64, 176, { seed: 2, dense: 1.2 });

  // ================================================================ C — RUÍNAS DO TEMPLO (176–252)
  b.setTheme(THEME.TEMPLE);
  b.section('Templo esquecido', 178, G);
  b.atmos(180, 0.02, 0.2);
  b.ground(176, 252, G, THEME.TEMPLE);
  b.checkpoint('Templo esquecido', 180, G);
  // pirâmide em degraus
  b.block(186, G - 1, 30, 1);
  b.block(189, G - 2, 24, 1);
  b.block(192, G - 3, 18, 1);
  b.block(196, G - 4, 10, 1);
  b.deco('jTempleBack', 201, G, 'back');
  b.deco('jTotem', 201, G - 4, 'back');
  b.deco('jTorch', 197, G - 4, 'back');
  b.deco('jTorch', 205, G - 4, 'back');
  b.enemy('rifle', 199, G - 4, { facing: -1, idle: true });
  b.tokens(197, G - 5, 9);
  b.crate(214, G - 1, 'health');
  // armadilha de estacas dos bandidos
  b.spikes(222, G - 1, 3, THEME.WOOD);
  b.deco('jSkull', 220, G, 'back');
  b.tokenArc(220, G - 1, 226, G - 4, 6);
  // andaime de madeira sobre as ruínas
  b.plat(230, G - 3, 5, THEME.WOOD);
  b.plat(236, G - 5, 4, THEME.WOOD);
  b.enemy('shield', 234, G, { facing: -1, patrol: 40 });
  b.enemy('rifle', 238, G - 5, { facing: -1, idle: true });
  b.deco('jStoneHead', 240, G, 'back');
  // abismo com ponte de corda
  b.pit(244, 250);
  b.plat(243, G, 8, THEME.WOOD);
  b.deco('jPost', 243, G, 'back');
  b.deco('jPost', 250, G, 'back', { flip: true });
  b.deco('jTorch', 252, G, 'back');
  dressJungle(b, 176, 252, { seed: 3, temple: true });

  // ================================================================ D — CACHOEIRA E LAGO (252–352)
  b.setTheme(THEME.EARTH);
  b.section('Cachoeira', 254, G);
  b.atmos(256, 0.03, 0.3);
  b.checkpoint('Beira do lago', 255, G);
  b.deco('jSign', 260, G, 'back', { flip: true });
  // o lago: buraco largo e fundo com piso de lama/pedra
  b.pit(LAKE_X0, LAKE_X1, G);
  b.fill(LAKE_X0, LAKE_FLOOR, LAKE_X1 - LAKE_X0, LEVEL_H - LAKE_FLOOR, 1, THEME.MUD);
  b.waterZone('lake', LAKE_X0, LAKE_X1, LAKE_TOP, LAKE_FLOOR, 0);
  b.trigger('hint:swim', LAKE_X0, LAKE_TOP, LAKE_X1 - LAKE_X0, LAKE_FLOOR - LAKE_TOP);
  // paredão de pedra da esquerda (de onde cai a cachoeira)
  b.fill(LAKE_X0, G, 2, LAKE_TOP - G + 2, 1, THEME.TEMPLE);
  b.deco('jFall', LAKE_X0 + 6, LAKE_TOP, 'back');
  // relevo submerso: pedras, colunas tombadas do templo, uma arcada afundada
  b.block(272, LAKE_FLOOR - 2, 4, 2, THEME.TEMPLE);
  b.block(279, LAKE_FLOOR - 1, 3, 1, THEME.MUD);
  b.block(287, LAKE_FLOOR - 5, 2, 5, THEME.TEMPLE);
  b.block(297, LAKE_FLOOR - 3, 6, 3, THEME.TEMPLE);
  b.block(299, LAKE_FLOOR - 4, 2, 1, THEME.TEMPLE);
  b.block(309, LAKE_FLOOR - 6, 2, 6, THEME.TEMPLE);
  b.block(315, LAKE_FLOOR - 2, 5, 2, THEME.MUD);
  // rampa de saída à direita (pedras subindo até a margem)
  b.block(326, LAKE_FLOOR - 2, 14, 2, THEME.TEMPLE);
  b.block(330, LAKE_FLOOR - 5, 10, 3, THEME.TEMPLE);
  b.block(334, LAKE_FLOOR - 8, 6, 3, THEME.TEMPLE);
  // decoração submersa (algas, corais de água doce, ruínas, baú, ossada)
  const r = new Rng(77);
  for (let x = LAKE_X0 + 3; x < LAKE_X1 - 14; x += r.int(2, 4)) {
    let top = LAKE_FLOOR;
    while (top > LAKE_TOP && b.level.isSolid(x, top - 1)) top--;
    b.deco(r.pick(['uKelp', 'uKelp', 'uKelp', 'uGrass', 'uRock', 'uGrass', 'uKelp']), x, top, 'back', { flip: r.chance(0.5) });
  }
  b.deco('uArch', 293, LAKE_FLOOR, 'back');
  b.deco('uChest', 305, LAKE_FLOOR, 'back');
  b.deco('uBones', 283, LAKE_FLOOR, 'back');
  b.deco('uStatue', 321, LAKE_FLOOR - 2, 'back');
  b.deco('uVent', 277, LAKE_FLOOR, 'back');
  b.deco('uVent', 313, LAKE_FLOOR - 2, 'back');
  // moedas mostrando o caminho do mergulho
  b.tokenArc(LAKE_X0 + 3, LAKE_TOP + 1, LAKE_X0 + 14, LAKE_FLOOR - 4, 7);
  b.tokens(290, LAKE_FLOOR - 7, 5);
  b.tokens(304, LAKE_FLOOR - 6, 4);
  b.tokens(318, LAKE_FLOOR - 4, 5);
  b.pickup('health', 305, LAKE_FLOOR - 1);
  // margem direita
  b.section('Margem', 344, G);
  b.checkpoint('Margem', 345, G);
  b.enemy('rifle', 350, G, { facing: -1, idle: true });
  dressJungle(b, 252, 264, { seed: 4 });
  dressJungle(b, 340, 360, { seed: 5 });

  // ================================================================ E — ACAMPAMENTO DOS BANDIDOS (360–476)
  b.section('Acampamento', 362, G);
  b.atmos(360, 0.06, 0.15);
  b.atmos(470, 0.14, 0.1);
  // torre de vigia
  b.plat(368, G - 3, 5, THEME.WOOD);
  b.plat(369, G - 6, 3, THEME.WOOD);
  b.deco('jTower', 370, G, 'back');
  b.enemy('sniper', 370, G - 6, { facing: -1, idle: true });
  b.deco('jPalisade', 364, G, 'back');
  b.deco('jPalisade', 378, G, 'back', { flip: true });
  b.deco('jTent', 384, G, 'back');
  b.deco('jCampfire', 389, G, 'back');
  b.deco('jJeep', 357, G, 'back');
  b.deco('jSandbags', 375, G, 'back');
  b.deco('jFlag', 392, G, 'back');
  b.prop('barrel', 380, G, { explosive: true });
  b.crate(386, G, 'random');
  // arena: o esconderijo
  b.arena({
    id: 'camp', x0: 394, x1: 442, top: G - 11, bottom: G + 1, trigger: 398, banner: 'ESCONDERIJO DOS BANDIDOS',
    waves: [
      { delay: 0.6, e: [['rifle', 440, G, { fromSide: 1 }], ['rifle', 396, G, { fromSide: -1 }], ['shotgun', 438, G, { fromSide: 1 }]] },
      { delay: 1.2, e: [['shield', 440, G, { fromSide: 1 }], ['rifle', 397, G, { fromSide: -1 }], ['rifle', 416, G - 4], ['sniper', 430, G - 4]] },
      { delay: 1.2, e: [['shotgun', 396, G, { fromSide: -1 }], ['shotgun', 440, G, { fromSide: 1 }], ['shield', 439, G, { fromSide: 1 }], ['rifle', 418, G - 4]] },
    ],
  });
  b.plat(412, G - 4, 8, THEME.WOOD);
  b.plat(428, G - 4, 5, THEME.WOOD);
  b.deco('jTent', 404, G, 'back', { flip: true });
  b.deco('jCampfire', 422, G, 'back');
  b.deco('jTent', 434, G, 'back');
  b.deco('jAmmo', 410, G, 'back');
  b.deco('jSandbags', 427, G, 'back');
  b.deco('jAmmo', 440, G, 'back');
  b.deco('jFlag', 445, G, 'back', { flip: true });
  b.deco('jPalisade', 446, G, 'back');
  b.crate(408, G, 'health');
  b.crate(425, G, 'ammo');
  b.prop('barrel', 415, G, { explosive: true });
  b.checkpoint('Saída do acampamento', 448, G);
  b.deco('jGate', 462, G, 'back');
  b.deco('jTorch', 458, G, 'back');
  b.deco('jTorch', 466, G, 'back');
  b.tokens(450, G - 1, 8);
  b.finishX = 462 * TILE;
  dressJungle(b, 360, JUNGLE_W - 2, { seed: 6, camp: true, dense: 0.9 });

  b.atmosphere.sort((a, c) => a.x - c.x);
  return b.build('none');
}
