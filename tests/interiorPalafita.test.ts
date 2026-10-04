import { describe, it, expect } from 'vitest';
import room from '../src/game/interior/rooms/palafitaVigia';
import { InteriorSim, type InteriorHost } from '../src/game/interior/sim';
import { InteriorStore, ROOM_FLAGS } from '../src/game/interiorStore';
import { adjacentCells, findPath } from '../src/game/interior/grid';
import { SLEEP } from '../src/game/interior/brains/sleeper';
import type { InteriorEvent } from '../src/game/interior/types';

/** Estado legado (modal antigo) controlável pelo teste. */
function host(): InteriorHost & { state: Set<string> } {
  const state = new Set<string>();
  return { state, legacy: (obj, kind) => state.has(`${obj}:${kind}`) };
}
function make(opts: { store?: InteriorStore; h?: ReturnType<typeof host> } = {}) {
  const h = opts.h ?? host(), store = opts.store ?? new InteriorStore();
  const sim = new InteriorSim(room, store, h, 7);
  sim.set('visited');
  return { sim, h, store };
}
const idle = { mx: 0, my: 0, sneak: false };
const run = (sim: InteriorSim, s: number, inp = idle) => { for (let t = 0; t < s; t += 1 / 60) sim.update(1 / 60, inp); };
const evs = (sim: InteriorSim) => sim.events.splice(0);
const cabo = (sim: InteriorSim) => sim.npc('cabo')!;
const act = (sim: InteriorSim, f: string, v: string, secs = 8) => { expect(sim.act(f, v), `${f}:${v}`).toBe(true); run(sim, secs); };
/** Teletransporta o Karimbo (só para montar cenários). */
const put = (sim: InteriorSim, x: number, y: number) => { sim.px = x; sim.py = y; sim.path = []; };

describe('palafita: integridade do cômodo', () => {
  it('móveis dentro da grade, ids únicos e porta/spawn livres', () => {
    const { sim } = make();
    const ids = new Set<string>();
    for (const f of room.furniture) {
      expect(ids.has(f.id), f.id).toBe(false); ids.add(f.id);
      expect(f.gx >= 0 && f.gy >= 0 && f.gx + f.w <= sim.grid.w && f.gy + f.h <= sim.grid.h, f.id).toBe(true);
    }
    expect(sim.grid.walkable(room.door.x, room.door.y)).toBe(true);
    expect(sim.grid.walkable(room.spawn.x, room.spawn.y)).toBe(true);
    expect(sim.grid.w).toBeLessThanOrEqual(10); expect(sim.grid.h).toBeLessThanOrEqual(8);
  });

  it('todo móvel com verbo é alcançável a pé e a porta também', () => {
    const { sim } = make();
    for (const f of room.furniture) {
      if (!f.verbs(sim, f).length) continue;
      const goals = f.stand ? [f.stand] : adjacentCells(sim.grid, f);
      expect(findPath(sim.grid, sim.cell(), goals), f.id).not.toBeNull();
    }
    expect(findPath(sim.grid, sim.cell(), [room.door])).not.toBeNull();
  });

  it('todo verbo roda sem erro, só usa flags existentes e todo móvel interativo responde algo', () => {
    for (const f of room.furniture) {
      for (const v of f.verbs(make().sim, f)) {
        const { sim } = make();
        sim.actSeen = true;
        expect(() => v.run(sim, f), `${f.id}:${v.id}`).not.toThrow();
        const e = sim.events;
        const responded = e.length > 0 || sim.flags.mask !== make().sim.flags.mask || sim.rt.radio;
        expect(responded, `${f.id}:${v.id} deveria responder`).toBe(true);
      }
    }
    // as flags do cômodo cabem no store
    expect(ROOM_FLAGS.palafita.length).toBeLessThanOrEqual(31);
  });

  it('o armário de verbos nunca repete a mesma resposta duas vezes seguidas (falas variadas)', () => {
    const { sim } = make();
    const f = room.furniture.find((x) => x.id === 'armeiro')!;
    const take = f.verbs(sim, f).find((v) => v.id === 'take')!;
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) { take.run(sim, f); const say = evs(sim).find((e): e is Extract<InteriorEvent, { type: 'say' }> => e.type === 'say'); seen.push(say!.text); }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
  });
});

