import { getJungle } from './jungle';
import { Rng } from '../core/math';
import { prism } from './volume';

export const ATLANTIS_BOUNDS: Record<string, [number, number, number, number]> = {
  aThinker: [-92, -250, 96, 5],
  aMoss: [-98, -12, 100, 34],
};

/** Static stone and vegetation: baked once by the decoration cache. */
export function paintAtlantis(g: CanvasRenderingContext2D, kind: string, seed: number) {
  if (kind === 'aThinker') {
    const statue = getJungle()?.thinker;
    prism(g, -85, -24, 170, 24, 10, -7, '#6a827b');
    g.fillStyle = '#afbeb0';
    g.fillRect(-70, -20, 140, 3);
    if (statue) {
      g.imageSmoothingQuality = 'high';
      g.drawImage(statue, -80, -250, 160, 226);
    }
    moss(g, seed, -83, -25, 166, 13);
    return true;
  }
  if (kind === 'aMoss') { moss(g, seed, -94, -6, 188, 28); return true; }
  return false;
}

function moss(g: CanvasRenderingContext2D, seed: number, x: number, y: number, width: number, drop: number) {
  const r = new Rng(seed + 731);
  for (let i = 0; i < 36; i++) {
    const px = r.range(x, x + width - 8), py = y + r.range(-3, 3);
    g.fillStyle = r.pick(['#335b46', '#467456', '#69905e', '#789b6a']);
    g.beginPath(); g.ellipse(px, py, r.range(3, 8), r.range(1, 3), 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8ba978'; g.fillRect(px - 1, py - 1, 1, 1);
    if (i % 3 === 0) {
      g.strokeStyle = '#416c50'; g.lineWidth = r.range(1, 3);
      g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px - 5, py + drop / 2, px + 2, py + r.range(5, drop)); g.stroke();
    }
  }
}
