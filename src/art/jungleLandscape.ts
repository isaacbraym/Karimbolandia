/** Paisagens autoradas em planos: cada célula mantém sua semente e posição no mapa.
 * Preparo limitado e cache limitado; vento transforma imagens prontas. Não altera colisões. */
import { Rng, mixColor } from '../core/math';
import { makeCanvas } from './kit';
import { windTip } from './wind';

export const JUNGLE_REGIONS = [
  { id: 'orla', end: 222, kind: 'forest', colors: ['#82a476','#51794d','#284c37'] },
  { id: 'brejo', end: 319, kind: 'swamp', colors: ['#728d81','#416b60','#193e38'] },
  { id: 'desfiladeiro', end: 386, kind: 'gorge', colors: ['#929e88','#657664','#344f46'] },
  { id: 'ruinas', end: 474, kind: 'ruins', colors: ['#a1ad81','#6f8155','#405836'] },
  { id: 'lago', end: 570, kind: 'lake', colors: ['#87b8aa','#518e79','#2a6657'] },
  { id: 'acampamento', end: 692, kind: 'camp', colors: ['#a8a082','#7a8060','#4a5d40'] },
  { id: 'casarios', end: 838, kind: 'homes', colors: ['#a5b28a','#728c5e','#426544'] },
  { id: 'rocas', end: 916, kind: 'farm', colors: ['#b4b783','#829153','#51683b'] },
  { id: 'riacho', end: 982, kind: 'stream', colors: ['#89aeaa','#598979','#305c50'] },
  { id: 'praca', end: 1060, kind: 'square', colors: ['#b5b49a','#82996f','#4d7251'] },
  { id: 'oficinas', end: 1160, kind: 'craft', colors: ['#b8a785','#8c8760','#5b6946'] },
  { id: 'pomares', end: 1256, kind: 'orchard', colors: ['#b0b685','#7d985a','#466d42'] },
  { id: 'trilha-rio', end: 1312, kind: 'river', colors: ['#91b9ac','#608d7d','#325f51'] },
  { id: 'santuario', end: Infinity, kind: 'sanctuary', colors: ['#b8c6a2','#839b70','#496e51'] },
] as const;
export const jungleRegion = (x: number) => JUNGLE_REGIONS.findIndex(r => x < r.end * 32);
const SPAN = 512, HEIGHT = 640, TOP = 530, BLEED = 224, DENSITY = 1.25;
const PARALLAX = [.24,.49,.76,1.07];
export const JUNGLE_BLEND = 900;
type Region = typeof JUNGLE_REGIONS[number];
interface Patch { ground: HTMLCanvasElement; plants: HTMLCanvasElement }

/** A paleta pertence ao lugar, não à câmera. Misturar cores preserva a opacidade das árvores. */
export function junglePalette(x: number, layer: number) {
  const ri = jungleRegion(x), region = JUNGLE_REGIONS[ri], k = Math.min(layer,2);
  const start = ri ? JUNGLE_REGIONS[ri-1].end*32 : 150*32;
  const t = Math.max(0,Math.min(1,(x-start)/JUNGLE_BLEND)), blend = t*t*(3-2*t);
  const previous = JUNGLE_REGIONS[Math.max(0,ri-1)];
  const wet = (r: Region) => ['swamp','lake','stream','river'].includes(r.kind) ? 1 : 0;
  return { region, color: mixColor(previous.colors[k],region.colors[k],blend),
    wet: wet(previous)*(1-blend)+wet(region)*blend };
}

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, c: string) {
  g.fillStyle = c; g.beginPath(); g.ellipse(x,y,rx,ry,0,0,Math.PI*2); g.fill();
}
function tree(g: CanvasRenderingContext2D, r: Rng, x: number, y: number, size: number, color: string, species: number) {
  g.save();g.translate(x,y);g.scale(size,size);g.lineCap='round';
  const height=r.range(210,405), lean=r.range(-45,45), trunk=species===2?9:r.range(13,23);
  g.strokeStyle=color;g.lineWidth=trunk;
  g.beginPath();g.moveTo(0,3);g.bezierCurveTo(lean*.4,-height*.25,lean,-height*.66,lean,-height);g.stroke();
  for(let i=0;i<4;i++){
    const side=i%2?1:-1, yy=-height*(.38+i*.13), reach=side*r.range(45,95);
    g.lineWidth=trunk*.33;g.beginPath();g.moveTo(lean*.7,yy);g.quadraticCurveTo(reach*.5,yy-17,reach,yy-55);g.stroke();
    if(species!==2)for(let j=0;j<6;j++)ellipse(g,reach+r.range(-30,30),yy-60+r.range(-17,17),r.range(18,38),r.range(13,25),color);
  }
  if(species===2){
    g.lineWidth=5;
    for(let i=0;i<9;i++){
      const a=i*Math.PI*2/9, dx=Math.cos(a)*110,dy=Math.sin(a)*36;
      g.beginPath();g.moveTo(lean,-height);g.quadraticCurveTo(lean+dx*.55,-height-36,lean+dx,-height+dy+16);g.stroke();
      for(let j=1;j<8;j++){
        const u=j/8;g.lineWidth=2;g.beginPath();g.moveTo(lean+dx*u,-height-40*u*(1-u)+dy*u);
        g.lineTo(lean+dx*u+13,-height-40*u*(1-u)+dy*u+26);g.stroke();
      }
    }
  }else{
    for(let i=0;i<15;i++)ellipse(g,lean+r.range(-85,85),-height+r.range(-25,35),r.range(25,53),r.range(17,32),color);
  }
  // Sapopemas e raízes aéreas prendem a árvore ao solo, sem troncos cortados.
  for(let i=0;i<5;i++){
    const end=(i-2)*r.range(18,36);g.lineWidth=species===1?7:4;
    g.beginPath();g.moveTo(lean*.1,-r.range(23,60));g.quadraticCurveTo(end*.3,-10,end,9);g.stroke();
  }
  g.strokeStyle='rgba(216,232,166,.15)';g.lineWidth=2;
  g.beginPath();g.moveTo(-trunk*.2,-5);g.quadraticCurveTo(lean-3,-height*.5,lean-4,-height+8);g.stroke();
  g.restore();
}

