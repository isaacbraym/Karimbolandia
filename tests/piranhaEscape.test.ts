import { afterEach, describe, expect, it, vi } from 'vitest';
import { World } from '../src/game/world';
import { buildJungle } from '../src/game/level/jungle';
import { Piranha, schoolFor } from '../src/game/enemies/piranha';

afterEach(() => vi.restoreAllMocks());
function scene() {
  const w = new World(buildJungle()); w.director.cine = null;
  const fish = w.enemies.find(e => e.type === 'piranha' && e.spawn.school === 101) as Piranha;
  w.enemies = [fish]; const sc = schoolFor(w, fish.spawn), p = w.player;
  p.reset(sc.hx + 350, sc.hy + 12); p.swimming = true; sc.aggro = true;
  vi.spyOn(w, 'audio').mockImplementation(() => {});
  // O tempo de espera inicial vence longe do alvo, sem forçar campos privados.
  for (let i = 0; i < 66; i++) { w.time += 1 / 60; fish.update(w, 1 / 60); }
  fish.body.x = sc.hx; fish.body.y = sc.hy; fish.body.vx = fish.body.vy = 0;
  p.reset(sc.hx, sc.hy + 12); p.swimming = true;
  return { w, fish, sc, p };
}
function step(w: World, fish: Piranha, dt = 1 / 60) { w.time += dt; fish.update(w, dt); }

describe('fuga dos cardumes', () => {
  it('não morde quem acabou de saltar para fora do lago, mesmo perto da superfície', () => {
    const { w, fish, sc, p } = scene(), top = w.water.lakeAt(sc.hx, sc.hy)!.y;
    fish.body.y = top + 6; p.reset(sc.hx, top - 6); p.swimming = false;
    const bite = vi.spyOn(p, 'nibble'), hp = p.hp;
    expect(w.water.lakeAt(fish.x, fish.y)).not.toBeNull();
    step(w, fish);
    expect(sc.aggro).toBe(true); expect(bite).not.toHaveBeenCalled();
    expect(p.hp).toBe(hp); expect(fish.biteT).toBe(0);
  });
  it.each(['nomad', 'dead'] as const)('não tenta morder um alvo no modo %s durante o alerta residual', mode => {
    const { w, fish, sc, p } = scene(); p.mode = mode;
    const bite = vi.spyOn(p, 'nibble').mockReturnValue(false);
    step(w, fish);
    expect(sc.aggro).toBe(true); expect(bite).not.toHaveBeenCalled(); expect(fish.biteT).toBe(0);
  });
  it('começa a voltar ao território imediatamente quando Karimbo sai da água', () => {
    const { w, fish, sc, p } = scene();
    fish.body.x = sc.hx + 250; fish.body.vx = fish.body.vy = 0;
    p.reset(fish.x + 100, fish.y + 12); p.swimming = false;
    step(w, fish);
    expect(sc.aggro).toBe(true); expect(fish.body.vx).toBeLessThan(0);
  });
  it('ainda ataca e causa dano em um mergulhador válido', () => {
    const { w, fish, p } = scene(), hp = p.hp;
    const bite = vi.spyOn(p, 'nibble'); step(w, fish);
    expect(bite).toHaveBeenCalledTimes(1); expect(p.hp).toBeLessThan(hp); expect(fish.biteT).toBeGreaterThan(0);
  });
  it('reentrar durante a memória do alerta permite nova mordida sem duplicar o aviso', () => {
    const { w, fish, sc, p } = scene(); p.swimming = false;
    const bite = vi.spyOn(p, 'nibble').mockReturnValue(false), banner = vi.fn(); w.hooks.onBanner = banner;
    for (let i = 0; i < 30; i++) step(w, fish);
    expect(sc.aggro).toBe(true); expect(bite).not.toHaveBeenCalled();
    fish.body.x = sc.hx; fish.body.y = sc.hy; fish.body.vx = fish.body.vy = 0;
    p.reset(sc.hx, sc.hy + 12); p.swimming = true; step(w, fish);
    expect(bite).toHaveBeenCalledTimes(1); expect(banner).not.toHaveBeenCalled();
  });
  it('o alerta termina depois da fuga e uma nova entrada avisa apenas uma vez por cardume', () => {
    const { w, fish, sc, p } = scene(); p.swimming = false;
    for (let i = 0; i < 100; i++) step(w, fish);
    expect(sc.aggro).toBe(false);
    const second = w.spawnEnemy({ ...fish.spawn, id: -987, x: sc.hx + 100, y: sc.hy }) as Piranha;
    const banner = vi.fn(); w.hooks.onBanner = banner;
    p.reset(sc.hx, sc.hy + 12); p.swimming = true;
    w.time += 1 / 60; fish.update(w, 1 / 60); second.update(w, 1 / 60);
    expect(sc.aggro).toBe(true); expect(banner).toHaveBeenCalledTimes(1);
  });
});
