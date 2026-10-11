import { afterEach, describe, expect, it, vi } from 'vitest';
import { Background, type BgState } from '../src/art/background';
import { drawDeco } from '../src/art/decor';

afterEach(()=>vi.unstubAllGlobals());

function drawingProbe() {
  let canvases=0,gradients=0,density=1;
  const g=new Proxy({} as CanvasRenderingContext2D,{get(o,k){
    if(k==='getTransform')return()=>({a:density});
    if(k==='createLinearGradient')return()=>{gradients++;return{addColorStop(){}};};
    if(k==='createRadialGradient')return()=>({addColorStop(){}});
    return k in o?o[k as keyof typeof o]:()=>{};
  },set(o,k,v){(o as any)[k]=v;return true;}});
  vi.stubGlobal('document',{createElement:()=>{canvases++;return{width:0,height:0,getContext:()=>g};}});
  return{g,counts:()=>({canvases,gradients}),scale:(n:number)=>{density=n;}};
}

describe('Preparo estável do cenário',()=>{
  it('mover o céu distante reutiliza o gradiente; clima, altura e escala o invalidam',()=>{
    const p=drawingProbe(),bg=new Background();
    const state:BgState={camX:0,camY:500,viewW:1100,viewH:650,time:0,sky:.3,ruin:0,refY:800,intensity:.6};
    for(let i=0;i<10;i++)bg.draw(p.g,state,0);
    const warm=p.counts();
    for(let i=0;i<120;i++){state.camX+=80;state.time+=1/60;bg.draw(p.g,state,0);}
    expect(p.counts()).toEqual(warm);
    state.sky=.7;bg.draw(p.g,state,0);expect(p.counts().gradients).toBe(warm.gradients+1);
    state.viewH+=30;bg.draw(p.g,state,0);expect(p.counts().gradients).toBe(warm.gradients+2);
    p.scale(2);bg.draw(p.g,state,0);expect(p.counts().gradients).toBe(warm.gradients+3);
  });
  it('hologramas e letreiros continuam animados sem preparar seu fundo a cada desenho',()=>{
    const p=drawingProbe();
    const a={kind:'hologram',x:100,y:300,layer:'back' as const},b={kind:'billboard',x:300,y:300,layer:'back' as const};
    drawDeco(p.g,a,0);drawDeco(p.g,b,0);const warm=p.counts();
    for(let i=0;i<120;i++){drawDeco(p.g,a,i/60);drawDeco(p.g,b,i/60);}
    expect(p.counts()).toEqual(warm);
  });
});
