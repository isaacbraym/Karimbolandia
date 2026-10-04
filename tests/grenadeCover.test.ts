import { describe, expect, it, vi } from 'vitest';
import { Grenade } from '../src/game/bullets';
import { makeWorld } from './helpers/bot';

function scene() {
  const w = makeWorld();
  w.enemies = [];
  w.props = [];
  w.solidRects = [];
  w.solidsDirty = false;
  const x = 320, feet = w.level.groundBelow(x, 900) ?? 1024;
  return { w, x, feet };
}

describe('Granadas em coberturas', () => {
  it('ricocheteia numa cobertura sólida sem entrar nela nem ficar presa', () => {
    const { w, x, feet } = scene();
    const wall = { x: x + 60, y: feet - 80, w: 30, h: 80 };
    w.solidRects = [wall];
    const g = new Grenade(x, feet - 40, 480, -60);
    vi.spyOn(w, 'explode').mockImplementation(() => {});
    let inside = 0;
    for (let i = 0; i < 80 && !g.dead; i++) {
      g.update(w, 1 / 60);
      if (g.x + 4 > wall.x && g.x - 4 < wall.x + wall.w && g.y + 4 > wall.y && g.y - 4 < wall.y + wall.h) inside++;
    }
    expect(inside).toBe(0);
    expect(g.x).toBeLessThan(wall.x);
    expect(g.bounces).toBeGreaterThan(0);
  });

  it('nascendo dentro de um objeto, sai pelo lado mais próximo', () => {
    const { w, x, feet } = scene();
    const crate = { x: x - 20, y: feet - 40, w: 40, h: 40 };
    w.solidRects = [crate];
    const g = new Grenade(x, feet - 36, 0, 0);
    g.update(w, 1 / 60);
    expect(g.y).toBeLessThanOrEqual(crate.y - 4 + 0.01);
  });

  it('atravessando um inimigo num quadro rápido, explode uma única vez', () => {
    const { w, x, feet } = scene();
    const e = w.spawnEnemy({ id: -7, type: 'rifle', x: x + 20, y: feet });
    w.enemies = [e];
    const boom = vi.spyOn(w, 'explode').mockImplementation(() => {});
    const g = new Grenade(x - 30, e.y, 6000, 0);
    g.update(w, 1 / 60);
    g.update(w, 1 / 60);
    g.detonate(w);
    expect(boom).toHaveBeenCalledTimes(1);
    expect(g.dead).toBe(true);
  });
});
