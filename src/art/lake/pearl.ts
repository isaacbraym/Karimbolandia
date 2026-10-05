/** Pérola do lago: esfera rosada com brilho, pulso suave e halo turquesa (sprites assados uma vez). */
import { bake, glowSprite, type Sprite } from '../kit';

let spr: Sprite | null = null;

function pearl(): Sprite {
  return spr ??= bake(20, 20, (g) => {
    const gr = g.createRadialGradient(8, 7, 1, 10, 10, 9);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.45, '#ffe6f2');
    gr.addColorStop(1, '#c79bd6');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(10, 10, 8.2, 0, 6.283);
    g.fill();
    g.strokeStyle = '#8a5aa0';
    g.lineWidth = 0.9;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,.95)';
    g.beginPath();
    g.ellipse(7.2, 6.8, 2.4, 1.6, -0.6, 0, 6.283);
    g.fill();
  }, { scale: 3, ox: 10, oy: 10 });
}

export function drawPearl(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const s = pearl();
  const glow = glowSprite('#9ff7ff', 32);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.45 + 0.2 * Math.sin(t * 3.4);
  g.drawImage(glow.c, x - 20, y - 20, 40, 40);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  const k = 1 + 0.06 * Math.sin(t * 4);
  g.drawImage(s.c, x - s.ox * k, y - s.oy * k, s.w * k, s.h * k);
}
