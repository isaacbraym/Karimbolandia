import type { Rect } from '../core/math';
import type { Level } from './level';

/** Short line of sight for collection: terrain plus exact, even very thin, props. */
export function pickupPathClear(level: Level, solids: readonly Rect[], ax: number, ay: number, bx: number, by: number): boolean {
  if (level.rayHit(ax, ay, bx, by) >= 0) return false;
  const dx = bx - ax, dy = by - ay;
  for (const r of solids) {
    let near = 0, far = 1;
    for (let axis = 0; axis < 2; axis++) {
      const origin = axis ? ay : ax, delta = axis ? dy : dx;
      const min = axis ? r.y : r.x, max = min + (axis ? r.h : r.w);
      if (delta === 0) {
        if (origin < min || origin > max) { near = 2;break; }
      } else {
        const a = (min - origin) / delta, b = (max - origin) / delta;
        near = Math.max(near, Math.min(a, b));far = Math.min(far, Math.max(a, b));
        if (near > far) break;
      }
    }
    if (near <= far) return false;
  }
  return true;
}
