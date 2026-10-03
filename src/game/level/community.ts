import { THEME } from '../level';
import { G, type LevelBuilder } from './builder';
import { insertColumns } from './insert';

export const COMMUNITY_START = 692;
export const COMMUNITY_OLD_END = 754;
export const COMMUNITY_EXTRA = (COMMUNITY_OLD_END - COMMUNITY_START) * 9;
export const COMMUNITY_END = COMMUNITY_OLD_END + COMMUNITY_EXTRA;
export const DANCE_TILE = 1004;
export const DANCE_ID = 'jungle:alligator-circle';

/** The public path stays on dry ground; the stream flows behind it. */
export function expandCommunity(b: LevelBuilder) {
  insertColumns(b, COMMUNITY_OLD_END, COMMUNITY_EXTRA);
  b.ground(COMMUNITY_OLD_END, COMMUNITY_END, G, THEME.EARTH);
  const districts = [
    ['Casas do caminho', 760], ['Roças da comunidade', 840], ['Riacho dos tecidos', 920],
    ['Praça do jacaré', 984], ['Oficinas da aldeia', 1068], ['Pomares e quintais', 1160], ['Trilha do rio', 1260],
  ] as const;
  for (const [name, x] of districts) b.section(name, x, G);
  // Appended indices preserve every old save; activation compares spatial progress.
  for (const [name, x] of [['Roças', 838], ['Riacho da aldeia', 920], ['Praça da aldeia', 982],
    ['Oficinas', 1070], ['Pomares', 1164], ['Saída da aldeia', 1282]] as const) b.checkpoint(name, x, G);
  for (let i = 0; i < 27; i++) {
    const x = 766 + i * 17 + (i >= 13 ? 62 : 0);
    b.deco('villageHome', x, G, 'back', { scale: .85 + i % 4 * .08, flip: i % 3 === 1 });
    b.deco('villagePottery', x + 4, G, 'back', { scale: .65 + i % 3 * .12 });
    b.deco(i % 2 ? 'villageWeaver' : 'villageCarrier', x - 3, G, 'back');
  }
  for (let x = 846; x < 904; x += 12) {
    b.deco('villageGarden', x, G, 'back', { scale: 1.3 });
    b.deco('villageFarmer', x + 2, G, 'back');
  }
  for (const x of [929, 944, 959]) {
    b.deco('villageStream', x, G, 'back');
    b.deco('villageLaundry', x + 1, G, 'back');
    b.deco('villageWasher', x - 2, G, 'back');
  }
  b.deco('villageDance', DANCE_TILE, G, 'back');
  for (const [x, y] of [[-5.9, 0], [-4.9, -.22], [-3.8, -.42], [-1.7, -.55],
    [1.9, -.55], [2.9, -.4], [4, -.22], [5.1, 0]]) b.deco('villageChild', DANCE_TILE + x, G + y, 'back');
  for (const x of [1088, 1118, 1145]) {
    b.deco('villageWorkbench', x, G, 'back'); b.deco('villageCarpenter', x + 1, G, 'back');
  }
  for (let x = 1180; x < 1255; x += 16) {
    b.deco('villageOrchard', x, G, 'back'); b.deco('villageFarmer', x - 3, G, 'back');
  }
  // Optional canopy route, never a wall across the village road.
  for (let x = 780; x < COMMUNITY_END - 24; x += 72) {
    if (Math.abs(x - DANCE_TILE) < 32) continue;
    b.plat(x, G - 2, 5, THEME.WOOD); b.plat(x + 7, G - 4, 5, THEME.WOOD);
    b.tokenArc(x - 4, G - 1, x + 11, G - 5, 6);
  }
  for (let x = 758; x < COMMUNITY_END - 5; x += 13) {
    if (Math.abs(x - DANCE_TILE) < 9) continue;
    b.deco(x % 3 ? 'jPalm' : 'jTree', x, G, 'back', { scale: .7 + x % 3 * .1 });
    b.deco('jFern', x + 4, G, 'back', { scale: .65 });
  }
  b.atmos(760, .08, .08); b.atmos(916, .02, .03); b.atmos(982, .12, .03);
  b.atmos(1060, .06, .08); b.atmos(COMMUNITY_END, .08, .12);
  // Keep the celebration and shallow stream level and legible after rollingGround.
}
