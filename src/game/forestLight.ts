import { clamp } from '../core/math';
import { TILE, type LevelData } from './level';

export interface CanopyPatch { x: number; y: number; shade: number }
/** Cobertura autorada pelas árvores reais, calculada apenas ao construir a fase. */
export class ForestLight {
  readonly patches: CanopyPatch[] = [];
  readonly rays: CanopyPatch[] = [];
  private readonly step = 128;
  constructor(data: LevelData) {
    if (data.stage !== 2) return;
    const trees = data.decos.filter(d => d.layer === 'back' && !d.par && ['jTree', 'jPalm', 'jMangrove'].includes(d.kind));
    let lastRay = -Infinity;
    for (let x = 150 * TILE; x < data.level.pxW; x += this.step) {
      let cover = 0;
      for (const tree of trees) {
        const radius = (tree.kind === 'jTree' ? 220 : 140) * (tree.scale ?? 1);
        cover += Math.max(0, 1 - Math.abs(tree.x - x) / radius) * (tree.kind === 'jTree' ? .95 : .45);
      }
      const shade = clamp(cover, 0, 1);
      const y = data.level.groundBelow(x, 28 * TILE, 800) ?? 32 * TILE;
      const patch = { x, y, shade }; this.patches.push(patch);
      if (shade < .45 && x - lastRay >= 640) { this.rays.push(patch); lastRay = x; }
    }
  }
  shadeAt(x: number) {
    if (!this.patches.length) return 0;
    const at = clamp((x - this.patches[0].x) / this.step, 0, this.patches.length - 1);
    const i = Math.floor(at), a = this.patches[i], b = this.patches[Math.min(i + 1, this.patches.length - 1)];
    return a.shade + (b.shade - a.shade) * (at - i);
  }
}
