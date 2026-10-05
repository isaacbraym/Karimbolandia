/**
 * ATLÂNTIDA — a cidade submersa embaixo do lago da selva.
 * O lago antigo (10 blocos de fundo) ganha uma fenda sob a cachoeira que desce para uma caverna
 * 2× mais larga e 7× mais funda, escavada embaixo das margens (o resto da fase não se mexe).
 * Lá embaixo: portal, torre com janela secreta, o Palácio de Netuno, uma casa desabada, um cofre
 * escondido sob o leito e câmaras laterais. Cinco relíquias permanentes (o traje Atlante sai com
 * todas), baús de moedas e seis cardumes de piranhas guardando os lugares isolados.
 * Tudo aqui é acrescentado NO FIM da fase: IDs de inimigos e itens antigos não mudam (saves).
 */
import { T, THEME, TILE } from '../level';
import type { LevelBuilder } from './builder';

/** Lago da selva: colunas [LAKE_X0, LAKE_X1) (324..400 + SHIFT 150), superfície LAKE_TOP, fundo antigo LAKE_FLOOR. */
export const LAKE_X0 = 474;
export const LAKE_X1 = 550;
export const LAKE_TOP = 34;
export const LAKE_FLOOR = 44;

/** caverna: colunas [DEEP_X0, DEEP_X1), teto ~DEEP_TOP, leito da cidade na linha ABYSS_FLOOR */
export const DEEP_X0 = 464;
export const DEEP_X1 = 616;
export const DEEP_TOP = 47;
/** 7× o fundo do lago antigo (10 blocos → 70) */
export const ABYSS_FLOOR = LAKE_TOP + 70;
/** altura do mapa da selva (o cofre fica embaixo do leito) */
export const JUNGLE_H = ABYSS_FLOOR + 8;
/** fenda no fundo do lago antigo, sob a cachoeira */
export const FENDA: [number, number] = [LAKE_X0 + 2, LAKE_X0 + 18];

const noise = (x: number, k: number) => Math.sin(x * 0.37 + k) * 0.6 + Math.sin(x * 0.11 + k * 2.3) * 0.4;

