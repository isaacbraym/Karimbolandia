import { describe, expect, it } from 'vitest';
import { buildLevel } from '../src/game/level/index';
import { buildJungle } from '../src/game/level/jungle';
import { World } from '../src/game/world';
import { TILE } from '../src/game/level';
import { newCtl } from './helpers/bot';
import { moveBody, newBody } from '../src/game/physics';
import { FOOT_W, FOOT_H, RUN, GRAV } from '../src/game/movement';

describe('passagens escondidas nas duas fases', () => {
  for (const build of [buildLevel, buildJungle]) {
    it(`${build.name}: entrada, descoberta única, caminhada e retorno sem pulo`, () => {
      const data = build();
      const rooms = data.rooms.filter(r => r.passage);
      expect(rooms).toHaveLength(2);
      for (const m of data.level.mounds) {
        const body = newBody(FOOT_W, FOOT_H);
        body.x = m.x - 570; body.y = m.y - FOOT_H / 2 - .5;
        body.onGround = true;
        let height = 0;
        for (let f = 0; f < 300; f++) {
          body.vx = RUN; body.vy += GRAV / 60;
          moveBody(body, 1 / 60, data.level);
          height = Math.max(height, m.y - body.y - body.h / 2);
        }
        expect(height).toBeGreaterThan(m.forest ? 245 : 212);
        expect(body.x).toBeGreaterThan(m.x + 180);
        // Caminha de volta por baixo da aba da rocha até o portal.
        body.x = m.x + 250; body.y = m.y - FOOT_H / 2 - .5; body.vy = 0; body.onGround = true;
        for (let f = 0; f < 78; f++) { body.vx = -RUN; body.vy += GRAV / 60; moveBody(body, 1 / 60, data.level); }
        expect(body.y + body.h / 2).toBeGreaterThan(m.y - 35);
        expect(body.x).toBeLessThan(m.x + 30);
      }
      for (const room of rooms) {
        const w = new World(data);
        w.enemies = []; w.props = []; w.invulnerable = true;
        w.narrator.enabled = false;
        for (const t of data.triggers) w.director.triggered.add(t.id);
        w.director.cine = null;
        const door = data.doors.find(d => d.kind === 'in' && d.tx >= room.x && d.tx < room.x + room.w && d.ty >= room.y && d.ty <= room.y + room.h)!;
        expect(door).toBeDefined();
        const ctl = newCtl();
        const tick = (n: number) => { for (let f = 0; f < n; f++) w.update(1 / 60, ctl); };
        w.player.reset(door.x - 90, door.y); tick(3);
        ctl.moveX = 1; tick(22); ctl.moveX = 0; tick(6);
        expect(w.player.x).toBeGreaterThan(door.x - 35);
        w.player.reset(door.x, door.y); tick(2);
        ctl.moveY = -1; tick(50); ctl.moveY = 0; tick(2);
        expect(w.inRoom()).toBe(true);
        expect(w.player.lockInput).toBe(false);
        expect(w.secretRooms.has(room.passage!.id)).toBe(true);
        const score = w.score;
        tick(120); expect(w.score).toBe(score);
        expect(w.player.y).toBeLessThan(w.deathY(w.player.x));
        ctl.moveY = -1; tick(50); ctl.moveY = 0; tick(2);
        expect(w.inRoom()).toBe(false);
        expect(w.player.x).toBeCloseTo(door.x, 0);
        expect(w.player.feetY).toBeCloseTo(door.y, 0);
        expect(w.player.lockInput).toBe(false);
        const floor = room.y + room.h;
        w.player.reset(room.x + TILE * 3.5, floor); tick(3);
        ctl.moveX = 1; tick(180); ctl.moveX = 0;
        expect(w.player.x).toBeGreaterThan(room.x + TILE * 20);
        expect(w.player.body.onGround).toBe(true);
      }
    });
  }
});
