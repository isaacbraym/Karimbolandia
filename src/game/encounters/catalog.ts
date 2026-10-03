import { TILE, T, type LevelData } from '../level';
import type { TrailDefinition } from './challenge';
import { FLIGHT_HEIGHT, type EscortDefinition } from './escort';

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
  const trails: TrailDefinition[] = [];
  if (!points.some(p => !p || data.water.some(z => p.x >= z.x && p.x <= z.x + z.w))) trails.push({
    id: jungle ? 'jungle:firefly-trail' : 'city:lost-delivery',
    title: jungle ? 'TRILHA DOS VAGALUMES' : 'ENTREGA EXTRAVIADA',
    theme: jungle ? 'fireflies' : 'delivery',
    points: points as { x: number; y: number }[], seconds: jungle ? 18 : 16, coins: jungle ? 18 : 12,
  });
  if (jungle) {
    const harvest = orchardChallenge(data);
    if (harvest) trails.push(harvest);
  }
  return trails;
}

/** Optional harvest between the orchard and exit checkpoints on the expanded map. */
function orchardChallenge(data: LevelData): TrailDefinition | null {
  const columns = [1180, 1186, 1193, 1201, 1210, 1220];
  const x0 = (columns[0] + .5) * TILE, x1 = (columns.at(-1)! + .5) * TILE;
  if (data.checkpoints.some(cp => cp.x > x0 && cp.x < x1)) return null;
  const ground = data.level.groundBelow(x0, data.playerStart.y - TILE * 2, TILE * 4);
  if (ground === null) return null;
  // Validate the entire walking/jumping corridor, not just the ring centres.
  for (let x = x0 - TILE * 2; x <= x1 + TILE; x += TILE / 2) {
    const floor = data.level.groundBelow(x, ground - TILE, TILE * 2);
    if (floor === null || Math.abs(floor - ground) > TILE
      || data.water.some(z => x >= z.x && x <= z.x + z.w)
      || data.props.some(p => Math.abs(p.x - x) < TILE)) return null;
    for (let y = floor - 180; y < floor; y += TILE / 2)
      if (data.level.solidAtPx(x, y) || data.level.get(Math.floor(x / TILE), Math.floor(y / TILE)) === T.HAZARD) return null;
  }
  return {
    id: 'jungle:orchard-harvest', title: 'COLHEITA DO POMAR', theme: 'harvest',
    points: columns.map(column => {
      const x = (column + .5) * TILE;
      return { x, y: data.level.groundBelow(x, ground - TILE, TILE * 2)! - 82 };
    }),
    seconds: 26, coins: 20,
  };
}

/** Uma entrega recuperável no trecho coberto pelo contêiner, sem cruzar checkpoints. */
export function escortCatalog(data: LevelData): EscortDefinition[] {
  if (data.stage !== 1) return [];
  const x0 = 100.5 * TILE, x1 = 108.5 * TILE;
  const y0 = data.level.groundBelow(x0, data.playerStart.y - TILE * 2, TILE * 4);
  const y1 = data.level.groundBelow(x1, data.playerStart.y - TILE * 2, TILE * 4);
  if (y0 === null || y1 === null || Math.abs(y0 - y1) > TILE) return [];
  if (data.checkpoints.some(cp => cp.x > x0 && cp.x < x1)) return [];
  for (let x = x0; x <= x1; x += TILE / 2) {
    const floor = data.level.groundBelow(x, y0 - TILE, TILE * 2);
    const air = y0 + (y1 - y0) * (x - x0) / (x1 - x0) - FLIGHT_HEIGHT;
    // Body/rotors must fit beneath platform supports, not only their centre point.
    for(let tx=Math.floor((x-40)/TILE);tx<=Math.floor((x+40)/TILE);tx++)
      for(let ty=Math.floor((air-22)/TILE);ty<=Math.floor((air+18)/TILE);ty++) {
        const tile=data.level.get(tx,ty),top=ty*TILE;
        if(tile===T.SOLID||tile===T.HAZARD||(tile===T.ONEWAY&&air-14<top+22&&air+18>top-8))return [];
      }
    if (floor === null || Math.abs(floor - y0) > TILE || data.level.solidAtPx(x, air)
      || data.water.some(z => x >= z.x && x < z.x + z.w)) return [];
  }
  // Mantém distância dos objetos físicos sem adicionar sólidos ou mudar seus IDs.
  if (data.props.some(p => p.x >= x0 - TILE && p.x <= x1 + TILE)) return [];
  return [{ id: 'city:drone-rescue', title: 'DRONE DE ENTREGAS', start: { x: x0, y: y0 }, destination: { x: x1, y: y1 }, coins: 22 }];
}