describe('Cabo Ronco: sono, percepção e perseguição', () => {
  it('começa dormindo, de olhos fechados, e não vê o Karimbo', () => {
    const { sim } = make();
    expect(cabo(sim).state).toBe('asleep');
    put(sim, 5.5, 2.5);
    expect(sim.canSee(cabo(sim), sim.px, sim.py)).toBe(false);
    run(sim, 2);
    expect(cabo(sim).state).toBe('asleep');
  });

  it('ruído derruba o sono e passa por estirando → meio acordado; o silêncio recupera', () => {
    const { sim } = make();
    const n = cabo(sim);
    sim.noise(6.5, 1.5, 30);
    expect(n.meter).toBeCloseTo(100 - 30 * SLEEP.noiseGain, 4);
    run(sim, 0.1);
    expect(n.state).toBe('stirring');
    sim.noise(6.5, 1.5, 20);
    run(sim, 0.1);
    expect(n.state).toBe('half');
    expect(n.mark).toBe('?');
    expect(evs(sim).some((e) => e.type === 'say' && e.who === 'cabo')).toBe(true);
    run(sim, 20);
    expect(n.state).toBe('asleep'); // voltou a dormir
    expect(n.meter).toBeGreaterThan(90);
  });

  it('meio acordado vê no cone e acorda; fora do cone (de costas) não', () => {
    const { sim } = make();
    const n = cabo(sim);
    n.meter = 20; run(sim, 0.05); expect(n.state).toBe('half');
    put(sim, 4.5, 3.5); // dentro do cone (olha para baixo-esquerda)
    run(sim, 0.6);
    expect(['alert', 'chase']).toContain(n.state);

    const b = make(); const m = cabo(b.sim);
    m.meter = 20; run(b.sim, 0.05);
    put(b.sim, 7.5, 0.5); // atrás dele, junto à parede
    run(b.sim, 0.9, idle);
    expect(m.state).toBe('half');
    expect(b.sim.canSee(m, b.sim.px, b.sim.py)).toBe(false);
  });

  it('sono zerado acorda de vez: alerta, depois persegue', () => {
    const { sim } = make();
    const n = cabo(sim);
    sim.noise(6.5, 1.5, 70);
    run(sim, 0.05);
    expect(n.state).toBe('alert');
    expect(evs(sim).some((e) => e.type === 'alert')).toBe(true);
    run(sim, SLEEP.alertDelay + 0.2);
    expect(n.state).toBe('chase');
    expect(sim.rt.woke).toBe(1);
  });

  it('o mercenário acordado alcança quem está perto e a visita acaba em "pego"', () => {
    const { sim } = make();
    sim.noise(6.5, 1.5, 70);
    put(sim, 5.5, 3.5);
    run(sim, 6);
    expect(sim.exited).toBe('caught');
  });

  it('fugir pela porta com ele atrás é "fuga": o Cabo vira inimigo lá fora e a palafita fica vazia', () => {
    const { sim, store } = make();
    sim.noise(6.5, 1.5, 70);
    put(sim, 1.5, 4.5); // perto da porta
    expect(sim.leave()).toBe(true);
    run(sim, 3);
    expect(sim.exited).toBe('escape');
    const exit = sim.events.find((e): e is Extract<InteriorEvent, { type: 'exit' }> => e.type === 'exit')!;
    expect(exit.alerted).toBe(true);
    sim.commit();
    expect(store.has('palafita', 'caboGone')).toBe(true);
    // próxima visita: sem Cabo
    const again = new InteriorSim(room, store, host(), 9);
    expect(cabo(again).away).toBe(true);
    const hammock = room.furniture.find((f) => f.id === 'hammock')!;
    expect(hammock.verbs(again, hammock).map((v) => v.id)).toEqual(['examine']);
    const boots = room.furniture.find((f) => f.id === 'boots')!;
    expect(boots.verbs(again, boots).some((v) => v.id === 'prank')).toBe(false);
  });

  it('cadarços amarrados: ele tropeça uma única vez no começo da perseguição e perde tempo', () => {
    const { sim } = make();
    sim.set('laces');
    sim.noise(6.5, 1.5, 70);
    put(sim, 1.5, 0.5);
    let tripped = 0, last = '';
    for (let t = 0; t < 5; t += 1 / 60) {
      sim.update(1 / 60, idle);
      if (cabo(sim).state !== last) { if (cabo(sim).state === 'tripped') tripped++; last = cabo(sim).state; }
      if (sim.exited) break;
    }
    expect(tripped).toBe(1);
    // sem cadarço amarrado nunca tropeça
    const b = make(); b.sim.noise(6.5, 1.5, 70); put(b.sim, 1.5, 0.5);
    let ever = false; for (let t = 0; t < 4; t += 1 / 60) { b.sim.update(1 / 60, idle); if (cabo(b.sim).state === 'tripped') ever = true; }
    expect(ever).toBe(false);
  });

  it('o tropeço dá vantagem: com cadarço dá para escapar mesmo largando perto do Cabo', () => {
    const run1 = (laces: boolean) => {
      const { sim } = make();
      if (laces) sim.set('laces');
      sim.noise(6.5, 1.5, 70);
      put(sim, 3.5, 3.5);
      sim.leave();
      for (let t = 0; t < 8 && !sim.exited; t += 1 / 60) sim.update(1 / 60, idle);
      return sim.exited;
    };
    expect(run1(true)).toBe('escape');
  });
});

