import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let disk: Map<string, string>;
beforeEach(() => {
  disk = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => disk.get(k) ?? null, setItem: (k: string, v: string) => disk.set(k, v) });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

describe('marcas do boxe (chave própria, fora do perfil)', () => {
  it('começa vazio: primeira luta guiada, sem revanche e sem enfeites', async () => {
    const m = await import('../src/core/boxingStats');
    const s = m.readBoxingStats();
    expect(s).toEqual({ fights: 0, wins: 0, best: null, clean: false, champion: false });
    expect(m.isFirstFight(s)).toBe(true);
    expect(m.championUnlocked(s)).toBe(false);
    expect(m.boxingPerks(s)).toEqual({ goldGloves: false, leopardCuffs: false, goldBell: false });
  });

  it('guarda a melhor nota, vitórias, vitória sem cair e o Campeão; nota pior não sobrescreve', async () => {
    const m = await import('../src/core/boxingStats');
    m.recordFight({ win: true, grade: 'B', knockdowns: 1, champion: false });
    let s = m.recordFight({ win: true, grade: 'S', knockdowns: 0, champion: false });
    expect(s).toMatchObject({ fights: 2, wins: 2, best: 'S', clean: true, champion: false });
    s = m.recordFight({ win: true, grade: 'C', knockdowns: 2, champion: true });
    expect(s.best).toBe('S');
    expect(s.champion).toBe(true);
    expect(m.boxingPerks(s)).toEqual({ goldGloves: true, leopardCuffs: true, goldBell: true });
    expect(m.championUnlocked(s)).toBe(true);
    expect(m.isFirstFight(s)).toBe(false);
    // sobrevive a um recarregamento
    vi.resetModules();
    expect((await import('../src/core/boxingStats')).readBoxingStats()).toEqual(s);
  });

  it('a derrota só conta a luta; 3 derrotas encerram a luta guiada', async () => {
    const m = await import('../src/core/boxingStats');
    for (let i = 0; i < 2; i++) m.recordFight({ win: false, grade: 'C', knockdowns: 3, champion: false });
    expect(m.isFirstFight()).toBe(true);
    const s = m.recordFight({ win: false, grade: 'C', knockdowns: 3, champion: false });
    expect(s).toMatchObject({ fights: 3, wins: 0, best: null });
    expect(m.isFirstFight(s)).toBe(false);
  });

  it('dado corrompido ou armazenamento quebrado nunca lança: volta ao padrão', async () => {
    disk.set('karimbolandia.boxing.v1', '{"fights":-3,"wins":"x","best":"Z","clean":1}');
    const m = await import('../src/core/boxingStats');
    expect(m.readBoxingStats()).toEqual({ fights: 0, wins: 0, best: null, clean: false, champion: false });
    disk.set('karimbolandia.boxing.v1', 'nem é json');
    expect(m.readBoxingStats().fights).toBe(0);
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('negado'); }, setItem: () => { throw new Error('cheio'); } });
    expect(() => m.recordFight({ win: true, grade: 'A', knockdowns: 0, champion: false })).not.toThrow();
  });
});

describe('tutorial do boxe: aparece nas primeiras vezes e some', () => {
  it('conta cada vez que foi visto/pulado; depois da 2ª não abre mais; dado estranho volta a mostrar', async () => {
    const m = await import('../src/core/boxingStats');
    expect(m.shouldShowTutorial()).toBe(true);
    m.markTutorialSeen();
    expect(m.shouldShowTutorial()).toBe(true);
    m.markTutorialSeen();
    expect(m.tutorialSeen()).toBe(2);
    expect(m.shouldShowTutorial()).toBe(false);
    disk.set('karimbolandia.boxing.tut.v1', '"lixo"');
    expect(m.shouldShowTutorial()).toBe(true);
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('negado'); }, setItem: () => { throw new Error('cheio'); } });
    expect(() => m.markTutorialSeen()).not.toThrow();
    expect(m.shouldShowTutorial()).toBe(true);
  });
});
