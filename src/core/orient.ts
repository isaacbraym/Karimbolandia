/**
 * Celular em retrato: o jogo já abre "deitado" — o container gira 90° via CSS e o jogador só
 * precisa virar o aparelho. Toda a lógica de toque trabalha em coordenadas LOCAIS do jogo.
 */
export const orient = { rot: false };

/** Coordenadas de cliente (tela) → coordenadas locais do jogo (considera a rotação de 90° horária). */
export function toLocal(cx: number, cy: number): { x: number; y: number } {
  if (!orient.rot) return { x: cx, y: cy };
  return { x: cy, y: window.innerWidth - cx };
}

/** Retângulo (em coordenadas locais) de um elemento. */
export function localRect(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const a = toLocal(r.left, r.top);
  const b = toLocal(r.right, r.bottom);
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x, b.x);
  const bottom = Math.max(a.y, b.y);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}
