import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newCtl } from './helpers/bot';

let disk: Map<string, string>;
beforeEach(() => {
  disk = new Map();
  vi.stubGlobal('localStorage', { get length() { return disk.size; }, key: (i: number) => [...disk.keys()][i] ?? null, getItem: (k: string) => disk.get(k) ?? null, setItem: (k: string, v: string) => disk.set(k, v), removeItem: (k: string) => disk.delete(k) });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

/** O validador do cliente ANTIGO (em cache): só conhece os 5 trajes de antes do Jacaré. */
const OLD_SKINS = ['classic', 'explorer', 'neon', 'diver', 'atlante'];
function oldClientAccepts(raw: string | undefined) {
  if (raw === undefined) return false;
  const v = JSON.parse(raw);
  if (!OLD_SKINS.includes(v.equippedSkin)) return false;
  if (!Array.isArray(v.ownedSkins) || v.ownedSkins.length > 4) return false;
  return v.ownedSkins.every((s: string) => OLD_SKINS.includes(s) && s !== 'classic');
}

describe('skin Jacaré: catálogo e saldo', () => {
  it('grantSkin entrega uma vez, só da fonte certa, e o saldo de moedas não muda', async () => {
    const { grantSkin, chooseSkin, coinBalance, collectCoin } = await import('../src/core/skins');
    const { progress, saveProgress } = await import('../src/core/storage');
    for (let i = 0; i < 40; i++) collectCoin();
    saveProgress();
    const before = coinBalance();
    expect(chooseSkin('jacare')).toBe('locked'); // antes de vencer o boxe
    expect(grantSkin('jacare', 'relics')).toBe(false); // fonte errada
    expect(grantSkin('jacare', 'boxing')).toBe(true);
    expect(grantSkin('jacare', 'boxing')).toBe(false); // uma vez só
    expect(progress.ownedSkins).toEqual(['jacare']);
    expect(coinBalance()).toBe(before);
    expect(chooseSkin('jacare')).toBe('equipped');
    expect(coinBalance()).toBe(before);
  });

  it('SKIN_PERKS é a fonte única: jacaré 1,3 fôlego / 1,4 nado / 1,1 vida; atlante segue 1,3 de nado', async () => {
    const { SKIN_PERKS, SKINS, breathesUnderwater } = await import('../src/core/skinCatalog');
    expect(SKIN_PERKS.jacare).toEqual({ air: 1.3, swim: 1.4, hp: 1.1 });
    expect(SKIN_PERKS.atlante.swim).toBe(1.3);
    for (const s of SKINS) expect(SKIN_PERKS[s.id]).toBeDefined();
    expect(breathesUnderwater('jacare')).toBe(false); // mais fôlego, mas NÃO respira debaixo d'água
    expect(SKINS.find((s) => s.id === 'jacare')!.price).toBe(0);
  });
});

describe('skin Jacaré: vantagens no Karimbo', () => {
  async function world() {
    const { World } = await import('../src/game/world');
    const { buildJungle } = await import('../src/game/level/jungle');
    const w = new World(buildJungle());
    w.director.cine = null;
    w.invulnerable = true;
    w.enemies = [];
    return w;
  }

  it('vida 119→round(119×1,1), fôlego 13,8→×1,3 e nado 1,4× (e o Atlante continua 1,3×)', async () => {
    const { progress } = await import('../src/core/storage');
    const { karimboStats } = await import('../src/core/gearCatalog');
    const { TILE } = await import('../src/game/level');
    const w = await world();
    const p = w.player;
    const st = karimboStats(progress.gear);
    expect(p.maxHp).toBe(st.hp);
    progress.ownedSkins.push('jacare', 'atlante');
    // vestir na pausa: o Player reaplica sozinho
    progress.equippedSkin = 'jacare';
    w.update(1 / 60, newCtl());
    expect(p.maxHp).toBe(Math.round(st.hp * 1.1));
    expect(p.maxHp).toBe(Math.round(119 * 1.1));
    expect(p.oxyMax).toBeCloseTo(st.air * 1.3);
    // nado: velocidade horizontal estável = 150 × nado do equipamento × traje
    const speedWith = (skin: 'jacare' | 'atlante' | 'classic') => {
      progress.equippedSkin = skin;
      p.reset(500 * TILE, 38 * TILE);
      p.swimming = true;
      const ctl = newCtl();
      let vx = 0;
      for (let i = 0; i < 90; i++) { ctl.moveX = 1; w.update(1 / 60, ctl); vx = p.body.vx; if (p.body.x > 540 * TILE) p.body.x = 500 * TILE; }
      return vx;
    };
    const base = speedWith('classic');
    expect(base).toBeCloseTo(150 * st.swim, 0);
    expect(speedWith('atlante') / base).toBeCloseTo(1.3, 1);
    expect(speedWith('jacare') / base).toBeCloseTo(1.4, 1);
    progress.equippedSkin = 'classic';
    w.update(1 / 60, newCtl());
    expect(p.maxHp).toBe(st.hp);
  });
});

describe('skin Jacaré: o perfil antigo nunca é invalidado por causa dela (Foco 1)', () => {
  it('perfil e carteira gravados com o Jacaré continuam válidos para um cliente ANTIGO; o traje vive numa chave à parte', async () => {
    const { grantSkin, chooseSkin, collectCoin, coinBalance } = await import('../src/core/skins');
    const { progress, saveProgress } = await import('../src/core/storage');
    for (let i = 0; i < 50; i++) collectCoin();
    saveProgress();
    chooseSkin('explorer'); // não tem 100 moedas: segue clássico (insufficient)
    expect(grantSkin('jacare', 'boxing')).toBe(true);
    expect(chooseSkin('jacare')).toBe('equipped');
    expect(progress.equippedSkin).toBe('jacare');
    const main = disk.get('karimbolandia.progress.v1');
    const wallet = disk.get('karimbolandia.wallet.v1');
    expect(oldClientAccepts(main)).toBe(true);
    expect(oldClientAccepts(wallet)).toBe(true);
    expect(JSON.parse(main!).ownedSkins).toEqual([]);
    expect(JSON.parse(main!).coinsEarned).toBeGreaterThanOrEqual(50);
    const rewards = JSON.parse(disk.get('karimbolandia.rewards.v1')!);
    expect(rewards).toMatchObject({ skins: ['jacare'], equipped: 'jacare' });
    expect(coinBalance()).toBe(50);
  });

  it('um cliente novo recarrega o Jacaré (dono e equipado) e as moedas', async () => {
    const a = await import('../src/core/skins');
    const s = await import('../src/core/storage');
    for (let i = 0; i < 30; i++) a.collectCoin();
    s.saveProgress();
    a.grantSkin('jacare', 'boxing');
    a.chooseSkin('jacare');
    vi.resetModules();
    const s2 = await import('../src/core/storage');
    const a2 = await import('../src/core/skins');
    expect(s2.progress.ownedSkins).toContain('jacare');
    expect(s2.progress.equippedSkin).toBe('jacare');
    a2.ensureWallet();
    expect(a2.coinBalance()).toBe(30);
  });

  it('um cliente ANTIGO que escreve o perfil depois não apaga o Jacaré (a chave de recompensas fica intacta)', async () => {
    const a = await import('../src/core/skins');
    a.grantSkin('jacare', 'boxing');
    a.chooseSkin('jacare');
    // o cliente antigo troca para Explorador e grava o perfil principal do jeito dele
    const main = JSON.parse(disk.get('karimbolandia.progress.v1')!);
    main.equippedSkin = 'explorer';
    main.ownedSkins = ['explorer'];
    disk.set('karimbolandia.progress.v1', JSON.stringify(main));
    // (o cliente antigo grava também o espelho da carteira, como o atual faz)
    const wallet = JSON.parse(disk.get('karimbolandia.wallet.v1')!);
    disk.set('karimbolandia.wallet.v1', JSON.stringify({ ...wallet, equippedSkin: 'explorer', ownedSkins: ['explorer'] }));
    vi.resetModules();
    const s2 = await import('../src/core/storage');
    expect(s2.progress.ownedSkins.sort()).toEqual(['explorer', 'jacare']);
    expect(s2.progress.equippedSkin).toBe('explorer'); // o perfil principal mudou depois: ele vence
    expect(disk.get('karimbolandia.rewards.v1')).toBeDefined();
  });

  it('perfil sem o Jacaré não ganha a chave nova (nada muda para quem não venceu o boxe)', async () => {
    const { chooseSkin, collectCoin } = await import('../src/core/skins');
    const { saveProgress } = await import('../src/core/storage');
    for (let i = 0; i < 120; i++) collectCoin();
    saveProgress();
    chooseSkin('explorer');
    expect(disk.has('karimbolandia.rewards.v1')).toBe(false);
  });

  it('o validador novo aceita perfil com Jacaré e a carteira de backup exportada o preserva', async () => {
    const { grantSkin, chooseSkin } = await import('../src/core/skins');
    const { validateProgress, defaultProgress } = await import('../src/core/storage');
    grantSkin('jacare', 'boxing');
    chooseSkin('jacare');
    const p = { ...defaultProgress(), ownedSkins: ['jacare'], equippedSkin: 'jacare' };
    expect(validateProgress(p)).not.toBeNull();
    const { exportBackup, parseBackup } = await import('../src/core/profile');
    const back = parseBackup(exportBackup());
    expect(back.progress.ownedSkins).toContain('jacare');
    expect(back.progress.equippedSkin).toBe('jacare');
  });
});

describe('skin Jacaré: arte e loja', () => {
  it('a vitrine tem o traje com rabo e o chapéu de caça (cabeça de jacaré) só nele', async () => {
    const { bakeGatorHood, bakeGatorTail } = await import('../src/art/alligatorHood');
    expect(typeof bakeGatorHood).toBe('function');
    expect(typeof bakeGatorTail).toBe('function');
    const src = (await import('node:fs')).readFileSync('src/art/index.ts', 'utf8');
    expect(src).toContain("jacare: bakeKarimbo(classic.heads, 'jacare', classic)");
    const k = (await import('node:fs')).readFileSync('src/art/karimbo.ts', 'utf8');
    expect(k).toContain("skin === 'jacare' ? { tail: bakeGatorTail(), hood: bakeGatorHood() }");
  });
});
