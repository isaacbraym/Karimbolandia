import { poly, shadedRR, OUT } from './kit';
export const VILLAGE_BOUNDS: Record<string, [number,number,number,number]> = {
  villageHome: [-108,-178,120,8], villageGarden: [-72,-38,76,8], villagePottery: [-44,-44,44,4],
};
export function paintVillageProp(g: CanvasRenderingContext2D, kind: string, seed: number) {
  if (!VILLAGE_BOUNDS[kind]) return false;
  g.fillStyle = 'rgba(12,28,15,.2)';
  g.beginPath(); g.ellipse(4,3,kind==='villageHome'?104:50,6,0,0,Math.PI*2); g.fill();
  if (kind === 'villageHome') {
    const v = Math.abs(seed) % 3;
    poly(g,[[-88,0],[76,0],[107,-18],[-57,-18]],'#99794d');
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
    poly(g,[[-66,2],[40,2],[71,-19],[-35,-19]],'#614931');
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
export function drawResident(g: CanvasRenderingContext2D, p: ResidentPose, t:number) {
  g.save(); g.translate(p.x,p.y); g.scale(p.facing,1);
  const skin = ['#ba835b','#a46a48','#cd9468','#8c593d'][p.id%4];
  const shirt = ['#467780','#ac6950','#667b51','#b49461'][p.id%4];
  const stride = Math.sin(p.walk)*9;
  g.strokeStyle = '#34343b'; g.lineWidth = 6; g.lineCap = 'round';
  for (const s of [-1,1]) { g.beginPath(); g.moveTo(s*4,-26); g.lineTo(s*5+stride*s,-12); g.lineTo(s*5+stride*s,0); g.stroke(); }
  g.fillStyle = '#bd9a6c'; g.fillRect(-10+stride,-2,9,3); g.fillRect(2-stride,-2,9,3);
  shadedRR(g,-10,-49,22,25,3,shirt,{lw:1});
  g.strokeStyle = '#d9bd84'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(-8,-32); g.lineTo(1,-35); g.lineTo(10,-32); g.stroke();
  g.strokeStyle = skin; g.lineWidth = 5;
  g.beginPath(); g.moveTo(-7,-45); g.lineTo(-12,-32); g.lineTo(-8,-26); g.stroke();
  const wave = p.gesture ? Math.sin(t*7+p.id)*3 : 0;
  g.beginPath(); g.moveTo(9,-45); g.lineTo(17,-38-p.gesture*14);
  g.lineTo(20+p.gesture*5,-29-p.gesture*27+wave); g.stroke();
  g.strokeStyle = OUT; g.lineWidth = 1;
  g.fillStyle = skin; g.beginPath(); g.ellipse(1,-60,9,11,0,0,Math.PI*2); g.fill(); g.stroke();
  g.fillStyle = '#211c21';
  g.beginPath(); g.ellipse(-2,-66,9,7,0,Math.PI,Math.PI*2); g.fill();
  if (p.id%2===0) shadedRR(g,-9,-63,5,24,2,'#211c21',{lw:0.6});
  g.fillStyle = '#221c26'; g.fillRect(6,-61,1.5,1.8);
  g.strokeStyle = '#744532'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(5,-54); g.lineTo(9,-54); g.stroke();
  g.restore();
}
