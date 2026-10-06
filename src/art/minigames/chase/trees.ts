/** Árvores completas e ramagens vivas; estes pintores só são usados nos bakes. */
import { foliage, JUNGLE_LEAVES, type LeafPalette } from '../../foliage';
import { Rng } from '../../../core/math';

export function sprig(g: CanvasRenderingContext2D, r: Rng, x: number, y: number, length: number, angle: number, pal = JUNGLE_LEAVES) {
  g.save(); g.translate(x, y); g.rotate(angle);
  g.strokeStyle = pal.mids[0]; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(length * .6, -9, length, -4); g.stroke();
  for (let i = 1; i < 8; i++) for (const side of [-1, 1]) {
    const bx = length * i / 9, len = length * .3 * Math.sin(i / 9 * Math.PI);
    g.fillStyle = r.pick(pal.mids); g.beginPath(); g.moveTo(bx, -4);
    g.quadraticCurveTo(bx - len * .1, side * len, bx + len * .8, side * len * .7);
    g.quadraticCurveTo(bx + len * .65, side * len * .1, bx, -4); g.fill();
  }
  g.restore();
}

/** kind 0: figueira com contrafortes; 1: copa alta; 2: palmeira; 3: bambuzal. */
export function livingTree(g: CanvasRenderingContext2D, r: Rng, x: number, base: number, h: number, width: number, kind: number, pal: LeafPalette = JUNGLE_LEAVES) {
  g.save(); g.translate(x, base); g.lineCap = 'round';
  const bend = (kind % 2 ? -1 : 1) * width * .8;
  if (kind === 3) {
    for (let j = -2; j <= 2; j++) {
      const top = -h * r.range(.72, 1), dx = j * width * .35;
      g.strokeStyle = pal.dark; g.lineWidth = width * .15;
      g.beginPath(); g.moveTo(dx, 0); g.quadraticCurveTo(dx + j * 12, top * .5, dx + j * 24, top); g.stroke();
      for (let yy = -35; yy > top; yy -= 45) {
        g.strokeStyle = pal.mids[0]; g.lineWidth = 2; g.beginPath(); g.moveTo(dx - width * .09, yy); g.lineTo(dx + width * .09, yy); g.stroke();
        if (yy < -h * .3) sprig(g, r, dx + j * 14, yy, h * .14, j % 2 ? -.5 : -2.6, pal);
      }
    }
    g.restore(); return;
  }
  const bark = g.createLinearGradient(-width, 0, width, 0);
  bark.addColorStop(0, '#203f32'); bark.addColorStop(.45, kind === 2 ? '#8b8860' : '#73825a'); bark.addColorStop(1, pal.dark);
  g.fillStyle = bark; g.beginPath(); g.moveTo(-width, 0);
  g.bezierCurveTo(-width * .35, -h * .14, -width * .8, -h * .42, bend - width * .22, -h * .87);
  g.quadraticCurveTo(bend, -h, bend + width * .2, -h * .87);
  g.bezierCurveTo(width * .4, -h * .5, width * .55, -h * .2, width, 0); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(197,208,133,.24)'; g.lineWidth = width * .045;
  for (let j = -2; j <= 2; j++) {
    g.beginPath(); g.moveTo(j * width * .28, -8);
    g.bezierCurveTo(j * width * .2, -h * .2, j * width * .22 + bend * .5, -h * .5, bend + j * width * .06, -h * .85); g.stroke();
  }
  if (kind === 2) {
    for (let j = 0; j < 10; j++) sprig(g, r, bend, -h * .9, h * .2, -Math.PI + j * Math.PI / 8, pal);
  } else {
    for (let j = 0; j < 5; j++) {
      const side = j % 2 ? -1 : 1, yy = -h * (.45 + j * .085), dx = side * width * (1.7 + j * .3);
      g.strokeStyle = '#415338'; g.lineWidth = width * (.2 - j * .025);
      g.beginPath(); g.moveTo(bend * .5, yy + h * .09); g.quadraticCurveTo(dx * .55, yy, dx, yy - h * .08); g.stroke();
      // Cada extremidade termina em folhas, sem corte reto no topo da árvore.
      foliage(g, r, dx, yy - h * .09, h * (kind === 1 ? .06 : .085), pal, 7);
    }
    foliage(g, r, bend, -h * .89, h * .095, pal, 11);
    for (let j = 0; j < 3; j++) sprig(g, r, width * .2, -h * (.23 + j * .13), width * .85, -1.9, pal);
  }
  g.restore();
}
