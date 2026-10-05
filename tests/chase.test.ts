import { describe, expect, it } from 'vitest';
import { runBot, PERFECT, SLOPPY, AWFUL } from './helpers/chaseBot';
import { ChaseMatch, MIN_CATCH_T, RESCUE_T, FAR_GAP, MONKEY_V } from '../src/game/minigames/chase/sim/match';
import { CHASE_RUN, PERFECT_BOOST } from '../src/game/minigames/chase/sim/runner';
import { RUN } from '../src/game/movement';
import type { RunInput } from '../src/game/minigames/chase/sim/runner';

const IDLE: RunInput = { moveX: 0, down: false, jump: { held: false, pressed: false } };

describe('perseguição: ritmo dos bots', () => {
  it('jogador perfeito alcança o macaco entre 48 e 56 s, sem cair nem tropeçar', () => {
    const m = runBot(PERFECT);
    expect(m.result?.outcome, `tempo ${m.time.toFixed(1)} quedas ${m.falls} tropeços ${m.stumbles}`).toBe('win');
    expect(m.result!.time).toBeGreaterThanOrEqual(MIN_CATCH_T);
    expect(m.result!.time).toBeLessThanOrEqual(56);
    expect(m.falls + m.stumbles).toBe(0);
  });
  it('jogador comum fica entre 58 e 74 s', () => {
    const m = runBot(SLOPPY);
    expect(m.result?.outcome, `tempo ${m.time.toFixed(1)}`).toBe('win');
    expect(m.result!.time).toBeGreaterThanOrEqual(58);
    expect(m.result!.time).toBeLessThanOrEqual(74);
  });
  it('jogador péssimo, com qualquer sorte, ainda vence em até 92 s', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const m = runBot({ ...AWFUL, seed }, 200);
      expect(m.result?.outcome, `semente ${seed}: ${m.time.toFixed(1)} s`).toBe('win');
      expect(m.result!.time, `semente ${seed}`).toBeLessThanOrEqual(92);
    }
  });
  it('é determinística: o mesmo bot dá o mesmo tempo', () => {
    expect(runBot(SLOPPY).result!.time).toBe(runBot(SLOPPY).result!.time);
  });
});

describe('perseguição: regras', () => {
  it('o Karimbo corre no máximo 22% acima do jogo base (+15% no pouso perfeito) e nunca perde energia', () => {
    expect(CHASE_RUN).toBeCloseTo(RUN * 1.22, 5);
    const m = new ChaseMatch();
    let vmax = 0;
    for (let i = 0; i < 60 * 8; i++) { m.step(1 / 60, IDLE); vmax = Math.max(vmax, Math.abs(m.runner.body.vx)); }
    expect(vmax).toBeLessThanOrEqual(CHASE_RUN + 1);
    expect(vmax).toBeLessThanOrEqual(RUN * 1.22 * PERFECT_BOOST + 1);
    expect(Object.keys(m.runner).some((k) => /hp|health|energy|ammo|weapon/i.test(k))).toBe(false);
  });
  it('antes de MIN_CATCH_T o macaco escapa com um salto; depois é pego', () => {
    const m = new ChaseMatch();
    m.runner.body.x = m.monkey.x - 20;
    m.step(1 / 60, IDLE);
    expect(m.monkey.mode).not.toBe('caught');
    expect(m.events.some((e) => e.type === 'quase')).toBe(true);
    const n = new ChaseMatch();
    n.time = MIN_CATCH_T + 1;
    n.runner.body.x = n.monkey.x - 20;
    n.step(1 / 60, IDLE);
    expect(n.monkey.mode).toBe('caught');
  });
  it('se o Karimbo fica muito para trás o macaco provoca e espera', () => {
    const m = new ChaseMatch();
    m.monkey.x = m.runner.x + FAR_GAP + 50;
    m.step(1 / 60, IDLE);
    expect(m.monkey.mode).toBe('taunt');
    const x = m.monkey.x;
    m.step(1 / 60, IDLE);
    expect(m.monkey.x).toBe(x);
  });
  it('depois de RESCUE_T o macaco escorrega e volta, então a perseguição sempre acaba', () => {
    const m = new ChaseMatch();
    m.time = RESCUE_T;
    m.step(1 / 60, IDLE);
    expect(m.monkey.mode).toBe('slip');
    const x = m.monkey.x;
    for (let i = 0; i < 30; i++) m.step(1 / 60, IDLE);
    expect(m.monkey.x).toBeLessThan(x);
    expect(MONKEY_V).toBeLessThan(CHASE_RUN);
  });
  it('galhos que tremem: quem frea cai; quem corre atravessa', () => {
    const sh = new ChaseMatch().course.shaky[0];
    const walk = (brake: boolean) => {
      const m = new ChaseMatch();
      m.runner.place((sh.x0 + 1) * 32, sh.row * 32);
      m.runner.lastSafe = { x: m.runner.x, y: sh.row * 32 };
      for (let i = 0; i < 60 * 4; i++) {
        m.step(1 / 60, { ...IDLE, moveX: brake && m.runner.x > sh.x0 * 32 ? -1 : 0 });
        if (m.falls || m.runner.x > sh.x1 * 32 + 8) break;
      }
      return { falls: m.falls, x: m.runner.x };
    };
    expect(walk(false).falls).toBe(0);
    expect(walk(true).falls).toBeGreaterThan(0);
  });
  it('o percurso é sempre o mesmo (autorado) e termina numa clareira', () => {
    const a = new ChaseMatch().course, b = new ChaseMatch().course;
    expect(a.length).toBe(b.length);
    expect(a.hints.length).toBe(b.hints.length);
    expect(a.endX).toBeGreaterThan(a.spawn.x + 10000);
    expect(a.endX).toBeLessThan(a.spawn.x + 15000);
  });
});
