import { poly, shadedRR, OUT, bake, drawSpr, shadedEllipse, type Sprite } from './kit';
import { prism, clothFinish } from './volume';
export const VILLAGE_BOUNDS: Record<string, [number,number,number,number]> = {
  villageHome: [-108,-181,120,11], villageGarden: [-72,-38,80,11], villagePottery: [-50,-44,57,12],
};
export function paintVillageProp(g: CanvasRenderingContext2D, kind: string, seed: number) {
  if (!VILLAGE_BOUNDS[kind]) return false;
  g.fillStyle = 'rgba(12,28,15,.2)';
  g.beginPath(); g.ellipse(4,3,kind==='villageHome'?104:50,6,0,0,Math.PI*2); g.fill();
  if (kind === 'villageHome') {
    const v = Math.abs(seed) % 3;
    prism(g, -88, 0, 164, 6, 31, -18, '#99794d');
    poly(g,[[76,0],[107,-18],[107,-96],[76,-83]],'#5d573a');
    shadedRR(g,-79,-84,155,83,3,['#a88858','#90744d','#b39d67'][v]);
    g.strokeStyle = '#6e563a'; g.lineWidth = 1.4;
    for (let x = -70; x < 75; x += 10) { g.beginPath(); g.moveTo(x,-81); g.lineTo(x,-2); g.stroke(); }
    poly(g,[[-102,-77],[-5,-163],[98,-91],[116,-110],[14,-177]],'#a89255');
    poly(g,[[-102,-77],[-5,-163],[98,-91],[81,-76],[-80,-68]],'#c8af68');
    g.strokeStyle = '#927b42'; g.lineWidth = 1;
    for (let i = -82; i < 84; i += 7) { g.beginPath(); g.moveTo(-5+i*0.12,-156); g.lineTo(i,-76-i*0.07); g.stroke(); }
    shadedRR(g,-17+v*8,-63,30,62,3,'#362c26');
    shadedRR(g,-61,-57,22,21,2,'#3c372a');
    g.strokeStyle = '#ad9060'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-50,-57); g.lineTo(-50,-36); g.stroke();
    // Tecidos e cestos de uso cotidiano, sem insígnia de mercenário.
    poly(g,[[29,-56],[62,-56],[60,-19],[31,-19]],['#536f78','#925347','#547158'][v]);
    g.strokeStyle = '#d2bd81'; g.lineWidth = 1.4;
    for (let y = -49; y < -20; y += 10) { g.beginPath(); g.moveTo(31,y); g.lineTo(45,y-4); g.lineTo(60,y); g.stroke(); }
  } else if (kind === 'villageGarden') {
    prism(g, -66, 2, 106, 5, 31, -21, '#614931');
    g.strokeStyle = '#977850'; g.lineWidth = 1.2;
    for (let x = -54; x < 51; x += 13) {
      g.beginPath(); g.moveTo(x,0); g.lineTo(x+27,-17); g.stroke();
      poly(g,[[x+8,-3],[x-1,-19],[x+8,-13],[x+19,-29],[x+16,-12]],'#708b43',{lw:0.5});
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const x = (i-1)*25, h = 22+i*6;
      g.fillStyle = ['#af7654','#c59468','#8d6048'][i]; g.strokeStyle = OUT; g.lineWidth = 1;
      g.beginPath(); g.ellipse(x,-h*0.45,10+i*2,h*0.5,0,0,Math.PI*2); g.fill(); g.stroke();
      shadedRR(g,x-6,-h,12,6,2,'#6b4939');
      g.strokeStyle = '#e1c798'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x-8,-h*0.5); g.lineTo(x,-h*0.6); g.lineTo(x+8,-h*0.5); g.stroke();
    }
  }
  return true;
}