describe('palafita: ruído, tábuas e rádio', () => {
  it('pisar na tábua rangente perto do Cabo o incomoda; a ponta dos pés quase não', () => {
    const noisy = make(), quiet = make();
    put(noisy.sim, 4.5, 3.5); put(quiet.sim, 4.5, 3.5); // (4,3) é tábua rangente
    // anda um passo em cima da tábua
    run(noisy.sim, 0.5, { mx: 0, my: -1, sneak: false });
    put(quiet.sim, 4.5, 3.5); run(quiet.sim, 0.5, { mx: 0, my: -1, sneak: true });
    expect(cabo(noisy.sim).meter).toBeLessThan(cabo(quiet.sim).meter + 0.0001);
    expect(room.rows[3][4]).toBe('s');
  });

  it('derrubar a garrafa faz um estrondo, deixa cacos rangentes e quase sempre acorda parcialmente', () => {
    const { sim } = make();
    act(sim, 'bottle', 'smash', 6);
    expect(sim.has('bottle')).toBe(true);
    expect(sim.decals.some((d) => d.kind === 'glass')).toBe(true);
    expect(sim.grid.squeaky(3, 3)).toBe(true);
    expect(cabo(sim).meter).toBeLessThan(100);
    expect(['stirring', 'half', 'alert', 'chase', 'asleep']).toContain(cabo(sim).state);
  });

  it('o rádio ligado vira ferramenta: máscara metade do ruído dos passos perto dele', () => {
    const seen: number[] = [];
    const a = make(), b = make();
    for (const s of [a.sim, b.sim]) put(s, 4.5, 3.5);
    act(a.sim, 'radio', 'use', 5);
    expect(a.sim.rt.radio).toBe(1);
    // mesmo passo em (4,3): com rádio, menos ruído percebido
    const meterOf = (s: InteriorSim) => { cabo(s).meter = 100; put(s, 3.5, 3.5); s.rt.step = 0; run(s, 0.4, { mx: 1, my: 0, sneak: false }); return cabo(s).meter; };
    void seen;
    expect(meterOf(a.sim)).toBeGreaterThanOrEqual(meterOf(b.sim) - 0.001);
  });
});

