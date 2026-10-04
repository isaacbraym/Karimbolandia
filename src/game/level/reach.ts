/**
 * Validador de alcançabilidade: simula, com a MESMA física do jogo, ações de pulo/planeio/queda
 * a partir de cada "célula pisável" e faz uma busca em largura. Prova que o caminho crítico
 * (e os coletáveis) podem ser alcançados por um jogador de verdade — usado nos testes.
 */
import { Level, T, TILE, type LevelData } from '../level';
import { newBody, moveBody, type Body } from '../physics';
import {
  FOOT_W, FOOT_H, RUN, AIR_ACC, GRAV, JUMP_V, FALL_MAX, GLIDE_FALL, GLIDE_FUEL, GLIDE_SPEED,
  NOMAD_W, NOMAD_H, N_RUN, N_ACC, N_GRAV, N_JUMP,
} from '../movement';

const DT = 1 / 60;

export interface ReachResult {
  reached: Set<number>;
  key: (tx: number, ty: number) => number;
  cells: number;
}

const approach = (v: number, t: number, s: number) => (v < t ? Math.min(v + s, t) : Math.max(v - s, t));

export function standRows(level: Level, tx: number, ty: number): number {
  const t = level.get(tx, ty);
  if (t !== T.SOLID && t !== T.ONEWAY) return 0;
  let free = 0;
  for (let k = 1; k <= 3; k++) {
    if (level.get(tx, ty - k) === T.SOLID) break;
    free++;
  }
  return free;
}
const standing = (l: Level, tx: number, ty: number) => standRows(l, tx, ty) >= 2;
const crawlable = (l: Level, tx: number, ty: number) => standRows(l, tx, ty) >= 1;

interface Macro {
  jump: boolean;
  dir: -1 | 0 | 1;
  hold: number; // frames com o botão de pulo pressionado
  glideAt: number; // frame em que aperta pulo de novo (-1 = nunca)
  glideFor: number; // frames planando antes de soltar (Infinity = até pousar)
  drop?: boolean;
  offset?: number; // px além da borda (queda)
}

const MACROS: Macro[] = [];
for (const dir of [-1, 1] as const) {
  for (const hold of [99, 16]) {
    for (const glideAt of [-1, 24, 34, 46]) {
      for (const glideFor of glideAt < 0 ? [0] : [40, 90, 9999]) MACROS.push({ jump: true, dir, hold, glideAt, glideFor });
    }
  }
  for (const glideAt of [-1, 8, 20]) MACROS.push({ jump: false, dir, hold: 0, glideAt, glideFor: 9999, offset: 12 });
}
for (const dir of [-1, 0, 1] as const) MACROS.push({ jump: false, dir, hold: 0, glideAt: -1, glideFor: 0, drop: true });

/** Roda um macro e devolve a célula (tx,ty) onde pousou, ou null. */
function run(level: Level, tx: number, ty: number, m: Macro, b: Body, deathY: number): [number, number] | null {
  const cx = tx * TILE + TILE / 2;
  const feet = ty * TILE;
  b.w = FOOT_W;
  b.h = FOOT_H;
  b.x = cx + (m.offset ? m.dir * (TILE / 2 + m.offset) : 0);
  b.y = feet - FOOT_H / 2 - 0.5;
  b.vx = m.dir * RUN * (m.jump || m.offset ? 1 : m.dir === 0 ? 0 : 0.5);
  b.vy = m.jump ? -JUMP_V : 0;
  b.onGround = !m.jump && !m.offset;
  b.dropTimer = m.drop ? 0.24 : 0;
  if (m.drop) b.y += 2;
  let gliding = false;
  let fuel = GLIDE_FUEL;
  let glideT = 0;
  let cut = false;
  let airborne = m.jump || !!m.offset || !!m.drop;
  for (let f = 0; f < 420; f++) {
    const held = f < m.hold;
    // glide (segundo aperto de pulo)
    if (m.glideAt >= 0 && f === m.glideAt && !gliding && fuel > 0.15 && !b.onGround) {
      gliding = true;
      glideT = 0;
      if (b.vy > -60) b.vy = -110;
    }
    if (gliding) {
      glideT++;
      if (glideT > m.glideFor || fuel <= 0) gliding = false;
    }
    const target = m.dir * (gliding ? GLIDE_SPEED : RUN);
    b.vx = approach(b.vx, target, (b.onGround ? 2300 : AIR_ACC) * DT);
    if (gliding) {
      fuel -= DT;
      const tgt = GLIDE_FALL;
      if (b.vy > tgt) b.vy = approach(b.vy, tgt, 2600 * DT);
      else b.vy += 900 * DT * 0.2;
    } else {
      b.vy = Math.min(FALL_MAX, b.vy + GRAV * DT);
      if (b.vy < 0 && !held) b.vy += GRAV * 0.6 * DT;
    }
    if (m.jump && !held && !cut && b.vy < -150) {
      b.vy *= 0.55;
      cut = true;
    }
    moveBody(b, DT, level, null, true);
    if (b.y > deathY) return null;
    if (b.onGround) {
      if (airborne && f > 2) {
        return [Math.floor(b.x / TILE), Math.floor((b.y + FOOT_H / 2 + 2) / TILE)];
      }
    } else airborne = true;
  }
  return null;
}

