import type { WeaponId } from '../game/weapons';

/** Acabamento assado junto do sprite, mantendo proporção, silhueta, pivô e boca existentes. */
export function weaponFinish(g:CanvasRenderingContext2D,id:WeaponId) {
  g.save();g.lineWidth=.35;
  if(id==='pistol') {
    g.strokeStyle='#c0c5cc';g.beginPath();g.moveTo(3,2.4);g.lineTo(12.3,2.4);g.stroke();
    g.fillStyle='#303446';for(let x=3;x<6;x+=.75)g.fillRect(x,2.9,.35,1.5);
    g.strokeStyle='#8d8075';for(let y=5.6;y<8.8;y+=.8){g.beginPath();g.moveTo(2.7,y);g.lineTo(5.7,y+.2);g.stroke();}
    g.fillStyle='#d3ac69';g.beginPath();g.arc(4.3,5.6,.35,0,Math.PI*2);g.fill();
  } else if(id==='rifle') {
    g.strokeStyle='#c0b899';g.beginPath();g.moveTo(1.5,4.4);g.quadraticCurveTo(4.4,3.4,7,4.6);g.stroke();
    g.fillStyle='#222a32';for(let x=16;x<21;x+=1.1)g.fillRect(x,4.9,.55,.7);
    g.strokeStyle='#727d86';for(let y=7.7;y<10.5;y+=.8){g.beginPath();g.moveTo(12.8,y);g.lineTo(15.1,y);g.stroke();}
    g.fillStyle='#d7ba72';g.fillRect(8.5,5.1,1,.5);g.fillRect(24,3.8,1.4,.45);
  } else if(id==='shotgun') {
    g.strokeStyle='#d29c63';g.beginPath();g.moveTo(1.7,4.8);g.quadraticCurveTo(5,3.7,7.3,5.4);g.stroke();
    g.strokeStyle='#5b3c29';for(let x=9.5;x<15;x+=.9){g.beginPath();g.moveTo(x,7.5);g.lineTo(x,9);g.stroke();}
    g.fillStyle='#b5c0c9';g.fillRect(17,2.9,11.5,.35);g.fillStyle='#f8cb76';g.fillRect(27.8,1.9,1,.75);
  } else if(id==='launcher') {
    g.strokeStyle='#a6b984';g.beginPath();g.moveTo(7,4.2);g.lineTo(24,4.2);g.stroke();
    g.fillStyle='#273a28';for(let x=19;x<24;x+=1.2)g.fillRect(x,8.8,.7,1.1);
    g.strokeStyle='#efd88f';g.beginPath();g.moveTo(15,4);g.lineTo(16,5.4);g.moveTo(15,7);g.lineTo(16,8.4);g.stroke();
    g.fillStyle='#b1b997';g.beginPath();g.arc(8.3,8.8,.45,0,Math.PI*2);g.fill();
  } else {
    g.strokeStyle='#657f91';g.beginPath();g.moveTo(5,5.5);g.lineTo(8,4);g.moveTo(22,3.5);g.lineTo(25,5);g.stroke();
    g.fillStyle='#075775';for(let x=12;x<20;x+=1.5)g.fillRect(x,5.6,.55,1.3);
    g.fillStyle='#bbffff';g.fillRect(10,3.4,5,.45);g.fillRect(22.3,5.2,2,.55);
    g.fillStyle='#425f70';g.fillRect(4.5,8,.8,.6);
  }
  g.restore();
}
