import { poly, shadedRR } from './kit';

export const STORY_BOUNDS: Record<string, [number, number, number, number]> = {
  patrolRadio: [-44, -68, 48, 6],
  patrolWorkshop: [-42, -52, 48, 6],
  patrolCamp: [-48, -42, 50, 6],
};

/** Pequenas histórias em objetos: mapa/radio, manutenção e refeição interrompida. */
export function paintStoryProp(g: CanvasRenderingContext2D, kind: string, seed: number) {
  if (!STORY_BOUNDS[kind]) return false;
  g.fillStyle = 'rgba(12,10,24,.2)';
  g.beginPath(); g.ellipse(4, 2, 43, 5, 0, 0, Math.PI * 2); g.fill();
  if (kind === 'patrolRadio') {
    for (const x of [-30, 27]) shadedRR(g, x, -32, 4, 33, 1, '#53404b');
    poly(g, [[-38,-31],[34,-31],[44,-40],[-28,-40]], '#827364');
    poly(g, [[34,-31],[44,-40],[44,-35],[34,-26]], '#4b4152');
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
    poly(g, [[-35,0],[29,0],[42,-10],[-22,-10]], '#58495e');
    shadedRR(g,-35,-28,64,28,2,'#565c6b');
    poly(g, [[-35,-28],[29,-28],[42,-38],[-22,-38]], '#809098');
    poly(g, [[29,-28],[42,-38],[42,-10],[29,0]], '#31394c');
    g.strokeStyle = '#dbb56a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-20,-30); g.lineTo(-7,-36); g.stroke();
    shadedRR(g,4,-43,18,10,2,'#292f45');
    g.fillStyle = '#8dc4c1'; g.fillRect(8,-40,7,3);
    g.strokeStyle = '#1b1d34'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(26,-32); g.bezierCurveTo(48,-39,40,-3,28,-4); g.stroke();
    g.fillStyle = '#d0c6a6'; g.fillRect(-28,-19,16,3);
  } else {
    poly(g, [[-43,0],[21,0],[43,-13],[-21,-13]], '#8b7952');
    poly(g, [[-43,0],[21,0],[21,4],[-43,4]], '#59412d');
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
