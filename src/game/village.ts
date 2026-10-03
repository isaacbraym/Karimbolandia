import type { World } from './world';
import { TILE, type LevelData } from './level';
import { approach } from '../core/math';
import { drawResident, type ResidentPose } from '../art/village';

export class Village {
  readonly residents: (ResidentPose & { home:number; baseY:number; speech:number; cooldown:number })[];
  constructor(data:LevelData) {
    this.residents = data.decos.filter(d=>d.kind==='villageResident').map((d,id)=>
      ({x:d.x,y:d.y,baseY:Math.ceil(d.y/TILE)*TILE,home:d.x,id,facing:1,walk:0,gesture:0,speech:0,cooldown:0}));
  }
  reset() { for (const r of this.residents) { r.x=r.home; r.walk=r.gesture=r.speech=r.cooldown=0; } }
  update(w:World,dt:number) {
    for (const r of this.residents) {
      if (Math.abs(w.player.x-r.home)>1200) continue;
      const near = Math.abs(w.player.x-r.x)<185 && Math.abs(w.player.feetY-r.y)<170;
      r.cooldown=Math.max(0,r.cooldown-dt); r.speech=Math.max(0,r.speech-dt);
      r.gesture=approach(r.gesture,near?1:0,dt*3);
      if (near) { r.facing=w.player.x>=r.x?1:-1; if (r.cooldown===0) { r.speech=3.5; r.cooldown=10; } }
      const tx = r.home + (near ? -r.facing*18 : Math.sin(w.time*0.22+r.id)*28);
      const dx = Math.max(-dt*18,Math.min(dt*18,tx-r.x));
      r.x+=dx; r.walk+=Math.abs(dx)*0.16;
      r.y=w.level.reliefSurface(r.x)??r.baseY;
    }
  }
  draw(g:CanvasRenderingContext2D,w:World,balloons=false) {
    let speaker: typeof this.residents[number] | null = null;
    if (balloons) for (const r of this.residents) {
      if (r.speech > 0 && (!speaker || Math.abs(r.x-w.player.x) < Math.abs(speaker.x-w.player.x))) speaker = r;
    }
    for (const r of this.residents) {
      if (!w.camera.visible(r.x,r.y,130)) continue;
      if (!balloons) { drawResident(g,r,w.time); continue; }
      if (r !== speaker) continue;
      const lines=['Aqui é nossa casa. Siga pela trilha.','Não entre! A passagem é pelo rio.','Pode seguir, mas fique na trilha.'];
      const x=r.x,y=r.y-91;
      g.save(); g.font='10px sans-serif'; g.textAlign='center';
      const text=lines[r.id%3], width=g.measureText(text).width+16;
      g.fillStyle='#fff1cd'; g.strokeStyle='#4a3e37'; g.lineWidth=1.2;
      g.beginPath(); g.roundRect(x-width/2,y-14,width,22,5); g.fill(); g.stroke();
      g.fillStyle='#41322d'; g.fillText(text,x,y);
      g.restore();
    }
  }
}
