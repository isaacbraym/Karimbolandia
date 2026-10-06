/**
 * Desenho no mundo das mecânicas da selva: cipós de balançar, interior do templo (paredes de pedra
 * ao fundo e escuridão iluminada pelo Karimbo e pelas tochas) e o aviso "↑ ENTRAR" nas portas.
 */
import type { World } from '../game/world';
import type { DoorSpawn, RoomZone } from '../game/level';
import { makeCanvas, glowSprite } from './kit';
import { Rng } from '../core/math';
import { music } from '../core/music';
const musicBeat = () => music.beat();

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
    if (r.kind === 'club') {
      drawClubBack(g, w, x0, y0, x1, y1, r);
      continue;
    }
    if (r.kind === 'passage') {
      const p = w.player;
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        g.fillStyle = '#152c2d'; g.fillRect(c.x, c.y, c.w, c.h);
      }
      continue;
    }
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
    if (r.kind === 'club') {
      drawClubLights(g, w, r);
      continue;
    }
    if (r.kind === 'passage') continue;
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

// ------------------------------------------------------------------ tambores-trampolim
/** Tambor tribal: corpo de madeira pintado, cordas e couro que afunda quando o Karimbo quica. */
export function drawDrums(g: CanvasRenderingContext2D, w: World) {
  const cam = w.camera;
  const beat = w.rhythm.active ? musicBeat() : 1;
  const warm = glowSprite('#ffb060', 32);
  for (const d of w.data.drums) {
    if (!cam.visible(d.x, d.y + 30, d.w + 40)) continue;
    const hit = w.drumHit.get(d.id) ?? 0;
    if (d.style === 'speaker') {
      drawSpeaker(g, d, hit, w.rhythm.active ? musicBeat() : 1);
      continue;
    }
    // luz quente em volta de cada tambor (mais forte na batida e no quique)
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.22 + (1 - beat) * 0.18 + hit * 0.3;
    g.drawImage(warm.c, d.x - 120, d.y - 150, 240, 240);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    const hw = d.w / 2;
    const H = 60;
    const top = d.y + 2 + hit * 7;
    // corpo
    g.fillStyle = '#6a3f20';
    g.beginPath();
    g.moveTo(d.x - hw, top);
    g.lineTo(d.x + hw, top);
    g.lineTo(d.x + hw * 0.82, d.y + H);
    g.lineTo(d.x - hw * 0.82, d.y + H);
    g.closePath();
    g.fill();
    g.strokeStyle = '#170f2e';
    g.lineWidth = 1.6;
    g.stroke();
    // faixa pintada em zigue-zague
    g.strokeStyle = d.id % 2 ? '#e2384a' : '#ffd23a';
    g.lineWidth = 2.4;
    g.beginPath();
    for (let i = 0; i <= 8; i++) {
      const x = d.x - hw * 0.9 + (i / 8) * hw * 1.8;
      const y = d.y + 26 + (i % 2 ? 7 : -7);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    // cordas de amarração
    g.strokeStyle = '#d8b878';
    g.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      const x = d.x - hw * 0.8 + (i / 4) * hw * 1.6;
      g.beginPath();
      g.moveTo(x, top + 3);
      g.lineTo(x + (i % 2 ? 6 : -6), d.y + 16);
      g.stroke();
    }
    // couro (afunda no quique) + brilho na batida
    g.fillStyle = '#e8d2a0';
    g.beginPath();
    g.ellipse(d.x, top, hw, 6 - hit * 2, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#170f2e';
    g.lineWidth = 1.4;
    g.stroke();
    const glow = (1 - beat) * (w.rhythm.active ? 0.5 : 0) + hit * 0.8;
    if (glow > 0.03) {
      const spr = glowSprite('#ffe27a', 32);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = Math.min(1, glow);
      g.drawImage(spr.c, d.x - hw * 1.4, top - 18, hw * 2.8, 36);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
  }
}

// ------------------------------------------------------------------ boate (fase 1)
let clubWall: HTMLCanvasElement | null = null;
/** Parede da boate: painéis escuros com grade de neon (repete sem emenda). */
function clubTexture() {
  if (clubWall) return clubWall;
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d')!;
  g.fillStyle = '#120a26';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      g.fillStyle = (x + y) % 128 ? '#1a1036' : '#160c2e';
      g.fillRect(x + 2, y + 2, 60, 60);
    }
  }
  g.strokeStyle = 'rgba(255,63,180,0.35)';
  g.lineWidth = 1.4;
  for (let i = 0; i <= 256; i += 64) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 256);
    g.moveTo(0, i);
    g.lineTo(256, i);
    g.stroke();
  }
  g.fillStyle = 'rgba(57,240,255,0.5)';
  for (let i = 0; i < 256; i += 64) for (let j = 0; j < 256; j += 64) g.fillRect(i - 1.5, j - 1.5, 3, 3);
  clubWall = c;
  return c;
}

