import type { SfxName } from '../core/audio';

const NOISE: Partial<Record<SfxName, number>> = {
  pistol:330, rifle:420, shotgun:560, launcher:500, energy:300,
  enemyShot:360, sniperShot:600, turretShot:600, nomadShot:650,
  explosion:750, bigExplosion:900,
};
export function wildlifeNoiseRadius(name:SfxName) { return NOISE[name] ?? 0; }

const ALERT=.18, OUT=.85, HOLD=1.25, BACK=1.4;
export const REACTION_SECONDS=ALERT+OUT+HOLD+BACK;
const smooth=(v:number)=>v*v*(3-2*v);

/** A fixed cast reacts without spawning entities, changing collisions or saving transient state. */
export class AmbientReaction {
  elapsed=-1;
  cooldown=0;
  dx=0;
  dy=0;
  alert=0;
  moving=false;
  facing=1;
  private away=1;
  constructor(readonly kind:'cat'|'owl'|'bird') {}
  get active(){return this.elapsed>=0;}
  reset(){this.elapsed=-1;this.cooldown=this.dx=this.dy=this.alert=0;this.moving=false;this.facing=this.away=1;}
  trigger(sourceX:number,homeX:number){
    if(this.cooldown>0||this.active||!Number.isFinite(sourceX)||!Number.isFinite(homeX))return false;
    this.away=homeX<sourceX?-1:1;this.facing=this.away;
    this.elapsed=0;this.cooldown=9;this.alert=1;
    return true;
  }
  update(dt:number){
    if(!Number.isFinite(dt)||dt<=0)return;
    this.cooldown=Math.max(0,this.cooldown-dt);
    if(!this.active)return;
    this.elapsed+=dt;
    if(this.elapsed>=REACTION_SECONDS){
      this.elapsed=-1;this.dx=this.dy=this.alert=0;this.moving=false;return;
    }
    const t=this.elapsed-ALERT;
    this.alert=t<0?1:0;
    const returning=t>OUT+HOLD;
    const progress=t<=0?0:t<OUT?smooth(t/OUT):returning?1-smooth((t-OUT-HOLD)/BACK):1;
    this.moving=t>0&&(t<OUT||returning);
    this.facing=this.away*(returning?-1:1);
    const reach=this.kind==='cat'?56:this.kind==='owl'?165:112;
    this.dx=this.away*reach*progress;
    this.dy=this.kind==='cat'?(this.moving?-Math.abs(Math.sin(t*18))*5:0)*Math.min(1,progress*8)
      :-(this.kind==='owl'?90:58)*progress-Math.sin(Math.PI*progress)*10;
  }
}
