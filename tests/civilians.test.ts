import { mapTile as M } from '../src/game/level/index';
import { describe, it, expect } from 'vitest';
import { buildLevel } from '../src/game/level/index';
import { T, TILE } from '../src/game/level';
import { lookKey } from '../src/game/civLook';
import { PHRASES, TALK_DIST } from '../src/game/civilians';
import { INTRO_DROP, INTRO_TOTAL, INTRO_COMIC_LEN, INTRO_LEN, KARIMBO_VOICE_LEN } from '../src/game/bossIntro';
import { makeWorld, armUp, teleport, Bot, run, newCtl } from './helpers/bot';
import type { World } from '../src/game/world';
import type { Felipao } from '../src/game/enemies/felipao';

const data = buildLevel();
const L = data.level;

describe('Civis: posições na fase', () => {
  const civs = data.civilians;

  it('10 a 16 civis em 5 a 7 pontos da fase', () => {
    expect(civs.length).toBeGreaterThanOrEqual(10);
    expect(civs.length).toBeLessThanOrEqual(16);
    const xs = civs.map((c) => c.x).sort((a, b) => a - b);
    let spots = 1;
    for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > 20 * TILE) spots++;
    expect(spots).toBeGreaterThanOrEqual(5);
    expect(spots).toBeLessThanOrEqual(7);
  });

  it('todos dentro da fase depois dos cortes', () => {
    for (const c of civs) {
      expect(Number.isFinite(c.x)).toBe(true);
      expect(c.x).toBeGreaterThan(2 * TILE);
      expect(c.x).toBeLessThan((L.w - 2) * TILE);
      expect(c.y).toBeGreaterThan(0);
      expect(c.y).toBeLessThan(L.h * TILE);
    }
  });

  it('sobre chão sólido (nunca plataforma one-way), com espaço livre acima e longe de buracos', () => {
    const w = makeWorld();
    const bad: string[] = [];
    for (const c of civs) {
      const tx = Math.floor(c.x / TILE);
      const ty = Math.round(c.y / TILE);
      expect(c.y % TILE).toBe(0);
      for (let dx = -1; dx <= 1; dx++) {
        if (L.get(tx + dx, ty) !== T.SOLID) bad.push(`civil #${c.id} sem chão sólido em (${tx + dx},${ty}): ${L.get(tx + dx, ty)}`);
        for (let up = 1; up <= 3; up++) if (L.get(tx + dx, ty - up) === T.SOLID || L.get(tx + dx, ty - up) === T.HAZARD) bad.push(`civil #${c.id} dentro de sólido em (${tx + dx},${ty - up})`);
      }
      for (const p of w.pits) if (c.x > p.x0 - 3 * TILE && c.x < p.x1 + 3 * TILE) bad.push(`civil #${c.id} perto do buraco ${p.x0 / TILE}..${p.x1 / TILE}`);
    }
    expect(bad).toEqual([]);
  });

  it('fora de arenas (inclusive a do chefe) e fora do trecho obrigatório do Nômad', () => {
    const gate = Math.floor(data.nomadSpawn.x / TILE) + 36;
    const dm = data.triggers.find((t) => t.id === 'dismount')!;
    const hordeFrom = (gate + 4) * TILE;
    const hordeTo = (Math.floor(dm.rect.x / TILE) - 6) * TILE;
    for (const c of civs) {
      for (const a of data.arenas) expect(c.x < a.rect.x - TILE || c.x > a.rect.x + a.rect.w + TILE, `civil #${c.id} na arena ${a.id}`).toBe(true);
      expect(c.x < hordeFrom || c.x > hordeTo, `civil #${c.id} no trecho das hordas`).toBe(true);
    }
  });

  it('nenhum civil repetido: combinações de aparência únicas', () => {
    const keys = civs.map((c) => lookKey(c.look!));
    expect(new Set(keys).size).toBe(civs.length);
    // variedade de verdade (não só cores)
    expect(new Set(civs.map((c) => c.look!.hair)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(civs.map((c) => c.look!.top)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(civs.map((c) => c.look!.build)).size).toBeGreaterThanOrEqual(4);
    // determinístico
    expect(buildLevel().civilians.map((c) => lookKey(c.look!))).toEqual(keys);
  });

  it('há todos os comportamentos: comemorando, pedindo ajuda, fugindo e com medo', () => {
    const moods = new Set(civs.map((c) => c.mood));
    expect([...moods].sort()).toEqual(['cheer', 'flee', 'help', 'scared']);
  });
});

describe('Civis: simulação headless (sem arte)', () => {
  it('reagem ao Karimbo, falam uma frase por vez e não são alvos', () => {
    const w = makeWorld();
    w.invulnerable = true;
    const ctl = newCtl();
    const said: number[] = [];
    let maxTalkers = 0;
    let cheered = false;
    // a rua inicial: o jogador nasce perto dos primeiros moradores
    for (let i = 0; i < 60 * 6; i++) {
      ctl.moveX = i < 60 * 2 ? 1 : 0;
      w.update(1 / 60, ctl);
      const c = w.crowd;
      if (c.talker && said[said.length - 1] !== c.phrase) said.push(c.phrase);
      maxTalkers = Math.max(maxTalkers, c.talker ? 1 : 0);
      if (c.list.some((x) => x.act === 'cheer' && x.hop > 0)) cheered = true;
    }
    expect(cheered).toBe(true);
    expect(said.length).toBeGreaterThan(0);
    for (const ph of said) expect(PHRASES[ph]).toBeTruthy();
    // a mesma frase nunca sai duas vezes seguidas
    for (let i = 1; i < said.length; i++) expect(said[i]).not.toBe(said[i - 1]);
    // quem fala estava perto (~260 px) e vira para o Karimbo
    const first = w.crowd.list[0];
    expect(TALK_DIST).toBeGreaterThanOrEqual(240);
    expect(first.facing).toBe(Math.sign(w.player.x - first.x) || first.facing);
    // não são alvos: explosão e tiros não os afetam (nem bloqueiam)
    const n = w.crowd.list.length;
    w.explode(first.x, first.y - 30, 120, 80, 0);
    expect(w.crowd.list.length).toBe(n);
    expect(w.enemies.some((e) => (e as unknown) === first)).toBe(false);
    expect(w.solidRects.some((r) => first.x > r.x && first.x < r.x + r.w && first.y - 20 > r.y && first.y - 20 < r.y + r.h)).toBe(false);
  });

  it('quem foge corre um trecho curto quando o tiroteio chega e depois se esconde', () => {
    const w = makeWorld();
    armUp(w);
    const fleer = w.crowd.list.find((c) => c.mood === 'flee')!;
    teleport(w, Math.floor(fleer.x / TILE) - 2, 32);
    const x0 = fleer.x;
    const bot = new Bot(w, { hold: true });
    const ctl = newCtl();
    let ran = false;
    run(w, bot, ctl, 8, () => {
      if (fleer.act === 'run') ran = true;
      return ran && fleer.act === 'cower';
    });
    expect(ran).toBe(true);
    expect(fleer.act).toBe('cower');
    expect(Math.abs(fleer.x - x0)).toBeGreaterThan(40);
    expect(Math.abs(fleer.x - x0)).toBeLessThan(260);
    // continua sobre chão sólido
    expect(L.get(Math.floor(fleer.x / TILE), Math.round(fleer.y / TILE))).toBe(T.SOLID);
  });

  it('longe da câmera ficam congelados (não atualizam)', () => {
    const w = makeWorld();
    const far = w.crowd.list[w.crowd.list.length - 1];
    const t0 = far.t;
    for (let i = 0; i < 30; i++) w.update(1 / 60, newCtl());
    expect(far.t).toBe(t0);
  });
});

/** Coloca o jogador na arena do chefe e dispara a entrada. */
function enterBoss(w: World) {
  const boss = w.data.arenas.find((a) => a.id === 'boss')!;
  teleport(w, Math.floor(boss.rect.x / TILE) + 8, 14);
  const ctl = newCtl();
  for (let i = 0; i < 30 && !w.director.bossActive; i++) w.update(1 / 60, ctl);
  expect(w.director.bossActive).toBe(true);
  return ctl;
}

describe('Entrada do Felipão (sem áudio)', () => {
  it('roda até o fim por tempo: suspense sem chefe, revelação, HQ e a luta começa', () => {
    const w = makeWorld();
    w.invulnerable = false;
    const ctl = enterBoss(w);
    const d = w.director;
    expect(d.longIntroActive()).toBe(true);
    expect(w.player.lockInput).toBe(true);
    const hp0 = w.player.hp;
    let t = 0;
    let sawBossBeforeDrop = false;
    let landedAt = -1;
    while (d.longIntroActive() && t < 30) {
      w.update(1 / 60, ctl);
      t += 1 / 60;
      if (t < INTRO_DROP - 0.05 && d.bossRef) sawBossBeforeDrop = true;
      if (landedAt < 0 && d.introLandT() >= 0) landedAt = t;
    }
    expect(sawBossBeforeDrop).toBe(false);
    expect(landedAt).toBeGreaterThan(INTRO_DROP);
    expect(landedAt).toBeLessThan(INTRO_DROP + 1.6);
    // áudio do chefe (~15,7 s) e, em sequência, a voz do Karimbo (3,7 s)
    expect(INTRO_TOTAL).toBeGreaterThanOrEqual(INTRO_LEN + KARIMBO_VOICE_LEN);
    expect(t).toBeGreaterThan(INTRO_TOTAL - 0.3);
    expect(t).toBeLessThan(INTRO_TOTAL + 0.5);
    // ninguém atacou durante a cena
    expect(w.player.hp).toBe(hp0);
    // terminou na luta
    expect(d.bossIntroDone).toBe(true);
    expect(w.player.lockInput).toBe(false);
    expect(w.musicState).toBe('boss1');
    const b = d.bossRef as Felipao;
    expect(b).toBeTruthy();
    expect(b.introHold).toBe(false);
    expect(b.state).not.toBe('enter');
    expect(d.cracks.length).toBe(1);
  });

  it('com o jogo por cima: a HQ recebe a duração certa e a luta começa quando ela acaba', () => {
    const w = makeWorld();
    let comicLen = -1;
    let ended = 0;
    let started = 0;
    w.hooks.onBossIntro = () => started++;
    w.hooks.onBossComic = (len) => (comicLen = len);
    w.hooks.onBossIntroEnd = () => ended++;
    const ctl = enterBoss(w);
    expect(started).toBe(1);
    for (let i = 0; i < 60 * 12 && comicLen < 0; i++) w.update(1 / 60, ctl);
    expect(comicLen).toBeCloseTo(INTRO_COMIC_LEN, 3);
    // enquanto a HQ não acaba, a luta não começa
    for (let i = 0; i < 60 * 10; i++) w.update(1 / 60, ctl);
    expect(w.director.bossIntroDone).toBe(false);
    w.director.onComicDone();
    w.update(1 / 60, ctl);
    expect(w.director.bossIntroDone).toBe(true);
    expect(ended).toBe(1);
  });

  it('pular vai direto para a luta (chefe já no chão) e só a primeira vez é longa', () => {
    const w = makeWorld();
    let ended = 0;
    w.hooks.onBossIntroEnd = () => ended++;
    const ctl = enterBoss(w);
    for (let i = 0; i < 60; i++) w.update(1 / 60, ctl);
    expect(w.director.bossRef).toBeNull();
    w.director.skipBossIntro();
    expect(ended).toBe(1);
    expect(w.director.longIntroActive()).toBe(false);
    expect(w.director.bossIntroDone).toBe(true);
    const b = w.director.bossRef as Felipao;
    expect(b.state).toBe('idle');
    expect(w.player.lockInput).toBe(false);
    // volta ao checkpoint e entra de novo: entrada curta
    w.respawn();
    enterBoss(w);
    expect(w.director.longIntroActive()).toBe(false);
  });
});

describe('Voz do Karimbo ao encontrar o Nômad', () => {
  it('toca na apresentação da garagem e no pouso do Nômad de apoio (não ao remontar)', () => {
    const w = makeWorld();
    const voices: string[] = [];
    w.voice = ((n: string) => {
      voices.push(n);
      return { elapsed: () => -1, playing: false, stop() {}, pause() {}, resume() {}, setVol() {} };
    }) as World['voice'];
    teleport(w, M(534), 32);
    const bot = new Bot(w, { walk: true });
    const ctl = newCtl();
    run(w, bot, ctl, 14, () => w.director.nomadMountable);
    expect(voices).toEqual(['karimboNomad']);
    // remontar no checkpoint não fala
    w.director.remountAtCheckpoint(200);
    expect(voices.length).toBe(1);
    // Nômad de apoio
    const w2 = makeWorld();
    const v2: string[] = [];
    w2.voice = ((n: string) => {
      v2.push(n);
      return { elapsed: () => -1, playing: false, stop() {}, pause() {}, resume() {}, setVol() {} };
    }) as World['voice'];
    teleport(w2, M(200), 32);
    w2.nomadLost = true;
    w2.director.supportClock = 89.5;
    for (let i = 0; i < 60 * 4 && !w2.director.support?.ready; i++) w2.update(1 / 60, newCtl());
    expect(w2.director.support?.ready).toBe(true);
    expect(v2).toEqual(['karimboNomad']);
  });
});

describe('HQ do chefe: vozes em sequência', () => {
  it('a voz do Karimbo só começa quando o áudio do chefe acaba (nunca as duas juntas)', async () => {
    const { BossComic } = await import('../src/game/comic');
    const { INTRO_VOICE_AT } = await import('../src/game/bossIntro');
    const c = new BossComic(INTRO_COMIC_LEN, INTRO_VOICE_AT);
    const beats = (c as unknown as { beats: Set<string> }).beats;
    let voiceAt = -1;
    let real = 0;
    while (!c.done && real < 30) {
      c.update(1 / 60);
      real += 1 / 60;
      if (voiceAt < 0 && beats.has('voice')) voiceAt = real;
    }
    // o áudio do chefe dura até INTRO_LEN; a HQ começa em INTRO_COMIC
    expect(voiceAt).toBeGreaterThanOrEqual(INTRO_VOICE_AT - 1 / 60);
    expect(voiceAt).toBeLessThan(INTRO_VOICE_AT + 0.05);
    // e a HQ só termina depois da voz inteira
    expect(real).toBeGreaterThanOrEqual(INTRO_VOICE_AT + KARIMBO_VOICE_LEN);
    expect(real).toBeCloseTo(INTRO_COMIC_LEN, 1);
  });
});