export function buildAtlantis(b: LevelBuilder) {
  const L = b.level;
  // ---------------------------------------------------------------- caverna (bacia em forma de tigela)
  const floorAt: number[] = [];
  for (let x = DEEP_X0; x < DEEP_X1; x++) {
    const e = Math.min(x - DEEP_X0, DEEP_X1 - 1 - x);
    const top = DEEP_TOP + (e < 10 ? Math.round((10 - e) * 1.2) : 0) + Math.round(Math.abs(noise(x, 1)) * 2);
    const bot = ABYSS_FLOOR - (e < 8 ? Math.round((8 - e) * 1.6) : 0) - Math.round(Math.abs(noise(x, 5)) * 1.4);
    b.clear(x, top, 1, bot - top);
    for (let y = bot; y < L.h; y++) L.set(x, y, T.SOLID, y === bot ? THEME.MUD : THEME.EARTH);
    floorAt[x] = bot;
  }
  // fenda: o fundo do lago antigo se abre sob a cachoeira
  b.clear(FENDA[0], LAKE_FLOOR, FENDA[1] - FENDA[0], DEEP_TOP - LAKE_FLOOR + 4);
  // bordas da fenda gastas (degraus de pedra)
  b.block(FENDA[0] - 1, LAKE_FLOOR + 1, 1, 2, THEME.TEMPLE);
  b.block(FENDA[1], LAKE_FLOOR + 1, 1, 2, THEME.TEMPLE);
  const seabed = (x: number) => floorAt[x] ?? ABYSS_FLOOR;

  // ---------------------------------------------------------------- água funda (superfície real lá em cima)
  b.water.push({
    id: b.water.length, kind: 'lake', x: DEEP_X0 * TILE, y: LAKE_FLOOR * TILE,
    w: (DEEP_X1 - DEEP_X0) * TILE, h: (ABYSS_FLOOR + 6 - LAKE_FLOOR) * TILE, surface: LAKE_TOP * TILE,
  });

  // ---------------------------------------------------------------- cidade
  b.setTheme(THEME.TEMPLE);
  // portal da cidade (arco duplo)
  b.block(486, 90, 2, seabed(486) - 90);
  b.block(500, 90, 2, seabed(500) - 90);
  b.block(485, 88, 18, 2);
  b.deco('uArch', 493, seabed(493), 'back');
  // torre com janela secreta (relíquia dentro da janela)
  b.block(506, 74, 4, seabed(507) - 74);
  b.clear(506, 85, 4, 3);
  b.deco('aCrystal', 508, 74, 'back');
  // Palácio de Netuno: entrada baixa à esquerda, altar no meio, telhado em frontão
  const PX0 = 528, PX1 = 560;
  b.block(PX0, 84, 2, 14);
  b.block(PX1 - 2, 84, 2, seabed(PX1 - 1) - 84);
  b.block(PX0 - 2, 82, PX1 - PX0 + 4, 2);
  b.block(PX0 + 2, 80, PX1 - PX0 - 4, 2);
  b.block(PX0 + 8, 78, PX1 - PX0 - 16, 2);
  b.block(PX0 + 13, 76, PX1 - PX0 - 26, 2);
  b.clear(PX0 + 2, 84, PX1 - PX0 - 4, seabed(544) - 84);
  for (let x = PX0 + 2; x < PX1 - 2; x++) for (let y = 84; y < ABYSS_FLOOR; y++) if (y >= seabed(x)) L.set(x, y, T.SOLID, THEME.TEMPLE);
  b.block(541, ABYSS_FLOOR - 4, 6, 4);
  b.deco('aTrident', 544, ABYSS_FLOOR - 4, 'back');
  b.deco('aColumn', PX0 + 5, seabed(PX0 + 5), 'back');
  b.deco('aColumn', PX1 - 6, seabed(PX1 - 6), 'back', { flip: true });
  b.deco('aCrystal', PX0 + 3, 84, 'back');
  b.deco('aCrystal', PX1 - 4, 84, 'back');
  b.deco('aDome', 544, 76, 'back', { scale: 1.2 });
  // casa desabada (baú)
  b.block(566, 92, 2, 8);
  b.block(579, 92, 2, seabed(580) - 92);
  b.block(565, 90, 17, 2);
  b.clear(568, 92, 11, seabed(572) - 92);
  // câmara do canto (passagem rasteira por baixo da parede)
  b.block(598, 84, 2, seabed(599) - 84 - 3);
  b.deco('aCrystal', 606, seabed(606), 'back');
  // cofre escondido embaixo do leito (atrás da cortina de algas)
  b.clear(586, seabed(586) - 1, 3, ABYSS_FLOOR + 2 - seabed(586) + 1);
  b.clear(588, ABYSS_FLOOR + 1, 16, 5);
  b.block(588, ABYSS_FLOOR + 6, 16, 1);
  b.deco('aCrystal', 600, ABYSS_FLOOR + 6, 'back');
  for (const x of [583, 586, 589]) b.deco('puKelp', x, ABYSS_FLOOR + 1, 'front', { par: 0.25, flip: x % 2 === 0 });
  // nicho alto na parede esquerda da caverna
  b.clear(465, 52, 9, 4);
  // ruínas espalhadas pelo leito
  for (const [x, kind, flip] of [[470, 'aColumn', false], [516, 'uStatue', false], [522, 'aColumn', true], [562, 'uBones', false],
    [584, 'aColumn', false], [594, 'uStatue', true], [478, 'uBones', true], [612, 'aColumn', true]] as [number, string, boolean][]) {
    b.deco(kind, x, seabed(x), 'back', { flip });
  }
  for (let x = DEEP_X0 + 4; x < DEEP_X1 - 3; x += 3 + (x % 4)) {
    if (x >= PX0 - 1 && x <= PX1 + 1) continue;
    if (L.get(x, seabed(x) - 1) !== T.EMPTY) continue;
    b.deco(x % 5 ? 'uKelp' : 'uGrass', x, seabed(x), 'back', { flip: x % 2 === 0 });
  }
  for (const x of [492, 536, 575, 604]) b.deco('uVent', x, seabed(x), 'back');
  b.deco('aDome', 480, seabed(480), 'back', { scale: 0.8 });
  b.deco('aDome', 590, seabed(590), 'back', { scale: 0.9, flip: true });
  // Monumento da civilização inundada, na praça entre a torre e o palácio.
  // Apenas decoração: mantém a passagem e todos os IDs persistidos.
  b.deco('aThinker', 518, seabed(518), 'back');
  for (const [x, y, scale] of [[494, 88, 2.8], [508, 74, 0.65], [544, 76, 0.9],
    [573, 90, 2.6], [599, 84, 0.45], [486, 90, 0.35], [500, 90, 0.35],
    [470, seabed(470) - 5.4, 0.28], [522, seabed(522) - 5.4, 0.28],
    [584, seabed(584) - 5.4, 0.28]] as [number, number, number][]) {
    b.deco('aMoss', x, y, 'front', { scale });
  }
  // placa na margem: sem traje, o ar não chega lá embaixo
  b.deco('aSign', LAKE_X0 - 6, 32, 'back');
  b.trigger('hint:deep', FENDA[0], LAKE_FLOOR - 2, FENDA[1] - FENDA[0], 6);

  // ---------------------------------------------------------------- tesouros (IDs novos no fim)
  b.pickup('relic', 544, ABYSS_FLOOR - 5, 0); // altar do palácio
  b.pickup('relic', 595, ABYSS_FLOOR + 4, 1); // cofre sob o leito
  b.pickup('relic', 467, 55, 2); // nicho alto (cardume de guarda)
  b.pickup('relic', 607, seabed(607) - 2, 3); // câmara do canto
  b.pickup('relic', 507, 87, 4); // janela da torre
  b.pickup('chest', 573, seabed(573) - 1);
  b.pickup('chest', 600, ABYSS_FLOOR + 5);
  b.pickup('chest', 553, seabed(553) - 1);
  b.pickup('healthBig', 591, ABYSS_FLOOR + 5);
  b.pickup('health', 534, seabed(534) - 2);
  b.tokens(FENDA[0] + 8, DEEP_TOP + 3, 6, 0, 4);
  b.tokenArc(495, 72, 512, 66, 7);
  b.tokens(536, 90, 6, 2, 0);
  b.tokens(602, seabed(602) - 3, 4);

  // ---------------------------------------------------------------- cardumes de piranhas
  const schools: [number, number, number, 1 | 2][] = [
    [471, 54, 8, 1], // guardam o nicho alto
    [600, 58, 10, 1], // águas abertas da direita
    [516, 82, 6, 2], // ao lado da torre
    [544, 72, 12, 1], // sobre o palácio
    [573, 97, 7, 2], // casa desabada
    [588, 100, 9, 1], // entrada do cofre
  ];
  schools.forEach(([hx, hy, n, species], k) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      let tx = Math.round(hx + Math.cos(a) * 3);
      let ty = Math.round(hy + Math.sin(a) * 2);
      // nunca dentro da pedra
      for (let tries = 0; tries < 12 && (L.get(tx, ty) !== T.EMPTY || L.get(tx, ty - 1) !== T.EMPTY || L.get(tx, ty + 1) !== T.EMPTY); tries++) {
        tx += tx > hx ? -1 : 1;
        ty += ty > hy ? -1 : 1;
      }
      b.enemy('piranha', tx, ty, {
        school: 100 + k, homeX: hx * TILE + 16, homeY: hy * TILE, species: i % 4 === 3 && species === 1 ? 2 : species, idle: true,
      });
    }
  });
}
