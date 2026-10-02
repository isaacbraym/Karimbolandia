/**
 * Desenho no mundo das mecânicas da selva: cipós de balançar, interior do templo (paredes de pedra
 * ao fundo e escuridão iluminada pelo Karimbo e pelas tochas) e o aviso "↑ ENTRAR" nas portas.
 */
import type { World } from '../game/world';
import type { DoorSpawn, RoomZone } from '../game/level';
import { makeCanvas, glowSprite } from './kit';
import { Rng } from '../core/math';

interface Tex {
  leaf: HTMLCanvasElement;
  wall: HTMLCanvasElement;
  hole: HTMLCanvasElement;
}
let tex: Tex | null = null;

function textures(): Tex {
  if (tex) return tex;
  const leaf = makeCanvas(28, 14);
  {
    const g = leaf.getContext('2d')!;
    g.fillStyle = '#3f9446';
    g.beginPath();
    g.moveTo(1, 7);
    g.quadraticCurveTo(13, -3, 27, 7);
    g.quadraticCurveTo(13, 17, 1, 7);
    g.fill();
    g.strokeStyle = '#1d4a26';
    g.lineWidth = 1;
    g.stroke();
    g.strokeStyle = 'rgba(200,255,170,0.45)';
    g.beginPath();
    g.moveTo(3, 7);
    g.lineTo(25, 7);
    g.stroke();
  }
  // parede interna do templo (repete sem emenda): blocos talhados, frisos e musgo
  const wall = makeCanvas(256, 256);
  {
    const g = wall.getContext('2d')!;
    g.fillStyle = '#2c2f2a';
    g.fillRect(0, 0, 256, 256);
    const r = new Rng(21);
    for (let y = 0; y < 256; y += 32) {
      const off = (y / 32) % 2 ? 32 : 0;
      for (let x = -64; x < 256; x += 64) {
        const bx = x + off;
        g.fillStyle = r.chance(0.5) ? '#3a3e37' : '#353932';
        g.fillRect(bx + 1, y + 1, 62, 30);
        g.fillStyle = 'rgba(255,255,255,0.05)';
        g.fillRect(bx + 1, y + 1, 62, 3);
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.fillRect(bx + 1, y + 27, 62, 4);
        if (r.chance(0.15)) {
          // glifo entalhado
          g.strokeStyle = 'rgba(10,12,10,0.6)';
          g.lineWidth = 2;
          g.beginPath();
          g.arc(bx + 32, y + 16, 8, 0, Math.PI * 2);
          g.moveTo(bx + 24, y + 16);
          g.lineTo(bx + 40, y + 16);
          g.moveTo(bx + 32, y + 8);
          g.lineTo(bx + 32, y + 24);
          g.stroke();
        }
        if (r.chance(0.25)) {
          g.fillStyle = 'rgba(80,130,60,0.35)';
          g.beginPath();
          g.ellipse(bx + r.range(8, 56), y + 4, r.range(6, 14), 3, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }
  // "furo" de luz: escuro em volta, transparente no centro (o Karimbo ilumina o caminho)
  const hole = makeCanvas(256, 256);
  {
    const g = hole.getContext('2d')!;
    const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128);
    gr.addColorStop(0, 'rgba(4,5,8,0)');
    gr.addColorStop(0.55, 'rgba(4,5,8,0.25)');
    gr.addColorStop(1, 'rgba(4,5,8,0.82)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
  }
  tex = { leaf, wall, hole };
  return tex;
}

// ------------------------------------------------------------------ cipós
interface Bough {
  x0: number; // tronco
  x1: number; // ponta (último cipó)
  y: number;
  vines: number[];
}
const boughCache = new WeakMap<object, Bough[]>();

/** Liga os cipós de fora (não os da masmorra) a galhões que saem da árvore mais próxima. */
function boughs(w: World): Bough[] {
  const hit = boughCache.get(w.data);
  if (hit) return hit;
  const trees = w.data.decos.filter((d) => d.kind === 'jTree').map((d) => d.x);
  const out: Bough[] = [];
  const inRoom = (x: number, y: number) => w.data.rooms.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  for (const v of w.vines) {
    if (inRoom(v.x, v.y)) continue;
    let best = Infinity;
    for (const tx of trees) if (Math.abs(tx - v.x) < Math.abs(best - v.x)) best = tx;
    if (!Number.isFinite(best) || Math.abs(best - v.x) > 600) continue;
    let b = out.find((o) => o.x0 === best && Math.abs(o.y - v.y) < 40);
    if (!b) {
      b = { x0: best, x1: v.x, y: v.y, vines: [] };
      out.push(b);
    }
    if (Math.abs(v.x - best) > Math.abs(b.x1 - best)) b.x1 = v.x;
    b.vines.push(v.spawn.id);
  }
  boughCache.set(w.data, out);
  return out;
}

function drawBough(g: CanvasRenderingContext2D, b: Bough, t: number) {
  const dir = Math.sign(b.x1 - b.x0) || 1;
  const x1 = b.x1 + dir * 26;
  const len = Math.abs(x1 - b.x0);
  const mid = (b.x0 + x1) / 2;
  // galho grosso saindo do tronco, afinando até a ponta e arqueando um pouco
  g.fillStyle = '#3a281c';
  g.beginPath();
  g.moveTo(b.x0, b.y - 22);
  g.quadraticCurveTo(mid, b.y - 34, x1, b.y - 6);
  g.lineTo(x1, b.y + 2);
  g.quadraticCurveTo(mid, b.y - 6, b.x0, b.y + 16);
  g.closePath();
  g.fill();
  g.strokeStyle = '#170f2e';
  g.lineWidth = 1.4;
  g.stroke();
  g.fillStyle = '#5a4030';
  g.beginPath();
  g.moveTo(b.x0, b.y - 18);
  g.quadraticCurveTo(mid, b.y - 30, x1, b.y - 5);
  g.lineTo(x1, b.y - 3);
  g.quadraticCurveTo(mid, b.y - 22, b.x0, b.y - 10);
  g.closePath();
  g.fill();
  // musgo e tufos de folhas ao longo do galho
  const n = Math.max(3, Math.floor(len / 70));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = b.x0 + (x1 - b.x0) * k;
    const y = b.y - 20 + 16 * k * k - Math.sin(k * Math.PI) * 8;
    g.fillStyle = i % 2 ? '#2f7a3a' : '#3f9446';
    g.beginPath();
    g.ellipse(x, y - 8, 26 - k * 10, 11 - k * 3, Math.sin(t * 0.8 + i) * 0.05, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#5c9a38';
    g.beginPath();
    g.ellipse(x - 6, y - 12, 12 - k * 4, 5, 0, 0, Math.PI * 2);
    g.fill();
  }
}

export function drawVines(g: CanvasRenderingContext2D, w: World) {
  const T = textures();
  const cam = w.camera;
  const p = w.player;
  for (const b of boughs(w)) {
    const lo = Math.min(b.x0, b.x1) - 60;
    const hi = Math.max(b.x0, b.x1) + 60;
    if (hi < cam.x || lo > cam.x + cam.w || b.y < cam.y - 80 || b.y > cam.y + cam.h + 40) continue;
    drawBough(g, b, w.time);
  }
  for (const v of w.vines) {
    if (!cam.visible(v.x, v.y + v.len / 2, v.len + 40)) continue;
    const [ex, ey] = v.point();
    // curvatura: o cipó "arrasta" um pouco atrás do balanço
    const bend = -v.av * v.len * 0.06;
    const mx = (v.x + ex) / 2 + Math.cos(v.a) * bend;
    const my = (v.y + ey) / 2 - Math.sin(v.a) * bend;
    g.strokeStyle = '#3a2a16';
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(v.x, v.y);
    g.quadraticCurveTo(mx, my, ex, ey);
    g.stroke();
    g.strokeStyle = '#6a8a3a';
    g.lineWidth = 2.6;
    g.stroke();
    // nó de amarração no galho
    g.fillStyle = '#4a3420';
    g.beginPath();
    g.arc(v.x, v.y, 5, 0, Math.PI * 2);
    g.fill();
    // folhas ao longo do cipó
    const n = Math.floor(v.len / 26);
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const x = (1 - t) * (1 - t) * v.x + 2 * (1 - t) * t * mx + t * t * ex;
      const y = (1 - t) * (1 - t) * v.y + 2 * (1 - t) * t * my + t * t * ey;
      g.save();
      g.translate(x, y);
      g.rotate((i % 2 ? 0.6 : 2.5) - v.a + Math.sin(w.time * 2 + i + v.spawn.id) * 0.15);
      g.drawImage(T.leaf, 0, -5, 20, 10);
      g.restore();
    }
    // ponta com laço (onde agarrar) + brilho quando o Karimbo está no ar perto
    const near = !v.held && !p.vine && Math.abs(p.x - ex) < 170 && Math.abs(p.feetY - 58 - ey) < 200;
    v.hint += ((near ? 1 : 0) - v.hint) * 0.12;
    if (v.hint > 0.05) {
      const spr = glowSprite('#fff2a0', 32);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = v.hint * (0.35 + 0.15 * Math.sin(w.time * 6 + v.spawn.id));
      g.drawImage(spr.c, ex - 16, ey - 16, 32, 32);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    g.strokeStyle = '#6a8a3a';
    g.lineWidth = 2.4;
    g.beginPath();
    g.ellipse(ex, ey + 4, 4, 6, -v.a, 0, Math.PI * 2);
    g.stroke();
  }
}

// ------------------------------------------------------------------ interior do templo
function roomVisible(w: World, r: RoomZone) {
  const c = w.camera;
  return r.x < c.x + c.w && r.x + r.w > c.x && r.y < c.y + c.h && r.y + r.h > c.y;
}

/** Fundo do interior: paredes de pedra (só onde não há tile, os tiles vêm por cima). */
export function drawRoomBack(g: CanvasRenderingContext2D, w: World) {
  const T = textures();
  const c = w.camera;
  for (const r of w.data.rooms) {
    if (!roomVisible(w, r)) continue;
    const x0 = Math.max(r.x, c.x - 8);
    const x1 = Math.min(r.x + r.w, c.x + c.w + 8);
    const y0 = Math.max(r.y, c.y - 8);
    const y1 = Math.min(r.y + r.h, c.y + c.h + 8);
    // a textura acompanha o mundo (não a câmera): parede parada atrás de tudo
    let ty = r.y + Math.floor((y0 - r.y) / 256) * 256;
    for (; ty < y1; ty += 256) {
      let tx = r.x + Math.floor((x0 - r.x) / 256) * 256;
      for (; tx < x1; tx += 256) {
        const sx = Math.max(0, x0 - tx);
        const sy = Math.max(0, y0 - ty);
        const ex = Math.min(256, x1 - tx);
        const ey = Math.min(256, y1 - ty);
        if (ex <= sx || ey <= sy) continue;
        g.drawImage(T.wall, sx, sy, ex - sx, ey - sy, tx + sx, ty + sy, ex - sx, ey - sy);
      }
    }
  }
}

/** Escuridão do interior com luz em volta do Karimbo; tochas acesas brilham por cima. */
export function drawRoomDark(g: CanvasRenderingContext2D, w: World) {
  const T = textures();
  const c = w.camera;
  const p = w.player;
  for (const r of w.data.rooms) {
    if (!roomVisible(w, r)) continue;
    const x0 = Math.max(r.x, c.x - 8);
    const x1 = Math.min(r.x + r.w, c.x + c.w + 8);
    const y0 = Math.max(r.y, c.y - 8);
    const y1 = Math.min(r.y + r.h, c.y + c.h + 8);
    const R = 170;
    const lx = p.x;
    const ly = p.y - 10;
    const hx0 = lx - R;
    const hy0 = ly - R;
    const hx1 = lx + R;
    const hy1 = ly + R;
    g.fillStyle = 'rgba(4,5,8,0.82)';
    // tudo fora do círculo de luz: quatro retângulos (sem recorte por quadro)
    if (hy0 > y0) g.fillRect(x0, y0, x1 - x0, Math.min(hy0, y1) - y0);
    if (hy1 < y1) g.fillRect(x0, Math.max(hy1, y0), x1 - x0, y1 - Math.max(hy1, y0));
    const my0 = Math.max(y0, hy0);
    const my1 = Math.min(y1, hy1);
    if (my1 > my0) {
      if (hx0 > x0) g.fillRect(x0, my0, Math.min(hx0, x1) - x0, my1 - my0);
      if (hx1 < x1) g.fillRect(Math.max(hx1, x0), my0, x1 - Math.max(hx1, x0), my1 - my0);
      g.save();
      g.beginPath();
      g.rect(x0, y0, x1 - x0, y1 - y0);
      g.clip();
      g.drawImage(T.hole, hx0, hy0, R * 2, R * 2);
      g.restore();
    }
    // tochas (decorações dentro da sala) e brilho quente do Karimbo
    g.globalCompositeOperation = 'lighter';
    const torch = glowSprite('#ff9a3a', 32);
    for (const d of w.data.decos) {
      if (d.kind !== 'jTorch' || d.x < r.x || d.x > r.x + r.w || d.y < r.y || d.y > r.y + r.h + 4) continue;
      if (!c.visible(d.x, d.y - 60, 140)) continue;
      const fl = 0.75 + 0.15 * Math.sin(w.time * 11 + d.x) + 0.1 * Math.sin(w.time * 23 + d.x * 0.3);
      g.globalAlpha = 0.55 * fl;
      g.drawImage(torch.c, d.x - 110, d.y - 68 - 110, 220, 220);
    }
    g.globalAlpha = 0.16;
    const warm = glowSprite('#ffd27a', 32);
    g.drawImage(warm.c, lx - 120, ly - 120, 240, 240);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
}

/** "↑ ENTRAR" pulsando sobre a porta do templo. */
export function drawDoorPrompt(g: CanvasRenderingContext2D, w: World, d: DoorSpawn) {
  const bob = Math.sin(w.time * 6) * 3;
  const y = d.y - 96 + bob;
  g.fillStyle = 'rgba(10,12,20,0.75)';
  g.beginPath();
  g.arc(d.x, y, 13, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffe27a';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = '#ffe27a';
  g.beginPath();
  g.moveTo(d.x, y - 8);
  g.lineTo(d.x + 7, y + 1);
  g.lineTo(d.x + 2.5, y + 1);
  g.lineTo(d.x + 2.5, y + 7);
  g.lineTo(d.x - 2.5, y + 7);
  g.lineTo(d.x - 2.5, y + 1);
  g.lineTo(d.x - 7, y + 1);
  g.closePath();
  g.fill();
}
