import { describe, expect, it } from 'vitest';
import { World } from '../src/game/world';
import { buildLevel } from '../src/game/level/index';
import { buildJungle } from '../src/game/level/jungle';
import { newCtl } from './helpers/bot';

describe.each([['cidade', buildLevel], ['selva', buildJungle]] as const)('Oficina secreta: %s', (_, build) => {
  function setup() {
    const w = new World(build());
    w.enemies = []; w.invulnerable = true; w.player.lockInput = false;
    return w;
  }
  it('tem apenas um mercador, com chão livre dentro do segredo, e nenhum na entrada ou nos checkpoints', () => {
    const w = setup(), m = w.merchant, r = m.room!.rect;
    expect(m.spots).toHaveLength(1);
    const s = m.spots[0];
    expect(s.x).toBeGreaterThan(r.x); expect(s.x).toBeLessThan(r.x + r.w);
    expect(w.level.solidAtPx(s.x, s.y + 1)).toBe(true);
    expect(w.level.solidAtPx(s.x, s.y - 60)).toBe(false);
    w.player.reset(s.x, s.y); expect(m.near(w)).toBe(true);
    if (w.data.stage === 2) expect(w.inRoom()).toBe(true);
    for (const p of [w.data.playerStart, ...w.data.checkpoints]) {
      w.player.reset(p.x, p.y); expect(m.near(w)).toBe(false);
    }
  });
  it('exige descobrir a câmara e estar a pé, sem abrir a oficina pelo teto ou durante bloqueio de controle', () => {
    const w = setup(), m = w.merchant, s = m.spots[0], r = m.room!.rect;
    w.player.reset(s.x, r.y - 1); expect(m.near(w)).toBe(false);
    w.player.reset(s.x, s.y); w.player.lockInput = true; expect(m.near(w)).toBe(false);
    w.player.lockInput = false; w.player.mode = 'dead'; expect(m.near(w)).toBe(false);
    w.player.mode = 'foot'; expect(m.near(w)).toBe(true);
    w.player.reset(s.x + 110, s.y); expect(m.near(w)).toBe(false);
  });
  it('a parede bloqueia a entrada; ao quebrá-la pode entrar, conversar e voltar ao corredor', () => {
    const w = setup(), m = w.merchant, s = m.spots[0];
    const wall = w.props.filter(p => p.kind === 'wall' && p.secret)
      .sort((a,b) => Math.hypot(a.x-s.x,a.y-s.y) - Math.hypot(b.x-s.x,b.y-s.y))[0];
    expect(Math.abs(wall.x-s.x)).toBeLessThan(220);
    const dir = Math.sign(s.x-wall.x), outside = wall.x-dir*60;
    const ctl = newCtl(); ctl.moveX = dir;
    w.player.reset(outside, s.y);
    const walk = (frames: number, jumpObstacles = false) => {
      for (let i=0;i<frames;i++) {
        ctl.jump.pressed = jumpObstacles && w.player.body.onGround && w.player.body.wallDir !== 0;
        ctl.jump.held = jumpObstacles && (ctl.jump.pressed || !w.player.body.onGround);
        w.update(1/60,ctl);
      }
    };
    walk(40); expect(m.near(w)).toBe(false);
    expect((w.player.x-wall.x)*dir).toBeLessThan(0);
    wall.hurt(w, 999, 'bullet', dir); expect(wall.alive).toBe(false);
    for (let i=0;i<180 && !m.near(w);i++) walk(1,true);
    expect(m.near(w), JSON.stringify({ player:[w.player.x,w.player.feetY,w.player.mode,w.player.lockInput],spot:s,wall:[wall.x,wall.y],body:w.player.body })).toBe(true);
    ctl.moveX = -dir;
    for (let i=0;i<180 && (w.player.x-wall.x)*dir > -45;i++) walk(1,true);
    expect((w.player.x-wall.x)*dir).toBeLessThan(-40);
    expect(m.near(w)).toBe(false);
  });
});
