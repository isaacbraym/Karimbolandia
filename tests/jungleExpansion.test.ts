import { describe,expect,it } from 'vitest';
import { World } from '../src/game/world';
import { buildJungle } from '../src/game/level/jungle';
import { newCtl } from './helpers/bot';
import { captureSave,applySave } from '../src/game/save';
import { TILE } from '../src/game/level';

describe('Selva ampliada',()=>{
  it('preserva checkpoints antigos, estende a saída e recupera saves nas novas regiões',()=>{
    const w=new World(buildJungle());
    expect(w.data.checkpoints.slice(0,7).map(c=>c.name)).toEqual([
      'Orla da selva','Pântano','Desfiladeiro','Depois dos cipós','Templo esquecido','Beira do lago','Margem',
    ]);
    expect(w.data.checkpoints[7].name).toBe('Saída do acampamento');
    expect(w.data.finishX).toBeGreaterThan(850*TILE);
    w.checkpointIdx=w.data.checkpoints.findIndex(c=>c.name==='Rio das raízes');
    w.checkpointSnap=w.player.snapshot();
    const save=captureSave(w), next=new World(buildJungle());
    applySave(next,save);
    expect(next.checkpointIdx).toBe(w.checkpointIdx);
    expect(next.player.x).toBeGreaterThan(next.blockX);
    expect(next.player.x).toBeGreaterThan(750*TILE);
  });
  it('os moradores sinalizam e dão passagem sem dano, projéteis ou inimigos',()=>{
    const w=new World(buildJungle()),r=w.village.residents[0];
    w.player.reset(r.x+30,r.y);
    const hp=w.player.hp, bullets=w.bullets.length;
    for(let i=0;i<120;i++)w.village.update(w,1/60);
    expect(r.gesture).toBe(1);
    expect(r.speech).toBeGreaterThan(0);
    expect(w.player.hp).toBe(hp);
    expect(w.bullets).toHaveLength(bullets);
    expect(w.data.enemies.every(e=>Math.abs(e.x-r.home)>700)).toBe(true);
    w.player.body.x=r.home-1000;
    for(let i=0;i<300;i++)w.village.update(w,1/60);
    expect(r.gesture).toBe(0);
    expect(r.speech).toBe(0);
    w.village.reset();expect(r.x).toBe(r.home);
  });
  it.each(['hunter','grenadier'] as const)('%s prepara o ataque antes de disparar e continua simulável',type=>{
    const w=new World(buildJungle());
    const spawn=w.data.enemies.find(e=>e.type===type)!;
    const e=w.enemies.find(e=>e.spawn.id===spawn.id)!;
    w.player.reset(e.x-300,spawn.y);w.invulnerable=true;
    for(let i=0;i<24;i++)e.update(w,1/60);
    expect(w.bullets).toHaveLength(0);
    for(let i=0;i<170;i++)e.update(w,1/60);
    expect(w.bullets.length).toBeGreaterThan(0);
    if(type==='grenadier'){
      expect(w.bullets[0].gravity).toBeGreaterThan(0);
      expect(w.bullets[0].explode?.radius).toBe(48);
    }
    expect(Number.isFinite(e.x)).toBe(true);
  });
  it('atravessa a ponte nova a pé sem se afogar ou ficar preso',()=>{
    const w=new World(buildJungle());w.enemies=[];w.invulnerable=true;
    const ctl=newCtl();w.player.reset(771*TILE,1024);ctl.moveX=1;
    for(let i=0;i<60*5;i++)w.update(1/60,ctl);
    expect(w.player.x).toBeGreaterThan(790*TILE);
    expect(w.player.swimming).toBe(false);
    expect(w.finished).toBe(false);
  });
});
