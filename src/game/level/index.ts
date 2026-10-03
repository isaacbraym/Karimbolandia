import type { LevelData } from '../level';
import { LevelBuilder, LEVEL_H } from './builder';
import { section1, section2, section3, section4 } from './sections1';
import { section5, section6, section7, section8, section9 } from './sections2';
import { section10, section11, section12, section13, section14 } from './sections3';
import { addSupplies, easeClimbs, addRollers, addCivilians, addCranes, addForeground, addClub } from './extras';
import { assignLooks } from '../civLook';
import { applyCuts, CUT_TOTAL } from './cut';
import { addPatrolStories } from './story';

/** largura da fase montada (antes dos cortes) */
const RAW_W = 1352;
export const LEVEL_W = RAW_W - CUT_TOTAL;
export { mapTile } from './cut';

/** Monta a fase completa (determinística). */
export function buildLevel(): LevelData {
  const b = new LevelBuilder(RAW_W, LEVEL_H);
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
  addSupplies(b);
  easeClimbs(b);
  addRollers(b);
  addCivilians(b);
  addCranes(b);
  // caminho até o chefe ~15% mais curto (remove corredores repetitivos)
  applyCuts(b);
  addClub(b);
  addForeground(b);
  addPatrolStories(b);
  b.atmosphere.sort((a, c) => a.x - c.x);
  // cada morador com uma aparência única (sem repetir combinação)
  assignLooks(b.civilians);
  return b.build('boss');
}
