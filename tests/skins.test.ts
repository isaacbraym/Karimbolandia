import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let disk: Map<string, string>;
beforeEach(() => {
  disk = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => disk.get(k) ?? null, setItem: (k: string, v: string) => disk.set(k, v) });
  vi.resetModules();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('Moedas e trajes persistentes', () => {
  it('aproveita as fichas de um save antigo somente uma vez', async () => {
    const { writeSave, freshSave } = await import('../src/game/save');
    writeSave({ ...freshSave(2), tokens: 120 });
    const { ensureWallet, coinBalance, chooseSkin } = await import('../src/core/skins');
    const { progress } = await import('../src/core/storage');
    ensureWallet();
    expect(coinBalance()).toBe(120);
    expect(chooseSkin('explorer')).toBe('bought');
    expect(coinBalance()).toBe(20);
    ensureWallet(); ensureWallet();
    expect(coinBalance()).toBe(20);
    vi.resetModules();
    const restored = await import('../src/core/skins');
    restored.ensureWallet();
    expect(restored.coinBalance()).toBe(20);
    expect(progress.ownedSkins).toEqual(['explorer']);
    expect((await import('../src/core/storage')).progress.equippedSkin).toBe('explorer');
  });

  it('cobra cada traje uma vez e permite voltar ao clássico de graça', async () => {
    const { chooseSkin, collectCoin, coinBalance } = await import('../src/core/skins');
    const { progress, saveProgress } = await import('../src/core/storage');
    for (let i = 0; i < 350; i++) collectCoin();
    saveProgress();
    expect(chooseSkin('explorer')).toBe('bought');
    expect(chooseSkin('neon')).toBe('bought');
    expect(coinBalance()).toBe(0);
    expect(chooseSkin('explorer')).toBe('equipped');
    expect(chooseSkin('classic')).toBe('equipped');
    expect(chooseSkin('neon')).toBe('equipped');
    expect(progress.ownedSkins).toEqual(['explorer', 'neon']);
    expect(coinBalance()).toBe(0);
  });

  it('não desbloqueia nem gasta com saldo insuficiente ou ID desconhecido', async () => {
    const { chooseSkin, coinBalance, collectCoin } = await import('../src/core/skins');
    const { progress } = await import('../src/core/storage');
    collectCoin();
    expect(chooseSkin('explorer')).toBe('insufficient');
    expect(chooseSkin('invalid' as never)).toBe('invalid');
    expect(coinBalance()).toBe(1);
    expect(progress.ownedSkins).toEqual([]);
    expect(progress.equippedSkin).toBe('classic');
  });

  it('restaurar um backup anterior à compra não devolve as moedas gastas', async () => {
    const { collectCoin, chooseSkin, coinBalance } = await import('../src/core/skins');
    const { exportBackup, parseBackup, applyProfile } = await import('../src/core/profile');
    for (let i = 0; i < 100; i++) collectCoin();
    const before = exportBackup();
    chooseSkin('explorer');
    applyProfile(parseBackup(before));
    expect(coinBalance()).toBe(0);
    expect((await import('../src/core/storage')).progress.ownedSkins).toEqual(['explorer']);
    chooseSkin('explorer');
    expect(coinBalance()).toBe(0);
  });

  it('exporta saldo, compras e traje equipado para restaurar em outro aparelho', async () => {
    const { collectCoin, chooseSkin } = await import('../src/core/skins');
    const { exportBackup, parseBackup, applyProfile } = await import('../src/core/profile');
    for (let i = 0; i < 380; i++) collectCoin();
    chooseSkin('explorer'); chooseSkin('neon');
    const backup = exportBackup();
    disk.clear(); vi.resetModules();
    const profile = await import('../src/core/profile');
    expect(profile.applyProfile(profile.parseBackup(backup))).toBe(true);
    expect((await import('../src/core/skins')).coinBalance()).toBe(30);
    const { progress } = await import('../src/core/storage');
    expect(progress.ownedSkins).toEqual(['explorer', 'neon']);
    expect(progress.equippedSkin).toBe('neon');
  });

  it('mantém moedas e compras separadas por perfil', async () => {
    const { collectCoin, chooseSkin, ensureWallet, coinBalance } = await import('../src/core/skins');
    const { setProfile } = await import('../src/core/persistence');
    const { reloadProgress, progress } = await import('../src/core/storage');
    for (let i = 0; i < 100; i++) collectCoin();
    chooseSkin('explorer');
    setProfile('B'); reloadProgress(); ensureWallet();
    expect(coinBalance()).toBe(0);
    expect(progress.equippedSkin).toBe('classic');
    expect(progress.ownedSkins).toEqual([]);
    setProfile(''); reloadProgress(); ensureWallet();
    expect(progress.ownedSkins).toEqual(['explorer']);
    expect(progress.equippedSkin).toBe('explorer');
  });

  it('a coleta não escreve no disco a cada moeda', async () => {
    const { ensureWallet, collectCoin } = await import('../src/core/skins');
    ensureWallet();
    const set = vi.spyOn(localStorage, 'setItem');
    for (let i = 0; i < 50; i++) collectCoin();
    expect(set).not.toHaveBeenCalled();
  });

  it('informa falha de gravação e permite baixar a compra mantida em memória', async () => {
    const { collectCoin, chooseSkin, coinBalance } = await import('../src/core/skins');
    const { saveProgress } = await import('../src/core/storage');
    const { exportBackup, parseBackup } = await import('../src/core/profile');
    for (let i = 0; i < 120; i++) collectCoin();
    saveProgress();
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    expect(chooseSkin('explorer')).toBe('volatile');
    expect(coinBalance()).toBe(20);
    const backup = parseBackup(exportBackup());
    expect(backup.progress.ownedSkins).toEqual(['explorer']);
    expect(backup.progress.equippedSkin).toBe('explorer');
  });

  it('uma moeda coletada não reaparece nem gera saldo extra ao carregar o save', async () => {
    const { World } = await import('../src/game/world');
    const { buildLevel } = await import('../src/game/level/index');
    const { captureSave, applySave, nextStageSave } = await import('../src/game/save');
    const { coinBalance } = await import('../src/core/skins');
    const world = new World(buildLevel());
    const token = world.pickups.find(p => p.kind === 'token' && p.id >= 0)!;
    world.collect(token);
    token.alive = false;
    expect(coinBalance()).toBe(1);
    const loaded = new World(buildLevel());
    applySave(loaded, captureSave(world));
    expect(loaded.pickups.some(p => p.id === token.id && p.alive)).toBe(false);
    expect(coinBalance()).toBe(1);
    expect(nextStageSave(world, 2).tokens).toBe(1);
    expect(coinBalance()).toBe(1);
  });

  it('reconfere o saldo depois de uma compra realizada em outra aba', async () => {
    const { defaultProgress, progress } = await import('../src/core/storage');
    const { ensureWallet, chooseSkin, coinBalance } = await import('../src/core/skins');
    progress.coinsEarned = 300;
    progress.coinsMigrated = true;
    disk.set('karimbolandia.progress.v1', JSON.stringify({ ...defaultProgress(), coinsEarned: 300, coinsMigrated: true, ownedSkins: ['neon'], equippedSkin: 'neon' }));
    ensureWallet();
    expect(coinBalance()).toBe(50);
    expect(chooseSkin('explorer')).toBe('insufficient');
    expect(progress.ownedSkins).toEqual(['neon']);
  });

  it('uma aba de versão antiga não apaga a carteira nem as skins compradas', async () => {
    const { collectCoin, chooseSkin } = await import('../src/core/skins');
    for (let i = 0; i < 380; i++) collectCoin();
    chooseSkin('explorer'); chooseSkin('neon');
    // Mesmo que a versão antiga sobrescreva o registro principal e sua cópia anterior.
    const legacy = { bestScore: 19000, bestTime: 0, bestEmblems: 0, bestSecrets: 0, completed: 0, dashDiscovered: false, emblemsFound: [], secretsFound: [], stagesDone: [] };
    disk.set('karimbolandia.progress.v1', JSON.stringify(legacy));
    disk.set('karimbolandia.progress.v1.backup', JSON.stringify(legacy));
    vi.resetModules();
    const { ensureWallet, coinBalance } = await import('../src/core/skins');
    const { progress } = await import('../src/core/storage');
    ensureWallet();
    expect(coinBalance()).toBe(30);
    expect(progress.ownedSkins).toEqual(['explorer', 'neon']);
    expect(progress.equippedSkin).toBe('neon');
    expect(progress.bestScore).toBe(19000);
  });

  it('rejeita compras duplicadas e skins bloqueadas em backups danificados', async () => {
    const { defaultProgress, validateProgress } = await import('../src/core/storage');
    expect(validateProgress({ ...defaultProgress(), ownedSkins: ['explorer', 'explorer'] })).toBeNull();
    expect(validateProgress({ ...defaultProgress(), equippedSkin: 'neon' })).toBeNull();
    expect(validateProgress({ ...defaultProgress(), coinsEarned: -10 })).toBeNull();
    expect(validateProgress({ ...defaultProgress(), ownedSkins: ['unknown'] })).toBeNull();
  });
});
