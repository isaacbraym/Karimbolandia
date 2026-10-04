import { describe, it, expect } from 'vitest';
import { World } from '../src/game/world';
import { buildJungle } from '../src/game/level/jungle';

type Priv = { houseResident(x: number): { home: number; role: string; spoke: boolean } | undefined; inside: boolean; mood: string };
const world = () => new World(buildJungle());

describe('a aldeia reage à visita ao interior', () => {
  it('a moradora da primeira casa é a mais próxima da porta e some do lado de fora enquanto está lá dentro', () => {
    const w = world();
    const house = w.exploration.spots.find((s) => s.interior === 'benedita')!;
    const v = w.village as unknown as Priv;
    const r = v.houseResident(house.x)!;
    expect(r.role).toBe('resident');
    expect(Math.abs(r.home - house.x)).toBeLessThan(160);
    // não pega moradores de outras casas
    const far = w.village.residents.filter((x) => x.role === 'resident' && Math.abs(x.home - house.x) > 400);
    expect(far.length).toBeGreaterThan(0);
    w.village.setInside(house.x, true);
    expect(v.inside).toBe(true);
    w.village.setInside(house.x, false);
    expect(v.inside).toBe(false);
  });

  it('o desfecho muda o humor (feliz, brava) só para a casa da Dona Benedita, e reiniciar limpa tudo', () => {
    const w = world();
    const house = w.exploration.spots.find((s) => s.interior === 'benedita')!;
    const v = w.village as unknown as Priv;
    w.village.afterInterior('palafita', 'door', house.x, 'angry');
    expect(v.mood).toBe('neutral');
    w.village.afterInterior('benedita', 'expelled', house.x, 'angry');
    expect(v.mood).toBe('angry');
    w.village.afterInterior('benedita', 'door', house.x, 'happy');
    expect(v.mood).toBe('happy');
    expect(v.inside).toBe(false);
    w.village.reset(w);
    expect(v.mood).toBe('neutral');
  });
});
