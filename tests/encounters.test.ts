import { describe, expect, it, vi } from 'vitest';
import { RING_RADIUS, TRAIL, TrailChallenge, ringContact, type TrailDefinition } from '../src/game/encounters/challenge';
import { encounterCatalog } from '../src/game/encounters/catalog';
import { makeWorld } from './helpers/bot';
import { newCtl } from './helpers/bot';
import { World } from '../src/game/world';
import { buildJungle } from '../src/game/level/jungle';
import { applySave, captureSave, freshSave, nextStageSave } from '../src/game/save';
import { validateSave } from '../src/core/saveValidation';

const definition = (): TrailDefinition => ({ id: 'test:trail', title: 'Trail', theme: 'delivery', points: [{ x: 100, y: 100 }, { x: 220, y: 100 }, { x: 340, y: 100 }], seconds: 3, coins: 12 });
describe('encontros opcionais', () => {
  it('detecta o aro atravessado por avanço sem exigir um frame dentro dele', () => {
    expect(ringContact({ x: 50, y: 100 }, { x: 150, y: 100 }, { x: 100, y: 100 })).toBeCloseTo(.22);
    expect(ringContact({ x: 50, y: 140 }, { x: 150, y: 140 }, { x: 100, y: 100 })).toBeNull();
    const trail = new TrailChallenge(definition());
    trail.update(0, 50, 100);
    expect(trail.update(.1, 150, 100) & TRAIL.START).toBeTruthy();
    expect(trail.next).toBe(1);
    trail.update(.1, 280, 100);
    expect(trail.update(.1, 390, 100) & TRAIL.COMPLETE).toBeTruthy();
    expect(trail.update(10, 100, 100)).toBe(0);
  });
  it('andar sob o aro não inicia; o jogador pode ignorar o desafio', () => {
    const trail = new TrailChallenge(definition());
    trail.update(0, 50, 164);trail.update(1, 390, 164);
    expect(trail.status).toBe('ready');expect(trail.left).toBe(3);
    trail.update(0, 340, 100);
    expect(trail.next).toBe(0);
  });
  it('contato depois do prazo não ganha; pode voltar e tentar sem penalidade', () => {
    const trail = new TrailChallenge(definition());
    trail.update(0,100,100);trail.update(2.95,140,100);
    expect(trail.update(.2,240,100) & TRAIL.EXPIRED).toBeTruthy();
    expect(trail.next).toBe(1);expect(trail.status).toBe('cooldown');
    trail.update(2.1,200,180);expect(trail.status).toBe('ready');
    expect(trail.update(0,100,100) & TRAIL.START).toBeTruthy();
  });
  it('um passo longo não concede os aros que só seriam alcançados depois do prazo', () => {
    const trail = new TrailChallenge(definition());trail.update(0,50,100);
    const flags=trail.update(10,390,100);
    expect(flags & TRAIL.EXPIRED).toBeTruthy();expect(flags & TRAIL.COMPLETE).toBeFalsy();
    expect(trail.next).toBe(1);
  });
  it('reseta continuidade ao suspender e o guia acompanha suavemente o próximo aro', () => {
    const trail = new TrailChallenge(definition());
    trail.update(0,50,100);trail.suspend();trail.update(.1,280,100);
    expect(trail.status).toBe('ready');
    trail.update(.1,100,100);trail.animate(.1);
    expect(trail.guide.x).toBeGreaterThan(100);expect(trail.guide.x).toBeLessThan(220);
  });
  it.each([1,2])('fase %i tem percurso curto, acima do chão, sem água, buracos ou checkpoint no meio', stage => {
    const w = stage === 1 ? makeWorld() : new World(buildJungle());
    const [def] = encounterCatalog(w.data);
    expect(def.points).toHaveLength(4);
    for(const p of def.points){
      expect(w.level.solidAtPx(p.x,p.y)).toBe(false);
      const floor=w.level.groundBelow(p.x,p.y);
      expect(floor).not.toBeNull();expect(floor!-p.y).toBe(82);
      expect(floor!-p.y).toBeGreaterThan(w.player.body.h/2+RING_RADIUS);
    }
    expect(w.data.checkpoints.some(cp=>cp.x>def.points[0].x&&cp.x<def.points.at(-1)!.x)).toBe(false);
    expect(def.points.at(-1)!.x-def.points[0].x).toBeLessThan(700);
  });
  it('sem chão adequado não injeta um encontro num mapa diferente', () => {
    const w=makeWorld();vi.spyOn(w.level,'groundBelow').mockReturnValue(null);
    expect(encounterCatalog(w.data)).toEqual([]);
  });
  it.each([1,2])('os quatro aros da fase %i são alcançáveis com salto real, preservando colisões de chão/props', stage => {
    const w=stage===1?makeWorld():new World(buildJungle()),trail=w.encounters.trails[0],ctl=newCtl();
    w.player.lockInput=false;w.director.cine=null;
    for(const point of trail.def.points){
      // Test each landing/jump using the actual player and unchanged level/solids.
      const ground=w.level.groundBelow(point.x,point.y)!;
      w.player.reset(point.x,ground);w.player.body.onGround=true;
      ctl.jump.pressed=true;ctl.jump.held=true;
      const expected=trail.next+1;
      for(let frame=0;frame<50&&trail.next<expected;frame++){
        w.player.update(w,1/60,ctl);w.encounters.update(w,1/60);ctl.jump.pressed=false;
      }
      expect(trail.next).toBe(expected);
      ctl.jump.held=false;
    }
    expect(trail.status).toBe('complete');
  });
  it.each([1,2])('percurso da fase %i pode ser completado andando e saltando, sem teleportes entre aros', stage => {
    const w=stage===1?makeWorld():new World(buildJungle()),trail=w.encounters.trails[0],ctl=newCtl();
    const first=trail.def.points[0];w.player.reset(first.x-64,w.level.groundBelow(first.x,first.y)!);
    w.player.lockInput=false;w.director.cine=null;let hold=0;
    for(let frame=0;frame<1200&&trail.status!=='complete';frame++){
      const target=trail.def.points[Math.min(trail.next,3)],dx=target.x-w.player.x;
      ctl.moveX=Math.abs(dx)>5?Math.sign(dx):0;
      ctl.jump.pressed=w.player.body.onGround&&(Math.abs(dx)<30||w.player.body.wallDir!==0);
      if(ctl.jump.pressed)hold=.22;
      ctl.jump.held=hold>0;hold-=1/60;
      w.player.update(w,1/60,ctl);w.encounters.update(w,1/60);
    }
    expect({status:trail.status,next:trail.next}).toEqual({status:'complete',next:4});
  });
  it('recompensa uma vez, preserva ao morrer/reabrir e não avança checkpoint', () => {
    const w=makeWorld(),trail=w.encounters.trails[0],saved=vi.fn();
    w.hooks.onProgress=saved;
    const before=w.tokens;
    for(const point of trail.def.points){w.player.reset(point.x,point.y+w.player.body.h/2);w.encounters.update(w,.1);}
    expect(trail.status).toBe('complete');expect(w.tokens).toBe(before+12);
    expect(w.checkpointIdx).toBe(-1);expect(saved).toHaveBeenCalledTimes(1);
    w.respawn();expect(trail.status).toBe('complete');
    const s=validateSave(captureSave(w))!;const restored=makeWorld();applySave(restored,s);
    expect(restored.encounters.trails[0].status).toBe('complete');
    const point=trail.def.points[0];restored.player.reset(point.x,point.y+restored.player.body.h/2);restored.encounters.update(restored,1);
    expect(restored.tokens).toBe(before+12);
    expect(nextStageSave(w,2).encounters).toEqual([]);
    w.restart();expect(w.encounters.completed.size).toBe(0);expect(trail.status).toBe('ready');
  });
  it('cinemática congela o relógio e morte reinicia só a tentativa incompleta', () => {
    const w=makeWorld(),trail=w.encounters.trails[0],point=trail.def.points[0];
    w.player.reset(point.x,point.y+w.player.body.h/2);w.encounters.update(w,.1);
    const left=trail.left;w.player.lockInput=true;w.encounters.update(w,20);
    expect(trail.left).toBe(left);w.respawn();expect(trail.status).toBe('ready');
  });
  it('seguir para o próximo checkpoint abandona o desafio sem prender contador ou dar prêmio', () => {
    const w=makeWorld(),trail=w.encounters.trails[0],point=trail.def.points[0];
    w.player.reset(point.x,point.y+w.player.body.h/2);w.encounters.update(w,.1);
    expect(w.encounters.active).toBe(trail);
    w.blockX=point.x+100;w.encounters.update(w,.1);
    expect(w.encounters.active).toBeUndefined();expect(w.encounters.completed.size).toBe(0);expect(w.tokens).toBe(0);
  });
  it('save antigo é compatível e rejeita campos novos malformados', () => {
    const old=freshSave(1);delete old.encounters;expect(validateSave(old)?.encounters).toEqual([]);
    expect(validateSave({...old,encounters:['city:lost-delivery','city:lost-delivery']})?.encounters).toEqual(['city:lost-delivery']);
    for(const invalid of ['city:lost-delivery',['<script>'],[12],Array(65).fill('city:test')])expect(validateSave({...old,encounters:invalid})).toBeNull();
    const ids=['city:lost-delivery'];const valid=validateSave({...old,encounters:ids})!;ids.length=0;expect(valid.encounters).toHaveLength(1);
  });
});
