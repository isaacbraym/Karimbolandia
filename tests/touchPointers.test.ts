import {afterEach, describe, expect, it, vi} from 'vitest';
import {Input} from '../src/core/input';
import {TouchUI} from '../src/ui/touch';
import {World} from '../src/game/world';
import {buildJungle} from '../src/game/level/jungle';

afterEach(() => {vi.useRealTimers();vi.unstubAllGlobals();});

function element() {
  const listeners=new Map<string,(e:PointerEvent)=>void>();
  const classes=new Set<string>();
  return {
    dataset:{} as Record<string,string>,style:{transform:''},
    classList:{add:(c:string)=>classes.add(c),remove:(c:string)=>classes.delete(c),
      contains:(c:string)=>classes.has(c),toggle:(c:string,on:boolean)=>on?classes.add(c):classes.delete(c)},
    setPointerCapture:vi.fn(),getBoundingClientRect:()=>({left:0,top:0,right:100,bottom:100}),
    querySelector:()=>element(),addEventListener:(type:string,fn:(e:PointerEvent)=>void)=>listeners.set(type,fn),
    emit(type:string,pointerId=1){listeners.get(type)!({type,pointerId,clientX:50,clientY:50,preventDefault(){}} as PointerEvent);},
  };
}

function setup(action:'jump'|'fire') {
  vi.useFakeTimers();
  vi.stubGlobal('window',{setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout});
  const input=new Input();vi.spyOn(input,'haptic').mockImplementation(()=>{});
  const button=element(),base=element(),ghost=element();
  const ui=Object.assign(Object.create(TouchUI.prototype),{
    input,releaseTimers:new Map(),buttons:new Map([[action,button]]),
    base,ghost,root:{querySelectorAll:()=>[button]},stickId:-1,
  }) as TouchUI;
  if(action==='fire') (ui as any).bindFireStick(button);
  else (ui as any).bindButton(button,action);
  return {input,button,ui};
}

describe.each(['jump','fire'] as const)('Propriedade do dedo no botão %s',action=>{
  it('um segundo dedo não rouba o botão nem solta a ação do primeiro',()=>{
    const {input,button}=setup(action);
    button.emit('pointerdown',1);button.emit('pointerdown',2);button.emit('pointerup',2);
    expect(button.dataset.pid).toBe('1');expect(input.touch.held[action]).toBe(true);
    button.emit('pointerup',1);vi.advanceTimersByTime(45);
    expect(input.touch.held[action]).toBe(false);
  });
  it.each(['pointercancel','lostpointercapture'])('solta imediatamente ao receber %s',type=>{
    const {input,button}=setup(action);button.emit('pointerdown');button.emit(type);
    expect(input.touch.held[action]).toBe(false);
    input.poll();expect(input.state[action].pressed).toBe(false);
    expect(button.dataset.pid).toBeUndefined();expect(vi.getTimerCount()).toBe(0);
  });
  it('o timeout anterior não encurta a tolerância de um toque novo',()=>{
    const {input,button}=setup(action);
    button.emit('pointerdown');button.emit('pointerup');vi.advanceTimersByTime(30);
    button.emit('pointerdown',2);button.emit('pointerup',2);vi.advanceTimersByTime(15);
    expect(input.touch.held[action]).toBe(true);
    vi.advanceTimersByTime(29);expect(input.touch.held[action]).toBe(true);
    vi.advanceTimersByTime(1);expect(input.touch.held[action]).toBe(false);
  });
  it('ocultar os controles limpa a captura e permite um novo toque',()=>{
    const {input,button,ui}=setup(action);
    button.emit('pointerdown');ui.releaseAll();
    expect(button.dataset.pid).toBeUndefined();expect(input.touch.held[action]).toBe(false);
    button.emit('pointerdown',2);button.emit('pointercancel',1);
    expect(input.touch.held[action]).toBe(true);expect(button.dataset.pid).toBe('2');
    button.emit('pointerup',2);ui.releaseAll();expect(vi.getTimerCount()).toBe(0);
  });
  it('preserva um toque concluído no poll sem repetir a borda',()=>{
    const {input,button}=setup(action);button.emit('pointerdown');button.emit('pointerup');
    input.poll();expect(input.state[action].pressed).toBe(true);
    input.poll();expect(input.state[action].pressed).toBe(false);
    vi.advanceTimersByTime(45);input.poll();expect(input.state[action].released).toBe(true);
  });
});

