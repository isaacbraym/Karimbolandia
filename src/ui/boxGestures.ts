/**
 * Reconhecedor dos gestos do boxe no celular (puro, sem DOM: testado em Node). A tela se divide em duas
 * metades — esquerda = mão esquerda, direita = mão direita — e cada dedo é dono do seu gesto:
 *   toque curto            → reto (jab na esquerda, direto na direita), disparado ao soltar
 *   deslizar para o lado   → cruzado
 *   deslizar para cima     → gancho (a diagonal a partir de 35° já vale)
 *   deslizar para baixo    → abaixar
 *   dois dedos parados, um em cada metade, por 150 ms → guarda (segura enquanto durar)
 * Cada dedo dispara no máximo uma vez: o deslize não vira também um toque ao soltar.
 */
export type GestureOut = 'jab' | 'direto' | 'cruzE' | 'cruzD' | 'ganchoE' | 'ganchoD' | 'abaixar';

/** deslocamento (px de tela) a partir do qual o movimento vira um deslize */
export const SWIPE_MIN = 28;
/** um toque dura no máximo isto (ms) e se mexe no máximo TAP_MAX_MOVE px */
export const TAP_MAX_MS = 260;
export const TAP_MAX_MOVE = 16;
/** guarda: dois dedos parados por tanto tempo (ms), mexendo menos de GUARD_MAX_MOVE px */
export const GUARD_HOLD_MS = 150;
export const GUARD_MAX_MOVE = 14;

/** Direção do deslize → golpe daquele lado. `dx`/`dy` em px (y cresce para baixo). */
export function classifySwipe(side: -1 | 1, dx: number, dy: number): GestureOut {
  const d = Math.hypot(dx, dy) || 1;
  if (-dy >= 0.57 * d) return side < 0 ? 'ganchoE' : 'ganchoD'; // ≥ 35° para cima
  if (dy >= 0.57 * d) return 'abaixar';
  return side < 0 ? 'cruzE' : 'cruzD';
}

interface Ptr { id: number; side: -1 | 1; x0: number; y0: number; t0: number; travel: number; fired: boolean }

export class BoxGestures {
  private ptrs: Ptr[] = [];
  /** a guarda está ativa neste instante */
  guarding = false;

  down(id: number, side: -1 | 1, x: number, y: number, t: number) {
    if (this.ptrs.some((p) => p.id === id)) return;
    this.ptrs.push({ id, side, x0: x, y0: y, t0: t, travel: 0, fired: false });
  }

  /** Movimento: dispara o deslize assim que passa de SWIPE_MIN. */
  move(id: number, x: number, y: number, _t: number): GestureOut | null {
    const p = this.ptrs.find((q) => q.id === id);
    if (!p) return null;
    const dx = x - p.x0, dy = y - p.y0;
    p.travel = Math.max(p.travel, Math.hypot(dx, dy));
    if (p.fired || p.travel < SWIPE_MIN) return null;
    p.fired = true;
    return classifySwipe(p.side, dx, dy);
  }

  /** Soltou: um toque curto e parado vira reto; deslize, guarda ou toque longo não. */
  up(id: number, t: number): GestureOut | null {
    const i = this.ptrs.findIndex((q) => q.id === id);
    if (i < 0) return null;
    const p = this.ptrs[i];
    this.ptrs.splice(i, 1);
    this.refreshGuard();
    if (p.fired) return null;
    if (p.travel <= TAP_MAX_MOVE && t - p.t0 <= TAP_MAX_MS) return p.side < 0 ? 'jab' : 'direto';
    return null;
  }

  /** O sistema levou o toque embora (pointercancel/perda de captura): nada dispara. */
  cancel(id: number) {
    const i = this.ptrs.findIndex((q) => q.id === id);
    if (i >= 0) this.ptrs.splice(i, 1);
    this.refreshGuard();
  }

  /** Chamar com o relógio (ms) enquanto houver dedo na tela: liga a guarda quando os dois polegares seguram. */
  updateGuard(t: number): boolean {
    if (!this.guarding) {
      const l = this.ptrs.find((p) => p.side < 0 && !p.fired && p.travel < GUARD_MAX_MOVE);
      const r = this.ptrs.find((p) => p.side > 0 && !p.fired && p.travel < GUARD_MAX_MOVE);
      if (l && r && t - Math.max(l.t0, r.t0) >= GUARD_HOLD_MS) {
        this.guarding = true;
        l.fired = true; r.fired = true; // soltar depois não é um toque
      }
    }
    return this.guarding;
  }

  private refreshGuard() {
    if (!this.guarding) return;
    const l = this.ptrs.some((p) => p.side < 0 && p.fired), r = this.ptrs.some((p) => p.side > 0 && p.fired);
    if (!(l && r)) this.guarding = false;
  }

  get active() { return this.ptrs.length > 0; }

  reset() { this.ptrs.length = 0; this.guarding = false; }
}
