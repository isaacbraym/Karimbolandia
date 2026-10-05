/**
 * O jacaré dançante de FRENTE para o boxe: o mesmo corpo e a mesma cabeça da roda (gatorParts), mas
 * com luvas azuis, guardas visíveis (alta, baixa, aberta, tonto, cobertura) e os ataques telegrafados:
 * patada (a luva volta e dispara para a câmera), rabada (o rabo varre), mordidona (a cabeça avança de
 * boca aberta) e cabeçada. Nada de chapéu. Sprites e luvas assados; por quadro só transformações.
 */
import { makeCanvas } from '../../kit';
import { gatorParts, GATOR_GREEN } from '../../dancingAlligator';
import type { AttackKind, Guard } from '../../../game/minigames/boxing/sim/rules';
import type { GMode } from '../../../game/minigames/boxing/sim/match';

const DARK = '#4a7038';
const OUT = '#170f2e';
const K = 2.5;
let glove: HTMLCanvasElement | null = null;
function gloveImg() {
  if (glove) return glove;
  const c = makeCanvas(52 * K, 48 * K), g = c.getContext('2d')!;
  g.scale(K, K);
  g.translate(26, 24);
  g.fillStyle = OUT; g.beginPath(); g.ellipse(0, 0, 23, 21, 0, 0, Math.PI * 2); g.fill();
  const gr = g.createRadialGradient(-6, -7, 3, 0, 0, 22);
  gr.addColorStop(0, '#7fb7ff'); gr.addColorStop(1, '#2a56c8');
  g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 20, 18, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(-7, -8, 7, 3.6, -0.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f3efe2'; g.fillRect(-20, 12, 40, 6);
  return (glove = c);
}

export interface GatorPose {
  mode: GMode;
  guard: Guard;
  attack: AttackKind | null;
  /** 0..1 durante a telegrafia (1 = impacto) */
  tele01: number;
  /** segundos desde o último impacto de ataque (grande = parado) */
  since: number;
  /** de qual lado vem o golpe (alterna a cada ataque) */
  hand: -1 | 1;
  phase: 1 | 2 | 3;
  flinch: number;
  time: number;
  /** boca aberta/tonta/etc. vêm do modo; `lastAttack` guarda a pose do pós-impacto */
  lastAttack: AttackKind | null;
}

function leg(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, c: string) {
  g.lineCap = 'round';
  g.strokeStyle = OUT; g.lineWidth = w + 3; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  g.strokeStyle = c; g.lineWidth = w; g.stroke();
}

function tail(g: CanvasRenderingContext2D, rot: number, sc: number) {
  g.save();
  g.translate(-12, -36);
  g.rotate(rot);
  g.scale(sc, sc);
  g.beginPath(); g.moveTo(0, -9); g.quadraticCurveTo(-40, -6, -84, 22); g.quadraticCurveTo(-40, 8, 0, 9); g.closePath();
  g.fillStyle = DARK; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.6; g.stroke();
  g.fillStyle = '#3c5e35';
  for (let i = 0; i < 6; i++) { const x = -8 - i * 12, y = -7 + i * 4.6; g.beginPath(); g.moveTo(x - 4, y + 1); g.lineTo(x, y - 5); g.lineTo(x + 3, y + 1); g.closePath(); g.fill(); }
  g.restore();
}

function drawGlove(g: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0) {
  const c = gloveImg();
  g.save();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  g.drawImage(c, -26 * s, -24 * s, 52 * s, 48 * s);
  g.restore();
}

const ease = (t: number) => t * t * (3 - 2 * t);

/** Pés em (x, y); `s` = escala (a altura do jacaré ≈ 170 × s). */
export function drawGatorFront(g: CanvasRenderingContext2D, x: number, y: number, s: number, p: GatorPose) {
  const a = gatorParts();
  const t = p.time;
  const tele = p.mode === 'tele';
  const k = tele ? ease(p.tele01) : 0;
  const hit = !tele && p.since < 0.3 ? 1 - p.since / 0.3 : 0; // pós-impacto: o golpe ainda em extensão
  const atk = tele ? p.attack : p.since < 0.3 ? p.lastAttack : null;
  const bob = Math.sin(t * 3.2) * 2 + (p.mode === 'taunt' ? Math.abs(Math.sin(t * 7)) * 5 : 0);
  const sway = p.mode === 'dizzy' || p.mode === 'groggy' ? Math.sin(t * 3.6) * 9 : p.mode === 'taunt' ? Math.sin(t * 3.5) * 8 : 0;
  g.save();
  g.translate(x + sway * s + p.flinch * 7 * s, y);
  g.scale(s, s);
  g.rotate(p.flinch * 0.04 + (p.mode === 'dizzy' || p.mode === 'groggy' ? Math.sin(t * 3.6) * 0.07 : 0));
  // sombra
  g.fillStyle = 'rgba(8,16,10,.35)'; g.beginPath(); g.ellipse(0, 2, 62, 9, 0, 0, Math.PI * 2); g.fill();
  const hipY = -42 + bob * 0.5;
  // rabo (atrás; na rabada varre da esquerda para a direita e vem por cima)
  const rabada = atk === 'rabada';
  tail(g, rabada ? 0 : 0.25 + Math.sin(t * 2.4) * 0.12 * (p.mode === 'taunt' ? 3 : 1), 1);
  // pernas e pés
  leg(g, -12, hipY, -26, -6, 15, DARK); leg(g, 12, hipY, 26, -6, 15, GATOR_GREEN);
  for (const sx of [-1, 1]) {
    g.save(); g.translate(sx * 27, -2); g.scale(sx, 1); g.drawImage(a.foot.c, -a.foot.ox, -a.foot.oy, a.foot.w, a.foot.h); g.restore();
  }
  // tronco (respira)
  const chest = 1 + Math.sin(t * 3.2) * 0.02;
  g.save();
  g.translate(0, hipY + 4);
  g.drawImage(a.torso.c, -a.torso.ox * chest, -a.torso.oy, a.torso.w * chest, a.torso.h);
  // braços e luvas conforme a guarda
  const sh = -64;
  const gl = (side: -1 | 1): [number, number, number] => {
    let gx = side * 30, gy = -88, gs = 0.95;
    if (p.guard === 'alta') { gx = side * 24; gy = -112; gs = 0.95; }
    else if (p.guard === 'baixa') { gx = side * 32; gy = -42; gs = 0.95; }
    else if (p.guard === 'aberta') { gx = side * 62; gy = -76 + Math.sin(t * 4 + side) * 3; gs = 0.9; }
    else if (p.guard === 'tonto') { gx = side * 40; gy = -26 + Math.sin(t * 3.6 + side) * 4; gs = 0.85; }
    else if (p.guard === 'cobertura') { gx = side * 12; gy = -96; gs = 1.1; }
    else if (p.guard === 'ataque') { gx = side * 58; gy = -86; gs = 0.95; }
    if ((atk === 'patada' || atk === 'contrape') && side === p.hand) {
      if (tele) { gx = side * (58 + k * 14); gy = -96 - k * 52; gs = 0.95 + k * 0.1; }
      else { const e = Math.sin(Math.min(1, hit) * Math.PI * 0.5); gx = side * (30 - 30 * e); gy = -90 + 92 * e; gs = 1.1 + 1.7 * e; }
    }
    return [gx, gy, gs];
  };
  for (const side of [-1, 1] as const) {
    const [gx, gy, gs] = gl(side);
    g.lineCap = 'round';
    g.strokeStyle = OUT; g.lineWidth = 17; g.beginPath(); g.moveTo(side * 22, sh); g.quadraticCurveTo(side * 44, (sh + gy) / 2, gx, gy); g.stroke();
    g.strokeStyle = side < 0 ? DARK : GATOR_GREEN; g.lineWidth = 12; g.stroke();
  }
  // cabeça (cada ataque a move de um jeito)
  let hx = 2, hy = -70, hs = 1, hr = 0;
  if (p.mode === 'taunt') { hr = Math.sin(t * 3.5) * 0.14; hx += Math.sin(t * 3.5) * 4; }
  if (p.mode === 'dizzy' || p.mode === 'groggy') hr = Math.sin(t * 3.6) * 0.18;
  if (atk === 'mordidona') {
    if (tele) { hy = -70 - k * 14; hs = 1 - k * 0.1; } else { const e = Math.sin(Math.min(1, hit) * Math.PI * 0.5); hy = -70 + 36 * e; hs = 0.9 + 0.75 * e; }
  } else if (atk === 'cabecada') {
    if (tele) { hy = -70 + k * 10; hs = 1 - k * 0.05; hr = -k * 0.3; } else { const e = Math.sin(Math.min(1, hit) * Math.PI * 0.5); hy = -70 + 44 * e; hs = 0.95 + 0.55 * e; hr = 0.35 * e; }
  }
  g.save();
  g.translate(hx, hy);
  g.rotate(hr + p.flinch * 0.1);
  g.scale(hs, hs);
  g.drawImage(a.head.c, -a.head.ox, -a.head.oy, a.head.w, a.head.h);
  // boca da mordidona: abre na telegrafia (dentes) e escancara na mordida
  if (atk === 'mordidona') {
    const open = tele ? k : 1;
    g.fillStyle = '#7a1d2a'; g.strokeStyle = OUT; g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(20, 2, 10 + open * 8, 3 + open * 14, -0.25, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#fbf6e4';
    for (let i = 0; i < 6; i++) { const an = (i / 6) * Math.PI * 2; g.beginPath(); g.moveTo(20 + Math.cos(an) * (9 + open * 7), 2 + Math.sin(an) * (3 + open * 13)); g.lineTo(20 + Math.cos(an) * (6 + open * 5), 2 + Math.sin(an) * (1 + open * 9)); g.lineTo(20 + Math.cos(an + 0.35) * (9 + open * 7), 2 + Math.sin(an + 0.35) * (3 + open * 13)); g.closePath(); g.fill(); }
  }
  // olhos brilhando de vermelho: telegrafia e fúria
  if (tele || p.phase === 3) {
    g.fillStyle = `rgba(255,${tele ? 70 : 120},60,${tele ? 0.35 + k * 0.5 : 0.35})`;
    g.beginPath(); g.arc(-7, -28, 7, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  // luvas por cima de tudo
  for (const side of [-1, 1] as const) { const [gx, gy, gs] = gl(side); drawGlove(g, gx, gy, gs); }
  g.restore();
  // rabada: o rabo varre por cima, da esquerda para a direita
  if (rabada) {
    const sweep = tele ? -0.9 + k * 0.2 : -0.7 + Math.min(1, hit) * 0 + (1 - hit) * 1.6;
    if (tele || hit > 0) { g.globalAlpha = 0.95; tail(g, sweep, 1.7); g.globalAlpha = 1; }
  }
  g.restore();
}
