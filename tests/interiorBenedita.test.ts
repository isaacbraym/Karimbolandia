import { describe, it, expect } from 'vitest';
import room from '../src/game/interior/rooms/casaBenedita';
import palafita from '../src/game/interior/rooms/palafitaVigia';
import { InteriorSim } from '../src/game/interior/sim';
import { InteriorStore } from '../src/game/interiorStore';
import { adjacentCells, findPath } from '../src/game/interior/grid';
import { HOST } from '../src/game/interior/brains/host';
import type { InteriorEvent } from '../src/game/interior/types';

const idle = { mx: 0, my: 0, sneak: false };
const run = (sim: InteriorSim, s: number) => { for (let t = 0; t < s; t += 1 / 60) sim.update(1 / 60, idle); };
const ben = (sim: InteriorSim) => sim.npc('benedita')!;
const evs = (sim: InteriorSim) => sim.events.splice(0);
const put = (sim: InteriorSim, x: number, y: number) => { sim.px = x; sim.py = y; sim.path = []; };
function make(store = new InteriorStore(), seed = 11) {
  const sim = new InteriorSim(room, store, { legacy: () => false }, seed);
  sim.set('visited');
  return { sim, store };
}
/** Faz a Dona Benedita chegar e esperar que ela esteja na rotina. */
function arrive(sim: InteriorSim) { ben(sim).data.away = 0.01; run(sim, 0.3); }
const act = (sim: InteriorSim, f: string, v: string, secs = 6) => { expect(sim.act(f, v), `${f}:${v}`).toBe(true); run(sim, secs); };

describe('casa da Dona Benedita: integridade', () => {
  it('móveis na grade, ids únicos, tudo alcançável e porta livre', () => {
    const { sim } = make();
    const ids = new Set<string>();
    for (const f of room.furniture) {
      expect(ids.has(f.id), f.id).toBe(false); ids.add(f.id);
      expect(f.gx >= 0 && f.gy >= 0 && f.gx + f.w <= sim.grid.w && f.gy + f.h <= sim.grid.h, f.id).toBe(true);
      if (!f.verbs(sim, f).length) continue;
      const goals = f.stand ? [f.stand] : adjacentCells(sim.grid, f);
      expect(findPath(sim.grid, sim.cell(), goals), f.id).not.toBeNull();
    }
    expect(sim.grid.walkable(room.door.x, room.door.y)).toBe(true);
    for (const w of [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 3 }, { x: 4, y: 4 }, { x: 6, y: 3 }, { x: 2, y: 5 }]) expect(sim.grid.walkable(w.x, w.y)).toBe(true);
  });

  it('todo verbo roda sem erro e responde alguma coisa', () => {
    for (const f of room.furniture) {
      for (const v of f.verbs(make().sim, f)) {
        const { sim } = make();
        sim.actSeen = true;
        expect(() => v.run(sim, f), `${f.id}:${v.id}`).not.toThrow();
        const base = make().sim;
        expect(sim.events.length > 0 || sim.flags.mask !== base.flags.mask || sim.rt.catGone, `${f.id}:${v.id}`).toBeTruthy();
      }
    }
  });

  it('a primeira palafita e a primeira casa são as duas peças da missão da panela', () => {
    expect(palafita.id).toBe('palafita'); expect(room.id).toBe('benedita');
    const { sim } = make();
    expect(room.pocket!(sim)).toEqual([]);
  });
});

describe('Dona Benedita: ela volta da roça', () => {
  it('começa fora de casa, some do desenho e volta depois de um tempo (48–68 s) ou antes se ouvir barulho', () => {
    const { sim } = make();
    run(sim, 0.2);
    const n = ben(sim);
    expect(n.away).toBe(true);
    expect(n.data.away).toBeGreaterThanOrEqual(47); expect(n.data.away).toBeLessThanOrEqual(68.5);
    run(sim, 40); expect(n.away).toBe(true);
    run(sim, 30); expect(n.away).toBe(false);
    expect(['arriving', 'routine']).toContain(n.state);
    expect(evs(sim).some((e) => e.type === 'say' && e.who === 'benedita')).toBe(true);

    const b = make().sim; run(b, 0.2);
    const before = ben(b).data.away;
    b.noise(4, 4, 55); // estrondo dentro de casa: a porta tem "ouvido"
    expect(ben(b).data.away).toBeLessThan(before - 8);
  });

  it('o tempo da volta é determinístico por semente e varia entre sementes', () => {
    const a = make(new InteriorStore(), 1).sim, b = make(new InteriorStore(), 1).sim, c = make(new InteriorStore(), 99).sim;
    for (const s of [a, b, c]) run(s, 0.1);
    expect(ben(a).data.away).toBe(ben(b).data.away);
    expect(ben(a).data.away).not.toBe(ben(c).data.away);
  });

  it('o cochilo na rede acelera a volta', () => {
    const { sim } = make();
    run(sim, 0.2);
    act(sim, 'redeSala', 'lie', 1);
    expect(ben(sim).data.away).toBeLessThanOrEqual(5);
    expect(sim.has('nap')).toBe(true);
  });
});

