import { describe, it, expect } from 'vitest';
import { Level, T, TILE } from '../src/game/level';
import { newBody, moveBody } from '../src/game/physics';
import { clamp, approach, angleDiff, Rng, formatTime, mixColor, rectsOverlap } from '../src/core/math';
import { Input } from '../src/core/input';
import { computeRank } from '../src/ui/menus';
import { WEAPONS } from '../src/game/weapons';

function flatLevel() {
  const L = new Level(40, 20);
  for (let x = 0; x < 40; x++) for (let y = 15; y < 20; y++) L.set(x, y, T.SOLID);
  return L;
}

describe('física de colisão', () => {
  it('pousa no chão sólido e zera a velocidade vertical', () => {
    const L = flatLevel();
    const b = newBody(22, 50);
    b.x = 200;
    b.y = 200;
    b.vy = 900;
    for (let i = 0; i < 90; i++) {
      b.vy += 1780 / 60;
      moveBody(b, 1 / 60, L);
    }
    expect(b.onGround).toBe(true);
    expect(b.y + 25).toBeCloseTo(15 * TILE, 0);
  });

  it('não atravessa paredes em alta velocidade (sem tunneling)', () => {
    const L = flatLevel();
    L.set(10, 14, T.SOLID);
    L.set(10, 13, T.SOLID);
    L.set(10, 12, T.SOLID);
    const b = newBody(22, 50);
    b.x = 8 * TILE;
    b.y = 15 * TILE - 25;
    b.vx = 2400;
    moveBody(b, 1 / 20, L);
    expect(b.x).toBeLessThan(10 * TILE);
    expect(b.wallDir).toBe(1);
  });

  it('plataforma one-way: sobe atravessando e pousa por cima; descer com dropTimer', () => {
    const L = flatLevel();
    for (let x = 4; x < 12; x++) L.set(x, 12, T.ONEWAY);
    const b = newBody(22, 50);
    b.x = 6 * TILE;
    b.y = 15 * TILE - 25;
    b.vy = -700;
    for (let i = 0; i < 20; i++) {
      b.vy += 1780 / 60;
      moveBody(b, 1 / 60, L);
    }
    for (let i = 0; i < 90; i++) {
      b.vy += 1780 / 60;
      moveBody(b, 1 / 60, L);
    }
    expect(b.onOneWay).toBe(true);
    expect(b.y + 25).toBeCloseTo(12 * TILE, 0);
    b.dropTimer = 0.3;
    for (let i = 0; i < 40; i++) {
      b.vy += 1780 / 60;
      moveBody(b, 1 / 60, L);
    }
    expect(b.y + 25).toBeCloseTo(15 * TILE, 0);
  });

  it('raycast do nível detecta tile sólido', () => {
    const L = flatLevel();
    expect(L.rayHit(10, 10, 10, 15 * TILE + 5)).toBeGreaterThan(0);
    expect(L.rayHit(10, 10, 300, 10)).toBe(-1);
  });
});

describe('utilitários', () => {
  it('math básica', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(10, 0, 30)).toBe(0);
    expect(Math.abs(angleDiff(0.1, Math.PI * 2 - 0.1) + 0.2)).toBeLessThan(1e-9);
    expect(formatTime(125)).toBe('2:05');
    expect(mixColor('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 5, h: 5 })).toBe(true);
  });

  it('RNG determinístico', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 10; i++) expect(a.next()).toBe(b.next());
  });

  it('ranking S/A/B/C responde a desempenho', () => {
    const top = computeRank({ score: 60000, time: 800, emblems: 10, secrets: 3, deaths: 0 });
    const low = computeRank({ score: 3000, time: 3000, emblems: 0, secrets: 0, deaths: 12 });
    expect(top).toBe('S');
    expect(low).toBe('C');
  });

  it('armas: identidade e escala de dano coerentes', () => {
    expect(WEAPONS.shotgun.pellets).toBeGreaterThan(5);
    expect(WEAPONS.launcher.explosive).toBeTruthy();
    expect(WEAPONS.energy.pierce).toBeGreaterThan(0);
    expect(WEAPONS.pistol.ammoMax).toBe(Infinity);
    expect(WEAPONS.rifle.rate).toBeLessThan(WEAPONS.pistol.rate);
  });
});

describe('entrada unificada (toque)', () => {
  it('borda de pressionar/soltar e multitouch independente', () => {
    const inp = new Input();
    inp.touch.active = true;
    inp.touch.stickX = 1;
    inp.touch.held.fire = true;
    inp.touch.held.jump = true;
    inp.poll();
    expect(inp.state.moveX).toBe(1);
    expect(inp.state.fire.held && inp.state.fire.pressed).toBe(true);
    expect(inp.state.jump.pressed).toBe(true);
    inp.clearEdges();
    inp.poll();
    expect(inp.state.fire.pressed).toBe(false);
    inp.touch.held.fire = false; // soltar o fogo não cancela pulo nem movimento
    inp.poll();
    expect(inp.state.fire.released).toBe(true);
    expect(inp.state.jump.held).toBe(true);
    expect(inp.state.moveX).toBe(1);
  });
});
