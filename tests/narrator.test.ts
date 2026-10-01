import { mapTile as M } from '../src/game/level/index';
import { describe, it, expect } from 'vitest';
import { TILE } from '../src/game/level';
import { NARR_LEN, NARR_COUNT } from '../src/game/narrator';
import { makeWorld, teleport, Bot, run, newCtl, armUp } from './helpers/bot';
import type { World } from '../src/game/world';

/** Registra quando o narrador e as vozes dos personagens falam (pelo relógio do narrador). */
function spy(w: World) {
  const narr: { id: number; t0: number; t1: number }[] = [];
  const voices: { name: string; t0: number; t1: number }[] = [];
  const LEN: Record<string, number> = { karimboNomad: 1.5, karimboEncara: 3.7, bossIntro: 15.7 };
  w.hooks.onNarrate = (id) => narr.push({ id, t0: w.narrator.t, t1: w.narrator.t + NARR_LEN[id] });
  w.hooks.onNarrStop = () => {
    const last = narr[narr.length - 1];
    if (last) last.t1 = Math.min(last.t1, w.narrator.t);
  };
  const orig = w.voice.bind(w);
  w.voice = ((name: 'karimboNomad' | 'karimboEncara' | 'bossIntro', vol?: number) => {
    voices.push({ name, t0: w.narrator.t, t1: w.narrator.t + LEN[name] });
    return orig(name, vol);
  }) as World['voice'];
  w.hooks.onBossIntro = () => voices.push({ name: 'bossIntro', t0: w.narrator.t, t1: w.narrator.t + LEN.bossIntro });
  return { narr, voices };
}
const overlaps = (a: { t0: number; t1: number }, b: { t0: number; t1: number }) => a.t0 < b.t1 - 1e-6 && b.t0 < a.t1 - 1e-6;

