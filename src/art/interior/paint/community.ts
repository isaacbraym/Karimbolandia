import { box, P, poly, registerPainter } from '../furniture';
import { OUT } from '../../kit';

registerPainter('stairs',(g)=>{
  for(let i=0;i<7;i++)box(g,-.45,.45,-.9+i*.25,-.65+i*.25,0,(7-i)*7,{top:i%2?'#ba9663':'#aa8657'});
  g.strokeStyle='#674c35';g.lineWidth=3;
  for(const u of [-.45,.45]){g.beginPath();g.moveTo(...P(u,-.85,65));g.lineTo(...P(u,.85,19));g.stroke();}
});
registerPainter('stairsDown',(g)=>{
  const opening=[P(-.46,-.92),P(.46,-.92),P(.46,.92),P(-.46,.92)];
  poly(g,opening,'#20251f','#765638',2);
  g.save();poly(g,opening);g.clip();
  // Degraus ficam abaixo do piso e somem na sombra do vão, sem sugerir um terceiro andar.
  for(let i=6;i>=0;i--)box(g,-.43,.43,-.85+i*.24,-.61+i*.24,-52,-7-i*6,{top:i%2?'#9b784d':'#b08e60',edge:'#463c2c'});
  g.restore();
  g.strokeStyle='#765638';g.lineWidth=2.5;
  for(const u of [-.49,.49]){g.beginPath();g.moveTo(...P(u,-.92,16));g.lineTo(...P(u,.9,16));g.stroke();}
  // Seta discreta gravada na soleira, na direção dos degraus descendentes.
  g.strokeStyle='#e6c78d';g.lineWidth=2;const [x,y]=P(0,-.7,2);
  g.beginPath();g.moveTo(x+5,y-3);g.lineTo(x-7,y+3);g.lineTo(x-4,y-3);g.moveTo(x-7,y+3);g.lineTo(x,y+5);g.stroke();
});
registerPainter('communityFeature',(g,f)=>{
  box(g,-.95,.95,-.42,.42,0,26,{top:'#ac8054'});
  const trade=Number(f.name==='Tear e novelos'?0:f.name==='Bancada de cerâmica'?1:f.name==='Arquivo de sementes'?2:f.name==='Bancada do marceneiro'?3:f.name==='Redes e remos'?4:5);
  if(trade===0||trade===4){
    box(g,-.72,.72,-.28,-.2,26,58,{top:'#705435'});
    g.strokeStyle=trade===0?'#d59476':'#b9ac8a';g.lineWidth=1;
    for(let i=-.6;i<.7;i+=.12){g.beginPath();g.moveTo(...P(i,-.2,56));g.lineTo(...P(i,.25,28));g.stroke();}
  }else if(trade===1||trade===2){
    for(let i=0;i<5;i++){const [x,y]=P(-.7+i*.34,0,30);g.fillStyle=trade===1?['#d9aa7b','#b56d53','#d9bc82'][i%3]:'#65834d';g.strokeStyle=OUT;g.lineWidth=.8;g.beginPath();g.ellipse(x,y-7,6,9,0,0,Math.PI*2);g.fill();g.stroke();}
  }else if(trade===3){
    box(g,-.8,.6,-.15,.1,26,32,{top:'#e1bc7b'});
    const [x,y]=P(.5,.25,33);g.strokeStyle='#716452';g.lineWidth=3;g.beginPath();g.moveTo(x-8,y);g.lineTo(x+8,y-8);g.stroke();
  }else{
    const [x,y]=P(0,0,35);g.fillStyle='#d19e55';g.strokeStyle=OUT;g.lineWidth=1;g.beginPath();g.ellipse(x,y,13,9,-.3,0,Math.PI*2);g.fill();g.stroke();
    g.strokeStyle='#573e2a';g.lineWidth=5;g.beginPath();g.moveTo(x+5,y-3);g.lineTo(x+24,y-27);g.stroke();
  }
});
registerPainter('campDesk',(g)=>{
  box(g,-.95,.95,-.4,.4,0,26,{top:'#83724b'});
  poly(g,[P(-.7,-.25,27),P(.5,-.25,27),P(.5,.25,27),P(-.7,.25,27)],'#d6c49d',OUT,.7);
  g.strokeStyle='#4f7566';g.lineWidth=1;g.beginPath();g.moveTo(...P(-.5,-.15,28));g.lineTo(...P(0,.15,28));g.lineTo(...P(.35,-.1,28));g.stroke();
});
