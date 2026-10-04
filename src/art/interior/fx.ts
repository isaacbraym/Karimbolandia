/**
 * Efeitos do interior (partículas, anéis de ruído, onomatopeias). Pool de tamanho fixo: nada é
 * alocado por quadro. Coordenadas de chão (grade) + altura z em px; o renderer projeta.
 */
import type { FxKind } from '../../game/interior/types';

const MAX = 220;
const K = { crash: 0, crumbs: 1, feathers: 2, dust: 3, splash: 4, sparkle: 5, heart: 6, zzz: 7, coins: 8, steam: 9, poof: 10 } as const;
const KIND_IDS: Record<FxKind, number> = K;

export class Particles {
  private n = 0;
  readonly gx = new Float32Array(MAX); readonly gy = new Float32Array(MAX); readonly z = new Float32Array(MAX);
  readonly vx = new Float32Array(MAX); readonly vy = new Float32Array(MAX); readonly vz = new Float32Array(MAX);
  readonly life = new Float32Array(MAX); readonly max = new Float32Array(MAX); readonly size = new Float32Array(MAX);
  readonly kind = new Uint8Array(MAX); readonly col = new Uint8Array(MAX); readonly rot = new Float32Array(MAX);
  /** reduz a quantidade em qualidades menores */
  density = 1;

  get count() { return this.n; }

  private add(kind: number, gx: number, gy: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, col: number) {
    if (this.n >= MAX) return;
    const i = this.n++;
    this.kind[i] = kind; this.gx[i] = gx; this.gy[i] = gy; this.z[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = this.max[i] = life; this.size[i] = size; this.col[i] = col; this.rot[i] = Math.random() * 6.28;
  }

  burst(kind: FxKind, gx: number, gy: number, n = 1, z = 18) {
    const id = KIND_IDS[kind], r = Math.random;
    const c = Math.max(1, Math.round(n * this.density));
    for (let i = 0; i < c; i++) {
      switch (kind) {
        case 'crash': this.add(id, gx, gy, z, (r() - 0.5) * 3.2, (r() - 0.5) * 3.2, 40 + r() * 80, 0.9 + r() * 0.5, 1.5 + r() * 2.4, i % 4); break;
        case 'crumbs': this.add(id, gx, gy, z + 6, (r() - 0.5) * 1.4, (r() - 0.5) * 1.4, 18 + r() * 40, 0.6 + r() * 0.4, 1 + r() * 1.2, i % 3); break;
        case 'feathers': this.add(id, gx, gy, z, (r() - 0.5) * 2.4, (r() - 0.5) * 2.4, 30 + r() * 40, 1.4 + r() * 0.8, 2.4 + r() * 1.6, i % 3); break;
        case 'dust': this.add(id, gx + (r() - 0.5) * 0.6, gy + (r() - 0.5) * 0.6, 2, (r() - 0.5) * 0.8, (r() - 0.5) * 0.8, 8 + r() * 12, 0.7 + r() * 0.5, 3 + r() * 3, 0); break;
        case 'splash': this.add(id, gx, gy, 4, (r() - 0.5) * 2, (r() - 0.5) * 2, 30 + r() * 50, 0.7 + r() * 0.3, 1.4 + r() * 1.4, 0); break;
        case 'sparkle': this.add(id, gx + (r() - 0.5) * 0.8, gy + (r() - 0.5) * 0.8, z + r() * 14, 0, 0, 12 + r() * 14, 0.8 + r() * 0.4, 2 + r() * 2, i % 2); break;
        case 'heart': this.add(id, gx, gy, z + 10, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4, 20 + r() * 10, 1.4, 4 + r() * 2, 0); break;
        case 'zzz': this.add(id, gx, gy, z, 0.15, -0.15, 9, 2.2, 5, 0); break;
        case 'coins': this.add(id, gx, gy, z, (r() - 0.5) * 2.4, (r() - 0.5) * 2.4, 60 + r() * 50, 1.1, 3, 0); break;
        case 'steam': this.add(id, gx, gy, z, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3, 14 + r() * 8, 1.5 + r() * 0.8, 3 + r() * 2, 0); break;
        case 'poof': this.add(id, gx, gy, z, (r() - 0.5) * 1.6, (r() - 0.5) * 1.6, 6 + r() * 16, 0.6 + r() * 0.3, 4 + r() * 4, 0); break;
      }
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.remove(i--); continue; }
      const k = this.kind[i];
      this.gx[i] += this.vx[i] * dt; this.gy[i] += this.vy[i] * dt; this.z[i] += this.vz[i] * dt;
      if (k === K.crash || k === K.crumbs || k === K.coins || k === K.splash) {
        this.vz[i] -= 230 * dt;
        if (this.z[i] < 0) { this.z[i] = 0; this.vz[i] *= -0.35; this.vx[i] *= 0.6; this.vy[i] *= 0.6; }
      } else if (k === K.feathers) {
        this.vz[i] -= 26 * dt; this.vz[i] = Math.max(this.vz[i], -14);
        this.vx[i] += Math.sin(this.life[i] * 7 + i) * 0.8 * dt;
        if (this.z[i] < 0) { this.z[i] = 0; this.vz[i] = 0; this.vx[i] *= 0.2; this.vy[i] *= 0.2; }
      } else if (k === K.dust || k === K.steam || k === K.zzz || k === K.heart || k === K.poof) this.vz[i] *= 0.97;
      this.rot[i] += dt * (k === K.feathers ? 3 : 6);
    }
  }

