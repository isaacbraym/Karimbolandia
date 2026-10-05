import { describe, it, expect } from 'vitest';
import { World } from '../src/game/world';
import { buildJungle } from '../src/game/level/jungle';
import { captureSave, applySave } from '../src/game/save';
import { validateSave } from '../src/core/saveValidation';
import { InteriorStore } from '../src/game/interiorStore';

const jungle = () => new World(buildJungle());

describe('save dos interiores', () => {
  it('não grava nada novo quando nenhum interior foi visitado (saves antigos continuam idênticos)', () => {
    const s = captureSave(jungle());
    expect('interiors' in s).toBe(false);
    expect('villageRep' in s).toBe(false);
    expect(validateSave(s)).not.toBeNull();
  });

  it('faz ida e volta de flags e reputação pelo save, validação e restauração', () => {
    const w = jungle();
    const f = w.interiors.flags('palafita'); f.set('panela'); f.set('mustache'); w.interiors.commit(f);
    const g = w.interiors.flags('benedita'); g.set('tv'); w.interiors.commit(g);
    w.interiors.addRep(-35);
    const cap = captureSave(w);
    const v = validateSave(JSON.parse(JSON.stringify(cap)))!;
    expect(v.interiors).toEqual(cap.interiors);
    expect(v.villageRep).toBe(-35);
    const r = jungle();
    applySave(r, v);
    expect(r.interiors.has('palafita', 'panela')).toBe(true);
    expect(r.interiors.has('benedita', 'tv')).toBe(true);
    expect(r.interiors.has('benedita', 'filter')).toBe(false);
    expect(r.interiors.rep).toBe(-35);
    expect(r.interiors.carriesPanela()).toBe(true);
  });

  it('save antigo (sem os campos) carrega com reputação 0 e flags vazias', () => {
    const w = jungle();
    const old = JSON.parse(JSON.stringify(captureSave(w)));
    delete old.interiors; delete old.villageRep;
    const v = validateSave(old)!;
    const r = jungle();
    r.interiors.addRep(50);
    applySave(r, v);
    expect(r.interiors.rep).toBe(0);
    expect(r.interiors.toSave()).toEqual([]);
  });

  it('rejeita interiors malformados, com bitmask absurdo, duplicados, em excesso ou reputação fora da faixa', () => {
    const base = JSON.parse(JSON.stringify(captureSave(jungle())));
    const bad = (patch: object) => validateSave({ ...base, ...patch });
    expect(bad({ interiors: [['palafita', 3]] })).not.toBeNull();
    expect(bad({ interiors: 'x' })).toBeNull();
    expect(bad({ interiors: [['palafita']] })).toBeNull();
    expect(bad({ interiors: [['Palafita!', 1]] })).toBeNull();
    expect(bad({ interiors: [['palafita', -1]] })).toBeNull();
    expect(bad({ interiors: [['palafita', 2 ** 31]] })).toBeNull();
    expect(bad({ interiors: [['palafita', 1.5]] })).toBeNull();
    expect(bad({ interiors: [['palafita', 1], ['palafita', 2]] })).toBeNull();
    expect(bad({ interiors: Array.from({ length: 65 }, (_, i) => [`r${i}`, 1]) })).toBeNull();
    expect(bad({ villageRep: 101 })).toBeNull();
    expect(bad({ villageRep: -101 })).toBeNull();
    expect(bad({ villageRep: 12.5 })).toBeNull();
    expect(bad({ villageRep: 100 })).not.toBeNull();
  });

  it('o limite de 64 IDs de encounters continua valendo e os interiores não consomem esses IDs', () => {
    const w = jungle();
    for (const spot of w.exploration.spots) for (const obj of spot.objects) { w.exploration.inspect(w, spot, obj); w.exploration.inspect(w, spot, obj); }
    const before = w.encounters.completed.size;
    for (const id of ['palafita', 'benedita'] as const) { const f = w.interiors.flags(id); for (const n of ['visited', 'panela']) f.set(n); w.interiors.commit(f); }
    expect(w.encounters.completed.size).toBe(before);
    expect(before).toBeLessThan(55);
    expect(validateSave(captureSave(w))).not.toBeNull();
  });

  it('descarta ids de cômodo desconhecidos ao restaurar e mantém só máscaras válidas', () => {
    const st = new InteriorStore();
    st.load([['palafita', 5], ['fantasma', 9]], 7);
    expect(st.toSave()).toEqual([['palafita', 5]]);
    expect(st.rep).toBe(7);
  });

  it('restart da fase limpa flags, reputação e trancas', () => {
    const w = jungle();
    const f = w.interiors.flags('benedita'); f.set('tv'); w.interiors.commit(f); w.interiors.addRep(20);
    w.interiorLock.set('benedita', 3);
    w.restart();
    expect(w.interiors.toSave()).toEqual([]);
    expect(w.interiors.rep).toBe(0);
    expect(w.interiorLock.size).toBe(0);
  });

  it('a casa e a palafita têm porta e a tranca abre no checkpoint seguinte', () => {
    const w = jungle();
    const house = w.exploration.spots.find((s) => s.interior === 'benedita')!;
    expect(house.home).toBe(true);
    expect(house.id).toMatch(/^house:\d+$/);
    expect(w.exploration.locked(w, house)).toBe(false);
    w.interiorLock.set('benedita', w.checkpointIdx);
    expect(w.exploration.locked(w, house)).toBe(true);
    w.checkpointIdx += 1;
    expect(w.exploration.locked(w, house)).toBe(false);
  });
});
