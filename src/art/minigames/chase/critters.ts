/**
 * Bichos e objetos da perseguição, desenhados com formas simples (poucas elipses e traços, contorno
 * escuro do kit). Nada é criado por quadro: só caminhos curtos e cores sólidas.
 */
import { OUT } from '../../kit';

const TAU = Math.PI * 2;
function oval(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, c: string, rot = 0, lw = 1.4) {
  g.fillStyle = c; g.strokeStyle = OUT; g.lineWidth = lw;
  g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill(); g.stroke();
}
function stroke(g: CanvasRenderingContext2D, c: string, w: number) { g.strokeStyle = c; g.lineWidth = w; g.stroke(); }

/** Preguiça abraçada ao galho. `bounce` 0..1: barriga amassada depois de um pulo em cima dela. */
export function drawSloth(g: CanvasRenderingContext2D, x: number, y: number, t: number, bounce: number) {
  const sq = 1 - 0.22 * bounce, sw = Math.sin(t * 1.3) * 1.5;
  g.save();
  g.translate(x, y);
  g.scale(1 + 0.12 * bounce, sq);
  oval(g, 0, -17, 21, 15, '#8a6a4a');            // corpo
  oval(g, 0, -13, 13, 9, '#a98a63');             // barriga
  oval(g, 4, -33 + sw, 12, 11, '#b79a74');       // cabeça
  oval(g, 7, -34 + sw, 8, 6, '#e9d7b4');         // máscara clara
  oval(g, 3, -35 + sw, 2.4, 3, '#2a1e18'); oval(g, 11, -35 + sw, 2.4, 3, '#2a1e18'); // olhos sonolentos
  g.strokeStyle = '#2a1e18'; g.lineWidth = 1.3; g.beginPath(); g.arc(7, -30 + sw, 3.2, 0.15, Math.PI - 0.15); g.stroke(); // sorrisão
  // braços compridos com garras agarrando o galho
  for (const k of [-1, 1]) {
    g.beginPath(); g.moveTo(k * 10, -22); g.quadraticCurveTo(k * 24, -14, k * 20, -1); stroke(g, OUT, 6); g.beginPath(); g.moveTo(k * 10, -22); g.quadraticCurveTo(k * 24, -14, k * 20, -1); stroke(g, '#8a6a4a', 4);
    g.strokeStyle = '#efe5cf'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(k * 20 - 2, -1); g.lineTo(k * 20 - 3, 3); g.moveTo(k * 20 + 1, 0); g.lineTo(k * 20 + 1, 4); g.stroke();
  }
  g.restore();
}

/** Quati correndo para a ESQUERDA (contra o Karimbo), cauda anelada para cima. */
export function drawCoati(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const run = Math.sin(t * 22);
  g.save();
  g.translate(x, y);
  // cauda anelada
  g.beginPath(); g.moveTo(11, -10); g.quadraticCurveTo(26, -22, 20, -34 + run * 2); stroke(g, OUT, 7);
  g.beginPath(); g.moveTo(11, -10); g.quadraticCurveTo(26, -22, 20, -34 + run * 2); stroke(g, '#6b4a34', 5);
  g.strokeStyle = '#e8d6b0'; g.lineWidth = 5;
  for (const [a, b] of [[0.35, 0.45], [0.6, 0.7], [0.85, 0.95]]) { g.beginPath(); g.moveTo(11 + 12 * a + 3, -10 - 20 * a); g.lineTo(11 + 12 * b + 3, -10 - 20 * b); g.stroke(); }
  // pernas
  for (const k of [-1, 1]) { g.strokeStyle = OUT; g.lineWidth = 5; g.beginPath(); g.moveTo(k * 7, -7); g.lineTo(k * 7 + run * k * 4, 0); g.stroke(); g.strokeStyle = '#5a3d2b'; g.lineWidth = 3; g.stroke(); }
  oval(g, 0, -11, 14, 8, '#7a563c');
  oval(g, -13, -14, 7, 6, '#7a563c');           // cabeça
  oval(g, -19, -13, 5, 3.4, '#d9c39a');        // focinho comprido
  oval(g, -20.5, -13.5, 1.6, 1.6, '#1b1210');
  oval(g, -12, -16, 1.6, 1.8, '#1b1210');
  g.restore();
}

