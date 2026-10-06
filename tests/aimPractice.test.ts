import { describe, expect, it } from 'vitest';
import { AimPractice, AIM_ORIGIN } from '../src/ui/aimPractice';

describe('treino de mira isolado', () => {
  it('mira em qualquer direção, conserva a direção ao soltar e ignora a zona morta', () => {
    const m = new AimPractice();
    m.update(1 / 60, { x: 0, y: -1 }, false);
    expect(m.angle).toBeCloseTo(-Math.PI / 2);
    m.update(1 / 60, { x: .1, y: .1 }, false);
    m.update(1 / 60, null, false);
    expect(m.angle).toBeCloseTo(-Math.PI / 2);
  });
  it('só acerta quando a arma aponta para o alvo; três alturas diferentes podem ser praticadas', () => {
    const m = new AimPractice();
    m.update(.1, { x: -1, y: 0 }, true);
    expect(m.hits).toBe(0);
    for (let i = 0; i < 3; i++) {
      m.update(.1, null, false); m.update(.1, null, false);
      const target = m.target;
      m.update(1 / 60, { x: target.x - AIM_ORIGIN.x, y: target.y - AIM_ORIGIN.y }, true);
      expect(m.hits).toBe(i + 1);
    }
  });
  it('demonstração animada nunca conta como prática do jogador', () => {
    const m = new AimPractice(), target = m.target;
    for (let i = 0; i < 600; i++) m.update(1 / 60, { x: target.x - AIM_ORIGIN.x, y: target.y - AIM_ORIGIN.y }, true, true);
    expect(m.hits).toBe(0);
    expect(m.flash).toBeGreaterThanOrEqual(0);
  });
  it('segurar o disparo respeita a cadência e uma pausa longa não dispara uma rajada acumulada', () => {
    const m = new AimPractice(); let shots = 0;
    for (let i = 0; i < 60; i++) if (m.update(1 / 60, null, true)) shots++;
    expect(shots).toBeGreaterThanOrEqual(5); expect(shots).toBeLessThanOrEqual(6);
    expect(m.update(30, null, true)).toBe(false);
  });
});
