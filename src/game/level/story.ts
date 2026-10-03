import { TILE } from '../level';
import type { LevelBuilder } from './builder';

export function addPatrolStories(b: LevelBuilder) {
  let lastX = -Infinity;
  let i = 0;
  for (const e of b.enemies) {
    if (!e.patrol || e.arena || e.type === 'drone' || e.type === 'jetpack' || e.x - lastX < 400) continue;
    lastX = e.x;
    const kinds = b.stage === 2 ? ['patrolCamp', 'patrolRadio', 'patrolWorkshop'] : ['patrolRadio', 'patrolWorkshop'];
    const x = e.x + 66;
    const y = b.level.groundBelow(x, e.y - 12, 70);
    if (y === null) continue;
    b.decos.push({ kind: kinds[i++ % kinds.length], x, y: y - 3, layer: 'back', scale: 0.85 });
    if (b.stage === 2) b.decos.push({ kind: 'jAmmo', x: x - 60, y, layer: 'back', scale: 0.65 });
    else b.decos.push({ kind: 'trashCans', x: x + TILE * 2, y, layer: 'back', scale: 0.8 });
  }
}
