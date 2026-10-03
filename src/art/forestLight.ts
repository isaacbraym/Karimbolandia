import { makeCanvas, softDot } from './kit';
import type { World } from '../game/world';

let shade: HTMLCanvasElement | null = null, ray: HTMLCanvasElement | null = null;
export function prepareForestLight() {
  if (shade) return;
  shade = makeCanvas(256, 256);
  const s = shade.getContext('2d')!, shadow = s.createRadialGradient(128, 128, 20, 128, 128, 128);
  shadow.addColorStop(0, '#071e1ce6'); shadow.addColorStop(.6, '#071e1ca0'); shadow.addColorStop(1, '#071e1c00');
  s.fillStyle = shadow; s.fillRect(0, 0, 256, 256);
  ray = makeCanvas(192, 512); const g = ray.getContext('2d')!;
  g.beginPath(); g.moveTo(28, 0); g.lineTo(52, 0); g.lineTo(184, 512); g.lineTo(50, 512); g.closePath(); g.clip();
  const light = g.createLinearGradient(0, 0, 0, 512);
  light.addColorStop(0, '#fff5cf00'); light.addColorStop(.15, '#fff5cfa0'); light.addColorStop(.7, '#fff1b958'); light.addColorStop(1, '#fff1b900');
  g.fillStyle = light; g.fillRect(0, 0, 192, 512);
  g.globalCompositeOperation = 'destination-in';
  const edge = g.createLinearGradient(0, 0, 192, 0);
  edge.addColorStop(0, '#fff0'); edge.addColorStop(.3, '#ffff'); edge.addColorStop(.75, '#ffff'); edge.addColorStop(1, '#fff0');
  g.fillStyle = edge; g.fillRect(0, 0, 192, 512);
}
/** Luz fica sobre o cenário e atrás dos personagens/itens: combate permanece legível. */
export function drawForestLight(g: CanvasRenderingContext2D, w: World) {
  if (!w.forestLight.patches.length || w.inRoom() || w.underwater > .5) return;
  prepareForestLight(); const c = w.camera;
  g.save();
  for (const patch of w.forestLight.patches) {
    if (patch.x < c.x - 220 || patch.x > c.x + c.w + 220 || patch.shade < .08) continue;
    g.globalAlpha = patch.shade * .28;
    g.drawImage(shade!, patch.x - 220, patch.y - 590, 440, 720);
  }
  g.globalCompositeOperation = 'lighter';
  const spot = softDot('#ffe5a2', 64);
  for (let i = 0; i < w.forestLight.rays.length; i++) {
    const patch = w.forestLight.rays[i];
    if (patch.x < c.x - 220 || patch.x > c.x + c.w + 220) continue;
    g.globalAlpha = (.3 + .035 * Math.sin(w.time * .55 + i)) * (1 - patch.shade);
    g.drawImage(ray!, patch.x - 100, patch.y - 550, 230, 565);
    g.globalAlpha *= .65; g.drawImage(spot.c, patch.x - 65, patch.y - 17, 190, 38);
  }
  g.restore();
}
