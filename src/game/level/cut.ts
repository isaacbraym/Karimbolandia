/**
 * Encurta o caminho até o Felipão (~15%) removendo trechos de "corredor" repetitivo depois que a
 * fase inteira foi montada. Os cortes ficam em chão plano, sem estruturas no ar e sem nada
 * essencial (emblemas, segredos, checkpoints, arenas, cinemáticas). Tudo que vem depois de um corte
 * é deslocado para a esquerda; o que estava dentro dele (inimigos/caixas/itens/decoração) sai.
 */
import { Level, TILE } from '../level';
import type { LevelBuilder } from './builder';

/** Intervalos de tiles removidos [início, fim), em coordenadas da fase ORIGINAL. */
export const CUTS: [number, number][] = [
  [62, 112], // entrada: corredor antes dos primeiros soldados
  [182, 204], // rua principal: segunda linha de barricadas
  [401, 414], // antes da primeira arena
  [486, 522], // depois da emboscada, até a garagem
  [752, 776], // depois do abismo (trecho do Nômad)
  [878, 895], // fim da exploração
  [1009, 1042], // depois da área de guerra, até a passagem estreita
];
export const CUT_TOTAL = CUTS.reduce((s, [a, b]) => s + (b - a), 0);

/** O tile (original) está dentro de algum corte? */
export function inCut(tx: number) {
  for (const [a, b] of CUTS) if (tx >= a && tx < b) return true;
  return false;
}

/** Tile original → tile na fase encurtada (dentro de um corte: vai para o início dele). */
export function mapTile(tx: number) {
  let s = 0;
  for (const [a, b] of CUTS) {
    if (tx >= b) s += b - a;
    else if (tx >= a) return a - s;
  }
  return tx - s;
}

/** Coordenada x (px) original → nova. */
export function mapPx(x: number) {
  const tx = Math.floor(x / TILE);
  if (inCut(tx)) return mapTile(tx) * TILE;
  return mapTile(tx) * TILE + (x - tx * TILE);
}

export function applyCuts(b: LevelBuilder) {
  const L = b.level;
  const nw = L.w - CUT_TOTAL;
  const N = new Level(nw, L.h);
  for (let tx = 0; tx < L.w; tx++) {
    if (inCut(tx)) continue;
    const nx = mapTile(tx);
    for (let ty = 0; ty < L.h; ty++) {
      N.tiles[ty * nw + nx] = L.tiles[ty * L.w + tx];
      N.theme[ty * nw + nx] = L.theme[ty * L.w + tx];
    }
  }
  b.level = N;
  const keep = (x: number) => !inCut(Math.floor(x / TILE));
  // entidades: o que estava no corte sai; o resto desloca
  b.enemies = b.enemies.filter((e) => e.arena || keep(e.x));
  for (const e of b.enemies) e.x = mapPx(e.x);
  b.props = b.props.filter((p) => keep(p.x));
  for (const p of b.props) p.x = mapPx(p.x);
  b.pickups = b.pickups.filter((p) => keep(p.x));
  for (const p of b.pickups) p.x = mapPx(p.x);
  b.decos = b.decos.filter((d) => keep(d.x));
  for (const d of b.decos) d.x = mapPx(d.x);
  b.civilians = b.civilians.filter((c) => keep(c.x));
  for (const c of b.civilians) c.x = mapPx(c.x);
  for (const c of b.checkpoints) c.x = mapPx(c.x);
  for (const a of b.arenas) {
    a.rect.x = mapPx(a.rect.x);
    a.triggerX = mapPx(a.triggerX);
  }
  for (const z of b.camZones) z.rect.x = mapPx(z.rect.x);
  for (const s of b.secretRooms) s.rect.x = mapPx(s.rect.x);
  for (const t of b.triggers) t.rect.x = mapPx(t.rect.x);
  for (const s of b.sections) s.x = mapPx(s.x);
  for (const a of b.atmosphere) a.x = mapPx(a.x);
  for (const z of b.water) z.x = mapPx(z.x);
  for (const v of b.vines) v.x = mapPx(v.x);
  for (const d of b.doors) {
    d.x = mapPx(d.x);
    d.tx = mapPx(d.tx);
  }
  for (const r of b.rooms) r.x = mapPx(r.x);
  b.playerStart.x = mapPx(b.playerStart.x);
  b.nomadSpawn.x = mapPx(b.nomadSpawn.x);
  b.finishX = mapPx(b.finishX);
}
