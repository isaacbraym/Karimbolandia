/**
 * Geometria isométrica 2:1. gx cresce para a direita-baixo da tela e gy para a esquerda-baixo.
 * Funções puras: o simulador e o desenho usam as mesmas.
 */
export const TILE_W = 56;
export const TILE_H = 28;

export interface Pt { x: number; y: number }

export function gridToScreen(gx: number, gy: number, out: Pt = { x: 0, y: 0 }): Pt {
  out.x = (gx - gy) * TILE_W / 2;
  out.y = (gx + gy) * TILE_H / 2;
  return out;
}

export function screenToGrid(x: number, y: number, out: { gx: number; gy: number } = { gx: 0, gy: 0 }) {
  out.gx = x / TILE_W + y / TILE_H;
  out.gy = y / TILE_H - x / TILE_W;
  return out;
}

/** Quanto maior, mais à frente é desenhado. `h` desempata alturas na mesma pegada. */
export const depthKey = (gx: number, gy: number, h = 0) => gx + gy + h * 0.001;

/**
 * Direção de tela (direita/baixo positivos) → direção de chão unitária.
 * ↑ = (−1,−1), → = (+1,−1), ↓ = (+1,+1), ← = (−1,+1). Velocidade de chão constante em qualquer direção.
 */
export function screenDirToGrid(mx: number, my: number, out: Pt = { x: 0, y: 0 }): Pt {
  const gx = mx + my, gy = my - mx, len = Math.hypot(gx, gy);
  out.x = len > 1e-6 ? gx / len : 0;
  out.y = len > 1e-6 ? gy / len : 0;
  return out;
}

/** Lado da tela para onde um deslocamento de chão aponta (para o espelhamento do personagem). */
export const screenSide = (dgx: number, dgy: number): 1 | -1 => (dgx - dgy >= 0 ? 1 : -1);
