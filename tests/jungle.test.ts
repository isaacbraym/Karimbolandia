import { describe, it, expect } from 'vitest';
import { World } from '../src/game/world';
import { buildJungle, LAKE_X0, LAKE_X1, LAKE_TOP, LAKE_FLOOR } from '../src/game/level/jungle';
import { TILE, T } from '../src/game/level';
import { analyzeReach } from '../src/game/level/reach';
import { RUN } from '../src/game/movement';
import { newCtl } from './helpers/bot';

const data = buildJungle();

function jungleWorld() {
  const w = new World(buildJungle());
  w.screenToWorldFn = (x, y) => ({ x, y });
  w.invulnerable = true;
  return w;
}

describe('Fase 2 (selva): dados', () => {
  it('é a fase 2, sem Nômad nem chefe, com pântanos e um lago fundo', () => {
    expect(data.stage).toBe(2);
    expect(data.enemies.some((e) => e.type === 'boss')).toBe(false);
    const swamps = data.water.filter((z) => z.kind === 'swamp');
    const lakes = data.water.filter((z) => z.kind === 'lake');
    expect(swamps.length).toBeGreaterThanOrEqual(3);
    expect(lakes.length).toBe(1);
    expect(lakes[0].h).toBeGreaterThan(8 * TILE);
    expect(data.finishX).toBeGreaterThan(LAKE_X1 * TILE);
  });

  it('inimigos são só humanos (mercenários) — nada de robôs', () => {
    const human = new Set(['rifle', 'shotgun', 'shield', 'sniper']);
    expect(data.enemies.filter((e) => !human.has(e.type))).toEqual([]);
  });

  it('nenhum inimigo, item ou caixa embutido em tile sólido', () => {
    const L = data.level;
    const bad: string[] = [];
    for (const e of data.enemies) if (L.solidAtPx(e.x, e.y - 20)) bad.push(`inimigo ${e.type} @${Math.floor(e.x / TILE)}`);
    for (const p of data.props) if (L.solidAtPx(p.x, p.y - 8)) bad.push(`prop ${p.kind} @${Math.floor(p.x / TILE)}`);
    for (const p of data.pickups) if (L.solidAtPx(p.x, p.y)) bad.push(`pickup ${p.kind} @${Math.floor(p.x / TILE)}`);
    expect(bad).toEqual([]);
  });

  it('inimigos terrestres nascem sobre chão firme e fora da água', () => {
    const L = data.level;
    const bad: string[] = [];
    for (const e of data.enemies) {
      const t = L.get(Math.floor(e.x / TILE), Math.round(e.y / TILE));
      if (t !== T.SOLID && t !== T.ONEWAY) bad.push(`${e.type} @${Math.floor(e.x / TILE)} sem chão`);
      if (data.water.some((z) => e.x >= z.x && e.x < z.x + z.w && e.y > z.y)) bad.push(`${e.type} @${Math.floor(e.x / TILE)} na água`);
    }
    expect(bad).toEqual([]);
  });

  it('o lago tem fundo (não é um buraco mortal)', () => {
    const w = jungleWorld();
    const lake = data.water.find((z) => z.kind === 'lake')!;
    for (const p of w.pits) expect(p.x1 <= lake.x || p.x0 >= lake.x + lake.w).toBe(true);
    for (let tx = LAKE_X0; tx < LAKE_X1; tx++) expect(data.level.isSolid(tx, LAKE_FLOOR)).toBe(true);
  });
});

describe('Fase 2 (selva): caminho alcançável', () => {
  it('a pé, do início até a beira do lago; e da margem até a saída', () => {
    const margem = data.checkpoints.find((c) => c.name === 'Margem')!;
    const res = analyzeReach(data, [{ x: margem.x, y: margem.y }]);
    const missing: string[] = [];
    for (const c of data.checkpoints) {
      const tx = Math.floor(c.x / TILE);
      const ty = Math.round(c.y / TILE);
      if (!res.reached.has(res.key(tx, ty))) missing.push(c.name);
    }
    expect(missing).toEqual([]);
    const fx = Math.floor(data.finishX / TILE);
    expect(res.reached.has(res.key(fx, 32))).toBe(true);
  });
});

describe('Fase 2 (selva): água', () => {
  it('cair no lago veste o traje e o Karimbo nada até a outra margem', () => {
    const w = jungleWorld();
    const ctl = newCtl();
    // pula do paredão para dentro do lago
    w.player.reset((LAKE_X0 - 2) * TILE, 32 * TILE);
    w.cameraSnap();
    let wasSwimming = false;
    let suited = false;
    let out = false;
    for (let f = 0; f < 60 * 40 && !out; f++) {
      ctl.moveX = 1;
      // braçadas ritmadas; perto da margem, sobe e salta para fora
      const press = f % 18 === 0;
      ctl.jump.pressed = press;
      ctl.jump.held = press || f % 18 < 6;
      w.update(1 / 60, ctl);
      if (w.player.swimming) wasSwimming = true;
      if (w.player.suitOn) suited = true;
      if (w.player.x > LAKE_X1 * TILE + 40 && w.player.body.onGround && !w.player.swimming) out = true;
    }
    expect(wasSwimming).toBe(true);
    expect(suited).toBe(true);
    expect(out).toBe(true);
  });

  it('nadando o Karimbo afunda devagar (sem a gravidade de terra)', () => {
    const w = jungleWorld();
    const ctl = newCtl();
    w.player.reset(300 * TILE, (LAKE_TOP + 4) * TILE);
    for (let f = 0; f < 30; f++) w.update(1 / 60, ctl);
    expect(w.player.swimming).toBe(true);
    expect(w.player.body.vy).toBeLessThan(80);
    expect(w.player.body.vy).toBeGreaterThan(-1);
  });

  it('no pântano anda mais devagar', () => {
    const w = jungleWorld();
    const ctl = newCtl();
    const swamp = data.water.find((z) => z.kind === 'swamp')!;
    w.player.reset(swamp.x + 3 * TILE, 33 * TILE);
    ctl.moveX = 1;
    for (let f = 0; f < 30; f++) w.update(1 / 60, ctl);
    expect(w.water.wadeDepth(w.player.x, w.player.feetY)).toBeGreaterThan(10);
    expect(Math.abs(w.player.body.vx)).toBeLessThan(RUN * 0.8);
  });

  it('peixes nunca saem da água nem entram nas pedras', () => {
    const w = jungleWorld();
    const ctl = newCtl();
    expect(w.water.fish.length).toBeGreaterThan(20);
    w.player.reset(300 * TILE, (LAKE_TOP + 4) * TILE);
    w.cameraSnap();
    for (let f = 0; f < 60 * 12; f++) {
      ctl.moveX = Math.sin(f / 50);
      w.update(1 / 60, ctl);
    }
    const bad = w.water.fish.filter((f) => {
      const z = f.zone;
      return f.x < z.x || f.x > z.x + z.w || f.y < z.y || f.y > z.y + z.h || w.level.solidAtPx(f.x, f.y);
    });
    expect(bad.length).toBe(0);
  });
});
