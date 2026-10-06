import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let disk: Map<string, string>;
beforeEach(() => {
  disk = new Map();
  vi.stubGlobal('localStorage', { get length() { return disk.size; }, key: (i: number) => [...disk.keys()][i] ?? null, getItem: (k: string) => disk.get(k) ?? null, setItem: (k: string, v: string) => disk.set(k, v) });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

describe('configuração dos controles do boxe no celular', () => {
  it('o padrão é por gestos; um valor inválido guardado volta para gestos; "botoes" é respeitado', async () => {
    expect((await import('../src/core/storage')).settings.boxControls).toBe('gestos');
    vi.resetModules();
    disk.set('karimbolandia.settings.v1', JSON.stringify({ boxControls: 'lixo' }));
    expect((await import('../src/core/storage')).settings.boxControls).toBe('gestos');
    vi.resetModules();
    disk.set('karimbolandia.settings.v1', JSON.stringify({ boxControls: 'botoes' }));
    expect((await import('../src/core/storage')).settings.boxControls).toBe('botoes');
  });

  it('um backup/configuração antiga sem o campo continua válida (campo opcional na leitura)', async () => {
    disk.set('karimbolandia.settings.v1', JSON.stringify({ music: 0.3, leftHanded: true }));
    const { settings } = await import('../src/core/storage');
    expect(settings.music).toBe(0.3);
    expect(settings.leftHanded).toBe(true);
    expect(settings.boxControls).toBe('gestos');
  });
});
