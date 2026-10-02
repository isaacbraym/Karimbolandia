/**
 * FASE 2 — SELVA (prévia do cenário): selva densa, pântanos, ruínas de um templo, a cachoeira com o
 * lago (o Karimbo cai nele e veste o traje de mergulho) e o acampamento dos bandidos.
 * As mecânicas de plataforma (estilo Donkey Kong / Mario) entram depois; aqui o foco é o cenário.
 */
import { Rng } from '../../core/math';
import { THEME, TILE, type LevelData } from '../level';
import { G, LEVEL_H, LevelBuilder } from './builder';

/** a masmorra do templo ocupa as primeiras SHIFT colunas do mapa; a selva vem depois */
export const SHIFT = 150;
export const JUNGLE_W = 536 + SHIFT;

/** Lago: colunas [LAKE_X0, LAKE_X1), superfície na linha LAKE_TOP, fundo na linha LAKE_FLOOR. */
export const LAKE_X0 = 324 + SHIFT;
export const LAKE_X1 = 400 + SHIFT;
export const LAKE_TOP = 34;
export const LAKE_FLOOR = 44;

/** Desfiladeiro dos cipós: abismo [GORGE_X0, GORGE_X1) com uma pilastra no meio. */
export const GORGE_X0 = 181 + SHIFT;
export const GORGE_X1 = 229 + SHIFT;
export const GORGE_ISLAND: [number, number] = [202 + SHIFT, 206 + SHIFT];
/** Masmorra do templo (isolada no começo do mapa): colunas [TEMPLE_X0, TEMPLE_X1), 3 andares. */
export const TEMPLE_X0 = 4;
export const TEMPLE_X1 = 146;
export const TEMPLE_DOOR_IN: [number, number] = [261 + SHIFT, G - 4];
export const TEMPLE_DOOR_OUT: [number, number] = [274 + SHIFT, G - 1];

/** Poços do pântano (1 tile de fundo, areia movediça). */
const SWAMPS: [number, number][] = [
  [72 + SHIFT, 85 + SHIFT],
  [93 + SHIFT, 107 + SHIFT],
  [119 + SHIFT, 133 + SHIFT],
  [146 + SHIFT, 160 + SHIFT],
];

const inSwamp = (x: number) => SWAMPS.some(([a, b]) => x >= a - 1 && x < b + 1);
const inLake = (x: number) => x >= LAKE_X0 - 1 && x < LAKE_X1 + 1;
const inGorge = (x: number) => x >= GORGE_X0 - 1 && x < GORGE_X1 + 1;

/** Vegetação automática da selva (camadas de trás e da frente), com semente estável. */
function dressJungle(b: LevelBuilder, x0: number, x1: number, o: { seed: number; row?: number; dense?: number; temple?: boolean; camp?: boolean }) {
  const r = new Rng(o.seed * 7919 + x0);
  const row = o.row ?? G;
  const d = o.dense ?? 1;
  const free = (x: number) => !inSwamp(x) && !inLake(x) && !inGorge(x);
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
  // primeiro plano com paralaxe: galhos escuros no alto e folhagem no pé da tela (profundidade)
  for (let x = x0 + 9; x < x1 - 2; x += Math.round(r.range(26, 40) / d)) b.deco('pBranch', x, row - 12, 'front', { flip: r.chance(0.5), par: 0.3 });
  for (let x = x0 + 24; x < x1 - 2; x += Math.round(r.range(30, 46) / d)) if (free(x)) b.deco('pLeaves', x, row + 3, 'front', { flip: r.chance(0.5), par: 0.38 });
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
    // vida no pântano: sapos na margem e nas vitórias-régias, libélulas, borboletas
    b.deco('jFrog', x0 - 1, G, 'back', { flip: true });
    b.deco('jFrogLily', x0 + 3 + r.int(0, 3), G + 1, 'back', { flip: r.chance(0.5) });
    if (x1 - x0 > 12) b.deco('jFrogLily', x1 - 4 - r.int(0, 2), G + 1, 'back', { flip: r.chance(0.5) });
    b.deco('jFrog', x1, G, 'back');
    b.deco('jDragonfly', x0 + 3, G - 1, 'front');
    b.deco('jDragonfly', x1 - 4, G - 2, 'front');
    b.deco('jButterfly', x0 - 3, G - 1, 'back');
    b.deco('pReeds', x1 - 2, G + 3, 'front', { par: 0.4, flip: r.chance(0.5) });
  }
}