/** Tucano voando para a esquerda. */
export function drawToucan(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const flap = Math.sin(t * 18);
  g.save();
  g.translate(x, y);
  // asa de trás
  g.fillStyle = '#1f1a2b'; g.strokeStyle = OUT; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(4, -2); g.quadraticCurveTo(14, -20 - flap * 8, 26, -8 - flap * 6); g.quadraticCurveTo(14, -6, 4, 2); g.closePath(); g.fill(); g.stroke();
  oval(g, 2, 0, 16, 9, '#241d33');                 // corpo
  oval(g, -9, 1, 7, 6, '#f3efe0');                 // peito branco
  oval(g, -14, -3, 8, 7, '#241d33');               // cabeça
  // bicão laranja
  g.fillStyle = '#ff9a1f'; g.beginPath(); g.moveTo(-18, -7); g.quadraticCurveTo(-40, -8, -42, 4); g.quadraticCurveTo(-30, 2, -18, 3); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#ffd34d'; g.beginPath(); g.moveTo(-20, -6); g.quadraticCurveTo(-34, -7, -38, -2); g.lineTo(-22, -2); g.closePath(); g.fill();
  oval(g, -15, -5, 2.4, 2.6, '#fff'); oval(g, -15.4, -5, 1.2, 1.4, '#1b1210');
  // cauda
  g.fillStyle = '#241d33'; g.beginPath(); g.moveTo(14, 2); g.lineTo(30, 6 + flap * 2); g.lineTo(28, -3); g.closePath(); g.fill(); g.stroke();
  // asa da frente
  g.fillStyle = '#322a45'; g.beginPath(); g.moveTo(2, -2); g.quadraticCurveTo(10, 16 + flap * 9, 22, 8 + flap * 6); g.quadraticCurveTo(12, 2, 2, 4); g.closePath(); g.fill(); g.stroke();
  g.restore();
}

/** Cobra pendurada da folhagem balançando; `x` no centro, ponta em y (topo do galho − 32). */
export function drawSnake(g: CanvasRenderingContext2D, x: number, yTop: number, yTip: number, t: number, sway: number) {
  const n = 9, h = yTip - yTop;
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) { const k = i / n; pts.push(x + sway * k + Math.sin(t * 3 + k * 6) * 5 * k, yTop + h * k); }
  for (const [w, c] of [[9, OUT], [6.4, '#6ac34a']] as const) {
    g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.stroke();
  }
  g.fillStyle = '#2f7a2a';
  for (let i = 2; i < n; i += 2) { g.beginPath(); g.ellipse(pts[i * 2], pts[i * 2 + 1], 2.6, 1.6, 0, 0, TAU); g.fill(); }
  const hx = pts[n * 2], hy = pts[n * 2 + 1];
  oval(g, hx, hy + 3, 6.5, 7, '#7ad452');
  oval(g, hx - 2.4, hy + 1, 1.7, 2, '#fff'); oval(g, hx + 2.4, hy + 1, 1.7, 2, '#fff');
  g.fillStyle = '#1b1210'; g.fillRect(hx - 2.8, hy + 0.2, 1.2, 1.6); g.fillRect(hx + 1.8, hy + 0.2, 1.2, 1.6);
  if (Math.sin(t * 7) > 0.3) { g.strokeStyle = '#e8262e'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(hx, hy + 10); g.lineTo(hx, hy + 15); g.moveTo(hx, hy + 15); g.lineTo(hx - 2, hy + 18); g.moveTo(hx, hy + 15); g.lineTo(hx + 2, hy + 18); g.stroke(); }
}

/** Colmeia pendurada; as abelhas giram em volta quando `angry` (0..1). */
export function drawHive(g: CanvasRenderingContext2D, x: number, y: number, t: number, angry: number, ropeTop: number) {
  g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(x, ropeTop); g.lineTo(x, y - 24); g.stroke();
  g.save();
  g.translate(x + Math.sin(t * 2) * 2 * (1 + angry * 3), y);
  oval(g, 0, 0, 15, 22, '#d9a441');
  g.strokeStyle = '#8a5a1a'; g.lineWidth = 2;
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(0, i * 7, 14 - Math.abs(i) * 1.8, 3.2, 0, 0, Math.PI); g.stroke(); }
  oval(g, 0, 10, 4.2, 5, '#3a2210');            // buraquinho
  g.restore();
  const n = angry > 0.02 ? 9 : 3;
  for (let i = 0; i < n; i++) {
    const a = t * (5 + i * 0.7) + i * 1.9, r = 20 + (i % 3) * 8 + angry * 12;
    const bx = x + Math.cos(a) * r, by = y + Math.sin(a * 1.3) * r * 0.7;
    g.fillStyle = '#ffd23a'; g.beginPath(); g.ellipse(bx, by, 3.4, 2.4, 0, 0, TAU); g.fill();
    g.fillStyle = OUT; g.fillRect(bx - 0.7, by - 2.2, 1.2, 4.4);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(bx - 1, by - 3, 2.2, 1.4, -0.5, 0, TAU); g.fill();
  }
}

