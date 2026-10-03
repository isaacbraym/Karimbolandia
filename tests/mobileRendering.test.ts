import {afterEach,describe,it,expect,vi} from 'vitest';
import {FramePacer} from '../src/core/framePacing';
import {targetRenderHeight,backingSize,resizeBacking} from '../src/core/renderBudget';
import {Game} from '../src/game/game';

afterEach(()=>vi.unstubAllGlobals());
describe('Orçamento de renderização mobile',()=>{
  it.each([60,90,120,144])('mantém no máximo 60 desenhos/s e tempo real numa tela de %i Hz',hz=>{
    const p=new FramePacer();let count=0,total=0;
    for(let i=0;i<=hz*10;i++){const dt=p.take(i*1000/hz);if(dt!==null){count++;total+=dt;}}
    expect(count).toBe(601);expect(total).toBeCloseTo(10000);
  });
  it('tolera pequenas variações de timestamp sem cair para metade da frequência',()=>{
    const p=new FramePacer();let count=0;
    for(let i=0;i<=600;i++)if(p.take(i*1000/60+(i%2?.1:0))!==null)count++;
    expect(count).toBe(601);
  });
  it('não tenta recuperar centenas de quadros após ocultar, voltar ou trocar estado',()=>{
    const p=new FramePacer();p.take(0);expect(p.take(8)).toBeNull();
    expect(p.take(60000)).toBe(0);expect(p.take(60008)).toBeNull();
    p.reset(70000);expect(p.take(70000)).toBe(0);expect(p.take(70008)).toBeNull();
    expect(p.take(70009,30)).toBe(0);expect(p.take(70025,30)).toBeNull();
    expect(p.take(70043,30)).toBeCloseTo(34);expect(p.take(NaN)).toBeNull();
  });
  it('reduz o buffer mesmo abaixo de uma unidade lógica e mantém geometria e aspect ratio',()=>{
    const h=targetRenderHeight(400,3,'medium',true);
    expect(h).toBe(540);
    const high=backingSize(820,360,h,1),low=backingSize(820,360,h,.5);
    expect(high).toMatchObject({width:1230,height:540});
    expect(low).toMatchObject({width:615,height:270});
    expect(low.width/low.height).toBeCloseTo(820/360);
    expect(low.width*low.height).toBe(high.width*high.height/4);
    expect(targetRenderHeight(400,3,'medium',false)).toBe(720);
    expect(targetRenderHeight(400,4,'high',true)).toBe(720);
    expect(targetRenderHeight(240,1,'low',true)).toBe(360);
  });
  it('repetir resize sem mudança não descarta o canvas e só altera o eixo necessário',()=>{
    let width=1230,height=540;const writes=vi.fn();
    const c={get width(){return width;},set width(v:number){writes('w');width=v;},
      get height(){return height;},set height(v:number){writes('h');height=v;}};
    for(let i=0;i<20;i++)resizeBacking(c,1230,540);
    expect(writes).not.toHaveBeenCalled();resizeBacking(c,1230,270);
    expect(writes.mock.calls).toEqual([['h']]);
  });
  it('o loop real pula render e simulação redundantes a 120 Hz; menus usam 30 Hz',()=>{
    vi.stubGlobal('requestAnimationFrame',vi.fn());
    vi.stubGlobal('document',{hidden:false,hasFocus:()=>true});
    const frame=Game.prototype as unknown as {frame:(now:number)=>void};
    const game=Object.assign(Object.create(Game.prototype),{pacer:new FramePacer(),state:'playing',world:{},
      frames:0,lastFpsUpdate:0,hud:{fps:0},autoQuality:vi.fn(),step:vi.fn(),updateTouchState:vi.fn(),
      input:{poll:vi.fn(),state:{pause:{pressed:false}}},render:vi.fn(),prof:{update:0,render:0},metrics:null});
    for(let i=0;i<=120;i++)frame.frame.call(game,i*1000/120);
    expect(game.render).toHaveBeenCalledTimes(61);expect(game.step).toHaveBeenCalledTimes(61);
    expect(game.step.mock.calls.reduce((s:number,c:unknown[])=>s+Number(c[1]),0)).toBeCloseTo(1);
    game.state='menu';game.menuScene={update:vi.fn()};game.render.mockClear();
    for(let i=0;i<=120;i++)frame.frame.call(game,1100+i*1000/120);
    expect(game.render).toHaveBeenCalledTimes(31);
    (document as unknown as {hidden:boolean}).hidden=true;frame.frame.call(game,5000);
    expect(game.render).toHaveBeenCalledTimes(31);
  });
});
