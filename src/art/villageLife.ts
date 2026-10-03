import { poly, shadedRR, shadedEllipse } from './kit';
import { prism } from './volume';
import { barkTrunk, foliage, VILLAGE_LEAVES } from './foliage';
import { Rng } from '../core/math';

export const LIFE_BOUNDS: Record<string,[number,number,number,number]> = {
  villageStream:[-245,-46,247,9], villageLaundry:[-112,-102,112,8],
  villageWorkbench:[-77,-72,86,12], villageOrchard:[-100,-199,102,10], villageDance:[-208,-42,210,14],
};
export function paintVillageLife(g:CanvasRenderingContext2D,kind:string,seed:number) {
  if(!LIFE_BOUNDS[kind])return false;
  if(kind==='villageStream') {
    poly(g,[[-240,-15],[-210,-40],[215,-40],[240,-18],[214,-5],[-210,4]],'#5b7252',{lw:1});
    poly(g,[[-230,-17],[-200,-34],[212,-34],[230,-18],[200,-8],[-205,-2]],'#67aeb0',{lw:1});
    g.strokeStyle='#b6d6b280';g.lineWidth=2;
    for(let x=-200;x<210;x+=42){g.beginPath();g.moveTo(x,-26);g.lineTo(x+23,-26);g.stroke();}
    for(let x=-222;x<225;x+=49)shadedEllipse(g,x,-2,9,4,'#858570',{lw:.7});
    prism(g,-24,2,50,5,14,-9,'#9b835b');
    for(let x=-21;x<26;x+=8){g.strokeStyle='#66523d';g.beginPath();g.moveTo(x,1);g.lineTo(x+12,-7);g.stroke();}
  } else if(kind==='villageLaundry') {
    for(const x of [-105,105])shadedRR(g,x-2,-94,4,94,1,'#877554',{lw:.8});
    g.strokeStyle='#6b5540';g.lineWidth=1.4;g.beginPath();g.moveTo(-105,-88);g.quadraticCurveTo(0,-63,105,-88);g.stroke();
    for(let i=0;i<5;i++) {
      const x=-84+i*37,y=-80+Math.sin(i/4*Math.PI)*9;
      poly(g,[[x,y],[x+26,y],[x+25,y+31],[x+2,y+34]],['#b86754','#d4b874','#617eaa','#77a084','#cf9470'][i],{lw:.8});
      g.fillStyle='#efddb3';g.fillRect(x+4,y+11,19,2);g.fillStyle='#58443b';g.fillRect(x+4,y-2,2,5);g.fillRect(x+21,y-2,2,5);
    }
    shadedEllipse(g,79,-7,17,10,'#ad8960',{lw:1});shadedEllipse(g,79,-13,13,4,'#ddc8a1',{lw:.8});
  } else if(kind==='villageWorkbench') {
    for(const x of [-54,52])prism(g,x,-39,7,43,9,-6,'#765b3d');
    prism(g,-69,-41,128,8,23,-14,'#ad8a59');
    shadedRR(g,-38,-59,53,9,3,'#a27749',{lw:1});
    g.strokeStyle='#664b36';g.lineWidth=1;g.beginPath();g.moveTo(-30,-55);g.lineTo(4,-55);g.stroke();
    poly(g,[[25,-53],[50,-67],[59,-63],[33,-48]],'#a9b4ad',{lw:.8});
    shadedRR(g,21,-54,23,4,1,'#55483c',{lw:.8});
    for(let i=0;i<3;i++)prism(g,-61+i*6,7-i*9,69,7,18,-9,'#946b46');
  } else if(kind==='villageOrchard') {
    const r=new Rng(seed*13+5);
    barkTrunk(g,r,0,-122,0,13,19,'#72593d');
    g.strokeStyle='#5e4630';g.lineCap='round';g.lineWidth=5;
    g.beginPath();g.moveTo(0,-96);g.quadraticCurveTo(-22,-108,-38,-122);g.moveTo(2,-104);g.quadraticCurveTo(22,-116,36,-128);g.stroke();
    foliage(g,r,-42,-128,34,{...VILLAGE_LEAVES,bloom:'#e0a83a'},7);
    foliage(g,r,38,-132,36,{...VILLAGE_LEAVES,bloom:'#d47b45'},7);
    foliage(g,r,-2,-158,38,{...VILLAGE_LEAVES,bloom:'#e0c048'},8);
    shadedEllipse(g,33,-7,21,10,'#ad8655',{lw:.8});
    for(let i=0;i<6;i++)shadedEllipse(g,22+i*4,-13-i%2*3,4,4,'#cfaa52',{lw:.5});
  } else {
    // A broad earthen square with flags and seats, never a physical obstacle.
    shadedEllipse(g,0,0,204,11,'#b29160',{lw:1});
    for(const x of [-185,182]){shadedRR(g,x,-35,4,34,1,'#725c44',{lw:.8});
      poly(g,[[x+3,-34],[x+26,-28],[x+3,-20]],x<0?'#be7457':'#618c86',{lw:.8});}
    for(const x of [-157,154])shadedEllipse(g,x,-5,17,8,'#997956',{lw:1});
    g.strokeStyle='#d6bb7e';g.lineWidth=1;for(let x=-120;x<121;x+=40){g.beginPath();g.arc(x,-1,9,Math.PI,Math.PI*2);g.stroke();}
  }
  return true;
}
