import { poly, shadedRR } from './kit';
import { prism } from './volume';

export const STORY_BOUNDS: Record<string, [number, number, number, number]> = {
  patrolRadio: [-44, -68, 48, 9],
  patrolWorkshop: [-42, -52, 48, 9],
  patrolCamp: [-48, -42, 50, 9],
};

/** Pequenas histórias em objetos: mapa/radio, manutenção e refeição interrompida. */
export function paintStoryProp(g: CanvasRenderingContext2D, kind: string, seed: number) {
  if (!STORY_BOUNDS[kind]) return false;
  g.fillStyle = 'rgba(12,10,24,.2)';
  g.beginPath(); g.ellipse(4, 2, 43, 5, 0, 0, Math.PI * 2); g.fill();
  if (kind === 'patrolRadio') {
    for (const x of [-30, 27]) shadedRR(g, x, -32, 4, 33, 1, '#53404b');
    prism(g, -38, -31, 72, 5, 10, -9, '#756457');
    poly(g, [[-24,-33],[1,-33],[10,-39],[-15,-39]], '#dcc8a1');
    g.strokeStyle = '#776c57'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-16,-35); g.lineTo(-7,-37); g.lineTo(-2,-34); g.stroke();
    shadedRR(g, 7, -55, 23, 17, 2, '#324d4d');
    g.fillStyle = seed % 2 ? '#ffca70' : '#6febd9'; g.fillRect(11,-51,7,3);
    g.fillStyle = '#1c2836'; g.fillRect(21,-50,5,7);
    g.strokeStyle = '#354758'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(27,-55); g.lineTo(33,-65); g.stroke();
    shadedRR(g,-34,-41,5,8,1,'#c08863');
  } else if (kind === 'patrolWorkshop') {
    prism(g, -35, -28, 64, 28, 13, -10, '#565c6b');
    g.strokeStyle = '#dbb56a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-20,-30); g.lineTo(-7,-36); g.stroke();
    shadedRR(g,4,-43,18,10,2,'#292f45');
    g.fillStyle = '#8dc4c1'; g.fillRect(8,-40,7,3);
    g.strokeStyle = '#1b1d34'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(26,-32); g.bezierCurveTo(48,-39,40,-3,28,-4); g.stroke();
    g.fillStyle = '#d0c6a6'; g.fillRect(-28,-19,16,3);
  } else {
    prism(g, -43, 0, 64, 4, 22, -13, '#8b7952');
    shadedRR(g,-28,-31,20,29,3,'#4e6c5a');
    g.strokeStyle = '#283d39'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-27,-20); g.lineTo(-11,-20); g.stroke();
    poly(g, [[5,-1],[29,-1],[30,-7],[7,-7]], '#be9d63');
    shadedRR(g,7,-21,18,16,3,'#596879');
    g.fillStyle = '#1f2636'; g.fillRect(7,-23,18,3);
    g.strokeStyle = '#b2b2a0'; g.lineWidth = 1.4;
    g.beginPath(); g.arc(16,-24,5,Math.PI,Math.PI*2); g.stroke();
    shadedRR(g,31,-12,6,10,1,'#e1c9a5');
    g.fillStyle = '#d3bc85'; g.fillRect(-2,-3,6,3);
  }
  return true;
}
