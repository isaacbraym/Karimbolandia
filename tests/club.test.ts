import { describe, expect, it } from 'vitest';
import { buildLevel } from '../src/game/level/index';
import { analyzeReach } from '../src/game/level/reach';
import { TILE } from '../src/game/level';
import { CLUB_DANCE_ID, CLUB_T, SIV_CONTACT_DISTANCE } from '../src/game/club';
import { makeWorld, newCtl } from './helpers/bot';
import { BASE_ZOOM } from '../src/game/camera';

const data = buildLevel();
const room = data.secretRooms.find((s) => s.id === 'club')!.rect;
const exit = data.doors.find((d) => d.kind === 'out' && d.x >= room.x && d.x <= room.x + room.w)!;

describe('Balada da fase 1', () => {
  it('o prédio atravessa a calçada: sem entrar na balada não se passa', () => {
    const ex = Math.floor(exit.tx / TILE);
    const ey = Math.round(exit.ty / TILE);
    const withDoors = analyzeReach(data);
    expect(withDoors.reached.has(withDoors.key(ex, ey))).toBe(true);
    const noDoors = analyzeReach({ ...data, doors: [] });
    expect(noDoors.reached.has(noDoors.key(ex, ey))).toBe(false);
    // a porta da frente tem seguranças/fachada: é uma porta de entrada antes do paredão
    const fronts = data.doors.filter((d) => d.kind === 'in' && d.tx >= room.x && d.tx <= room.x + room.w);
    expect(fronts.length).toBeGreaterThanOrEqual(2);
  }, 60000);

  it('a cena não pode ser cortada, mostra a dança e o Sivirino e devolve o controle', () => {
    const w = makeWorld();
    w.enemies = [];
    const ctl = newCtl();
    w.player.reset(room.x + 3 * TILE + 16, room.y + room.h);
    w.cameraSnap();
    let danced = false;
    let sivirino = false;
    let rave = false;
    let lockedX = true;
    for (let f = 0; f < 60 * (CLUB_T.max + 3) && !w.encounters.completed.has(CLUB_DANCE_ID); f++) {
      // o jogador tenta fugir, pular e atirar: nada disso pode interromper a cena
      ctl.moveX = -1;
      ctl.jump.pressed = ctl.jump.held = f % 20 === 0;
      ctl.fire.held = true;
      const before = w.player.x;
      w.update(1 / 60, ctl);
      if (w.club.active && w.club.t > CLUB_T.walk + 1.6 && Math.abs(w.player.x - before) > 3) lockedX = false;
      if (w.player.danceT >= 0) danced = true;
      if (Number.isFinite(w.club.sivX)) sivirino = true;
      if (w.musicState === 'rave') rave = true;
    }
    expect(danced).toBe(true);
    expect(sivirino).toBe(true);
    expect(rave).toBe(true);
    expect(lockedX).toBe(true);
    expect(w.encounters.completed.has(CLUB_DANCE_ID)).toBe(true);
    expect(w.club.active).toBe(false);
    expect(w.player.danceT).toBe(-1);
    // controle volta: andar para a direita move o Karimbo
    const x = w.player.x;
    ctl.moveX = 1;
    ctl.fire.held = false;
    for (let f = 0; f < 40; f++) w.update(1 / 60, ctl);
    expect(w.player.x).toBeGreaterThan(x + 20);
    // morreu/voltou ao checkpoint: a cena já vista não se repete
    w.club.reset(w);
    w.player.reset(room.x + 3 * TILE + 16, room.y + room.h);
    for (let f = 0; f < 30; f++) w.update(1 / 60, newCtl());
    expect(w.club.active).toBe(false);
  }, 30000);

  it('a dança antes da chegada do Sivirino é longa (7,7 s) e o áudio balada está registrado', async () => {
    const { CLIP_FILES } = await import('../src/core/audio');
    expect(CLIP_FILES.balada).toBe('balada.mp3');

    // O Karimbo dança de 1,3 s até a entrada do Sivirino (9 s); ele atravessa a pista em 4,4 s e só então o Karimbo se vira.
    expect(CLUB_T.sivirino).toBe(9.0);
    expect(CLUB_T.dance).toBe(1.3);
    expect(CLUB_T.sivirino - CLUB_T.dance).toBeCloseTo(7.7, 1);
    expect(CLUB_T.turn).toBeGreaterThan(CLUB_T.sivirino + CLUB_T.sivWalk);

    const w = makeWorld();
    w.enemies = [];
    w.player.reset(room.x + 3 * TILE + 16, room.y + room.h);
    w.cameraSnap();

    // Avança a simulação até t = 6.0s (quando no modelo antigo o Sivirino já estaria em cena há 1.4s)
    const ctl = newCtl();
    const framesTo6s = Math.round(60 * 6.0);
    for (let f = 0; f < framesTo6s; f++) {
      w.update(1 / 60, ctl);
    }
    // Karimbo já está dançando
    expect(w.player.danceT).toBeGreaterThan(0);
    // Mas o Sivirino ainda NÃO chegou (só a partir de 9 s)
    expect(Number.isFinite(w.club.sivX)).toBe(false);

    // Avança mais 4 segundos (t = 10.0s > 9.0s)
    const framesTo10s = Math.round(60 * 4.0);
    for (let f = 0; f < framesTo10s; f++) {
      w.update(1 / 60, ctl);
    }
    // Agora sim o Sivirino chegou
    expect(Number.isFinite(w.club.sivX)).toBe(true);
  });

  it('câmera do filminho: aproxima do Karimbo, acompanha o Sivirino pela pista até o Karimbo e fecha nos dois na virada', () => {
    const w = makeWorld();
    w.enemies = [];
    const ctl = newCtl();
    w.camera.viewW = 640; // tela de computador (a escala do filminho depende da largura visível)
    w.player.reset(room.x + 3 * TILE + 16, room.y + room.h);
    w.cameraSnap();
    const at = (sec: number) => { while (w.club.t < sec && (w.club.active || w.club.t < 0)) w.update(1 / 60, ctl); return { z: w.camera.zoomTarget, f: w.camera.focus ? { ...w.camera.focus } : null, sx: w.club.sivX }; };
    const open = BASE_ZOOM;
    const dance = at(CLUB_T.dance + 1.5);
    expect(dance.z).toBeGreaterThan(open * 1.12); // zoom no Karimbo
    expect(Math.abs(dance.f!.x - w.player.x)).toBeLessThan(40); // e é nele que a câmera fica
    // o Sivirino entra pela esquerda e atravessa a pista: o foco anda junto com ele
    const early = at(CLUB_T.sivirino + 1.2);
    const mid = at(CLUB_T.sivirino + CLUB_T.sivWalk / 2);
    const late = at(CLUB_T.sivirino + CLUB_T.sivWalk);
    expect(mid.sx).toBeGreaterThan(early.sx);
    expect(late.sx).toBeGreaterThan(mid.sx);
    expect(mid.f!.x).toBeGreaterThan(early.f!.x);
    expect(late.sx).toBeCloseTo(w.player.x - SIV_CONTACT_DISTANCE, 0);
    // a virada: plano mais fechado ainda e nos dois
    const turn = at(CLUB_T.turn + 0.5);
    expect(turn.z).toBeGreaterThanOrEqual(late.z);
    expect(Math.abs(turn.f!.x - w.player.x)).toBeLessThan(40);
    expect(w.player.facing).toBe(-1);
  }, 30000);

  it('alguns da pista (um em cada cinco, não todos) andam dançando e param nas pontas; o bar fica no fundo', () => {
    const w = makeWorld();
    const crowd = w.club.crowd;
    const walkers = crowd.filter((d) => d.walk);
    expect(walkers.length).toBe(13);
    expect(walkers.length).toBeLessThan(crowd.length * 0.3);
    const start = walkers.map((d) => d.x);
    const ctl = newCtl();
    w.enemies = [];
    for (let f = 0; f < 60 * 30; f++) w.update(1 / 60, ctl);
    let moved = 0;
    for (const [i, d] of walkers.entries()) {
      if (Math.abs(d.x - start[i]) > 20) moved++;
      expect(d.x).toBeGreaterThanOrEqual(d.walk!.min - 1e-6);
      expect(d.x).toBeLessThanOrEqual(d.walk!.max + 1e-6);
      expect(d.facing).toBe(d.walk!.dir);
    }
    expect(moved).toBeGreaterThan(6);
    expect(crowd.filter((d) => !d.walk).length).toBe(52);
    const bar = w.club.bar!;
    expect(bar.x).toBeGreaterThan(room.x + 200);
    expect(bar.x).toBeLessThan(room.x + room.w - 200);
    // o bar cabe no enquadramento normal (a parede do fundo fica acima da tela) e é uma ilha: ninguém dança nem passa pelo balcão
    expect(bar.depth).toBeLessThanOrEqual(160);
    for (const d of crowd) {
      const inBand = d.depth > 100 && d.depth < 210;
      if (inBand) expect(Math.abs(d.x - bar.x), `pessoa em ${Math.round(d.x)}`).toBeGreaterThanOrEqual(170);
      if (d.walk && inBand) { expect(Math.abs(d.walk.min - bar.x) >= 170 || d.walk.min > bar.x).toBe(true); expect(Math.abs(d.walk.max - bar.x) >= 170 || d.walk.max < bar.x).toBe(true); }
    }
  }, 60000);
});
