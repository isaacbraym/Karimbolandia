import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {newCtl} from './helpers/bot';
let disk:Map<string,string>;
beforeEach(()=>{disk=new Map();vi.stubGlobal('localStorage',{get length(){return disk.size;},key:(i:number)=>[...disk.keys()][i]??null,getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>disk.set(k,v)});vi.resetModules();});
afterEach(()=>vi.unstubAllGlobals());
async function setup(){const {World}=await import('../src/game/world'),{buildLevel}=await import('../src/game/level/index');const w=new World(buildLevel());w.enemies=[];w.player.lockInput=false;w.player.fireCd=0;return w;}
describe('Arsenal e oficina',()=>{
  it('a disponibilidade de recarga acompanha reserva, capacidade, golpe e veiculo',async()=>{
    const w=await setup(),p=w.player,{progress}=await import('../src/core/storage');
    expect(p.canReload).toBe(false);expect(p.startReload(w)).toBe(false);
    p.giveWeapon('rifle',w);p.weapons.set('rifle',24);p.magazines.set('rifle',18);
    expect(p.canReload).toBe(false);
    progress.gear.push('rifle.mag.1');expect(p.canReload).toBe(true);
    p.meleeT=.2;expect(p.canReload).toBe(false);p.meleeT=0;
    p.mode='nomad';expect(p.canReload).toBe(false);p.mode='foot';
    p.weapons.set('rifle',18);expect(p.canReload).toBe(false);
    p.weapons.set('rifle',24);expect(p.startReload(w)).toBe(true);expect(p.canReload).toBe(false);
    p.reloadT=0;p.cur='pistol';p.magazines.set('pistol',0);expect(p.canReload).toBe(true);
  });
  it('começa apenas com pistola e interrompe disparos ao esvaziar o carregador',async()=>{
    const w=await setup(),p=w.player,c=newCtl();
    expect([...p.weapons.keys()]).toEqual(['pistol']);expect(p.grenades).toBe(2);
    c.fire.held=true;
    for(let i=0;i<8;i++){p.fireCd=0;p.update(w,.01,c);}
    expect(w.bullets).toHaveLength(8);expect(p.loadedAmmo).toBe(0);
    p.fireCd=0;p.update(w,.01,c);expect(p.reloadT).toBeGreaterThan(0);expect(w.bullets).toHaveLength(8);
    p.update(w,.4,c);expect(w.bullets).toHaveLength(8);
    c.fire.held=false;for(let i=0;i<80;i++)p.update(w,1/60,c);
    expect(p.loadedAmmo).toBe(8);p.fireCd=0;c.fire.held=true;p.update(w,.01,c);expect(w.bullets).toHaveLength(9);
  });
  it('recarrega sem inventar munição; troca de arma cancela; save mantém cartuchos do carregador',async()=>{
    const w=await setup(),p=w.player,c=newCtl();p.giveWeapon('rifle',w);
    p.weapons.set('rifle',20);p.magazines.set('rifle',2);
    expect(p.startReload(w)).toBe(true);c.next.pressed=true;p.update(w,.01,c);expect(p.cur).toBe('pistol');expect(p.reloadT).toBe(0);
    c.next.pressed=false;p.cur='rifle';p.startReload(w);for(let i=0;i<100;i++)p.update(w,1/60,c);
    expect(p.loadedAmmo).toBe(18);expect(p.weapons.get('rifle')).toBe(20);
    p.fireCd=0;c.fire.held=true;p.update(w,.01,c);expect(p.loadedAmmo).toBe(17);expect(p.weapons.get('rifle')).toBe(19);
    const {captureSave,applySave}=await import('../src/game/save'),{validateSave}=await import('../src/core/saveValidation');
    const saved=validateSave(JSON.parse(JSON.stringify(captureSave(w))))!;const next=await setup();applySave(next,saved);
    expect(next.player.loadedAmmo).toBe(17);expect(next.player.weapons.get('rifle')).toBe(19);
    const old={...saved};delete old.magazines;expect(validateSave(old)).not.toBeNull();
    expect(validateSave({...saved,magazines:[['rifle',-1]]})).toBeNull();
  });
  it('compras têm preço único, requisitos, atributos reais e sobrevivem a backup antigo e cliente antigo',async()=>{
    const w=await setup(),{buyGear}=await import('../src/core/forge'),s=await import('../src/core/storage'),{coinBalance}=await import('../src/core/skins'),profile=await import('../src/core/profile');
    s.progress.coinsEarned=1000;s.progress.coinsMigrated=true;s.saveProgress();const old=profile.parseBackup(profile.exportBackup());
    expect(buyGear('rifle.damage.1',w.player.weapons)).toBe('locked');expect(buyGear('pistol.mag.2',w.player.weapons)).toBe('locked');
    for(const id of ['pistol.mag.1','pistol.rate.1','pistol.damage.1','pistol.scope.1','pistol.pierce.1'])expect(buyGear(id,w.player.weapons)).toBe('bought');
    expect(coinBalance()).toBe(675);expect(buyGear('pistol.mag.1',w.player.weapons)).toBe('owned');expect(coinBalance()).toBe(675);
    expect(w.player.weaponDef().dmg).toBeCloseTo(10.35);expect(w.player.weaponDef().rate).toBeLessThan(.24);expect(w.player.weaponDef().spread).toBeLessThan(.02);expect(w.player.weaponDef().pierce).toBe(1);
    profile.applyProfile(old);expect(coinBalance()).toBe(675);
    const legacy={...s.defaultProgress(),coinsEarned:1000,coinsMigrated:true};
    disk.set('karimbolandia.wallet.v1',JSON.stringify(legacy));disk.set('karimbolandia.progress.v1',JSON.stringify(legacy));
    s.reloadProgress();expect(s.progress.gear).toHaveLength(5);expect(coinBalance()).toBe(675);
  });
  it('mantém armas compradas em novas partidas e separa melhorias por perfil',async()=>{
    const w=await setup(),{buyGear}=await import('../src/core/forge'),s=await import('../src/core/storage'),scope=await import('../src/core/persistence');
    s.progress.coinsEarned=80;s.progress.coinsMigrated=true;s.saveProgress();expect(buyGear('rifle.unlock.1',w.player.weapons)).toBe('bought');
    w.player.resetInventory();expect(w.player.weapons.get('rifle')).toBe(36);
    scope.setProfile('another');s.reloadProgress();w.player.resetInventory();expect(s.progress.gear).toEqual([]);expect([...w.player.weapons.keys()]).toEqual(['pistol']);
  });
  it('recusa gastar saldo insuficiente e permite abrir a oficina só perto de Tomé',async()=>{
    const w=await setup(),{buyGear}=await import('../src/core/forge');expect(buyGear('pistol.damage.1',w.player.weapons)).toBe('insufficient');
    const spot=w.merchant.spots[0];w.player.reset(spot.x,spot.y);expect(w.merchant.near(w)).toBe(true);
    w.player.reset(spot.x+300,spot.y);expect(w.merchant.near(w)).toBe(false);
  });
  it('serializa compras concorrentes e recusa uma compra pendente após trocar de conta',async()=>{
    const w=await setup(),{buyGear,withWalletLock}=await import('../src/core/forge'),s=await import('../src/core/storage'),scope=await import('../src/core/persistence');
    s.progress.coinsEarned=100;s.progress.coinsMigrated=true;s.saveProgress();
    let tail=Promise.resolve();
    vi.stubGlobal('navigator',{locks:{request:(_name:string,fn:()=>unknown)=>{const next=tail.then(fn);tail=next.then(()=>{},()=>{});return next;}}});
    const results=await Promise.all([withWalletLock(()=>buyGear('pistol.damage.1',w.player.weapons)),withWalletLock(()=>buyGear('pistol.rate.1',w.player.weapons))]);
    expect(results).toEqual(['bought','insufficient']);expect(s.progress.gear).toEqual(['pistol.damage.1']);
    const pending=withWalletLock(()=>buyGear('pistol.mag.1',w.player.weapons));scope.setProfile('new');s.reloadProgress();
    await expect(pending).rejects.toThrow('profile-changed');expect(s.progress.gear).toEqual([]);
  });
  it('cancela compra na fila ao fechar oficina sem gastar moedas ou alterar recibos',async()=>{
    const w=await setup(),{buyGearWhenOpen}=await import('../src/core/forge'),s=await import('../src/core/storage'),{coinBalance}=await import('../src/core/skins');
    s.progress.coinsEarned=100;s.progress.coinsMigrated=true;s.saveProgress();
    let run:(()=>unknown)|undefined,open=true;
    vi.stubGlobal('navigator',{locks:{request:(_name:string,fn:()=>unknown)=>new Promise(resolve=>{run=()=>resolve(fn());})}});
    const before=new Map(disk),pending=buyGearWhenOpen('pistol.damage.1',w.player.weapons,()=>open);
    open=false;run!();expect(await pending).toBe('cancelled');
    expect(coinBalance()).toBe(100);expect(s.progress.gear).toEqual([]);expect(disk).toEqual(before);
    open=true;const bought=buyGearWhenOpen('pistol.damage.1',w.player.weapons,()=>open);run!();
    expect(await bought).toBe('bought');expect(coinBalance()).toBe(35);
  });
});
