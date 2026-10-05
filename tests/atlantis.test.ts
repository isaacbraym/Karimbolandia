import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newCtl } from './helpers/bot';

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
  return w;
}

describe('Atlântida e o lago fundo', () => {
  it('o fôlego sem traje dura exatamente 15% mais no raso e sob pressão', async () => {
    const w=await jungle(),p=w.player;
    expect(p.oxyMax).toBeCloseTo(12*1.15);expect(p.oxygen).toBe(p.oxyMax);
    p.swimming=true;p.body.x=520*32+16;
    for(const depth of [7,16]) {
      p.body.y=(34+depth)*32+22;p.oxygen=p.oxyMax;
      const rate=1+Math.max(0,depth-10)*0.45;
      (p as any).updateOxygen(w,12/rate);
      expect(p.oxygen).toBeCloseTo(1.8); // The former full breath has elapsed.
      (p as any).updateOxygen(w,1.79/rate);
      expect(p.oxygen).toBeGreaterThan(0);
      (p as any).updateOxygen(w,.02/rate);
      expect(p.oxygen).toBe(0);
    }
    p.reset(p.x,p.body.y);expect(p.oxygen).toBeCloseTo(13.8);
  });
  it('o lago ficou 2× mais largo e 7× mais fundo, com a superfície real em cima', async () => {
    const { DEEP_X0, DEEP_X1, ABYSS_FLOOR, LAKE_X0, LAKE_X1, LAKE_TOP, LAKE_FLOOR } = await import('../src/game/level/atlantis');
    const w = await jungle();
    expect(DEEP_X1 - DEEP_X0).toBe(2 * (LAKE_X1 - LAKE_X0));
    expect(ABYSS_FLOOR - LAKE_TOP).toBe(7 * (LAKE_FLOOR - LAKE_TOP));
    const deep = w.data.water.find((z) => z.surface !== undefined)!;
    expect(deep.surface).toBe(LAKE_TOP * 32);
    expect(w.data.pickups.filter((p) => p.kind === 'relic').map((p) => p.itemId).sort()).toEqual([0, 1, 2, 3, 4]);
    expect(w.data.enemies.filter((e) => e.type === 'piranha').length).toBeGreaterThanOrEqual(30);
    const schools = new Map<number, number>();
    for (const e of w.data.enemies) if (e.type === 'piranha') schools.set(e.school!, (schools.get(e.school!) ?? 0) + 1);
    expect(schools.size).toBeGreaterThanOrEqual(5);
    expect(schools.size).toBeLessThanOrEqual(6);
    for (const n of schools.values()) { expect(n).toBeGreaterThanOrEqual(6); expect(n).toBeLessThanOrEqual(12); }
  });

  it('sem traje o ar acaba (e mais rápido no fundo); com o traje do Sivirino não acaba', async () => {
    const w = await jungle();
    const { ABYSS_FLOOR } = await import('../src/game/level/atlantis');
    w.enemies = [];
    const p = w.player;
    const ctl = newCtl();
    const dive = (row: number, col = 560) => {
      p.reset(col * 32 + 16, row * 32);
      p.oxygen = p.oxyMax;
      for (let f = 0; f < 60 * 3; f++) { p.body.vy = 0; w.update(1 / 60, ctl); }
      return p.oxyMax - p.oxygen;
    };
    const shallow = dive(41, 520); // lago antigo: 7 blocos abaixo da superfície
    const deep = dive(ABYSS_FLOOR - 4);
    expect(shallow).toBeGreaterThan(1);
    expect(shallow).toBeLessThan(4);
    expect(deep).toBeGreaterThan(shallow * 3);
    const s = await import('../src/core/storage');
    s.progress.ownedSkins.push('diver');
    s.progress.equippedSkin = 'diver';
    expect(dive(ABYSS_FLOOR - 4)).toBeLessThan(0.01);
    expect(p.suitOn).toBe(true);
  });

  it('cardume ataca quem entra no território, morde e morre fácil', async () => {
    const w = await jungle();
    const p = w.player;
    const school = w.enemies.filter((e) => e.type === 'piranha' && e.spawn.school === 101);
    const home = { x: school[0].spawn.homeX!, y: school[0].spawn.homeY! };
    for (const e of w.enemies) if (!school.includes(e)) e.alive = false;
    p.reset(home.x + 120, home.y + 20);
    w.cameraSnap();
    const hp0 = p.hp;
    const ctl = newCtl();
    for (let f = 0; f < 60 * 4; f++) { p.body.vy = 0; p.invuln = 0; w.update(1 / 60, ctl); }
    expect(p.hp).toBeLessThan(hp0);
    const fish = school.find((e) => e.alive)!;
    fish.hurt(w, 12, { kx: 0, ky: 0, x: fish.x, y: fish.y, type: 'bullet', dir: 1 });
    expect(fish.alive).toBe(false);
  });
});

describe('Trajes, relíquias e melhorias do Karimbo', () => {
  it('o traje de mergulho só se compra com o Sivirino; o Atlante sai com as 5 relíquias', async () => {
    const s = await import('../src/core/storage');
    const { chooseSkin, coinBalance } = await import('../src/core/skins');
    s.progress.coinsEarned = 2000;
    s.progress.coinsMigrated = true;
    s.saveProgress();
    expect(chooseSkin('diver')).toBe('locked');
    expect(chooseSkin('diver', 'sivirino')).toBe('bought');
    expect(coinBalance()).toBe(2000 - 480);
    expect(chooseSkin('atlante', 'sivirino')).toBe('locked');
    const w = await jungle();
    const { Pickup } = await import('../src/game/pickups');
    for (let i = 0; i < 5; i++) w.collect(new Pickup('relic', 0, 0, -1, i));
    expect(s.progress.relics).toEqual([0, 1, 2, 3, 4]);
    expect(s.progress.ownedSkins).toContain('atlante');
    expect(chooseSkin('atlante')).toBe('equipped');
    s.reloadProgress();
    expect(s.progress.relics).toHaveLength(5);
  });

  it('melhorias do Karimbo valem no jogo (vida, ar, granadas)', async () => {
    const s = await import('../src/core/storage');
    const { buyGear } = await import('../src/core/forge');
    s.progress.coinsEarned = 2000;
    s.progress.coinsMigrated = true;
    s.saveProgress();
    const w = await jungle();
    const hp = w.player.maxHp, air = w.player.oxyMax;
    for (const id of ['karimbo.vida.1', 'karimbo.folego.1', 'karimbo.granada.1']) expect(buyGear(id, w.player.weapons)).toBe('bought');
    w.player.applyPerks(true);
    w.player.resetInventory();
    expect(w.player.maxHp).toBe(hp + 20);
    expect(w.player.oxyMax).toBeCloseTo(air * 1.4);
    expect(w.player.grenades).toBe(4);
  });
});
