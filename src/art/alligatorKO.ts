/**
 * Jacaré nocauteado no meio da roda: de barriga para cima, língua de fora, olhos em espiral, barriga
 * subindo e descendo, rabo tremendo de vez em quando, três passarinhos e estrelinhas girando sobre a
 * cabeça e "Zzz" saindo (mais forte a cada cutucada do graveto). Sem chapéu: o jacaré nunca usa chapéu.
 * Tudo com sprites assados e traços simples; só desenha se estiver perto da câmera.
 */
import { bake, drawSpr, OUT, type Sprite } from './kit';
import { gatorParts, GATOR_GREEN, GATOR_SCALE } from './dancingAlligator';

let zzz: Sprite | null = null;
let star: Sprite | null = null;
let bird: Sprite | null = null;
function sprites() {
  zzz ??= bake(16, 18, (g) => {
    g.strokeStyle = OUT; g.lineWidth = 3.2; g.lineJoin = 'round'; g.beginPath();
    g.moveTo(3, 4); g.lineTo(12, 4); g.lineTo(3, 14); g.lineTo(12, 14); g.stroke();
    g.strokeStyle = '#f4f8ff'; g.lineWidth = 1.7; g.stroke();
  }, { scale: 3, ox: 8, oy: 9 });
  star ??= bake(12, 12, (g) => {
    g.fillStyle = '#ffd23a'; g.strokeStyle = OUT; g.lineWidth = 0.9; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 2.4 : 5.2; g.lineTo(6 + Math.cos(a) * r, 6 + Math.sin(a) * r); }
    g.closePath(); g.fill(); g.stroke();
  }, { scale: 3, ox: 6, oy: 6 });
  bird ??= bake(16, 12, (g) => {
    g.fillStyle = '#4fb4e8'; g.strokeStyle = OUT; g.lineWidth = 0.9;
    g.beginPath(); g.ellipse(8, 7, 5, 3.6, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#f7c948'; g.beginPath(); g.moveTo(12.4, 6.4); g.lineTo(15.4, 7.2); g.lineTo(12.4, 8); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(10.4, 5.8, 1, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#10141a'; g.beginPath(); g.arc(10.7, 5.8, 0.5, 0, Math.PI * 2); g.fill();
  }, { scale: 3, ox: 8, oy: 7 });
  return { zzz, star, bird };
}

/** Pés (chão) em (x, y); `poke` 0..1 durante a cutucada, -1 parado. */
export function drawAlligatorKO(g: CanvasRenderingContext2D, x: number, y: number, t: number, poke: number) {
  const a = gatorParts();
  const s = sprites();
  const quake = poke >= 0 ? Math.sin(poke * Math.PI) : 0;
  const breath = 1 + Math.sin(t * 2.1) * 0.035;
  g.save();
  g.translate(x, y);
  g.scale(GATOR_SCALE * 1.25, GATOR_SCALE * 1.25);
  // sombra
  g.fillStyle = 'rgba(19,40,23,0.28)';
  g.beginPath(); g.ellipse(8, 2, 78, 9, 0, 0, Math.PI * 2); g.fill();
  g.translate(quake * 2.5 * Math.sin(t * 60), 0);
  // rabo (treme de vez em quando)
  const tw = Math.sin(t * 0.7) > 0.93 ? Math.sin(t * 40) * 0.12 : 0;
  g.save(); g.translate(58, -18); g.rotate(-0.1 + tw);
  g.beginPath(); g.moveTo(0, -10); g.quadraticCurveTo(46, -8, 92, 14); g.quadraticCurveTo(48, 6, 0, 10); g.closePath();
  g.fillStyle = '#4a7038'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.6; g.stroke();
  g.restore();
  // pernas para cima (de barriga para cima), com garras, tremendo de leve
  const legs: [number, number, number][] = [[-40, -30, -0.35], [-12, -34, -0.1], [18, -34, 0.12], [44, -30, 0.38]];
  for (const [lx, ly, r] of legs) {
    const sway = Math.sin(t * 1.8 + lx) * 0.06;
    g.save(); g.translate(lx, ly); g.rotate(r + sway);
    g.strokeStyle = OUT; g.lineWidth = 15; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -26); g.stroke();
    g.strokeStyle = GATOR_GREEN; g.lineWidth = 11; g.stroke();
    g.fillStyle = '#eadcac'; g.strokeStyle = OUT; g.lineWidth = 0.9;
    for (const dx of [-4, 0, 4]) { g.beginPath(); g.moveTo(dx - 1.6, -30); g.lineTo(dx * 1.3, -37); g.lineTo(dx + 1.6, -30); g.closePath(); g.fill(); g.stroke(); }
    g.restore();
  }
  // corpo deitado: o torso girado mostra a barriga creme listrada, subindo e descendo
  drawSpr(g, a.torso, 0, -4, { rot: Math.PI / 2, sx: breath, sy: 1 });
  // cabeça caída para a esquerda, língua de fora e olho em espiral
  g.save();
  g.translate(-66, -22);
  g.rotate(-Math.PI / 2 - 0.15 + Math.sin(t * 2.1) * 0.02);
  drawSpr(g, a.head, 0, 0, {});
  // língua
  g.fillStyle = '#e8657a'; g.strokeStyle = OUT; g.lineWidth = 0.9;
  g.beginPath(); g.moveTo(28, 6); g.quadraticCurveTo(36, 20 + Math.sin(t * 2.1) * 2, 30, 30); g.quadraticCurveTo(24, 26, 26, 12); g.closePath(); g.fill(); g.stroke();
  // olho em espiral (sprite coords do olho: 15,33 em relação ao pivô 24,61)
  g.fillStyle = '#fff6cf'; g.beginPath(); g.arc(-9, -28, 6, 0, Math.PI * 2); g.fill(); g.stroke();
  g.strokeStyle = '#1b1f18'; g.lineWidth = 0.9; g.beginPath();
  for (let i = 0; i < 28; i++) { const r = 0.4 + i * 0.17, an = i * 0.55; g.lineTo(-9 + Math.cos(an) * r, -28 + Math.sin(an) * r); }
  g.stroke();
  g.restore();
  // estrelinhas e três passarinhos girando sobre a cabeça
  for (let i = 0; i < 3; i++) {
    const an = t * 2.4 + (i * Math.PI * 2) / 3;
    drawSpr(g, s.star, -66 + Math.cos(an) * 26, -92 + Math.sin(an) * 7, { rot: t * 3 + i });
    const bn = -t * 1.7 + (i * Math.PI * 2) / 3;
    const flap = 1 + Math.sin(t * 22 + i) * 0.18;
    drawSpr(g, s.bird, -66 + Math.cos(bn) * 38, -112 + Math.sin(bn) * 9, { sx: Math.cos(bn) > 0 ? -1 : 1, sy: flap });
  }
  // Zzz subindo (mais forte a cada cutucada)
  for (let i = 0; i < 3; i++) {
    const k = ((t * 0.45 + i / 3) % 1);
    g.globalAlpha = (1 - k) * (0.6 + quake * 0.4);
    const sc = 0.8 + k * 0.7 + quake * 0.35;
    drawSpr(g, s.zzz, -92 - k * 10, -64 - k * 44, { sx: sc, sy: sc, rot: -0.2 });
  }
  g.globalAlpha = 1;
  g.restore();
}
