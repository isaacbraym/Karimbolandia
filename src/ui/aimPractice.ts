/** Treino isolado: não conhece World, munição, saves ou DOM. */
export const AIM_ORIGIN = { x: 110, y: 155 };
export const AIM_TARGETS = [{ x: 440, y: 68 }, { x: 415, y: 218 }, { x: 455, y: 145 }] as const;
export class AimPractice {
  angle = 0;
  hits = 0;
  flash = 0;
  private cooldown = 0;
  get target() { return AIM_TARGETS[this.hits % AIM_TARGETS.length]; }
  update(dt: number, aim: { x: number; y: number } | null, fire: boolean, demo = false) {
    dt = Math.max(0, Math.min(.1, dt));
    this.flash = Math.max(0, this.flash - dt); this.cooldown = Math.max(0, this.cooldown - dt);
    if (aim && Math.hypot(aim.x, aim.y) > .32) this.angle = Math.atan2(aim.y, aim.x);
    if (!fire || this.cooldown > 0) return false;
    this.cooldown = .18; this.flash = .12;
    const a = Math.atan2(this.target.y - AIM_ORIGIN.y, this.target.x - AIM_ORIGIN.x);
    const diff = Math.atan2(Math.sin(a - this.angle), Math.cos(a - this.angle));
    if (!demo && Math.abs(diff) < .065) this.hits++;
    return true;
  }
}
