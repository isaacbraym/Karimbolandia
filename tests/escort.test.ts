import { describe, expect, it, vi } from 'vitest';
import { DroneEscort, ESCORT, FLIGHT_HEIGHT, type EscortDefinition } from '../src/game/encounters/escort';
import { escortCatalog } from '../src/game/encounters/catalog';
import { makeWorld, newCtl } from './helpers/bot';
import { buildJungle } from '../src/game/level/jungle';
import { captureSave, applySave } from '../src/game/save';
import { validateSave } from '../src/core/saveValidation';
import { TILE, T } from '../src/game/level';

const def = (): EscortDefinition => ({ id: 'test:drone', title: 'Drone', start: { x: 100, y: 500 }, destination: { x: 420, y: 500 }, coins: 22 });
const pilot = (x = 100) => ({ x, feetY: 500, grounded: true, speed: 0 });
function repair(e: DroneEscort) { for (let i = 0; i < 90; i++) e.update(1 / 60, pilot()); }
describe('resgate do drone', () => {
  it('requer reparo continuo no chao e parado, sem ativar ao passar correndo', () => {
    const e = new DroneEscort(def());
    for (let i = 0; i < 120; i++) e.update(1 / 60, { ...pilot(), speed: 200 });
    expect(e.status).toBe('ready');expect(e.repair).toBe(0);
    for (let i = 0; i < 40; i++) e.update(1 / 60, pilot());
    expect(e.repair).toBeGreaterThan(.5);
    e.update(1 / 60, { ...pilot(), grounded: false });expect(e.repair).toBe(0);
    repair(e);expect(e.status).toBe('escort');
  });
  it('uma pausa longa nao vira um reparo instantaneo e suspender interrompe a continuidade', () => {
    const e = new DroneEscort(def());e.update(30, pilot());expect(e.repair).toBe(.1);
    e.suspend();expect(e.repair).toBe(0);
    repair(e);const point={...e.drone};e.suspend();expect(e.drone).toEqual(point);
  });
  it('o jogador nao completa sozinho: espera o drone chegar e entregar a carga', () => {
    const e = new DroneEscort(def());repair(e);
    expect(e.update(1 / 60, pilot(380)) & ESCORT.COMPLETE).toBe(0);
    expect(e.drone.x).toBeLessThan(120);
    let flags = 0;
    for (let i = 0; i < 100; i++) flags |= e.update(1 / 60, pilot(380));
    for (let i = 0; i < 120; i++) flags |= e.update(1 / 60, pilot(420));
    expect(flags & ESCORT.COMPLETE).toBeTruthy();expect(e.status).toBe('complete');
    expect(e.drone.x).toBeGreaterThan(365);expect(e.drone.y).toBeCloseTo(500-FLIGHT_HEIGHT);
    expect(e.update(1, pilot(420))).toBe(0);
  });
  it('abandonar o drone permite tentar de novo, sem teleporte ate a base', () => {
    const e = new DroneEscort(def());repair(e);
    expect(e.update(1 / 60, pilot(1000))).toBe(ESCORT.LOST);
    expect(e.status).toBe('ready');expect(e.drone.x).toBe(100);
    repair(e);expect(e.status).toBe('ready');
    for(let i=0;i<220;i++)e.update(1/60,pilot());expect(e.status).toBe('escort');
  });
  it('somente cidade e percurso seco seguro sem checkpoints ou objetos sobrepostos', () => {
    const w = makeWorld(), [d] = escortCatalog(w.data);
    expect(d).toBeDefined();expect(escortCatalog(buildJungle())).toEqual([]);
    for(let x=d.start.x;x<=d.destination.x;x+=16){
      expect(w.level.groundBelow(x,d.start.y-32,64)).not.toBeNull();
      expect(w.level.solidAtPx(x,d.start.y-FLIGHT_HEIGHT)).toBe(false);
    }
    expect(w.data.checkpoints.some(cp=>cp.x>d.start.x&&cp.x<d.destination.x)).toBe(false);
    expect(w.props.some(p=>p.x>=d.start.x-32&&p.x<=d.destination.x+32)).toBe(false);
    const changed={...w.data,water:[{id:99,kind:'swamp' as const,x:d.start.x,y:d.start.y,w:32,h:64}]};
    expect(escortCatalog(changed)).toEqual([]);
    vi.spyOn(w.level,'groundBelow').mockReturnValue(null);expect(escortCatalog(w.data)).toEqual([]);
  });
  it('percurso real anda ate a base, paga uma vez e restaura conclusao no save', () => {
    const w=makeWorld(), e=w.encounters.escorts[0], ctl=newCtl();
    w.enemies=[];w.pickups=[];w.director.cine=null;w.player.reset(e.def.start.x,e.def.start.y);w.player.lockInput=false;
    const initial=w.tokens;
    for(let i=0;i<110;i++)w.update(1/60,ctl);
    expect(e.status).toBe('escort');
    for(let i=0;i<600&&e.status!=='complete';i++){
      const dx=e.def.destination.x-w.player.x;ctl.moveX=Math.abs(dx)>7?Math.sign(dx):0;w.update(1/60,ctl);
    }
    expect(e.status).toBe('complete');expect(w.tokens-initial).toBe(22);
    for(let i=0;i<100;i++)w.encounters.update(w,1/60);
    expect(w.tokens-initial).toBe(22);
    const save=captureSave(w);expect(validateSave(save)).toBeTruthy();
    const restored=makeWorld();applySave(restored,save);
    expect(restored.encounters.escorts[0].status).toBe('complete');
    const tokens=restored.tokens;restored.encounters.update(restored,1/60);expect(restored.tokens).toBe(tokens);
    restored.respawn();expect(restored.encounters.escorts[0].status).toBe('complete');
  });
  it('o encerramento fica no corredor validado, sem subir atraves do teto',()=>{
    const e=new DroneEscort(def());repair(e);
    for(let i=0;i<100;i++)e.update(1/60,pilot(380));
    for(let i=0;i<120;i++)e.update(1/60,pilot(420));
    const final={...e.drone};
    for(let i=0;i<240;i++){expect(e.update(1/60,pilot(420))).toBe(0);expect(e.drone).toEqual(final);}
    expect(e.departure).toBe(3);
  });
  it('nao cria voo atraves de teto solido ou acrescenta o evento a um trecho com caixas', () => {
    const w=makeWorld(),d=escortCatalog(w.data)[0];
    w.level.set(104,Math.floor((d.start.y-FLIGHT_HEIGHT)/TILE),T.SOLID);
    expect(escortCatalog(w.data)).toEqual([]);
    const platform=makeWorld();platform.level.set(104,Math.floor((d.start.y-FLIGHT_HEIGHT)/TILE),T.ONEWAY);
    expect(escortCatalog(platform.data)).toEqual([]);
    const other=makeWorld();
    expect(escortCatalog({...other.data,props:[...other.data.props,{...other.data.props[0],x:d.start.x+TILE}]})).toEqual([]);
  });
  it('cinematica, morte e barreira nao reparam nem concedem premio; respawn reseta a tentativa', () => {
    const w=makeWorld(), e=w.encounters.escorts[0];w.player.reset(e.def.start.x,e.def.start.y);w.player.body.onGround=true;
    w.player.lockInput=true;for(let i=0;i<100;i++)w.encounters.update(w,1/60);expect(e.repair).toBe(0);
    w.player.lockInput=false;w.director.cine=null;
    for(let i=0;i<30;i++)w.encounters.update(w,1/60);expect(e.repair).toBeGreaterThan(0);
    w.player.mode='dead';w.encounters.update(w,1/60);expect(e.repair).toBe(0);
    w.player.mode='foot';w.blockX=e.def.start.x+TILE;
    for(let i=0;i<100;i++)w.encounters.update(w,1/60);expect(e.status).toBe('ready');
    w.encounters.reset();expect(e.repair).toBe(0);expect(w.encounters.completed.has(e.def.id)).toBe(false);
  });
});
