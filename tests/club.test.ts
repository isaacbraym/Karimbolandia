import { describe, expect, it } from 'vitest';
import { buildLevel } from '../src/game/level/index';
import { analyzeReach } from '../src/game/level/reach';
import { TILE } from '../src/game/level';
import { CLUB_DANCE_ID, CLUB_T } from '../src/game/club';
import { makeWorld, newCtl } from './helpers/bot';

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
});
