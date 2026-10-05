import { CLUB_CROWD } from '../game/club';
import { civArtFor, type CivArt } from './civilians';
import { bake, drawSpr, type Sprite } from './kit';
import { drawFigure } from './figure';

const FRAMES=12;
let loops: Sprite[][]=[];
function pose(a:CivArt,style:number,phase:number){
  const P=a.pose,L=a.look,reach=L.arm+L.fore,db=phase*Math.PI*2,sw=Math.sin(db);
  P.head=phase<.2?a.joy:a.talk;P.headTilt=sw*.09;P.breath=0;
  P.lean=sw*(style===2?.16:.07);P.hipX=sw*1.8;P.hipDrop=(1-phase)*1.4;
  P.footFX=3+Math.max(0,sw)*3;P.footBX=-3-Math.max(0,-sw)*3;
  P.footFY=-Math.max(0,sw)*2;P.footBY=-Math.max(0,-sw)*2;
  P.handFX=style===1?3+Math.abs(sw)*4:5+sw*3;P.handBX=style===1?2-Math.abs(sw)*4:-4-sw*3;
  P.handFY=style===1?reach*.35:-reach*(.5+Math.sin(db+style)*.3);
  P.handBY=style===1?reach*.35:-reach*(.5-Math.sin(db+style)*.3);
}
/** 65 identidades × 12 poses, assadas uma única vez no carregamento; cache limitado ao elenco. */
export function bakeDancers(){
  if(loops.length)return;
  loops=CLUB_CROWD.map((look,i)=>{
    const a=civArtFor(look);if(!a)return [];
    return Array.from({length:FRAMES},(_,f)=>bake(48,76,g=>{
      g.translate(24,72);pose(a,i%4,f/FRAMES);drawFigure(g,a.look,a.pose);
    },{scale:2,ox:24,oy:72}));
  });
}
export function drawDancer(g:CanvasRenderingContext2D,index:number,x:number,y:number,scale:number,facing:number,phase:number){
  const loop=loops[index];if(!loop?.length)return;
  drawSpr(g,loop[Math.floor(phase*FRAMES)%FRAMES],x,y,{sx:scale,sy:scale,flip:facing<0});
}