export function drawBanana(g: CanvasRenderingContext2D, x: number, y: number) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#ffd62e'; g.strokeStyle = OUT; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(-13, -2); g.quadraticCurveTo(0, -17, 13, -4); g.quadraticCurveTo(0, -8, -13, -2); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-10, -1); g.quadraticCurveTo(-18, 2, -15, 5); g.quadraticCurveTo(-8, 3, -2, -2); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(10, -3); g.quadraticCurveTo(18, 0, 15, 4); g.quadraticCurveTo(8, 2, 2, -3); g.fill(); g.stroke();
  g.restore();
}

export function drawCoconut(g: CanvasRenderingContext2D, x: number, y: number, rot: number) {
  g.save();
  g.translate(x, y - 10);
  g.rotate(rot);
  oval(g, 0, 0, 10, 10, '#6b4423', 0, 1.6);
  g.fillStyle = '#2a170a';
  for (const [a, b] of [[-3, -2], [3, -2], [0, 3]]) { g.beginPath(); g.arc(a, b, 1.5, 0, TAU); g.fill(); }
  g.restore();
}

/** Bromélia-mola: roseta de folhas que afunda quando pisada (`press` 0..1). */
export function drawBromeliad(g: CanvasRenderingContext2D, x: number, y: number, w: number, press: number, t: number) {
  const sq = 1 - 0.38 * press;
  g.save();
  g.translate(x, y);
  g.scale(1, sq);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1) - 0.5, ang = k * 2.1;
    g.save();
    g.rotate(ang);
    oval(g, 0, -17 + Math.sin(t * 2 + i) * 0.6, w * 0.17, 20, i % 2 ? '#e0517a' : '#ff7a9c', 0, 1.2);
    g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.ellipse(-2, -20, 2, 11, 0, 0, TAU); g.fill();
    g.restore();
  }
  oval(g, 0, -5, w * 0.2, 7, '#7cd34a');
  g.restore();
}

/** Cipó: corda de folhas do âncora até a ponta (`tx,ty`). */
export function drawVine(g: CanvasRenderingContext2D, ax: number, ay: number, tx: number, ty: number, t: number) {
  const mx = (ax + tx) / 2 + Math.sin(t * 2.2 + ax * 0.01) * 4, my = (ay + ty) / 2;
  for (const [w, c] of [[5.4, OUT], [3.6, '#5a8f32']] as const) {
    g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(mx, my, tx, ty); g.stroke();
  }
  g.fillStyle = '#7cc04a';
  for (let i = 1; i < 6; i++) {
    const k = i / 6, x = (1 - k) * (1 - k) * ax + 2 * (1 - k) * k * mx + k * k * tx, y = (1 - k) * (1 - k) * ay + 2 * (1 - k) * k * my + k * k * ty;
    g.beginPath(); g.ellipse(x + (i % 2 ? 4 : -4), y, 4.2, 2.2, i % 2 ? 0.6 : -0.6, 0, TAU); g.fill();
  }
}

/** Carta voando/na mão do macaco. */
export function drawEnvelope(g: CanvasRenderingContext2D, x: number, y: number, rot: number, s = 1) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  g.fillStyle = '#fbf3da'; g.strokeStyle = OUT; g.lineWidth = 1.3;
  g.fillRect(-9, -6, 18, 12); g.strokeRect(-9, -6, 18, 12);
  g.beginPath(); g.moveTo(-9, -6); g.lineTo(0, 1); g.lineTo(9, -6); g.stroke();
  g.fillStyle = '#d6243a'; g.beginPath(); g.arc(0, 1, 2.2, 0, TAU); g.fill();
  g.restore();
}
