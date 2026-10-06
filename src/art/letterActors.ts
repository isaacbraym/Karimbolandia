/**
 * Atores da cena da carta (fase 2): o pombo-correio (cinza, bolsinha vermelha a tiracolo, 3 quadros de
 * asa), o envelope/carta e os coraçõezinhos; o macaco é o mesmo macaco-prego da fauna (`drawMonkey`).
 * Tudo assado na tela de carregamento da selva; a Júlia NÃO é desenhada, só o envelope com coração.
 */
import { bake, drawSpr, OUT, type Sprite } from './kit';
import { drawMonkey } from './wildlife';
import type { World } from '../game/world';
import type { LetterScene } from '../game/letterScene';
import { LETTER_T } from '../game/letterScene';

const TAU = Math.PI * 2;
let parts: { body: Sprite; head: Sprite; wings: Sprite[]; tail: Sprite; folded: Sprite; open: Sprite; heart: Sprite } | null = null;

function oval(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, c: string, rot = 0) {
  g.fillStyle = c; g.strokeStyle = OUT; g.lineWidth = 1.1;
  g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill(); g.stroke();
}

function heartPath(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.beginPath();
  g.moveTo(x, y + s * 0.9);
  g.bezierCurveTo(x - s * 1.5, y - s * 0.2, x - s * 0.7, y - s * 1.3, x, y - s * 0.45);
  g.bezierCurveTo(x + s * 0.7, y - s * 1.3, x + s * 1.5, y - s * 0.2, x, y + s * 0.9);
  g.closePath();
}

/** Assa o pombo, a carta e o coração (uma vez, na tela de carregamento da selva). */
export function prepareLetterActors() {
  if (parts) return parts;
  const body = bake(34, 28, (g) => {
    g.translate(17, 14);
    oval(g, 0, 0, 12, 8.5, '#9aa3ae');
    oval(g, 3, 2, 8, 5.5, '#c5ccd4');
    // bolsinha vermelha a tiracolo
    g.strokeStyle = '#7a1b24'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-6, -7); g.quadraticCurveTo(2, 4, 8, 6); g.stroke();
    g.fillStyle = '#d93a45'; g.strokeStyle = OUT; g.lineWidth = 1;
    g.beginPath(); g.roundRect(-3, 2, 10, 8, 2); g.fill(); g.stroke();
    g.fillStyle = '#f3efe2'; g.fillRect(-1, 3.4, 6, 1.4);
  }, { scale: 3, ox: 17, oy: 14 });
  const head = bake(18, 18, (g) => {
    g.translate(9, 9);
    oval(g, 0, 0, 6.4, 6, '#8d97a3');
    oval(g, -1, 2, 4.5, 3, '#6fa3b8');
    g.fillStyle = '#f0b64a'; g.strokeStyle = OUT; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(5, -1); g.lineTo(11, 0.8); g.lineTo(5, 2.4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffd77a'; g.beginPath(); g.arc(2, -1.6, 1.7, 0, TAU); g.fill();
    g.fillStyle = '#10141a'; g.beginPath(); g.arc(2.4, -1.6, 0.8, 0, TAU); g.fill();
  }, { scale: 3, ox: 9, oy: 9 });
  const wings: Sprite[] = [-1, 0, 1].map((f) => bake(34, 26, (g) => {
    g.translate(8, 13);
    g.rotate(f * 0.9);
    g.fillStyle = '#7e8996'; g.strokeStyle = OUT; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -14, 24, -6); g.quadraticCurveTo(14, -2, 0, 5); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(4, -2); g.quadraticCurveTo(12, -8, 20, -5); g.stroke();
  }, { scale: 3, ox: 8, oy: 13 }));
  const tail = bake(16, 12, (g) => {
    g.fillStyle = '#6c7783'; g.strokeStyle = OUT; g.lineWidth = 1;
    g.beginPath(); g.moveTo(14, 6); g.lineTo(0, 1); g.lineTo(1, 6); g.lineTo(0, 11); g.closePath(); g.fill(); g.stroke();
  }, { scale: 3, ox: 14, oy: 6 });
  const folded = bake(22, 16, (g) => {
    g.fillStyle = '#f6efd6'; g.strokeStyle = OUT; g.lineWidth = 1.1;
    g.beginPath(); g.roundRect(1, 1, 20, 14, 1.5); g.fill(); g.stroke();
    g.strokeStyle = '#c9b985'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(1.5, 1.5); g.lineTo(11, 9); g.lineTo(20.5, 1.5); g.stroke();
    g.fillStyle = '#d93a45'; heartPath(g, 11, 9, 2.6); g.fill();
  }, { scale: 3, ox: 11, oy: 8 });
  const open = bake(26, 32, (g) => {
    g.fillStyle = '#fff7de'; g.strokeStyle = OUT; g.lineWidth = 1.1;
    g.beginPath(); g.roundRect(1, 1, 24, 30, 1.5); g.fill(); g.stroke();
    g.strokeStyle = '#8a7a58'; g.lineWidth = 0.9;
    for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(5, 7 + i * 3.4); g.lineTo(20 - (i % 3) * 3, 7 + i * 3.4); g.stroke(); }
    g.fillStyle = '#d93a45'; heartPath(g, 19, 25, 2.2); g.fill();
  }, { scale: 3, ox: 13, oy: 16 });
  const heart = bake(14, 14, (g) => {
    g.fillStyle = '#ff5a7a'; g.strokeStyle = OUT; g.lineWidth = 0.9;
    heartPath(g, 7, 7, 4.6); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(4.6, 4.8, 1, 0, TAU); g.fill();
  }, { scale: 3, ox: 7, oy: 7 });
  return (parts = { body, head, wings, tail, folded, open, heart });
}

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function balloon(g: CanvasRenderingContext2D, x: number, y: number, text: string, fill: string, alpha: number) {
  g.save();
  g.globalAlpha = alpha;
  g.font = 'bold 11px sans-serif';
  g.textAlign = 'center';
  const w = g.measureText(text).width + 18;
  g.fillStyle = fill; g.strokeStyle = '#4a3e37'; g.lineWidth = 1.2;
  g.beginPath(); g.roundRect(x - w / 2, y - 16, w, 24, 6); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(x - 4, y + 8); g.lineTo(x, y + 14); g.lineTo(x + 4, y + 8); g.fill();
  g.fillStyle = '#41322d';
  g.fillText(text, x, y);
  g.restore();
}

