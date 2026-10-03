import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
let disk:Map<string,string>;
let interleave:(()=>void)|null;
let reads=0,writes=0;
beforeEach(()=>{
  disk=new Map();interleave=null;reads=writes=0;
  vi.stubGlobal('localStorage',{
    get length(){return disk.size;},key:(i:number)=>[...disk.keys()][i]??null,
    getItem:(k:string)=>{reads++;return disk.get(k)??null;},
    setItem:(k:string,v:string)=>{writes++;if(k==='karimbolandia.wallet.v1'&&interleave){const fn=interleave;interleave=null;fn();}disk.set(k,v);},
  });vi.resetModules();
});
afterEach(()=>vi.unstubAllGlobals());

describe('Moedas de partidas concorrentes',()=>{
  it('soma ganhos de duas abas na mesma base, inclusive com escrita intercalada do wallet',async()=>{
    const a=await import('../src/core/storage'),sa=await import('../src/core/skins');
    a.progress.coinsEarned=100;a.progress.coinsMigrated=true;a.saveProgress();
    vi.resetModules();
    const b=await import('../src/core/storage'),sb=await import('../src/core/skins');
    for(let i=0;i<5;i++)sa.collectCoin();
    for(let i=0;i<7;i++)sb.collectCoin();
    interleave=()=>{b.saveProgress();};a.saveProgress();
    vi.resetModules();
    const restored=await import('../src/core/storage');
    expect(restored.progress.coinsEarned).toBe(112);
    expect(Object.values(restored.progress.coinsLedger!.counts).sort((a,b)=>a-b)).toEqual([5,7]);
    expect([...disk.keys()].filter(k=>k.startsWith('karimbolandia.coin-writers.v2.')&&!k.endsWith('.backup'))).toHaveLength(2);
  });
  it('reimportar o mesmo backup é idempotente e contém os contadores',async()=>{
    const s=await import('../src/core/skins'),p=await import('../src/core/profile');
    for(let i=0;i<120;i++)s.collectCoin();
    const backup=p.parseBackup(p.exportBackup());
    expect(backup?.progress.coinsLedger).toBeTruthy();
    p.applyProfile(backup);p.applyProfile(backup);
    expect(s.coinBalance()).toBe(120);
  });
  it('não consulta o disco por moeda e separa os perfis',async()=>{
    const s=await import('../src/core/skins'),p=await import('../src/core/storage'),scope=await import('../src/core/persistence');
    s.ensureWallet();const r=reads,w=writes;
    for(let i=0;i<150;i++)s.collectCoin();
    expect(reads).toBe(r);expect(writes).toBe(w);
    p.saveProgress();scope.setProfile('other');p.reloadProgress();
    expect(p.progress.coinsEarned).toBe(0);
    s.collectCoin();p.saveProgress();expect(p.progress.coinsEarned).toBe(1);
    scope.setProfile('');p.reloadProgress();expect(p.progress.coinsEarned).toBe(150);
  });
});
