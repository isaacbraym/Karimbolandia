import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newCtl } from './helpers/bot';

let disk: Map<string, string>;
beforeEach(() => {
  disk = new Map();
  vi.stubGlobal('localStorage', { get length() { return disk.size; }, key: (i: number) => [...disk.keys()][i] ?? null, getItem: (k: string) => disk.get(k) ?? null, setItem: (k: string, v: string) => disk.set(k, v) });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

async function world(level: 'facil' | 'normal' | 'dificil' = 'normal') {
  const d = await import('../src/core/difficulty');
  d.setDifficulty(level);
  const { World } = await import('../src/game/world');
  const { buildLevel } = await import('../src/game/level/index');
  const w = new World(buildLevel());
  w.player.lockInput = false;
  return w;
}

describe('Três níveis de dificuldade', () => {
  it('vida dos inimigos, dano recebido e quantidade de tropas crescem do FÁCIL ao DIFÍCIL', async () => {
    const levels = ['facil', 'normal', 'dificil'] as const;
    const stats: { hp: number; count: number; hit: number }[] = [];
    for (const lv of levels) {
      const w = await world(lv);
      const spawn = { id: 4242, type: 'rifle' as const, x: 400, y: 400 };
      const e = w.spawnEnemy(spawn);
      const hp0 = w.player.hp;
      w.player.invuln = 0;
      w.player.hit(w, 10, 1);
      stats.push({ hp: e.elite ? e.maxHp / 1.6 : e.maxHp, count: w.enemies.length, hit: hp0 - w.player.hp });
    }
    expect(stats[0].hp).toBeLessThan(stats[1].hp);
    expect(stats[1].hp).toBeLessThan(stats[2].hp);
    expect(stats[0].hit).toBeLessThan(stats[1].hit);
    expect(stats[1].hit).toBeLessThan(stats[2].hit);
    expect(stats[0].count).toBeLessThan(stats[1].count);
    expect(stats[1].count).toBeLessThan(stats[2].count);
  });

  it('DIFÍCIL promove soldados comuns e cria elites; FÁCIL não tem elites', async () => {
    const hard = await world('dificil');
    const types = new Set(hard.enemies.map(e => e.type));
    expect(types.has('shield') || types.has('shotgun')).toBe(true);
    expect(hard.enemies.filter(e => e.elite).length).toBeGreaterThan(2);
    const easy = await world('facil');
    expect(easy.enemies.some(e => e.elite)).toBe(false);
  });

  it('o save guarda o nível e a validação recusa valores inventados', async () => {
    const w = await world('dificil');
    const { captureSave } = await import('../src/game/save');
    const { validateSave } = await import('../src/core/saveValidation');
    const s = captureSave(w);
    expect(s.difficulty).toBe('dificil');
    expect(validateSave(s)?.difficulty).toBe('dificil');
    expect(validateSave({ ...s, difficulty: 'impossivel' })).toBeNull();
    const { difficulty: _drop, ...legacy } = s;
    expect(validateSave(legacy)?.difficulty).toBeUndefined();
  });
});

describe('Dano das armas contra blindagem', () => {
  it('plasma derrete blindado; pistola resiste; tiro na cabeça do soldado é crítico', async () => {
    const w = await world('normal');
    const { Bullet } = await import('../src/game/bullets');
    const heavy = w.spawnEnemy({ id: -2, type: 'heavy', x: 600, y: 400 });
    const hit = (weapon: 'pistol' | 'energy', e: typeof heavy, y = e.y) => {
      const before = e.hp;
      const b = new Bullet(e.x - 20, y, 600, 0, { team: 0, dmg: 10, weapon });
      e.hurt(w, 10, { kx: 1, ky: 0, x: e.x, y, type: 'bullet', dir: 1, bullet: b });
      return before - e.hp;
    };
    const pistol = hit('pistol', heavy);
    const plasma = hit('energy', heavy);
    expect(plasma).toBeGreaterThan(pistol * 1.6);
    const soldier = w.spawnEnemy({ id: -3, type: 'rifle', x: 800, y: 400 });
    const body = hit('pistol', soldier, soldier.y + 10);
    const head = hit('pistol', soldier, soldier.y - soldier.body.h * 0.45);
    expect(head).toBeCloseTo(body * 1.5);
  });
});

describe('Armas compradas são do Karimbo', () => {
  it('descarregada continua no inventário e volta com um carregador cheio ao achar munição', async () => {
    const w = await world('normal');
    const s = await import('../src/core/storage');
    s.progress.gear.push('rifle.unlock.1');
    w.player.resetInventory();
    const p = w.player;
    p.weapons.set('rifle', 0);
    p.magazines.set('rifle', 0);
    p.cur = 'pistol';
    expect(p.hasEmptyOwned()).toBe(true);
    expect(p.addAmmo(w)).toBe(true);
    expect(p.weapons.get('rifle')).toBeGreaterThanOrEqual(18);
    expect(p.cur).toBe('rifle');
    expect(p.loadedAmmo).toBe(18);
    expect(p.hasEmptyOwned()).toBe(false);
  });
});

describe('Falas dos moradores', () => {
  it('parado perto de um grupo, cada morador fala no máximo uma vez', async () => {
    const w = await world('normal');
    w.invulnerable = true;
    const c = w.crowd.list[0];
    w.player.reset(c.x + 40, c.y);
    w.cameraSnap();
    const ctl = newCtl();
    const talks = new Map<object, number>();
    let last: object | null = null;
    for (let i = 0; i < 60 * 40; i++) {
      w.update(1 / 60, ctl);
      const t = w.crowd.talker;
      if (t && t !== last) talks.set(t, (talks.get(t) ?? 0) + 1);
      last = t;
    }
    expect(talks.size).toBeGreaterThan(0);
    for (const n of talks.values()) expect(n).toBe(1);
  });
});