  private remove(i: number) {
    const l = --this.n;
    if (i === l) return;
    for (const a of [this.gx, this.gy, this.z, this.vx, this.vy, this.vz, this.life, this.max, this.size, this.rot] as Float32Array[]) a[i] = a[l];
    this.kind[i] = this.kind[l]; this.col[i] = this.col[l];
  }

  clear() { this.n = 0; }

  /** `proj(gx,gy,z)` devolve a posição de tela em `out`. */
  draw(g: CanvasRenderingContext2D, proj: (gx: number, gy: number, z: number, out: [number, number]) => void, scale: number, palette: { crash: string[]; crumbs: string[]; feathers: string[] }) {
    const p: [number, number] = [0, 0];
    for (let i = 0; i < this.n; i++) {
      const t = this.life[i] / this.max[i], k = this.kind[i], s = this.size[i] * scale;
      proj(this.gx[i], this.gy[i], this.z[i], p);
      switch (k) {
        case K.crash: case K.crumbs: {
          g.globalAlpha = Math.min(1, t * 2);
          g.fillStyle = (k === K.crash ? palette.crash : palette.crumbs)[this.col[i] % (k === K.crash ? palette.crash.length : palette.crumbs.length)];
          g.save(); g.translate(p[0], p[1]); g.rotate(this.rot[i]);
          if (k === K.crash) { g.beginPath(); g.moveTo(-s, -s * 0.4); g.lineTo(s, -s * 0.2); g.lineTo(s * 0.2, s); g.closePath(); g.fill(); } else g.fillRect(-s * 0.5, -s * 0.5, s, s);
          g.restore(); break;
        }
        case K.feathers: {
          g.globalAlpha = Math.min(1, t * 1.6);
          g.fillStyle = palette.feathers[this.col[i] % palette.feathers.length];
          g.save(); g.translate(p[0], p[1]); g.rotate(Math.sin(this.rot[i]) * 1.2);
          g.beginPath(); g.ellipse(0, 0, s, s * 0.38, 0, 0, Math.PI * 2); g.fill(); g.restore(); break;
        }
        case K.dust: case K.steam: case K.poof: {
          const a = (k === K.steam ? 0.26 : k === K.poof ? 0.5 : 0.16) * Math.min(1, t * 1.5);
          g.globalAlpha = a; g.fillStyle = k === K.steam ? '#f4f0e4' : '#e8d9b8';
          g.beginPath(); g.arc(p[0], p[1], s * (1.3 - t * 0.5 + (k === K.steam ? (1 - t) * 1.4 : 0)), 0, Math.PI * 2); g.fill(); break;
        }
        case K.splash: { g.globalAlpha = Math.min(1, t * 2); g.fillStyle = '#bfe8ee'; g.beginPath(); g.arc(p[0], p[1], s, 0, Math.PI * 2); g.fill(); break; }
        case K.sparkle: {
          g.globalAlpha = Math.min(1, t * 2.4) * (0.6 + 0.4 * Math.sin(this.rot[i] * 3));
          g.fillStyle = this.col[i] ? '#fff2a8' : '#ffffff';
          g.beginPath(); g.moveTo(p[0], p[1] - s * 1.6); g.lineTo(p[0] + s * 0.4, p[1] - s * 0.4); g.lineTo(p[0] + s * 1.6, p[1]);
          g.lineTo(p[0] + s * 0.4, p[1] + s * 0.4); g.lineTo(p[0], p[1] + s * 1.6); g.lineTo(p[0] - s * 0.4, p[1] + s * 0.4);
          g.lineTo(p[0] - s * 1.6, p[1]); g.lineTo(p[0] - s * 0.4, p[1] - s * 0.4); g.closePath(); g.fill(); break;
        }
        case K.heart: {
          g.globalAlpha = Math.min(1, t * 1.6); g.fillStyle = '#ff5f86';
          g.save(); g.translate(p[0], p[1]); g.scale(s / 6, s / 6);
          g.beginPath(); g.moveTo(0, 3); g.bezierCurveTo(-8, -2, -4, -8, 0, -3); g.bezierCurveTo(4, -8, 8, -2, 0, 3); g.fill(); g.restore(); break;
        }
        case K.zzz: {
          g.globalAlpha = Math.min(1, t * 1.4); g.fillStyle = '#e8f2ff'; g.strokeStyle = '#1b2a3c'; g.lineWidth = 1.2;
          g.font = `bold ${Math.round(8 + (1 - t) * 6)}px sans-serif`; g.textAlign = 'center';
          g.strokeText('Z', p[0], p[1]); g.fillText('Z', p[0], p[1]); break;
        }
        case K.coins: {
          g.globalAlpha = Math.min(1, t * 2); g.fillStyle = '#ffd95a'; g.strokeStyle = '#6a4a10'; g.lineWidth = 0.8;
          g.beginPath(); g.ellipse(p[0], p[1], s, s * Math.abs(Math.cos(this.rot[i])) + 0.4, 0, 0, Math.PI * 2); g.fill(); g.stroke(); break;
        }
      }
    }
    g.globalAlpha = 1;
  }
}

