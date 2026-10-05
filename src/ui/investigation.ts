import { cabinScene } from '../art/cabin';
import { VILLAGE_LORE, type ExplorationSpot, type InvestigationObject } from '../game/exploration';
import type { ControlState } from '../core/input';
import type { World } from '../game/world';
import './investigation.css';
import { audio } from '../core/audio';

const el=<K extends keyof HTMLElementTagNameMap>(tag:K,cls:string,text?:string)=>{
  const node=document.createElement(tag);node.className=cls;if(text!==undefined)node.textContent=text;return node;
};

/** Modal de investigação: mundo congelado, navegação nativa, foco contido, nenhuma ação de combate. */
export class Investigation {
  readonly root=el('section','investigation');
  private buttons:HTMLButtonElement[]=[];
  private heading=el('h2','investigation-object-title');
  private message=el('p','investigation-message');
  private status=el('p','investigation-status');
  private journal=el('div','investigation-journal');
  private scene=el('div','investigation-scene');
  private prevFocus=document.activeElement as HTMLElement|null;
  private exit:()=>void;
  private padReady=false;
  private padMoveHeld=false;
  private keyListener=(event:KeyboardEvent)=>{
    if(event.code.startsWith('Arrow'))event.preventDefault();
    if(event.code!=='Tab')return;
    const focusable=[...this.root.querySelectorAll<HTMLElement>('button, summary')];
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  };
  constructor(parent:HTMLElement,private w:World,private spot:ExplorationSpot,onClose:()=>void,private onChange:()=>void) {
    this.exit=onClose;
    this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.setAttribute('aria-labelledby','investigation-title');
    const top=el('header','investigation-top'),title=el('h1','',spot.title);title.id='investigation-title';
    const identity=el('div','investigation-identity');identity.append(el('span','investigation-eyebrow',spot.cabin?'PELOS OLHOS DO KARIMBO':'ENTRE-RAÍZES · MEMÓRIAS DA TRILHA'),title,el('p','',spot.subtitle));
    const close=el('button','investigation-exit','SAIR · ESC');close.type='button';close.onclick=onClose;top.append(identity,close);
    const body=el('div','investigation-body'),detail=el('aside','investigation-detail');
    this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');
    const journalTitle=el('h3','','Caderno de Entre-Raízes');
    detail.append(el('span','investigation-eyebrow','OBSERVAÇÃO'),this.heading,this.message,this.status,journalTitle,this.journal);
    if(spot.cabin) {
      this.scene.innerHTML=cabinScene(w.exploration.spots.filter(s=>s.cabin).indexOf(spot));
      for(const obj of spot.objects) {
        const btn=el('button','investigation-hotspot');btn.type='button';btn.dataset.object=obj.id;
        btn.setAttribute('aria-label',obj.name);btn.title=obj.name;
        const [x,y,width,height]=obj.rect;btn.style.left=`${x/9.6}%`;btn.style.top=`${y/5.4}%`;btn.style.width=`${width/9.6}%`;btn.style.height=`${height/5.4}%`;
        btn.append(el('span','investigation-marker','+'),el('span','investigation-label',obj.name));
        btn.onclick=()=>this.inspect(obj);btn.onfocus=()=>this.preview(obj);this.scene.append(btn);this.buttons.push(btn);
      }
      this.heading.textContent='Uma cabana cheia de más decisões';
      this.message.textContent='Clique ou toque nos objetos. Gavetas e baús abrem primeiro; investigue de novo para recolher a reserva. Os fragmentos da aldeia ficam no caderno.';
    } else {
      this.scene.classList.add('investigation-lore-scene');
      const emblem=el('div','investigation-lore-emblem',spot.clue?.id==='cloth'?'≋':spot.clue?.id==='bell'?'♧':'❧');
      const paper=el('div','investigation-paper');paper.append(el('span','investigation-eyebrow','ARQUIVO VIVO DA ALDEIA'),el('h2','',spot.clue!.title),el('p','',spot.clue!.text),el('p','investigation-signature','Guardado por quem continua aqui.'));
      this.scene.append(emblem,paper);w.exploration.discover(w,spot.clue!);this.onChange();
      this.heading.textContent='Fragmento guardado';this.message.textContent='As pistas da trilha e das cabanas contam partes da mesma história. Explore com calma: nenhum cartucho precisa ser disparado aqui.';
    }
    body.append(this.scene,detail);this.root.append(top,body,el('footer','investigation-footer','OBJETOS: clique / toque / Tab + Enter · Controle: direcional + A · A trilha espera por você.'));
    this.buttons.push(close);parent.append(this.root);document.addEventListener('keydown',this.keyListener);this.refresh();close.focus();
  }
  private preview(obj:InvestigationObject) {
    this.root.querySelectorAll('.investigation-hotspot').forEach(b=>b.classList.toggle('selected',(b as HTMLElement).dataset.object===obj.id));
  }
  private inspect(obj:InvestigationObject) {
    this.preview(obj);this.heading.textContent=obj.name;
    this.message.textContent=this.w.exploration.inspect(this.w,this.spot,obj);
    audio.play(obj.ammo?'weapon':'uiClick',.4);
    this.status.textContent=obj.clue?'Pista registrada no caderno.':obj.ammo
      ?this.w.encounters.completed.has(this.w.exploration.key(this.spot,obj))?'Depósito recolhido nesta partida.':'Reserva disponível para recolher.'
      :'Observação registrada.';
    this.onChange();this.refresh();
  }
  private refresh() {
    this.journal.replaceChildren();
    const found=VILLAGE_LORE.filter(c=>this.w.exploration.found(this.w,c));
    this.journal.append(el('p','investigation-count',`${found.length} / ${VILLAGE_LORE.length} fragmentos encontrados`));
    for(const clue of VILLAGE_LORE) {
      const item=el('details','investigation-entry'),known=this.w.exploration.found(this.w,clue);
      item.append(el('summary','',known?clue.title:'Fragmento ainda escondido'));
      if(known)item.append(el('p','',clue.text));else item.append(el('p','','Procure objetos da aldeia e papéis esquecidos nas cabanas.'));
      this.journal.append(item);
    }
    for(const btn of this.buttons) {
      const obj=this.spot.objects.find(o=>o.id===btn.dataset.object);if(!obj)continue;
      const key=this.w.exploration.key(this.spot,obj),done=this.w.encounters.completed.has(key),opened=this.w.encounters.completed.has(`${key}:open`);
      btn.classList.toggle('investigated',done);btn.classList.toggle('opened',opened);
      btn.querySelector('.investigation-marker')!.textContent=done?'✓':opened?'↓':'+';
    }
    this.scene.classList.toggle('drawer-open',this.w.encounters.completed.has(`${this.spot.id}:drawer:open`));
    this.scene.classList.toggle('drawer-empty',this.w.encounters.completed.has(`${this.spot.id}:drawer`));
  }
  handleKey(code:string) {
    if(code==='Escape'){this.exit();return true;}
    if(code==='Enter'||code==='Space'){(document.activeElement as HTMLButtonElement)?.click();return true;}
    if(code==='ArrowLeft'||code==='ArrowRight'||code==='ArrowUp'||code==='ArrowDown') {
      this.moveFocus(code==='ArrowLeft'||code==='ArrowUp'?-1:1);return true;
    }
    return false;
  }
  private moveFocus(dir:number) {
    const items=[...this.root.querySelectorAll<HTMLElement>('button, summary')];
    const index=items.indexOf(document.activeElement as HTMLElement);
    items[(index+dir+items.length)%items.length]?.focus();
  }
  updatePad(ctl:ControlState) {
    if(ctl.device!=='pad')return;
    if(!this.padReady){if(!ctl.interact?.held&&!ctl.jump.held&&!ctl.fire.held&&!ctl.pause.held)this.padReady=true;return;}
    if(ctl.pause.pressed||ctl.interact?.pressed){this.exit();return;}
    const move=Math.abs(ctl.moveX)>.5?ctl.moveX:Math.abs(ctl.moveY)>.5?ctl.moveY:0;
    if(move&&!this.padMoveHeld)this.moveFocus(move>0?1:-1);this.padMoveHeld=!!move;
    if(ctl.jump.pressed)(document.activeElement as HTMLButtonElement)?.click();
  }
  destroy() {
    document.removeEventListener('keydown',this.keyListener);this.root.remove();
    if(this.prevFocus?.isConnected)this.prevFocus.focus();
  }
}
