import type { World } from './world';
import type { LevelData } from './level';
import { approach } from '../core/math';
import { drawResident, type ResidentPose, type ResidentRole } from '../art/village';
import { drawDancingAlligator } from '../art/dancingAlligator';
import { DANCE_ID } from './level/community';
import type { ControlState } from '../core/input';
import { clapTick, clapTone } from '../core/clapRhythm';
const ROLES: Record<string,ResidentRole> = { villageResident:'resident',villageFarmer:'farmer',villageWasher:'washer',
  villageWeaver:'weaver',villageCarrier:'carrier',villageCarpenter:'carpenter',villageChild:'child' };
export const CELEBRATION_SECONDS = 5.4;
/** Falas por ofício (cada visita mostra a próxima; nunca a mesma frase em sequência). */
const LINES: Record<string,string[]> = {
  resident:['Entre-Raízes: o rio passa no quintal de todos.','O marco antigo conta como a aldeia nasceu.','O contrato deles esqueceu nossas trinta casas.','Duas palmas, uma resposta. Até o jacaré sabe.'],
  washer:['Azul no tecido: água limpa. Amarelo: abrigo.','Almoço frio? Então a ponte está vigiada.','O radinho deles escuta. Entender é outra coisa.'],
  farmer:['Guardamos sementes até de quem foi embora.','Pomar queimado cresce. Ordem ruim também.','Nas cabanas há papéis que o vento não levou.'],
  carpenter:['Esta madeira vai virar uma casa.','Mais uma tábua e o telhado fica pronto.','Martelo firme, prego reto!'],
  weaver:['Um fio de cada vez...','Estas cores vêm das sementes da mata.','Quer um cesto? Faço outro amanhã.'],
  carrier:['A praça fica logo adiante!','Levo frutas para a festa.','Abre caminho, está pesado!'],
};

