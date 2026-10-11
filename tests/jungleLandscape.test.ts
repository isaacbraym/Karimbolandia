import { afterEach, describe, expect, it, vi } from 'vitest';
import { JungleLandscape, JUNGLE_REGIONS, JUNGLE_BLEND, junglePalette } from '../src/art/jungleLandscape';
import { buildJungle } from '../src/game/level/jungle';
import { houseFootprint } from '../src/game/level/houseLayout';

afterEach(()=>vi.unstubAllGlobals());
describe('Paisagens da campanha e reservas do casario',()=>{
  it('atravessar a fronteira com a câmera não troca os exemplares nem dissolve árvores',()=>{
    let canvases=0;const images:unknown[]=[],alphas:number[]=[];
    const g=new Proxy({globalAlpha:1} as CanvasRenderingContext2D,{get(o,k){
      if(k==='createLinearGradient')return()=>({addColorStop(){}});
      if(k==='drawImage')return(image:unknown)=>{images.push(image);alphas.push(o.globalAlpha);};
      return k in o?o[k as keyof typeof o]:()=>{};
    },set(o,k,v){(o as any)[k]=v;return true;}});
    vi.stubGlobal('document',{createElement:()=>{canvases++;return{getContext:()=>g};}});
    const land=new JungleLandscape(),cam={x:222*32-550-1,y:520,w:1100,h:650};
    for(let i=0;i<40;i++)land.draw(g,cam,0);
    images.length=alphas.length=0;land.draw(g,cam,0);const before=[...images],warm=canvases;
    cam.x+=2;images.length=alphas.length=0;land.draw(g,cam,0);
    expect(images).toEqual(before);expect(alphas.every(a=>a===1)).toBe(true);expect(canvases).toBe(warm);
    cam.x-=2;images.length=0;land.draw(g,cam,0);expect(images).toEqual(before);
  });
  it('a paleta tem continuidade nos dois extremos de cada transição e conserva as 14 regiões',()=>{
    for(const region of JUNGLE_REGIONS.slice(0,-1))for(const layer of [0,1,2]){
      for(const x of [region.end*32,region.end*32+JUNGLE_BLEND]){
        expect(junglePalette(x-.001,layer).color).toBe(junglePalette(x+.001,layer).color);
        expect(Math.abs(junglePalette(x-.001,layer).wet-junglePalette(x+.001,layer).wet)).toBeLessThan(.00001);
      }
    }
  });
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
