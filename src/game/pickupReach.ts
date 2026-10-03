import type { Rect } from '../core/math';
import type { Level } from './level';
import { segmentRectEntry } from '../core/segment';

/** Short line of sight for collection: terrain plus exact, even very thin, props. */
export function pickupPathClear(level: Level, solids: readonly Rect[], ax: number, ay: number, bx: number, by: number): boolean {
  if (level.rayHit(ax, ay, bx, by) >= 0) return false;
  for (const r of solids) {
    if (segmentRectEntry(ax, ay, bx, by, r.x, r.y, r.w, r.h) !== null) return false;
  }
  return true;
}
