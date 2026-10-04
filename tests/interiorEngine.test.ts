import { describe, it, expect } from 'vitest';
import { gridToScreen, screenToGrid, screenDirToGrid, depthKey, TILE_W, TILE_H } from '../src/game/interior/iso';
import { Grid, findPath, hasLine, adjacentCells } from '../src/game/interior/grid';
import { InteriorStore, RoomFlags, ROOM_FLAGS } from '../src/game/interiorStore';
import { makeSim, run, heard, spyBrain, fixtureRoom } from './helpers/interiorFixture';
import { InteriorSim } from '../src/game/interior/sim';

describe('isometria 2:1', () => {
  it('converte grade ↔ tela de ida e volta', () => {
    for (const [gx, gy] of [[0, 0], [3.5, 1.25], [-2, 7], [9.9, 4.1]]) {
      const s = gridToScreen(gx, gy), g = screenToGrid(s.x, s.y);
      expect(g.gx).toBeCloseTo(gx, 6); expect(g.gy).toBeCloseTo(gy, 6);
    }
  });
  it('gx vai para a direita-baixo e gy para a esquerda-baixo, na proporção 2:1', () => {
    const a = gridToScreen(1, 0), b = gridToScreen(0, 1);
    expect(a.x).toBe(TILE_W / 2); expect(a.y).toBe(TILE_H / 2);
    expect(b.x).toBe(-TILE_W / 2); expect(b.y).toBe(TILE_H / 2);
    expect(TILE_W / TILE_H).toBe(2);
  });
  it('profundidade cresce para a frente da tela', () => {
    expect(depthKey(3, 3)).toBeGreaterThan(depthKey(2, 3));
    expect(depthKey(1, 1, 5)).toBeGreaterThan(depthKey(1, 1, 0));
  });
  it('teclas relativas à tela: ↑ (−1,−1), → (+1,−1), ↓ (+1,+1), ← (−1,+1)', () => {
    const r = Math.SQRT1_2;
    const d = (mx: number, my: number) => screenDirToGrid(mx, my);
    expect(d(0, -1).x).toBeCloseTo(-r); expect(d(0, -1).y).toBeCloseTo(-r);
    expect(d(1, 0).x).toBeCloseTo(r); expect(d(1, 0).y).toBeCloseTo(-r);
    expect(d(0, 1).x).toBeCloseTo(r); expect(d(0, 1).y).toBeCloseTo(r);
    expect(d(-1, 0).x).toBeCloseTo(-r); expect(d(-1, 0).y).toBeCloseTo(r);
    const up = d(1, -1);
    expect(Math.hypot(up.x, up.y)).toBeCloseTo(1); expect(up.x).toBeCloseTo(0); expect(up.y).toBeCloseTo(-1);
    expect(d(0, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('grade, caminho e visada', () => {
  const g = new Grid(['.....', '.###.', '.....', '.#...']);
  it('acha caminho contornando paredes', () => {
    const p = findPath(g, { x: 0, y: 0 }, [{ x: 4, y: 3 }])!;
    expect(p.at(-1)).toEqual({ x: 4, y: 3 });
    for (const c of p) expect(g.walkable(c.x, c.y)).toBe(true);
  });
  it('não corta quina: diagonal só com os dois vizinhos livres', () => {
    const blocked = new Grid(['.#', '#.']);
    expect(findPath(blocked, { x: 0, y: 0 }, [{ x: 1, y: 1 }])).toBeNull();
    expect(findPath(new Grid(['..', '..']), { x: 0, y: 0 }, [{ x: 1, y: 1 }])).toHaveLength(1);
  });
  it('devolve [] se já está no objetivo e null se inalcançável', () => {
    expect(findPath(g, { x: 0, y: 0 }, [{ x: 0, y: 0 }])).toEqual([]);
    expect(findPath(new Grid(['.#.', '.#.', '.#.']), { x: 0, y: 0 }, [{ x: 2, y: 2 }])).toBeNull();
  });
  it('escolhe o objetivo mais próximo entre vários', () => {
    const p = findPath(new Grid(['.......']), { x: 3, y: 0 }, [{ x: 0, y: 0 }, { x: 5, y: 0 }])!;
    expect(p.at(-1)).toEqual({ x: 5, y: 0 });
  });
  it('destino em objeto = célula vizinha livre, ortogonais primeiro', () => {
    const fp = { gx: 2, gy: 1, w: 1, h: 1 };
    const gg = new Grid(['.....', '.....', '.....'], [fp]);
    const adj = adjacentCells(gg, fp);
    expect(adj).toHaveLength(8);
    expect(adj.slice(0, 4).every((c) => c.x === 2 || c.y === 1)).toBe(true);
    expect(findPath(gg, { x: 0, y: 0 }, adj)).not.toBeNull();
  });
  it('móvel sólido bloqueia o caminho; tapete (solid=false) não', () => {
    const gg = new Grid(['...'], [{ gx: 1, gy: 0, w: 1, h: 1 }]);
    expect(findPath(gg, { x: 0, y: 0 }, [{ x: 2, y: 0 }])).toBeNull();
    const rug = new Grid(['...'], [{ gx: 1, gy: 0, w: 1, h: 1, solid: false }]);
    expect(findPath(rug, { x: 0, y: 0 }, [{ x: 2, y: 0 }])).toHaveLength(2);
  });
  it('visada: parede e móvel alto bloqueiam, móvel baixo não', () => {
    expect(hasLine(new Grid(['.....']), 0, 0, 4, 0)).toBe(true);
    const tall = new Grid(['.....'], [{ gx: 2, gy: 0, w: 1, h: 1, tall: true }]);
    expect(hasLine(tall, 0, 0, 4, 0)).toBe(false);
    expect(hasLine(tall, 0, 0, 4, 0, false)).toBe(true);
    expect(hasLine(new Grid(['.....'], [{ gx: 2, gy: 0, w: 1, h: 1 }]), 0, 0, 4, 0)).toBe(true);
    expect(hasLine(new Grid(['..#..']), 0, 0, 4, 0, false)).toBe(false);
  });
});

describe('flags e store', () => {
  it('guarda flags por nome em bitmask e faz ida e volta', () => {
    const f = new RoomFlags('palafita');
    f.set('panela'); f.set('mustache'); f.set('panela');
    expect(f.has('panela')).toBe(true); expect(f.has('laces')).toBe(false); expect(f.count()).toBe(2);
    const st = new InteriorStore(); st.commit(f); st.addRep(500);
    expect(st.rep).toBe(100);
    const st2 = new InteriorStore(); st2.load(st.toSave(), st.rep);
    expect(st2.has('palafita', 'mustache')).toBe(true);
    expect(st2.get('palafita')).toBe(f.mask);
    f.clear('panela'); expect(f.has('panela')).toBe(false);
  });
  it('cada cômodo cabe em 31 bits e a lista não tem repetição', () => {
    for (const names of Object.values(ROOM_FLAGS)) { expect(names.length).toBeLessThanOrEqual(31); expect(new Set(names).size).toBe(names.length); }
  });
  it('ignora ids desconhecidos ao carregar e limita a reputação', () => {
    const st = new InteriorStore(); st.load([['xyz', 3], ['benedita', 5]], -9999);
    expect(st.get('benedita')).toBe(5); expect(st.toSave()).toEqual([['benedita', 5]]); expect(st.rep).toBe(-100);
  });
  it('panela em mãos: pegou na palafita e ainda não devolveu', () => {
    const st = new InteriorStore(); expect(st.carriesPanela()).toBe(false);
    const a = st.flags('palafita'); a.set('panela'); st.commit(a); expect(st.carriesPanela()).toBe(true);
    const b = st.flags('benedita'); b.set('panela'); st.commit(b); expect(st.carriesPanela()).toBe(false);
  });
});

describe('simulador: andar, ações e ruído', () => {
  it('teclado anda pela grade e nunca entra em parede ou móvel sólido', () => {
    const { sim } = makeSim();
    const x0 = sim.px;
    run(sim, 0.5, { mx: 1, my: 0, sneak: false });
    expect(sim.px).toBeGreaterThan(x0); expect(sim.py).toBeLessThan(4.5);
    run(sim, 5, { mx: 0, my: -1, sneak: false });
    expect(sim.px).toBeGreaterThanOrEqual(0.2); expect(sim.py).toBeGreaterThanOrEqual(0.2);
    expect(sim.grid.walkable(sim.cell().x, sim.cell().y)).toBe(true);
  });
  it('clique no piso: anda por A* e chega ao destino', () => {
    const a = makeSim().sim;
    expect(a.walkTo({ x: 5, y: 2 })).toBe(true);
    run(a, 0.3); expect(a.path.length).toBeGreaterThan(0);
    run(a, 3); expect(a.cell()).toEqual({ x: 5, y: 2 });
  });
  it('ponta dos pés anda mais devagar', () => {
    const a = makeSim().sim, b = makeSim().sim;
    a.walkTo({ x: 6, y: 0 }); b.walkTo({ x: 6, y: 0 });
    run(a, 0.8); run(b, 0.8, { mx: 0, my: 0, sneak: true });
    expect(Math.hypot(a.px - 1.5, a.py - 4.5)).toBeGreaterThan(Math.hypot(b.px - 1.5, b.py - 4.5));
  });
  it('destino bloqueado ou inalcançável é recusado sem travar', () => {
    const { sim } = makeSim();
    expect(sim.walkTo({ x: 3, y: 1 })).toBe(false);
    expect(sim.walkTo({ x: 99, y: 99 })).toBe(false);
  });
  it('agir num móvel anda até ele, executa o verbo e gera ruído', () => {
    heard.length = 0;
    const { sim } = makeSim({ npcs: [{ id: 'g', name: 'G', gx: 6, gy: 4, brain: spyBrain, state: 'x' }] });
    expect(sim.act('crate', 'smash')).toBe(true);
    run(sim, 3);
    expect(sim.has('bottle')).toBe(true);
    expect(heard.some((h) => h.p > 5)).toBe(true);
    expect(sim.events.some((e) => e.type === 'ring')).toBe(true);
  });
  it('verbos devolvem ondas de ruído e hostilidade para o menu', () => {
    const { sim } = makeSim();
    expect(sim.verbsFor('crate')[0]).toMatchObject({ id: 'smash', waves: 3, hostile: true });
    expect(sim.verbsFor('table')[0]).toMatchObject({ waves: 0, hostile: false });
    expect(sim.verbsFor('nada')).toEqual([]);
  });
  it('ruído cai com a distância e pela metade atrás de parede', () => {
    heard.length = 0;
    const room = fixtureRoom({ rows: ['.....#...', '.....#...'], furniture: [], npcs: [
      { id: 'near', name: 'a', gx: 3, gy: 0, brain: spyBrain, state: 'x' },
      { id: 'wall', name: 'b', gx: 7, gy: 0, brain: spyBrain, state: 'x' }] });
    const sim = new InteriorSim(room, new InteriorStore());
    sim.noise(1.5, 0.5, 30);
    expect(heard).toHaveLength(2);
    const p = heard.map((h) => h.p).sort((a, b) => b - a);
    expect(p[0]).toBeCloseTo(30 - 4 * 2, 5);
    expect(p[1]).toBeCloseTo((30 - 4 * 6) * 0.5, 5);
  });
  it('tábua rangente faz mais barulho; ponta dos pés reduz para um quarto', () => {
    const mk = (sink: number[], sneak: boolean) => {
      const spy = { update() {}, hear(_s: unknown, _n: unknown, p: number) { sink.push(p); } };
      const room = fixtureRoom({ rows: ['.s......', '.s......'], door: { x: 7, y: 1 }, spawn: { x: 1, y: 0 },
        furniture: [], npcs: [{ id: 'n', name: 'n', gx: 2, gy: 1, brain: spy, state: 'x' }] });
      const s = new InteriorSim(room, new InteriorStore());
      s.px = 1.5; s.py = 0.5; run(s, 0.8, { mx: -1, my: 1, sneak });
    };
    const loud: number[] = [], quiet: number[] = [];
    mk(loud, false); mk(quiet, true);
    expect(loud.length).toBeGreaterThan(0);
    expect(Math.max(...loud)).toBeGreaterThan(Math.max(0, ...quiet));
  });
  it('rádio ligado perto mascara 50% do ruído dos passos', () => {
    const radio = { id: 'radio', name: 'Rádio', paint: 'radio', gx: 0, gy: 0, w: 1, h: 1, verbs: () => [] };
    const mk = (on: boolean) => {
      const seen: number[] = [];
      const spy = { update() {}, hear(_s: unknown, _n: unknown, p: number) { seen.push(p); } };
      const room = fixtureRoom({ rows: ['.sss...', '.sss...'], furniture: [radio], spawn: { x: 1, y: 1 }, door: { x: 6, y: 1 },
        npcs: [{ id: 'n', name: 'n', gx: 2, gy: 1, brain: spy, state: 'x' }] });
      const s = new InteriorSim(room, new InteriorStore());
      if (on) s.rt.radio = 1;
      s.px = 1.5; s.py = 1.5; run(s, 0.6, { mx: 1, my: 0, sneak: false });
      return seen[0] ?? 0;
    };
    expect(mk(true)).toBeLessThan(mk(false));
  });
  it('é determinístico com a mesma semente e nunca repete a fala em sequência', () => {
    const a = makeSim().sim, b = makeSim().sim;
    const pick = (s: InteriorSim) => [0, 1, 2, 3, 4].map(() => s.line('k', ['a', 'b', 'c']));
    const la = pick(a);
    expect(la).toEqual(pick(b));
    for (let i = 1; i < la.length; i++) expect(la[i]).not.toBe(la[i - 1]);
  });
  it('pisar no tapete da porta sai; o commit grava flags e reputação', () => {
    const { sim, store } = makeSim();
    sim.set('mustache'); sim.addRep(10);
    expect(sim.leave()).toBe(true); run(sim, 4);
    expect(sim.exited).toBe('door');
    expect(sim.events.some((e) => e.type === 'exit')).toBe(true);
    sim.commit();
    expect(store.has('palafita', 'mustache')).toBe(true); expect(store.rep).toBe(10);
  });
  it('rastro só fica se ninguém viu a ação', () => {
    const { sim } = makeSim();
    sim.actSeen = false; sim.trace('crate', 20, 'x'); expect(sim.traces).toHaveLength(1);
    sim.actSeen = true; sim.trace('crate', 20, 'y'); expect(sim.traces).toHaveLength(1);
  });
});