export function analyzeReach(data: LevelData, extraStarts: { x: number; y: number }[] = [], opts: { noGlide?: boolean; noDoors?: boolean } = {}): ReachResult {
  const level = data.level;
  const key = (tx: number, ty: number) => ty * level.w + tx;
  const reached = new Set<number>();
  const queue: [number, number][] = [];
  const b = newBody(FOOT_W, FOOT_H);
  // mesma queda do jogo: fora do lago fundo o abismo continua na linha antiga (mapa alto só pelo lago)
  const deathY = (data.voidRow ?? level.h) * TILE + 60;
  const push = (tx: number, ty: number) => {
    const k = key(tx, ty);
    if (reached.has(k)) return;
    if (!crawlable(level, tx, ty)) return;
    reached.add(k);
    queue.push([tx, ty]);
  };
  // portas (templo, balada): de pé na frente da porta, ↑ leva ao outro lado
  const doorsAt = new Map<number, [number, number][]>();
  for (const d of opts.noDoors ? [] : data.doors ?? []) {
    const k = key(Math.floor(d.x / TILE), Math.round(d.y / TILE));
    const list = doorsAt.get(k) ?? [];
    list.push([Math.floor(d.tx / TILE), Math.round(d.ty / TILE)]);
    doorsAt.set(k, list);
  }
  const s = data.playerStart;
  push(Math.floor(s.x / TILE), Math.floor(s.y / TILE));
  for (const e of extraStarts) push(Math.floor(e.x / TILE), Math.floor(e.y / TILE));
  let head = 0;
  while (head < queue.length) {
    const [tx, ty] = queue[head++];
    for (const [dx, dy] of doorsAt.get(key(tx, ty)) ?? []) push(dx, dy);
    // caminhar (mesma linha)
    for (const d of [-1, 1]) {
      if (tx + d < 0 || tx + d >= level.w) continue;
      if (crawlable(level, tx + d, ty)) {
        // sem parede entre as células (o corpo cabe): a linha livre acima já foi checada em standRows
        push(tx + d, ty);
      }
    }
    if (!standing(level, tx, ty)) continue; // em túnel baixo só engatinha
    const oneWay = level.get(tx, ty) === T.ONEWAY;
    for (const m of MACROS) {
      if (m.drop && !oneWay) continue;
      if (opts.noGlide && m.glideAt >= 0) continue;
      const r = run(level, tx, ty, m, b, deathY);
      if (!r) continue;
      const [lx, ly] = r;
      if (lx === tx && ly === ty) continue;
      if (lx < 0 || lx >= level.w || ly < 0 || ly >= level.h) continue;
      if (standing(level, lx, ly)) push(lx, ly);
    }
  }
  return { reached, key, cells: reached.size };
}

/** O ponto (px,py) — centro de um item — é alcançável a partir de alguma célula alcançada? */
export function pickupReachable(res: ReachResult, level: Level, px: number, py: number, reachUp = 100): boolean {
  const tx0 = Math.floor(px / TILE);
  for (let dx = -1; dx <= 1; dx++) {
    const tx = tx0 + dx;
    for (let ty = Math.floor(py / TILE); ty < level.h; ty++) {
      const feet = ty * TILE;
      if (feet < py - 4) continue;
      if (feet - py > reachUp) break;
      if (res.reached.has(res.key(tx, ty))) return true;
    }
  }
  return false;
}


