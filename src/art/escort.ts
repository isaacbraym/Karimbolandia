import { bake, drawSpr, shadedRR, type Sprite } from './kit';
import { prism } from './volume';
import { REPAIR_TIME, type DroneEscort } from '../game/encounters/escort';

let body: Sprite | null = null, dock: Sprite | null = null;
function prepare() {
  if (body) return;
  body = bake(76, 42, g => {
    shadedRR(g, 8, 13, 60, 4, 2, '#303b54', { lw: 1 });
    prism(g, 23, 15, 26, 12, 5, -4, '#527c99');
    g.fillStyle = '#a9e4eb'; g.fillRect(27, 17, 14, 3);
    prism(g, 27, 29, 20, 9, 4, -3, '#be8652');
    g.fillStyle = '#f2ce8c'; g.fillRect(35, 28, 3, 10);
    g.strokeStyle = '#233347'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(30, 17); g.lineTo(33, 19); g.lineTo(31, 21); g.stroke();
  }, { scale: 3, ox: 38, oy: 22 });
  dock = bake(80, 80, g => {
    prism(g, 4, 70, 60, 5, 10, -8, '#344c67');
    shadedRR(g, 53, 12, 7, 58, 2, '#536e88', { lw: 1 });
    prism(g, 40, 9, 28, 19, 5, -4, '#436b87');
    g.fillStyle = '#92e1ed'; g.fillRect(44, 13, 19, 8);
    g.strokeStyle = '#253851'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(45, 14); g.lineTo(53, 19); g.lineTo(61, 14); g.stroke();
    g.strokeStyle = '#9ae4ed'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(29, 68, 12, 3, 0, 0, Math.PI * 2); g.stroke();
  }, { scale: 3, ox: 38, oy: 75 });
}

/** Apenas sprites prontos e traços curtos animados; sem gradientes por quadro. */
export function drawEscort(g: CanvasRenderingContext2D, e: DroneEscort, time: number, visible: (x: number, y: number) => boolean) {
  prepare(); g.save();
  const target = e.def.destination;
  if (visible(target.x, target.y)) {
    drawSpr(g, dock!, target.x, target.y);
    g.fillStyle = e.status === 'complete' ? '#beff9a' : '#c4f6ff';
    g.beginPath(); g.arc(target.x + 19, target.y - 58, 2.4, 0, Math.PI * 2); g.fill();
  }
  if (e.departure >= 3 || !visible(e.drone.x, e.drone.y)) { g.restore(); return; }
  if(e.status==='complete')g.globalAlpha*=1-e.departure/3;
  const flying = e.status !== 'ready', bob = flying ? Math.sin(time * 5) * 2 : 0;
  g.translate(e.drone.x, e.drone.y + bob); g.rotate(flying ? Math.sin(time * 3) * .025 : -.12);
  drawSpr(g, body!, 0, 0);
  g.strokeStyle = flying ? '#b7edf4' : '#66718c'; g.lineWidth = 1.6;
  for (const x of [-27, 27]) {
    g.beginPath(); g.ellipse(x, -10, 13, flying ? 1 + Math.abs(Math.sin(time * 40)) * 2 : 1.5, 0, 0, Math.PI * 2); g.stroke();
  }
  g.fillStyle = flying ? '#a3f7ff' : '#ffb65e'; g.fillRect(9, -3, 4, 3);
  if (e.status === 'escort') {
    g.fillStyle = '#c2f5ff'; g.textAlign = 'center'; g.font = 'bold 18px sans-serif'; g.fillText('→', 0, -23);
    g.fillStyle = '#43516b'; g.fillRect(-16, 22, 32, 3);
    g.fillStyle = '#a9ecb8'; g.fillRect(-16, 22, 32 * Math.min(1, e.handoff / .7), 3);
  }
  g.restore();
}

/** Instruções acima da vegetação/pilares de primeiro plano, sem cobrir o personagem. */
export function drawEscortPrompt(g: CanvasRenderingContext2D, e: DroneEscort, visible: (x: number, y: number) => boolean) {
  if (e.status === 'complete') return;
  const p = e.status === 'ready' ? e.drone : e.def.destination;
  if (!visible(p.x, p.y)) return;
  g.save(); g.translate(p.x, p.y); g.textAlign = 'center';
  if (e.status === 'ready') {
    g.fillStyle = '#211a35ee'; g.fillRect(-82, -93, 164, 32);
    g.textAlign = 'center'; g.font = 'bold 9px sans-serif'; g.fillStyle = '#b9f5ff';
    g.fillText('DRONE AVARIADO', 0, -81);
    g.fillStyle = '#ffe0a1';
    g.fillText(`Pare para reparar • +${e.def.coins} moedas`, 0, -69);
    g.fillStyle = '#43516b'; g.fillRect(-64, -58, 128, 3);
    g.fillStyle = '#a9ecb8'; g.fillRect(-64, -58, 128 * Math.min(1, e.repair / REPAIR_TIME), 3);
  } else {
    g.fillStyle = '#211a35ee'; g.fillRect(-30, -99, 60, 18);
    g.fillStyle = '#c4f6ff'; g.font = 'bold 10px sans-serif'; g.fillText('BASE ↓', 0, -86);
  }
  g.restore();
}
