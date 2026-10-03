import { describe, expect, it } from 'vitest';
import { Level, T, TILE } from '../src/game/level';
import { moveBody, newBody } from '../src/game/physics';
import { buildJungle } from '../src/game/level/jungle';
import { buildLevel } from '../src/game/level/index';
import { JungleWildlife } from '../src/game/wildlife';

function hill() {
  const L = new Level(18, 46);
  for (let x = 0; x < L.w; x++) for (let y = 32; y < L.h; y++) L.set(x,y,T.SOLID,4);
  for (let i = 0; i <= 10; i++) L.relief[i + 3] = Math.sin(i / 10 * Math.PI) ** 2 * 24;
  return L;
}

describe('Relevo da selva e ambientação', () => {
  it.each([1, -1])('atravessa uma colina andando no sentido %i, sem salto nem parede', dir => {
    const L = hill(), b = newBody(26,48);
    b.x = (dir > 0 ? 2 : 15) * TILE; b.y = 1024 - b.h/2 - 0.001; b.onGround = true;
    let highest = b.y;
    for (let i = 0; i < 130; i++) {
      b.vx = dir * 196; b.vy += 1500 / 60;
      moveBody(b,1/60,L);
      expect(b.wallDir).toBe(0);
      highest = Math.min(highest,b.y);
    }
    expect(highest).toBeLessThan(1024 - b.h/2 - 20);
    expect(Math.abs(b.x - ((dir > 0 ? 2 : 15) * TILE + dir * 196 * 130 / 60))).toBeLessThan(0.01);
    expect(b.onGround).toBe(true);
  });
  it('salta livremente e pousa sobre a superfície visual, também encontrada pelo raycast', () => {
    const L = hill(), b = newBody(26,48);
    b.x = 8*TILE; b.y = L.reliefSurface(b.x)! - b.h/2 - 0.001; b.onGround = true;
    b.vy = -420;
    moveBody(b,1/60,L);
    expect(b.onGround).toBe(false);
    const firstY = b.y;
    for (let i = 0; i < 60; i++) { b.vy += 1500/60; moveBody(b,1/60,L); }
    expect(b.y).toBeGreaterThan(firstY);
    expect(b.y + b.h/2).toBeCloseTo(L.reliefSurface(b.x)!,1);
    expect(L.solidAtPx(b.x,1008)).toBe(true);
    expect(L.groundBelow(b.x,980)).toBe(L.reliefSurface(b.x));
    expect(L.rayHit(b.x,980,b.x,1030)).toBeLessThan(0.6);
  });
  it('preserva os acessos aos checkpoints e mantém pedras e equipamento decorativos', () => {
    const j = buildJungle();
    expect([...j.level.relief].filter(v => v > 5).length).toBeGreaterThan(25);
    for (const c of j.checkpoints) expect(j.level.reliefSurface(c.x)).toBeNull();
    expect(j.decos.some(d => d.kind === 'patrolCamp')).toBe(true);
    expect(j.decos.some(d => d.kind === 'jCattails')).toBe(true);
    expect(j.decos.some(d => d.kind === 'jSedge' && d.layer === 'front')).toBe(true);
    expect(j.props.every(p => !['jRock','jSedge','patrolCamp'].includes(p.kind))).toBe(true);
    const fauna = new JungleWildlife(j).habitats.map(h => h.x).sort((a,b)=>a-b);
    for (let i = 1; i < fauna.length; i++) expect(fauna[i]-fauna[i-1]).toBeGreaterThan(1300);
    const c = buildLevel();
    const city = new JungleWildlife(c).cityAnimals;
    expect(new Set(city.map(a => a.kind)).size).toBe(3);
    for (let i = 1; i < city.length; i++) expect(city[i].x-city[i-1].x).toBeGreaterThanOrEqual(2800);
  });
});
