import { Level, T, TILE } from './level';
import type { Rect } from '../core/math';

/** Corpo AABB centrado em (x,y). */
export interface Body {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  wallDir: number; // -1/0/1: colidiu lateralmente no último move
  hitCeil: boolean;
  dropTimer: number; // >0: atravessa one-way por cima
  onOneWay: boolean;
}

export const newBody = (w: number, h: number): Body => ({
  x: 0, y: 0, w, h, vx: 0, vy: 0, onGround: false, wallDir: 0, hitCeil: false, dropTimer: 0, onOneWay: false,
});

const EPS = 0.001;

/**
 * Move o corpo com colisão eixo-a-eixo contra tiles sólidos, plataformas one-way e
 * retângulos sólidos extras (props). Subdivide passos longos para evitar tunneling.
 */
export function moveBody(b: Body, dt: number, level: Level, solids: readonly Rect[] | null = null, useOneWay = true) {
  const maxStep = TILE * 0.45;
  const dx = b.vx * dt;
  const dy = b.vy * dt;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / maxStep));
  b.wallDir = 0;
  b.hitCeil = false;
  const wasGround = b.onGround;
  b.onGround = false;
  b.onOneWay = false;
  if (b.dropTimer > 0) b.dropTimer -= dt;
  for (let i = 0; i < n; i++) {
    stepX(b, dx / n, level, solids);
    stepY(b, dy / n, level, solids, useOneWay);
  }
  // gruda no chão em descidas pequenas (evita perder onGround em frames intermediários)
  if (!b.onGround && wasGround && b.vy >= 0 && b.vy < 40) {
    // nada: mantém física simples
  }
}

function stepX(b: Body, dx: number, level: Level, solids: readonly Rect[] | null) {
  if (dx === 0) return;
  let nx = b.x + dx;
  const top = b.y - b.h / 2 + EPS;
  const bot = b.y + b.h / 2 - EPS;
  const half = b.w / 2;
  const edge = dx > 0 ? nx + half : nx - half;
  const tx = Math.floor(edge / TILE);
  const ty0 = Math.floor(top / TILE);
  const ty1 = Math.floor(bot / TILE);
  let hit = false;
  for (let ty = ty0; ty <= ty1; ty++) {
    if (level.get(tx, ty) === T.SOLID) {
      hit = true;
      break;
    }
  }
  if (hit) {
    nx = dx > 0 ? tx * TILE - half - EPS : (tx + 1) * TILE + half + EPS;
    b.vx = 0;
    b.wallDir = dx > 0 ? 1 : -1;
  }
  if (solids) {
    for (const s of solids) {
      if (b.y + b.h / 2 - EPS > s.y && b.y - b.h / 2 + EPS < s.y + s.h && nx + half > s.x && nx - half < s.x + s.w) {
        if (dx > 0 && b.x + half <= s.x + 1) {
          nx = s.x - half - EPS;
          b.vx = 0;
          b.wallDir = 1;
        } else if (dx < 0 && b.x - half >= s.x + s.w - 1) {
          nx = s.x + s.w + half + EPS;
          b.vx = 0;
          b.wallDir = -1;
        }
      }
    }
  }
  b.x = nx;
}

function stepY(b: Body, dy: number, level: Level, solids: readonly Rect[] | null, useOneWay: boolean) {
  if (dy === 0) {
    // ainda checa chão sob os pés para manter onGround estável
    checkGround(b, level, solids, useOneWay);
    return;
  }
  const half = b.w / 2;
  const left = b.x - half + EPS;
  const right = b.x + half - EPS;
  const tx0 = Math.floor(left / TILE);
  const tx1 = Math.floor(right / TILE);
  let ny = b.y + dy;
  if (dy > 0) {
    const prevBottom = b.y + b.h / 2;
    const bottom = ny + b.h / 2;
    const ty = Math.floor(bottom / TILE);
    let landY: number | null = null;
    let oneWay = false;
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = level.get(tx, ty);
      if (t === T.SOLID) {
        landY = ty * TILE;
        oneWay = false;
        break;
      }
      if (t === T.ONEWAY && useOneWay && b.dropTimer <= 0 && prevBottom <= ty * TILE + 1.5) {
        landY = ty * TILE;
        oneWay = true;
      }
    }
    if (solids) {
      for (const s of solids) {
        if (right > s.x && left < s.x + s.w && prevBottom <= s.y + 1.5 && bottom >= s.y) {
          if (landY === null || s.y < landY) {
            landY = s.y;
            oneWay = false;
          }
        }
      }
    }
    if (landY !== null) {
      ny = landY - b.h / 2 - EPS;
      b.vy = 0;
      b.onGround = true;
      b.onOneWay = oneWay;
    }
  } else {
    const top = ny - b.h / 2;
    const ty = Math.floor(top / TILE);
    let hit = false;
    for (let tx = tx0; tx <= tx1; tx++) {
      if (level.get(tx, ty) === T.SOLID) {
        hit = true;
        break;
      }
    }
    let ceilY = hit ? (ty + 1) * TILE : null;
    if (solids) {
      for (const s of solids) {
        const sb = s.y + s.h;
        if (right > s.x && left < s.x + s.w && b.y - b.h / 2 >= sb - 1.5 && top <= sb) {
          if (ceilY === null || sb > ceilY) ceilY = sb;
        }
      }
    }
    if (ceilY !== null) {
      ny = ceilY + b.h / 2 + EPS;
      b.vy = 0;
      b.hitCeil = true;
    }
  }
  b.y = ny;
  if (!b.onGround) checkGround(b, level, solids, useOneWay);
}

function checkGround(b: Body, level: Level, solids: readonly Rect[] | null, useOneWay: boolean) {
  if (b.vy < 0) return;
  const half = b.w / 2;
  const bottom = b.y + b.h / 2 + 0.6;
  const ty = Math.floor(bottom / TILE);
  const tx0 = Math.floor((b.x - half + EPS) / TILE);
  const tx1 = Math.floor((b.x + half - EPS) / TILE);
  for (let tx = tx0; tx <= tx1; tx++) {
    const t = level.get(tx, ty);
    if (t === T.SOLID && bottom >= ty * TILE) {
      b.onGround = true;
      return;
    }
    if (t === T.ONEWAY && useOneWay && b.dropTimer <= 0 && b.y + b.h / 2 <= ty * TILE + 1.5 && bottom >= ty * TILE) {
      b.onGround = true;
      b.onOneWay = true;
      return;
    }
  }
  if (solids) {
    for (const s of solids) {
      if (b.x + half - EPS > s.x && b.x - half + EPS < s.x + s.w && b.y + b.h / 2 <= s.y + 1.5 && bottom >= s.y) {
        b.onGround = true;
        return;
      }
    }
  }
}

/** Há chão (sólido/one-way) logo abaixo do ponto? Útil para IA (bordas). */
export function groundAt(level: Level, x: number, feetY: number, depth = 2): boolean {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor((feetY + 1) / TILE);
  for (let i = 0; i < depth; i++) {
    const t = level.get(tx, ty + i);
    if (t === T.SOLID || t === T.ONEWAY) return true;
  }
  return false;
}

export function hazardAt(level: Level, x: number, y: number) {
  return level.get(Math.floor(x / TILE), Math.floor(y / TILE)) === T.HAZARD;
}
