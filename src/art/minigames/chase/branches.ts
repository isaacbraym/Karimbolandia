/** Galhos pintados na mesma curva da física, preparados antes da corrida. */
import { makeCanvas } from '../../kit';
import { Rng } from '../../../core/math';
import { TILE } from '../../../game/level';
import type { Course } from '../../../game/minigames/chase/sim/course';
import { foliage, JUNGLE_LEAVES } from '../../foliage';
import { livingTree, sprig } from './trees';

interface BranchArt { x: number; y: number; w: number; c: HTMLCanvasElement; row: number }
export class BranchCanopy {
  private readonly pieces: BranchArt[] = [];
  private readonly trunks = [0, 1, 2].map(() => makeCanvas(460, 1120));
  constructor(course: Course) {
    this.trunks.forEach((c, i) => livingTree(c.getContext('2d')!, new Rng(91 + i), 230, 1120, 970, 53 + i * 7, i));
    for (const [a, b, row] of course.branches) {
      const x = a * TILE, w = (b - a) * TILE, y = row * TILE - 120;
      const c = makeCanvas(w, 260), g = c.getContext('2d')!, rng = new Rng(a * 787 + row);
      g.translate(-x, -y);
      const wood = g.createLinearGradient(0, row * TILE - 25, 0, row * TILE + 75);
      wood.addColorStop(0, '#9b8e51'); wood.addColorStop(.3, '#70623d'); wood.addColorStop(1, '#302d25');
      g.fillStyle = wood; g.beginPath();
      for (let xx = x; xx < x + w; xx += 4) {
        const yy = course.pathY(xx); if (xx === x) g.moveTo(xx, yy); else g.lineTo(xx, yy);
      }
      g.lineTo(x + w, course.pathY(x + w - .01));
      for (let xx = x + w; xx >= x; xx -= 4) {
        const u = (xx - x) / w;
        g.lineTo(xx, course.pathY(Math.min(x + w - .01, xx)) + 8 + Math.sin(u * Math.PI) * 42);
      }
      g.closePath(); g.fill();
      // Ramificações finas pendem da madeira viva, abaixo da linha caminhável.
      g.strokeStyle = '#50482d'; g.lineWidth = 6; g.lineCap = 'round';
      for (let xx = x + 65; xx < x + w - 45; xx += 135) {
        const yy = course.pathY(xx) + 30;
        g.beginPath(); g.moveTo(xx, yy); g.quadraticCurveTo(xx + 18, yy + 45, xx + 48, yy + 58); g.stroke();
        g.lineWidth = 2; g.beginPath(); g.moveTo(xx + 31, yy + 48); g.quadraticCurveTo(xx + 15, yy + 52, xx + 11, yy + 70); g.stroke(); g.lineWidth = 6;
        g.fillStyle = '#426b3f'; g.beginPath(); g.ellipse(xx + 45, yy + 55, 12, 4, -.7, 0, Math.PI * 2); g.fill();
      }
      // Ramagens alternam acima e abaixo da trilha; a madeira caminhável continua visível.
      for (let xx = x + 80, i = 0; xx < x + w - 65; xx += 170, i++) {
        const yy = course.pathY(xx) + 14, side = i % 2 ? 1 : -1;
        g.strokeStyle = '#5a5937'; g.lineWidth = 5; g.beginPath(); g.moveTo(xx, yy);
        g.quadraticCurveTo(xx + 28, yy + side * 35, xx + 55, yy + side * 48); g.stroke();
        g.lineWidth = 2; g.beginPath(); g.moveTo(xx + 30, yy + side * 30);
        g.quadraticCurveTo(xx + 9, yy + side * 44, xx + 12, yy + side * 65); g.stroke();
        foliage(g, rng, xx + 56, yy + side * 48, rng.range(22, 31), JUNGLE_LEAVES, 5);
        sprig(g, rng, xx + 12, yy + side * 65, 34, side * .6);
      }
      // Nervuras de madeira seguem a curvatura, sem emendas quadradas entre tiles.
      for (let k = 0; k < 4; k++) {
        g.strokeStyle = k % 2 ? '#9a8850' : '#423c29'; g.lineWidth = k % 2 ? 1.2 : 2;
        g.beginPath(); for (let xx = x + 4; xx < x + w - 4; xx += 6) {
          const yy = course.pathY(xx) + 10 + k * 8 + Math.sin(xx / 41 + k) * 3;
          if (xx === x + 4) g.moveTo(xx, yy); else g.lineTo(xx, yy);
        } g.stroke();
      }
      g.strokeStyle = '#88a456'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath();
      for (let xx = x + 3; xx < x + w - 3; xx += 4) {
        const yy = course.pathY(xx) + 2; if (xx === x + 3) g.moveTo(xx, yy); else g.lineTo(xx, yy);
      } g.stroke();
      for (let xx = x + 18; xx < x + w - 18; xx += rng.range(24, 45)) {
        const yy = course.pathY(xx);
        g.fillStyle = rng.chance(.5) ? '#698c46' : '#b3bf6b'; g.beginPath();
        g.ellipse(xx, yy + 3, rng.range(5, 15), 3, -.12, 0, Math.PI * 2); g.fill();
        if (rng.chance(.3)) {
          g.strokeStyle = '#83a64a'; g.lineWidth = 1; g.beginPath(); g.moveTo(xx, yy); g.quadraticCurveTo(xx - 3, yy - 7, xx - 8, yy - 11); g.stroke();
          g.fillStyle = '#e4cd70'; g.beginPath(); g.arc(xx - 8, yy - 11, 2.5, 0, Math.PI * 2); g.fill();
        }
      }
      this.pieces.push({ x, y, w, c, row });
    }
  }
  draw(g: CanvasRenderingContext2D, course: Course, left: number, width: number) {
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      if (p.x > left + width + 130 || p.x + p.w < left - 130) continue;
      // Árvores continuam acima E abaixo dos galhos, com forquilhas e copas vivas.
      const rootX = p.x + p.w * .55;
      if (p.w > 300 || i % 3 === 0) g.drawImage(this.trunks[i % 3], rootX - 230, course.pathY(rootX) - 480);
      g.save(); g.beginPath();
      for (let tx = p.x / TILE; tx < (p.x + p.w) / TILE; tx++) {
        if (course.level.get(tx, p.row) === 2) g.rect(tx * TILE, p.y, TILE, 260);
      }
      g.clip(); g.drawImage(p.c, p.x, p.y); g.restore();
    }
  }
}
