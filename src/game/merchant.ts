import type { LevelData } from './level';
import type { World } from './world';
import { bake, drawSpr, type Sprite } from '../art/kit';

/** Tomé, mecânico itinerante. Barraca original, pintada uma vez por mundo. */
export class Merchant {
  spots:{x:number;y:number}[];
  private art:Sprite|undefined;
  constructor(data:LevelData) {
    this.spots=[{x:data.playerStart.x+160,y:data.playerStart.y},...data.checkpoints.filter((_,i)=>i>0&&i%3===1).map(cp=>({x:cp.x+76,y:cp.y}))];
    for(const spot of this.spots)spot.y=data.level.groundBelow(spot.x,spot.y-24)??spot.y;
  }
  near(w:World){return !w.inRoom()&&!w.player.mounted&&!w.player.lockInput&&w.player.mode==='foot'&&this.spots.some(s=>Math.abs(s.x-w.player.x)<115&&Math.abs(s.y-w.player.feetY)<60);}
  draw(g:CanvasRenderingContext2D,w:World) {
    this.art??=makeStall();
    for(const spot of this.spots){if(spot.x<w.camera.x-150||spot.x>w.camera.x+w.screenW+150)continue;
      drawSpr(g,this.art,spot.x,spot.y);
      g.save();g.translate(spot.x+9,spot.y-16);
      const bob=Math.sin(w.time*2)*.6;
      g.fillStyle='#386b68';g.fillRect(-9,-30+bob,17,27);g.fillStyle='#c99163';g.beginPath();g.ellipse(-1,-37+bob,8,10,0,0,Math.PI*2);g.fill();
      g.fillStyle='#3b2c27';g.fillRect(-10,-47+bob,18,5);g.fillRect(-4,-50+bob,9,4);g.fillRect(-7,-40+bob,12,2);
      g.fillStyle='#e7bb8f';g.save();g.translate(7,-26+bob);g.rotate(Math.sin(w.time*2.2)*.12);g.fillRect(0,0,5,19);g.restore();
      g.restore();
    }
  }
}
function makeStall() {
  return bake(128,102,g=>{
  g.fillStyle='rgba(15,10,26,.2)';g.beginPath();g.ellipse(63,96,62,6,0,0,Math.PI*2);g.fill();
  g.fillStyle='#574132';g.fillRect(15,12,5,78);g.fillRect(107,7,5,79);
  g.fillStyle='#af6a48';g.beginPath();g.moveTo(5,18);g.lineTo(106,7);g.lineTo(125,23);g.lineTo(23,35);g.closePath();g.fill();
  g.fillStyle='#d5aa65';for(let i=0;i<5;i++)g.fillRect(18+i*20,21-i*2,9,12);
  g.fillStyle='#78583b';g.fillRect(8,69,99,23);g.fillStyle='#bd9661';g.beginPath();g.moveTo(8,69);g.lineTo(22,59);g.lineTo(121,59);g.lineTo(107,69);g.closePath();g.fill();
  g.fillStyle='#46382d';g.beginPath();g.moveTo(107,69);g.lineTo(121,59);g.lineTo(121,82);g.lineTo(107,92);g.closePath();g.fill();
  g.fillStyle='#bcc8c6';g.fillRect(18,62,26,3);g.fillRect(24,64,5,5);g.fillStyle='#45576b';g.fillRect(56,52,14,11);g.fillStyle='#f0bd64';g.fillRect(58,54,10,2);
  g.fillStyle='#293936';g.fillRect(31,36,58,16);g.fillStyle='#ffe5ac';g.font='bold 10px sans-serif';g.fillText('TOMÉ',40,48);
  },{ox:64,oy:100});
}
