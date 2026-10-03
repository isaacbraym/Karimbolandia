import {afterEach, describe, expect, it, vi} from 'vitest';
import {Input} from '../src/core/input';
import {TouchUI} from '../src/ui/touch';

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
