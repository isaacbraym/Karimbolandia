import { it } from 'vitest';
import { makeWorld, armUp, teleport, Bot, run, newCtl } from './helpers/bot';

it('dbg a1', () => {
  const w = makeWorld();
  armUp(w);
  teleport(w, 436, 32);
  const bot = new Bot(w, { hold: true });
  const ctl = newCtl();
  const a = w.director.arenas.find((x) => x.def.id === 'a1')!;
  for (let s = 0; s < 9; s++) {
    run(w, bot, ctl, 10);
    console.log('t', (s + 1) * 10, 'wave', a.wave, 'status', a.status, 'alive', a.alive.map((e: any) => `${e.type}@${Math.round(e.x / 32)},${Math.round(e.y / 32)}:${e.mode ?? ''}:${Math.round(e.hp)}`).join(' '), 'player', Math.round(w.player.x / 32), Math.round(w.player.y / 32));
  }
});
