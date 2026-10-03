export interface TrailPoint { x: number; y: number }
export interface TrailDefinition {
  id: string;
  title: string;
  theme: 'delivery' | 'fireflies';
  points: readonly TrailPoint[];
  seconds: number;
  coins: number;
}
export const TRAIL = { START: 1, HIT: 2, COMPLETE: 4, EXPIRED: 8 } as const;
export const RING_RADIUS = 28;

/** First contact along the whole movement, including a dash through a ring. */
export function ringContact(from: TrailPoint, to: TrailPoint, ring: TrailPoint, radius = RING_RADIUS): number | null {
  const dx = to.x - from.x, dy = to.y - from.y;
  const ox = from.x - ring.x, oy = from.y - ring.y;
  const c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = ox * dx + oy * dy, discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : null;
}

/** Pure rules; no World, canvas, persistence, timers or player input dependencies. */
export class TrailChallenge {
  status: 'ready' | 'active' | 'cooldown' | 'complete' = 'ready';
  next = 0;
  left: number;
  readonly guide: TrailPoint;
  private retryT = 0;
  private previous: TrailPoint | null = null;
  constructor(readonly def: TrailDefinition) { this.left = def.seconds; this.guide = { ...def.points[0] }; }
  reset(done = false) {
    this.status = done ? 'complete' : 'ready';
    this.next = done ? this.def.points.length : 0;
    this.left = this.def.seconds;
    this.retryT = 0;
    this.previous = null;
    this.guide.x = this.def.points[0].x; this.guide.y = this.def.points[0].y;
  }
  /** Interrupt movement continuity when respawning, entering a room or a cinematic. */
  suspend() { this.previous = null; }
  animate(dt: number) {
    const target = this.def.points[Math.min(this.next, this.def.points.length - 1)];
    const follow = 1 - Math.exp(-5 * dt);
    this.guide.x += (target.x - this.guide.x) * follow;
    this.guide.y += (target.y - this.guide.y) * follow;
  }
  update(dt: number, x: number, y: number): number {
    if (this.status === 'complete') return 0;
    const to = { x, y }, from = this.previous ?? to;
    this.previous = to;
    if (this.status === 'cooldown') {
      this.retryT = Math.max(0, this.retryT - dt);
      const first = this.def.points[0];
      if (!this.retryT && Math.hypot(x - first.x, y - first.y) > 80) this.reset();
      return 0;
    }
    let flags = 0, startAt = 0;
    const wasActive = this.status === 'active';
    while (this.next < this.def.points.length) {
      const t = ringContact(from, to, this.def.points[this.next]);
      if (t === null || (this.status === 'active' && (wasActive ? t : t - startAt) * dt > this.left)) break;
      if (this.status === 'ready') {
        this.status = 'active';
        startAt = t;
        flags |= TRAIL.START;
      }
      this.next++;
      flags |= TRAIL.HIT;
    }
    if (this.status === 'active') {
      if (this.next === this.def.points.length) {
        this.status = 'complete';
        return flags | TRAIL.COMPLETE;
      }
      this.left = Math.max(0, this.left - dt * (wasActive ? 1 : 1 - startAt));
      if (!this.left) {
        this.status = 'cooldown';
        this.retryT = 2;
        flags |= TRAIL.EXPIRED;
      }
    }
    return flags;
  }
}