describe('Pulo touch responsivo',()=>{
  it('dois toques separados por menos de 45 ms chegam como dois apertos',()=>{
    const {input,button}=setup('jump');
    button.emit('pointerdown');input.poll();expect(input.state.jump.pressed).toBe(true);
    button.emit('pointerup');vi.advanceTimersByTime(10);button.emit('pointerdown',2);
    input.poll();expect(input.state.jump.pressed).toBe(true);
    input.poll();expect(input.state.jump).toMatchObject({held:true,pressed:false});
  });
  it('preserva ambos os toques entre quadros, mesmo após atraso de 150 ms',()=>{
    const {input,button}=setup('jump');
    for(const id of [1,2]) {button.emit('pointerdown',id);button.emit('pointerup',id);}
    vi.advanceTimersByTime(150);
    input.poll();expect(input.state.jump.pressed).toBe(true);input.clearEdges();
    input.poll();expect(input.state.jump.pressed).toBe(true);input.clearEdges();
    input.poll();expect(input.state.jump).toMatchObject({held:false,pressed:false,released:true});
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancelar o segundo dedo não apaga o primeiro toque concluído',()=>{
    const {input,button}=setup('jump');
    button.emit('pointerdown');button.emit('pointerup');
    button.emit('pointerdown',2);button.emit('pointercancel',2);
    input.poll();expect(input.state.jump.pressed).toBe(true);
    input.poll();expect(input.state.jump.pressed).toBe(false);
  });
  it('mantém a altura do toque curto e não repete o pulo durante a tolerância',()=>{
    const {input,button}=setup('jump');button.emit('pointerdown');button.emit('pointerup');
    input.poll();expect(input.state.jump).toMatchObject({held:true,pressed:true});
    vi.advanceTimersByTime(30);input.poll();expect(input.state.jump).toMatchObject({held:true,pressed:false});
    vi.advanceTimersByTime(15);input.poll();expect(input.state.jump).toMatchObject({held:false,pressed:false,released:true});
  });
  it('ocultar controles e fechar apresentação descartam pulos pendentes',()=>{
    const {input,button,ui}=setup('jump');
    button.emit('pointerdown');button.emit('pointerup');ui.releaseAll();
    input.poll();expect(input.state.jump.pressed).toBe(false);
    button.emit('pointerdown',2);button.emit('pointerup',2);input.suppressHeldActions();
    input.poll();expect(input.state.jump.pressed).toBe(false);
    button.emit('pointerdown',3);input.poll();expect(input.state.jump.pressed).toBe(true);
  });
  it('o toque seguinte solta o cipó sem exigir um quadro de botão solto',()=>{
    const {input,button}=setup('jump');
    const w=new World(buildJungle());w.director.cine=null;
    const p=w.player,v=w.vines[0];
    button.emit('pointerdown');input.poll();button.emit('pointerup');
    p.reset(v.x,v.y+v.len+40);p.vine=v;p.vineD=v.len;v.held=true;
    button.emit('pointerdown',2);input.poll();p.update(w,1/60,input.state);
    expect(p.vine).toBeNull();expect(v.held).toBe(false);expect(p.body.vy).toBeLessThan(0);
    button.emit('pointerup',2);vi.advanceTimersByTime(10);button.emit('pointerdown',3);
    input.poll();p.update(w,1/60,input.state);
    expect(p.glide).toBe(true); // The next rapid tap reaches the airborne jump too.
  });
});
