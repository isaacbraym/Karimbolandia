/** Corpo lançado ao morrer (ragdoll simples): voa, gira, cai e some. */
export class Corpse {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot = 0;
  vr: number;
  t = 0;
  life = 1.3;
  draw: (g: CanvasRenderingContext2D, x: number, y: number, rot: number, alpha: number) => void;

  constructor(x: number, y: number, vx: number, vy: number, draw: Corpse['draw']) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.vr = (vx > 0 ? 1 : -1) * (8 + Math.random() * 6);
    this.draw = draw;
  }

  update(dt: number) {
    this.t += dt;
    this.vy += 1500 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.vr * dt;
  }

  get dead() {
    return this.t > this.life;
  }

  render(g: CanvasRenderingContext2D) {
    const a = Math.max(0, Math.min(1, (this.life - this.t) / 0.4));
    g.save();
    g.translate(this.x, this.y);
    g.rotate(this.rot);
    this.draw(g, 0, 0, 0, a);
    g.restore();
  }
}
