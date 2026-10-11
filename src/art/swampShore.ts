/** Margens visuais em coordenadas do mapa; a linha de contato da física não muda. */
import type { WaterZone } from '../game/level';
import { Rng } from '../core/math';
import { makeCanvas } from './kit';
import { GROUND_DEPTH } from './perspective';

export const SWAMP_DEPTH = { x: GROUND_DEPTH.x, y: 84 } as const;
export const SWAMP_BANK = 22;
const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };

/** Uma enseada arredondada em cada ponta, com a margem distante ondulando pelo mundo. */
export function swampRearDepth(z: WaterZone, x: number) {
  const edge = Math.min(x - z.x, z.x + z.w - x);
  return smooth(edge / Math.min(90, z.w / 3))
    * (70 + Math.sin(x * .021) * 9 + Math.sin(x * .047 + .8) * 5);
}

export function swampRearPoint(z: WaterZone, x: number) {
  const depth = swampRearDepth(z, x);
  return { x: x + SWAMP_DEPTH.x * depth / SWAMP_DEPTH.y, y: z.y - depth };
}

export function swampSurfaceContains(z: WaterZone, x: number, y: number, inset = 0) {
  const depth = z.y - y, localX = x - SWAMP_DEPTH.x * depth / SWAMP_DEPTH.y;
  return depth >= 0 && localX >= z.x + inset && localX <= z.x + z.w - inset
    && depth <= swampRearDepth(z, localX) - inset;
}

interface ShoreArt { back: HTMLCanvasElement; front: HTMLCanvasElement; top: number; width: number }
const cache = new WeakMap<WaterZone, ShoreArt>();

/** Solo molhado, água e reflexos são assados uma vez por zona, com bordas macias. */
export function swampShoreArt(z: WaterZone): ShoreArt {
  const hit = cache.get(z); if (hit) return hit;
  const top = SWAMP_DEPTH.y + SWAMP_BANK, width = z.w + SWAMP_DEPTH.x + SWAMP_BANK * 2;
  const back = makeCanvas(Math.ceil(width * 1.5), top * 1.5);
  const g = back.getContext('2d')!; g.scale(1.5, 1.5); g.translate(SWAMP_BANK - z.x, top - z.y);
  const water = new Path2D(), bank = new Path2D();
  water.moveTo(z.x, z.y); water.lineTo(z.x + z.w, z.y);
  for (let x = z.x + z.w; x >= z.x; x -= 4) {
    const p = swampRearPoint(z, x); water.lineTo(p.x, p.y);
    if (x === z.x + z.w) bank.moveTo(p.x, p.y); else bank.lineTo(p.x, p.y);
  }
  water.lineTo(z.x, z.y); water.closePath();
  // A água usa verdes do brejo, sem a rede branca de cáusticas do lago transparente.
  const tone = g.createLinearGradient(0, z.y - SWAMP_DEPTH.y, 0, z.y);
  tone.addColorStop(0, '#3c5b49'); tone.addColorStop(.55, '#456952'); tone.addColorStop(1, '#536c47');
  g.fillStyle = tone; g.fill(water);
  g.save(); g.clip(water);
  const r = new Rng(z.id * 7919 + 317);
  for (let i = 0; i < z.w / 5; i++) {
    const x = z.x + r.range(8, z.w - 8), depth = r.range(5, SWAMP_DEPTH.y);
    g.strokeStyle = i % 3 ? 'rgba(145,170,113,.17)' : 'rgba(24,53,42,.23)'; g.lineWidth = r.range(.6, 1.4);
    g.beginPath(); g.ellipse(x, z.y - depth, r.range(4, 24), r.range(.5, 2), 0, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
  // A faixa de terra úmida cobre a borda geométrica e se dissolve no mesmo solo de baixo.
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [width, alpha] of [[36, .07], [24, .12], [14, .23], [6, .48]]) {
    g.lineWidth = width; g.strokeStyle = `rgba(65,78,46,${alpha})`; g.stroke(bank);
  }
  // Pequenas raízes acompanham a curva, sem erguer uma muralha de juncos na entrada.
  for (let x = z.x + 22; x < z.x + z.w - 22; x += r.range(28, 60)) {
    const p = swampRearPoint(z, x);
    g.strokeStyle = 'rgba(105,122,64,.65)'; g.lineWidth = 1.6; g.beginPath();
    g.moveTo(p.x - 7, p.y - 3); g.quadraticCurveTo(p.x, p.y - 2, p.x + 8, p.y + 5); g.stroke();
  }
  const front = makeCanvas(Math.ceil(z.w * 1.5), (z.h + SWAMP_BANK) * 1.5);
  const f = front.getContext('2d')!; f.scale(1.5, 1.5);
  const body = f.createLinearGradient(0, 0, 0, z.h + SWAMP_BANK);
  body.addColorStop(0, 'rgba(83,108,71,.86)'); body.addColorStop(.35, 'rgba(38,62,40,.94)');
  body.addColorStop(z.h / (z.h + SWAMP_BANK), 'rgba(43,64,40,.72)'); body.addColorStop(1, 'rgba(43,64,40,0)');
  f.fillStyle = body; f.fillRect(0, 0, z.w, z.h + SWAMP_BANK);
  f.globalCompositeOperation = 'destination-in';
  const sides = f.createLinearGradient(0, 0, z.w, 0), fade = Math.min(18, z.w / 4) / z.w;
  sides.addColorStop(0, '#fff0'); sides.addColorStop(fade, '#ffff'); sides.addColorStop(1 - fade, '#ffff'); sides.addColorStop(1, '#fff0');
  f.fillStyle = sides; f.fillRect(0, 0, z.w, z.h + SWAMP_BANK);
  const art = { back, front, top, width }; cache.set(z, art); return art;
}
