import { currentProfile, profileKey, readStored, storedKeys, writeStored } from './persistence';
import { record, integer } from './saveValidation';

export interface CoinLedger { base:number; counts:Record<string,number> }
const ROOT='karimbolandia.coin-writers.v2.';
const WRITER='c'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+'_'+Math.random().toString(36).slice(2);
export function validateCoinLedger(v:unknown):CoinLedger|null {
  if(!record(v)||!integer(v.base)||!record(v.counts))return null;
  const entries=Object.entries(v.counts);
  if(entries.length>2048||entries.some(([key,n])=>!/^c[a-zA-Z0-9_]{5,79}$/.test(key)||!integer(n)))return null;
  const result={base:v.base as number,counts:Object.fromEntries(entries) as Record<string,number>};
  return Number.isSafeInteger(coinTotal(result))?result:null;
}
export function coinTotal(ledger:CoinLedger):number {
  let total=ledger.base;
  for(const n of Object.values(ledger.counts))total+=n;
  return total;
}
export function mergeCoinLedgers(a:CoinLedger|undefined,b:CoinLedger|undefined):CoinLedger|undefined {
  if(!a&&!b)return undefined;
  const counts:Record<string,number>={...(a?.counts??{})};
  for(const [key,n]of Object.entries(b?.counts??{}))counts[key]=Math.max(counts[key]??0,n);
  return {base:Math.max(a?.base??0,b?.base??0),counts};
}
/** Um contador crescente por sessão; sem consulta ou escrita por moeda. */
export function addCoin(p:{coinsEarned:number;coinsLedger?:CoinLedger}) {
  const ledger=p.coinsLedger??{base:p.coinsEarned,counts:{}};
  // Um cliente antigo pode trazer um total maior sem conhecer os contadores.
  ledger.base=Math.max(ledger.base,p.coinsEarned-(coinTotal(ledger)-ledger.base));
  ledger.counts[WRITER]=(ledger.counts[WRITER]??0)+1;
  p.coinsLedger=ledger;
  p.coinsEarned=Math.max(p.coinsEarned+1,coinTotal(ledger));
}
export function flushCoinWriter(ledger:CoinLedger|undefined):boolean {
  if(!ledger?.counts[WRITER])return true;
  // A própria chave não disputa last-write-wins com nenhuma outra aba.
  return writeStored(profileKey(ROOT+WRITER),ledger,validateCoinLedger);
}
export function readCoinWriters():CoinLedger|undefined {
  const scope=currentProfile();
  let merged:CoinLedger|undefined;
  for(const key of storedKeys(ROOT)) {
    if(scope?!key.endsWith('.account.'+scope):key.includes('.account.'))continue;
    const ledger=readStored(key,validateCoinLedger);
    if(ledger)merged=mergeCoinLedgers(merged,ledger);
  }
  return merged;
}
