import { WEAPONS, WEAPON_ORDER, type WeaponId, type WeaponDef } from '../game/weapons';

export type GearOwner = WeaponId | 'karimbo';
export interface GearItem { id:string; weapon:GearOwner; kind:string; tier:number; price:number; label:string; detail:string }
export const GEAR:GearItem[]=[];
/** Preço das armas e peso de cada uma no custo das melhorias (armas melhores custam mais para evoluir). */
export const UNLOCK_PRICE:Record<WeaponId,number>={pistol:0,rifle:90,shotgun:120,launcher:200,energy:260};
const UPGRADE_FACTOR:Record<WeaponId,number>={pistol:.8,rifle:1,shotgun:1.1,launcher:1.3,energy:1.4};
export const DAMAGE_STEP=.2;
const price=(weapon:WeaponId,base:number)=>Math.round(base*UPGRADE_FACTOR[weapon]/5)*5;
for(const weapon of WEAPON_ORDER) {
  if(weapon!=='pistol')GEAR.push({id:`${weapon}.unlock.1`,weapon,kind:'unlock',tier:1,price:UNLOCK_PRICE[weapon],label:'Comprar arma',detail:'Sua para sempre: some quando descarrega, volta com munição.'});
  for(const [kind,label,detail,prices]of [
    ['mag','Carregador','Mais disparos antes da recarga.',[40,75]],
    ['rate','Cadência','Intervalo entre tiros −12% por nível.',[55,90]],
    ['damage','Potência','Dano +20% por nível.',[60,100,150]],
    ['scope','Mira óptica','Dispersão −45% e alcance +15%.',[70]],
    ['pierce','Munição perfurante','Atravessa mais um inimigo.',[95]],
  ] as [string,string,string,number[]][])for(let i=0;i<prices.length;i++)GEAR.push({id:`${weapon}.${kind}.${i+1}`,weapon,kind,tier:i+1,price:price(weapon,prices[i]),label:`${label}${prices.length>1?' '+(i+1):''}`,detail});
}
/** Melhorias do próprio Karimbo (mesmo catálogo, recibos e saves das armas). */
export const PERKS:[string,string,string,number[]][]=[
  ['vida','Vida','+20 de vida máxima por nível.',[120,200]],
  ['folego','Fôlego','+40% de ar debaixo da água por nível.',[90,150]],
  ['granada','Cinturão','+2 granadas ao começar e ao voltar.',[100,160]],
  ['nado','Nadadeira','Nada 25% mais rápido.',[110]],
];
for(const [kind,label,detail,prices] of PERKS)for(let i=0;i<prices.length;i++)GEAR.push({id:`karimbo.${kind}.${i+1}`,weapon:'karimbo',kind,tier:i+1,price:prices[i],label:`${label}${prices.length>1?' '+(i+1):''}`,detail});
/** Nível comprado de uma melhoria do Karimbo. */
export const perkLevel=(gear:readonly string[],kind:string)=>gear.filter(x=>x.startsWith(`karimbo.${kind}.`)).length;
/** Atributos do Karimbo derivados das melhorias (os mesmos números do jogo e da oficina). */
export const KARIMBO_BASE={hp:119,air:12,nades:2};
export const karimboStats=(gear:readonly string[])=>({
  hp:KARIMBO_BASE.hp+20*perkLevel(gear,'vida'),
  air:KARIMBO_BASE.air*(1+.4*perkLevel(gear,'folego')),
  nades:KARIMBO_BASE.nades+2*perkLevel(gear,'granada'),
  swim:1+.25*perkLevel(gear,'nado'),
});
export const gearItem=(id:string)=>GEAR.find(x=>x.id===id);
export const validGear=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=GEAR.length&&v.every(x=>typeof x==='string'&&!!gearItem(x))&&new Set(v).size===v.length;
export const gearCost=(items:string[])=>items.reduce((n,id)=>n+(gearItem(id)?.price??0),0);
const CLIPS:Record<WeaponId,number>={pistol:8,rifle:18,shotgun:4,launcher:2,energy:10};
export const reloadSeconds=(id:WeaponId)=>({pistol:1.15,rifle:1.5,shotgun:1.75,launcher:2,energy:1.35})[id];
export const magazineCapacity=(id:WeaponId,gear:string[])=>CLIPS[id]+Math.ceil(CLIPS[id]*.4)*gear.filter(x=>x.startsWith(id+'.mag.')).length;
/** Stats derivados uma vez por mudança de equipamento, sem alterar a tabela global. */
export function tunedWeapon(id:WeaponId,gear:string[]):WeaponDef {
  const level=(kind:string)=>gear.filter(x=>x.startsWith(id+'.'+kind+'.')).length;
  const d=WEAPONS[id],damage=1+level('damage')*DAMAGE_STEP;
  return {...d,dmg:d.dmg*damage,rate:d.rate*Math.pow(.88,level('rate')),spread:d.spread*(level('scope')?.55:1),life:d.life*(level('scope')?1.15:1),pierce:d.pierce+level('pierce'),explosive:d.explosive?{...d.explosive,dmg:d.explosive.dmg*damage}:undefined};
}
