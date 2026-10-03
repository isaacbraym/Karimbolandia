import { OUT, poly, shadedRR } from './kit';
import type { AmbientReaction } from '../game/ambientReaction';

export interface CityAnimal { kind: 'cat' | 'owl' | 'courier'; x: number; y: number; seed: number; reaction?:AmbientReaction }
export function drawCityAnimal(g: CanvasRenderingContext2D, a: CityAnimal, t: number) {
  const r=a.reaction;
  g.save(); g.translate(a.x+(r?.dx??0), a.y+(r?.dy??0));
  if(r?.active)g.scale(r.facing,1);
  g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = OUT; g.lineWidth = 1.1;
  const ellipse = (x: number, y: number, rx: number, ry: number, color: string) => {
    g.fillStyle = color; g.beginPath(); g.ellipse(x,y,rx,ry,0,0,Math.PI*2); g.fill(); g.stroke();
  };
  const look = Math.sin(t * 0.45 + a.seed);
  if (a.kind === 'cat') {
    const color = a.seed % 2 ? '#c78758' : '#727591';
    ellipse(0,-2,15,2.5,'rgba(10,12,28,.22)');
    g.strokeStyle = color; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-10,-6); g.bezierCurveTo(-24,-10,-23,-21,-18+Math.sin(t*1.5)*3,-21); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 1.1;
    ellipse(-2,-9,10,7,color);
    if(r?.moving){
      const stride=Math.sin(t*22)*4;
      g.strokeStyle=color;g.lineWidth=3;
      g.beginPath();g.moveTo(-7,-6);g.lineTo(-8+stride,1);g.moveTo(3,-6);g.lineTo(5-stride,1);g.stroke();
      g.strokeStyle=OUT;g.lineWidth=1.1;
    }
    ellipse(7+look,-17,6.5,6,color);
    poly(g,[[2+look,-20],[2+look,-27],[7+look,-22]],color,{lw:1});
    poly(g,[[8+look,-23],[13+look,-27],[13+look,-18]],color,{lw:1});
    g.fillStyle = '#ecdbac'; g.fillRect(8+look,-15,5,3);
    g.fillStyle = '#d7e789'; g.fillRect(7+look,-19,2,r?.alert?2.5:Math.sin(t*0.8+a.seed)>0.98?0.4:1.7);
    g.strokeStyle = '#ded5c5'; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(11,-15); g.lineTo(18,-16); g.moveTo(11,-14); g.lineTo(18,-12); g.stroke();
  } else if (a.kind === 'owl') {
    if(r?.active&&r.alert===0){
      const wing=Math.sin(t*18)*.65;
      for(const side of [-1,1]){
        g.save();g.translate(side*5,-13);g.rotate(side*(.35+wing));
        poly(g,[[0,0],[side*24,-8],[side*30,1],[side*21,8],[side*5,7]],'#786858',{lw:1});
        g.strokeStyle='#b8a48a';g.lineWidth=1;g.beginPath();g.moveTo(side*9,2);g.lineTo(side*25,1);g.stroke();g.restore();
      }
    }
    ellipse(0,-11,8,12,'#837467');
    ellipse(-4,-11,3,8,'#66564e'); ellipse(4,-11,3,8,'#66564e');
    g.translate(look*2,0);
    ellipse(0,-23,9,7,'#aca18c');
    for (const x of [-4,4]) {
      ellipse(x,-24,3.4,3.5,'#dfd0a7');
      g.fillStyle = '#312b39'; g.fillRect(x-0.8,-25,1.6,Math.sin(t+a.seed)>0.97?0.4:2.6);
    }
    poly(g,[[-2,-21],[2,-21],[0,-17]],'#d29a4d',{lw:0.6});
    g.strokeStyle = '#d3af71'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-4,-1); g.lineTo(-4,2); g.moveTo(4,-1); g.lineTo(4,2); g.stroke();
  } else {
    g.translate(Math.sin(t*0.3+a.seed)*34,-35+Math.sin(t*1.8+a.seed)*5);
    for (const x of [-17,17]) {
      shadedRR(g,x-3,-9,6,4,1,'#485d79');
      g.strokeStyle = '#99dcd4'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(x,-10,7,Math.abs(Math.sin(t*45))*1.4+0.3,0,0,Math.PI*2); g.stroke();
    }
    g.strokeStyle = '#626d8a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-17,-6); g.lineTo(0,0); g.lineTo(17,-6); g.stroke();
    shadedRR(g,-9,-7,18,11,3,'#8ab3b8');
    shadedRR(g,-6,4,12,10,1,'#c89868');
    g.fillStyle = '#fcdea0'; g.fillRect(-1,5,2,8);
    g.fillStyle = '#afffe1'; g.fillRect(-3,-4,6,2);
  }
  g.restore();
}
