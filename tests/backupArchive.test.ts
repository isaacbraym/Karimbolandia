import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
let disk: Map<string, string>;
let fail: boolean;
beforeEach(() => {
  disk = new Map(); fail = false;
  vi.stubGlobal('localStorage', {
    get length() { return disk.size; }, key: (i: number) => [...disk.keys()][i] ?? null,
    getItem: (key: string) => disk.get(key) ?? null,
    setItem: (key: string, value: string) => { if (fail) throw new Error('QuotaExceededError'); disk.set(key, value); },
  });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

describe('Arquivo portátil de todas as partidas', () => {
  it('inclui principal, cópias concorrentes e recuperação anterior sem modificar o disco', async () => {
    const s = await import('../src/game/save'), sessions = await import('../src/game/saveSession');
    const p = await import('../src/core/profile'), storage = await import('../src/core/storage');
    const a = await import('../src/core/backupArchive');
    storage.progress.coinsEarned = 500; storage.progress.coinsMigrated = true; storage.saveProgress();
    s.writeSave({ ...s.freshSave(1), score: 100 }); p.preserveProfile();
    const one = new sessions.SaveSession(), two = new sessions.SaveSession(), three = new sessions.SaveSession();
    one.write({ ...s.freshSave(1), score: 200 });
    two.write({ ...s.freshSave(2), score: 300 });
    three.write({ ...s.freshSave(2), score: 400 });
    const before = new Map(disk);
    const choices = a.parseBackupChoices(a.exportAllBackups());
    expect(choices.map(c => c.data.save!.score).sort((a, b) => a - b)).toEqual([100, 200, 300, 400]);
    expect(choices.every(c => c.data.progress.coinsEarned === 500)).toBe(true);
    expect(choices.map(c => c.kind)).toEqual(expect.arrayContaining(['current', 'copy', 'previous']));
    expect(disk).toEqual(before);
  });
  it('exporta somente o perfil atual e permite importar em outro aparelho sem IDs de conta', async () => {
    const s = await import('../src/game/save'), sessions = await import('../src/game/saveSession');
    const scope = await import('../src/core/persistence'), p = await import('../src/core/profile');
    const a = await import('../src/core/backupArchive');
    scope.setProfile('alice'); new sessions.SaveSession().write({ ...s.freshSave(1), score: 111 }); p.preserveProfile();
    scope.setProfile('bob'); new sessions.SaveSession().write({ ...s.freshSave(2), score: 222 });
    const file = a.exportAllBackups();
    expect(file).not.toContain('alice'); expect(file).not.toContain('bob');
    expect(a.parseBackupChoices(file).map(c => c.data.save!.score)).toEqual([222]);
    scope.setProfile('new-device');
    const selected = a.parseBackupChoices(file)[0].data;
    expect(s.loadSave()).toBeNull();
    expect(p.applyProfile(selected)).toBe(true);
    expect(s.loadSave()?.score).toBe(222);
    scope.setProfile('alice'); expect(s.loadSave()?.score).toBe(111);
  });
  it('continua aceitando backups individuais existentes', async () => {
    const s = await import('../src/game/save'), p = await import('../src/core/profile');
    const a = await import('../src/core/backupArchive');
    s.writeSave({ ...s.freshSave(2), tokens: 40 });
    const text = p.exportBackup();
    expect(a.parseBackupChoices(text)).toEqual([{ kind: 'current', data: p.parseBackup(text) }]);
  });
  it('rejeita o arquivo inteiro se uma entrada for inválida, sem aplicar partes boas', async () => {
    const p = await import('../src/core/profile'), a = await import('../src/core/backupArchive');
    const raw = JSON.parse(a.exportAllBackups());
    raw.entries.push({ kind: 'copy', data: { ...p.captureProfile(), save: { stage: 9 } } });
    const before = new Map(disk);
    expect(() => a.parseBackupChoices(JSON.stringify(raw))).toThrow('danificada');
    expect(disk).toEqual(before);
    raw.entries.pop(); raw.entries[0].kind = ['current'];
    expect(() => a.parseBackupChoices(JSON.stringify(raw))).toThrow('danificado');
    raw.entries = Array(1001).fill({ kind: 'current', data: p.captureProfile() });
    expect(() => a.parseBackupChoices(JSON.stringify(raw))).toThrow('Escolha');
    expect(() => a.parseBackupChoices(' '.repeat(a.MAX_ARCHIVE_BYTES + 1))).toThrow('grande');
  });
  it('inclui a cópia que só está em memória quando o armazenamento está cheio', async () => {
    const s = await import('../src/game/save'), sessions = await import('../src/game/saveSession');
    const a = await import('../src/core/backupArchive');
    const session = new sessions.SaveSession(); session.write({ ...s.freshSave(1), score: 100 });
    fail = true; expect(session.write({ ...s.freshSave(2), score: 999 }).durable).toBe(false);
    const choices = a.parseBackupChoices(a.exportAllBackups());
    expect(choices.map(c => c.data.save?.score)).toEqual(expect.arrayContaining([100, 999]));
  });
});
