import {afterEach,describe,it,expect,vi} from 'vitest';
import {Input} from '../src/core/input';
afterEach(()=>vi.unstubAllGlobals());
function setup(){
  const win=new Map<string,(e:any)=>void>(),root=new Map<string,(e:any)=>void>();
  vi.stubGlobal('window',{addEventListener:(name:string,fn:(e:any)=>void)=>win.set(name,fn)});
  vi.stubGlobal('document',{addEventListener:vi.fn()});vi.stubGlobal('Element',class{});
  const input=new Input();input.attach({addEventListener:(name:string,fn:(e:any)=>void)=>root.set(name,fn)} as unknown as HTMLElement);
  const key=(code:string,down=true,repeat=false)=>win.get(down?'keydown':'keyup')!({code,repeat,preventDefault(){}});
  return {input,win,root,key};
}
describe('Comandos rápidos entre quadros',()=>{
  it.each([['Space','jump'],['KeyJ','fire'],['KeyR','reload'],['KeyF','interact'],['KeyG','grenade']] as const)
  ('preserva um toque completo de %s por um único quadro', (code,action)=>{
    const {input,key}=setup();key(code);key(code,false);input.poll();
    expect(input.state[action]).toMatchObject({held:true,pressed:true});
    input.clearEdges();input.poll();expect(input.state[action]).toMatchObject({held:false,pressed:false,released:true});
    input.poll();expect(input.state[action].released).toBe(false);
  });
  it('↑ rápido chega à interação, mas não vira direção presa',()=>{
    const {input,key}=setup();key('ArrowUp');key('ArrowUp',false);input.poll();
    expect(input.state.moveY).toBe(-1);input.poll();expect(input.state.moveY).toBe(0);
  });
  it('cliques rápidos chegam ao tiro e granada sem repetição',()=>{
    const {input,win,root}=setup();for(const button of [0,2]){
      root.get('pointerdown')!({pointerType:'mouse',button,clientX:10,clientY:20});
      win.get('pointerup')!({pointerType:'mouse',button});
    }
    input.poll();expect(input.state.fire.pressed).toBe(true);expect(input.state.grenade.pressed).toBe(true);
    input.poll();expect(input.state.fire.held).toBe(false);expect(input.state.grenade.held).toBe(false);
  });
  it('não transforma tecla segurada ou repetição do sistema em vários apertos',()=>{
    const {input,key}=setup();key('Space');input.poll();expect(input.state.jump.pressed).toBe(true);
    key('Space',true,true);input.poll();expect(input.state.jump.pressed).toBe(false);expect(input.state.jump.held).toBe(true);
    key('Space',false);input.poll();expect(input.state.jump.held).toBe(false);
  });
  it('blur, apresentações e menus não deixam comandos pendentes para depois',()=>{
    const {input,key,win}=setup();key('KeyJ');key('KeyJ',false);win.get('blur')!({});input.poll();expect(input.state.fire.pressed).toBe(false);
    key('Space');key('Space',false);input.suppressHeldActions();input.poll();expect(input.state.jump.pressed).toBe(false);
    input.enabled=false;key('KeyF');key('KeyF',false);input.enabled=true;input.poll();expect(input.state.interact.pressed).toBe(false);
  });
});
