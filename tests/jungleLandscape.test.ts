import { afterEach, describe, expect, it, vi } from 'vitest';
import { JungleLandscape, JUNGLE_REGIONS } from '../src/art/jungleLandscape';
import { buildJungle } from '../src/game/level/jungle';
import { houseFootprint } from '../src/game/level/houseLayout';

afterEach(()=>vi.unstubAllGlobals());
describe('Paisagens da campanha e reservas do casario',()=>{
  it('aquece inclusive a transição entre regiões sem criar imagens ou gradientes por quadro',()=>{
    let canvases=0,gradients=0;
    const g=new Proxy({} as CanvasRenderingContext2D,{get(o,k){
      if(k==='createLinearGradient')return()=>{gradients++;return{addColorStop(){}}};
      return k in o?o[k as keyof typeof o]:()=>{};
    },set(o,k,v){(o as any)[k]=v;return true;}});
    vi.stubGlobal('document',{createElement:()=>{canvases++;return{getContext:()=>g};}});
    const landscape=new JungleLandscape(),cam={x:319*32+175-550,y:520,w:1100,h:650};
    for(let i=0;i<40;i++){landscape.draw(g,cam,i/60);landscape.draw(g,cam,i/60,true);}
    const warm=canvases,grad=gradients;
    for(let i=0;i<120;i++){landscape.draw(g,cam,i/60);landscape.draw(g,cam,i/60,true);}
    expect(canvases).toBe(warm);expect(gradients).toBe(grad);
    expect(new Set(JUNGLE_REGIONS.map(r=>r.id)).size).toBe(14);
  });
  it('raízes de árvores não atravessam fachadas e cerâmica cabe nos quintais',()=>{
    const d=buildJungle(),homes=d.decos.filter(d=>d.kind==='villageHome'||d.kind==='jHut');
    for(const home of homes){const f=houseFootprint(home);
      expect(d.decos.some(p=>['jTree','jPalm','jBanana','jStump','jRoots','jRock','jBush'].includes(p.kind)
        &&Math.abs(p.y-home.y)<110&&p.x>f.left-28&&p.x<f.right+28),`fachada ${home.variant}`).toBe(false);
    }
    for(const pot of d.decos.filter(d=>d.kind==='villagePottery')){
      const scale=pot.scale??1;
      expect(homes.some(h=>{const f=houseFootprint(h);return pot.x-50*scale<f.right&&pot.x+57*scale>f.left;})).toBe(false);
    }
  });
});
