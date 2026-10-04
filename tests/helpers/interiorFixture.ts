import { InteriorStore } from '../../src/game/interiorStore';
import { InteriorSim, nullHost, type InteriorHost } from '../../src/game/interior/sim';
import type { Brain, RoomDef, FurnitureDef } from '../../src/game/interior/types';

/** Sala mínima só para testar o motor (usa os flags reais de 'palafita'). */
export const heard: { p: number; x: number; y: number }[] = [];
export const spyBrain: Brain = {
  update() {},
  hear(_s, _n, p, at) { heard.push({ p, x: at.x, y: at.y }); },
};

export function fixtureRoom(over: Partial<RoomDef> = {}): RoomDef {
  const crate: FurnitureDef = {
    id: 'crate', name: 'Caixote', paint: 'crate', gx: 3, gy: 1, w: 1, h: 1, tall: true,
    verbs: () => [{ id: 'smash', label: 'Derrubar', noise: 40, hostile: true, irritation: 30, run: (s) => { s.set('bottle'); } }],
  };
  const table: FurnitureDef = {
    id: 'table', name: 'Mesa', paint: 'table', gx: 1, gy: 3, w: 2, h: 1,
    verbs: () => [{ id: 'examine', label: 'Examinar', noise: 0, run: (s) => s.say('Uma mesa.') }],
  };
  return {
    id: 'palafita', title: 'Teste', subtitle: '', theme: 'stilt',
    rows: ['.......', '..s....', '.......', '.......', '.......'],
    door: { x: 0, y: 4 }, spawn: { x: 1, y: 4 },
    furniture: [crate, table], npcs: [], pranks: [],
    ...over,
  };
}

export function makeSim(over: Partial<RoomDef> = {}, host: InteriorHost = nullHost, store = new InteriorStore()) {
  return { sim: new InteriorSim(fixtureRoom(over), store, host, 1), store };
}

export const still = { mx: 0, my: 0, sneak: false };
export function run(sim: InteriorSim, seconds: number, inp = still, dt = 1 / 60) {
  for (let t = 0; t < seconds; t += dt) sim.update(dt, inp);
}
