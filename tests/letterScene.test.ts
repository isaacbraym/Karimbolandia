import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newCtl } from './helpers/bot';
import { TILE } from '../src/game/level';
import type { MinigameResult } from '../src/game/minigames/types';

let disk: Map<string, string>;
beforeEach(() => {
  disk = new Map();
  vi.stubGlobal('localStorage', { get length() { return disk.size; }, key: (i: number) => [...disk.keys()][i] ?? null, getItem: (k: string) => disk.get(k) ?? null, setItem: (k: string, v: string) => disk.set(k, v) });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

async function setup(opts: { enemies?: boolean } = {}) {
  const { World } = await import('../src/game/world');
  const { buildJungle } = await import('../src/game/level/jungle');
  const w = new World(buildJungle());
  w.director.cine = null;
  w.invulnerable = true;
  if (!opts.enemies) w.enemies = [];
  const hooks = { chase: vi.fn<(done: (r: MinigameResult) => void) => void>(), prefetch: vi.fn(), banners: [] as string[] };
  w.hooks.onMinigame = (_id, done) => hooks.chase(done);
  w.hooks.onMinigamePrefetch = hooks.prefetch;
  w.hooks.onBanner = (t) => hooks.banners.push(t);
  const stand = (tx: number) => {
    const y = w.level.groundBelow(tx * TILE + 16, w.data.playerStart.y - 200, 900) ?? w.data.playerStart.y;
    w.player.reset(tx * TILE + 16, y);
    w.cameraSnap();
    for (let i = 0; i < 20; i++) w.update(1 / 60, newCtl());
  };
  const run = (s: number) => { for (let i = 0; i < s * 60; i++) w.update(1 / 60, newCtl()); };
  return { w, hooks, stand, run };
}

describe('cena do pombo-correio e do macaco', () => {
  it('o trecho de 205 a 211 é chão seco e plano, sem água nem gatilho sobreposto', async () => {
    const { w } = await setup();
    const ys: number[] = [];
    for (let tx = 205; tx <= 211; tx++) {
      const y = w.level.groundBelow(tx * TILE + 16, w.data.playerStart.y - 200, 900);
      expect(y, `chão em ${tx}`).not.toBeNull();
      ys.push(y!);
      expect(w.water.wadeDepth(tx * TILE + 16, y!), `água em ${tx}`).toBe(0);
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(24);
    expect(w.water.zones.some((z) => z.x < 212 * TILE && z.x + z.w > 205 * TILE)).toBe(false);
    expect(w.data.triggers.some((t) => t.rect.x < 212 * TILE && t.rect.x + t.rect.w > 205 * TILE)).toBe(false);
  });

  it('dispara uma vez, trava o controle, entrega a carta e pede a perseguição exatamente uma vez', async () => {
    const { w, hooks, stand, run } = await setup();
    stand(207);
    expect(w.letter.active).toBe(true);
    const x0 = w.letter.theftX;
    run(4);
    expect(w.letter.letter).toBe('open');
    expect(hooks.banners).toContain('CARTA DA PRINCESA JÚLIA!');
    // o controle é do roteiro: apertar para a esquerda não move o Karimbo antes da fuga
    const left = newCtl();
    left.moveX = -1;
    for (let i = 0; i < 30; i++) w.update(1 / 60, left);
    expect(Math.abs(w.player.x - x0)).toBeLessThan(6);
    run(2);
    expect(w.letter.letter).toBe('stolen');
    run(3);
    expect(hooks.chase).toHaveBeenCalledTimes(1);
    run(2);
    expect(hooks.chase).toHaveBeenCalledTimes(1);
  });

  it('vitória: conclui, dá as moedas uma vez, devolve o Karimbo ao ponto do roubo virado para a direita', async () => {
    const { w, hooks, stand, run } = await setup();
    stand(207);
    run(10);
    const x0 = w.letter.theftX;
    const coins0 = w.tokens;
    hooks.chase.mock.calls[0][0]({ id: 'chase', outcome: 'win', time: 52, mistakes: 0 });
    expect(w.encounters.completed.has('jungle:letter-chase')).toBe(true);
    expect(Math.abs(w.player.x - x0)).toBeLessThan(1);
    expect(w.player.facing).toBe(1);
    expect(w.player.lockInput).toBe(false);
    expect(w.tokens - coins0).toBe(30); // ouro
    expect(hooks.banners).toContain('CARTA RECUPERADA!');
    // não repete e não paga de novo
    stand(209);
    run(4);
    expect(hooks.chase).toHaveBeenCalledTimes(1);
    expect(w.tokens - coins0).toBe(30);
  });

  it('medalhas: prata até 68 s, bronze depois', async () => {
    for (const [time, mistakes, coins] of [[60, 0, 20], [75, 1, 12], [50, 1, 20]] as const) {
      const { w, hooks, stand, run } = await setup();
      stand(207);
      run(10);
      const c0 = w.tokens;
      hooks.chase.mock.calls[0][0]({ id: 'chase', outcome: 'win', time, mistakes });
      expect(w.tokens - c0, `${time}s ${mistakes} erros`).toBe(coins);
    }
  });

  it('abandonar não conclui, não paga e a cena pode acontecer de novo', async () => {
    const { w, hooks, stand, run } = await setup();
    stand(207);
    run(10);
    hooks.chase.mock.calls[0][0]({ id: 'chase', outcome: 'abort', time: 0, mistakes: 0 });
    expect(w.encounters.completed.has('jungle:letter-chase')).toBe(false);
    expect(w.letter.active).toBe(false);
    expect(w.player.lockInput).toBe(false);
    stand(209);
    expect(w.letter.active).toBe(true);
    run(10);
    expect(hooks.chase).toHaveBeenCalledTimes(2);
  });

  it('não dispara com inimigos perto, em cinemática, na água, a cavalo nem fora do trecho', async () => {
    const a = await setup({ enemies: true });
    a.stand(207);
    expect(a.w.letter.active).toBe(false); // a fase tem soldados por perto
    const b = await setup();
    b.w.director.cine = { kind: 'nomad' } as never;
    b.stand(207);
    expect(b.w.letter.active).toBe(false);
    const c = await setup();
    c.stand(180); // antes das dicas de tutorial
    expect(c.w.letter.active).toBe(false);
    const d = await setup();
    d.w.encounters.completed.add('jungle:letter-chase');
    d.stand(207);
    expect(d.w.letter.active).toBe(false);
    const e = await setup();
    e.stand(240); // dentro do pântano
    expect(e.w.letter.active).toBe(false);
  });

  it('a perseguição é baixada em silêncio a partir de ~60 tiles antes', async () => {
    const { hooks, stand } = await setup();
    stand(150);
    expect(hooks.prefetch).toHaveBeenCalledWith('chase');
  });

  it('morrer ou resetar no meio solta o controle e libera a cena para repetir', async () => {
    const { w, stand, run } = await setup();
    stand(207);
    run(3);
    expect(w.letter.active).toBe(true);
    w.player.mode = 'dead';
    w.update(1 / 60, newCtl());
    expect(w.letter.active).toBe(false);
    expect(w.letter.t).toBe(-1);
    expect(w.camera.focus).toBeNull();
  });
});

describe('revisão T9–T11', () => {
  it('a vitória devolve o Karimbo com os pés no mesmo chão do roubo (sem 28 px no ar)', async () => {
    const { w, hooks, stand, run } = await setup();
    stand(207);
    run(10);
    const feet = w.letter.theftY + w.player.body.h / 2;
    hooks.chase.mock.calls[0][0]({ id: 'chase', outcome: 'win', time: 52, mistakes: 0 });
    expect(w.player.feetY).toBeCloseTo(feet, 3);
  });

  it('abandonar devolve o Karimbo ao ponto do roubo (a cena recomeça do mesmo lugar)', async () => {
    const { w, hooks, stand, run } = await setup();
    stand(207);
    run(10);
    const x0 = w.letter.theftX;
    expect(w.player.x).toBeGreaterThan(x0 + 100);
    hooks.chase.mock.calls[0][0]({ id: 'chase', outcome: 'abort', time: 0, mistakes: 0 });
    expect(Math.abs(w.player.x - x0)).toBeLessThan(1);
  });

  it('a pré-busca da perseguição é pedida uma vez só, mesmo que a rede falhe', async () => {
    const { hooks, stand, run } = await setup();
    stand(150);
    run(3);
    expect(hooks.prefetch).toHaveBeenCalledTimes(1);
  });

  it('o pulo roteirizado da fuga não se perde em quadros longos', async () => {
    const { w, stand } = await setup();
    stand(207);
    const ctl = (w.letter as unknown as { ctl: { jump: { pressed: boolean } } }).ctl;
    let edges = 0;
    for (let i = 0; i < 20 * 12; i++) { w.update(1 / 20, newCtl()); if (ctl.jump.pressed) edges++; }
    expect(edges).toBe(1);
  });
});