/** Fundo da boate (paredes de neon + equalizador gigante pulsando na música). */
export function drawClubBack(g: CanvasRenderingContext2D, w: World, x0: number, y0: number, x1: number, y1: number, r: RoomZone) {
  const tx = clubTexture();
  let ty = r.y + Math.floor((y0 - r.y) / 256) * 256;
  for (; ty < y1; ty += 256) {
    let xx = r.x + Math.floor((x0 - r.x) / 256) * 256;
    for (; xx < x1; xx += 256) {
      const sx = Math.max(0, x0 - xx);
      const sy = Math.max(0, y0 - ty);
      const ex = Math.min(256, x1 - xx);
      const ey = Math.min(256, y1 - ty);
      if (ex > sx && ey > sy) g.drawImage(tx, sx, sy, ex - sx, ey - sy, xx + sx, ty + sy, ex - sx, ey - sy);
    }
  }
  // equalizador: barras subindo e descendo com a batida
  const beat = music.beat();
  const n = Math.floor(r.w / 40);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = r.x + 20 + i * 40;
    if (x < x0 - 40 || x > x1 + 40) continue;
    const lv = 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7 + w.time * (2 + (i % 3)))) * (0.55 + 0.45 * (1 - beat));
    const h = r.h * 0.45 * lv;
    g.globalAlpha = 0.16;
    g.fillStyle = i % 3 === 0 ? '#ff3fb4' : i % 3 === 1 ? '#39f0ff' : '#b07aff';
    for (let k = 0; k < h; k += 12) g.fillRect(x - 12, r.y + r.h - 40 - k, 24, 8);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

/** Luzes da pista: fachos coloridos girando e um "flash" a cada batida. */
export function drawClubLights(g: CanvasRenderingContext2D, w: World, r: RoomZone) {
  const c = w.camera;
  const beat = music.beat();
  g.save();
  g.beginPath();
  g.rect(r.x, r.y, r.w, r.h);
  g.clip();
  g.globalCompositeOperation = 'lighter';
  const cols = ['#ff3fb4', '#39f0ff', '#ffd23a', '#9a7aff'];
  for (let i = 0; i < 5; i++) {
    const ox = r.x + (i + 0.5) * (r.w / 5);
    if (ox < c.x - 300 || ox > c.x + c.w + 300) continue;
    const a = Math.sin(w.time * (0.8 + i * 0.13) + i) * 0.6;
    g.globalAlpha = 0.09 + (1 - beat) * 0.05;
    g.fillStyle = cols[i % 4];
    g.beginPath();
    g.moveTo(ox, r.y + 4);
    g.lineTo(ox + Math.sin(a - 0.12) * r.h * 1.2, r.y + Math.cos(a - 0.12) * r.h * 1.2);
    g.lineTo(ox + Math.sin(a + 0.12) * r.h * 1.2, r.y + Math.cos(a + 0.12) * r.h * 1.2);
    g.closePath();
    g.fill();
  }
  // flash da batida e o "drop" piscando forte
  const drop = w.rhythm.done && w.rhythm.club;
  const fl = Math.max(0, 1 - beat * 4) * (drop ? 0.16 : 0.06);
  if (fl > 0.005) {
    g.globalAlpha = fl;
    g.fillStyle = drop ? cols[Math.floor(w.time * 4) % 4] : '#ffffff';
    g.fillRect(Math.max(r.x, c.x), Math.max(r.y, c.y), Math.min(r.w, c.w), Math.min(r.h, c.h));
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.restore();
}

/** Lasers da boate: feixe forte aceso, linha fina avisando quando vai acender. */
export function drawBeams(g: CanvasRenderingContext2D, w: World) {
  const c = w.camera;
  const glow = glowSprite('#ff3fb4', 32);
  for (const b of w.data.beams) {
    if (b.x < c.x - 40 || b.x > c.x + c.w + 40) continue;
    const on = w.beamOn[b.id];
    // emissores no teto e no chão
    g.fillStyle = '#2a2a3a';
    g.fillRect(b.x - 9, b.y0 - 2, 18, 8);
    g.fillRect(b.x - 9, b.y1 - 6, 18, 8);
    g.fillStyle = on ? '#ff3fb4' : '#5a2a4a';
    g.fillRect(b.x - 4, b.y0 + 5, 8, 3);
    g.fillRect(b.x - 4, b.y1 - 8, 8, 3);
    g.globalCompositeOperation = 'lighter';
    if (on) {
      g.globalAlpha = 0.5;
      g.drawImage(glow.c, b.x - 22, b.y0, 44, b.y1 - b.y0);
      g.globalAlpha = 1;
      g.fillStyle = '#ffd0f0';
      g.fillRect(b.x - 2, b.y0 + 6, 4, b.y1 - b.y0 - 12);
      g.fillStyle = '#ff3fb4';
      g.globalAlpha = 0.8;
      g.fillRect(b.x - 4, b.y0 + 6, 8, b.y1 - b.y0 - 12);
    } else {
      // aviso: linha tracejada fraca
      g.globalAlpha = 0.25;
      g.fillStyle = '#ff3fb4';
      for (let y = b.y0 + 8; y < b.y1 - 8; y += 14) g.fillRect(b.x - 1, y, 2, 7);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
}

/** Caixa de som da boate (trampolim): gabinete com alto-falantes que pulsam. */
export function drawSpeaker(g: CanvasRenderingContext2D, d: { x: number; y: number; w: number }, hit: number, beat: number) {
  const hw = d.w / 2;
  const H = 62;
  const top = d.y + 2 + hit * 5;
  g.fillStyle = '#16141f';
  g.fillRect(d.x - hw, top, d.w, H - (top - d.y));
  g.strokeStyle = '#39f0ff';
  g.lineWidth = 1.6;
  g.strokeRect(d.x - hw + 1, top + 1, d.w - 2, H - (top - d.y) - 2);
  const pulse = 1 + (1 - beat) * 0.08 + hit * 0.15;
  for (const [cy, r] of [[top + 18, 11], [top + 44, 7]] as [number, number][]) {
    g.fillStyle = '#2a2838';
    g.beginPath();
    g.arc(d.x, cy, r * pulse, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ff3fb4';
    g.lineWidth = 1.2;
    g.stroke();
    g.fillStyle = '#0c0b12';
    g.beginPath();
    g.arc(d.x, cy, r * 0.4 * pulse, 0, Math.PI * 2);
    g.fill();
  }
}
