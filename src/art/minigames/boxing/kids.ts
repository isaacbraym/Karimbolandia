/**
 * A roda de crianças em volta do ringue: elipse com ordem de profundidade (as de trás menores) e as
 * mais próximas da câmera escuras e desfocadas (primeiro plano estilo Rayman, via uma imagem pequena
 * reaproveitada). Cada criança é a figura da aldeia (`drawResident`, papel "child"), com humor de
 * susto/risada vindo da torcida. Os gritos saem em balões.
 */
import { makeCanvas } from '../../kit';
import { drawResident, type ResidentPose } from '../../village';
import type { Crowd, Kid } from '../../../game/minigames/boxing/sim/crowd';
import { txt } from './fx';

const pose: ResidentPose = { x: 0, y: 0, id: 0, facing: 1, walk: 0, gesture: 0, role: 'child' };
export const FRONT_DEPTH = 0.8;

/** Posição na tela de uma criança (centro dos pés) e escala. */
export function kidSpot(k: Kid, W: number, H: number) {
  return { x: W * (0.5 + k.x * 0.49), y: H * (0.46 + k.depth * 0.2), s: (H / 360) * (0.62 + k.depth * 0.95) };
}

function drawKid(g: CanvasRenderingContext2D, k: Kid, W: number, H: number, t: number, scale = 1) {
  const sp = kidSpot(k, W, H);
  pose.id = k.look;
  pose.facing = k.x < 0 ? 1 : -1;
  pose.mood = k.mood === 'gasp' ? 'worry' : k.mood === 'laugh' || k.mood === 'jump' ? 'laugh' : undefined;
  const jump = k.mood === 'jump' ? Math.abs(Math.sin(t * 9 + k.phase)) * 12 * sp.s : 0;
  g.save();
  g.translate(sp.x * scale, (sp.y - jump) * scale);
  g.scale(sp.s * scale, sp.s * scale);
  drawResident(g, pose, t + k.phase, k.mood === 'cheer' && Math.sin(t * 2 + k.phase) > 0.2);
  g.restore();
}

/** Crianças do fundo e dos lados (desenhadas antes do jacaré). */
export function drawKidsBack(g: CanvasRenderingContext2D, crowd: Crowd, W: number, H: number, t: number) {
  for (const k of crowd.kids) if (k.depth < FRONT_DEPTH) drawKid(g, k, W, H, t);
}

let fg: HTMLCanvasElement | null = null;
/** As mais próximas da câmera: escuras e borradas (desenhadas pequenas e ampliadas). */
export function drawKidsFront(g: CanvasRenderingContext2D, crowd: Crowd, W: number, H: number, t: number) {
  const f = 3;
  const w = Math.max(8, Math.ceil(W / f)), h = Math.max(8, Math.ceil(H / f));
  if (!fg || fg.width !== w || fg.height !== h) fg = makeCanvas(w, h);
  const c = fg.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, w, h);
  c.setTransform(1 / f, 0, 0, 1 / f, 0, 0);
  let any = false;
  for (const k of crowd.kids) if (k.depth >= FRONT_DEPTH) { drawKid(c, k, W, H, t, 1.15); any = true; }
  if (!any) return;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = 'rgba(8,6,22,.55)';
  c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'source-over';
  g.globalAlpha = 0.92;
  g.drawImage(fg, 0, 0, W, H);
  g.globalAlpha = 1;
}

/** Balões de grito (cada um sobre a sua criança). */
export function drawShouts(g: CanvasRenderingContext2D, crowd: Crowd, W: number, H: number) {
  for (const sh of crowd.shouts) {
    const k = crowd.kids[sh.kid];
    if (!k) continue;
    const sp = kidSpot(k, W, H);
    const a = Math.min(1, sh.t * 6, (sh.dur - sh.t) * 5);
    const big = sh.text === sh.text.toUpperCase();
    txt(g, sh.text, sp.x, sp.y - 60 * sp.s - sh.t * 10, big ? 13 : 10, k.team === 'karimbo' ? '#ffe27a' : '#ff9a8a', 'center', Math.max(0, a), 1 + (1 - Math.min(1, sh.t * 5)) * 0.3);
  }
}
