import {describe,it,expect,vi} from 'vitest';
import {World} from '../src/game/world';
import {buildJungle} from '../src/game/level/jungle';
import {buildLevel} from '../src/game/level/index';
import {captureSave,applySave} from '../src/game/save';
import {validateSave} from '../src/core/saveValidation';
import {VILLAGE_LORE} from '../src/game/exploration';
import {Bullet,Grenade} from '../src/game/bullets';
import {WEAPONS} from '../src/game/weapons';
import {moveBody} from '../src/game/physics';

function setup(){const w=new World(buildJungle());const spot=w.exploration.spots.find(s=>s.cabin)!;w.player.reset(spot.x,spot.y);moveBody(w.player.body,0,w.level,w.solidRects);return {w,spot};}
describe('Exploração opcional em primeira pessoa',()=>{
  it('todas as 30 casas e três cabanas têm interiores próprios, IDs estáveis e nenhum ponto na cidade',()=>{
    const {w}=setup();expect(w.exploration.spots.filter(s=>s.cabin&&!s.home)).toHaveLength(3);
    expect(w.exploration.spots.filter(s=>s.home)).toHaveLength(30);
    expect(new Set(w.exploration.spots.filter(s=>s.interior).map(s=>s.interior)).size).toBe(33);
    expect(w.exploration.spots.find(s=>s.interior==='palafita')!.title).toBe('Palafita do vigia');
    expect(w.exploration.spots.filter(s=>!s.cabin)).toHaveLength(3);
    expect(new World(buildLevel()).exploration.spots).toEqual([]);
    expect(new World(buildJungle()).exploration.spots.map(s=>s.id)).toEqual(w.exploration.spots.map(s=>s.id));
  });
  it('só oferece entrada no piso e não atravessa paredes, bloqueios ou cenas',()=>{
    const {w,spot}=setup();expect(w.exploration.nearest(w)).toBe(spot);
    w.player.body.onGround=false;expect(w.exploration.nearest(w)).toBeUndefined();w.player.body.onGround=true;
    w.player.lockInput=true;expect(w.exploration.nearest(w)).toBeUndefined();w.player.lockInput=false;
    w.blockX=spot.x+1;expect(w.exploration.nearest(w)).toBeUndefined();w.blockX=-Infinity;
    w.player.body.x+=50;w.level.set(Math.floor((spot.x+25)/32),Math.floor(w.player.y/32),1);
    expect(w.exploration.nearest(w)).toBeUndefined();
  });
  it('exige livrar a entrada de inimigos, tiros e granadas antes de pausar o mundo',()=>{
    const {w,spot}=setup();expect(w.exploration.safe(w,spot)).toBe(false);w.enemies=[];
    expect(w.exploration.safe(w,spot)).toBe(true);
    w.bullets.push(new Bullet(w.player.x+30,w.player.y,0,0,{kind:'enemy',team:1,dmg:5,life:1}));
    expect(w.exploration.safe(w,spot)).toBe(false);w.bullets=[];
    w.grenades.push(new Grenade(w.player.x+40,w.player.y,0,0,1,false));expect(w.exploration.safe(w,spot)).toBe(false);
  });
  it('abre gaveta antes de dar munição e não duplica a recompensa em visitas ou saves',()=>{
    const {w,spot}=setup(),obj=spot.objects.find(o=>o.id==='drawer')!;
    w.player.weapons.set('rifle',20);w.player.cur='rifle';const loaded=w.player.magazines.get('rifle');
    expect(w.exploration.inspect(w,spot,obj)).toContain('Aberto');expect(w.player.weapons.get('rifle')).toBe(20);
    expect(w.exploration.inspect(w,spot,obj)).toContain('+18');expect(w.player.weapons.get('rifle')).toBe(38);
    expect(w.player.magazines.get('rifle')).toBe(loaded);
    w.exploration.inspect(w,spot,obj);expect(w.player.weapons.get('rifle')).toBe(38);
    const save=validateSave(captureSave(w))!;expect(save).not.toBeNull();const restored=new World(buildJungle());applySave(restored,save);
    const next=restored.exploration.spots.find(s=>s.id===spot.id)!;restored.exploration.inspect(restored,next,next.objects.find(o=>o.id==='drawer')!);
    expect(restored.player.weapons.get('rifle')).toBe(38);
  });
  it('preserva a reserva para depois quando tudo está cheio e respeita a capacidade da arma',()=>{
    const {w,spot}=setup(),obj=spot.objects.find(o=>o.id==='chest')!;
    w.player.weapons.set('shotgun',WEAPONS.shotgun.ammoMax);w.player.cur='shotgun';w.player.grenades=w.player.maxGrenades;
    w.exploration.inspect(w,spot,obj);expect(w.exploration.inspect(w,spot,obj)).toContain('cheias');
    expect(w.encounters.completed.has(w.exploration.key(spot,obj))).toBe(false);
    w.player.weapons.set('shotgun',23);w.exploration.inspect(w,spot,obj);expect(w.player.weapons.get('shotgun')).toBe(24);
  });
  it('com só a pistola infinita entrega uma granada sem alterar a economia da pistola',()=>{
    const {w,spot}=setup(),obj=spot.objects.find(o=>o.id==='drawer')!;w.player.grenades=0;
    w.exploration.inspect(w,spot,obj);expect(w.exploration.inspect(w,spot,obj)).toContain('+1 granada');
    expect(w.player.grenades).toBe(1);expect(w.player.weapons.get('pistol')).toBe(Infinity);
    expect([...w.player.weapons.keys()]).toEqual(['pistol']);
  });
  it('coleciona os seis fragmentos únicos e mantém o save v1 sob o limite de IDs',()=>{
    const {w}=setup(),progress=vi.fn();w.hooks.onProgress=progress;
    for(const spot of w.exploration.spots){if(spot.clue)w.exploration.discover(w,spot.clue);for(const obj of spot.objects){w.exploration.inspect(w,spot,obj);w.exploration.inspect(w,spot,obj);}}
    expect(VILLAGE_LORE.every(c=>w.exploration.found(w,c))).toBe(true);
    expect(w.encounters.completed.size).toBeLessThan(55);
    expect(validateSave(captureSave(w))).not.toBeNull();
    const count=progress.mock.calls.length;w.exploration.discover(w,VILLAGE_LORE[0]);expect(progress).toHaveBeenCalledTimes(count);
  });
  it('não aceita objetos e cabanas estrangeiros como recompensas',()=>{
    const {w,spot}=setup(),obj=spot.objects[0];expect(w.exploration.inspect(w,spot,{...obj})).toBe('');
    expect(w.encounters.completed.size).toBe(0);
  });
  it('não entra através de uma caixa sólida entre Karimbo e a porta',()=>{
    const {w,spot}=setup();w.player.body.x+=60;
    w.solidRects=[{x:spot.x+20,y:spot.y-52,w:20,h:52}];
    expect(w.exploration.nearest(w)).toBeUndefined();
    w.solidRects=[];expect(w.exploration.nearest(w)).toBe(spot);
  });
});
