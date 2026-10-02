import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class Disk {
  data = new Map<string, string>();
  fail = false;
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.fail) throw new Error('QuotaExceededError'); this.data.set(key, value); }
}
let disk: Disk;
beforeEach(() => { disk = new Disk(); vi.stubGlobal('localStorage', disk); vi.resetModules(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Partidas independentes em abas concorrentes', () => {
  it('não troca a principal quando outra aba já avançou e guarda a sua cópia', async () => {
    const { freshSave, loadSave, writeSave } = await import('../src/game/save');
    const { SaveSession, listSaveCopies } = await import('../src/game/saveSession');
    writeSave(freshSave(1));
    const a = new SaveSession(), b = new SaveSession();
    const other = { ...freshSave(2), score: 14000, tokens: 70 };
    expect(b.write(other)).toEqual({ durable: true, conflict: false });
    const here = { ...freshSave(1), score: 8000, tokens: 25 };
    expect(a.write(here)).toEqual({ durable: true, conflict: true });
    expect(loadSave()).toEqual(other);
    expect(listSaveCopies().map(c => c.save)).toEqual([here]);
    expect(a.write({ ...here, score: 8100 }).conflict).toBe(true);
    expect(loadSave()).toEqual(other);
    expect(listSaveCopies()[0].save.score).toBe(8100);
  });

  it('preserva as duas cópias mesmo quando uma gravação se intercala antes de gravar a principal', async () => {
    const { freshSave, writeSave, loadSave } = await import('../src/game/save');
    const { SaveSession, listSaveCopies } = await import('../src/game/saveSession');
    writeSave(freshSave(1));
    const a = new SaveSession(), b = new SaveSession();
    const first = { ...freshSave(1), score: 2000 }, second = { ...freshSave(2), score: 9000 };
    const get = disk.getItem.bind(disk);
    let armed = true;
    vi.spyOn(disk, 'getItem').mockImplementation(key => {
      const old = get(key);
      // A já comparou o estado; B grava quando writeSave(A) lê a chave principal.
      if (key === 'karimbolandia.save.v1' && armed && get(key)?.includes('"score":0')) {
        const count = calls++;
        if (count === 1) { armed = false; b.write(second); }
      }
      return old;
    });
    let calls = 0;
    a.write(first);
    const all = [loadSave(), ...listSaveCopies().map(c => c.save)];
    expect(all).toEqual(expect.arrayContaining([first, second]));
  });

  it('não ressuscita o save excluído em outra aba', async () => {
    const { freshSave, writeSave, clearSave, loadSave } = await import('../src/game/save');
    const { SaveSession, listSaveCopies } = await import('../src/game/saveSession');
    writeSave(freshSave(1));
    const a = new SaveSession();
    clearSave();
    expect(a.write({ ...freshSave(1), tokens: 5 }).conflict).toBe(true);
    expect(loadSave()).toBeNull();
    expect(listSaveCopies()[0].save.tokens).toBe(5);
  });

  it('uma fase terminada não apaga uma partida de outra aba', async () => {
    const { freshSave, writeSave, loadSave } = await import('../src/game/save');
    const { SaveSession, listSaveCopies } = await import('../src/game/saveSession');
    writeSave(freshSave(2));
    const a = new SaveSession(), b = new SaveSession();
    const remote = { ...freshSave(1), tokens: 9 };
    b.write(remote);
    expect(a.write(null).conflict).toBe(true);
    expect(loadSave()).toEqual(remote);
    expect(listSaveCopies()).toEqual([]);
  });

  it('atualiza a própria partida sem criar cópias por checkpoint', async () => {
    const { freshSave, loadSave } = await import('../src/game/save');
    const { SaveSession, listSaveCopies } = await import('../src/game/saveSession');
    const a = new SaveSession();
    for (let score = 1; score < 21; score++) expect(a.write({ ...freshSave(1), score }).conflict).toBe(false);
    expect(loadSave()?.score).toBe(20);
    expect(listSaveCopies()).toEqual([]);
    expect([...disk.data.keys()].filter(k => k.startsWith('karimbolandia.partidas.v1.') && !k.endsWith('.backup'))).toHaveLength(1);
  });

  it('isola cópias por perfil e não salva um mundo antigo na nova conta', async () => {
    const { freshSave, loadSave } = await import('../src/game/save');
    const { SaveSession, listSaveCopies } = await import('../src/game/saveSession');
    const { setProfile } = await import('../src/core/persistence');
    const a = new SaveSession();
    a.write(freshSave(1));
    setProfile('alice');
    expect(a.write({ ...freshSave(1), score: 500 }).conflict).toBe(true);
    expect(loadSave()).toBeNull();
    expect(listSaveCopies()).toEqual([]);
    const b = new SaveSession();
    b.write(freshSave(2));
    setProfile('bob');
    expect(listSaveCopies()).toEqual([]);
    setProfile('');
    expect(listSaveCopies()[0].save.score).toBe(500);
  });

  it('mantém cópias acessíveis após reiniciar os módulos e restaurar uma delas', async () => {
    const { freshSave, writeSave } = await import('../src/game/save');
    const { SaveSession } = await import('../src/game/saveSession');
    writeSave(freshSave(1));
    const a = new SaveSession();
    a.write({ ...freshSave(1), score: 4000 });
    writeSave({ ...freshSave(2), score: 9000 });
    vi.resetModules();
    const { listSaveCopies } = await import('../src/game/saveSession');
    const { applyProfile, captureProfile, exportBackup, parseBackup } = await import('../src/core/profile');
    const { loadSave } = await import('../src/game/save');
    const { readStored, profileKey } = await import('../src/core/persistence');
    const { validateProfile } = await import('../src/core/profile');
    expect(listSaveCopies()[0].save.score).toBe(4000);
    const copy = { ...captureProfile(), save: listSaveCopies()[0].save };
    expect(parseBackup(exportBackup(copy)).save?.score).toBe(4000);
    expect(loadSave()?.score).toBe(9000);
    applyProfile(copy);
    expect(loadSave()?.score).toBe(4000);
    expect(readStored(profileKey('karimbolandia.before-restore.v1'), validateProfile)?.save?.score).toBe(9000);
  });

  it('não sobrescreve a principal se não conseguir guardar a cópia independente', async () => {
    const { freshSave, writeSave, loadSave } = await import('../src/game/save');
    const { SaveSession, listSaveCopies } = await import('../src/game/saveSession');
    const { persistenceStatus } = await import('../src/core/persistence');
    writeSave(freshSave(1));
    const a = new SaveSession();
    disk.fail = true;
    expect(a.write({ ...freshSave(2), score: 2200 }).durable).toBe(false);
    expect(loadSave()?.stage).toBe(1);
    expect(listSaveCopies()[0].save.score).toBe(2200);
    expect(persistenceStatus()).toBe('volatile');
  });

  it('ignora chaves de backup, cópias corrompidas e duplicatas', async () => {
    const { freshSave, writeSave } = await import('../src/game/save');
    const { SaveSession, listSaveCopies } = await import('../src/game/saveSession');
    const a = new SaveSession(), b = new SaveSession();
    a.write(freshSave(1));
    b.write(freshSave(1));
    writeSave(freshSave(2));
    disk.data.set('karimbolandia.partidas.v1.broken', '{');
    disk.data.set('karimbolandia.partidas.v1.wrong.account.eve', JSON.stringify(freshSave(2)));
    expect(listSaveCopies()).toHaveLength(1);
    expect(listSaveCopies()[0].save.stage).toBe(1);
  });

  it('não confunde sua própria gravação em memória com outra aba após falha parcial', async () => {
    const { freshSave, writeSave, loadSave } = await import('../src/game/save');
    const { SaveSession } = await import('../src/game/saveSession');
    writeSave(freshSave(1));
    const a = new SaveSession();
    const set = disk.setItem.bind(disk);
    let failMain = true;
    vi.spyOn(disk, 'setItem').mockImplementation((key, value) => {
      if (key === 'karimbolandia.save.v1' && failMain) { failMain = false; throw new Error('QuotaExceededError'); }
      set(key, value);
    });
    expect(a.write({ ...freshSave(1), score: 1000 })).toEqual({ durable: false, conflict: false });
    expect(a.write({ ...freshSave(1), score: 2000 })).toEqual({ durable: true, conflict: false });
    expect(loadSave()?.score).toBe(2000);
  });
});
