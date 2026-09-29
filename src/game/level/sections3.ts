import { THEME } from '../level';
import { G, type LevelBuilder } from './builder';

/** SEÇÃO 10 — ÁREA DE GUERRA (900–1040): a grande batalha (arena larga, 3 ondas). */
export function section10(b: LevelBuilder) {
  b.setTheme(THEME.RUINS);
  b.section('Área de guerra', 904, G);
  b.atmos(900, 0.65, 0.5);
  b.ground(900, 1040);
  b.dress(900, 1040, G, { seed: 10, ruin: true });
  b.crate(904, G, 'health');
  b.crate(906, G, 'ammo');
  b.pickup('repair', 908, G - 1);
  // cenário destrutível
  b.prop('container', 922, G);
  b.prop('vehicle', 940, G);
  b.prop('container', 958, G);
  b.prop('vehicle', 966, G);
  for (const x of [916, 930, 934, 946, 952, 962]) b.prop('barricade', x, G);
  for (const x of [919, 937, 949, 955]) b.crate(x, G, 'random');
  b.prop('generator', 944, G);
  b.prop('barrel', 927, G);
  b.prop('barrel', 928, G);
  b.prop('barrel', 972, G);
  // plataformas
  b.plat(918, 28, 8);
  b.plat(938, 28, 8);
  b.plat(958, 28, 8);
  b.plat(928, 24, 8);
  b.plat(948, 24, 8);
  b.plat(942, 22, 3);
  b.plat(936, 20, 4);
  b.emblem(7, 938, 19);
  b.tokens(919, 27, 6);
  b.tokens(959, 27, 6);
  b.tokens(929, 23, 6);
  b.tokens(949, 23, 6);
  b.enemy('turret', 913, G, { facing: 1 });
  b.enemy('turret', 985, G, { facing: -1 });
  b.arena({
    id: 'a2', x0: 910, x1: 992, top: 12, bottom: 38, trigger: 914, banner: 'ÁREA DE GUERRA',
    waves: [
      { delay: 1.0, e: [['rifle', 914, G, { fromSide: -1 }], ['rifle', 988, G, { fromSide: 1 }], ['rifle', 916, G, { fromSide: -1 }], ['rifle', 986, G, { fromSide: 1 }], ['jetpack', 940, 18, { drop: true }], ['jetpack', 960, 18, { drop: true }], ['minimech', 988, G, { fromSide: 1 }]] },
      { delay: 2.5, e: [['shotgun', 914, G, { fromSide: -1 }], ['shotgun', 988, G, { fromSide: 1 }], ['shotgun', 916, G, { fromSide: -1 }], ['drone', 930, 20, { drop: true }], ['drone', 950, 20, { drop: true }], ['drone', 970, 20, { drop: true }], ['heavy', 986, G, { fromSide: 1 }]] },
      { delay: 3.0, e: [['minimech', 914, G, { fromSide: -1 }], ['minimech', 988, G, { fromSide: 1 }], ['spider', 916, G, { fromSide: -1 }], ['spider', 986, G, { fromSide: 1 }], ['spider', 918, G, { fromSide: -1 }], ['spider', 984, G, { fromSide: 1 }], ['sniper', 932, 24, {}], ['sniper', 952, 24, {}], ['shield', 914, G, { fromSide: -1 }], ['shield', 988, G, { fromSide: 1 }]] },
    ],
  });
  b.checkpoint('Depois da guerra', 1000, G);
  b.crate(1004, G, 'health');
  b.crate(1006, G, 'ammo');
  b.pickup('repair', 1008, G - 1);
  b.tokens(996, G - 1, 10);
  b.enemy('rifle', 1020, G, { patrol: 30, facing: -1 });
  b.enemy('drone', 1026, G - 6, { patrol: 60 });
  b.enemy('rifle', 1030, G, { patrol: 30 });
}

/** SEÇÃO 11 — PERDA/SAÍDA DO NÔMAD (1040–1100): a passagem estreita. */
export function section11(b: LevelBuilder) {
  b.setTheme(THEME.STEEL);
  b.section('Passagem estreita', 1044, G);
  b.atmos(1040, 0.75, 0.3);
  b.ground(1040, 1106);
  b.dress(1040, 1106, G, { seed: 11 });
  b.trigger('dismount', 1046, 0, 3, 46);
  b.trigger('hint:crouch', 1049, 0, 3, 46);
  // túnel de engatinhar: só 1 tile de altura (o Nômad não passa)
  b.block(1052, 20, 16, 11); // teto: linhas 20..30 → vão livre na linha 31
  b.clear(1052, 31, 16, 1);
  b.deco('arrow', 1050, G);
  b.deco('pipes', 1058, 31);
  b.tokens(1054, 31, 12);
  b.enemy('drone', 1071, G - 5, { patrol: 40 });
  b.crate(1072, G, 'health');
  b.crate(1074, G, 'ammo');
  b.enemy('rifle', 1080, G, { patrol: 30 });
  b.enemy('shield', 1088, G, {});
  b.enemy('rifle', 1094, G, { facing: -1 });
  b.checkpoint('Base da torre', 1100, G);
}

