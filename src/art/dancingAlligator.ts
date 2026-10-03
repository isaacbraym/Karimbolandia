import { bake, drawSpr, poly, shadedEllipse, shadedRR, type Sprite } from './kit';
import { clapOpen } from '../core/clapRhythm';

let art: { torso: Sprite; head: Sprite; tail: Sprite; arm: Sprite; leg: Sprite; foot: Sprite } | null = null;
function parts() {
  if (art) return art;
  const torso = bake(58, 76, g => {
    shadedEllipse(g, 29, 39, 23, 34, '#638749', { lw: 1.5 });
    shadedEllipse(g, 30, 41, 16, 29, '#d4ce9b', { lw: 1 });
    g.strokeStyle = '#99935f'; g.lineWidth = 1;
    for (let y = 22; y < 66; y += 7) { g.beginPath(); g.moveTo(17, y); g.quadraticCurveTo(30, y + 4, 43, y); g.stroke(); }
    for (const [x,y] of [[9,20],[8,33],[9,48],[47,22],[49,36],[48,51]]) {
      poly(g, [[x-3,y],[x,y-5],[x+4,y]], '#3c6039', { lw: .7 });
    }
  }, { scale: 3, ox: 29, oy: 72 });
  const head = bake(52, 67, g => {
    // Long upright snout and pale lower jaw from the supplied dance reference.
    g.beginPath();g.moveTo(13,59);g.quadraticCurveTo(3,49,9,36);g.quadraticCurveTo(14,27,20,29);
    g.lineTo(35,6);g.quadraticCurveTo(40,0,46,6);g.quadraticCurveTo(50,11,43,17);
    g.lineTo(30,39);g.quadraticCurveTo(36,48,31,59);g.closePath();
    g.fillStyle='#749752';g.fill();g.strokeStyle='#273d2e';g.lineWidth=1.5;g.stroke();
    poly(g,[[17,48],[30,35],[41,17],[38,36],[31,53],[22,58]],'#d9d1a0',{lw:.9});
    poly(g,[[21,44],[34,20],[42,17],[30,40]],'#344b32',{lw:.6});
    shadedEllipse(g, 14, 35, 6, 7, '#83a35b', { lw: 1 });
    g.fillStyle='#fff0b6';g.beginPath();g.ellipse(16,34,3.2,4.2,-.15,0,Math.PI*2);g.fill();
    g.fillStyle='#24342d';g.fillRect(16,31,1.4,6);
    g.strokeStyle='#374834';g.lineWidth=1.1;g.beginPath();g.moveTo(16,45);g.quadraticCurveTo(24,52,30,48);g.stroke();
    g.fillStyle='#394d33';g.beginPath();g.ellipse(41,9,1.5,2.2,.5,0,Math.PI*2);g.fill();
    for(let i=0;i<4;i++){const x=27+i*3,y=35-i*5;poly(g,[[x-2,y],[x+2,y-1],[x+1,y+4]],'#fbefc4',{lw:.4});}
    for(const [x,y]of[[11,48],[15,53],[25,24],[30,17]]){g.fillStyle='#496b3d';g.fillRect(x,y,3,2);}
  }, { scale: 3, ox: 26, oy: 61 });
  const tail = bake(106, 32, g => {
    poly(g, [[4,3],[32,7],[64,15],[102,28],[66,27],[32,22],[4,23]], '#66834a', { lw: 1.2 });
    for (let x=12;x<83;x+=10) poly(g,[[x,8+x*.12],[x+4,2+x*.15],[x+9,10+x*.13]],'#3c5e35',{lw:.7});
    g.strokeStyle='#d1cd9366';g.lineWidth=2;g.beginPath();g.moveTo(12,20);g.quadraticCurveTo(48,20,86,27);g.stroke();
  }, { scale: 3, ox: 6, oy: 14 });
  const arm = bake(15, 30, g => { shadedRR(g,3,2,10,25,5,'#6c8d4a',{lw:1});
    for(let x=4;x<13;x+=3)poly(g,[[x,25],[x+1,29],[x+2,25]],'#e3d4a1',{lw:.5});
  }, { scale:3,ox:8,oy:3 });
  const leg = bake(23, 36, g => { shadedRR(g,3,3,17,29,7,'#587d42',{lw:1.2});
    g.strokeStyle='#96ad6566';g.lineWidth=2;g.beginPath();g.moveTo(8,8);g.lineTo(8,24);g.stroke();
  }, { scale:3,ox:11,oy:4 });
  const foot = bake(36, 18, g => { shadedEllipse(g,18,10,16,6,'#638648',{lw:1});
    for(let x=22;x<34;x+=4)poly(g,[[x,8],[x+3,11],[x,13]],'#e1d09a',{lw:.6});
  }, { scale:3,ox:10,oy:14 });
  return art = { torso,head,tail,arm,leg,foot };
}
function limb(g:CanvasRenderingContext2D,s:Sprite,x:number,y:number,ex:number,ey:number,length:number) {
  g.save();g.translate(x,y);g.rotate(Math.atan2(ey-y,ex-x)-Math.PI/2);
  drawSpr(g,s,0,0,{sy:Math.hypot(ex-x,ey-y)/length});g.restore();
}

/** Weight shifts before each side step; feet lift alternately, tail follows the hips. */
export function drawDancingAlligator(g:CanvasRenderingContext2D,x:number,y:number,t:number) {
  const a=parts(), beat=t*Math.PI*2/.6, side=Math.sin(beat*.5), bob=clapOpen(t)*5;
  g.save();g.translate(x+side*28,y);
  g.fillStyle='#13281735';g.beginPath();g.ellipse(9,3,52,7,0,0,Math.PI*2);g.fill();
  drawSpr(g,a.tail,10,-37,{rot:side*.15});
  for(const s of [-1,1]) {
    const lift=Math.max(0,Math.sin(beat)*s)*14, foot=s*21+side*12;
    limb(g,a.leg,s*13,-46-bob,foot,-20-lift,28);
    limb(g,a.leg,foot,-20-lift,foot+s*6,-5-lift,28);
    drawSpr(g,a.foot,foot,-lift,{sx:s,rot:-s*lift*.013});
  }
  g.save();g.translate(0,-37-bob);g.rotate(side*.12);
  drawSpr(g,a.torso,0,0);
  for(const s of [-1,1]) {
    const elbow=s*41, hand=s*(61+Math.sin(beat)*3);
    limb(g,a.arm,s*18,-50,elbow,-42+side*s*8,24);
    limb(g,a.arm,elbow,-42+side*s*8,hand,-48+Math.cos(beat)*7,24);
  }
  drawSpr(g,a.head,0,-63,{rot:-side*.12});g.restore();
  g.restore();
}