/** Desenha a cena (atores no mundo; `balloons` = o passe da frente, com os balões). */
export function drawLetterScene(g: CanvasRenderingContext2D, w: World, sc: LetterScene, balloons = false) {
  if (!sc.active && sc.t < 0) return;
  const a = parts;
  if (!a || !sc.active) return;
  const t = sc.t, T = LETTER_T, p = w.player;
  const x0 = sc.theftX, y0 = sc.theftY;
  if (balloons) {
    for (const s of sc.shouts) {
      if (t < s.from || t > s.to) continue;
      const al = Math.min(1, (t - s.from) * 6, (s.to - t) * 4);
      if (s.who === 'karimbo') balloon(g, p.x, p.y - 96, s.text, '#e8f4ff', al);
      else balloon(g, x0 + 175, y0 - 160, s.text, '#fff1cd', al);
    }
    return;
  }
  // ---- macaco (cipó e galho)
  if (sc.monkey !== 'hidden') {
    let mx = x0 + 110, my = y0 - 110, alpha = 1, scale = 1, stride = 0, arms: 'rest' | 'up' | 'hold' = 'hold';
    if (sc.monkey === 'vine') {
      const u = ease(clamp01((t - T.vine) / (T.leap - T.vine)));
      my = y0 - 330 + 205 * u;
      arms = 'up';
      // cipó do alto até as mãos
      if (t < T.leap) {
        g.strokeStyle = '#2f6a2e'; g.lineWidth = 3; g.beginPath(); g.moveTo(mx + 6, y0 - 480); g.lineTo(mx + 6 + Math.sin(t * 3) * 3, my - 26); g.stroke();
      } else {
        const jump = clamp01((t - T.leap) / (T.head - T.leap));
        mx = x0 + 110 * (1 - jump); my = y0 - 125 + 51 * jump - Math.sin(jump * Math.PI) * 72;
      }
    } else if (sc.monkey === 'head') {
      mx = p.x; my = p.feetY - 74;
      arms = t < T.grab ? 'rest' : 'hold';
      if (t >= T.grab) {
        const jump = clamp01((t - T.grab) / (T.dance - T.grab));
        mx += 175 * jump; my -= 38 * jump + Math.sin(jump * Math.PI) * 70;
      }
    } else if (sc.monkey === 'branch') {
      mx = x0 + 175; my = y0 - 112 - Math.abs(Math.sin(t * 7)) * 8; arms = 'up';
      g.strokeStyle = OUT; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0 + 120, y0 - 106); g.lineTo(x0 + 240, y0 - 112); g.stroke();
      g.strokeStyle = '#67452c'; g.lineWidth = 6; g.stroke();
    } else {
      const u = clamp01((t - T.flee) / 1.0);
      mx = x0 + 175 + u * 330; my = y0 - 112 - Math.sin(u * Math.PI) * 70 + u * 20;
      scale = 1 - 0.55 * u; alpha = 1 - 0.65 * u; stride = Math.sin(t * 14); arms = 'hold';
    }
    drawMonkey(g, mx, my, scale, t, { facing: sc.monkey === 'flee' ? 1 : -1, stride, arms, headRot: Math.sin(t * 8) * 0.15, alpha });
    if (sc.monkey === 'head' && t < T.grab) {
      const reach = clamp01((t-T.head-.15)/(T.grab-T.head-.15));
      const handX=mx+8+7*reach,handY=my-8+32*reach;
      g.lineCap='round';g.strokeStyle=OUT;g.lineWidth=7;
      g.beginPath();g.moveTo(mx+9,my-32);g.quadraticCurveTo(mx+26,my-12,handX,handY);g.stroke();
      g.strokeStyle='#a87645';g.lineWidth=4;g.stroke();oval(g,handX,handY,4,3,'#e5ac69');
    }
    // a carta na mão do macaco
    if (sc.letter === 'stolen') drawSpr(g, a.folded, mx - 18 * scale + (arms === 'up' ? 24 * scale : 0), my - 30 * scale - (arms === 'up' ? 24 * scale : 0), { sx: 0.8 * scale, sy: 0.8 * scale, rot: Math.sin(t * 9) * 0.25, alpha });
  }
  // ---- pombo
  if (sc.pigeon !== 'hidden') {
    let px = p.x, py = p.feetY - 92, facing: 1 | -1 = -1, flap = Math.floor(t * 14) % 3 - 1, sit = false;
    if (sc.pigeon === 'fly') {
      const u = ease(clamp01((t - T.whistle) / (T.land - T.whistle)));
      px = x0 + 520 * (1 - u); py = y0 - 300 + 208 * u - Math.sin(u * Math.PI) * 60;
    } else if (sc.pigeon === 'perch') { sit = true; flap = 0; py += Math.sin(t * 20) * (t > T.peck && t < T.peck + 0.3 ? 2.5 : 0.4); }
    else {
      const u = clamp01((t - T.give) / 1.5);
      px = p.x + u * 360; py = p.feetY - 92 - u * 220; facing = 1;
    }
    g.save();
    g.translate(px, py);
    g.scale(-facing, 1);
    drawSpr(g, a.tail, -10, 2, {});
    drawSpr(g, a.body, 0, 0, {});
    drawSpr(g, a.head, 10, -7 + (sit && t > T.peck && t < T.peck + 0.3 ? 4 : 0), {});
    if (!sit) drawSpr(g, a.wings[flap + 1], -3, -3, { flip: false });
    else drawSpr(g, a.wings[1], -3, -1, { rot: -0.5 });
    g.restore();
  }
  // ---- carta nas mãos do Karimbo e coraçõezinhos
  if (sc.letter === 'folded' || sc.letter === 'open') {
    const spr = sc.letter === 'folded' ? a.folded : a.open;
    drawSpr(g, spr, p.x + 15, p.feetY - 44 - (sc.letter === 'open' ? 6 : 0), { sx: sc.letter === 'open' ? 1.15 : 1, sy: sc.letter === 'open' ? 1.15 : 1, rot: Math.sin(t * 4) * 0.04 });
  }
  if (t >= T.banner && t < T.vine + 1) {
    for (let i = 0; i < 5; i++) {
      const k = ((t - T.banner) * 0.9 + i / 5) % 1;
      drawSpr(g, a.heart, p.x + 14 + Math.sin(i * 2.3 + t * 3) * 10, p.feetY - 64 - k * 44, { alpha: 1 - k, sx: 0.8, sy: 0.8 });
    }
  }
}