export const FX_PALETTE = {
  crash: ['#7fb7a0', '#a8d8c0', '#d8e8e0', '#587a6c'],
  crumbs: ['#f2d48a', '#d9a65a', '#fff0c0'],
  feathers: ['#f4eadc', '#d8a15a', '#b0602c'],
};

/** Onomatopeia em balão de quadrinho que pula e some. */
export interface Pop { text: string; sx: number; sy: number; t: number; color: string; size: number }
export const POP_LIFE = 1.0;
export function drawPop(g: CanvasRenderingContext2D, p: Pop) {
  const k = p.t / POP_LIFE;
  const pop = k < 0.18 ? 0.5 + (k / 0.18) * 0.75 : k < 0.3 ? 1.25 - ((k - 0.18) / 0.12) * 0.25 : 1;
  const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
  g.save();
  g.globalAlpha = a;
  g.translate(p.sx, p.sy - k * 22);
  g.rotate(-0.12 + Math.sin(k * 9) * 0.03);
  g.scale(pop, pop);
  g.font = `bold ${p.size}px "Lilita One", "Arial Black", sans-serif`;
  g.textAlign = 'center';
  g.lineJoin = 'round';
  g.lineWidth = 4.2;
  g.strokeStyle = '#170f2e';
  g.strokeText(p.text, 0, 0);
  g.fillStyle = p.color;
  g.fillText(p.text, 0, 0);
  g.restore();
}
