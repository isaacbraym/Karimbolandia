import { bake, drawSpr, shadedRR, shadedEllipse, OUT, type Sprite } from './kit';
import { getArt } from './index';
import { bakeSivirinoHead } from './photo';

export interface MerchantArt { shelter: Sprite; tome: Sprite; head: Sprite | null; hand: Sprite; bench: Sprite }

/** Cabeça do Sivirino (foto): uma vez por sessão, compartilhada pela barraca e pela balada. */
let sivHead: Sprite | null = null;
export function sivirinoHead(): Sprite | null {
  if (sivHead) return sivHead;
  try { sivHead = bakeSivirinoHead(getArt().photos); } catch { return null; }
  return sivHead;
}

function poly(g: CanvasRenderingContext2D, xy: number[], color: string) {
  g.beginPath(); g.moveTo(xy[0], xy[1]);
  for (let i = 2; i < xy.length; i += 2) g.lineTo(xy[i], xy[i + 1]);
  g.closePath(); g.fillStyle = color; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.3; g.stroke();
}

function makeArt(forest: boolean): MerchantArt {
  const shelter = bake(142, 95, g => {
    g.lineJoin = 'round';
    g.fillStyle = 'rgba(15,10,26,.24)'; g.beginPath(); g.ellipse(72, 91, 68, 4, 0, 0, Math.PI * 2); g.fill();
    shadedRR(g, 9, 13, 5, 73, 2, '#786047', { lw: 1.2 });
    shadedRR(g, 127, 8, 5, 78, 2, '#786047', { lw: 1.2 });
    poly(g, [3,14,121,5,139,17,21,29], forest ? '#657c51' : '#566785');
    for (let i = 0; i < 6; i++) poly(g, [10+i*20,13-i*1.5,19+i*20,12-i*1.5,37+i*20,25-i*1.5,28+i*20,26-i*1.5], forest ? '#aebc7c' : '#92b4bd');
    poly(g, [21,29,139,17,139,24,21,36], forest ? '#3d513e' : '#384664');
    shadedRR(g, 16, 40, 20, 19, 4, '#72533c', { lw: 1.3 });
    shadedRR(g, 21, 43, 10, 10, 3, '#ffd287', { lw: 1 });
    shadedRR(g, 83, 36, 40, 16, 3, '#29463f', { lw: 1.3 });
    g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffe9b8'; g.fillText('SIVIRINO', 103, 47);
    g.strokeStyle = '#b9c7cc'; g.lineWidth = 3; g.beginPath(); g.moveTo(117,58); g.lineTo(113,70); g.stroke();
    g.beginPath(); g.arc(119,55,4,.1,Math.PI*1.5); g.stroke();
    shadedRR(g, 18, 71, 22, 10, 2, '#586875', { lw: 1.2 });
    for (let i = 0; i < 3; i++) shadedRR(g, 21+i*6, 65, 4, 11, 1, '#bba36c', { lw: .8 });
  }, { ox: 71, oy: 94, scale: 3 });
  // Corpo do Sivirino com o corta-vento azul-petróleo de gola roxa da foto; a cabeça é a foto.
  const tome = bake(54, 77, g => {
    g.lineJoin = 'round';
    shadedRR(g, 14, 61, 11, 10, 3, '#3d4152', { lw: 1.4 });
    shadedRR(g, 29, 61, 11, 10, 3, '#3d4152', { lw: 1.4 });
    shadedRR(g, 12, 68, 15, 7, 3, '#f2efe8', { lw: 1.4 });
    shadedRR(g, 27, 68, 15, 7, 3, '#f2efe8', { lw: 1.4 });
    shadedRR(g, 9, 34, 36, 31, 10, '#1f8790', { lw: 1.5 });
    poly(g, [12, 40, 20, 34, 22, 52, 14, 58], '#7b3f93');
    poly(g, [42, 40, 34, 34, 32, 52, 40, 58], '#7b3f93');
    poly(g, [21, 34, 27, 44, 33, 34], '#f4efe2');
    g.strokeStyle = '#d9e4e6'; g.lineWidth = 1; g.beginPath(); g.moveTo(27, 44); g.lineTo(27, 64); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(15, 46); g.quadraticCurveTo(19, 52, 16, 60); g.moveTo(37, 45); g.quadraticCurveTo(40, 50, 38, 58); g.stroke();
    shadedRR(g, 5, 38, 10, 23, 5, '#1f8790', { lw: 1.4 });
    shadedEllipse(g, 10, 60, 5, 5, '#8a5a3c', { lw: 1.2 });
    shadedEllipse(g, 27, 33, 6, 3.5, '#7d5034', { lw: 1 });
  }, { ox: 27, oy: 76, scale: 3 });
  const hand = bake(15, 27, g => {
    shadedRR(g, 3, 2, 9, 15, 4, '#1f8790', { lw: 1.3 });
    shadedEllipse(g, 7.5, 21, 5, 5, '#8a5a3c', { lw: 1.2 });
  }, { ox: 7.5, oy: 4, scale: 3 });
  const bench = bake(128, 43, g => {
    poly(g, [5,16,109,16,109,39,5,39], forest ? '#987148' : '#587182');
    poly(g, [109,16,124,6,124,29,109,39], forest ? '#604c39' : '#364456');
    poly(g, [5,16,20,6,124,6,109,16], forest ? '#c6a072' : '#92a8b1');
    shadedRR(g, 13, 23, 43, 11, 2, '#354f50', { lw: 1 });
    g.font = 'bold 7px sans-serif'; g.fillStyle = '#f6dba0'; g.fillText('OFICINA', 18, 31);
    shadedRR(g, 22, 9, 30, 3, 1, '#b7c4c9', { lw: .8 });
    shadedRR(g, 31, 11, 6, 8, 2, '#625046', { lw: .8 });
    shadedRR(g, 71, 2, 15, 10, 2, '#425f58', { lw: 1 });
    for (let i = 0; i < 3; i++) shadedRR(g, 74+i*4, 4, 2, 5, 1, '#edc578', { lw: .4 });
    shadedRR(g, 91, 8, 15, 5, 2, '#6e6877', { lw: .8 });
    g.strokeStyle = '#efc687'; g.lineWidth = 1; g.beginPath(); g.moveTo(10,19); g.lineTo(106,19); g.stroke();
  }, { ox: 64, oy: 42, scale: 3 });
  return { shelter, tome, head: sivirinoHead(), hand, bench };
}

export function drawMerchant(g: CanvasRenderingContext2D, art: MerchantArt | undefined, x: number, y: number, t: number, greeting: boolean, forest: boolean): MerchantArt {
  art ??= makeArt(forest);
  drawSpr(g, art.shelter, x, y);
  const breath = Math.sin(t * 2) * .45;
  drawSpr(g, art.tome, x - 8, y + breath);
  art.head ??= sivirinoHead();
  if (art.head) drawSpr(g, art.head, x - 8, y - 41 + breath, { rot: greeting ? Math.sin(t * 2.4) * 0.05 : Math.sin(t * 0.9) * 0.03 });
  drawSpr(g, art.hand, x + 10, y - 38 + breath, { rot: greeting ? -.75 + Math.sin(t * 3) * .14 : Math.sin(t * 2.2) * .06 });
  drawSpr(g, art.bench, x, y);
  return art;
}
