import { buildingStyle } from '../game/buildings';
import { poly, shadedRR } from './kit';
import { prism } from './volume';
import { shade } from '../core/math';

/** Fachadas assadas pelo cache de decoração; varanda, lateral e telhado ocupam planos distintos. */
export function paintBuilding(g: CanvasRenderingContext2D, index: number, mercenary = false) {
  const s = buildingStyle(index, mercenary), w = s.width, h = s.wall, d = s.depth, dy = -d * .58;
  g.fillStyle = 'rgba(8,22,18,.22)';
  g.beginPath(); g.ellipse(d / 2, 3, w * .7, 13, -.08, 0, Math.PI * 2); g.fill();
  if (mercenary) {
    for (let x = -w / 2 + 8; x <= w / 2; x += 28) {
      shadedRR(g, x - 3, 0, 7, 102, 1, '#53432b');
      g.strokeStyle = '#856b44'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, 15); g.lineTo(x + 24, 65); g.stroke();
    }
  }
  const base = mercenary ? ['#a99360', '#718062', '#a6764d'][index % 3] : s.color;
  prism(g, -w / 2 - 12, 0, w + 24, 9, d + 12, dy - 7, '#98714b');
  poly(g, [[w/2,0],[w/2+d,dy],[w/2+d,dy-h],[w/2,-h]], shade(base,-.32));
  shadedRR(g,-w/2,-h,w,h,2,base);
  g.strokeStyle = shade(base,-.28); g.lineWidth = 1;
  for (let x=-w/2+6; x<w/2; x+=mercenary?7:18) {
    g.beginPath(); g.moveTo(x,-h+3); g.lineTo(x,-3); g.stroke();
  }
  // Portas e janelas usam a mesma posição da interação no mundo.
  shadedRR(g,s.door-15,-62,30,62,3,'#342a23');
  shadedRR(g,s.door-12,-59,24,59,2,shade(s.accent,-.28));
  g.fillStyle='#dfc47c'; g.beginPath(); g.arc(s.door+8,-28,1.8,0,Math.PI*2); g.fill();
  const win=(x:number,y:number)=>{
    shadedRR(g,x-13,y-25,26,25,2,'#3d352b');
    g.fillStyle='#ddcb8b'; g.fillRect(x-10,y-22,20,19);
    g.strokeStyle=s.accent; g.lineWidth=3;
    g.beginPath(); g.moveTo(x,y-23); g.lineTo(x,y-2); g.moveTo(x-11,y-12); g.lineTo(x+11,y-12); g.stroke();
    shadedRR(g,x-19,y-26,6,27,1,s.accent); shadedRR(g,x+13,y-26,6,27,1,s.accent);
  };
  win(-w/2+28,-30);
  if(w>140)win(w/2-25,-30);
  if(s.floors===2){
    prism(g,-w/2-6,-77,w+12,5,d,dy,s.accent);
    win(-w/2+28,-106); win(w/2-28,-106);
    prism(g,-w/2+12,-78,w-24,5,21,-12,'#92694a');
    for(let x=-w/2+15;x<w/2-12;x+=12)shadedRR(g,x,-103,3,25,1,s.accent);
    g.strokeStyle=s.accent; g.lineWidth=4; g.beginPath();g.moveTo(-w/2+12,-103);g.lineTo(w/2-12,-103);g.stroke();
  }
  const roofH=s.roof===1?26:s.roof===2?48:64, top=-h-roofH;
  poly(g,[[-w/2-16,-h+4],[0,top],[d,top+dy],[w/2+d+16,-h+dy+4],[w/2+16,-h+4]],'#75603c');
  const roof=g.createLinearGradient(0,top,0,-h+8);
  roof.addColorStop(0,s.roof===2?'#dd9972':'#e0c684');roof.addColorStop(1,s.roof===2?'#9e503d':'#a58a4b');
  poly(g,[[-w/2-16,-h+4],[0,top],[w/2+16,-h+4],[w/2+8,-h+12],[-w/2-8,-h+12]],roof);
  g.strokeStyle='rgba(83,53,24,.4)';g.lineWidth=1;
  for(let x=-w/2-10;x<w/2+12;x+=5){g.beginPath();g.moveTo(x*.14,top+5);g.lineTo(x,-h+9);g.stroke();}
  // Uso doméstico diferente em cada fachada, além da planta e dos materiais.
  const px=w/2+11;
  if(index%3===0){
    shadedRR(g,px-10,-29,22,29,6,'#ba8057');
    for(let i=0;i<5;i++)poly(g,[[px,-25],[px-15+i*7,-48-i%2*8],[px+3,-31]],'#518448',{lw:.5});
  }else if(index%3===1){
    prism(g,px-15,0,30,20,14,-9,'#8d613c');
    g.strokeStyle='#d3b576';g.lineWidth=1;for(let y=-17;y<-1;y+=5){g.beginPath();g.moveTo(px-14,y);g.lineTo(px+13,y);g.stroke();}
  }else{
    poly(g,[[px-14,-60],[px+15,-69],[px+15,-32],[px-14,-23]],s.accent);
    g.strokeStyle='#e9d4a3';g.lineWidth=2;for(let y=-55;y<-27;y+=9){g.beginPath();g.moveTo(px-12,y);g.lineTo(px+13,y-8);g.stroke();}
  }
  g.fillStyle='#e9d9ab';g.font='bold 7px sans-serif';g.textAlign='center';
  g.fillText(mercenary?['VIGIA','COMANDO','RETAGUARDA'][index%3]:String(index+1).padStart(2,'0'),s.door,-68);
}
