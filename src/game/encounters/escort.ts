import { clamp } from '../../core/math';
import type { TrailPoint } from './challenge';

export interface EscortDefinition {
  id: string; title: string; start: TrailPoint; destination: TrailPoint; coins: number;
}
export interface EscortPlayer { x: number; feetY: number; grounded: boolean; speed: number }
export const ESCORT = { REPAIRED: 1, LOST: 2, COMPLETE: 4 } as const;
export const REPAIR_TIME = 1.5;
export const FLIGHT_HEIGHT = 84;

/** Reparo contínuo e escolta física; nenhum estado de prêmio/persistência aqui. */
export class DroneEscort {
  status: 'ready' | 'escort' | 'complete' = 'ready';
  repair = 0;
  handoff = 0;
  departure = 0;
  readonly drone: TrailPoint;
  private retry = 0;
  constructor(readonly def: EscortDefinition) { this.drone = { x: def.start.x, y: def.start.y - 24 }; }
  reset(done = false) {
    this.status = done ? 'complete' : 'ready';
    this.repair = this.handoff = this.retry = 0;
    this.departure = done ? 3 : 0;
    this.drone.x = this.def.start.x; this.drone.y = this.def.start.y - 24;
  }
  suspend() { this.repair = this.handoff = 0; }
  update(dt: number, p: EscortPlayer): number {
    const step = clamp(dt, 0, .1), { start, destination } = this.def;
    if (this.status === 'complete') {
      // Fade at the delivery point: a vertical fly-away would cut through the ceiling.
      if (this.departure < 3) this.departure = Math.min(3,this.departure + step);
      return 0;
    }
    if (this.status === 'ready') {
      this.retry = Math.max(0, this.retry - step);
      const close = Math.hypot(p.x - start.x, p.feetY - start.y) < 48;
      if (!this.retry && close && p.grounded && Math.abs(p.speed) < 30) this.repair += step;
      else this.repair = 0;
      if (this.repair + 1e-6 < REPAIR_TIME) return 0;
      this.status = 'escort'; this.repair = REPAIR_TIME;
      return ESCORT.REPAIRED;
    }
    if (Math.hypot(p.x - this.drone.x, p.feetY - this.drone.y - FLIGHT_HEIGHT) > 300) {
      this.reset(); this.retry = 2;
      return ESCORT.LOST;
    }
    // Um corredor autorado mantém o drone fora de paredes e acima dos objetos do percurso.
    const tx = clamp(p.x - 40, start.x, destination.x);
    const t = (tx - start.x) / (destination.x - start.x);
    const ty = start.y + (destination.y - start.y) * t - FLIGHT_HEIGHT;
    const dx = tx - this.drone.x, dy = ty - this.drone.y, distance = Math.hypot(dx, dy);
    const move = Math.min(distance, 210 * step);
    if (distance) { this.drone.x += dx / distance * move; this.drone.y += dy / distance * move; }
    const arrived = p.grounded && Math.hypot(p.x - destination.x, p.feetY - destination.y) < 56
      && Math.hypot(this.drone.x - destination.x, this.drone.y - destination.y + FLIGHT_HEIGHT) < 55;
    this.handoff = arrived ? this.handoff + step : 0;
    if (this.handoff + 1e-6 < .7) return 0;
    this.status = 'complete'; this.departure = 0;
    return ESCORT.COMPLETE;
  }
}