describe('suspeita, descoberta e expulsão', () => {
  it('ação hostil vista por ela sobe a suspeita (com ×reputação) e vira "?" depois "!"', () => {
    const { sim } = make();
    arrive(sim);
    const n = ben(sim);
    n.meter = 0;
    // ela olha para o Karimbo, que derruba o filtro na frente dela
    put(sim, 2.5, 2.5); n.gx = 2.5; n.gy = 4.5; n.dx = 0; n.dy = -1; n.path = []; n.data.wait = 99;
    expect(sim.canSee(n, sim.px, sim.py)).toBe(true);
    const f = room.furniture.find((x) => x.id === 'filter')!;
    const v = f.verbs(sim, f).find((x) => x.id === 'smash')!;
    sim.actSeen = true; v.run(sim, f);
    n.brain.witness!(sim, n, { verb: v, f, seen: true });
    expect(n.meter).toBeCloseTo(70 * sim.repMult(), 4);
    run(sim, 0.2);
    expect(['annoyed', 'sweeping']).toContain(n.state);
  });

  it('a reputação multiplica o ganho: querido ×0,6, infame ×1,5', () => {
    const lo = make().sim, hi = make().sim;
    lo.rep = 100; hi.rep = -100;
    expect(lo.repMult()).toBeCloseTo(0.6, 5); expect(hi.repMult()).toBeCloseTo(1.5, 5);
  });

  it('o que ela não viu é descoberto depois, ao passar perto, com fala própria', () => {
    const { sim } = make();
    // come o feijão sem ninguém em casa
    act(sim, 'beans', 'eat', 6);
    expect(sim.traces.some((t) => t.fid === 'beans')).toBe(true);
    expect(ben(sim).meter).toBe(0);
    arrive(sim);
    const n = ben(sim);
    n.path = []; n.gx = 1.5; n.gy = 1.5; n.data.wait = 99; put(sim, 7.5, 5.5);
    run(sim, 0.5);
    expect(sim.traces.find((t) => t.fid === 'beans')!.discovered).toBe(true);
    expect(n.meter).toBeGreaterThan(10);
    expect(evs(sim).some((e) => e.type === 'say' && e.who === 'benedita' && /feij/i.test(e.text))).toBe(true);
  });

  it('chegar a 100 de suspeita ativa a vassoura: Karimbo é varrido até a porta e a visita termina como "expulso"', () => {
    const { sim, store } = make();
    arrive(sim);
    const n = ben(sim);
    put(sim, 4.5, 2.5);
    n.gx = 4.5; n.gy = 3.5; n.path = [];
    n.meter = 99; n.data.lvl = 2; n.state = 'annoyed';
    n.brain.witness!(sim, n, { verb: { id: 'smash', label: 'x', noise: 0, irritation: 20, run: () => {} }, f: room.furniture[0], seen: true });
    run(sim, 8);
    expect(sim.exited).toBe('expelled');
    expect(sim.rt.expelled).toBe(1);
    sim.commit();
    expect(room.mood!(sim)).toBe('angry');
    expect(store.rep).toBe(sim.rep);
  });

  it('o jogador não controla o Karimbo durante a expulsão (não dá para fugir da vassoura)', () => {
    const { sim } = make();
    put(sim, 6.5, 3.5);
    sim.forceOut();
    for (let t = 0; t < 4 && !sim.exited; t += 1 / 60) sim.update(1 / 60, { mx: 1, my: 1, sneak: true });
    expect(sim.exited).toBe('expelled');
  });

  it('comportado, a suspeita cai de volta e ela se acalma', () => {
    const { sim } = make();
    arrive(sim);
    const n = ben(sim);
    n.meter = 70; n.data.lvl = 2; n.state = 'annoyed'; n.data.lastBad = -99;
    put(sim, 2.5, 2.5); n.gx = 2.5; n.gy = 4.5; n.dx = 0; n.dy = -1; n.path = [];
    run(sim, 20);
    expect(n.meter).toBeLessThan(60);
    expect(n.state).not.toBe('annoyed');
  });

  it('ficar na zona privada (o quarto) irrita mais do que ficar na sala', () => {
    const a = make().sim, b = make().sim;
    for (const s of [a, b]) { arrive(s); const n = ben(s); n.meter = 0; n.path = []; n.data.wait = 99; n.data.met = 1; n.state = 'routine'; }
    put(a, 6.5, 2.5); put(b, 2.5, 2.5);
    ben(a).gx = 6.5; ben(a).gy = 4.5; ben(a).dx = 0; ben(a).dy = -1;
    ben(b).gx = 2.5; ben(b).gy = 4.5; ben(b).dx = 0; ben(b).dy = -1;
    run(a, 2); run(b, 2);
    expect(room.isPrivate!({ x: 6, y: 2 })).toBe(true); expect(room.isPrivate!({ x: 2, y: 2 })).toBe(false);
    expect(ben(a).meter).toBeGreaterThan(ben(b).meter);
  });

  it('presença passiva nunca expulsa sozinha: sem ação hostil a suspeita para antes do limite', () => {
    const { sim } = make();
    arrive(sim);
    const n = ben(sim);
    put(sim, 2.5, 2.5); n.gx = 2.5; n.gy = 4.5; n.dx = 0; n.dy = -1; n.path = []; n.data.wait = 99;
    run(sim, 60);
    expect(n.meter).toBeLessThanOrEqual(HOST.passive + 1);
    expect(sim.exited).toBeNull();
  });
});

