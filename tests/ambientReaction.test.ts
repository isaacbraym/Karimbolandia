import {afterEach,describe,expect,it,vi} from 'vitest';
vi.mock('../src/art/cityFauna',()=>({drawCityAnimal:vi.fn()}));
import {drawCityAnimal} from '../src/art/cityFauna';
import {AmbientReaction,REACTION_SECONDS,wildlifeNoiseRadius} from '../src/game/ambientReaction';
import {World} from '../src/game/world';
import {buildLevel} from '../src/game/level/index';
import {buildJungle} from '../src/game/level/jungle';
import {captureSave} from '../src/game/save';
import {newCtl} from './helpers/bot';

afterEach(()=>vi.restoreAllMocks());

describe('Fauna assustada pelo combate',()=>{
  it.each(['cat','owl','bird'] as const)('%s foge do barulho e retorna exatamente ao ponto inicial',kind=>{
    const r=new AmbientReaction(kind);
    expect(r.trigger(100,80)).toBe(true);
    for(let i=0;i<90;i++)r.update(1/60);
    expect(r.dx).toBeLessThan(0);expect(r.facing).toBe(-1);
    if(kind!=='cat')expect(r.dy).toBeLessThan(-40);
    r.update(REACTION_SECONDS);
    expect(r.active).toBe(false);expect(r.dx).toBe(0);expect(r.dy).toBe(0);
  });
  it('uma rajada não reinicia a fuga a cada tiro; só reage novamente depois de descansar',()=>{
    const r=new AmbientReaction('owl');r.trigger(0,100);
    for(let i=0;i<250;i++){r.update(1/60);expect(r.trigger(0,100)).toBe(false);}
    expect(r.active).toBe(false);expect(r.cooldown).toBeGreaterThan(0);
    r.update(5);expect(r.trigger(200,100)).toBe(true);expect(r.facing).toBe(-1);
  });
  it('a duração e posição independem da frequência de atualização',()=>{
    const fast=new AmbientReaction('bird'),slow=new AmbientReaction('bird');
    fast.trigger(0,100);slow.trigger(0,100);
    for(let i=0;i<300;i++)fast.update(1/120);
    for(let i=0;i<75;i++)slow.update(1/30);
    expect(fast.dx).toBeCloseTo(slow.dx,6);expect(fast.dy).toBeCloseTo(slow.dy,6);
    expect(fast.cooldown).toBeCloseTo(slow.cooldown,6);
    fast.update(2);slow.update(2);expect(fast.active).toBe(false);expect(slow.active).toBe(false);
  });
  it('ignora sons tranquilos, sem posição, inválidos ou longe dos animais',()=>{
    const w=new World(buildLevel()),a=w.wildlife.cityAnimals.find(a=>a.kind==='cat')!;
    expect(wildlifeNoiseRadius('coin')).toBe(0);expect(wildlifeNoiseRadius('weapon')).toBe(0);
    for(const sound of ['coin','weapon','clap','step'] as const)w.audio(sound,1,a.x);
    w.audio('shotgun');w.audio('shotgun',0,a.x);w.audio('shotgun',1,NaN);
    w.audio('shotgun',1,a.x+1000);w.audio('shotgun',NaN,a.x);
    expect(a.reaction!.active).toBe(false);
    w.audio('shotgun',1,a.x+80);expect(a.reaction!.active).toBe(true);
    expect(w.wildlife.cityAnimals.filter(a=>a.reaction?.active)).toHaveLength(1);
  });
  it('um disparo real dispara a reação mesmo fora do alcance audível da câmera',()=>{
    const w=new World(buildLevel()),a=w.wildlife.cityAnimals.find(a=>a.kind==='owl')!;
    w.enemies=[];w.player.reset(a.x-70,1000);w.player.lockInput=false;w.player.fireCd=0;
    w.camera.x=-10000;const ctl=newCtl();ctl.fire.held=true;
    w.player.update(w,1/60,ctl);
    expect(w.bullets.length).toBeGreaterThan(0);expect(a.reaction!.active).toBe(true);
  });
  it('na selva só o pássaro sai do ninho, sem mudar save, moedas ou população',()=>{
    vi.spyOn(Date,'now').mockReturnValue(1234567);
    const w=new World(buildJungle()),h=w.wildlife.habitats.find(h=>h.kind==='bird')!;
    const before=captureSave(w),count=w.wildlife.habitats.length;
    w.audio('explosion',1,h.x+77*h.side+50);
    for(let i=0;i<80;i++)w.wildlife.update(w,1/60);
    expect(h.reaction!.active).toBe(true);expect(Math.abs(h.reaction!.dx)).toBeGreaterThan(50);
    expect(w.wildlife.habitats.filter(h=>h.reaction?.active)).toHaveLength(1);
    expect(w.wildlife.habitats).toHaveLength(count);expect(captureSave(w)).toEqual(before);
    w.startRun();expect(h.reaction!.active).toBe(false);expect(h.reaction!.cooldown).toBe(0);
  });
  it('o culling acompanha a coruja em voo mesmo quando o telhado já ficou fora da câmera',()=>{
    const w=new World(buildLevel()),a=w.wildlife.cityAnimals.find(a=>a.kind==='owl')!;
    w.audio('shotgun',1,a.x-60);w.wildlife.update(w,1.3);
    vi.spyOn(w.camera,'visible').mockImplementation((x,y)=>Math.abs(x-a.x-a.reaction!.dx)<1&&Math.abs(y-a.y-a.reaction!.dy)<1);
    vi.mocked(drawCityAnimal).mockClear();const g={} as CanvasRenderingContext2D;
    w.wildlife.drawTrees(g,w);expect(drawCityAnimal).toHaveBeenCalledExactlyOnceWith(g,a,w.time);
    vi.spyOn(w.camera,'visible').mockReturnValue(false);vi.mocked(drawCityAnimal).mockClear();
    w.wildlife.drawTrees(g,w);expect(drawCityAnimal).not.toHaveBeenCalled();
  });
});
