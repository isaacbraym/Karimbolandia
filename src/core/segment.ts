/** First contact in [0, 1] with an axis-aligned rectangle expanded by padding.
 * Inclusive edges and stationary segments match the game's projectile hitboxes.
 * Two slab intervals replace length-dependent sampling, without allocations.
 */
export function segmentRectEntry(ax: number, ay: number, bx: number, by: number, rx: number, ry: number, rw: number, rh: number, padding = 0): number | null {
  const dx = bx - ax, dy = by - ay;
  let near = 0, far = 1;
  for (let axis = 0; axis < 2; axis++) {
    const origin = axis ? ay : ax, delta = axis ? dy : dx;
    const min = (axis ? ry : rx) - padding;
    const max = (axis ? ry + rh : rx + rw) + padding;
    if (delta === 0) {
      if (origin < min || origin > max) return null;
    } else {
      const a = (min - origin) / delta, b = (max - origin) / delta;
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
      if (near > far) return null;
    }
  }
  return near;
}