export class Village {
  readonly residents: (ResidentPose & { home:number; baseY:number; speech:number; cooldown:number; spoke:boolean; line:number; quiet:number })[];
  readonly dance: {x:number;y:number}|null;
  readonly streams: {x:number;y:number}[];
  active=false;
  sceneTime=0;
  private clapBeat=-1;
  private ownsLock=false;
  private upHeld=false;
  constructor(data:LevelData) {
    this.dance=data.decos.find(d=>d.kind==='villageDance')??null;
    this.streams=data.decos.filter(d=>d.kind==='villageStream');
    this.residents = data.decos.filter(d=>ROLES[d.kind]).map((d,id)=>
      ({x:d.x,y:d.y,baseY:d.y,home:d.x,id,facing:1,walk:0,gesture:0,speech:0,cooldown:0,spoke:false,line:id,quiet:0,role:ROLES[d.kind],work:0}));
  }
  reset(w?:World) {
    if(w&&this.ownsLock){
      if(!w.director.cine){w.player.lockInput=false;w.camera.focus=null;}
      w.player.clapping=false;
    }
    this.active=false;this.ownsLock=false;this.sceneTime=0;
    for (const r of this.residents) { r.x=r.home;r.y=r.baseY;r.walk=r.gesture=r.speech=r.cooldown=r.quiet=0;r.spoke=false; }
  }
  canJoin(w:World) {
    const p=w.player,d=this.dance;
    return !!d&&p.mode==='foot'&&!p.lockInput&&!w.director.cine&&!w.finished&&!w.inRoom()
      &&p.body.onGround&&!p.crouch&&!p.vine&&Math.abs(p.x-d.x)<220&&Math.abs(p.feetY-d.y)<12&&p.hurtT<=0
      &&!w.enemies.some(e=>e.alive&&Math.abs(e.x-p.x)<800)
      &&!w.bullets.some(b=>!b.dead&&b.team!==0&&Math.abs(b.x-p.x)<700);
  }
  update(w:World,dt:number,ctl?:ControlState) {
    const p=w.player,d=this.dance;
    const up=(ctl?.moveY??0)<-.6, join=(up&&!this.upHeld)||!!ctl?.interact?.pressed;
    this.upHeld=up;
    if(this.active&&(p.mode!=='foot'||w.director.cine||w.finished))this.reset(w);
    const first=!w.encounters.completed.has(DANCE_ID);
    if(d&&!this.active&&this.canJoin(w)&&(first?p.x>=d.x-114&&p.x<=d.x-65:join)) {
      this.active=true;this.sceneTime=0;this.ownsLock=true;
      p.lockInput=true;p.body.vx=p.body.vy=0;p.facing=p.x<=d.x?1:-1;p.clapping=true;
      p.meleeT=0;p.reloadT=0;p.glide=false;
      w.hooks.onBanner?.('A DANÇA DO JACARÉ','Karimbo entrou na roda!',2);
    }
    if(this.active) {
      this.sceneTime+=Math.min(dt,.1);p.body.vx=p.body.vy=0;
      if(this.sceneTime>=CELEBRATION_SECONDS) {
        w.encounters.completed.add(DANCE_ID);this.reset(w);
        w.hooks.onControlReturned?.();
        w.hooks.onBanner?.('BOA VIAGEM, KARIMBO!','↑ perto da roda para bater palmas de novo',1.8);
        if(first)w.hooks.onProgress?.();
      }
    }
    const beat=clapTick(w.time),tone=clapTone(beat);
    // palmas da roda (crianças + Karimbo quando entra): audíveis por cima da música da selva
    if(beat!==this.clapBeat&&tone&&d&&Math.abs(p.x-d.x)<700)w.audio(tone,this.active?1.1:.9,d.x);
    this.clapBeat=beat;
    for (const r of this.residents) {
      // fala uma vez por visita: só volta a falar (outra frase) depois que o Karimbo se afasta
      if (r.spoke&&Math.abs(w.player.x-r.x)>520&&w.time>=r.quiet)r.spoke=false;
      if (Math.abs(w.player.x-r.home)>1200) continue;
      const near = Math.abs(w.player.x-r.x)<185 && Math.abs(w.player.feetY-r.y)<170;
      r.cooldown=Math.max(0,r.cooldown-dt); r.speech=Math.max(0,r.speech-dt);
      const resident=r.role==='resident',child=r.role==='child';
      r.gesture=approach(r.gesture,resident&&near?1:0,dt*3);
      if (near&&!child) { r.facing=p.x>=r.x?1:-1;if(!r.spoke&&!this.talking()){r.speech=3.2;r.spoke=true;r.line++;r.quiet=w.time+30;} }
      if(child&&d)r.facing=d.x>=r.x?1:-1;
      const routine=Math.sin(w.time*.24+r.id),walking=r.role==='carrier'||(r.role==='farmer'&&routine<-.7);
      const tx = r.home + (child ? 0 : resident ? near ? -r.facing*18 : routine*28 : walking ? routine*80 : 0);
      const dx = Math.max(-dt*24,Math.min(dt*24,tx-r.x));
      r.x+=dx; r.walk+=Math.abs(dx)*0.16;
      if(Math.abs(dx)>.1&&!near)r.facing=dx>0?1:-1;
      r.work=walking?0:(Math.sin(w.time*(r.role==='washer'?4:2.8)+r.id)+1)*.5;
      r.y=child?r.baseY:w.level.reliefSurface(r.x)??r.baseY;
    }
  }
  /** um morador por vez: ninguém começa a falar por cima do outro */
  private talking() { return this.residents.some(r=>r.speech>0); }
  camera(w:World) {
    if(this.active&&this.dance){w.camera.zoomTarget=Math.min(.92,w.camera.viewW/500);w.camera.focus={x:this.dance.x-20,y:this.dance.y-91,rate:5};}
  }
  draw(g:CanvasRenderingContext2D,w:World,balloons=false) {
    if(balloons&&!this.active&&w.encounters.completed.has(DANCE_ID)&&this.canJoin(w)) {
      const x=w.player.x,y=w.player.y-93;
      g.save();g.font='bold 12px sans-serif';g.textAlign='center';
      g.fillStyle='#253c30ee';g.strokeStyle='#e6ce88';g.lineWidth=1;
      g.beginPath();g.roundRect(x-69,y-16,138,26,7);g.fill();g.stroke();
      g.fillStyle='#fff0c6';g.fillText('↑ Bater palmas',x,y+1);g.restore();
    }
    if(!balloons)for(const s of this.streams)if(w.camera.visible(s.x,s.y,260)) {
      g.save();g.strokeStyle='#d9f3d580';g.lineWidth=1.1;
      for(let i=0;i<10;i++){const x=s.x-215+((i*43+w.time*19)%430),y=s.y-13-i%3*6;
        g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+7,y+Math.sin(w.time*2+i)*1.2,x+16,y);g.stroke();}
      g.restore();
    }
    if(!balloons&&this.dance&&w.camera.visible(this.dance.x,this.dance.y,240))drawDancingAlligator(g,this.dance.x,this.dance.y,w.time);
    let speaker: typeof this.residents[number] | null = null;
    if (balloons) for (const r of this.residents) {
      if (r.speech > 0 && (!speaker || Math.abs(r.x-w.player.x) < Math.abs(speaker.x-w.player.x))) speaker = r;
    }
    for (const r of this.residents) {
      if (!w.camera.visible(r.x,r.y,130)) continue;
      if (!balloons) { drawResident(g,r,w.time,r.speech>0); continue; }
      if (r !== speaker) continue;
      const lines=LINES[r.role??'resident']??LINES.resident;
      const x=r.x,y=r.y-91;
      g.save(); g.font='10px sans-serif'; g.textAlign='center';
      const text=lines[r.line%lines.length], width=g.measureText(text).width+16;
      g.fillStyle='#fff1cd'; g.strokeStyle='#4a3e37'; g.lineWidth=1.2;
      g.beginPath(); g.roundRect(x-width/2,y-14,width,22,5); g.fill(); g.stroke();
      g.fillStyle='#41322d'; g.fillText(text,x,y);
      g.restore();
    }
  }
}
