import { TILE, THEME } from '../level';
import { buildingStyle } from '../buildings';
import type { LevelBuilder } from './builder';
import { G } from './builder';
import { COMMUNITY_END } from './community';

/** Superfície/cor/posição compartilhadas pela colisão e pelo desenho do telhado. */
export function addVillageRoofs(b: LevelBuilder) {
  const homes = b.decos.filter(d => d.kind === 'villageHome').sort((a, z) => a.x - z.x);
  const oldCoins = b.pickups.filter(p => p.kind === 'token' && p.x >= 692 * TILE && p.x < COMMUNITY_END * TILE && p.y < (G - 1) * TILE);
  for (const [i, home] of homes.entries()) {
    const style = buildingStyle(home.variant!), scale = home.scale ?? 1;
    const width = Math.max(3, Math.round((style.width + 24) * scale / TILE));
    const col = Math.round(home.x / TILE - width / 2);
    const row = Math.round((home.y - style.wall * scale + 4 * scale) / TILE);
    b.plat(col, row, width, THEME.WOOD);
    b.level.roofs.push({ x: col * TILE, y: row * TILE, w: width * TILE,
      depth: style.depth * scale, color: style.roof === 2 ? '#ba7252' : '#b49860', awning: false });
    // A marquise de uma casa alta oferece o degrau intermediário; rua/porta ficam livres.
    if (style.floors === 2 || i === 0 || home.x - (homes[i - 1]?.x ?? -Infinity) > 9 * TILE) {
      const ax = col - 1, ay = Math.round(home.y / TILE) - 2;
      b.plat(ax, ay, 2, THEME.WOOD);
      b.level.roofs.push({ x: ax * TILE, y: ay * TILE, w: 2 * TILE, depth: 18,
        color: style.accent, awning: true });
      b.token(ax + .7, ay - .85);
    }
    b.tokens(col + .55, row - .9, Math.max(2, width - 1));
  }
  const used = new Map<number, number>();
  for (const coin of oldCoins) {
    const roofs = b.level.roofs.filter(r => !r.awning);
    let nearest = 0;
    for (let i = 1; i < roofs.length; i++) if (Math.abs(roofs[i].x + roofs[i].w / 2 - coin.x) < Math.abs(roofs[nearest].x + roofs[nearest].w / 2 - coin.x)) nearest = i;
    const roof = roofs[nearest], slot = used.get(nearest) ?? 0;
    coin.x = roof.x + 12 + slot % Math.max(2, Math.floor(roof.w / 18)) * 18;
    coin.y = roof.y - 28 - Math.floor(slot / Math.max(2, Math.floor(roof.w / 18))) * 20;
    used.set(nearest, slot + 1);
  }
}
