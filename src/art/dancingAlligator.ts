import { bake, drawSpr, OUT, poly, shadedEllipse, type Sprite } from './kit';
import { CLAP_STEP } from '../core/clapRhythm';

/**
 * Jacaré da roda da aldeia. Dança de roda africana: base baixa com joelhos dobrados, PISADAS fortes
 * alternadas (poeira no chão), deslocamento de um lado para o outro a cada compasso, tronco girando
 * no ritmo e um giro completo do corpo a cada quatro compassos. Cabeça e tronco são assados uma vez;
 * pernas, braços e cauda são traços contínuos (sem juntas soltas).
 */
const SCALE = 0.56;
const GREEN = '#5f8a45';
const GREEN_D = '#4a7038';
const BELLY = '#e2d8a4';

let art: { torso: Sprite; head: Sprite; foot: Sprite } | null = null;
function parts() {
  if (art) return art;
  const torso = bake(64, 80, (g) => {
    // corpo em gota, costas com escamas, barriga creme com faixas
    g.beginPath();
    g.moveTo(32, 3);
    g.bezierCurveTo(54, 4, 60, 34, 56, 56);
    g.bezierCurveTo(53, 72, 42, 78, 32, 78);
    g.bezierCurveTo(20, 78, 9, 72, 7, 56);
    g.bezierCurveTo(4, 34, 10, 4, 32, 3);
    g.closePath();
    const gr = g.createRadialGradient(40, 26, 4, 32, 42, 44);
    gr.addColorStop(0, '#86ad5e');
    gr.addColorStop(0.6, GREEN);
    gr.addColorStop(1, '#3f6130');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = OUT;
    g.lineWidth = 1.8;
    g.stroke();
    g.beginPath();
    g.ellipse(34, 46, 17, 28, 0, 0, Math.PI * 2);
    const bg = g.createLinearGradient(20, 20, 48, 74);
    bg.addColorStop(0, '#f3ebbc');
    bg.addColorStop(1, '#c9bd84');
    g.fillStyle = bg;
    g.fill();
    g.strokeStyle = '#8f8a58';
    g.lineWidth = 1.1;
    g.stroke();
    g.strokeStyle = '#a69f68';
    g.lineWidth = 0.9;
    for (let y = 26; y < 72; y += 6.5) {
      const w = 15 * Math.sqrt(Math.max(0, 1 - ((y - 46) / 28) ** 2));
      g.beginPath();
      g.moveTo(34 - w, y);
      g.quadraticCurveTo(34, y + 3, 34 + w, y);
      g.stroke();
    }
    // escamas das costas
    for (const [x, y] of [[10, 22], [8, 34], [8, 47], [10, 60], [54, 24], [56, 37], [55, 50]]) {
      poly(g, [[x - 3.4, y + 1], [x, y - 5], [x + 3.4, y + 1]], '#3c6039', { lw: 0.8 });
    }
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.ellipse(44, 18, 6, 3, -0.5, 0, Math.PI * 2);
    g.fill();
    // colar de sementes da festa
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.15 + i * 0.0875);
      g.fillStyle = i % 2 ? '#d9503a' : '#f0c84a';
      g.beginPath();
      g.arc(32 + Math.cos(a) * 17, 10 + Math.sin(a) * 9, 2.1, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 0.6;
      g.stroke();
    }
  }, { scale: 3, ox: 32, oy: 76 });
  const head = bake(56, 66, (g) => {
    // focinho longo apontando para o alto (sorriso cheio de dentes), olho grande e simpático
    g.beginPath();
    g.moveTo(14, 60);
    g.quadraticCurveTo(3, 50, 9, 36);
    g.quadraticCurveTo(14, 26, 22, 28);
    g.lineTo(37, 6);
    g.quadraticCurveTo(42, 0, 48, 5);
    g.quadraticCurveTo(53, 10, 46, 17);
    g.lineTo(32, 39);
    g.quadraticCurveTo(38, 49, 33, 60);
    g.closePath();
    const gr = g.createLinearGradient(8, 20, 46, 50);
    gr.addColorStop(0, '#8db464');
    gr.addColorStop(1, '#4e7a3a');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = OUT;
    g.lineWidth = 1.6;
    g.stroke();
    poly(g, [[18, 49], [31, 36], [43, 18], [40, 37], [33, 54], [23, 59]], BELLY, { lw: 0.9 });
    poly(g, [[22, 45], [35, 21], [44, 17], [31, 41]], '#2e4530', { lw: 0.6 });
    for (let i = 0; i < 5; i++) {
      const x = 27 + i * 3.2;
      const y = 37 - i * 5.2;
      poly(g, [[x - 2, y], [x + 2.2, y - 1], [x + 1, y + 4]], '#fffbe6', { lw: 0.45 });
    }
    // olho com sobrancelha (crista) e brilho
    shadedEllipse(g, 15, 33, 7.4, 8.4, '#7aa358', { lw: 1.1 });
    g.fillStyle = '#fff6cf';
    g.beginPath();
    g.ellipse(16.4, 32.6, 4.4, 5.4, -0.15, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = OUT;
    g.lineWidth = 0.8;
    g.stroke();
    g.fillStyle = '#e0a53a';
    g.beginPath();
    g.ellipse(17.6, 33, 2.6, 3.6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1b1f18';
    g.fillRect(17.1, 30.2, 1.2, 5.6);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(18.8, 31, 1.1, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#3a5530';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(9.5, 26.5);
    g.quadraticCurveTo(15, 23.5, 21, 27);
    g.stroke();
    // narinas e bochecha
    g.fillStyle = '#2e4530';
    g.beginPath();
    g.ellipse(43, 8.6, 1.5, 2.2, 0.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,120,120,0.3)';
    g.beginPath();
    g.ellipse(14, 45, 3.4, 2, 0, 0, Math.PI * 2);
    g.fill();
    for (const [x, y] of [[11, 50], [15, 54], [26, 24], [31, 16]]) {
      g.fillStyle = '#466b3a';
      g.fillRect(x, y, 3, 2);
    }
  }, { scale: 3, ox: 24, oy: 61 });
  const foot = bake(38, 18, (g) => {
    shadedEllipse(g, 18, 10, 16, 6.4, '#5d8644', { lw: 1.1 });
    for (let x = 23; x < 36; x += 4) poly(g, [[x, 7.5], [x + 3.4, 11], [x, 13.4]], '#eadcac', { lw: 0.6 });
  }, { scale: 3, ox: 10, oy: 14 });
  return (art = { torso, head, foot });
}

const J = { x: 0, y: 0 };
function knee(ax: number, ay: number, bx: number, by: number, l: number, out: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.min(Math.hypot(dx, dy), l * 2 - 0.1);
  const h = Math.sqrt(Math.max(0, l * l - (d * d) / 4));
  const len = Math.hypot(dx, dy) || 1;
  J.x = (ax + bx) / 2 + (-dy / len) * h * out;
  J.y = (ay + by) / 2 + (dx / len) * h * out;
}
function limb(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, l: number, out: number, w: number, c: string) {
  knee(ax, ay, bx, by, l, out);
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(J.x, J.y);
  g.lineTo(bx, by);
  g.strokeStyle = OUT;
  g.lineWidth = w + 3;
  g.stroke();
  g.strokeStyle = c;
  g.lineWidth = w;
  g.stroke();
  // brilho no alto do membro
  g.strokeStyle = 'rgba(190,230,140,0.35)';
  g.lineWidth = w * 0.25;
  g.beginPath();
  g.moveTo(ax, ay - w * 0.2);
  g.lineTo(J.x, J.y - w * 0.2);
  g.stroke();
}

const smooth = (p: number) => p * p * (3 - 2 * p);

/** Pés em (x, y). Compasso = 4 tempos das palmas da aldeia (mesmo relógio do som). */
export function drawDancingAlligator(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const a = parts();
  const bar = CLAP_STEP * 4;
  const barI = Math.floor(t / bar);
  const p = (t - barI * bar) / bar;
  // pisadas: pé esquerdo sobe e bate na metade do compasso; o direito bate no início
  const liftL = p > 0.22 && p < 0.5 ? Math.sin(((p - 0.22) / 0.28) * Math.PI) : 0;
  const liftR = p > 0.72 ? Math.sin(((p - 0.72) / 0.28) * Math.PI) : 0;
  const sinceL = p >= 0.5 ? (p - 0.5) * bar : 9;
  const sinceR = p < 0.5 ? p * bar : 9;
  const impact = Math.max(0, 1 - Math.min(sinceL, sinceR) / 0.16);
  // de um lado para o outro a cada compasso
  const travel = 26 * Math.cos(Math.PI * (barI + smooth(p)));
  // giro completo do corpo no último compasso de cada quatro
  const spin = barI % 4 === 3 ? Math.cos(Math.PI * 2 * smooth(p)) : 1;
  const sx = Math.sign(spin || 1) * (0.42 + 0.58 * Math.abs(spin));
  const twist = Math.sin(p * Math.PI * 4);
  const bob = Math.abs(Math.sin(p * Math.PI * 2)) * 3 + impact * 5;
  g.save();
  g.translate(x + travel * SCALE, y);
  g.scale(SCALE, SCALE);
  // sombra e poeira das pisadas
  g.fillStyle = 'rgba(19,40,23,0.24)';
  g.beginPath();
  g.ellipse(4, 3, 54, 7, 0, 0, Math.PI * 2);
  g.fill();
  for (const [since, fx] of [[sinceL, -26], [sinceR, 28]] as [number, number][]) {
    if (since > 0.35) continue;
    const k = since / 0.35;
    g.fillStyle = '#bea56e';
    g.globalAlpha = 0.55 * (1 - k);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(fx * sx + s * (10 + k * 22), -4 - k * 8, 7 + k * 8, 4 + k * 4, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  g.scale(sx, 1);
  const hipY = -42 + bob;
  // cauda varrendo do lado oposto ao quadril
  const wag = -twist * 0.35;
  g.save();
  g.translate(-14, hipY + 6);
  g.rotate(0.25 + wag);
  g.beginPath();
  g.moveTo(0, -9);
  g.quadraticCurveTo(-40, -6, -78, 22);
  g.quadraticCurveTo(-40, 8, 0, 9);
  g.closePath();
  g.fillStyle = GREEN_D;
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 1.6;
  g.stroke();
  g.fillStyle = '#3c5e35';
  for (let i = 0; i < 6; i++) {
    const tx = -8 - i * 11;
    const ty = -7 + i * 4.4;
    g.beginPath();
    g.moveTo(tx - 4, ty + 1);
    g.lineTo(tx, ty - 5);
    g.lineTo(tx + 3, ty + 1);
    g.closePath();
    g.fill();
  }
  g.restore();
  // pernas: base larga, joelhos para fora, pé que pisa sobe alto
  const legs: [number, number, number][] = [[-1, liftL, -26], [1, liftR, 28]];
  for (const [s, lift, fx] of legs) {
    const fy = -lift * 26;
    limb(g, s * 12, hipY, fx + s * lift * 4, fy - 6, 25, -s, 15, s < 0 ? GREEN_D : GREEN);
    drawSpr(g, a.foot, fx + s * lift * 4, fy, { sx: s, rot: -s * lift * 0.35 });
  }
  // tronco gira no ritmo (rotação + achatamento simulando o peito virando)
  g.save();
  g.translate(0, hipY + 4);
  g.rotate(twist * 0.13 - impact * 0.03);
  const chest = 1 - Math.abs(twist) * 0.14;
  // braços dobrados batendo no ritmo: um sobe enquanto o outro desce
  const pumpL = Math.sin(p * Math.PI * 2);
  const shY = -64;
  limb(g, -16, shY, -48, shY + 4 - pumpL * 18, 18, 1, 11, GREEN_D);
  drawClaw(g, -48, shY + 4 - pumpL * 18);
  drawSpr(g, a.torso, 0, 0, { sx: chest });
  limb(g, 16, shY, 50 + twist * 4, shY + 2 + pumpL * 18, 18, -1, 11, GREEN);
  drawClaw(g, 50 + twist * 4, shY + 2 + pumpL * 18);
  // cabeça balança no tempo e responde à pisada
  drawSpr(g, a.head, 2, -70, { rot: -twist * 0.12 + impact * 0.06 });
  g.restore();
  g.restore();
}

function drawClaw(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = GREEN;
  g.strokeStyle = OUT;
  g.lineWidth = 1;
  g.beginPath();
  g.arc(x, y, 6, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#eadcac';
  for (let i = -1; i <= 1; i++) {
    g.beginPath();
    g.moveTo(x + i * 3.4 - 1.2, y - 4);
    g.lineTo(x + i * 4.2, y - 9);
    g.lineTo(x + i * 3.4 + 1.2, y - 4);
    g.closePath();
    g.fill();
  }
}
