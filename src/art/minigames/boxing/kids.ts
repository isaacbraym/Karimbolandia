/**
 * A torcida de crianças do ringue. Cada criança é a figura da aldeia (`drawResident`, papel "child"),
 * ASSADA em poucos quadros (palmas, pulo/riso, susto) no tamanho em que aparece na tela: animar custa UM
 * `drawImage` por criança (antes eram ~8 e uma camada intermediária por quadro, que causava os engasgos
 * de 100–190 ms registrados no estudo dos minijogos). As posições vêm de `layout.ts` (torcida em U, nunca
 * entre os lutadores); as de longe ficam mais escuras para o jacaré saltar aos olhos.
 */
import { makeCanvas } from '../../kit';
import { drawResident, type ResidentPose } from '../../village';
import type { BoxLayout, Spot } from './layout';
import type { Crowd, Kid, Mood } from '../../../game/minigames/boxing/sim/crowd';
import { txt } from './fx';

/** unidades lógicas do quadro assado de uma criança (pés em UX, UY) */
const UW = 64, UH = 92, UX = 32, UY = 80;
/** escala base de cada classe de tamanho (longe, meio, perto) */
const CLASS_SCALE = [0.5, 0.75, 1.1] as const;
const DIM = [0.42, 0.24, 0.1] as const;
const SIGN_TEXT = { karimbo: ['KARIMBO', '#ffe27a', '#7a3f1e'], gator: ['JACARÉ', '#9fe07a', '#2c4a1e'] } as const;

interface Frames { cheer: HTMLCanvasElement[]; gasp: HTMLCanvasElement[]; laugh: HTMLCanvasElement[]; w: number; h: number }
let baked: { key: string; frames: Frames[]; bell: HTMLCanvasElement; order: number[] } | null = null;

const pose: ResidentPose = { x: UX, y: UY, id: 0, facing: 1, walk: 0, gesture: 0, role: 'child' };

