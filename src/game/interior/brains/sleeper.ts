/**
 * Cérebro do mercenário dorminhoco (Cabo Ronco). Medidor de sono 0–100 que o ruído derruba e o
 * silêncio recupera. Estados: asleep → stirring → half → alert → chase (→ tripped).
 * Dormindo não vê; meio acordado vê em cone e acorda de vez se te enxergar.
 */
import type { InteriorSim } from '../sim';
import type { Brain, Npc, ExitReason } from '../types';

export const SLEEP = { recover: 4, noiseGain: 1.6, stirring: 60, half: 30, alertDelay: 0.8, chaseSpeed: 3.9, seeTime: 0.35, tripTime: 1.5 };

export interface SleeperLines { stirring: string[]; half: string[]; alert: string[]; tripped: string[]; caught: string[]; settle: string[] }

export function makeSleeper(lines: SleeperLines, opts: { tripAfter?: number; tripFlag?: string; goneFlag?: string } = {}): Brain {
  const tripAfter = opts.tripAfter ?? 0.9;
  const enter = (s: InteriorSim, n: Npc, state: string) => {
    n.state = state; n.t = 0;
    if (state === 'stirring') { n.mark = '...'; n.markT = 1.6; s.say(s.line('cabo:stir', lines.stirring), n.id, 2.6); s.fx('zzz', n.gx, n.gy, 1); }
    else if (state === 'half') { n.mark = '?'; n.markT = 2.2; s.say(s.line('cabo:half', lines.half), n.id, 2.4); n.data.seeT = 0; }
    else if (state === 'asleep') { n.mark = ''; if (n.data.settled) s.say(s.line('cabo:settle', lines.settle), n.id, 2); }
    else if (state === 'alert') {
      n.mark = '!'; n.markT = 5; s.rt.woke = 1;
      s.say(s.line('cabo:alert', lines.alert), n.id, 2.4);
      s.pop('!!!', n.gx, n.gy, '#ff5a5a'); s.shake(2.5, 0.25); s.sfx('whistle', 0.5);
      s.emit({ type: 'alert', npc: n.id });
    } else if (state === 'tripped') {
      n.mark = ''; n.data.tripped = 1;
      s.say(s.line('cabo:trip', lines.tripped), n.id, 2.2); s.pop('TÁÁ!', n.gx, n.gy, '#ffd24a'); s.shake(3, 0.3); s.fx('poof', n.gx, n.gy, 5); s.sfx('crush', 0.7);
    }
  };
  return {
    sees: (n) => n.state === 'half' || n.state === 'alert' || n.state === 'chase',
    hear(s, n, p, at) {
      if (n.state === 'alert' || n.state === 'chase' || n.state === 'tripped' || p < 1.5) return;
      n.meter = Math.max(0, n.meter - p * SLEEP.noiseGain);
      if (n.meter <= 0) { enter(s, n, 'alert'); return; }
      const vx = at.x + 0.5 - n.gx, vy = at.y + 0.5 - n.gy, d = Math.hypot(vx, vy);
      if (d > 0.01 && n.state !== 'asleep') { n.dx = vx / d; n.dy = vy / d; n.facing = vx - vy >= 0 ? 1 : -1; }
    },
    witness(s, n) {
      if (n.state === 'half') enter(s, n, 'alert');
    },
    update(s, n, dt) {
      switch (n.state) {
        case 'asleep': case 'stirring': case 'half': {
          n.meter = Math.min(100, n.meter + SLEEP.recover * dt);
          n.data.aware = (100 - n.meter) / 100;
          if (n.meter <= 0) { enter(s, n, 'alert'); break; }
          const want = n.meter >= SLEEP.stirring ? 'asleep' : n.meter >= SLEEP.half ? 'stirring' : 'half';
          // histerese: só volta a dormir quando já passou bem do limite
          if (want !== n.state && !(want === 'asleep' && n.meter < SLEEP.stirring + 8) && !(want === 'stirring' && n.state === 'half' && n.meter < SLEEP.half + 8)) {
            if (want === 'asleep') n.data.settled = 1;
            enter(s, n, want);
          }
          if (n.state === 'half') {
            if (s.canSee(n, s.px, s.py)) { n.data.seeT = (n.data.seeT ?? 0) + dt; if (n.data.seeT > SLEEP.seeTime) enter(s, n, 'alert'); }
            else n.data.seeT = 0;
          }
          if (n.state === 'asleep' && Math.sin(s.t * 2.4) > 0.98 && n.t > 0.5) { n.t = 0; s.fx('zzz', n.gx, n.gy, 1); }
          break;
        }
        case 'alert':
          n.data.aware = 1;
          if (n.t >= SLEEP.alertDelay) { n.state = 'chase'; n.t = 0; n.speed = SLEEP.chaseSpeed; n.data.repath = 0; n.markT = 0.01; }
          break;
        case 'chase': {
          n.data.aware = 1;
          n.data.repath = (n.data.repath ?? 0) - dt;
          if (n.data.repath <= 0) {
            n.data.repath = 0.3;
            const pc = s.cell();
            s.npcGoto(n, pc);
          }
          s.moveNpc(n, dt);
          if (Math.hypot(n.gx - s.px, n.gy - s.py) < 0.8) {
            s.say(s.line('cabo:caught', lines.caught), n.id, 1.6);
            s.emit({ type: 'hurt', dmg: 0 });
            s.exit('caught');
            break;
          }
          // cadarços amarrados: tropeça uma vez, logo no começo da perseguição
          if (opts.tripFlag && s.has(opts.tripFlag) && !n.data.tripped && n.t > tripAfter) enter(s, n, 'tripped');
          break;
        }
        case 'tripped':
          n.data.aware = 1;
          if (n.t >= SLEEP.tripTime) { n.state = 'chase'; n.t = 0; n.data.repath = 0; }
          break;
      }
    },
    onExit(s: InteriorSim, reason: ExitReason) {
      // quem foi atrás do Karimbo agora é um inimigo lá fora: a palafita fica vazia na próxima visita
      if (reason === 'escape' && opts.goneFlag) s.set(opts.goneFlag);
    },
  };
}
