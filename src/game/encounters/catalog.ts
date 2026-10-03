import { TILE, type LevelData } from '../level';
import type { TrailDefinition } from './challenge';

/** Authored calm stretches; the ground relief determines each jump's height. */
export function encounterCatalog(data: LevelData): TrailDefinition[] {
  const jungle = data.stage === 2;
  const tiles = jungle ? [190, 195, 202, 209] : [24, 29, 36, 45];
  const points = tiles.map(tile => {
    const x = (tile + .5) * TILE;
    const ground = data.level.groundBelow(x, data.playerStart.y - TILE * 2, TILE * 4);
    return ground === null ? null : { x, y: ground - 82 };
  });
  // Never add a challenge to a different/custom layout with missing ground or water.
  if (points.some(p => !p || data.water.some(z => p.x >= z.x && p.x <= z.x + z.w))) return [];
  return [{
    id: jungle ? 'jungle:firefly-trail' : 'city:lost-delivery',
    title: jungle ? 'TRILHA DOS VAGALUMES' : 'ENTREGA EXTRAVIADA',
    theme: jungle ? 'fireflies' : 'delivery',
    points: points as { x: number; y: number }[], seconds: jungle ? 18 : 16, coins: jungle ? 18 : 12,
  }];
}