/**
 * MASMORRA DO TEMPLO: entra-se pela porta no topo da pirâmide (↑/↓) e sai-se pela porta do
 * primeiro degrau, logo ao lado — o jogador entende que explorou aquele lugar e segue em frente.
 * Fica isolada no começo do mapa (rocha maciça), em três andares em zigue-zague:
 *  1º (topo, →): estacas, caçadores de tesouro, cipós sobre espinhos, nicho alto do tesouro, sala do ídolo
 *  2º (meio, ←): labirinto de plataformas com atirador, grande poço de cipós, dois caminhos e uma
 *     parede rachada que esconde a câmara secreta
 *  3º (fundo, →): salão alto com corrente de cipós, passarela alta x chão com inimigos, saída
 */
function templeInterior(b: LevelBuilder) {
  b.setTheme(THEME.TEMPLE);
  const X0 = TEMPLE_X0;
  const X1 = TEMPLE_X1;
  // andares (o resto do bloco já é rocha)
  b.clear(X0, 4, X1 - X0, 10); // 1º: linhas 4..13, chão na 14
  b.clear(X0, 16, X1 - X0, 12); // 2º: linhas 16..27, chão na 28
  b.clear(X0, 30, X1 - X0, 15); // 3º: linhas 30..44, chão na 45
  b.clear(X1 - 8, 14, 6, 2); // buraco 1º → 2º (à direita)
  b.clear(X0 + 2, 28, 6, 2); // buraco 2º → 3º (à esquerda)
  b.room(X0 - 1, 3, X1 - X0 + 2, 43);
  b.camZone(X0 - 1, 3, X1 - X0 + 2, 43);
  // portas
  b.door(TEMPLE_DOOR_IN[0], TEMPLE_DOOR_IN[1], X0 + 4, 14, 'in');
  b.door(X1 - 5, 45, TEMPLE_DOOR_OUT[0], TEMPLE_DOOR_OUT[1], 'out');
  b.deco('jDoorExit', TEMPLE_DOOR_OUT[0], TEMPLE_DOOR_OUT[1], 'back', { scale: 1.3 });
  b.trigger('hint:door', TEMPLE_DOOR_IN[0] - 3, 0, 7, G);
  const torch = (x: number, row: number) => b.deco('jTorch', x, row, 'back');

  // ================= 1º ANDAR (→)
  b.deco('jDoorExit', X0 + 4, 14, 'back', { scale: 1.2 });
  torch(X0 + 1, 14);
  b.tokens(X0 + 6, 13, 4);
  // estacas com pedrinhas para pular
  b.spikes(14, 13, 7);
  b.plat(15, 11, 2);
  b.plat(18, 10, 2);
  b.tokens(15, 10, 2);
  b.tokens(18, 9, 2);
  b.enemy('rifle', 26, 14, { facing: -1, patrol: 40 });
  b.crate(30, 14, 'ammo');
  // cipós sobre espinhos (A)
  b.spikes(33, 13, 15);
  b.vine(37, 4, 5);
  b.vine(44, 4, 5);
  b.tokenArc(34, 10, 47, 10, 7);
  torch(49, 14);
  // nicho alto do tesouro
  b.plat(52, 11, 3);
  b.plat(56, 8, 3);
  b.block(59, 7, 5, 1);
  b.tokens(59, 6, 5);
  b.pickup('healthBig', 61, 5);
  b.crate(63, 7, 'random');
  // corredor de estacas
  b.spikes(66, 13, 3);
  b.spikes(72, 13, 3);
  b.spikes(78, 13, 3);
  b.tokenArc(65, 13, 69, 10, 4);
  b.tokenArc(71, 13, 75, 10, 4);
  b.tokenArc(77, 13, 81, 10, 4);
  b.enemy('shield', 86, 14, { facing: -1, patrol: 30 });
  b.enemy('rifle', 93, 14, { facing: -1, idle: true });
  torch(89, 14);
  b.deco('jTotem', 97, 14, 'back');
  // cipós sobre espinhos (B)
  b.spikes(102, 13, 18);
  b.vine(106, 4, 5);
  b.vine(115, 4, 5);
  b.tokenArc(103, 10, 119, 10, 8);
  // sala do ídolo
  torch(123, 14);
  b.deco('jIdol', 128, 14, 'back');
  b.tokens(124, 13, 8);
  b.crate(132, 14, 'ammo');
  torch(134, 14);
  b.deco('jSkull', X1 - 10, 14, 'back');

  // ================= 2º ANDAR (←)
  torch(X1 - 2, 28);
  // labirinto de plataformas com atirador
  b.plat(132, 25, 3);
  b.plat(127, 22, 3);
  b.plat(122, 19, 3);
  b.enemy('sniper', 123, 19, { facing: 1, idle: true });
  b.tokens(132, 24, 3);
  b.tokens(127, 21, 3);
  b.enemy('rifle', 128, 28, { facing: 1, patrol: 40 });
  // grande poço de cipós (C)
  b.spikes(97, 27, 21);
  b.vine(113, 16, 6);
  b.vine(104, 16, 6);
  b.tokenArc(117, 23, 97, 23, 9);
  // dois caminhos: passarela de pedra em cima, chão com estacas embaixo
  b.plat(92, 25, 3);
  b.block(78, 23, 10, 1);
  b.tokens(78, 22, 10);
  b.spikes(88, 27, 3);
  b.spikes(80, 27, 3);
  b.enemy('rifle', 84, 28, { facing: 1, patrol: 30 });
  torch(76, 28);
  // parede rachada: câmara secreta dentro da rocha
  b.fill(60, 22, 11, 6, 1, THEME.TEMPLE);
  b.clear(61, 24, 9, 4);
  b.clear(70, 25, 1, 3);
  b.prop('wall', 70, 28, { h: 96, secret: true, loot: 'none', hp: 55 });
  b.secretRoom('templo', 61, 24, 9, 4);
  b.plat(73, 25, 3);
  b.tokens(62, 27, 6);
  b.pickup('healthBig', 64, 26);
  b.crate(67, 28, 'random');
  b.deco('jIdol', 68, 28, 'back');
  // salão das colunas
  b.deco('jPillar', 55, 28, 'back');
  b.deco('jPillar', 43, 28, 'back');
  torch(50, 28);
  b.enemy('shotgun', 48, 28, { facing: 1, patrol: 40 });
  b.tokens(42, 27, 6);
  // cipós sobre espinhos (D)
  b.spikes(20, 27, 18);
  b.vine(33, 16, 6);
  b.vine(25, 16, 6);
  b.tokenArc(37, 23, 20, 23, 7);
  torch(14, 28);

  // primeiro plano com paralaxe: teias com aranhas nos cantos, raízes e colunas escuras
  for (const [x, row, flip] of [[10, 6, false], [58, 6, true], [100, 6, false], [140, 19, true], [90, 19, false], [40, 19, true], [8, 35, false], [76, 35, true], [130, 35, false]] as [number, number, boolean][]) {
    b.deco('pWeb', x, row, 'front', { flip, par: 0.32 });
  }
  for (const [x, row] of [[30, 6], [84, 6], [120, 19], [64, 19], [22, 35], [100, 35]] as [number, number][]) b.deco('pRoots', x, row, 'front', { par: 0.25 });
  for (const [x, row] of [[46, 14], [112, 14], [134, 28], [70, 28], [16, 28], [58, 45], [104, 45], [138, 45]] as [number, number][]) b.deco('pPillar', x, row + 1, 'front', { par: 0.42 });

  // ================= 3º ANDAR (→)
  torch(X0 + 1, 45);
  b.spikes(16, 44, 3);
  b.spikes(26, 44, 3);
  b.spikes(36, 44, 3);
  b.plat(16, 41, 3);
  b.plat(26, 41, 3);
  b.plat(36, 41, 3);
  b.tokens(16, 40, 3);
  b.tokens(26, 40, 3);
  b.tokens(36, 40, 3);
  b.crate(31, 45, 'health');
  // salão alto: corrente de cipós
  b.spikes(44, 44, 27);
  b.vine(49, 30, 10);
  b.vine(58, 30, 10);
  b.vine(66, 30, 10);
  b.tokenArc(45, 40, 70, 40, 10);
  torch(72, 45);
  // passarela alta x chão com os caçadores de tesouro
  b.plat(76, 41, 4);
  b.plat(82, 38, 4);
  b.block(88, 36, 12, 1);
  b.tokens(88, 35, 12);
  b.enemy('rifle', 80, 45, { facing: -1, patrol: 40 });
  b.enemy('shotgun', 89, 45, { facing: -1, patrol: 40 });
  b.enemy('shield', 97, 45, { facing: -1, patrol: 30 });
  b.crate(85, 45, 'health');
  b.crate(93, 45, 'random');
  // ---- SALA DO RITMO (secreta): no alto do grande salão, atrás de uma parede rachada
  b.fill(106, 29, 26, 11, 1, THEME.TEMPLE);
  b.clear(107, 30, 24, 9); // linhas 30..38, chão na 39
  b.clear(106, 36, 1, 3);
  b.prop('wall', 106, 39, { h: 96, secret: true, loot: 'none', hp: 55 });
  b.secretRoom('ritmo', 107, 30, 24, 9);
  // a câmera enquadra a sala inteira (tambores + notas) enquanto se está nela
  b.camZones.unshift({ rect: { x: 106 * TILE, y: 29 * TILE, w: 26 * TILE, h: 11 * TILE } });
  b.plat(100, 42, 2);
  b.block(103, 39, 3, 1);
  b.deco('jSkull', 104, 39, 'back');
  for (const [x, w] of [[109, 2], [114, 2], [119, 2], [124, 2], [128, 2]] as [number, number][]) b.drum(x, 37, w);
  // as notas: arcos que os quiques naturalmente atravessam
  const notes: [number, number][] = [[110, 33], [111, 31], [113, 32], [115, 33], [116, 31], [118, 32], [120, 33], [121, 31], [123, 32], [125, 33], [126, 31], [127, 32], [129, 33], [129, 31]];
  for (const [x, row] of notes) b.pickup('note', x, row);
  torch(108, 39);
  torch(130, 39);

  // grande salão do ídolo
  b.deco('jPillar', 106, 45, 'back');
  b.deco('jPillar', 126, 45, 'back');
  torch(110, 45);
  torch(122, 45);
  b.deco('jIdol', 116, 45, 'back');
  b.tokens(108, 44, 16);
  b.pickup('healthBig', 116, 43);
  // saída
  torch(X1 - 8, 45);
  b.deco('jDoorExit', X1 - 5, 45, 'back', { scale: 1.3 });
  torch(X1 - 2, 45);
}

