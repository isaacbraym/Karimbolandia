import type { TrailChallenge, TrailPoint } from '../game/encounters/challenge';

/** Small animated silhouettes and rings; no canvases/gradients allocated per frame. */
export function drawTrail(g: CanvasRenderingContext2D, trail: TrailChallenge, time: number, visible: (x: number, y: number) => boolean) {
  const { def } = trail;
  const delivery = def.theme === 'delivery', harvest = def.theme === 'harvest';
  const color = delivery ? '#90eeff' : harvest ? '#ffd582' : '#ceff91';
  g.save();
  for (let i = trail.next; i < def.points.length; i++) {
    const p = def.points[i];
    if (!visible(p.x, p.y)) continue;
    const target = i === trail.next && trail.status !== 'cooldown';
    g.globalAlpha = target ? .95 : .36;
    g.strokeStyle = color; g.lineWidth = target ? 2.5 : 1.2;
    g.beginPath(); g.ellipse(p.x, p.y, 22, 27, .12 * Math.sin(time * 2 + i), 0, Math.PI * 2); g.stroke();
    for (let j = 0; j < 4; j++) {
      const a = time * (delivery ? 2 : .7) + j * Math.PI / 2 + i;
      g.fillStyle = color; g.beginPath(); g.arc(p.x + Math.cos(a) * 24, p.y + Math.sin(a) * 28, target ? 2 : 1.3, 0, Math.PI * 2); g.fill();
    }
    if (target) {
      g.fillStyle = '#211a35';g.beginPath();g.arc(p.x,p.y,8,0,Math.PI*2);g.fill();
      g.fillStyle = color;g.font='bold 10px sans-serif';g.textAlign='center';g.fillText(String(i+1),p.x,p.y+3.5);
    }
  }
  const destination = trail.guide;
  const guide = { x: destination.x, y: destination.y - 55 + Math.sin(time * 2.5) * 4 };
  if (visible(guide.x, guide.y)) {
    g.globalAlpha = trail.status === 'cooldown' ? .4 : 1;
    if (delivery) drawCourier(g, guide, time);
    else if (harvest) drawHarvest(g, guide, time);
    else drawFireflies(g, guide, time);
    if (trail.status === 'ready') {
      g.fillStyle = '#211a35';g.fillRect(guide.x-66,guide.y-47,132,29);
      g.fillStyle = color;g.font='bold 9px sans-serif';g.textAlign='center';
      g.fillText(def.title,guide.x,guide.y-35);
      g.fillStyle='#ffe0a1';g.fillText(`Pule no aro • +${def.coins} moedas`,guide.x,guide.y-23);
    }
  }
  g.restore();
}
function drawHarvest(g: CanvasRenderingContext2D, p: TrailPoint, time: number) {
  g.save();g.translate(p.x,p.y);g.rotate(Math.sin(time*2)*.06);
  g.strokeStyle='#342738';g.lineWidth=2.5;g.lineJoin='round';
  g.beginPath();g.ellipse(0,-7,13,14,0,Math.PI,Math.PI*2);g.stroke();
  for(const [x,y,color] of [[-10,-5,'#ec8260'],[1,-8,'#ffd36d'],[11,-4,'#d99bcc']] as const){
    g.fillStyle=color;g.beginPath();g.ellipse(x,y,7,7,0,0,Math.PI*2);g.fill();g.stroke();
    g.fillStyle='#78ad76';g.beginPath();g.ellipse(x+3,y-8,5,2.5,-.5,0,Math.PI*2);g.fill();
    g.fillStyle='#fff0bf';g.beginPath();g.arc(x-2,y-2,1.5,0,Math.PI*2);g.fill();
  }
  g.fillStyle='#b8754e';g.beginPath();g.moveTo(-20,0);g.lineTo(20,0);g.lineTo(15,19);g.lineTo(-15,19);g.closePath();g.fill();g.stroke();
  g.strokeStyle='#e5b16d';g.lineWidth=1.5;
  for(const y of [5,11,16]){g.beginPath();g.moveTo(-17+y*.13,y);g.lineTo(17-y*.13,y);g.stroke();}
  for(const x of [-10,0,10]){g.beginPath();g.moveTo(x,2);g.lineTo(x*.8,18);g.stroke();}
  g.strokeStyle='#342738';g.lineWidth=2.5;g.beginPath();g.moveTo(-20,0);g.lineTo(20,0);g.stroke();
  g.restore();
}
function drawCourier(g: CanvasRenderingContext2D, p: TrailPoint, time: number) {
  g.save();g.translate(p.x,p.y);g.rotate(Math.sin(time*3)*.05);
  g.strokeStyle='#24203c';g.lineWidth=4;g.beginPath();g.moveTo(-22,-4);g.lineTo(22,-4);g.stroke();
  g.fillStyle='#627b94';g.fillRect(-12,-9,24,13);g.fillStyle='#b2eaff';g.fillRect(-8,-7,11,4);
  g.fillStyle='#f6ae69';g.fillRect(-8,5,16,11);g.fillStyle='#ffe1a3';g.fillRect(-1,5,3,11);
  g.strokeStyle='#afedf4';g.lineWidth=2;
  for(const x of [-22,22]){g.beginPath();g.ellipse(x,-8,12,1.5+Math.abs(Math.sin(time*35))*2,0,0,Math.PI*2);g.stroke();}
  g.fillStyle='#ff6680';g.fillRect(7,-4,3,3);g.restore();
}
function drawFireflies(g: CanvasRenderingContext2D, p: TrailPoint, time: number) {
  for(let i=0;i<9;i++){
    const a=i*2.4+time*(.7+i*.025),x=p.x+Math.cos(a)*(10+i*2),y=p.y+Math.sin(a*1.3)*18;
    g.globalAlpha=.15;g.fillStyle='#caff90';g.beginPath();g.arc(x,y,5,0,Math.PI*2);g.fill();
    g.globalAlpha=.55+.4*Math.sin(time*3+i)**2;g.beginPath();g.arc(x,y,1.7,0,Math.PI*2);g.fill();
  }
  g.globalAlpha=1;
}
