/**
 * Cipós de balançar (fase 2): pêndulos presos no alto. Sozinhos balançam de leve com o vento; com
 * o Karimbo pendurado, o ângulo é o do balanço dele (a física fica em `Player.updateSwing`).
 */
import type { VineSpawn } from './level';

export class Vine {
  spawn: VineSpawn;
  x: number;
  y: number;
  len: number;
  /** ângulo (rad, 0 = pendurado reto; + = ponta para a direita) */
  a = 0;
  av = 0;
  held = false;
  /** brilho de "pegue aqui" quando o Karimbo chega perto */
  hint = 0;

  constructor(s: VineSpawn) {
    this.spawn = s;
    this.x = s.x;
    this.y = s.y;
    this.len = s.len;
    this.a = Math.sin(s.id * 1.7) * 0.12;
  }

  /** Ponta (ou um ponto a `d` px do topo). */
  point(d = this.len): [number, number] {
    return [this.x + Math.sin(this.a) * d, this.y + Math.cos(this.a) * d];
  }

  update(dt: number, t: number) {
    if (this.held) return;
    // pêndulo amortecido + brisa
    const g = 1780 * 0.9;
    this.av += (-(g / this.len) * Math.sin(this.a) + Math.sin(t * 0.7 + this.spawn.id) * 0.25) * dt;
    this.av *= 1 - Math.min(1, dt * 0.9);
    this.a += this.av * dt;
  }

  /**
   * Distância do ponto (px,py) até o cipó e a que distância do topo fica o ponto mais próximo.
   */
  nearest(px: number, py: number): { dist: number; d: number } {
    const sx = Math.sin(this.a);
    const cy = Math.cos(this.a);
    const rx = px - this.x;
    const ry = py - this.y;
    let d = rx * sx + ry * cy;
    d = Math.max(0, Math.min(this.len, d));
    const qx = this.x + sx * d;
    const qy = this.y + cy * d;
    return { dist: Math.hypot(px - qx, py - qy), d };
  }
}
