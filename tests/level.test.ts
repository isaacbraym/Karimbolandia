import { mapTile as M } from '../src/game/level/index';
import { describe, it, expect } from 'vitest';
import { buildLevel, LEVEL_W } from '../src/game/level/index';
import { T, TILE } from '../src/game/level';
import { analyzeReach, pickupReachable, standRows } from '../src/game/level/reach';

const data = buildLevel();
const L = data.level;

describe('Fase: integridade dos dados', () => {
  it('tem o tamanho esperado e uma fase longa', () => {
    expect(L.w).toBe(LEVEL_W);
    expect(L.w * TILE).toBeGreaterThan(35000);
  });

  it('inimigos terrestres nascem dentro do ar e com chão perto; nada dentro de sólido', () => {
    const bad: string[] = [];
    for (const e of data.enemies) {
      const tx = Math.floor(e.x / TILE);
      const flying = e.type === 'drone' || e.type === 'jetpack';
      const inside = L.solidAtPx(e.x, e.y - 10);
      if (inside && !e.ceiling) bad.push(`${e.type}#${e.id} dentro de sólido em (${tx},${Math.floor(e.y / TILE)})`);
      if (!flying && !e.ceiling && e.type !== 'boss') {
        const curve = L.moundSurface(e.x);
        let ground = curve !== null && Math.abs(curve - e.y) < 2;
        for (let k = 0; k <= 3; k++) {
          const t = L.get(tx, Math.floor(e.y / TILE) + k);
          if (t === T.SOLID || t === T.ONEWAY) ground = true;
        }
        if (!ground && !e.drop) bad.push(`${e.type}#${e.id} sem chão em (${tx},${Math.floor(e.y / TILE)})`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('pickups e props não estão embutidos em tiles sólidos', () => {
    const bad: string[] = [];
    for (const p of data.pickups) if (L.solidAtPx(p.x, p.y)) bad.push(`pickup ${p.kind}#${p.id} em sólido (${Math.floor(p.x / TILE)},${Math.floor(p.y / TILE)})`);
    for (const p of data.props) {
      const cy = p.y - 8;
      if (L.solidAtPx(p.x, cy) && p.kind !== 'wall' && p.kind !== 'door') bad.push(`prop ${p.kind}#${p.id} em sólido (${Math.floor(p.x / TILE)},${Math.floor(cy / TILE)})`);
    }
    expect(bad).toEqual([]);
  });

  it('10 emblemas (ids 0..9) e 3 orelhas douradas únicos', () => {
    const em = data.pickups.filter((p) => p.kind === 'emblem').map((p) => p.itemId);
    expect([...new Set(em)].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const se = data.pickups.filter((p) => p.kind === 'secret').map((p) => p.itemId);
    expect([...new Set(se)].sort()).toEqual([0, 1, 2]);
  });

  it('checkpoints ordenados, sobre chão e fora de arenas', () => {
    const cps = data.checkpoints;
    expect(cps.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < cps.length; i++) expect(cps[i].x).toBeGreaterThan(cps[i - 1].x);
    for (const c of cps) {
      const tx = Math.floor(c.x / TILE);
      const ty = Math.round(c.y / TILE);
      expect(standRows(L, tx, ty)).toBeGreaterThanOrEqual(2);
      for (const a of data.arenas) expect(c.x < a.rect.x || c.x > a.rect.x + a.rect.w).toBe(true);
    }
  });

  it('há Nômad, chefe, arenas com ondas e todos os spawns de arena existem', () => {
    expect(data.nomadSpawn.x).toBeGreaterThan(0);
    const boss = data.enemies.find((e) => e.type === 'boss');
    expect(boss).toBeTruthy();
    for (const a of data.arenas) {
      if (a.id === 'boss') continue;
      expect(a.waves.length).toBeGreaterThanOrEqual(2);
      for (const w of a.waves) for (const id of w.spawns) expect(data.enemies.find((e) => e.id === id)).toBeTruthy();
    }
    expect(data.enemies.filter((e) => !e.arena).length + data.enemies.filter((e) => e.arena).length).toBeGreaterThan(120);
  });

  it('ids de spawn únicos', () => {
    const ids = data.enemies.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const pk = data.pickups.map((p) => p.id);
    expect(new Set(pk).size).toBe(pk.length);
    const pr = data.props.map((p) => p.id);
    expect(new Set(pr).size).toBe(pr.length);
  });
});

describe('Fase: caminho crítico alcançável (física real)', () => {
  const res = analyzeReach(data);

  it('alcança cada checkpoint', () => {
    const missing: string[] = [];
    for (const c of data.checkpoints) {
      const tx = Math.floor(c.x / TILE);
      const ty = Math.round(c.y / TILE);
      if (!res.reached.has(res.key(tx, ty))) missing.push(`${c.name} (${tx},${ty})`);
    }
    expect(missing).toEqual([]);
  });

  it('alcança o chão da arena do chefe e a posição do Felipão', () => {
    const boss = data.arenas.find((a) => a.id === 'boss')!;
    const row = Math.round((boss.rect.y + boss.rect.h) / TILE);
    void row;
    const bossSpawn = data.enemies.find((e) => e.type === 'boss')!;
    const ty = Math.round(bossSpawn.y / TILE);
    const tx = Math.floor(boss.rect.x / TILE) + 6;
    expect(res.reached.has(res.key(tx, ty))).toBe(true);
    expect(res.reached.has(res.key(Math.floor(bossSpawn.x / TILE), ty))).toBe(true);
  });

  it('alcança todos os emblemas e orelhas douradas', () => {
    const missing: string[] = [];
    for (const p of data.pickups) {
      if (p.kind !== 'emblem' && p.kind !== 'secret') continue;
      if (!pickupReachable(res, L, p.x, p.y)) missing.push(`${p.kind}#${p.itemId} em (${Math.floor(p.x / TILE)},${Math.floor(p.y / TILE)})`);
    }
    expect(missing).toEqual([]);
  });

  it('alcança as arenas (interior) e a saída de cada uma', () => {
    for (const a of data.arenas) {
      const tx = Math.floor((a.rect.x + a.rect.w / 2) / TILE);
      let ok = false;
      for (let ty = Math.floor(a.rect.y / TILE); ty < Math.floor((a.rect.y + a.rect.h) / TILE) + 2; ty++) if (res.reached.has(res.key(tx, ty))) ok = true;
      expect(ok, `arena ${a.id}`).toBe(true);
    }
  });
});

describe('Fase: mecânicas obrigatórias', () => {
  it('o buraco do planeio (seção 3) NÃO é atravessável sem o Ear Glide', () => {
    const noGlide = analyzeReach(data, [], { noGlide: true });
    // coluna logo após o buraco de 8 tiles (x=304..)
    const after = data.level.get(M(304), 32) === T.SOLID;
    expect(after).toBe(true);
    expect(noGlide.reached.has(noGlide.key(M(320), 32))).toBe(false);
    // com planeio, sim
    const withGlide = analyzeReach(data);
    expect(withGlide.reached.has(withGlide.key(M(320), 32))).toBe(true);
  }, 30000);
});

import { analyzeReachNomad } from '../src/game/level/reach';
describe('Fase: trecho do Nômad atravessável pilotando', () => {
  const ns = data.nomadSpawn;
  const dismount = data.triggers.find((t) => t.id === 'dismount')!;
  const dxTile = Math.floor(dismount.rect.x / TILE);
  const res = analyzeReachNomad(data, ns, dxTile + 4);

  it('vai da garagem até o ponto de desembarque', () => {
    expect(res.reached.has(res.key(dxTile, 32))).toBe(true);
  });

  it('atravessa o abismo de 8 tiles usando o avanço (não é alcançável só pulando)', () => {
    // sem avanço não chega; com o perfil completo (salto+propulsor+avanço) chega
    const after = res.reached.has(res.key(M(752), 32));
    expect(after).toBe(true);
  });

  it('entra na arena de guerra', () => {
    const a2 = data.arenas.find((a) => a.id === 'a2')!;
    const tx = Math.floor((a2.rect.x + a2.rect.w / 2) / TILE);
    expect(res.reached.has(res.key(tx, 32))).toBe(true);
  });

  it('alcança as câmaras dos emblemas 4 e 6 (parede reforçada) e a rota alta do 5', () => {
    for (const id of [4, 5, 6]) {
      const p = data.pickups.find((k) => k.kind === 'emblem' && k.itemId === id)!;
      expect(pickupReachable(res, data.level, p.x, p.y, 120), `emblema ${id}`).toBe(true);
    }
  });
});
