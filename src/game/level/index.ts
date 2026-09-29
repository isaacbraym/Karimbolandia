import type { LevelData } from '../level';
import { LevelBuilder, LEVEL_H } from './builder';
import { section1, section2, section3, section4 } from './sections1';
import { section5, section6, section7, section8, section9 } from './sections2';
import { section10, section11, section12, section13, section14 } from './sections3';

export const LEVEL_W = 1352;

/** Monta a fase completa (determinística). */
export function buildLevel(): LevelData {
  const b = new LevelBuilder(LEVEL_W, LEVEL_H);
  section1(b);
  section2(b);
  section3(b);
  section4(b);
  section5(b);
  section6(b);
  section7(b);
  section8(b);
  section9(b);
  section10(b);
  section11(b);
  section12(b);
  section13(b);
  section14(b);
  b.atmosphere.sort((a, c) => a.x - c.x);
  return b.build('boss');
}