describe('a panela e o prato de hóspede', () => {
  it('quem chega com a panela é recebido com festa: suspeita zera e aparece "Devolver a panela"', () => {
    const store = new InteriorStore();
    const f = store.flags('palafita'); f.set('panela'); store.commit(f);
    const { sim } = make(store);
    expect(sim.carrying).toBe(true);
    arrive(sim);
    const n = ben(sim);
    put(sim, 2.5, 2.5); n.gx = 2.5; n.gy = 4.5; n.dx = 0; n.dy = -1; n.path = []; n.data.wait = 99;
    run(sim, 0.5);
    expect(n.meter).toBe(0);
    const nf = sim.furnById.get('npc:benedita')!;
    expect(nf.verbs(sim, nf).map((v) => v.id)).toEqual(['give', 'examine']);
    expect(sim.verbsFor('npc:benedita').map((v) => v.id)).toContain('give');
  });

  it('devolver: flag, reputação +25, ela cozinha e serve um prato que cura; a panela some do bolso', () => {
    const store = new InteriorStore();
    const f = store.flags('palafita'); f.set('panela'); store.commit(f);
    const { sim } = make(store);
    arrive(sim);
    const n = ben(sim);
    put(sim, 2.5, 2.5); n.gx = 2.5; n.gy = 4.5; n.path = []; n.data.wait = 99;
    run(sim, 0.2);
    const rep0 = sim.rep;
    expect(sim.act('npc:benedita', 'give')).toBe(true);
    run(sim, 1.2);
    expect(sim.has('panela')).toBe(true);
    expect(sim.rep).toBe(rep0 + 25);
    expect(room.pocket!(sim)).toEqual([]);
    expect(['cooking', 'offering']).toContain(n.state);
    run(sim, 20);
    const heal = evs(sim).filter((e): e is Extract<InteriorEvent, { type: 'heal' }> => e.type === 'heal');
    expect(heal.some((h) => h.n === HOST.offerHeal)).toBe(true);
    expect(n.state).toBe('routine');
    sim.commit();
    expect(store.carriesPanela()).toBe(false);
    expect(room.mood!(sim)).toBe('happy');
  });

  it('sem a panela não existe "Devolver" e com ela devolvida o feijão cura mais', () => {
    const { sim } = make();
    arrive(sim);
    const nf = sim.furnById.get('npc:benedita')!;
    expect(nf.verbs(sim, nf).map((v) => v.id)).toEqual(['examine']);
    const beans = room.furniture.find((x) => x.id === 'beans')!;
    const eat = (s: InteriorSim) => { beans.verbs(s, beans).find((v) => v.id === 'eat')!.run(s, beans); return evs(s).find((e): e is Extract<InteriorEvent, { type: 'heal' }> => e.type === 'heal')!.n; };
    const normal = eat(make().sim);
    const host = make().sim; host.set('panela');
    expect(eat(host)).toBeGreaterThan(normal);
  });

  it('com a panela devolvida, comer o bolo não irrita', () => {
    const { sim } = make(); sim.set('panela');
    const cake = room.furniture.find((x) => x.id === 'cake')!;
    expect(cake.verbs(sim, cake).find((v) => v.id === 'eat')!.irritation).toBe(0);
    const plain = make().sim;
    expect(cake.verbs(plain, cake).find((v) => v.id === 'eat')!.irritation).toBe(10);
  });
});

