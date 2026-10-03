import { Level, TILE } from '../level';
import type { Rect } from '../../core/math';
import type { LevelBuilder } from './builder';

/** Insert terrain without reassigning persistent entity/checkpoint IDs. */
export function insertColumns(b: LevelBuilder, at: number, count: number) {
  const old = b.level, next = new Level(old.w + count, old.h), edge = at * TILE, dx = count * TILE;
  next.reliefRow = old.reliefRow;
  for (let y = 0; y < old.h; y++) for (let x = 0; x < old.w; x++) {
    const to = x >= at ? x + count : x;
    next.tiles[y * next.w + to] = old.get(x, y);
    next.theme[y * next.w + to] = old.themeAt(x, y);
  }
  for (let x = 0; x <= old.w; x++) next.relief[x >= at ? x + count : x] = old.relief[x];
  const point = (p: { x: number }) => { if (p.x >= edge) p.x += dx; };
  const rect = (r: Rect) => { if (r.x >= edge) r.x += dx; else if (r.x + r.w > edge) r.w += dx; };
  for (const list of [b.enemies, b.props, b.pickups, b.checkpoints, b.decos, b.civilians,
    b.vines, b.drums, b.beams, b.sections, b.atmosphere]) for (const p of list) point(p);
  for (const d of b.doors) { point(d); if (d.tx >= edge) d.tx += dx; }
  for (const z of [...b.camZones, ...b.triggers, ...b.secretRooms, ...b.arenas]) rect(z.rect);
  for (const z of [...b.rooms, ...b.water]) rect(z);
  for (const a of b.arenas) if (a.triggerX >= edge) a.triggerX += dx;
  point(b.playerStart); point(b.nomadSpawn);
  if (b.finishX >= edge) b.finishX += dx;
  b.level = next;
}
