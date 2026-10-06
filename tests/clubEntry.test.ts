import { describe, expect, it } from 'vitest';
import { makeWorld, newCtl } from './helpers/bot';
import { NARR_LEN } from '../src/game/narrator';

function setup(enabled = true) {
  const w = makeWorld(), ctl = newCtl();
  w.enemies = []; w.narrator.enabled = enabled;
  for (const t of w.data.triggers) w.director.triggered.add(t.id);
  const r = w.club.room!;
  const door = w.data.doors.find(d => d.kind === 'in' && d.tx >= r.x && d.tx <= r.x + r.w)!;
  w.player.reset(door.x, door.y); w.player.body.onGround = true;
  return { w, ctl, door };
}
describe('Entrada da balada sem sobreposição de áudio', () => {
  it('espera carregamento e fim real do áudio, então entra sem apertar novamente', () => {
    const { w, ctl, door } = setup();
    let ready = false, playing = true;
    w.hooks.narrReady = () => ready;
    w.hooks.narrPlaying = () => playing;
    ctl.moveY = 1; w.update(1 / 60, ctl); ctl.moveY = 0;
    for (let i = 0; i < 120; i++) w.update(1 / 60, ctl);
    expect(w.narrator.pending(8)).toBe(true); expect(w.doorT).toBe(-1);
    expect(w.player.x).toBeCloseTo(door.x); expect(w.club.active).toBe(false);
    ready = true;
    for (let i = 0; i < 60 * (NARR_LEN[8] + 2); i++) w.update(1 / 60, ctl);
    expect(w.narrator.cur).toBe(8); expect(w.doorT).toBe(-1);
    expect(w.musicState).not.toBe('rave'); expect(w.club.inside(w)).toBe(false);
    playing = false;
    for (let i = 0; i < 120; i++) w.update(1 / 60, ctl);
    expect(w.club.inside(w)).toBe(true); expect(w.club.active).toBe(true);
    expect(w.narrator.log.filter(n => n.id === 8)).toHaveLength(1);
    expect(w.narrator.busy()).toBe(false); expect(w.musicState).toBe('rave');
  });
  it('entra diretamente com narrador desligado', () => {
    const { w, ctl } = setup(false); ctl.moveY = 1;
    for (let i = 0; i < 60; i++) w.update(1 / 60, ctl);
    expect(w.club.inside(w)).toBe(true); expect(w.narrator.pending(8)).toBe(false);
  });
  it('sair da porta cancela a entrada pendente sem travar o controle', () => {
    const { w, ctl } = setup(); w.hooks.narrReady = () => false;
    ctl.moveY = 1; w.update(1 / 60, ctl); ctl.moveY = 0;
    ctl.moveX = -1;
    for (let i = 0; i < 120; i++) w.update(1 / 60, ctl);
    expect(w.club.inside(w)).toBe(false); expect(w.doorT).toBe(-1);
    expect(w.player.lockInput).toBe(false); expect(w.narrator.pending(8)).toBe(false);
  });
});