export function buildJungle(): LevelData {
  const b = new LevelBuilder(JUNGLE_W, LEVEL_H);
  b.stage = 2;
  b.setTheme(THEME.EARTH);
  b.ground(0, JUNGLE_W);
  // o começo do mapa é rocha maciça: lá dentro fica a masmorra do templo (só se chega pelas portas)
  b.fill(0, 0, SHIFT, LEVEL_H, 1, THEME.TEMPLE);
  // a câmera nunca mostra a rocha da masmorra quando se está do lado de fora
  b.camZone(SHIFT, 0, JUNGLE_W - SHIFT, LEVEL_H);

  // ================================================================ A — ORLA DA SELVA (0–64)
  b.playerStart = { x: b.px(154), y: b.py(G) };
  b.nomadSpawn = { x: -99999, y: 0 }; // sem Nômad na selva
  b.section('Orla da selva', 154, G);
  b.atmos(150, 0, 0.1);
  b.trigger('hint:move', 155, 0, 3, LEVEL_H);
  b.trigger('hint:shoot', 172, 0, 3, LEVEL_H);
  b.trigger('hint:jump', 188, 0, 3, LEVEL_H);
  b.deco('jSign', 160, G, 'back');
  b.tokens(162, G - 1, 6);
  // montinho de terra com raízes e troncos caídos
  b.block(168, G - 1, 6, 1);
  b.plat(178, G - 3, 4, THEME.WOOD);
  b.plat(184, G - 5, 4, THEME.WOOD);
  b.tokens(184, G - 6, 4);
  b.enemy('rifle', 181, G, { idle: true, facing: -1 });
  b.crate(194, G, 'ammo');
  b.block(198, G - 1, 4, 1);
  b.enemy('rifle', 206, G, { patrol: 50, facing: -1 });
  b.crate(210, G, 'random');
  b.checkpoint('Orla da selva', 214, G);
  dressJungle(b, 150, 220, { seed: 1, dense: 1.1 });

  // ================================================================ B — PÂNTANO (64–176)
  b.section('Pântano', 216, G);
  b.atmos(220, 0.04, 0.55);
  swamps(b);
  // troncos boiando sobre o pântano
  b.plat(226, G - 2, 4, THEME.WOOD);
  // ponte de corda atravessando o pântano
  b.plat(267, G - 2, 18, THEME.WOOD);
  b.deco('jPost', 267, G - 2, 'back');
  b.deco('jPost', 284, G - 2, 'back', { flip: true });
  b.plat(301, G - 2, 4, THEME.WOOD);
  // palafita (casa de bandido sobre estacas)
  b.plat(247, G - 3, 8, THEME.WOOD);
  b.plat(249, G - 6, 4, THEME.WOOD);
  b.deco('jHut', 251, G - 3, 'back');
  b.enemy('sniper', 251, G - 6, { facing: -1, idle: true });
  b.enemy('rifle', 238, G, { facing: -1, patrol: 40 });
  b.enemy('shotgun', 262, G, { facing: -1, patrol: 50 });
  b.crate(260, G, 'health');
  b.checkpoint('Pântano', 263, G);
  b.enemy('rifle', 289, G, { facing: -1, patrol: 60 });
  b.enemy('shotgun', 316, G, { facing: -1, idle: true });
  b.crate(313, G, 'random');
  b.tokenArc(234, G - 1, 242, G - 4, 6);
  b.tokenArc(282, G - 1, 295, G - 4, 8);
  b.tokens(302, G - 3, 3);
  dressJungle(b, 214, 326, { seed: 2, dense: 1.2 });

  // ================================================================ V — DESFILADEIRO DOS CIPÓS (176–236)
  b.section('Desfiladeiro', 328, G);
  b.atmos(330, 0.03, 0.5);
  b.checkpoint('Desfiladeiro', 327, G);
  b.trigger('hint:swing', 326, 0, 4, LEVEL_H);
  b.deco('jSign', 329, G, 'back');
  b.pit(GORGE_X0, GORGE_X1);
  // pilastra de pedra no meio (descanso entre os balanços)
  b.fill(GORGE_ISLAND[0], G - 1, GORGE_ISLAND[1] - GORGE_ISLAND[0], LEVEL_H - G + 1, 1, THEME.TEMPLE);
  b.deco('jTotem', 354, G - 1, 'back');
  b.tokens(352, G - 2, 4);
  // cipós presos nos galhos de árvores gigantes (balance, solte no alto e agarre o próximo)
  // (mais espaçados: as orelhas ajudam entre um e outro; todos pendem dos galhões das árvores da borda)
  for (const [x, len] of [[185, 8], [194, 8], [213, 8], [222, 8]].map(([x, l]) => [x + SHIFT, l]) as [number, number][]) b.vine(x, G - 12, len);
  b.tokenArc(331, G - 4, 339, G - 6, 5);
  b.tokenArc(341, G - 5, 351, G - 3, 5);
  b.tokenArc(357, G - 3, 366, G - 6, 5);
  b.tokenArc(368, G - 6, 378, G - 3, 5);
  // árvores gigantes nas duas bordas (de onde saem os galhos)
  b.deco('jTree', 329, G, 'back');
  b.deco('jTree', 381, G, 'back', { flip: true });
  b.deco('jButterfly', 354, G - 4, 'front');
  b.deco('jButterfly', 338, G - 6, 'back');
  b.checkpoint('Depois dos cipós', 381, G);
  b.enemy('rifle', 384, G, { facing: -1, idle: true });
  dressJungle(b, 326, 386, { seed: 9, dense: 0.9 });

  // ================================================================ C — RUÍNAS DO TEMPLO (236–312)
  b.setTheme(THEME.TEMPLE);
  b.section('Templo esquecido', 388, G);
  b.atmos(390, 0.02, 0.2);
  b.ground(386, 462, G, THEME.TEMPLE);
  b.checkpoint('Templo esquecido', 390, G);
  // pirâmide em degraus
  b.block(396, G - 1, 30, 1);
  b.block(399, G - 2, 24, 1);
  b.block(402, G - 3, 18, 1);
  b.block(406, G - 4, 10, 1);
  b.deco('jTempleBack', 411, G, 'back');
  b.deco('jDoorway', TEMPLE_DOOR_IN[0], TEMPLE_DOOR_IN[1], 'back', { scale: 1.35 });
  b.deco('jTorch', 407, G - 4, 'back');
  b.deco('jTorch', 415, G - 4, 'back');
  b.enemy('rifle', 414, G - 4, { facing: -1, idle: true });
  b.tokens(407, G - 5, 3);
  b.tokens(413, G - 5, 3);
  templeInterior(b);
  b.crate(424, G - 1, 'health');
  // armadilha de estacas dos bandidos
  b.spikes(432, G - 1, 3, THEME.WOOD);
  b.deco('jSkull', 430, G, 'back');
  b.tokenArc(430, G - 1, 436, G - 4, 6);
  // andaime de madeira sobre as ruínas
  b.plat(440, G - 3, 5, THEME.WOOD);
  b.plat(446, G - 5, 4, THEME.WOOD);
  b.enemy('shield', 444, G, { facing: -1, patrol: 40 });
  b.enemy('rifle', 448, G - 5, { facing: -1, idle: true });
  b.deco('jStoneHead', 450, G, 'back');
  // abismo com ponte de corda
  b.pit(454, 460);
  b.plat(453, G, 8, THEME.WOOD);
  b.deco('jPost', 453, G, 'back');
  b.deco('jPost', 460, G, 'back', { flip: true });
  b.deco('jTorch', 462, G, 'back');
  dressJungle(b, 386, 462, { seed: 3, temple: true });

  // ================================================================ D — CACHOEIRA E LAGO (312–412)
  b.setTheme(THEME.EARTH);
  b.section('Cachoeira', 464, G);
  b.atmos(466, 0.03, 0.3);
  b.checkpoint('Beira do lago', 465, G);
  b.deco('jSign', 470, G, 'back', { flip: true });
  // o lago: buraco largo e fundo com piso de lama/pedra
  b.pit(LAKE_X0, LAKE_X1, G);
  b.fill(LAKE_X0, LAKE_FLOOR, LAKE_X1 - LAKE_X0, LEVEL_H - LAKE_FLOOR, 1, THEME.MUD);
  b.waterZone('lake', LAKE_X0, LAKE_X1, LAKE_TOP, LAKE_FLOOR, 0);
  b.trigger('hint:swim', LAKE_X0, LAKE_TOP, LAKE_X1 - LAKE_X0, LAKE_FLOOR - LAKE_TOP);
  // paredão de pedra da esquerda (de onde cai a cachoeira)
  b.fill(LAKE_X0, G, 2, LAKE_TOP - G + 2, 1, THEME.TEMPLE);
  b.deco('jFall', LAKE_X0 + 6, LAKE_TOP, 'back');
  // relevo submerso: pedras, colunas tombadas do templo, uma arcada afundada
  b.block(482, LAKE_FLOOR - 2, 4, 2, THEME.TEMPLE);
  b.block(489, LAKE_FLOOR - 1, 3, 1, THEME.MUD);
  b.block(497, LAKE_FLOOR - 5, 2, 5, THEME.TEMPLE);
  b.block(507, LAKE_FLOOR - 3, 6, 3, THEME.TEMPLE);
  b.block(509, LAKE_FLOOR - 4, 2, 1, THEME.TEMPLE);
  b.block(519, LAKE_FLOOR - 6, 2, 6, THEME.TEMPLE);
  b.block(525, LAKE_FLOOR - 2, 5, 2, THEME.MUD);
  // rampa de saída à direita (pedras subindo até a margem)
  b.block(536, LAKE_FLOOR - 2, 14, 2, THEME.TEMPLE);
  b.block(540, LAKE_FLOOR - 5, 10, 3, THEME.TEMPLE);
  b.block(544, LAKE_FLOOR - 8, 6, 3, THEME.TEMPLE);
  // decoração submersa (algas, corais de água doce, ruínas, baú, ossada)
  const r = new Rng(77);
  for (let x = LAKE_X0 + 3; x < LAKE_X1 - 14; x += r.int(2, 4)) {
    let top = LAKE_FLOOR;
    while (top > LAKE_TOP && b.level.isSolid(x, top - 1)) top--;
    b.deco(r.pick(['uKelp', 'uKelp', 'uKelp', 'uGrass', 'uRock', 'uGrass', 'uKelp']), x, top, 'back', { flip: r.chance(0.5) });
  }
  // algas gigantes desfocadas passando na frente da câmera
  for (const x of [LAKE_X0 + 8, LAKE_X0 + 30, LAKE_X0 + 52, LAKE_X0 + 70]) b.deco('puKelp', x, LAKE_FLOOR + 3, 'front', { par: 0.42, flip: x % 2 === 0 });
  b.deco('uArch', 503, LAKE_FLOOR, 'back');
  b.deco('uChest', 515, LAKE_FLOOR, 'back');
  b.deco('uBones', 493, LAKE_FLOOR, 'back');
  b.deco('uStatue', 531, LAKE_FLOOR - 2, 'back');
  b.deco('uVent', 487, LAKE_FLOOR, 'back');
  b.deco('uVent', 523, LAKE_FLOOR - 2, 'back');
  // moedas mostrando o caminho do mergulho
  b.tokenArc(LAKE_X0 + 3, LAKE_TOP + 1, LAKE_X0 + 14, LAKE_FLOOR - 4, 7);
  b.tokens(500, LAKE_FLOOR - 7, 5);
  b.tokens(514, LAKE_FLOOR - 6, 4);
  b.tokens(528, LAKE_FLOOR - 4, 5);
  b.pickup('health', 515, LAKE_FLOOR - 1);
  // margem direita
  b.section('Margem', 554, G);
  b.checkpoint('Margem', 555, G);
  b.enemy('rifle', 560, G, { facing: -1, idle: true });
  dressJungle(b, 462, 474, { seed: 4 });
  dressJungle(b, 550, 570, { seed: 5 });

  // ================================================================ E — ACAMPAMENTO DOS MERCENÁRIOS (420–536)
  b.section('Acampamento', 572, G);
  b.atmos(570, 0.06, 0.15);
  b.atmos(680, 0.14, 0.1);
  // torre de vigia
  b.plat(578, G - 3, 5, THEME.WOOD);
  b.plat(579, G - 6, 3, THEME.WOOD);
  b.deco('jTower', 580, G, 'back');
  b.enemy('sniper', 580, G - 6, { facing: -1, idle: true });
  b.deco('jPalisade', 574, G, 'back');
  b.deco('jPalisade', 588, G, 'back', { flip: true });
  b.deco('jTent', 594, G, 'back');
  b.deco('jCampfire', 599, G, 'back');
  b.deco('jJeep', 567, G, 'back');
  b.deco('jSandbags', 585, G, 'back');
  b.deco('jFlag', 602, G, 'back');
  b.prop('barrel', 590, G, { explosive: true });
  b.crate(596, G, 'random');
  // arena: o esconderijo
  b.arena({
    id: 'camp', x0: 604, x1: 652, top: G - 11, bottom: G + 1, trigger: 608, banner: 'ESCONDERIJO DOS BANDIDOS',
    waves: [
      { delay: 0.6, e: [['rifle', 650, G, { fromSide: 1 }], ['rifle', 606, G, { fromSide: -1 }], ['shotgun', 648, G, { fromSide: 1 }]] },
      { delay: 1.2, e: [['shield', 650, G, { fromSide: 1 }], ['rifle', 607, G, { fromSide: -1 }], ['rifle', 626, G - 4], ['sniper', 640, G - 4]] },
      { delay: 1.2, e: [['shotgun', 606, G, { fromSide: -1 }], ['shotgun', 650, G, { fromSide: 1 }], ['shield', 649, G, { fromSide: 1 }], ['rifle', 628, G - 4]] },
    ],
  });
  b.plat(622, G - 4, 8, THEME.WOOD);
  b.plat(638, G - 4, 5, THEME.WOOD);
  b.deco('jTent', 614, G, 'back', { flip: true });
  b.deco('jCampfire', 632, G, 'back');
  b.deco('jTent', 644, G, 'back');
  b.deco('jAmmo', 620, G, 'back');
  b.deco('jSandbags', 637, G, 'back');
  b.deco('jAmmo', 650, G, 'back');
  b.deco('jFlag', 655, G, 'back', { flip: true });
  b.deco('jPalisade', 656, G, 'back');
  b.crate(618, G, 'health');
  b.crate(635, G, 'ammo');
  b.prop('barrel', 625, G, { explosive: true });
  b.checkpoint('Saída do acampamento', 658, G);
  b.deco('jGate', 672, G, 'back');
  b.deco('jTorch', 668, G, 'back');
  b.deco('jTorch', 676, G, 'back');
  b.tokens(660, G - 1, 8);
  b.finishX = 672 * TILE;
  dressJungle(b, 570, JUNGLE_W - 2, { seed: 6, camp: true, dense: 0.9 });

  b.atmosphere.sort((a, c) => a.x - c.x);
  return b.build('none');
}