export interface ResidentPose { x:number; y:number; id:number; facing:number; walk:number; gesture:number }
const residents = new Map<number, { body: Sprite; head: Sprite; arm: Sprite; leg: Sprite; shoe: Sprite }>();
function residentArt(id: number, skin: string, shirt: string) {
  const key = id % 4, cached = residents.get(key); if (cached) return cached;
  const body = bake(28, 30, g => {
    shadedRR(g, 4, 3, 22, 25, 3, shirt, { lw: 1 }); clothFinish(g, 4, 3, 22, 25, shirt);
    g.strokeStyle = '#d9bd84'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(6, 20); g.lineTo(15, 17); g.lineTo(24, 20); g.stroke();
    g.fillStyle = '#d8c7a4'; g.fillRect(9, 9, 3, 2); g.fillRect(19, 24, 3, 1);
  }, { scale: 3, ox: 14, oy: 28 });
  const head = bake(30, 36, g => {
    shadedEllipse(g, 15, 18, 9, 11, skin, { lw: 1 });
    shadedEllipse(g, 7, 20, 2, 3, skin, { lw: .6 });
    g.fillStyle = '#211c21'; g.beginPath(); g.ellipse(12, 12, 9, 7, 0, Math.PI, Math.PI * 2); g.fill();
    if (id % 2 === 0) shadedRR(g, 5, 15, 5, 19, 2, '#211c21', { lw: .6 });
    g.fillStyle = '#eee2cc'; g.fillRect(19, 17, 2.5, 2.1);
    g.fillStyle = '#221c26'; g.fillRect(20, 17.4, 1.4, 1.8); g.fillRect(18.5, 15.2, 4, .8);
    g.strokeStyle = '#744532'; g.lineWidth = .7; g.beginPath(); g.moveTo(19, 24); g.lineTo(23, 24); g.stroke();
    g.fillStyle = '#f0c99c44'; g.beginPath(); g.ellipse(17, 22, 3, 1.5, 0, 0, Math.PI * 2); g.fill();
  }, { scale: 3, ox: 14, oy: 30 });
  const arm = bake(10, 24, g => {
    shadedRR(g, 2, 2, 6, 20, 3, skin, { lw: .8 });
    g.strokeStyle = '#efd3a766'; g.lineWidth = .7;
    g.beginPath(); g.moveTo(3.5, 5); g.lineTo(3.5, 16); g.stroke();
  }, { scale: 3, ox: 5, oy: 2 });
  const leg = bake(12, 24, g => {
    shadedRR(g, 2, 2, 8, 20, 2, '#42424b', { lw: .8 });
    clothFinish(g, 2, 2, 8, 20, '#42424b');
  }, { scale: 3, ox: 6, oy: 2 });
  const shoe = bake(15, 9, g => {
    shadedRR(g, 1, 2, 13, 5, 2, '#9d7651', { lw: .8 });
    g.fillStyle = '#e2c59b'; g.fillRect(3, 2, 8, 1);
    g.fillStyle = '#332b2d'; g.fillRect(2, 6, 11, 1.3);
    g.strokeStyle = '#493b35'; g.lineWidth = 1; g.beginPath(); g.moveTo(5, 2); g.lineTo(8, 6); g.stroke();
  }, { scale: 3, ox: 7, oy: 7 });
  const art = { body, head, arm, leg, shoe }; residents.set(key, art); return art;
}
function residentLimb(g: CanvasRenderingContext2D, art: Sprite, x: number, y: number, ex: number, ey: number) {
  g.save(); g.translate(x, y); g.rotate(Math.atan2(ey - y, ex - x) - Math.PI / 2);
  g.scale(1, Math.hypot(ex - x, ey - y) / 20); drawSpr(g, art, 0, 0); g.restore();
}
export function drawResident(g: CanvasRenderingContext2D, p: ResidentPose, t:number) {
  g.save(); g.translate(p.x,p.y); g.scale(p.facing,1);
  const skin = ['#ba835b','#a46a48','#cd9468','#8c593d'][p.id%4];
  const shirt = ['#467780','#ac6950','#667b51','#b49461'][p.id%4];
  const art = residentArt(p.id, skin, shirt);
  const stride = Math.sin(p.walk)*9;
  for (const s of [-1,1]) {
    const foot = s*5+stride*s;
    residentLimb(g, art.leg, s*4, -26, foot, -12); residentLimb(g, art.leg, foot, -12, foot, 0);
    drawSpr(g, art.shoe, foot + 2, 1);
  }
  drawSpr(g, art.body, 0, -24);
  residentLimb(g, art.arm, -7, -45, -12, -32); residentLimb(g, art.arm, -12, -32, -8, -26);
  const wave = p.gesture ? Math.sin(t*7+p.id)*3 : 0;
  residentLimb(g, art.arm, 9, -45, 17, -38-p.gesture*14);
  residentLimb(g, art.arm, 17, -38-p.gesture*14, 20+p.gesture*5, -29-p.gesture*27+wave);
  drawSpr(g, art.head, 0, -48);
  g.restore();
}
