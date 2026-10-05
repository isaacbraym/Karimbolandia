import { ChaseMatch } from '../../src/game/minigames/chase/sim/match';
import type { RunInput } from '../../src/game/minigames/chase/sim/runner';

export interface BotProfile {
  /** chance de ignorar uma dica (jogador distraído) */
  skip: number;
  /** atraso médio em px (positivo = tarde) e desvio */
  late: number;
  jitter: number;
  seed: number;
}
export const PERFECT: BotProfile = { skip: 0, late: 0, jitter: 0, seed: 1 };
export const SLOPPY: BotProfile = { skip: 0.25, late: 20, jitter: 30, seed: 1 };
export const AWFUL: BotProfile = { skip: 0.5, late: 40, jitter: 50, seed: 1 };

function mulberry(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Roda a perseguição inteira com um bot que segue as dicas do percurso. Devolve a partida. */
export function runBot(profile: BotProfile, maxT = 150, onStep?: (m: ChaseMatch) => void): ChaseMatch {
  const m = new ChaseMatch();
  const rnd = mulberry(profile.seed);
  const hints = m.course.hints
    .map((h) => ({ ...h, at: h.x + profile.late + (rnd() * 2 - 1) * profile.jitter, skip: rnd() < profile.skip, done: false }))
    .sort((a, b) => a.at - b.at);
  let holdT = 0, downT = 0, pressNext = false, lastX = 0;
  const seen = new Map<object, { skip: boolean; off: number; done: boolean }>();
  const dt = 1 / 60;
  while (!m.over && m.time < maxT) {
    if (m.runner.x < lastX - 150) { seen.clear(); for (const h of hints) { h.done = h.at <= m.runner.x; h.skip = rnd() < profile.skip * 0.6; } }
    lastX = m.runner.x;
    for (const h of hints) {
      if (h.done || m.runner.x < h.at) continue;
      h.done = true;
      if (h.skip || m.runner.x > h.at + 70) continue;
      if (h.act === 'hold') { holdT = h.dur ?? 0.5; pressNext = true; }
      else if (h.act === 'slide') downT = 0.12;
      else if (h.act === 'release') pressNext = true;
      else if (h.act === 'glide') { holdT = h.dur ?? 1; pressNext = true; }
      else if (h.act === 'jump') { holdT = 0.1; pressNext = true; }
    }
    // ameaças que se mexem: o jogador reage quando elas chegam perto (com atraso e distração conforme o perfil)
    if (m.runner.body.onGround) {
      const x = m.runner.x;
      const react = (key: object, d: number, trig: number, act: 'jump' | 'slide') => {
        let r = seen.get(key);
        if (!r) { r = { skip: rnd() < profile.skip, off: profile.late + (rnd() * 2 - 1) * profile.jitter, done: false }; seen.set(key, r); }
        if (r.done || d > trig - r.off || d < -20) return;
        r.done = true;
        if (r.skip) return;
        if (act === 'jump') { holdT = 0.5; pressNext = true; } else downT = 0.12;
      };
      for (const o of m.thrown) if (o.alive && o.kind === 'coconut') react(o, o.x - x, 200, 'jump');
      for (const h of m.hazards) {
        if (h.kind === 'coati' && h.on) { const lead = h.coatis!.find((c) => c.alive && c.x > x - 40); if (lead) react(h, lead.x - x, 100, 'jump'); }
        if (h.kind === 'toucan' && h.on) react(h, h.px - x, 150, 'slide');
      }
    }
    const inp: RunInput = { moveX: 0, down: downT > 0, jump: { held: holdT > 0, pressed: pressNext } };
    pressNext = false;
    holdT -= dt;
    downT -= dt;
    m.step(dt, inp);
    onStep?.(m);
  }
  return m;
}