function bakeFrame(look: number, size: 0 | 1 | 2, facing: 1 | -1, mood: 'cheer' | 'worry' | 'laugh', t: number, kid: Kid, scale: number, judge: boolean): HTMLCanvasElement {
  const cs = CLASS_SCALE[size] * scale;
  const c = makeCanvas(Math.ceil(UW * cs), Math.ceil(UH * cs));
  const g = c.getContext('2d')!;
  g.scale(cs, cs);
  pose.id = look; pose.facing = facing; pose.mood = mood === 'cheer' ? undefined : mood;
  drawResident(g, pose, t, mood === 'cheer' && Math.sin(t * 2 + kid.phase) > 0.2);
  if (kid.sign && kid.team !== 'judge') {
    const [label, fill, ink] = SIGN_TEXT[kid.team];
    // cartaz de papelão na ponta de um graveto, acima da cabeça
    g.strokeStyle = '#170f2e'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(UX + facing * 4, UY - 22); g.lineTo(UX + facing * 4, UY - 52); g.stroke();
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 1.8; g.stroke();
    g.fillStyle = '#170f2e'; g.fillRect(UX - 27, UY - 72, 54, 22);
    g.fillStyle = fill; g.fillRect(UX - 25.5, UY - 70.5, 51, 19);
    g.fillStyle = ink; g.font = '700 10px "Lilita One",Impact,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, UX, UY - 60.5);
  }
  if (judge) {
    // chapéu de juiz de papelão
    g.fillStyle = '#170f2e'; g.beginPath(); g.moveTo(UX - 16, UY - 41); g.lineTo(UX, UY - 60); g.lineTo(UX + 16, UY - 41); g.closePath(); g.fill();
    g.fillStyle = '#e8c868'; g.beginPath(); g.moveTo(UX - 13.5, UY - 42.5); g.lineTo(UX, UY - 57); g.lineTo(UX + 13.5, UY - 42.5); g.closePath(); g.fill();
    g.fillStyle = '#d9503a'; g.fillRect(UX - 13.5, UY - 45, 27, 3);
  }
  // escurece as de longe (profundidade e foco no jacaré)
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = `rgba(14,8,34,${DIM[size]})`;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

function bellImg(scale: number) {
  const c = makeCanvas(Math.ceil(26 * scale), Math.ceil(30 * scale));
  const g = c.getContext('2d')!;
  g.scale(scale, scale);
  g.translate(13, 4);
  g.fillStyle = '#170f2e'; g.beginPath(); g.moveTo(-9, 20); g.quadraticCurveTo(-9, 4, 0, 2); g.quadraticCurveTo(9, 4, 9, 20); g.closePath(); g.fill();
  g.fillStyle = '#e8c868'; g.beginPath(); g.moveTo(-7.5, 18.5); g.quadraticCurveTo(-7.5, 5.5, 0, 3.8); g.quadraticCurveTo(7.5, 5.5, 7.5, 18.5); g.closePath(); g.fill();
  g.fillStyle = '#fff3b0'; g.fillRect(-4.5, 8, 2.4, 8);
  g.fillStyle = '#170f2e'; g.beginPath(); g.arc(0, 22, 2.6, 0, Math.PI * 2); g.fill();
  return c;
}

/** Assa a torcida inteira no tamanho da tela (uma vez, na primeira vez que se desenha, ou quando a tela muda). */
export function bakeKids(L: BoxLayout, crowd: Crowd, k: number) {
  const key = `${L.W}x${L.H}x${k.toFixed(1)}`;
  if (baked && baked.key === key) return baked;
  const frames: Frames[] = L.spots.map((sp, i) => {
    const kid = crowd.kids[i];
    const facing: 1 | -1 = sp.side < 0 ? 1 : -1;
    const judge = sp.band === 'judge';
    // o quadro assado representa a classe de tamanho × (unidade da tela × densidade de pixels)
    const mk = (m: 'cheer' | 'worry' | 'laugh', ts: number[]) => ts.map((t) => bakeFrame(kid.look, sp.size, facing, m, t, kid, L.u * k, judge));
    const cheer = mk('cheer', [0, 0.1, 0.2, 0.3]);
    return { cheer, gasp: mk('worry', [0, 0.1]), laugh: mk('laugh', [0, 0.07]), w: cheer[0].width, h: cheer[0].height };
  });
  const order = L.spots.map((_, i) => i).sort((a, b) => L.spots[a].y - L.spots[b].y);
  baked = { key, frames, bell: bellImg(2.4 * k), order };
  return baked;
}

/** Posição e tamanho de desenho (em unidades lógicas) do quadro de uma criança: pés em (sp.x, sp.y). */
const place = (sp: Spot) => ({ x: sp.x - UX * sp.s, y: sp.y - UY * sp.s, w: UW * sp.s, h: UH * sp.s });

const frameOf = (mood: Mood, kid: Kid, f: Frames, t: number): HTMLCanvasElement => {
  switch (mood) {
    case 'gasp': return f.gasp[Math.floor(t * 6 + kid.phase * 3) % 2];
    case 'laugh': return f.laugh[Math.floor(t * 10 + kid.phase * 3) % 2];
    case 'jump': return f.cheer[Math.floor(t * 8 + kid.phase * 3) % 4];
    default: return f.cheer[Math.floor((t * 3.33 + kid.phase) % 4)];
  }
};

/** Desenha a torcida inteira (de longe para perto): UM drawImage por criança. */
export function drawKids(g: CanvasRenderingContext2D, L: BoxLayout, crowd: Crowd, t: number, k: number) {
  const b = bakeKids(L, crowd, k);
  for (const i of b.order) {
    const sp = L.spots[i], kid = crowd.kids[i], f = b.frames[i];
    const p = place(sp);
    const jump = kid.mood === 'jump' ? Math.abs(Math.sin(t * 9 + kid.phase)) * 15 * sp.s : kid.mood === 'laugh' ? Math.abs(Math.sin(t * 10 + kid.phase)) * 4 * sp.s : 0;
    g.drawImage(frameOf(kid.mood, kid, f, t), p.x, p.y - jump, p.w, p.h);
    if (sp.band === 'judge' && crowd.bell > 0) {
      // o juiz balança o sino
      const sw = Math.sin(t * 38) * 0.7 * crowd.bell;
      g.save();
      g.translate(sp.x + 22 * sp.s, sp.y - 40 * sp.s);
      g.rotate(sw);
      g.drawImage(b.bell, -13 * sp.s * 0.9, -4 * sp.s * 0.9, 26 * sp.s * 0.9, 30 * sp.s * 0.9);
      g.restore();
    }
  }
}

/** Balões de grito: sempre fora da área da luta. */
export function drawShouts(g: CanvasRenderingContext2D, L: BoxLayout, crowd: Crowd) {
  for (const sh of crowd.shouts) {
    const sp = L.spots[sh.kid], kid = crowd.kids[sh.kid];
    if (!sp || !kid) continue;
    const a = Math.min(1, sh.t * 6, (sh.dur - sh.t) * 5);
    const size = 11 * L.u;
    const half = sh.text.length * size * 0.31 + 4 * L.u;
    const x = sp.side < 0 ? Math.min(Math.max(sp.x, half + 2), L.protect.x - half) : Math.max(Math.min(sp.x, L.W - half - 2), L.protect.x + L.protect.w + half);
    txt(g, sh.text, x, sp.y - (UY + 18) * sp.s - sh.t * 8 * L.u, size, kid.team === 'karimbo' ? '#ffe27a' : '#ff9a8a', 'center', Math.max(0, a), 1 + (1 - Math.min(1, sh.t * 5)) * 0.3);
  }
}
