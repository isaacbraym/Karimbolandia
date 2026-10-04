import { describe, expect, it } from 'vitest';
import { paintJungle } from '../src/art/jungleDecor';

function dragonflyPosition(t: number, seed: number) {
  let position = { x: NaN, y: NaN };
  const noop = () => {};
  const g = new Proxy({
    globalAlpha: 1,
    translate(x: number, y: number) {
      if (Number.isNaN(position.x)) position = { x, y };
    },
  }, {
    get(target, key) { return Reflect.get(target, key) ?? noop; },
  }) as unknown as CanvasRenderingContext2D;
  paintJungle(g, 'jDragonfly', seed, t);
  return position;
}

describe('Voo decorativo das libélulas', () => {
  it('mantém deslocamento suave mesmo após horas de partida', () => {
    const dt = 1 / 60;
    for (const seed of [-17, 0, 6, 137]) {
      for (const age of [0, 60, 300, 1800, 7200]) {
        let travelled = 0;
        for (let frame = 0; frame < 600; frame++) {
          const t = age + frame * dt;
          const a = dragonflyPosition(t, seed);
          const b = dragonflyPosition(t + dt, seed);
          const distance = Math.hypot(b.x - a.x, b.y - a.y);
          expect(distance / dt).toBeLessThan(62);
          expect(Math.abs(a.x)).toBeLessThanOrEqual(82);
          expect(a.y).toBeGreaterThanOrEqual(-36);
          expect(a.y).toBeLessThanOrEqual(-4);
          travelled += distance;
        }
        expect(travelled).toBeGreaterThan(1);
      }
    }
  });
});
