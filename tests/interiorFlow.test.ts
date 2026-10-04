import { describe, it, expect, vi } from 'vitest';
import { World } from '../src/game/world';
import { buildJungle } from '../src/game/level/jungle';
import { InteriorFlow, type FlowHost } from '../src/game/interiorFlow';
import type { Outcome } from '../src/game/interior';

function setup() {
  const w = new World(buildJungle());
  const input = { clearEdges: vi.fn(), suppressHeldActions: vi.fn(), mouseActions: true } as unknown as FlowHost['input'];
  const host: FlowHost = {
    canvas: {} as HTMLCanvasElement, input, quality: () => 'medium', view: () => ({ W: 640, H: 360 }),
    touchMode: vi.fn(), saved: vi.fn(), banner: vi.fn(),
  };
  const flow = new InteriorFlow(host);
  const spot = w.exploration.spots.find((s) => s.interior === 'palafita')!;
  w.player.reset(spot.x, spot.y);
  const apply = (o: Partial<Outcome>) => (flow as unknown as { apply(w: World, o: Outcome): void }).apply(w, { reason: 'door', alerted: false, room: 'palafita', spot, mood: 'neutral', ...o });
  return { w, flow, spot, apply, host };
}

describe('consequências da saída do interior no mundo lateral', () => {
  it('fuga com o mercenário acordado: ele sai pela porta como inimigo alertado', () => {
    const { w, apply, spot } = setup();
    w.enemies.length = 0;
    apply({ reason: 'escape', alerted: true });
    expect(w.enemies).toHaveLength(1);
    const e = w.enemies[0];
    expect(e.type).toBe('rifle');
    expect(e.alive).toBe(true);
    expect(Math.abs(e.x - spot.x)).toBeLessThan(40);
  });

  it('sair pela porta normalmente não gera inimigo, dano nem tranca', () => {
    const { w, apply } = setup();
    w.enemies.length = 0; const hp = w.player.hp;
    apply({ reason: 'door' });
    expect(w.enemies).toHaveLength(0); expect(w.player.hp).toBe(hp); expect(w.interiorLock.size).toBe(0);
  });

  it('pego: dano moderado, nunca letal (vida mínima 1), Karimbo é arremessado para trás', () => {
    const { w, apply } = setup();
    const hp = w.player.hp;
    apply({ reason: 'caught' });
    expect(w.player.hp).toBeLessThan(hp); expect(w.player.hp).toBeGreaterThanOrEqual(1);
    expect(w.player.hurtT).toBeGreaterThan(0);
    expect(w.player.body.vy).toBeLessThan(0);
    // com vida baixa nunca mata
    w.player.hp = 2; apply({ reason: 'caught' });
    expect(w.player.hp).toBeGreaterThanOrEqual(1); expect(w.player.mode).not.toBe('dead');
    w.player.hp = 1; apply({ reason: 'caught' });
    expect(w.player.hp).toBe(1); expect(w.player.mode).not.toBe('dead');
  });

  it('expulso: a porta tranca até o próximo checkpoint e a casa reabre depois dele', () => {
    const { w, apply } = setup();
    const house = w.exploration.spots.find((s) => s.interior === 'benedita')!;
    apply({ reason: 'expelled', room: 'benedita', spot: house });
    expect(w.interiorLock.get('benedita')).toBe(w.checkpointIdx);
    expect(w.exploration.locked(w, house)).toBe(true);
    expect(w.exploration.safe(w, house)).toBe(false);
    w.checkpointIdx += 1;
    expect(w.exploration.locked(w, house)).toBe(false);
  });

  it('o humor final chega à vila (a moradora fala diferente lá fora)', () => {
    const { w, apply } = setup();
    const house = w.exploration.spots.find((s) => s.interior === 'benedita')!;
    apply({ reason: 'door', room: 'benedita', spot: house, mood: 'happy' });
    expect((w.village as unknown as { mood: string }).mood).toBe('happy');
  });

  it('o fluxo só entra em pontos com interior e não entra duas vezes', () => {
    const { w, flow } = setup();
    const cabin = w.exploration.spots.find((s) => s.cabin && !s.interior)!;
    expect(flow.tryEnter(w, cabin)).toBe(false);
    expect(flow.active).toBe(false);
    const spot = w.exploration.spots.find((s) => s.interior)!;
    expect(flow.tryEnter(w, spot)).toBe(true);
    expect(flow.active).toBe(true);
    expect(flow.tryEnter(w, spot)).toBe(false);
    flow.reset(w);
    expect(flow.active).toBe(false);
  });
});
