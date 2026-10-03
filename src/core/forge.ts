import { progress, saveProgress } from './storage';
import { coinBalance, ensureWallet } from './skins';
import { gearItem } from './gearCatalog';
import { currentProfile } from './persistence';

export async function withWalletLock<T>(fn:()=>T):Promise<T> {
  const scope=currentProfile(),name='karimbolandia.wallet.'+(scope??'guest');
  const run=()=>{if(currentProfile()!==scope)throw new Error('profile-changed');return fn();};
  if(typeof navigator!=='undefined'&&navigator.locks)return navigator.locks.request(name,run);
  return run();
}
/** Uma compra que ainda espera outra aba só pode começar com a oficina aberta. */
export function buyGearWhenOpen(id:string,ownedWeapons:ReadonlyMap<string,number>,isOpen:()=>boolean) {
  return withWalletLock(()=>isOpen()?buyGear(id,ownedWeapons):'cancelled' as const);
}
export function buyGear(id:string,ownedWeapons:ReadonlyMap<string,number>):'bought'|'owned'|'insufficient'|'locked'|'invalid'|'volatile' {
  const item=gearItem(id);if(!item)return 'invalid';
  ensureWallet();
  if(progress.gear.includes(id))return 'owned';
  if(item.kind!=='unlock'&&!ownedWeapons.has(item.weapon)&&!progress.gear.includes(`${item.weapon}.unlock.1`))return 'locked';
  if(item.tier>1&&!progress.gear.includes(`${item.weapon}.${item.kind}.${item.tier-1}`))return 'locked';
  if(coinBalance()<item.price)return 'insufficient';
  progress.gear.push(id);
  return saveProgress()?'bought':'volatile';
}
