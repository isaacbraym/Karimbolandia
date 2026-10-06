/** Reservas visuais do casario: plantas grandes não brotam dentro de paredes e portas. */
import { buildingStyle } from '../buildings';
import type { DecoSpawn } from '../level';
import type { LevelBuilder } from './builder';

export function houseFootprint(home: DecoSpawn) {
  const s=buildingStyle(home.variant??0,home.kind==='jHut'),scale=home.scale??1;
  return {left:home.x-(s.width/2+(home.flip?s.depth:0))*scale,
    right:home.x+(s.width/2+(home.flip?0:s.depth))*scale};
}
export function settleHouseYards(b: LevelBuilder) {
  const homes=b.decos.filter(d=>d.kind==='villageHome').sort((a,z)=>a.x-z.x);
  const buildings=b.decos.filter(d=>d.kind==='villageHome'||d.kind==='jHut');
  const woody=new Set(['jTree','jPalm','jBanana','jStump','jRoots','jRock','jBush']);
  b.decos=b.decos.filter(d=>!woody.has(d.kind)||!buildings.some(home=>{
    const f=houseFootprint(home);
    return Math.abs(d.y-home.y)<110&&d.x>f.left-28&&d.x<f.right+28;
  }));
  // Cerâmica ocupa quintais de largura real, em vez de invadir a parede da próxima casa.
  b.decos=b.decos.filter(d=>{
    if(d.kind!=='villagePottery')return true;
    let i=homes.length-1;while(i>=0&&homes[i].x>=d.x)i--;if(i<0)return true;
    const home=homes[i],a=houseFootprint(home).right+10;
    const z=homes[i+1]?houseFootprint(homes[i+1]).left-10:a+110;
    if(z-a<32)return false;
    d.x=(a+z)/2;d.scale=Math.min(d.scale??1,(z-a)/118);
    d.y=b.level.reliefSurface(d.x)??home.y;return true;
  });
}
