import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { makeWorld } from './helpers/bot';
import { World } from '../src/game/world';
import { buildJungle } from '../src/game/level/jungle';

class MemoryStorage {
  data = new Map<string, string>();
  fail = false;
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.fail) throw new Error('QuotaExceededError'); this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}
let disk: MemoryStorage;
beforeEach(() => {
  disk = new MemoryStorage();
  vi.stubGlobal('localStorage', disk);
  vi.resetModules();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('save com recuperação', () => {
  it('continua na selva com fichas e pontos, sem carregar objetos e checkpoints da cidade', async () => {
    const { nextStageSave, writeSave, loadSave, applySave } = await import('../src/game/save');
    const city = makeWorld();
    city.tokens = 47;
    city.score = 19000;
    city.checkpointIdx = city.data.checkpoints.length - 1;
    city.killedEnemies.add(city.data.enemies[0].id);
    city.collectedPickups.add(city.data.pickups[0].id);
    city.destroyedProps.add(city.data.props[0].id);
    writeSave(nextStageSave(city, 2));
    const jungle = new World(buildJungle());
    applySave(jungle, loadSave()!);
    expect(jungle.tokens).toBe(47);
    expect(jungle.score).toBe(19000);
    expect(jungle.checkpointIdx).toBe(-1);
    expect(jungle.killedEnemies.size).toBe(0);
    expect(jungle.collectedPickups.size).toBe(0);
    expect(jungle.destroyedProps.size).toBe(0);
    expect(jungle.player.x).toBe(jungle.data.playerStart.x);
  });
  it('informa armazenamento indisponível mesmo antes da primeira escrita', async () => {
    disk.getItem = () => { throw new Error('SecurityError'); };
    const { loadSave, freshSave, writeSave } = await import('../src/game/save');
    const { persistenceStatus } = await import('../src/core/persistence');
    expect(loadSave()).toBeNull();
    expect(persistenceStatus()).toBe('volatile');
    disk.getItem = key => disk.data.get(key) ?? null;
    expect(writeSave(freshSave(1))).toBe(true);
    expect(persistenceStatus()).toBe('saved');
  });
  it('migra o save legado sem perder fichas, equipamentos ou checkpoint', async () => {
    const { freshSave, loadSave } = await import('../src/game/save');
    const old = { ...freshSave(1), checkpointIdx: 2, cpName: 'Praça', tokens: 27, score: 4321,
      weapons: [['pistol', -1], ['rifle', 18]], cur: 'rifle', grenades: 2, nomad: 0 };
    disk.setItem('karimbolandia.save.v1', JSON.stringify(old));
    expect(loadSave()).toEqual(old);
  });
  it('rejeita dados danificados antes de criar/restaurar um mundo', async () => {
    const { freshSave, loadSave } = await import('../src/game/save');
    for (const invalid of [null, { v: 1, stage: 1 }, { ...freshSave(1), killed: 'não é array' },
      { ...freshSave(1), stage: 99 }, { ...freshSave(1), score: -9 },
      { ...freshSave(1), checkpointIdx: -20 }, { ...freshSave(1), weapons: [['desconhecida', 5]], cur: 'desconhecida' }]) {
      disk.setItem('karimbolandia.save.v1', JSON.stringify(invalid));
      expect(loadSave()).toBeNull();
    }
  });
  it('recupera a cópia anterior e não a substitui por um save corrompido', async () => {
    const { freshSave, loadSave, writeSave } = await import('../src/game/save');
    const { persistenceStatus } = await import('../src/core/persistence');
    const first = { ...freshSave(1), tokens: 10 };
    writeSave(first);
    writeSave({ ...first, tokens: 20 });
    disk.setItem('karimbolandia.save.v1', '{quebrado');
    expect(loadSave()?.tokens).toBe(10);
    expect(persistenceStatus()).toBe('recovered');
    writeSave({ ...first, tokens: 30 });
    expect(JSON.parse(disk.getItem('karimbolandia.save.v1.backup')!).tokens).toBe(10);
  });
  it('grava o principal mesmo quando falta espaço apenas para a cópia', async () => {
    const { freshSave, writeSave, loadSave } = await import('../src/game/save');
    writeSave(freshSave(1));
    const set = disk.setItem.bind(disk);
    disk.setItem = (key, value) => { if (key.endsWith('.backup')) throw new Error('QuotaExceededError'); set(key, value); };
    expect(writeSave({ ...freshSave(1), score: 51 })).toBe(true);
    expect(loadSave()?.score).toBe(51);
  });
  it('mantém o progresso recente em memória e informa que não está no disco', async () => {
    const { freshSave, writeSave, loadSave } = await import('../src/game/save');
    const { persistenceStatus } = await import('../src/core/persistence');
    writeSave({ ...freshSave(1), score: 10 });
    disk.fail = true;
    expect(writeSave({ ...freshSave(1), score: 99 })).toBe(false);
    expect(loadSave()?.score).toBe(99);
    expect(persistenceStatus()).toBe('volatile');
    disk.fail = false;
    expect(writeSave(loadSave()!)).toBe(true);
    expect(persistenceStatus()).toBe('saved');
  });
  it('excluir uma partida não ressuscita o backup anterior', async () => {
    const { freshSave, writeSave, loadSave, clearSave } = await import('../src/game/save');
    writeSave(freshSave(1));
    writeSave(freshSave(2));
    clearSave();
    expect(loadSave()).toBeNull();
    expect(disk.getItem('karimbolandia.save.v1.backup')).not.toBeNull();
  });
  it('fotografa o inventário atual e restaura fichas e inimigos derrotados', async () => {
    const { captureSave, applySave } = await import('../src/game/save');
    const world = makeWorld();
    world.checkpointIdx = 1;
    world.checkpointSnap = world.player.snapshot();
    world.player.weapons.set('rifle', 7);
    world.player.cur = 'rifle';
    world.player.grenades = 1;
    world.tokens = 18;
    world.score = 987;
    world.killedEnemies.add(1);
    const saved = captureSave(world);
    expect(saved.weapons).toContainEqual(['rifle', 7]);
    const restored = makeWorld();
    applySave(restored, saved);
    expect(restored.tokens).toBe(18);
    expect(restored.score).toBe(987);
    expect(restored.player.weapons.get('rifle')).toBe(7);
    expect(restored.player.grenades).toBe(1);
    expect(restored.killedEnemies.has(1)).toBe(true);
    expect(restored.checkpointIdx).toBe(1);
  });
});

describe('backup portátil e perfis isolados', () => {
  it('uma aba antiga não reduz um recorde mais novo gravado em outra aba', async () => {
    const { progress, defaultProgress, saveProgress } = await import('../src/core/storage');
    progress.bestScore = 100;
    disk.setItem('karimbolandia.progress.v1', JSON.stringify({ ...defaultProgress(), bestScore: 9000, stagesDone: [1, 2] }));
    saveProgress();
    expect(progress.bestScore).toBe(9000);
    expect(progress.stagesDone).toEqual([1, 2]);
  });
  it('exporta/restaura sem perder recordes e preserva o estado anterior completo', async () => {
    const { freshSave, writeSave, loadSave } = await import('../src/game/save');
    const { progress, saveProgress } = await import('../src/core/storage');
    const { exportBackup, parseBackup, applyProfile } = await import('../src/core/profile');
    writeSave({ ...freshSave(2), tokens: 8 });
    progress.bestScore = 5678;
    progress.stagesDone = [1];
    saveProgress();
    const text = exportBackup();
    writeSave(freshSave(1));
    progress.bestScore = 100;
    saveProgress();
    expect(applyProfile(parseBackup(text))).toBe(true);
    expect(loadSave()?.stage).toBe(2);
    expect(loadSave()?.tokens).toBe(8);
    expect(progress.bestScore).toBe(5678);
    expect(JSON.parse(disk.getItem('karimbolandia.before-restore.v1')!).save.stage).toBe(1);
  });
  it('rejeita backups de outro jogo ou parciais, mantendo o progresso atual', async () => {
    const { freshSave, writeSave, loadSave } = await import('../src/game/save');
    const { parseBackup } = await import('../src/core/profile');
    writeSave({ ...freshSave(1), tokens: 42 });
    for (const text of ['{err', '{"game":"outro","version":1}', '{"game":"karimbolandia","version":1,"data":{"v":1,"save":null}}']) {
      expect(() => parseBackup(text)).toThrow();
      expect(loadSave()?.tokens).toBe(42);
    }
  });
  it('troca de conta mantém cada partida separada do visitante e das outras contas', async () => {
    const { freshSave, writeSave, loadSave } = await import('../src/game/save');
    const { setProfile } = await import('../src/core/persistence');
    const { progress, reloadProgress, saveProgress } = await import('../src/core/storage');
    writeSave({ ...freshSave(1), tokens: 1 });
    setProfile('conta-A'); reloadProgress();
    expect(loadSave()).toBeNull();
    writeSave({ ...freshSave(2), tokens: 20 });
    progress.bestScore = 700; saveProgress();
    setProfile('conta-B'); reloadProgress();
    expect(loadSave()).toBeNull();
    expect(progress.bestScore).toBe(0);
    writeSave({ ...freshSave(1), tokens: 30 });
    setProfile('conta-A'); reloadProgress();
    expect(loadSave()?.tokens).toBe(20);
    expect(progress.bestScore).toBe(700);
    setProfile(''); reloadProgress();
    expect(loadSave()?.tokens).toBe(1);
  });
});
