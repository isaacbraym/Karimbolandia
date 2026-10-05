import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TILE } from '../src/game/level';

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

describe('minimapa do lago', () => {
  it('revela um círculo, conta % sobre água e salva/carrega o bitset', async () => {
    const w = await jungle();
    const m = w.lakeMap!;
    expect(m).not.toBeNull();
    expect(m.percent()).toBe(0);
    const fresh = m.reveal(518 * TILE, 95 * TILE);
    expect(fresh).toBeGreaterThan(0);
    expect(m.reveal(518 * TILE, 95 * TILE)).toBe(0); // mesma célula: nada novo
    const s = m.toSave()!;
    m.reset();
    expect(m.percent()).toBe(0);
    m.load(s);
    expect(m.percent()).toBeGreaterThan(0);
    m.load('AAAA'); // tamanho errado: ignora sem lançar
    expect(m.percent()).toBeGreaterThan(0);
  });

  it('nada visto => nada para salvar; a fase 1 não tem minimapa', async () => {
    const w = await jungle();
    expect(w.lakeMap!.toSave()).toBeUndefined();
    const { World } = await import('../src/game/world');
    const { buildLevel } = await import('../src/game/level/index');
    expect(new World(buildLevel()).lakeMap).toBeNull();
  });

  it('o laguinho da aldeia fica fora do mapa', async () => {
    const w = await jungle();
    const m = w.lakeMap!;
    const pond = w.data.water.find((z) => z.kind === 'lake' && (z.surface ?? z.y) !== 34 * TILE)!;
    expect(pond).toBeTruthy();
    expect(m.contains(pond.x + 16, pond.y + 16)).toBe(false);
    expect(m.contains(518 * TILE, 95 * TILE)).toBe(true);
  });

  it('todo marco está em água do mapa e vira banner uma vez só (também depois de carregar o save)', async () => {
    const w = await jungle();
    const { ATLANTIS_LANDMARKS } = await import('../src/game/level/atlantis');
    const m = w.lakeMap!;
    for (const lm of ATLANTIS_LANDMARKS) {
      expect(m.contains(lm.tx * TILE + 16, lm.ty * TILE), lm.id).toBe(true);
      expect(m.isWater(lm.tx * TILE + 16, lm.ty * TILE), lm.id).toBe(true);
    }
    const banner = vi.fn();
    w.hooks.onBanner = banner;
    w.player.body.x = 518 * TILE; w.player.body.y = 95 * TILE;
    w.player.swimming = true;
    w.update(1 / 60, (await import('./helpers/bot')).newCtl());
    expect(m.landmarkSeen('praca')).toBe(true);
    const calls = banner.mock.calls.filter((c) => c[0] === 'DESCOBERTO!');
    expect(calls.length).toBe(1);
    expect(calls[0][1]).toContain('Praça do Pensador');
    w.update(1 / 60, (await import('./helpers/bot')).newCtl());
    expect(banner.mock.calls.filter((c) => c[0] === 'DESCOBERTO!').length).toBe(1);
    const saved = m.toSave()!;
    const w2 = await jungle();
    const b2 = vi.fn();
    w2.hooks.onBanner = b2;
    w2.lakeMap!.load(saved);
    w2.player.body.x = 518 * TILE; w2.player.body.y = 95 * TILE;
    w2.player.swimming = true;
    w2.update(1 / 60, (await import('./helpers/bot')).newCtl());
    expect(b2.mock.calls.filter((c) => c[0] === 'DESCOBERTO!').length).toBe(0);
  });

  it('valida o campo no save: base64 curto, tamanho e formato', async () => {
    const { validateSave } = await import('../src/core/saveValidation');
    const { freshSave } = await import('../src/game/save');
    const w = await jungle();
    const m = w.lakeMap!;
    m.reveal(518 * TILE, 95 * TILE);
    const good = m.toSave()!;
    expect(validateSave({ ...freshSave(2), lakeMap: 'não é base64!' })).toBeNull();
    expect(validateSave({ ...freshSave(2), lakeMap: 'A'.repeat(1025) })).toBeNull();
    expect(validateSave(freshSave(2))).not.toBeNull();
    expect(validateSave({ ...freshSave(2), lakeMap: good })?.lakeMap).toBe(good);
  });

  it('o save do jogo grava e restaura o mapa explorado', async () => {
    const { captureSave, applySave } = await import('../src/game/save');
    const w = await jungle();
    w.lakeMap!.reveal(544 * TILE, 92 * TILE);
    const pct = w.lakeMap!.percent();
    const snap = captureSave(w);
    expect(typeof snap.lakeMap).toBe('string');
    const w2 = await jungle();
    applySave(w2, snap);
    expect(w2.lakeMap!.percent()).toBe(pct);
    expect(w2.lakeMap!.landmarkSeen('palacio')).toBe(true);
  });
});
