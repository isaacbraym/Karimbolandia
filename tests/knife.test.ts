import { mapTile as M } from '../src/game/level/index';
import { describe, it, expect } from 'vitest';
import { makeWorld, teleport, newCtl } from './helpers/bot';

describe('Faquinha (golpe corpo a corpo estilo Metal Slug)', () => {
  it('mata num golpe os soldados colados à frente, todos de uma vez, sem gastar munição', () => {
    const w = makeWorld();
    teleport(w, M(200), 32);
    const ctl = newCtl();
    for (let i = 0; i < 20; i++) w.update(1 / 60, ctl);
    const p = w.player;
    p.facing = 1;
    const a = w.spawnEnemy({ id: -801, type: 'rifle', x: p.x + 26, y: p.feetY, facing: -1 });
    const b = w.spawnEnemy({ id: -802, type: 'shotgun', x: p.x + 40, y: p.feetY, facing: -1 });
    const behind = w.spawnEnemy({ id: -803, type: 'rifle', x: p.x - 60, y: p.feetY, facing: 1 });
    const ammo = p.weapons.get(p.cur);
    ctl.mouseAim = { x: p.x + 200, y: p.y };
    ctl.fire.held = true;
    w.update(1 / 60, ctl);
    ctl.fire.held = false;
    expect(a.alive).toBe(false);
    expect(b.alive).toBe(false);
    expect(behind.alive).toBe(true); // só quem está na frente
    expect(p.weapons.get(p.cur)).toBe(ammo);
    expect(p.meleeT).toBeGreaterThan(0);
    // o próximo golpe alterna a direção do corte
    const alt = p.meleeAlt;
    for (let i = 0; i < 30; i++) w.update(1 / 60, ctl);
    w.spawnEnemy({ id: -804, type: 'rifle', x: p.x + 26 * p.facing, y: p.feetY, facing: -1 });
    ctl.fire.held = true;
    w.update(1 / 60, ctl);
    expect(p.meleeAlt).not.toBe(alt);
  });
});
