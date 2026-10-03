import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storageUsage } from '../src/core/storageUsage';

let disk: Map<string, string>;
let store: { length: number; key: (i: number) => string | null; getItem: (key: string) => string | null; setItem: ReturnType<typeof vi.fn>; removeItem: ReturnType<typeof vi.fn> };
const bytes = (key: string, value: string) => (key.length + value.length) * 2;
beforeEach(() => {
  disk = new Map();
  store = {
    get length() { return disk.size; }, key: i => [...disk.keys()][i] ?? null,
    getItem: key => disk.get(key) ?? null, setItem: vi.fn(), removeItem: vi.fn(),
  };
  vi.stubGlobal('localStorage', store);
});
afterEach(() => vi.unstubAllGlobals());

describe('Tamanho físico estimado dos saves', () => {
  it('conta UTF-16, backups e todos os perfis sem misturar dados globais no perfil', () => {
    const entries = [
      ['karimbolandia.save.v1.account.ana', '🐊'],
      ['karimbolandia.save.v1.account.ana.backup', 'anterior'],
      ['karimbolandia.partidas.v1.session.account.ana', 'partida'],
      ['karimbolandia.coin-writers.v2.writer.account.ana.backup', 'moedas'],
      ['karimbolandia.gear.v1.receipt.account.ana', 'arma'],
      ['karimbolandia.save.v1.account.anabela', 'outro'],
      ['karimbolandia.save.v1', 'visitante'],
      ['karimbolandia.settings.v1.backup', 'config'],
      ['karimbolandia.profile.v1', 'ana'],
      ['outro-jogo', 'ignorar'],
    ];
    disk = new Map(entries.map(([k, v]) => [k!, v!]));
    expect(storageUsage('ana')).toEqual({ available: true, profileBytes: entries.slice(0, 5).reduce((sum, [k, v]) => sum + bytes(k!, v!), 0), totalBytes: entries.slice(0, 9).reduce((sum, [k, v]) => sum + bytes(k!, v!), 0) });
    const guest = storageUsage('');
    expect(guest.available).toBe(true);
    if (guest.available) expect(guest.profileBytes).toBe(bytes(entries[6]![0]!, entries[6]![1]!));
    expect(store.setItem).not.toHaveBeenCalled(); expect(store.removeItem).not.toHaveBeenCalled();
  });
  it('lê o disco atual, inclusive valores inválidos, sem validar ou reparar backups', () => {
    const key = 'karimbolandia.save.v1.backup'; disk.set(key, '{quebrado');
    expect(storageUsage('')).toEqual({ available: true, totalBytes: bytes(key, '{quebrado'), profileBytes: bytes(key, '{quebrado') });
    disk.set(key, 'maior agora');
    expect(storageUsage('')).toEqual({ available: true, totalBytes: bytes(key, 'maior agora'), profileBytes: bytes(key, 'maior agora') });
    expect(store.setItem).not.toHaveBeenCalled(); expect(store.removeItem).not.toHaveBeenCalled();
  });
  it('não relata um total parcial se uma leitura falha', () => {
    disk.set('karimbolandia.save.v1', '1'); disk.set('karimbolandia.wallet.v1', '2');
    store.getItem = key => { if (key.includes('wallet')) throw new DOMException('negado', 'SecurityError'); return '1'; };
    expect(storageUsage('')).toEqual({ available: false });
  });
  it('trata acesso ao armazenamento negado sem escrever', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(storageUsage('')).toEqual({ available: false });
    expect(store.setItem).not.toHaveBeenCalled();
  });
  it('tolera chave desaparecida ou repetida durante a enumeração', () => {
    const key = 'karimbolandia.save.v1'; disk.set(key, '1'); disk.set('karimbolandia.wallet.v1', '2'); disk.set('karimbolandia.progress.v1', '3');
    store.key = i => i === 2 ? 'karimbolandia.desapareceu' : key;
    expect(storageUsage('')).toEqual({ available: true, totalBytes: bytes(key, '1'), profileBytes: bytes(key, '1') });
  });
  it('distingue armazenamento vazio disponível de leitura negada', () => {
    expect(storageUsage('')).toEqual({ available: true, totalBytes: 0, profileBytes: 0 });
  });
});
