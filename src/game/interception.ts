/** Primeiro contato de um segmento com um círculo; inclui projéteis rápidos e início dentro do alvo. */
export function circleEntry(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, radius: number): number | null {
  const ox = ax - cx, oy = ay - cy, c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  const dx = bx - ax, dy = by - ay, a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = ox * dx + oy * dy, disc = b * b - a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / a;
  return t >= 0 && t <= 1 ? t : null;
}