// ------------------------------------------------------------------------------------------
// Perfil do NÔMAD: pulo pesado + propulsor aéreo (1x) + avanço (dash 1). Sem planeio, sem agachar.
interface NMacro {
  jump: boolean;
  dir: -1 | 1;
  hold: number;
  boostAt: number;
  dashAt: number;
  offset?: number;
  drop?: boolean;
}
const NMACROS: NMacro[] = [];
for (const dir of [-1, 1] as const) {
  for (const hold of [99, 16]) {
    for (const boostAt of [-1, 14, 28]) {
      for (const dashAt of [-1, 0, 16, 30, 44]) NMACROS.push({ jump: true, dir, hold, boostAt, dashAt });
    }
  }
  for (const dashAt of [-1, 0, 10, 24]) NMACROS.push({ jump: false, dir, hold: 0, boostAt: -1, dashAt, offset: 14 });
  NMACROS.push({ jump: false, dir, hold: 0, boostAt: -1, dashAt: -1, drop: true });
}

function nrun(level: Level, tx: number, ty: number, m: NMacro, b: Body, deathY: number): [number, number] | null {
  const cx = tx * TILE + TILE / 2;
  const feet = ty * TILE;
  b.w = NOMAD_W;
  b.h = NOMAD_H;
  b.x = cx + (m.offset ? m.dir * (TILE / 2 + m.offset) : 0);
  b.y = feet - NOMAD_H / 2 - 0.5;
  b.vx = m.dir * N_RUN;
  b.vy = m.jump ? -N_JUMP : 0;
  b.onGround = !m.jump && !m.offset;
  b.dropTimer = m.drop ? 0.26 : 0;
  if (m.drop) b.y += 2;
  let dashT = 0;
  let boosted = false;
  let cut = false;
  let airborne = m.jump || !!m.offset || !!m.drop;
  for (let f = 0; f < 420; f++) {
    const held = f < m.hold;
    if (m.dashAt >= 0 && f === m.dashAt && dashT <= 0) dashT = 0.3;
    if (m.boostAt >= 0 && f === m.boostAt && !b.onGround && !boosted) {
      boosted = true;
      b.vy = Math.min(b.vy, -380);
    }
    if (dashT > 0) {
      const t = dashT / 0.3;
      dashT -= DT;
      b.vx = m.dir * 820 * (0.55 + 0.45 * t);
      b.vy = b.onGround ? 0 : b.vy + 400 * DT * 0.25;
      if (dashT <= 0) b.vx *= 0.35;
    } else {
      const acc = b.onGround ? N_ACC : 780;
      b.vx = approach(b.vx, m.dir * N_RUN, acc * DT);
      b.vy = Math.min(FALL_MAX, b.vy + N_GRAV * DT);
      if (m.jump && !held && !cut && b.vy < -160) {
        b.vy *= 0.6;
        cut = true;
      }
    }
    moveBody(b, DT, level, null, true);
    if (b.y > deathY) return null;
    if (b.onGround) {
      if (airborne && f > 2) return [Math.floor(b.x / TILE), Math.floor((b.y + NOMAD_H / 2 + 2) / TILE)];
    } else airborne = true;
  }
  return null;
}

/** Alcançabilidade para o Nômad a partir de uma célula (tx,ty) e limitada a x ≤ maxTx. */
export function analyzeReachNomad(data: LevelData, start: { x: number; y: number }, maxTx = 1e9): ReachResult {
  const level = data.level;
  const key = (tx: number, ty: number) => ty * level.w + tx;
  const reached = new Set<number>();
  const queue: [number, number][] = [];
  const b = newBody(NOMAD_W, NOMAD_H);
  // mesma queda do jogo: fora do lago fundo o abismo continua na linha antiga (mapa alto só pelo lago)
  const deathY = (data.voidRow ?? level.h) * TILE + 60;
  const roomy = (tx: number, ty: number) => standRows(level, tx, ty) >= 3;
  const push = (tx: number, ty: number) => {
    if (tx > maxTx) return;
    const k = key(tx, ty);
    if (reached.has(k) || !roomy(tx, ty)) return;
    reached.add(k);
    queue.push([tx, ty]);
  };
  push(Math.floor(start.x / TILE), Math.floor(start.y / TILE));
  let head = 0;
  while (head < queue.length) {
    const [tx, ty] = queue[head++];
    for (const d of [-1, 1]) if (tx + d >= 0 && tx + d < level.w) push(tx + d, ty);
    const oneWay = level.get(tx, ty) === T.ONEWAY;
    for (const m of NMACROS) {
      if (m.drop && !oneWay) continue;
      const r = nrun(level, tx, ty, m, b, deathY);
      if (!r) continue;
      const [lx, ly] = r;
      if (lx === tx && ly === ty) continue;
      if (lx < 0 || lx >= level.w || ly < 0 || ly >= level.h) continue;
      push(lx, ly);
    }
  }
  return { reached, key, cells: reached.size };
}