/** SEÇÃO 12 — SUBIDA FINAL (1106–1180): torre com plataformas, planeios e segredos. */
export function section12(b: LevelBuilder) {
  b.setTheme(THEME.STEEL);
  b.section('Subida final', 1108, G);
  b.atmos(1106, 0.85, 0.15);
  // chão de segurança (catch floor) e rampa de volta
  b.ground(1106, 1176, 38);
  b.plat(1106, 36, 3);
  b.plat(1106, 34, 2);
  b.emblem(9, 1140, 37); // presente para quem cai: emblema no chão de segurança
  b.tokens(1130, 37, 5);
  b.tokens(1146, 37, 5);
  b.prop('barricade', 1122, 38);
  b.crate(1150, 38, 'health');
  b.enemy('spider', 1112, 38, {});
  // escalada: degraus de 2 linhas
  b.plat(1108, 30, 4);
  b.plat(1114, 28, 4);
  b.plat(1120, 26, 4);
  b.plat(1126, 24, 4);
  b.plat(1132, 22, 4);
  b.tokens(1109, 29, 3);
  b.tokens(1115, 27, 3);
  b.tokens(1121, 25, 3);
  b.tokens(1127, 23, 3);
  b.enemy('jetpack', 1118, 22, {});
  b.enemy('rifle', 1128, 24, { patrol: 30 });
  b.enemy('drone', 1124, 20, { patrol: 60 });
  // planeio até a ilha B
  b.ledge(1146, 22, 10, 2);
  b.tokenArc(1137, 21, 1145, 15, 7);
  b.enemy('shield', 1149, 22, {});
  b.enemy('shield', 1153, 22, { facing: -1 });
  b.enemy('turret', 1155, 22, { facing: -1 });
  b.crate(1147, 22, 'ammo');
  b.checkpoint('Meio da subida', 1147, 22);
  // subida final até o telhado
  b.plat(1158, 20, 4);
  b.plat(1164, 18, 4);
  b.plat(1170, 16, 4);
  b.enemy('sniper', 1160, 20, { facing: -1 });
  b.enemy('jetpack', 1166, 14, {});
  b.enemy('rifle', 1171, 16, { facing: -1 });
  b.tokens(1159, 19, 3);
  b.tokens(1165, 17, 3);
  // emblema 8: pequena rota lateral a partir da ilha B
  b.plat(1149, 20, 3);
  b.plat(1153, 18, 3);
  b.emblem(8, 1154, 17);
  // K1 — ORELHA DOURADA: ilha à esquerda da torre, só planando a partir do último degrau
  b.plat(1117, 22, 5);
  b.secret(1, 1119, 21);
  b.tokens(1123, 21, 4, 1);
}

/** SEÇÃO 13 — PREPARAÇÃO DO CHEFE (1176–1292): telhado, suprimentos, atmosfera. */
export function section13(b: LevelBuilder) {
  b.setTheme(THEME.HANGAR);
  b.section('Telhado', 1178, 14);
  b.atmos(1176, 1.0, 0);
  b.ground(1176, 1296, 14);
  b.dress(1176, 1296, 14, { seed: 13, noFacade: true });
  for (let x = 1184; x < 1290; x += 16) b.deco('spotlight', x, 14);
  b.deco('hologram', 1192, 14);
  b.deco('hologram', 1266, 14);
  b.deco('banner', 1204, 14);
  b.deco('banner', 1250, 14);
  b.deco('antenna', 1198, 14);
  b.deco('antenna', 1262, 14);
  b.checkpoint('Telhado', 1182, 14);
  // suprimentos generosos
  b.crate(1190, 14, 'ammo');
  b.crate(1192, 14, 'health');
  b.crate(1200, 14, 'energy');
  b.crate(1208, 14, 'ammo');
  b.crate(1216, 14, 'nade');
  b.crate(1224, 14, 'health');
  b.crate(1232, 14, 'launcher');
  b.crate(1270, 14, 'ammo');
  b.crate(1272, 14, 'health');
  b.crate(1274, 14, 'nade');
  b.tokens(1186, 13, 10);
  b.tokens(1212, 13, 8);
  b.tokens(1240, 13, 10);
  // guarda de honra (poucos, para ambientar)
  b.enemy('rifle', 1226, 14, { patrol: 40, facing: -1 });
  b.enemy('shotgun', 1246, 14, { patrol: 40, facing: -1 });
  b.enemy('drone', 1256, 8, { patrol: 80 });
  // K2 — ORELHA DOURADA: torre de antena escondida, acima da tela
  b.plat(1236, 12, 3);
  b.plat(1240, 10, 3);
  b.plat(1244, 8, 3);
  b.plat(1248, 6, 3);
  b.plat(1252, 4, 3);
  b.secret(2, 1254, 3);
  b.tokens(1237, 11, 2);
  b.tokens(1241, 9, 2);
  b.tokens(1245, 7, 2);
  b.tokens(1249, 5, 2);
  b.checkpoint('Antes do Felipão', 1284, 14);
}

/** SEÇÃO 14 — FELIPÃO (1292–1348): arena do chefe com piso que desaba. */
export function section14(b: LevelBuilder) {
  b.setTheme(THEME.HANGAR);
  b.section('Felipão', 1296, 14);
  b.atmos(1292, 1.0, 0);
  const x0 = 1292;
  const x1 = 1338;
  const cc = Math.round((x0 + x1) / 2);
  // piso: bordas maciças + laje central fina (parte desabável)
  b.ground(1292, 1304, 14);
  b.ground(1326, 1348, 14);
  b.block(1304, 14, 22, 3);
  // plataformas laterais (desabam na fase 3)
  b.plat(cc - 10, 9, 4);
  b.plat(cc + 6, 9, 4);
  b.plat(cc - 3, 11, 6);
  b.deco('hologram', 1296, 14);
  b.deco('spotlight', 1300, 14);
  b.deco('spotlight', 1330, 14);
  b.deco('banner', 1334, 14);
  b.deco('antenna', 1345, 14);
  b.arena({
    id: 'boss', x0, x1, top: 0, bottom: 24, trigger: 1297, soft: false,
    waves: [{ delay: 0, e: [] }],
  });
  // o próprio Felipão
  b.enemy('boss', cc + 12, 14, { facing: -1, arena: 'boss' });
  b.finishX = 1340 * 32;
}