describe('objetos da casa: consequências', () => {
  it('derrubar o filtro quebra, deixa poça e custa reputação; fica quebrado na próxima visita', () => {
    const { sim, store } = make();
    act(sim, 'filter', 'smash', 6);
    expect(sim.has('filter')).toBe(true);
    expect(sim.rep).toBe(-12);
    expect(sim.decals.some((d) => d.kind === 'puddle')).toBe(true);
    expect(sim.traces.some((t) => t.fid === 'filter' && t.irritation === 70)).toBe(true);
    sim.commit();
    const again = new InteriorSim(room, store, { legacy: () => false }, 5);
    expect(again.has('filter')).toBe(true);
    expect(again.decals.some((d) => d.kind === 'puddle')).toBe(true);
    expect(again.rep).toBe(-12);
  });

  it('o porquinho: roubar ou quebrar são escolhas morais excludentes que pagam em moedas e cobram em reputação', () => {
    const a = make().sim, b = make().sim;
    act(a, 'piggy', 'steal', 6); act(b, 'piggy', 'smash', 6);
    expect(evs(a).filter((e) => e.type === 'coins')).toEqual([{ type: 'coins', n: 60 }]);
    expect(evs(b).filter((e) => e.type === 'coins')).toEqual([{ type: 'coins', n: 90 }]);
    expect(a.rep).toBe(-20); expect(b.rep).toBe(-30);
    expect(a.verbsFor('piggy')).toEqual([]); expect(b.verbsFor('piggy')).toEqual([]);
  });

  it('o armário em duas etapas revela a lata de biscoito (cheia de costura) e conta como travessura', () => {
    const { sim } = make();
    expect(sim.verbsFor('cabinet').map((v) => v.id)).toEqual(['open', 'examine']);
    act(sim, 'cabinet', 'open', 5);
    expect(sim.verbsFor('cabinet').map((v) => v.id)).toEqual(['rummage']);
    act(sim, 'cabinet', 'rummage', 5);
    expect(sim.has('tin')).toBe(true);
    expect(evs(sim).some((e) => e.type === 'read' && /costura/i.test(e.text))).toBe(true);
  });

  it('tapa técnico na TV acalma e vira "mudar de canal"; regar OU gato completam a travessura "gentil"', () => {
    const { sim } = make();
    act(sim, 'tv', 'use', 5);
    expect(sim.has('tv')).toBe(true);
    expect(sim.verbsFor('tv').map((v) => v.id)).toEqual(['use']);
    expect(room.furniture.find((f) => f.id === 'tv')!.verbs(sim, room.furniture.find((f) => f.id === 'tv')!)[0].label).toBe('Mudar de canal');
    expect(sim.pranksDone().find((p) => p.id === 'kind')!.done).toBe(false);
    act(sim, 'plant', 'water', 5);
    expect(sim.pranksDone().find((p) => p.id === 'kind')!.done).toBe(true);
  });

  it('o gato derrubado libera a cadeira; o carinho agrada', () => {
    const { sim } = make();
    expect(sim.verbsFor('catChair')).toEqual([]);
    act(sim, 'cat', 'knock', 4);
    expect(sim.rt.catGone).toBe(1);
    expect(sim.verbsFor('cat')).toEqual([]);
    expect(sim.verbsFor('catChair').map((v) => v.id)).toEqual(['sit']);
    const b = make().sim; act(b, 'cat', 'pet', 4);
    expect(b.has('cat')).toBe(true); expect(b.rep).toBe(2);
  });

  it('deitar na cama dela é a pior ideia: suspeita enorme e rastro', () => {
    const { sim } = make();
    const f = room.furniture.find((x) => x.id === 'bed')!;
    const v = f.verbs(sim, f).find((x) => x.id === 'lie')!;
    expect(v.irritation).toBe(45);
    expect(sim.verbsFor('bed').find((x) => x.id === 'lie')!.hostile).toBe(true);
  });

  it('todo verbo com irritação positiva aparece em vermelho no menu', () => {
    const { sim } = make();
    for (const f of room.furniture) for (const v of f.verbs(sim, f)) {
      const view = sim.verbsFor(f.id).find((x) => x.id === v.id && x.label === v.label)!;
      expect(view.hostile, `${f.id}:${v.id}`).toBe(!!v.hostile || (v.irritation ?? 0) > 0);
    }
  });

  it('completar a lista: panela, TV, lata, gentileza e cochilo → KARIMBADO!; dourado se ninguém expulsou', () => {
    const store = new InteriorStore();
    const p = store.flags('palafita'); p.set('panela'); store.commit(p);
    const { sim } = make(store);
    arrive(sim);
    ben(sim).data.wait = 99; ben(sim).path = []; ben(sim).gx = 6.5; ben(sim).gy = 0.5;
    for (const f of ['tv', 'plant']) act(sim, f, f === 'tv' ? 'use' : 'water', 5);
    act(sim, 'cabinet', 'open', 4); act(sim, 'cabinet', 'rummage', 4);
    act(sim, 'redeSala', 'lie', 6);
    sim.set('panela');
    run(sim, 0.5);
    const k = evs(sim).filter((e) => e.type === 'karimbado');
    expect(k).toHaveLength(1);
    expect(sim.has('karimbado')).toBe(true);
  });
});
