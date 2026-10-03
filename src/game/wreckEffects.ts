import { rand } from '../core/math';
import { PK, type Fx } from './fx';
import type { Camera } from './camera';

type Wreck = { x: number; y: number; t: number };
const crossed = (before: number, after: number, rate: number, phase: number) =>
  Math.floor(after * rate + phase + 1e-9) > Math.floor(before * rate + phase + 1e-9);

/** Cosmetic emissions belong to simulation, never to drawing paused frames. */
export function updateWreckEffects(wrecks: readonly Wreck[], fx: Fx, camera: Pick<Camera, 'visible'>, dt: number) {
  if (dt <= 0) return;
  for (const w of wrecks) {
    const before = w.t;
    w.t += dt;
    if (!camera.visible(w.x, w.y, 160)) continue;
    // Stable staggering avoids all nearby wrecks emitting on the same frame.
    const phase = ((Math.floor(w.x) * 37 + Math.floor(w.y) * 17) >>> 0) % 997 / 997;
    // Keep the original average rates at 60 Hz, with at most one batch after a long step.
    if (crossed(before, w.t, 9, phase) && fx.opt())
      fx.smoke(w.x + rand.spread(14), w.y - 40, 1, '#2a2438', 9, 40, 1.1);
    if (crossed(before, w.t, 3, phase) && fx.opt())
      fx.sparks(w.x + rand.spread(14), w.y - 40, 3, '#ffb347', 120);
    if (crossed(before, w.t, 4.2, phase) && fx.opt())
      fx.add(PK.Fire, w.x + rand.spread(12), w.y - 44, 0, -30, .5, 8, '#ff7a1a', { size1: 2 });
  }
}
