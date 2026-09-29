import { THEME } from '../level';
import { G, type LevelBuilder } from './builder';

/** SEÇÃO 5 — GRANDE COMBATE (420–520): primeira arena com ondas. */
export function section5(b: LevelBuilder) {
  b.setTheme(THEME.STEEL);
  b.section('Grande combate', 424, G);
  b.atmos(420, 0.3, 0.1);
  b.ground(420, 520);
  b.dress(420, 520, G, { seed: 5 });
  // suprimentos antes da arena
  b.crate(424, G, 'shotgun');
  b.crate(426, G, 'ammo');
  b.pickup('health', 428, G - 1);
  // hangar da arena (teto, para as torretas de teto)
  b.block(430, 16, 40, 3);
  b.plat(436, 28, 6);
  b.plat(458, 28, 6);
  b.plat(446, 24, 8);
  b.prop('container', 448, G);
  b.crate(440, G, 'random');
  b.prop('barricade', 441, G);
  b.prop('barricade', 458, G);
  b.crate(462, G, 'random', true);
  b.tokens(437, 27, 4);
  b.tokens(459, 27, 4);
  b.tokens(448, 23, 4);
  b.enemy('turret', 438, 19, { ceiling: true });
  b.enemy('turret', 462, 19, { ceiling: true });
  b.arena({
    id: 'a1', x0: 430, x1: 470, top: 14, bottom: 36, trigger: 434, banner: 'EMBOSCADA!',
    waves: [
      { delay: 0.8, e: [['rifle', 434, G, { fromSide: -1 }], ['rifle', 466, G, { fromSide: 1 }], ['rifle', 436, G, { fromSide: -1 }], ['shotgun', 464, G, { fromSide: 1 }]] },
      { delay: 1.6, e: [['shield', 434, G, { fromSide: -1 }], ['shield', 466, G, { fromSide: 1 }], ['rifle', 450, G, { drop: true }], ['drone', 444, 22, { drop: true }], ['drone', 456, 22, { drop: true }]] },
      { delay: 2.0, e: [['jetpack', 442, 20, { drop: true }], ['jetpack', 458, 20, { drop: true }], ['spider', 434, G, { fromSide: -1 }], ['spider', 466, G, { fromSide: 1 }], ['sniper', 450, 24, {}], ['shotgun', 436, G, { fromSide: -1 }]] },
    ],
  });
  // depois da arena
  b.crate(478, G, 'health');
  b.crate(484, G, 'ammo');
  b.tokens(474, G - 1, 8);
  b.checkpoint('Depois da emboscada', 476, G);
  b.enemy('rifle', 500, G, { patrol: 30, facing: -1 });
  b.enemy('rifle', 508, G, { patrol: 30 });
  b.pickup('nade', 512, G - 1);
}

/** SEÇÃO 6 — ENCONTRO COM O NÔMAD (520–600): garagem, cinemática. */
export function section6(b: LevelBuilder) {
  b.setTheme(THEME.HANGAR);
  b.section('Encontro com o Nômad', 528, G);
  b.atmos(520, 0.4, 0.05);
  b.ground(520, 600);
  // garagem: teto alto (8 linhas), colunas laterais
  b.block(526, 16, 62, 8);
  b.clear(526, 24, 62, 8); // interior livre
  b.plat(530, 28, 4);
  b.plat(578, 28, 4);
  b.crate(532, 28, 'health');
  b.crate(580, 28, 'ammo');
  b.tokens(568, G - 1, 6);
  b.deco('spotlight', 552, 24);
  b.deco('spotlight', 566, 24);
  b.deco('pipes', 536, G);
  b.deco('pipes', 580, G);
  b.deco('steam', 548, G);
  b.deco('hologram', 572, G);
  b.deco('banner', 588, G);
  b.deco('fireBarrel', 585, G);
  b.deco('neonSign', 560, G - 7);
  b.dress(586, 600, G, { seed: 6 });
  b.nomadSpawn = { x: b.px(560), y: b.py(G) };
  b.trigger('nomadMeet', 540, 0, 3, 46);
  b.checkpoint('Garagem do Nômad', 556, G);
  b.crate(600 - 3, G, 'random');
}

/** SEÇÃO 7 — POWER TRIP (600–700): hordas e destruição com o Nômad. */
export function section7(b: LevelBuilder) {
  b.setTheme(THEME.STREET);
  b.section('Power trip', 602, G);
  b.atmos(600, 0.45, 0.1);
  b.ground(600, 700);
  b.dress(600, 700, G, { seed: 7 });
  b.trigger('hint:nomad', 601, 0, 3, 46);

  // A — pelotão de infantaria
  b.prop('barricade', 608, G);
  b.prop('barricade', 612, G);
  b.enemy('rifle', 610, G, { facing: -1 });
  b.enemy('rifle', 614, G, { patrol: 20, facing: -1 });
  b.enemy('rifle', 618, G, { patrol: 30 });
  b.enemy('shotgun', 616, G, { patrol: 40 });
  b.enemy('shotgun', 621, G, { patrol: 30, facing: -1 });
  b.prop('crateBig', 624, G, { loot: 'random' });
  b.tokens(604, G - 1, 5);
  // B — blindados e aranhas
  b.prop('vehicle', 632, G);
  b.enemy('rifle', 637, G, { facing: -1 });
  b.enemy('rifle', 640, G, { facing: -1 });
  b.enemy('shield', 644, G, {});
  b.enemy('shield', 647, G, {});
  b.enemy('turret', 650, G, { facing: -1 });
  b.enemy('spider', 655, G, {});
  b.enemy('spider', 658, G, {});
  b.prop('barrel', 641, G);
  b.prop('barrel', 653, G);
  // bolsão com parede reforçada (só o AVANÇO do Nômad quebra): emblema 4
  b.pocket(662, { id: 'secret4', w: 8, chamberW: 10, dashOnly: true });
  b.emblem(4, 672, 35);
  b.tokens(672, 35, 4, 1);
  b.pickup('repair', 676, 35);
  // C — coluna blindada
  b.prop('container', 682, G);
  b.prop('vehicle', 688, G);
  b.enemy('minimech', 685, G, {});
  b.enemy('heavy', 694, G, { facing: -1 });
  b.enemy('rifle', 691, G, { facing: -1 });
  b.enemy('drone', 680, G - 5, { patrol: 60 });
  b.enemy('drone', 690, G - 6, { patrol: 60 });
  b.enemy('drone', 698, G - 5, { patrol: 40 });
  b.crate(696, G, 'health');
  b.pickup('repair', 698, G - 1);
}