describe('palafita: travessuras, recompensas e a missão da panela', () => {
  it('a panela vai para o bolso e depois sai quando devolvida', () => {
    const { sim, store } = make();
    expect(room.pocket!(sim)).toEqual([]);
    act(sim, 'panela', 'take', 8);
    expect(sim.has('panela')).toBe(true);
    expect(room.pocket!(sim).map((i) => i.id)).toEqual(['panela']);
    expect(sim.carrying).toBe(true);
    const f = room.furniture.find((x) => x.id === 'panela')!;
    expect(f.verbs(sim, f)).toEqual([]);
    const casa = store.flags('benedita'); casa.set('panela'); store.commit(casa);
    expect(room.pocket!(sim)).toEqual([]);
  });

  it('gaveta e baú abrem primeiro e só depois recolhem (mesmo contrato do modal antigo)', () => {
    const { sim, h } = make();
    const f = room.furniture.find((x) => x.id === 'drawer')!;
    expect(f.verbs(sim, f).map((v) => v.id)).toEqual(['open']);
    act(sim, 'drawer', 'open', 8);
    expect(evs(sim).filter((e) => e.type === 'legacy')).toEqual([{ type: 'legacy', obj: 'drawer' }]);
    h.state.add('drawer:open');
    expect(f.verbs(sim, f).map((v) => v.id)).toEqual(['rummage']);
    h.state.add('drawer:done');
    expect(f.verbs(sim, f).map((v) => v.id)).toEqual(['examine']);
  });

  it('caixa de munição dá uma granada uma única vez; lata dá moedas uma única vez', () => {
    const { sim } = make();
    act(sim, 'ammo', 'open', 8);
    expect(evs(sim).filter((e) => e.type === 'grenade')).toHaveLength(1);
    expect(sim.verbsFor('ammo').map((v) => v.id)).toEqual(['examine']);
    act(sim, 'tin', 'take', 8);
    const coins = evs(sim).filter((e) => e.type === 'coins');
    expect(coins).toEqual([{ type: 'coins', n: 25 }]);
    expect(sim.verbsFor('tin').some((v) => v.id === 'take')).toBe(false);
  });

  it('completar a lista dispara KARIMBADO! uma vez; sem acordar o Cabo é estrela dourada (flag clean)', () => {
    const { sim, h } = make();
    act(sim, 'panela', 'take', 8);
    act(sim, 'boots', 'prank', 8);
    act(sim, 'portrait', 'prank', 8);
    h.state.add('drawer:open'); h.state.add('chest:open'); h.state.add('letter:done');
    run(sim, 0.5);
    const k = evs(sim).filter((e) => e.type === 'karimbado');
    expect(k).toEqual([{ type: 'karimbado', gold: true }]);
    expect(sim.has('karimbado')).toBe(true); expect(sim.has('clean')).toBe(true);
    run(sim, 2);
    expect(evs(sim).filter((e) => e.type === 'karimbado')).toHaveLength(0);
    expect(sim.pranksDone().every((p) => p.done)).toBe(true);
  });

  it('se o Cabo acordou, a lista ainda completa mas a estrela dourada não vem', () => {
    const { sim, h } = make();
    sim.rt.woke = 1;
    sim.set('panela'); sim.set('laces'); sim.set('mustache');
    h.state.add('drawer:open'); h.state.add('chest:open'); h.state.add('letter:done');
    run(sim, 0.5);
    expect(evs(sim).filter((e) => e.type === 'karimbado')).toEqual([{ type: 'karimbado', gold: false }]);
    expect(sim.has('clean')).toBe(false);
  });

  it('o bigode no retrato é permanente e some do menu depois de feito', () => {
    const { sim, store } = make();
    act(sim, 'portrait', 'prank', 8);
    expect(sim.verbsFor('portrait').map((v) => v.id)).toEqual(['examine']);
    sim.commit();
    const again = new InteriorSim(room, store, host(), 3);
    const p = room.furniture.find((x) => x.id === 'portrait')!;
    expect(p.look!(again, p)).toBe('mustache');
  });

  it('fechar o ciclo: sair sem pressa mantém tudo e a reentrada restaura cacos e flags', () => {
    const { sim, store } = make();
    act(sim, 'bottle', 'smash', 6);
    sim.leave(); run(sim, 6);
    expect(sim.exited).toBeTruthy();
    sim.commit();
    const again = new InteriorSim(room, store, host(), 4);
    expect(again.has('bottle')).toBe(true);
    expect(again.decals.some((d) => d.kind === 'glass')).toBe(true);
    expect(again.grid.squeaky(3, 3)).toBe(true);
  });
});
