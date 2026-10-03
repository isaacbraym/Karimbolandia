import { currentProfile, profileKey, readStored, storedKeys, writeStored } from './persistence';
import { gearItem } from './gearCatalog';
import { record } from './saveValidation';
const ROOT='karimbolandia.gear.v1.';
const validate=(v:unknown)=>record(v)&&typeof v.item==='string'&&gearItem(v.item)?{item:v.item}:null;
export function readGearReceipts():string[] {
  const profile=currentProfile(),owned=new Set<string>();
  for(const key of storedKeys(ROOT)){
    if(profile?!key.endsWith('.account.'+profile):key.includes('.account.'))continue;
    const receipt=readStored(key,validate);if(receipt)owned.add(receipt.item);
  }
  return [...owned];
}
export function storeGearReceipts(gear:string[]):boolean {
  let saved=true;
  for(const item of gear){const key=profileKey(ROOT+item);if(readStored(key,validate)?.item!==item)saved=writeStored(key,{item},validate)&&saved;}
  return saved;
}