/** SEÇÃO 8 — AVANÇO (700–790): a técnica do Nômad, sem tutorial explícito do segundo avanço. */
export function section8(b: LevelBuilder) {
  b.setTheme(THEME.STEEL);
  b.section('Avanço', 702, G);
  b.atmos(700, 0.5, 0.15);
  b.ground(700, 740);
  b.dress(700, 790, G, { seed: 8 });
  b.trigger('hint:dash', 705, 0, 3, 46);
  b.deco('arrow', 703, G);
  // corredor de escudos: quanto mais rápido o avanço, melhor
  b.enemy('shield', 710, G, { facing: -1 });
  b.enemy('shield', 714, G, { facing: -1 });
  b.enemy('shield', 718, G, { facing: -1 });
  b.enemy('shield', 722, G, { facing: -1 });
  b.plat(724, 30, 9);
  b.enemy('rifle', 726, 30, { facing: -1, idle: true });
  b.enemy('rifle', 730, 30, { facing: -1, idle: true });
  b.enemy('shotgun', 728, G, { patrol: 20, facing: -1 });
  b.enemy('turret', 733, G, { facing: -1 });
  b.enemy('minimech', 736, G, { facing: -1 });
  b.prop('barricade', 719, G, { loot: 'ammo' });
  b.crate(738, G, 'health');
  b.crate(716, G, 'ammo');
  // abismo (8 tiles): Nômad atravessa com salto + avanço; Karimbo, planando
  b.pit(740, 748);
  b.tokenArc(739, G - 2, 749, G - 6, 8);
  b.ground(748, 790);
  b.pickup('repair', 752, G - 1);
  b.pickup('health', 754, G - 1);
  b.enemy('rifle', 760, G, { patrol: 30, facing: -1 });
  b.enemy('jetpack', 768, G - 5, {});
  b.enemy('drone', 772, G - 6, { patrol: 60 });
  b.plat(776, 27, 6);
  b.enemy('sniper', 780, 27, { facing: -1 });
  b.crate(783, G, 'random');
  b.checkpoint('Depois do abismo', 786, G);
}

/** SEÇÃO 9 — EXPLORAÇÃO COM O NÔMAD (790–900): duas rotas, segredos, ninho de sniper. */
export function section9(b: LevelBuilder) {
  b.setTheme(THEME.RUINS);
  b.section('Exploração', 792, G);
  b.atmos(790, 0.55, 0.7);
  b.ground(790, 900);
  b.dress(790, 900, G, { seed: 9, ruin: true });

  // rota alta (plataformas): recompensa = emblema 5
  b.plat(800, 30, 8);
  b.plat(810, 28, 8);
  b.plat(820, 26, 8);
  b.plat(830, 24, 10);
  b.enemy('jetpack', 812, 22, {});
  b.enemy('rifle', 822, 26, { patrol: 30 });
  b.enemy('sniper', 838, 24, { facing: -1 });
  b.tokens(802, 29, 5);
  b.tokens(812, 27, 5);
  b.tokens(822, 25, 5);
  b.emblem(5, 840, 23);
  b.crate(834, 24, 'health');
  // rua
  b.enemy('rifle', 800, G, { patrol: 40 });
  b.enemy('shotgun', 806, G, { patrol: 30, facing: -1 });
  b.enemy('spider', 815, G, {});
  b.enemy('spider', 818, G, {});
  b.prop('vehicle', 826, G);
  b.enemy('rifle', 832, G, { facing: -1 });
  b.enemy('drone', 828, G - 6, { patrol: 100 });
  b.enemy('drone', 840, G - 7, { patrol: 100 });
  b.enemy('minimech', 846, G, { facing: -1 });
  b.prop('barrel', 850, G);
  // bolsão reforçado #2: emblema 6
  b.pocket(858, { id: 'secret6', w: 8, chamberW: 10, dashOnly: true });
  b.emblem(6, 868, 35);
  b.tokens(868, 35, 5, 1);
  b.pickup('health', 874, 35);
  b.enemy('jetpack', 880, G - 5, {});
  b.enemy('rifle', 886, G, { patrol: 30, facing: -1 });
  b.enemy('shield', 892, G, {});
  b.crate(884, G, 'ammo');
  b.crate(896, G, 'health');
  b.checkpoint('Ruínas verdes', 897, G);
}
