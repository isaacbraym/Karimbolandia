import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newCtl } from './helpers/bot';
import { TILE } from '../src/game/level';
import { StrokeRhythm } from '../src/game/lake/stroke';

let disk: Map<string, string>;
beforeEach(() => {
  disk = new Map();
  vi.stubGlobal('localStorage', { get length() { return disk.size; }, key: (i: number) => [...disk.keys()][i] ?? null, getItem: (k: string) => disk.get(k) ?? null, setItem: (k: string, v: string) => disk.set(k, v) });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

async function jungle() {
  const { World } = await import('../src/game/world');
  const { buildJungle } = await import('../src/game/level/jungle');
  const w = new World(buildJungle());
  w.director.cine = null;
  w.invulnerable = true;
  w.enemies = []; // sem piranhas por perto: a cena é sobre o monumento
  return w;
}
/** Põe o Karimbo nadando ao lado da estátua e roda a simulação até acabar (ou `max` s). */
function runScene(w: Awaited<ReturnType<typeof jungle>>, max = 12) {
  const ctl = newCtl();
  const p = w.player;
  p.reset(w.thinker.x - 3 * TILE, w.thinker.y - 5 * TILE);
  p.swimming = true;
  let t = 0;
  let lockedFrames = 0;
  for (; t < max * 60; t++) {
    w.update(1 / 60, ctl);
    if (w.thinker.active) lockedFrames++;
    if (w.thinker.done) break;
  }
  return { frames: t, lockedFrames };
}

describe('Praça do Pensador: revelação única', () => {
  it('dispara uma vez, trava, devolve o controle em ≤ 7 s e marca o ID', async () => {
    const w = await jungle();
    const banners: string[] = [];
    w.hooks.onBanner = (t) => banners.push(t);
    const returned = vi.fn();
    w.hooks.onControlReturned = returned;
    const { THINKER_ID } = await import('../src/game/lake/thinkerReveal');
    expect(w.encounters.completed.has(THINKER_ID)).toBe(false);
    const { frames, lockedFrames } = runScene(w);
    expect(w.thinker.done).toBe(true);
    expect(frames / 60).toBeLessThanOrEqual(7.2);
    expect(lockedFrames / 60).toBeGreaterThan(6);
    expect(w.encounters.completed.has(THINKER_ID)).toBe(true);
    expect(returned).toHaveBeenCalledTimes(1);
    expect(banners.filter((b) => b === 'O PENSADOR').length).toBe(1);
    expect(w.musicState).toBe('explore');
    // não dispara de novo: nadar até a estátua outra vez nada faz
    const ctl = newCtl();
    w.player.reset(w.thinker.x + 2 * TILE, w.thinker.y - 4 * TILE);
    w.player.swimming = true;
    for (let i = 0; i < 120; i++) { w.update(1 / 60, ctl); expect(w.thinker.active).toBe(false); }
    expect(banners.filter((b) => b === 'O PENSADOR').length).toBe(1);
  });

  it('anéis de neon: 40 peixes em duas órbitas com sentidos opostos (e nunca duplicam)', async () => {
    const w = await jungle();
    runScene(w);
    const ringFish = w.water.fish.filter((f) => f.ring >= 0);
    expect(ringFish.length).toBe(40);
    expect(w.water.rings.map((r) => r.r)).toEqual([150, 220]);
    expect(Math.sign(w.water.rings[0].w)).toBe(-Math.sign(w.water.rings[1].w));
    w.thinker.reset(w);
    w.respawn();
    for (let i = 0; i < 10; i++) w.update(1 / 60, newCtl());
    expect(w.water.fish.filter((f) => f.ring >= 0).length).toBe(40);
  });

  it('save com o ID concluído monta o estado final sem cena', async () => {
    const w = await jungle();
    const { THINKER_ID } = await import('../src/game/lake/thinkerReveal');
    w.encounters.completed.add(THINKER_ID);
    const ctl = newCtl();
    w.player.reset(w.thinker.x - 3 * TILE, w.thinker.y - 5 * TILE);
    w.player.swimming = true;
    for (let i = 0; i < 60; i++) { w.update(1 / 60, ctl); expect(w.thinker.active).toBe(false); }
    expect(w.thinker.crystal).toBe(1);
    expect(w.thinker.light).toBeCloseTo(0.35);
    expect(w.water.fish.filter((f) => f.ring >= 0).length).toBe(40);
  });

  it('não dispara com piranha agressiva por perto', async () => {
    const w = await jungle();
    const { schoolFor } = await import('../src/game/enemies/piranha');
    const sp = w.data.enemies.find((e) => e.type === 'piranha')!;
    const sc = schoolFor(w, { ...sp, school: 9999, homeX: w.thinker.x + 200, homeY: w.thinker.y - 120 });
    sc.aggro = true;
    const ctl = newCtl();
    w.player.reset(w.thinker.x - 3 * TILE, w.thinker.y - 5 * TILE);
    w.player.swimming = true;
    for (let i = 0; i < 90; i++) { w.update(1 / 60, ctl); sc.aggro = true; }
    expect(w.thinker.active).toBe(false);
    expect(w.thinker.t).toBe(-1);
  });

  it('morrer no meio aborta sem concluir: a cena pode acontecer de novo', async () => {
    const w = await jungle();
    const { THINKER_ID } = await import('../src/game/lake/thinkerReveal');
    const ctl = newCtl();
    w.player.reset(w.thinker.x - 3 * TILE, w.thinker.y - 5 * TILE);
    w.player.swimming = true;
    for (let i = 0; i < 90; i++) w.update(1 / 60, ctl);
    expect(w.thinker.active).toBe(true);
    w.player.mode = 'dead';
    w.update(1 / 60, ctl);
    expect(w.thinker.active).toBe(false);
    expect(w.encounters.completed.has(THINKER_ID)).toBe(false);
    expect(w.camera.focus).toBeNull();
  });
});

describe('12 pérolas do lago e cardume fiel', () => {
  it('12 pérolas, IDs depois de todos os tesouros, em tiles livres de água e ligadas à fenda', async () => {
    const w = await jungle();
    const { FENDA, LAKE_TOP } = await import('../src/game/level/atlantis');
    const pearls = w.data.pickups.filter((p) => p.kind === 'pearl');
    expect(pearls.length).toBe(12);
    expect(w.pearlTotal()).toBe(12);
    const others = w.data.pickups.filter((p) => p.kind !== 'pearl');
    expect(Math.min(...pearls.map((p) => p.id))).toBeGreaterThan(Math.max(...others.map((p) => p.id)));
    // os pickups antigos mantêm o índice (IDs): relíquias seguem 0..4 na ordem
    expect(others.filter((p) => p.kind === 'relic').map((p) => p.itemId)).toEqual([0, 1, 2, 3, 4]);
    // flood fill sobre tiles não sólidos, a partir da fenda
    const L = w.level;
    const seen = new Set<number>();
    const stack: [number, number][] = [[(FENDA[0] + FENDA[1]) >> 1, LAKE_TOP + 2]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      const k = y * 4096 + x;
      if (seen.has(k) || x < 0 || y < LAKE_TOP || y >= L.h || L.get(x, y) !== 0) continue;
      seen.add(k);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    for (const p of pearls) {
      const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
      expect(L.get(tx, ty), `tile da pérola ${p.id}`).toBe(0);
      expect(w.water.zoneAt(p.x, p.y)?.kind, `zona ${p.id}`).toBe('lake');
      expect(seen.has(ty * 4096 + tx), `alcance ${p.id} (${tx},${ty})`).toBe(true);
    }
  });

  it('cada pérola vale 5 moedas e a contagem vem dos IDs coletados', async () => {
    const w = await jungle();
    const { Pickup } = await import('../src/game/pickups');
    const pearls = w.data.pickups.filter((p) => p.kind === 'pearl');
    const banners: string[] = [];
    w.hooks.onBanner = (t) => banners.push(t);
    const t0 = w.tokens;
    for (let i = 0; i < pearls.length; i++) {
      const s = pearls[i];
      w.collect(new Pickup('pearl', s.x, s.y, s.id));
      expect(w.pearls()).toBe(i + 1);
    }
    expect(w.tokens - t0).toBe(12 * 5);
    expect(banners.filter((b) => b === 'CARDUME FIEL!').length).toBe(1);
  });

  it('12/12: o cardume fiel (20 neons) nasce no lago, acompanha o Karimbo e não duplica', async () => {
    const w = await jungle();
    const { Pickup } = await import('../src/game/pickups');
    for (const s of w.data.pickups.filter((p) => p.kind === 'pearl')) w.collect(new Pickup('pearl', s.x, s.y, s.id));
    const ctl = newCtl();
    w.player.reset(540 * TILE, 38 * TILE);
    w.player.swimming = true;
    w.update(1 / 60, ctl);
    expect(w.water.loyalLead).toBeGreaterThanOrEqual(0);
    const members = w.water.fish.filter((f) => f.loyal);
    expect(members.length).toBe(21);
    for (let i = 0; i < 600; i++) w.update(1 / 60, ctl);
    const L = w.water.fish[w.water.loyalLead];
    expect(Math.hypot(L.x - w.player.x, L.y - w.player.y)).toBeLessThan(160);
    for (let i = 0; i < 60; i++) w.update(1 / 60, ctl);
    expect(w.water.fish.filter((f) => f.loyal).length).toBe(21);
  });
});

describe('embalo de braçadas', () => {
  it('no ritmo (0,25–0,65 s) chega a +24%; fora do ritmo volta a 1; decai em 1 s', () => {
    const r = new StrokeRhythm();
    r.stroke();
    expect(r.speedMul).toBeCloseTo(1);
    for (let i = 0; i < 2; i++) { r.update(0.4); r.stroke(); }
    expect(r.level).toBe(3);
    expect(r.speedMul).toBeCloseTo(1.24);
    r.update(0.4); r.stroke();
    expect(r.level).toBe(3); // teto
    r.update(0.1); r.stroke(); // rápido demais: ignorada
    expect(r.level).toBe(3);
    r.update(0.9); r.stroke(); // devagar demais: recomeça
    expect(r.level).toBe(1);
    r.update(0.4); r.stroke();
    r.update(1.1);
    expect(r.level).toBe(1);
    expect(r.speedMul).toBe(1);
  });

  it('nadando no ritmo a velocidade horizontal nunca passa de +24% (mais o tranco da braçada)', async () => {
    const w = await jungle();
    const p = w.player;
    p.reset(500 * TILE, 38 * TILE);
    p.swimming = true;
    const { karimboStats } = await import('../src/core/gearCatalog');
    const { progress } = await import('../src/core/storage');
    const base = 150 * karimboStats(progress.gear).swim;
    const ctl = newCtl();
    let max = 0, maxLevel = 1;
    for (let f = 0; f < 60 * 8; f++) {
      ctl.moveX = 1;
      ctl.jump.pressed = f % 24 === 0; // uma braçada a cada 0,4 s
      w.update(1 / 60, ctl);
      if (p.body.x > 540 * TILE) p.body.x = 500 * TILE;
      max = Math.max(max, Math.abs(p.body.vx));
      maxLevel = Math.max(maxLevel, p.rhythm.level);
    }
    expect(maxLevel).toBe(3);
    expect(max).toBeLessThanOrEqual(base * 1.24 + 40 + 1);
    expect(max).toBeGreaterThan(base * 1.1);
  });
});

describe('correções da revisão (T1–T4)', () => {
  it('o diretor não sobrescreve a música monument durante a revelação', async () => {
    const w = await jungle();
    const ctl = newCtl();
    w.player.reset(w.thinker.x - 3 * TILE, w.thinker.y - 5 * TILE);
    w.player.swimming = true;
    const calls: string[] = [];
    w.hooks.onMusic = (s) => calls.push(s);
    for (let i = 0; i < 6 * 60; i++) w.update(1 / 60, ctl);
    expect(w.thinker.active).toBe(true);
    expect(calls.filter((s) => s === 'monument').length).toBe(1);
    expect(calls.filter((s) => s !== 'monument').length).toBe(0);
  });

  it('o cardume fiel que nasce no lago raso se mexe e acompanha o Karimbo', async () => {
    const w = await jungle();
    const { Pickup } = await import('../src/game/pickups');
    for (const s of w.data.pickups.filter((p) => p.kind === 'pearl')) w.collect(new Pickup('pearl', s.x, s.y, s.id));
    const ctl = newCtl();
    w.player.reset(500 * TILE, 37 * TILE); // lago raso (superfície 34, fundo 44)
    w.player.swimming = true;
    w.update(1 / 60, ctl);
    const L = w.water.fish[w.water.loyalLead];
    const x0 = L.x;
    w.player.body.x += 300;
    for (let i = 0; i < 300; i++) { w.player.body.vx = 0; w.update(1 / 60, ctl); }
    expect(Math.abs(L.x - x0)).toBeGreaterThan(150);
  });

  it('o poraquê mantém o corpo unido ao passar atrás da pedra (espaçamento acompanha o encolhimento)', async () => {
    const w = await jungle();
    const eel = w.water.fish.find((f) => f.species === 'poraque')!;
    eel.depth = 1;
    for (let i = 0; i < 120; i++) { eel.depth = 1; w.water.update(1 / 60, -9999, -9999, false, 0, 1e9); }
    const s = eel.seg!;
    const gap = Math.hypot(s[2] - s[0], s[3] - s[1]);
    expect(gap).toBeLessThanOrEqual((eel.size * 0.78) / 6.5 + 1);
  });
});
