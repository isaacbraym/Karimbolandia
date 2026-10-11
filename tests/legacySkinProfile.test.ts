import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let disk: Map<string, string>;
beforeEach(() => {
  disk = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => disk.get(key) ?? null,
    setItem: (key: string, value: string) => disk.set(key, value),
  });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

async function seed(scope: string, over: 'explorer' | 'neon') {
  const { defaultProgress } = await import('../src/core/storage');
  const p = { ...defaultProgress(), coinsEarned: 380, coinsMigrated: true, ownedSkins: ['explorer', 'neon'], equippedSkin: over };
  const key = (root: string) => scope ? `${root}.account.${scope}` : root;
  disk.set(key('karimbolandia.progress.v1'), JSON.stringify(p));
  disk.set(key('karimbolandia.wallet.v1'), JSON.stringify(p));
  disk.set(key('karimbolandia.rewards.v1'), JSON.stringify({ skins: ['jacare'], equipped: 'jacare', over }));
  vi.resetModules();
}
function stored(root: string, scope = '') {
  return JSON.parse(disk.get(scope ? `${root}.account.${scope}` : root)!);
}
function expectProjection(over: string, scope = '') {
  for (const root of ['karimbolandia.progress.v1', 'karimbolandia.wallet.v1']) {
    expect(stored(root, scope).equippedSkin).toBe(over);
    expect(stored(root, scope).ownedSkins).toEqual(['explorer', 'neon']);
    expect(stored(root, scope).coinsEarned).toBe(380);
  }
  expect(stored('karimbolandia.rewards.v1', scope)).toEqual({ skins: ['jacare'], equipped: 'jacare', over });
}

describe('projecao de traje compativel pertence ao perfil persistido', () => {
  it('preserva Explorador ao salvar o Jacare depois de carregar o modulo novamente', async () => {
    await seed('', 'explorer');
    const s = await import('../src/core/storage');
    expect(s.progress.equippedSkin).toBe('jacare');
    expect(s.saveProgress()).toBe(true);
    expectProjection('explorer');
    vi.resetModules();
    const reloaded = await import('../src/core/storage');
    expect(reloaded.progress.equippedSkin).toBe('jacare');
    reloaded.saveProgress();
    expectProjection('explorer');
  });

  it('nao mistura o Neon de outra conta com o Explorador do visitante', async () => {
    await seed('', 'explorer');
    await seed('B', 'neon');
    const s = await import('../src/core/storage');
    const { setProfile } = await import('../src/core/persistence');
    setProfile('B'); s.reloadProgress();
    s.progress.equippedSkin = 'neon'; s.saveProgress();
    s.progress.equippedSkin = 'jacare'; s.saveProgress();
    expectProjection('neon', 'B');
    setProfile(''); s.reloadProgress();
    expect(s.progress.equippedSkin).toBe('jacare');
    s.saveProgress();
    expectProjection('explorer');
    expectProjection('neon', 'B');
  });

  it('a projecao de outro objeto nao altera a ultima selecao persistida', async () => {
    await seed('', 'explorer');
    const s = await import('../src/core/storage');
    s.legacyView({ ...s.progress, equippedSkin: 'neon' });
    s.saveProgress();
    expectProjection('explorer');
  });

  it('recupera a selecao pela copia valida da carteira quando a principal esta danificada', async () => {
    await seed('', 'explorer');
    const root = 'karimbolandia.wallet.v1';
    disk.set(`${root}.backup`, disk.get(root)!);
    disk.set(root, '{broken');
    const s = await import('../src/core/storage');
    expect(s.progress.equippedSkin).toBe('jacare');
    expect(s.saveProgress()).toBe(true);
    expectProjection('explorer');
  });

  it('respeita a troca mais recente de traje feita por um cliente antigo', async () => {
    await seed('', 'explorer');
    for (const root of ['karimbolandia.progress.v1', 'karimbolandia.wallet.v1']) {
      disk.set(root, JSON.stringify({ ...stored(root), equippedSkin: 'neon' }));
    }
    const s = await import('../src/core/storage');
    expect(s.progress.equippedSkin).toBe('neon');
    s.saveProgress();
    expect(stored('karimbolandia.rewards.v1')).toEqual({ skins: ['jacare'], over: 'neon' });
    expect(s.progress.ownedSkins).toContain('jacare');
  });

  it('nao projeta um traje legado que deixou de pertencer ao perfil', async () => {
    await seed('', 'explorer');
    const s = await import('../src/core/storage');
    s.progress.ownedSkins = ['neon', 'jacare'];
    expect(s.legacyView(s.progress).equippedSkin).toBe('classic');
    expect(s.rewardsOf(s.progress).over).toBe('classic');
  });
});
