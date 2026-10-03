import { WEAPONS, WEAPON_ORDER, type WeaponId, type WeaponDef } from '../game/weapons';

export interface GearItem { id:string; weapon:WeaponId; kind:string; tier:number; price:number; label:string; detail:string }
export const GEAR:GearItem[]=[];
for(const weapon of WEAPON_ORDER) {
  if(weapon!=='pistol')GEAR.push({id:`${weapon}.unlock.1`,weapon,kind:'unlock',tier:1,price:({rifle:80,shotgun:100,launcher:180,energy:220} as Record<string,number>)[weapon],label:'Comprar arma',detail:'Permanente, com carga inicial.'});
  for(const [kind,label,detail,prices]of [
    ['mag','Carregador','Mais disparos antes da recarga.',[40,75]],
    ['rate','Cadência','Intervalo entre tiros −12% por nível.',[55,90]],
    ['damage','Potência','Dano +15% por nível.',[65,110]],
    ['scope','Mira óptica','Dispersão −45% e alcance +15%.',[70]],
    ['pierce','Munição perfurante','Atravessa mais um inimigo.',[95]],
  ] as [string,string,string,number[]][])for(let i=0;i<prices.length;i++)GEAR.push({id:`${weapon}.${kind}.${i+1}`,weapon,kind,tier:i+1,price:prices[i],label:`${label}${prices.length>1?' '+(i+1):''}`,detail});
}
export const gearItem=(id:string)=>GEAR.find(x=>x.id===id);
export const validGear=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=GEAR.length&&v.every(x=>typeof x==='string'&&!!gearItem(x))&&new Set(v).size===v.length;
export const gearCost=(items:string[])=>items.reduce((n,id)=>n+(gearItem(id)?.price??0),0);
const CLIPS:Record<WeaponId,number>={pistol:8,rifle:18,shotgun:4,launcher:2,energy:10};
export const reloadSeconds=(id:WeaponId)=>({pistol:1.15,rifle:1.5,shotgun:1.75,launcher:2,energy:1.35})[id];
export const magazineCapacity=(id:WeaponId,gear:string[])=>CLIPS[id]+Math.ceil(CLIPS[id]*.4)*gear.filter(x=>x.startsWith(id+'.mag.')).length;
/** Stats derivados uma vez por mudança de equipamento, sem alterar a tabela global. */
export function tunedWeapon(id:WeaponId,gear:string[]):WeaponDef {
  const level=(kind:string)=>gear.filter(x=>x.startsWith(id+'.'+kind+'.')).length;
  const d=WEAPONS[id],damage=1+level('damage')*.15;
  return {...d,dmg:d.dmg*damage,rate:d.rate*Math.pow(.88,level('rate')),spread:d.spread*(level('scope')?.55:1),life:d.life*(level('scope')?1.15:1),pierce:d.pierce+level('pierce'),explosive:d.explosive?{...d.explosive,dmg:d.explosive.dmg*damage}:undefined};
}