export class JungleLandscape {
  private cache = new Map<string,Patch>();
  draw(g: CanvasRenderingContext2D, cam: {x:number;y:number;w:number;h:number}, time:number, front=false) {
    if(cam.y>1120 || cam.y+cam.h<360) return;
    if(cam.x+cam.w<150*32) return;
    let budget=2;
      for(let layer=front?3:0;layer<(front?4:3);layer++){
        const par=PARALLAX[layer],off=cam.x*par;
        const a=Math.floor((off-BLEED)/SPAN),b=Math.floor((off+cam.w+BLEED)/SPAN);
        const foot=1024-(2-layer)*74+(front?112:0);
        for(let i=a;i<=b;i++){
          const key=`${layer}:${i}`;let image=this.cache.get(key);
          if(!image&&budget>0){image=this.bake(layer,i);this.cache.set(key,image);budget--;}
          if(!image)continue;
          // Ordem LRU mantém apenas as imagens próximas, inclusive ao voltar pelo mapa.
          this.cache.delete(key);this.cache.set(key,image);
          g.save();g.globalAlpha=1;
          const x=cam.x+i*SPAN-off;
          g.translate(x,foot);
          // Só o núcleo da margem: nenhum retângulo duplicado ou chão inclinado pelo vento.
          g.drawImage(image.ground,BLEED*DENSITY,0,SPAN*DENSITY,HEIGHT*DENSITY,0,-TOP,SPAN,HEIGHT);
          g.restore();
        }
        // Todas as margens antes das copas/raízes: o núcleo vizinho nunca recorta uma árvore.
        for(let i=a;i<=b;i++){
          const image=this.cache.get(`${layer}:${i}`);if(!image)continue;
          g.save();g.globalAlpha=1;g.translate(cam.x+i*SPAN-off,foot);
          g.transform(1,0,-windTip('jTree',i*SPAN,time)/2200,1,0,0);
          g.drawImage(image.plants,-BLEED,-TOP,SPAN+BLEED*2,HEIGHT);g.restore();
        }
      }
    // Dois canvases por patch; cache limitado também em número de imagens.
    while(this.cache.size>24)this.cache.delete(this.cache.keys().next().value!);
  }
  private bake(layer:number,index:number):Patch{
    const canvas=()=>makeCanvas((SPAN+BLEED*2)*DENSITY,HEIGHT*DENSITY);
    const ground=canvas(),plants=canvas(),g=plants.getContext('2d')!,base=ground.getContext('2d')!;
    for(const ctx of [g,base]){ctx.scale(DENSITY,DENSITY);ctx.translate(BLEED,TOP);}
    const worldX=(x:number)=>(index*SPAN+x)/PARALLAX[layer];
    const center=junglePalette(worldX(SPAN*.5),layer),region=center.region,color=center.color,front=layer===3;
    const r=new Rng(81881+index*7297+layer*1717),wet=center.wet>.5;
    if(front){
      // Primeiro plano fica abaixo da faixa de movimento e deixa a silhueta livre.
      for(let x=0;x<SPAN;x+=r.range(45,110)){
        ellipse(g,x,25,r.range(32,95),r.range(8,22),wet?'#183d35':'#2f4c32');
        g.strokeStyle=wet?'#32624b':'#51763e';g.lineWidth=2;
        for(let j=0;j<8;j++){g.beginPath();g.moveTo(x+j*5,20);g.quadraticCurveTo(x+j*7,-r.range(15,45),x+j*10-16,-r.range(30,65));g.stroke();}
      }
      return {ground,plants};
    }
    // Margem e névoa contínuas em coordenadas globais; a janela de cache não tem aparência própria.
    const water=base.createLinearGradient(0,-45,0,110);
    water.addColorStop(0,'rgba(94,155,135,.55)');water.addColorStop(1,'rgba(26,68,63,.85)');
    const fog=base.createLinearGradient(0,-180,0,70);
    fog.addColorStop(0,'rgba(176,211,182,0)');fog.addColorStop(.6,layer===0?'rgba(176,211,182,.3)':'rgba(133,185,155,.17)');fog.addColorStop(1,'rgba(176,211,182,0)');
    for(let x=0;x<SPAN;x+=4){
      const sample=junglePalette(worldX(x+2),layer);
      const shore=(xx:number)=>10+Math.sin((xx+index*SPAN)*.014)*16+Math.sin((xx+index*SPAN)*.032+layer)*7;
      if(sample.wet>0){base.globalAlpha=sample.wet;base.fillStyle=water;base.fillRect(x,-30,4,140);base.globalAlpha=1;}
      base.fillStyle=sample.color;base.beginPath();base.moveTo(x,110);base.lineTo(x,shore(x));base.lineTo(x+4,shore(x+4));base.lineTo(x+4,110);base.closePath();base.fill();
      if(layer<2&&sample.wet>0){base.globalAlpha=sample.wet;base.fillStyle=fog;base.fillRect(x,-180,4,250);base.globalAlpha=1;}
    }
    if(wet)for(let i=0;i<35;i++)ellipse(base,r.range(0,SPAN),r.range(-18,80),r.range(8,45),.8,layer===0?'#a2c5b1':'#699984');
    const spacing=region.kind==='swamp'?75:region.kind==='square'?240:region.kind==='farm'?250:150;
    for(let x=r.range(0,30);x<SPAN;x+=r.range(spacing*.7,spacing*1.3)){
      const sample=junglePalette(worldX(x),layer),kind=sample.region.kind,treeColor=sample.color;
      const species=kind==='swamp'?1:kind==='lake'?2:r.int(0,3);
      tree(g,r,x,r.range(-12,8),layer===0?.62:layer===1?.85:1,treeColor,species);
      if(kind==='orchard')for(let j=0;j<8;j++)ellipse(g,x+r.range(-45,45),-r.range(190,250),3.5,4,'#cc9b55');
      if(kind==='swamp'){
        // Lianas, racimos e reflexos alongados aprofundam o brejo sem cobrir sua água física.
        g.strokeStyle=treeColor;g.lineWidth=2;
        for(let j=0;j<7;j++){const xx=x+r.range(-60,60);g.beginPath();g.moveTo(xx,-r.range(160,240));g.bezierCurveTo(xx-15,-100,xx+12,-70,xx-4,-35);g.stroke();}
        g.globalAlpha=.2;tree(g,r,x,40,-.25,treeColor,1);g.globalAlpha=1;
      }
    }
    if(['gorge','ruins','sanctuary'].includes(region.kind)){
      for(let x=50;x<SPAN-50;x+=r.range(160,240)){
        const h=r.range(60,region.kind==='gorge'?190:125);
        base.fillStyle=junglePalette(worldX(x),layer).color;base.beginPath();base.moveTo(x-35,12);base.lineTo(x-24,-h*.7);base.lineTo(x+5,-h);base.lineTo(x+38,-h*.85);base.lineTo(x+49,20);base.closePath();base.fill();
        base.strokeStyle='rgba(212,225,186,.25)';base.lineWidth=2;base.beginPath();base.moveTo(x+5,-h+4);base.lineTo(x-5,-40);base.stroke();
        if(region.kind!=='gorge'){base.strokeStyle='rgba(32,65,47,.4)';base.lineWidth=5;base.beginPath();base.arc(x+6,-45,18,Math.PI,0);base.lineTo(x+24,0);base.stroke();}
      }
    }
    if(['homes','camp','craft'].includes(region.kind)&&layer<2){
      const x=r.range(100,320),w=r.range(80,140),h=r.range(50,90);
      base.fillStyle=junglePalette(worldX(x),layer).color;base.fillRect(x,-h,w,h);
      base.beginPath();base.moveTo(x-10,-h);base.lineTo(x+w*.45,-h-32);base.lineTo(x+w+15,-h);base.closePath();base.fill();
      base.fillStyle='rgba(235,211,138,.27)';base.fillRect(x+15,-h+15,16,24);
      if(region.kind==='camp'){base.strokeStyle=color;base.lineWidth=3;base.beginPath();base.moveTo(x+w+20,-110);base.lineTo(x+w+20,0);base.stroke();}
    }
    if(['farm','orchard','square','craft'].includes(region.kind)){
      const rows=region.kind==='farm'?6:2;
      for(let j=0;j<rows;j++){
        const row=(x:number)=>10+j*9+Math.sin((index*SPAN+x)*.005)*12;
        base.strokeStyle='rgba(207,193,124,.28)';base.lineWidth=4;base.beginPath();base.moveTo(0,row(0));
        for(let x=8;x<=SPAN;x+=8)base.lineTo(x,row(x));base.stroke();
        for(let x=r.range(0,12);x<SPAN;x+=r.range(17,26)){ellipse(base,x,row(x)-3,5,3,region.kind==='craft'?'#b19b6c':'#8fa65b');}
      }
    }
    return {ground,plants};
  }
}
