import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newCtl } from './helpers/bot';
import type { MinigameResult } from '../src/game/minigames/types';

let disk: Map<string, string>;
beforeEach(() => {
  disk = new Map();
  vi.stubGlobal('localStorage', { get length() { return disk.size; }, key: (i: number) => [...disk.keys()][i] ?? null, getItem: (k: string) => disk.get(k) ?? null, setItem: (k: string, v: string) => disk.set(k, v) });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

async function village(opts: { danced?: boolean } = {}) {
  const { World } = await import('../src/game/world');
  const { buildJungle } = await import('../src/game/level/jungle');
  const { DANCE_ID } = await import('../src/game/level/community');
  const w = new World(buildJungle());
  w.director.cine = null;
  w.invulnerable = true;
  w.enemies = [];
  if (opts.danced !== false) w.encounters.completed.add(DANCE_ID);
  const d = w.village.dance!;
  const hooks = { boxing: vi.fn<(done: (r: MinigameResult) => void, opts?: { champion?: boolean }) => void>(), banners: [] as string[] };
  w.hooks.onMinigame = (_id, done, opts) => hooks.boxing(done, opts);
  w.hooks.onBanner = (t) => hooks.banners.push(t);
  const idle = () => newCtl();
  const stand = (dx = -90) => { w.player.reset(d.x + dx, d.y); w.cameraSnap(); for (let i = 0; i < 24; i++) w.update(1 / 60, idle()); };
  stand();
  const agir = () => { const c = newCtl(); c.interact = { held: true, pressed: true, released: false }; return c; };
  const run = (s: number, ctl = idle) => { for (let i = 0; i < s * 60; i++) w.update(1 / 60, ctl()); };
  /** espera a fala terminar (as falas duram o tempo de ler o texto: nada de segundos fixos nos testes) */
  const settle = (max = 40) => { for (let i = 0; i < max * 60 && w.village.talk.busy; i++) w.update(1 / 60, idle()); };
  /** espera o boxe ser pedido (a n-ésima vez) */
  const untilBoxing = (n = 1, max = 40) => { for (let i = 0; i < max * 60 && hooks.boxing.mock.calls.length < n; i++) w.update(1 / 60, idle()); };
  return { w, d, hooks, stand, agir, run, idle, DANCE_ID, settle, untilBoxing };
}

describe('conversa com o jacaré da roda', () => {
  it('três AGIR dão os estágios 1, 2, 3 e pedem o boxe exatamente uma vez', async () => {
    const { w, hooks, agir, run, settle, untilBoxing } = await village();
    const t = w.village.talk;
    expect(t.stage).toBe(0);
    w.update(1 / 60, agir()); expect(t.stage).toBe(1);
    run(0.3);
    w.update(1 / 60, agir()); expect(t.stage).toBe(1); // ainda falando: o AGIR repetido não pula a fala
    settle();
    w.update(1 / 60, agir()); expect(t.stage).toBe(2);
    run(5);
    expect(t.pose).toBe('angry');
    settle();
    w.update(1 / 60, agir()); expect(t.stage).toBe(3);
    expect(w.player.lockInput).toBe(true);
    untilBoxing();
    expect(hooks.boxing).toHaveBeenCalledTimes(1);
    expect(t.balloons.length).toBeLessThanOrEqual(3);
  });

  it('as falas centrais saem na ordem do plano', async () => {
    const { w, agir, run, hooks } = await village();
    const seen: string[] = [];
    const t = w.village.talk;
    const watch = (until: () => boolean) => { for (let i = 0; i < 40 * 60 && !until(); i++) { w.update(1 / 60, newCtl()); for (const b of t.balloons) if (!seen.includes(b.text)) seen.push(b.text); } };
    w.update(1 / 60, agir()); watch(() => !t.busy);
    w.update(1 / 60, agir()); watch(() => !t.busy);
    w.update(1 / 60, agir()); watch(() => hooks.boxing.mock.calls.length > 0);
    const { TALK } = await import('../src/game/alligatorTalk');
    expect(seen).toEqual([TALK.stage1.k, TALK.stage1.g, TALK.stage2.k, TALK.stage2.g, TALK.stage3.k, TALK.uuuh, TALK.stage3.g, TALK.chant]);
    void run;
  });

  it('cada balão fica o tempo de LER o texto (ninguém é cortado pela metade) e a resposta só vem depois da leitura', async () => {
    const { w, agir, hooks } = await village();
    const { TALK, readTime } = await import('../src/game/alligatorTalk');
    const t = w.village.talk;
    const dur = new Map<string, number>(), start = new Map<string, number>();
    let now = 0;
    const watch = (until: () => boolean) => { for (let i = 0; i < 40 * 60 && !until(); i++) { w.update(1 / 60, newCtl()); now += 1 / 60; for (const b of t.balloons) { dur.set(b.text, b.dur); if (!start.has(b.text)) start.set(b.text, now); } } };
    w.update(1 / 60, agir()); watch(() => !t.busy);
    w.update(1 / 60, agir()); watch(() => !t.busy);
    w.update(1 / 60, agir()); watch(() => hooks.boxing.mock.calls.length > 0);
    for (const text of [TALK.stage1.k, TALK.stage1.g, TALK.stage2.k, TALK.stage2.g, TALK.stage3.k, TALK.stage3.g, TALK.chant]) {
      expect(dur.get(text), text).toBeGreaterThanOrEqual(readTime(text) - 1e-6);
      expect(dur.get(text)!, text).toBeGreaterThanOrEqual(2.4);
    }
    // a fala longa do jacaré (mais de 100 caracteres) passa de 8 s na tela
    expect(dur.get(TALK.stage1.g)!).toBeGreaterThan(8);
    // o jacaré responde quando o Karimbo já teve o tempo de ser lido (no máximo 0,3 s de sobreposição)
    expect(start.get(TALK.stage1.g)! - start.get(TALK.stage1.k)!).toBeGreaterThanOrEqual(readTime(TALK.stage1.k) - 0.35);
    expect(readTime('')).toBe(2.4);
    expect(readTime('x'.repeat(140))).toBeCloseTo(11.3, 1);
  });

  it('↑ continua batendo palmas (a roda de antes)', async () => {
    const { w, run } = await village();
    const up = () => { const c = newCtl(); c.moveY = -1; return c; };
    run(0.1, up);
    expect(w.village.active).toBe(true);
  });

  it('antes da primeira dança nada muda: AGIR não fala e andar até a roda entra nela', async () => {
    const { w, d, agir, stand } = await village({ danced: false });
    w.update(1 / 60, agir());
    expect(w.village.talk.stage).toBe(0);
    stand(-100);
    for (let i = 0; i < 20; i++) w.update(1 / 60, newCtl());
    expect(w.village.active).toBe(true);
    void d;
  });

  it('afastar 1500 px zera a conversa', async () => {
    const { w, agir, run, stand, settle } = await village();
    w.update(1 / 60, agir());
    settle();
    expect(w.village.talk.stage).toBe(1);
    stand(-1700);
    run(0.2);
    expect(w.village.talk.stage).toBe(0);
  });

  it('com porta mais perto que o jacaré a exploração vence; com o jacaré mais perto, a conversa vence', async () => {
    const { w, d } = await village();
    const t = w.village.talk;
    const px = w.player.x;
    expect(t.preferred(w, px + 20)).toBe(false); // porta quase em cima do Karimbo
    expect(t.preferred(w, d.x + 300)).toBe(true); // porta longe
    expect(t.preferred(w, undefined)).toBe(true); // nenhum ponto de exploração
  });

  it('ao fim do tapa o Karimbo fica travado só até o boxe começar e a conversa não repete', async () => {
    const { w, hooks, agir, settle, untilBoxing } = await village();
    for (let i = 0; i < 3; i++) { w.update(1 / 60, agir()); if (i < 2) settle(); else untilBoxing(); }
    expect(hooks.boxing).toHaveBeenCalledTimes(1);
    const done = hooks.boxing.mock.calls[0][0];
    done({ id: 'boxing', outcome: 'abort', time: 0, mistakes: 0 });
    expect(w.player.lockInput).toBe(false);
    expect(w.village.talk.stage).toBe(2); // abandonou: o próximo AGIR repete o tapa
    expect(w.encounters.completed.has('jungle:alligator-boxing')).toBe(false);
  });
});

describe('depois do boxe: derrota, vitória, nocaute e curativo', () => {
  async function fight(outcome: MinigameResult['outcome']) {
    const v = await village();
    for (let i = 0; i < 3; i++) { v.w.update(1 / 60, v.agir()); if (i < 2) v.settle(); else v.untilBoxing(); }
    v.hooks.boxing.mock.calls[0][0]({ id: 'boxing', outcome, time: 40, mistakes: 1 });
    return v;
  }

  it('derrota: próxima conversa vai direto ao boxe, sem prêmio e sem skin', async () => {
    const { w, hooks, agir, run, untilBoxing } = await fight('lose');
    expect(w.village.talk.lost).toBe(true);
    expect(w.encounters.completed.has('jungle:alligator-boxing')).toBe(false);
    expect(w.village.talk.mode).toBe('dance');
    run(2); // Karimbo tonto por 1,5 s
    expect(w.player.lockInput).toBe(false);
    w.update(1 / 60, agir());
    untilBoxing(2);
    expect(hooks.boxing).toHaveBeenCalledTimes(2);
    const { progress } = await import('../src/core/storage');
    expect(progress.ownedSkins).not.toContain('jacare');
  });

  it('vitória: skin uma vez, banner uma vez, jacaré nocauteado, palmas bloqueadas e crianças preocupadas', async () => {
    const { w, hooks, run, stand, idle } = await fight('win');
    const t = w.village.talk;
    expect(t.mode).toBe('ko');
    expect(w.encounters.completed.has('jungle:alligator-boxing')).toBe(true);
    expect(hooks.banners.filter((b) => b === 'SKIN DE JACARÉ DESBLOQUEADA!').length).toBe(1);
    const { progress } = await import('../src/core/storage');
    expect(progress.ownedSkins.filter((s) => s === 'jacare').length).toBe(1);
    // ↑ não bate palmas enquanto ele está nocauteado
    stand(-90);
    const up = () => { const c = newCtl(); c.moveY = -1; return c; };
    run(0.3, up);
    expect(w.village.active).toBe(false);
    // as crianças: uma agachada cutucando e as outras preocupadas
    const kids = w.village.residents.filter((r) => r.role === 'child');
    expect(kids.filter((k) => k.mood === 'poke').length).toBe(1);
    expect(kids.filter((k) => k.mood === 'worry').length).toBe(kids.length - 1);
    // falar com ele nocauteado: "Shhh! Ele tá dormindo!"
    const agir = () => { const c = newCtl(); c.interact = { held: true, pressed: true, released: false }; return c; };
    w.update(1 / 60, agir());
    expect(t.balloons.some((b) => b.who === 'kids' && b.text.includes('dormindo'))).toBe(true);
    run(0.1, idle);
  });

  it('afastar 2500 px: curativo, volta a dançar, palmas de volta e AGIR vira o cumprimento', async () => {
    const { w, run, stand, idle } = await fight('win');
    const t = w.village.talk;
    stand(-2700);
    run(0.2);
    expect(t.mode).toBe('bandaged');
    stand(-90);
    const up = () => { const c = newCtl(); c.moveY = -1; return c; };
    run(0.2, up);
    expect(w.village.active).toBe(true);
    // terminar as palmas para o AGIR valer
    run(8, idle);
    stand(-90);
    const agir = () => { const c = newCtl(); c.interact = { held: true, pressed: true, released: false }; return c; };
    w.update(1 / 60, agir());
    expect(t.balloons.some((b) => b.text.startsWith('Seu Karimbo!'))).toBe(true);
  });

  it('restaurar o save com a vitória já começa de curativo (e a skin não é entregue de novo)', async () => {
    const v = await village();
    v.w.encounters.completed.add('jungle:alligator-boxing');
    v.run(0.2);
    expect(v.w.village.talk.mode).toBe('bandaged');
    expect(v.hooks.banners).not.toContain('SKIN DE JACARÉ DESBLOQUEADA!');
  });

  it('reset no meio (respawn/novo jogo) solta o controle e a câmera', async () => {
    const { w, agir, run, settle } = await village();
    for (let i = 0; i < 3; i++) { w.update(1 / 60, agir()); if (i < 2) settle(); else run(1.5); }
    expect(w.player.lockInput).toBe(true);
    w.village.reset(w);
    expect(w.player.lockInput).toBe(false);
    expect(w.village.talk.stage).toBe(0);
    expect(w.village.talk.busy).toBe(false);
  });
});

describe('revisão T5–T8: reinício e skin', () => {
  it('nova partida depois de vencer: o jacaré volta a dançar (sem curativo) e esquece a derrota', async () => {
    const { w, d } = await village();
    w.encounters.completed.add('jungle:alligator-boxing');
    w.village.talk.lost = true;
    for (let i = 0; i < 10; i++) w.update(1 / 60, newCtl());
    expect(w.village.talk.mode).toBe('bandaged');
    w.restart();
    for (let i = 0; i < 10; i++) w.update(1 / 60, newCtl());
    expect(w.encounters.completed.has('jungle:alligator-boxing')).toBe(false);
    expect(w.village.talk.mode).toBe('dance');
    expect(w.village.talk.lost).toBe(false);
    void d;
  });

  it('vitória no save sem a skin (perfil de recompensas perdido): a skin é entregue de novo, uma vez', async () => {
    const { w, hooks } = await village();
    const { progress } = await import('../src/core/storage');
    expect(progress.ownedSkins).not.toContain('jacare');
    w.encounters.completed.add('jungle:alligator-boxing');
    for (let i = 0; i < 10; i++) w.update(1 / 60, newCtl());
    expect(progress.ownedSkins.filter((s) => s === 'jacare').length).toBe(1);
    for (let i = 0; i < 10; i++) w.update(1 / 60, newCtl());
    expect(progress.ownedSkins.filter((s) => s === 'jacare').length).toBe(1);
    expect(hooks.banners).not.toContain('SKIN DE JACARÉ DESBLOQUEADA!');
  });
});

describe('revanche contra o Jacaré Campeão', () => {
  const unlock = () => disk.set('karimbolandia.boxing.v1', JSON.stringify({ fights: 1, wins: 1, best: 'B', clean: false, champion: false }));
  /** vencido uma vez: de curativo, ao lado da roda, falando */
  async function won() {
    const v = await village();
    v.w.encounters.completed.add('jungle:alligator-boxing');
    v.run(0.3);
    return v;
  }
  const done = (v: Awaited<ReturnType<typeof won>>, outcome: MinigameResult['outcome']) =>
    v.hooks.boxing.mock.calls[0][0]({ id: 'boxing', outcome, time: 80, mistakes: 1, grade: 'A', champion: true });

  it('sem nenhuma vitória no cartão do boxe o AGIR só cumprimenta (nada de desafio)', async () => {
    const v = await won();
    v.w.update(1 / 60, v.agir());
    v.settle();
    v.w.update(1 / 60, v.agir());
    v.run(15);
    expect(v.hooks.boxing).not.toHaveBeenCalled();
  });

  it('um AGIR só oferece; o segundo, dentro da janela, aceita e pede o boxe do Campeão uma vez', async () => {
    unlock();
    const v = await won();
    v.w.update(1 / 60, v.agir());
    expect(v.w.village.talk.balloons.some((b) => b.text.includes('revanche'))).toBe(true);
    expect(v.hooks.boxing).not.toHaveBeenCalled();
    v.run(1);
    v.w.update(1 / 60, v.agir());
    expect(v.w.player.lockInput).toBe(true);
    v.untilBoxing();
    expect(v.hooks.boxing).toHaveBeenCalledTimes(1);
    expect(v.hooks.boxing.mock.calls[0][1]).toEqual({ champion: true });
  });

  it('o desafio expira: passada a janela, o AGIR volta a só oferecer', async () => {
    unlock();
    const v = await won();
    v.w.update(1 / 60, v.agir());
    v.run(14); // a janela do desafio (leitura da oferta + 2 s) já passou
    v.w.update(1 / 60, v.agir());
    v.run(1);
    expect(v.w.player.lockInput).toBe(false);
    expect(v.hooks.boxing).not.toHaveBeenCalled();
  });

  it('vencer o Campeão: sem skin nova, faixa própria e o jacaré nocauteado de novo', async () => {
    unlock();
    const v = await won();
    v.w.update(1 / 60, v.agir()); v.run(0.5);
    v.w.update(1 / 60, v.agir()); v.untilBoxing();
    done(v, 'win');
    expect(v.hooks.banners).toContain('CAMPEÃO DA RODA DERROTADO!');
    expect(v.hooks.banners).not.toContain('SKIN DE JACARÉ DESBLOQUEADA!');
    expect(v.w.village.talk.mode).toBe('ko');
    expect(v.w.player.lockInput).toBe(false);
  });

  it('perder para o Campeão não vira a derrota do boxe comum nem tranca o jogador', async () => {
    unlock();
    const v = await won();
    v.w.update(1 / 60, v.agir()); v.run(0.5);
    v.w.update(1 / 60, v.agir()); v.untilBoxing();
    done(v, 'lose');
    expect(v.w.village.talk.lost).toBe(false);
    expect(v.w.encounters.completed.has('jungle:alligator-boxing')).toBe(true);
    v.run(2);
    expect(v.w.player.lockInput).toBe(false);
  });
});
