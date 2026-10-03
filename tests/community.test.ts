import { describe,it,expect,vi } from 'vitest';
import { World } from '../src/game/world';
import { buildJungle } from '../src/game/level/jungle';
import { COMMUNITY_START,COMMUNITY_END,DANCE_ID,DANCE_TILE } from '../src/game/level/community';
import { TILE } from '../src/game/level';
import { captureSave,applySave } from '../src/game/save';
import { validateSave } from '../src/core/saveValidation';
import { newCtl } from './helpers/bot';
import { CELEBRATION_SECONDS } from '../src/game/village';
import { clapOpen } from '../src/core/clapRhythm';
import { progress as wallet } from '../src/core/storage';

function plaza() {
  const w=new World(buildJungle());w.director.cine=null;w.pickups=[];
  const d=w.village.dance!;w.player.reset(d.x-90,d.y);w.player.lockInput=false;w.player.invuln=0;
  w.player.body.onGround=true;return w;
}
describe('Comunidade viva',()=>{
  it('tem dez vezes a extensão e casas e tarefas diversas sem inimigos na aldeia',()=>{
    const w=plaza();
    expect(COMMUNITY_END-COMMUNITY_START).toBe(620);
    expect(w.data.decos.filter(d=>d.kind==='villageHome')).toHaveLength(30);
    expect(w.village.residents.filter(r=>r.role==='child')).toHaveLength(8);
    expect(new Set(w.village.residents.map(r=>r.role))).toEqual(new Set(['resident','child','farmer','washer','weaver','carrier','carpenter']));
    expect(w.data.enemies.filter(e=>e.x>=COMMUNITY_START*TILE&&e.x<COMMUNITY_END*TILE)).toHaveLength(0);
    expect(w.data.decos.filter(d=>d.kind==='villageStream')).toHaveLength(3);
  });
  it('para, guarda a arma, aplaude e devolve controle sem gastar inventário ou receber dano',()=>{
    const w=plaza(),ctl=newCtl(),start=w.player.x,ammo=w.player.weapons.get(w.player.cur),hp=w.player.hp;
    ctl.moveX=1;ctl.fire.held=true;ctl.grenade.pressed=true;ctl.jump.pressed=true;
    const progress=vi.fn(),returned=vi.fn();w.hooks.onProgress=progress;w.hooks.onControlReturned=returned;
    for(let i=0;i<180;i++)w.update(1/60,ctl);
    expect(w.village.active).toBe(true);expect(w.player.clapping).toBe(true);expect(w.player.lockInput).toBe(true);
    expect(w.player.x).toBeCloseTo(start);expect(w.stats.shots).toBe(0);expect(w.grenades).toHaveLength(0);
    w.player.hit(w,40,1,{ignoreInvuln:true});expect(w.player.hp).toBe(hp);
    const elapsed=w.village.sceneTime;expect(elapsed).toBeCloseTo(3);
    ctl.moveX=0;ctl.fire.held=false;ctl.grenade.pressed=false;ctl.jump.pressed=false;
    for(let i=0;i<Math.ceil((CELEBRATION_SECONDS-3)*60)+2;i++)w.update(1/60,ctl);
    expect(w.village.active).toBe(false);expect(w.player.lockInput).toBe(false);expect(w.player.clapping).toBe(false);
    expect(w.player.weapons.get(w.player.cur)).toBe(ammo);expect(w.encounters.completed.has(DANCE_ID)).toBe(true);
    expect(progress).toHaveBeenCalledTimes(1);
    expect(returned).toHaveBeenCalledTimes(1);
    ctl.moveX=1;for(let i=0;i<30;i++)w.update(1/60,ctl);expect(w.player.x).toBeGreaterThan(start+30);
  });
  it('salva a participação sem repetir a cena e respawn durante a cena libera a trava',()=>{
    const w=plaza();w.village.update(w,1/60);expect(w.village.active).toBe(true);
    w.respawn();expect(w.village.active).toBe(false);expect(w.player.lockInput).toBe(false);
    const interrupted=plaza();interrupted.village.update(interrupted,1/60);
    interrupted.director.cine={kind:'opening',t:0,stage:0};interrupted.player.lockInput=true;
    interrupted.village.update(interrupted,1/60);expect(interrupted.village.active).toBe(false);
    expect(interrupted.player.lockInput).toBe(true);expect(interrupted.player.clapping).toBe(false);
    const next=plaza();for(let i=0;i<330;i++)next.update(1/60,newCtl());
    const save=captureSave(next);expect(validateSave(save)?.encounters).toContain(DANCE_ID);
    const restored=new World(buildJungle());applySave(restored,save);
    restored.player.reset((DANCE_TILE+.5)*TILE-90,1024);restored.player.body.onGround=true;
    restored.village.update(restored,1/60);expect(restored.village.active).toBe(false);
  });
  it('não captura controle no ar, em outra cena ou sob ameaça',()=>{
    const w=plaza();w.player.body.onGround=false;w.village.update(w,.1);expect(w.village.active).toBe(false);
    w.player.body.onGround=true;w.player.lockInput=true;w.village.update(w,.1);expect(w.village.active).toBe(false);
    w.player.lockInput=false;w.enemies[0].body.x=w.player.x+100;w.village.update(w,.1);expect(w.village.active).toBe(false);
  });
  it('repete por uma nova pressão de cima, mas não por tecla segurada nem sozinho após restaurar',()=>{
    const w=plaza(),ctl=newCtl(),progress=vi.fn(),returned=vi.fn();
    w.hooks.onProgress=progress;w.hooks.onControlReturned=returned;
    ctl.moveY=-1;for(let i=0;i<660;i++)w.update(1/60,ctl);
    expect(w.village.active).toBe(false);expect(returned).toHaveBeenCalledTimes(1);
    const save=captureSave(w),coins=wallet.coinsEarned,ammo=w.player.weapons.get(w.player.cur);
    ctl.moveY=0;w.update(1/60,ctl);ctl.moveY=-1;w.update(1/60,ctl);
    expect(w.village.active).toBe(true);expect(w.player.clapping).toBe(true);
    for(let i=0;i<660;i++)w.update(1/60,ctl);
    expect(w.village.active).toBe(false);expect(returned).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenCalledTimes(1);expect(wallet.coinsEarned).toBe(coins);
    expect(w.player.weapons.get(w.player.cur)).toBe(ammo);
    const restored=plaza();applySave(restored,save);
    restored.player.reset(w.village.dance!.x-90,w.village.dance!.y);
    restored.player.body.onGround=true;restored.player.lockInput=false;restored.director.cine=null;
    const fresh=newCtl();restored.update(1/60,fresh);expect(restored.village.active).toBe(false);
    fresh.moveY=-1;restored.update(1/60,fresh);expect(restored.village.active).toBe(true);
  });
  it('exige proximidade e segurança para a interação manual, inclusive no controle mobile',()=>{
    const w=plaza(),ctl=newCtl();w.encounters.completed.add(DANCE_ID);ctl.device='touch';
    ctl.moveY=-1;w.player.body.x=w.village.dance!.x+300;w.update(1/60,ctl);
    expect(w.village.active).toBe(false);
    w.player.body.x=w.village.dance!.x-90;w.player.body.onGround=true;w.update(1/60,ctl);
    expect(w.village.active).toBe(false);
    ctl.moveY=0;w.update(1/60,ctl);w.player.lockInput=true;ctl.moveY=-1;w.update(1/60,ctl);
    expect(w.village.active).toBe(false);
    w.player.lockInput=false;ctl.moveY=0;w.update(1/60,ctl);ctl.moveY=-1;w.update(1/60,ctl);
    expect(w.village.active).toBe(true);
  });
  it.each([30,60,120])('palmas sincronizam tum tum tá e pausa sem duplicar batidas a %i Hz',fps=>{
    const w=plaza(),ctl=newCtl(),sounds:{name:string;t:number}[]=[];
    w.audio=(name)=>{if(name==='clap'||name==='clapAccent')sounds.push({name,t:w.time});};
    for(let i=0;i<fps*2.5;i++)w.update(1/fps,ctl);
    expect(sounds.map(s=>s.name)).toEqual(['clap','clap','clapAccent','clap','clap','clapAccent','clap']);
    sounds.forEach((s,i)=>{
      const hit=Math.floor(i/3)*1.2+(i%3)*.3;
      expect(Math.abs(s.t-hit)).toBeLessThanOrEqual(1/fps+1e-8);
      expect(clapOpen(hit)).toBeCloseTo(0);
    });
    expect(clapOpen(.9)).toBe(1);expect(clapOpen(2.1)).toBe(1);
  });
  it('mantém índices antigos e progride por checkpoints novos e antigos em ordem espacial',()=>{
    const w=new World(buildJungle());w.enemies=[];
    expect(w.data.checkpoints[9].name).toBe('Rio das raízes');
    expect(w.data.checkpoints[9].x).toBe((1312+.5)*TILE);
    w.checkpointIdx=8;w.player.reset(922*TILE,1024);w.director.update(1/60,newCtl());
    expect(w.data.checkpoints[w.checkpointIdx].name).toBe('Riacho da aldeia');
    expect(w.blockX).toBeLessThan(w.player.x);
    w.player.reset(1314*TILE,1024);w.director.update(1/60,newCtl());expect(w.checkpointIdx).toBe(9);
    w.checkpointSnap=w.player.snapshot();const save=captureSave(w),next=new World(buildJungle());
    applySave(next,save);expect(next.checkpointIdx).toBe(9);expect(next.player.x).toBeGreaterThan(next.blockX);
    expect(next.player.x).toBe((1312+.5)*TILE);
  });
  it('atravessa toda a extensão nova a pé e as rotinas permanecem dentro dos quintais',()=>{
    const w=new World(buildJungle());w.enemies=[];w.pickups=[];w.invulnerable=true;
    w.encounters.completed.add(DANCE_ID);w.player.reset(755*TILE,1024);w.player.lockInput=false;
    const ctl=newCtl();ctl.moveX=1;for(let i=0;i<60*95&&w.player.x<1312*TILE;i++)w.update(1/60,ctl);
    expect(w.player.x).toBeGreaterThan(1311*TILE);expect(w.stats.pitFalls).toBe(0);expect(w.player.swimming).toBe(false);
    expect(w.village.residents.every(r=>Math.abs(r.x-r.home)<=81)).toBe(true);
    const worker=w.village.residents.find(r=>r.role==='washer')!;w.player.body.x=worker.home;
    w.time=1;w.village.update(w,.1);const initial=worker.work;
    w.time=1.4;w.village.update(w,.1);expect(worker.work).not.toBe(initial);
  });
});
