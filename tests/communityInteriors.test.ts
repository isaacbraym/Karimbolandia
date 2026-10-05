import { describe, expect, it } from 'vitest';
import { World } from '../src/game/world';
import { buildJungle } from '../src/game/level/jungle';
import { buildLevel } from '../src/game/level/index';
import { buildingStyle } from '../src/game/buildings';
import { InteriorStore, ROOM_IDS } from '../src/game/interiorStore';
import { InteriorSim } from '../src/game/interior/sim';
import { adjacentCells, findPath } from '../src/game/interior/grid';
import { makeCommunityRoom } from '../src/game/interior/rooms/community';
import { captureSave, applySave } from '../src/game/save';
import { validateSave } from '../src/core/saveValidation';
import { newCtl } from './helpers/bot';

describe('Casas distintas e exploração livre', () => {
  it('todas as portas coincidem com o caminho caminhável e podem ser oferecidas sem ameaça', () => {
    const w=new World(buildJungle());w.enemies=[];
    const spots=w.exploration.spots.filter(s=>s.interior);
    expect(spots).toHaveLength(33);
    for(const s of spots){
      w.player.reset(s.x,s.y-16);
      for(let i=0;i<40;i++)w.player.update(w,1/60,newCtl());
      expect(w.exploration.nearest(w),s.title).toBe(s);
      expect(w.exploration.safe(w,s),s.title).toBe(true);
    }
    const fronts=w.data.decos.filter(d=>d.kind==='villageHome');
    expect(new Set(fronts.map(d=>JSON.stringify(buildingStyle(d.variant!)))).size).toBe(30);
  });

  it('cada nova planta é distinta, com porta, patamares e todos os móveis alcançáveis', () => {
    const layouts=new Set<string>();
    for(const id of ROOM_IDS.filter(id=>id.includes(':'))){
      const room=makeCommunityRoom(id);layouts.add(JSON.stringify([room.rows,room.furniture.map(f=>[f.paint,f.gx,f.gy]),room.palette]));
      for(const floor of room.floors!){
        const sim=new InteriorSim(floor,new InteriorStore());
        expect(sim.grid.walkable(floor.spawn.x,floor.spawn.y),floor.title).toBe(true);
        expect(findPath(sim.grid,floor.spawn,[floor.door])?.length??0,floor.title).toBeGreaterThan(0);
        for(const f of floor.furniture){
          const reachable=adjacentCells(sim.grid,f).some(c=>(findPath(sim.grid,floor.spawn,[c])?.length??0)>0 || c.x===floor.spawn.x&&c.y===floor.spawn.y);
          expect(reachable,`${floor.title}: ${f.name}`).toBe(true);
        }
        if(room.floors!.length===2){
          const stairs=floor.furniture.find(f=>f.id==='stairs')!;
          stairs.verbs(sim,stairs)[0].run(sim,stairs);
          expect(sim.drain()).toContainEqual({type:'floor',index:floor.floor===0?1:0});
        }
      }
    }
    expect(layouts.size).toBe(31);
  });

  it('preserva os 33 interiores no save e não duplica recompensas ao voltar ou trocar de andar',()=>{
    const w=new World(buildJungle());
    for(const id of ROOM_IDS){const f=w.interiors.flags(id);f.set('visited');w.interiors.commit(f);}
    const cap=validateSave(captureSave(w))!;expect(cap).not.toBeNull();expect(cap.interiors).toHaveLength(33);
    const loaded=new World(buildJungle());applySave(loaded,cap);expect(loaded.interiors.toSave()).toEqual(cap.interiors);
    const house=makeCommunityRoom('home:1'),store=new InteriorStore();
    for(const floor of [house,house.floors![1],house]){
      const sim=new InteriorSim(floor,store),chest=floor.furniture.find(f=>f.id==='chest')!;
      chest.verbs(sim,chest)[0].run(sim,chest);
      const coins=sim.drain().filter(e=>e.type==='coins');
      expect(coins).toHaveLength(store.has('home:1','gift')?0:1);sim.commit();
    }
  });

  it('checkpoints de ambas as fases mantêm entidades e caminho de volta inclusive após restore',()=>{
    for(const data of [buildLevel(),buildJungle()]){
      const w=new World(data),counts=[w.enemies.length,w.pickups.length,w.props.length];
      for(let i=1;i<data.checkpoints.length;i++){
        w.checkpointIdx=i;w.blockBehind(i);
        expect(w.blockX).toBe(-Infinity);expect(w.blockAnimT).toBe(-1);
        expect([w.enemies.length,w.pickups.length,w.props.length]).toEqual(counts);
        expect(w.props.some(p=>p.spawn.id===-950)).toBe(false);
      }
      const loaded=new World(data);applySave(loaded,captureSave(w));
      expect(loaded.blockX).toBe(-Infinity);expect(loaded.props.some(p=>p.spawn.id===-950)).toBe(false);
    }
  });

  it('a balada tem exatamente cinco vezes os 13 dançarinos anteriores em cinco planos',()=>{
    const w=new World(buildLevel());expect(w.club.crowd).toHaveLength(65);
    expect(new Set(w.club.crowd.map(d=>d.depth)).size).toBe(5);
    expect(new Set(w.club.crowd.map(d=>d.style)).size).toBe(4);
    expect(w.data.beams).toEqual([]);
  });

  it('uma visita sem lista de travessuras não concede moedas nem KARIMBADO automaticamente',()=>{
    const sim=new InteriorSim(makeCommunityRoom('home:1'),new InteriorStore());
    for(let i=0;i<120;i++)sim.update(1/60,{mx:0,my:0,sneak:false});
    expect(sim.has('karimbado')).toBe(false);
    expect(sim.drain().filter(e=>e.type==='coins'||e.type==='karimbado')).toEqual([]);
  });

  it('as cabanas convertidas mantêm acesso a todos os objetos de investigação anteriores',()=>{
    const w=new World(buildJungle());
    for(const spot of w.exploration.spots.filter(s=>s.interior?.startsWith('hut:'))){
      const sim=new InteriorSim(makeCommunityRoom(spot.interior!),new InteriorStore());
      sim.drain();
      for(const f of sim.room.furniture)for(const v of f.verbs(sim,f))v.run(sim,f);
      const objects=new Set(sim.drain().filter(e=>e.type==='legacy').map(e=>e.obj));
      expect([...objects].sort()).toEqual(spot.objects.map(o=>o.id).sort());
    }
  });
});
