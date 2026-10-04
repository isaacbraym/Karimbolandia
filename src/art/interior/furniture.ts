/**
 * Pintores procedurais dos móveis. Cada pintor desenha no sistema local do móvel:
 * origem no CENTRO da pegada no piso, x para a direita da tela, y para baixo, z (altura) = −y.
 * O desenho base é assado (uma vez por aparência); `live` desenha só o que anima (vapor, luz, brilho).
 */
import { TILE_H as TH, TILE_W as TW } from '../../game/interior/iso';
import type { FurnitureDef } from '../../game/interior/types';
import { shade } from '../../core/math';

export type FurnPaint = (g: CanvasRenderingContext2D, f: FurnitureDef, key: string) => void;
export type FurnLive = (g: CanvasRenderingContext2D, f: FurnitureDef, key: string, t: number) => void;
export interface Painter { base: FurnPaint; live?: FurnLive }

/** Ponto local: (u,v) em tiles a partir do centro da pegada, z em px. */
export const P = (u: number, v: number, z = 0): [number, number] => [(u - v) * TW / 2, (u + v) * TH / 2 - z];

export function poly(g: CanvasRenderingContext2D, pts: [number, number][], fill?: string, stroke?: string, lw = 1) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}

export interface BoxStyle { top: string; left?: string; right?: string; edge?: string }

/** Caixa isométrica: retângulo [u0,u1]×[v0,v1] (tiles, relativo ao centro) de z0 até z1. */
export function box(g: CanvasRenderingContext2D, u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, s: BoxStyle) {
  const edge = s.edge ?? '#170f2e';
  const l = s.left ?? shade(s.top, -0.22), r = s.right ?? shade(s.top, -0.38);
  // face voltada para baixo-esquerda (aresta v1) e para baixo-direita (aresta u1)
  poly(g, [P(u0, v1, z1), P(u1, v1, z1), P(u1, v1, z0), P(u0, v1, z0)], l, edge, 1);
  poly(g, [P(u1, v0, z1), P(u1, v1, z1), P(u1, v1, z0), P(u1, v0, z0)], r, edge, 1);
  poly(g, [P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)], s.top, edge, 1);
}

/** Sombra de contato elíptica sob a pegada. */
export function contactShadow(g: CanvasRenderingContext2D, w: number, h: number, a = 0.28) {
  const rx = (w + h) * TW / 4 * 0.78, ry = (w + h) * TH / 4 * 0.78;
  g.fillStyle = `rgba(8,14,16,${a})`;
  g.beginPath(); g.ellipse(0, 3, rx, ry, 0, 0, Math.PI * 2); g.fill();
}

const PAINTERS = new Map<string, Painter>();
export function registerPainter(paint: string, p: Painter | FurnPaint) { PAINTERS.set(paint, typeof p === 'function' ? { base: p } : p); }
export function painterOf(paint: string): Painter { return PAINTERS.get(paint) ?? FALLBACK; }

const FALLBACK: Painter = {
  base(g, f) {
    contactShadow(g, f.w, f.h);
    const hue = [...f.paint].reduce((a, c) => a + c.charCodeAt(0), 0) % 4;
    box(g, -f.w / 2 + 0.06, f.w / 2 - 0.06, -f.h / 2 + 0.06, f.h / 2 - 0.06, 0, f.height ?? 28, { top: ['#a98458', '#8c9a6a', '#9a7a8a', '#7a93a6'][hue] });
  },
};

/** Altura visual em px usada para o recorte, a transparência e o clique. */
export const heightOf = (f: FurnitureDef) => f.height ?? 30;
