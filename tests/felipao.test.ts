import { describe, expect, it } from 'vitest';
import { Felipao } from '../src/game/enemies/felipao';
import { makeWorld } from './helpers/bot';

function scene() {
  const w = makeWorld();
  const boss = new Felipao(w.data.enemies.find(e => e.type === 'boss')!);
  w.enemies = [boss];
  w.player.reset(boss.x - 320, boss.floorY - 24);
  boss.skipEnter();
  return { w, boss };
}

describe('Felipão: estratégias por barra', () => {
  it.each([
    [1, ['cannon', 'missiles', 'cannon', 'summon']],
    [2, ['dash', 'cannon', 'pound', 'dash']],
    [3, ['beam', 'pound', 'dash', 'beam', 'pound']],
  ] as const)('apresenta a sequência da barra %i em combate real', (phase, cycle) => {
    const { w, boss } = scene();
    boss.phase = phase;
    const attacks: string[] = [];
    for (let i = 0; i < 60 * 100 && attacks.length < cycle.length; i++) {
      const count = boss.atkCount;
      boss.update(w, 1 / 60);
      if (count !== boss.atkCount) attacks.push(boss.lastAtk);
      expect(Number.isFinite(boss.body.x)).toBe(true);
    }
    expect(attacks).toEqual(cycle);
  });

  it('um dano enorme respeita as três barras e reinicia a estratégia na transição', () => {
    const { w, boss } = scene();
    const hit = { type: 'explosion' as const, x: boss.x, y: boss.y, dir: 1, kx: 0, ky: 0 };
    boss.atkCount = 3;
    boss.hurt(w, 99999, hit);
    expect(boss.hp).toBe(2400);
    expect(boss.state).toBe('transition');
    expect(boss.hurt(w, 99999, hit)).toBe(0);
    for (let i = 0; i < 152; i++) boss.update(w, 1 / 60);
    expect(boss.phase).toBe(2);
    expect(boss.atkCount).toBe(0);
    boss.hurt(w, 99999, hit);
    expect(boss.hp).toBe(1200);
    for (let i = 0; i < 152; i++) boss.update(w, 1 / 60);
    expect(boss.phase).toBe(3);
    boss.hurt(w, 99999, hit);
    expect(boss.hp).toBe(0);
    expect(boss.alive).toBe(false);
  });

  it('anima passos no deslocamento sem transformar o spawn em um passo gigante', () => {
    const { w, boss } = scene();
    boss.introHold = true;
    boss.update(w, 1 / 60);
    expect(boss.walking).toBe(0);
    boss.introHold = false;
    w.player.body.x -= 600;
    for (let i = 0; i < 40; i++) boss.update(w, 1 / 60);
    expect(boss.walking).toBeGreaterThan(0.3);
    expect(boss.walkPhase).toBeGreaterThan(0);
  });
});
