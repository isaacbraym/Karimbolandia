import type { World } from '../game/world';

/** Pequenos detalhes de história permanecem no mundo mesmo depois de investigados. */
export function drawExploration(g:CanvasRenderingContext2D,w:World) {
  const near=w.exploration.nearest(w);
  for(const s of w.exploration.spots) {
    if(s.x<w.blockX||!w.camera.visible(s.x,s.y-65,160))continue;
    g.save();g.translate(s.x,s.y);
    if(s.cabin) {
      // Porta sombreada, puxador, trilha de botas, varal e placa ironicamente oficial.
      g.fillStyle='#191f1be0';g.beginPath();g.roundRect(-18,-77,36,75,4);g.fill();
      g.strokeStyle='#b88d59';g.lineWidth=3;g.stroke();g.fillStyle='#e7c586';g.beginPath();g.arc(9,-38,2.5,0,Math.PI*2);g.fill();
      g.strokeStyle='#c7b580';g.lineWidth=1;g.beginPath();g.moveTo(-58,-105);g.quadraticCurveTo(0,-85,62,-105);g.stroke();
      for(let i=0;i<3;i++){g.fillStyle=i===1?'#688b8b':'#b39f7d';g.fillRect(-40+i*26,-98,14,21);g.fillStyle='#3d3026';g.fillRect(-43+i*26,-100,4,5);}
      g.fillStyle='#88704b';g.beginPath();g.roundRect(25,-59,60,25,3);g.fill();g.fillStyle='#fff0ba';g.font='bold 6px sans-serif';g.textAlign='center';g.fillText('PAZ LTDA.',55,-44);
      g.fillStyle='#302c26a0';for(let i=0;i<5;i++){g.beginPath();g.ellipse(-37+i*18,7+i%2*4,3.2,5,.4,0,Math.PI*2);g.fill();}
    } else {
      const i=s.clue?.id;
      g.fillStyle='#262f28';g.beginPath();g.ellipse(0,1,35,7,0,0,Math.PI*2);g.fill();
      if(i==='cloth') {
        g.strokeStyle='#8d6e46';g.lineWidth=4;g.beginPath();g.moveTo(-30,0);g.lineTo(-30,-68);g.lineTo(30,-68);g.lineTo(30,0);g.stroke();
        g.fillStyle='#cfb477';g.fillRect(-23,-64,46,45);g.fillStyle='#78aeb1';for(let k=0;k<3;k++)g.fillRect(-23,-56+k*13,46,5);
        g.strokeStyle='#a85245';g.lineWidth=3;g.beginPath();g.moveTo(21,-57);g.lineTo(26,-45);g.lineTo(21,-33);g.stroke();
      } else if(i==='bell') {
        g.strokeStyle='#b39457';g.lineWidth=5;g.beginPath();g.moveTo(-25,0);g.lineTo(-25,-57);g.lineTo(25,-57);g.lineTo(25,0);g.stroke();
        g.fillStyle='#d8b65d';g.beginPath();g.moveTo(-12,-47);g.quadraticCurveTo(0,-62,12,-47);g.lineTo(18,-26);g.lineTo(-18,-26);g.closePath();g.fill();g.fillStyle='#624b2f';g.fillRect(-2,-26,4,6);
      } else {
        g.fillStyle='#77816a';g.beginPath();g.moveTo(-29,0);g.lineTo(-24,-50);g.lineTo(20,-55);g.lineTo(31,0);g.closePath();g.fill();
        g.strokeStyle='#d6c68b';g.lineWidth=2;g.beginPath();g.moveTo(-16,-39);g.quadraticCurveTo(0,-22,14,-39);g.moveTo(0,-34);g.lineTo(0,-12);g.stroke();g.fillStyle='#659054';g.fillRect(-28,-7,57,8);
      }
    }
    if(near===s) {
      const safe=w.exploration.safe(w,s),label=safe?(s.cabin?'F · ENTRAR':'F · INVESTIGAR'):'ÁREA SOB AMEAÇA';
      g.font='bold 10px sans-serif';g.textAlign='center';const width=g.measureText(label).width+24;
      g.fillStyle='#1b302de8';g.strokeStyle=safe?'#e5c37f':'#de8e6a';g.lineWidth=1;
      g.beginPath();g.roundRect(-width/2,-125,width,25,6);g.fill();g.stroke();g.fillStyle='#fff0ce';g.fillText(label,0,-109);
    }
    g.restore();
  }
}