describe('Narrador', () => {
  it('repete a fala 27 em cada tela de continuar, inclusive perto do chefe', () => {
    const w = makeWorld();
    const heard: number[] = [];
    w.hooks.onNarrate = (id) => heard.push(id);
    const boss = w.data.arenas.find((a) => a.id === 'boss')!;
    w.player.body.x = boss.triggerX - TILE;
    w.player.mode = 'dead';
    for (let i = 0; i < 3; i++) {
      w.narrator.onContinue();
      w.narrator.update(1 / 60);
      expect(heard.filter((id) => id === 27)).toHaveLength(i + 1);
      w.narrator.update(NARR_LEN[27] + 1);
    }
  });
  it('28 falas com duração conhecida', () => {
    expect(NARR_COUNT).toBe(28);
    for (let i = 1; i <= NARR_COUNT; i++) expect(NARR_LEN[i]).toBeGreaterThan(1);
  });

  it('abertura: a câmera passeia, o nome aparece e o controle volta quando a fala acaba', () => {
    const w = makeWorld();
    const { narr } = spy(w);
    w.director.startOpening();
    expect(w.player.lockInput).toBe(true);
    let t = 0;
    while (w.director.openingActive() && t < 30) {
      w.update(1 / 60, newCtl());
      t += 1 / 60;
    }
    expect(narr[0]?.id).toBe(1);
    expect(t).toBeGreaterThan(NARR_LEN[1] - 0.2);
    expect(t).toBeLessThan(NARR_LEN[1] + 1);
    expect(w.player.lockInput).toBe(false);
    // pular corta a fala
    const w2 = makeWorld();
    const s2 = spy(w2);
    w2.director.startOpening();
    for (let i = 0; i < 90; i++) w2.update(1 / 60, newCtl());
    w2.director.skipOpening();
    expect(w2.director.openingActive()).toBe(false);
    expect(w2.narrator.busy()).toBe(false);
    expect(s2.narr[0].t1).toBeLessThan(2);
  });

  it('abertura espera o áudio real mesmo além da duração estimada', () => {
    const w = makeWorld();
    let ready = false;
    let playing = true;
    w.hooks.narrReady = () => ready;
    w.hooks.narrPlaying = (id) => id === 1 && playing;
    w.director.startOpening();
    const ctl = newCtl();
    ctl.moveX = 1;
    const startX = w.player.x;
    for (let i = 0; i < 60 * 5; i++) w.update(1 / 60, ctl);
    expect(w.director.openingActive()).toBe(true); // decodificação passou do antigo prazo de 3 s
    expect(w.player.lockInput).toBe(true);
    ready = true;
    for (let i = 0; i < 60 * 18; i++) w.update(1 / 60, ctl);
    expect(w.narrator.t).toBeGreaterThan(NARR_LEN[1]);
    expect(w.director.openingActive()).toBe(true);
    expect(w.player.lockInput).toBe(true);
    expect(w.player.x).toBeCloseTo(startX, 0);
    playing = false;
    for (let i = 0; i < 3; i++) w.update(1 / 60, ctl);
    expect(w.director.openingActive()).toBe(false);
    expect(w.player.lockInput).toBe(false);
  });

  it('primeiro soldado: trava longe, mostra o alvo e espera a fala completa', () => {
    const w = makeWorld();
    const soldier = w.enemies.find((e) => e.spawn.type === 'rifle' && e.spawn.id >= 0)!;
    let ready = false;
    let playing = true;
    w.hooks.narrReady = (id) => id !== 2 || ready;
    w.hooks.narrPlaying = (id) => id === 2 && playing;
    teleport(w, M(20), 32);
    const startX = w.player.x;
    const hp = soldier.hp;
    expect(soldier.x - startX).toBeGreaterThan(560);
    const ctl = newCtl();
    ctl.moveX = 1;
    ctl.fire.held = true;
    ctl.grenade.pressed = true;
    for (let i = 0; i < 60 * 5; i++) w.update(1 / 60, ctl);
    expect(w.director.soldierIntroActive()).toBe(true);
    expect(w.player.lockInput).toBe(true);
    expect(w.player.x).toBeCloseTo(startX, 0);
    expect(w.camera.focus?.x).toBe(soldier.x - 150);
    expect(w.camera.zoomTarget).toBe(0.9);
    expect(soldier.hp).toBe(hp);
    expect(w.bullets).toHaveLength(0);
    expect(w.grenades).toHaveLength(0);
    ready = true;
    for (let i = 0; i < 60 * 18; i++) w.update(1 / 60, ctl);
    expect(w.narrator.played.has(2)).toBe(true);
    expect(w.narrator.t).toBeGreaterThan(NARR_LEN[2]);
    expect(w.director.soldierIntroActive()).toBe(true);
    expect(w.player.lockInput).toBe(true);
    expect(w.player.x).toBeCloseTo(startX, 0);
    expect(soldier.hp).toBe(hp);
    playing = false;
    for (let i = 0; i < 3; i++) w.update(1 / 60, newCtl());
    expect(w.director.soldierIntroActive()).toBe(false);
    expect(w.player.lockInput).toBe(false);
    expect(w.camera.focus).toBe(null);
    expect(w.narrator.log.filter((entry) => entry.id === 2)).toHaveLength(1);
  });

  it('a apresentação do Nômad espera o narrador: a voz do Karimbo nunca cruza com ele', () => {
    const w = makeWorld();
    const { narr, voices } = spy(w);
    teleport(w, M(534), 32);
    // força uma fala longa tocando bem na hora do gatilho da garagem
    w.narrator.played.clear();
    (w.narrator as unknown as { cur: number; curEnd: number }).cur = 21;
    (w.narrator as unknown as { cur: number; curEnd: number }).curEnd = w.narrator.t + NARR_LEN[21];
    narr.push({ id: 21, t0: w.narrator.t, t1: w.narrator.t + NARR_LEN[21] });
    const bot = new Bot(w, { walk: true });
    run(w, bot, newCtl(), 25, () => w.director.nomadMountable);
    const v = voices.find((x) => x.name === 'karimboNomad');
    expect(v).toBeTruthy();
    for (const n of narr) expect(overlaps(n, v!)).toBe(false);
  });

  it('a entrada do Felipão espera a fala do ALERTA terminar antes do áudio do chefe', () => {
    const w = makeWorld();
    const { narr, voices } = spy(w);
    const boss = w.data.arenas.find((a) => a.id === 'boss')!;
    const warn = w.data.triggers.find((t) => t.id === 'bossWarn')!;
    // chega no ALERTA e corre direto para o chefe
    teleport(w, Math.floor(warn.rect.x / TILE), 14);
    const ctl = newCtl();
    armUp(w);
    run(w, new Bot(w), ctl, 40, () => w.director.bossActive);
    ctl.moveX = 0;
    ctl.fire.held = false;
    ctl.jump.held = false;
    expect(narr.some((n) => n.id === 24)).toBe(true);
    for (let i = 0; i < 60 * 40 && !w.director.bossIntroDone; i++) w.update(1 / 60, ctl);
    const bi = voices.find((x) => x.name === 'bossIntro');
    expect(bi).toBeTruthy();
    for (const n of narr) for (const v of voices) expect(overlaps(n, v)).toBe(false);
    expect(w.director.bossIntroDone).toBe(true);
    void boss;
  });

  it('percorrendo a fase: falas em ordem, uma de cada vez, nunca por cima das vozes, sem repetir', () => {
    const w = makeWorld();
    armUp(w);
    const { narr, voices } = spy(w);
    const bot = new Bot(w);
    const ctl = newCtl();
    // trechos com gatilhos de narração
    for (const [tile, row, secs] of [
      [M(20), 32, 14], [M(204), 32, 14], [M(460), 32, 20], [M(534), 32, 16], [M(1094), 32, 14], [M(1104), 32, 12],
    ] as [number, number, number][]) {
      teleport(w, tile, row);
      run(w, bot, ctl, secs);
    }
    expect(narr.length).toBeGreaterThanOrEqual(4);
    // uma por vez
    for (let i = 1; i < narr.length; i++) expect(narr[i].t0).toBeGreaterThanOrEqual(narr[i - 1].t1 - 1e-6);
    // nunca junto com personagens
    for (const n of narr) for (const v of voices) expect(overlaps(n, v)).toBe(false);
    // nenhuma repetida
    expect(new Set(narr.map((n) => n.id)).size).toBe(narr.length);
  });

  it('falas que perdem o sentido são descartadas (sem tocar atrasadas)', () => {
    const w = makeWorld();
    const { narr } = spy(w);
    const nr = w.narrator;
    // ocupa o narrador e pede uma fala com prazo curto
    (nr as unknown as { cur: number; curEnd: number }).cur = 1;
    (nr as unknown as { cur: number; curEnd: number }).curEnd = nr.t + 6;
    nr.request(4, 1.6);
    for (let i = 0; i < 60 * 10; i++) w.update(1 / 60, newCtl());
    expect(narr.some((n) => n.id === 4)).toBe(false);
    expect(nr.played.has(4)).toBe(false);
  });

  it('a tela de resultados espera a fala da vitória', () => {
    const w = makeWorld();
    armUp(w);
    let completedAt = -1;
    const { narr } = spy(w);
    w.hooks.onComplete = () => (completedAt = w.narrator.t);
    const boss = w.data.arenas.find((a) => a.id === 'boss')!;
    teleport(w, Math.floor(boss.rect.x / TILE) + 8, 14);
    run(w, new Bot(w, { hold: true }), newCtl(), 300, () => completedAt >= 0);
    const v = narr.find((n) => n.id === 28);
    expect(v).toBeTruthy();
    expect(completedAt).toBeGreaterThanOrEqual(v!.t1 - 1e-6);
  }, 60000);
});
