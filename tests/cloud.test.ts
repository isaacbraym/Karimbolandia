import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { CloudTransport, CloudUser, RemoteSave } from '../src/core/cloud';
import type { ProfileData } from '../src/core/profile';

class FakeCloud implements CloudTransport {
  saves = new Map<string, RemoteSave>();
  writes = 0;
  failing = false;
  private changed = (_user: CloudUser | null) => {};
  userChanged(fn: (user: CloudUser | null) => void) { this.changed = fn; return () => {}; }
  async login() { this.changed({ uid: 'A', email: 'a@example.test' }); }
  async logout() { this.changed(null); }
  emit(uid: string) { this.changed({ uid, email: `${uid}@example.test` }); }
  async read(uid: string) { if (this.failing) throw new Error('offline'); return structuredClone(this.saves.get(uid) ?? null); }
  async write(uid: string, data: ProfileData, expected: number) {
    if (this.failing) throw new Error('offline');
    const current = this.saves.get(uid)?.revision ?? 0;
    if (current !== expected) throw new Error('conflict');
    ++this.writes;
    this.saves.set(uid, { revision: current + 1, data: structuredClone(data) });
    return current + 1;
  }
}
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) });
  vi.resetModules();
  vi.useFakeTimers();
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('sincronização sem perda silenciosa', () => {
  it('não interrompe a partida de visitante ao descobrir que não há login', async () => {
    const { CloudSaves } = await import('../src/core/cloud');
    const { freshSave, writeSave, loadSave } = await import('../src/game/save');
    writeSave({ ...freshSave(1), tokens: 19 });
    const beforeSwitch = vi.fn(), changed = vi.fn();
    const saves = new CloudSaves(), adapter = new FakeCloud();
    saves.configureHooks({ beforeSwitch, changed, safeToApply: () => false });
    saves.connect(adapter);
    await adapter.logout(); await flush();
    expect(saves.state).toBe('guest');
    expect(beforeSwitch).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    expect(loadSave()?.tokens).toBe(19);
  });
  it('vincula o progresso do visitante à primeira conta e confirma o envio', async () => {
    const { CloudSaves } = await import('../src/core/cloud');
    const { writeSave, freshSave, loadSave } = await import('../src/game/save');
    writeSave({ ...freshSave(1), tokens: 14 });
    const adapter = new FakeCloud(), saves = new CloudSaves();
    saves.connect(adapter);
    await saves.login(); await flush();
    expect(saves.state).toBe('saved');
    expect(adapter.saves.get('A')?.data.save?.tokens).toBe(14);
    expect(loadSave()?.tokens).toBe(14);
  });
  it('restaura automaticamente a nuvem num aparelho sem partida', async () => {
    const { CloudSaves } = await import('../src/core/cloud');
    const { captureProfile } = await import('../src/core/profile');
    const { freshSave, loadSave } = await import('../src/game/save');
    const adapter = new FakeCloud();
    adapter.saves.set('A', { revision: 8, data: { ...captureProfile(), save: { ...freshSave(2), tokens: 35 } } });
    const saves = new CloudSaves(); saves.connect(adapter);
    await saves.login(); await flush();
    expect(saves.state).toBe('saved');
    expect(loadSave()?.tokens).toBe(35);
    expect(adapter.writes).toBe(0);
  });
  it('não transfere o save da conta A para a B nem para o visitante', async () => {
    const { CloudSaves } = await import('../src/core/cloud');
    const { writeSave, freshSave, loadSave } = await import('../src/game/save');
    const { setProfile } = await import('../src/core/persistence');
    const { reloadProgress } = await import('../src/core/storage');
    setProfile('A'); reloadProgress(); writeSave({ ...freshSave(2), tokens: 88 });
    const adapter = new FakeCloud(), saves = new CloudSaves(); saves.connect(adapter);
    adapter.emit('B'); await flush();
    expect(loadSave()).toBeNull();
    expect(adapter.saves.get('B')?.data.save).toBeNull();
    await saves.logout(); await flush();
    expect(loadSave()).toBeNull();
    adapter.emit('A'); await flush();
    expect(loadSave()?.tokens).toBe(88);
  });
  it('exibe conflito e só troca a partida após a escolha, mantendo os melhores recordes', async () => {
    const { CloudSaves } = await import('../src/core/cloud');
    const { captureProfile } = await import('../src/core/profile');
    const { writeSave, freshSave, loadSave } = await import('../src/game/save');
    const { progress, saveProgress } = await import('../src/core/storage');
    writeSave({ ...freshSave(1), tokens: 4 });
    progress.bestScore = 9000; saveProgress();
    const cloud = captureProfile(); cloud.save = { ...freshSave(2), tokens: 60 }; cloud.progress.bestScore = 100;
    cloud.progress.stagesDone = [1];
    const adapter = new FakeCloud(); adapter.saves.set('A', { revision: 3, data: cloud });
    const saves = new CloudSaves(); saves.connect(adapter);
    await saves.login(); await flush();
    expect(saves.state).toBe('conflict');
    expect(adapter.writes).toBe(0);
    expect(loadSave()?.tokens).toBe(4);
    await saves.resolveConflict('remote');
    expect(saves.state).toBe('saved');
    expect(loadSave()?.tokens).toBe(60);
    expect(progress.bestScore).toBe(9000);
    expect(progress.stagesDone).toEqual([1]);
    expect(adapter.saves.get('A')?.revision).toBe(4);
  });
  it('não sobrescreve uma revisão alterada em outro aparelho durante a escolha', async () => {
    const { CloudSaves } = await import('../src/core/cloud');
    const { captureProfile } = await import('../src/core/profile');
    const { writeSave, freshSave, loadSave } = await import('../src/game/save');
    writeSave({ ...freshSave(1), tokens: 4 });
    const adapter = new FakeCloud();
    adapter.saves.set('A', { revision: 1, data: { ...captureProfile(), save: freshSave(2) } });
    const saves = new CloudSaves(); saves.connect(adapter);
    await saves.login(); await flush();
    adapter.saves.get('A')!.revision = 2;
    await saves.resolveConflict('local');
    expect(saves.state).toBe('error');
    expect(loadSave()?.tokens).toBe(4);
    expect(adapter.saves.get('A')?.revision).toBe(2);
    expect(adapter.writes).toBe(0);
  });
  it('mantém o progresso local após falha e tenta novamente quando solicitado', async () => {
    const { CloudSaves } = await import('../src/core/cloud');
    const { writeSave, freshSave, loadSave } = await import('../src/game/save');
    writeSave({ ...freshSave(1), tokens: 21 });
    const adapter = new FakeCloud(); adapter.failing = true;
    const saves = new CloudSaves(); saves.connect(adapter);
    await saves.login(); await flush();
    expect(saves.state).toBe('error');
    expect(loadSave()?.tokens).toBe(21);
    adapter.failing = false; await saves.sync();
    expect(saves.state).toBe('saved');
    expect(adapter.saves.get('A')?.data.save?.tokens).toBe(21);
  });
  it('não restaura remotamente uma partida enquanto o jogador está jogando', async () => {
    const { CloudSaves } = await import('../src/core/cloud');
    const { captureProfile } = await import('../src/core/profile');
    const { freshSave, loadSave } = await import('../src/game/save');
    const adapter = new FakeCloud(); adapter.saves.set('A', { revision: 2, data: { ...captureProfile(), save: freshSave(2) } });
    const saves = new CloudSaves();
    saves.configureHooks({ beforeSwitch: () => {}, changed: () => {}, safeToApply: () => false });
    saves.connect(adapter); await saves.login(); await flush();
    expect(saves.state).toBe('conflict');
    expect(loadSave()).toBeNull();
  });
  it('agrupa várias alterações em um envio e não grava saves sem mudanças', async () => {
    const { CloudSaves } = await import('../src/core/cloud');
    const { writeSave, freshSave } = await import('../src/game/save');
    const adapter = new FakeCloud(), saves = new CloudSaves(); saves.connect(adapter);
    await saves.login(); await flush();
    expect(adapter.writes).toBe(1);
    await saves.sync(); expect(adapter.writes).toBe(1);
    for (let n = 1; n <= 10; n++) writeSave({ ...freshSave(1), tokens: n });
    expect(adapter.writes).toBe(1);
    await vi.advanceTimersByTimeAsync(1800);
    expect(adapter.writes).toBe(2);
    expect(adapter.saves.get('A')?.data.save?.tokens).toBe(10);
  });
  it('não aplica resposta antiga depois que a conta mudou', async () => {
    const { CloudSaves } = await import('../src/core/cloud');
    const { captureProfile } = await import('../src/core/profile');
    const { freshSave, loadSave } = await import('../src/game/save');
    const adapter = new FakeCloud();
    let release!: (value: RemoteSave | null) => void;
    const read = adapter.read.bind(adapter);
    adapter.read = uid => uid === 'A' ? new Promise(resolve => { release = resolve; }) : read(uid);
    const saves = new CloudSaves(); saves.connect(adapter);
    await saves.login(); await flush();
    adapter.emit('B'); await flush();
    release({ revision: 4, data: { ...captureProfile(), save: { ...freshSave(2), tokens: 999 } } });
    await flush(); await vi.advanceTimersByTimeAsync(1800);
    expect(saves.user?.uid).toBe('B');
    expect(loadSave()).toBeNull();
    expect(adapter.saves.get('B')?.data.save).toBeNull();
  });
  it('continua visitante após sair enquanto havia uma leitura pendente', async () => {
    const { CloudSaves } = await import('../src/core/cloud');
    const adapter = new FakeCloud();
    let release!: (value: RemoteSave | null) => void;
    adapter.read = () => new Promise(resolve => { release = resolve; });
    const saves = new CloudSaves(); saves.connect(adapter);
    await saves.login(); await flush();
    await saves.logout(); await flush();
    release(null); await flush();
    await vi.advanceTimersByTimeAsync(1800);
    expect(saves.user).toBeNull();
    expect(saves.state).toBe('guest');
    expect(adapter.writes).toBe(0);
  });
});
