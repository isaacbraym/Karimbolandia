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
  const hooks = { boxing: vi.fn<(done: (r: MinigameResult) => void) => void>(), banners: [] as string[] };
  w.hooks.onMinigame = (_id, done) => hooks.boxing(done);
  w.hooks.onBanner = (t) => hooks.banners.push(t);
  const idle = () => newCtl();
  const stand = (dx = -90) => { w.player.reset(d.x + dx, d.y); w.cameraSnap(); for (let i = 0; i < 24; i++) w.update(1 / 60, idle()); };
  stand();
  const agir = () => { const c = newCtl(); c.interact = { held: true, pressed: true, released: false }; return c; };
  const run = (s: number, ctl = idle) => { for (let i = 0; i < s * 60; i++) w.update(1 / 60, ctl()); };
  return { w, d, hooks, stand, agir, run, idle, DANCE_ID };
}

describe('conversa com o jacaré da roda', () => {
  it('três AGIR dão os estágios 1, 2, 3 e pedem o boxe exatamente uma vez', async () => {
    const { w, hooks, agir, run } = await village();
    const t = w.village.talk;
    expect(t.stage).toBe(0);
    w.update(1 / 60, agir()); expect(t.stage).toBe(1);
    run(0.3);
    w.update(1 / 60, agir()); expect(t.stage).toBe(1); // ainda falando: o AGIR repetido não pula a fala
    run(6);
    w.update(1 / 60, agir()); expect(t.stage).toBe(2);
    run(1.8);
    expect(t.pose).toBe('angry');
    run(5);
    w.update(1 / 60, agir()); expect(t.stage).toBe(3);
    expect(w.player.lockInput).toBe(true);
    run(10);
    expect(hooks.boxing).toHaveBeenCalledTimes(1);
    expect(t.balloons.length).toBeLessThanOrEqual(3);
  });

  it('as falas centrais saem na ordem do plano', async () => {
    const { w, agir, run } = await village();
    const seen: string[] = [];
    const t = w.village.talk;
    const watch = (s: number) => { for (let i = 0; i < s * 60; i++) { w.update(1 / 60, newCtl()); for (const b of t.balloons) if (!seen.includes(b.text)) seen.push(b.text); } };
    w.update(1 / 60, agir()); watch(6);
    w.update(1 / 60, agir()); watch(6);
    w.update(1 / 60, agir()); watch(9);
    const { TALK } = await import('../src/game/alligatorTalk');
    expect(seen).toEqual([TALK.stage1.k, TALK.stage1.g, TALK.stage2.k, TALK.stage2.g, TALK.stage3.k, TALK.uuuh, TALK.stage3.g, TALK.chant]);
    void run;
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
    const { w, agir, run, stand } = await village();
    w.update(1 / 60, agir());
    run(6);
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
    const { w, hooks, agir, run } = await village();
    for (let i = 0; i < 3; i++) { w.update(1 / 60, agir()); run(i < 2 ? 6 : 10); }
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
    for (let i = 0; i < 3; i++) { v.w.update(1 / 60, v.agir()); v.run(i < 2 ? 6 : 10); }
    v.hooks.boxing.mock.calls[0][0]({ id: 'boxing', outcome, time: 40, mistakes: 1 });
    return v;
  }

  it('derrota: próxima conversa vai direto ao boxe, sem prêmio e sem skin', async () => {
    const { w, hooks, agir, run } = await fight('lose');
    expect(w.village.talk.lost).toBe(true);
    expect(w.encounters.completed.has('jungle:alligator-boxing')).toBe(false);
    expect(w.village.talk.mode).toBe('dance');
    run(2); // Karimbo tonto por 1,5 s
    expect(w.player.lockInput).toBe(false);
    w.update(1 / 60, agir());
    run(6);
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
    run(6, idle);
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
    const { w, agir, run } = await village();
    for (let i = 0; i < 3; i++) { w.update(1 / 60, agir()); run(i < 2 ? 6 : 1.5); }
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
