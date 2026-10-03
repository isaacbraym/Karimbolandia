import { bake, drawSpr, OUT, type Sprite } from './kit';
import { TAU } from '../core/math';

let grenade: Sprite | undefined;
/** Silhueta própria: a granada laranja pode ser interceptada, ao contrário dos tiros comuns. */
export function drawInterceptableGrenade(g: CanvasRenderingContext2D, x: number, y: number, age: number, angle: number) {
  grenade ??= bake(18, 18, c => {
    c.fillStyle = '#d69a43'; c.strokeStyle = OUT; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(9, 10, 5.5, 6, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#ffe09b'; c.beginPath(); c.ellipse(7, 8, 2, 3, -.3, 0, TAU); c.fill();
    c.fillStyle = '#4c555c'; c.fillRect(6, 2, 6, 4); c.strokeRect(6, 2, 6, 4);
    c.strokeStyle = '#5e422a'; c.lineWidth = 1; c.beginPath(); c.moveTo(4, 10); c.lineTo(14, 10); c.stroke();
  }, { ox: 9, oy: 9, scale: 3 });
  g.save(); g.strokeStyle = '#ffe1a0'; g.lineWidth = 1.2; g.globalAlpha = .6;
  g.beginPath(); g.arc(x, y, 10 + Math.sin(age * 7) * 1.5, 0, TAU); g.stroke(); g.restore();
  drawSpr(g, grenade, x, y, { rot: angle + age * 6 });
}

/** O aro permanece fixo no alvo escolhido; o símbolo dá leitura além da cor. */
export function drawLobTarget(g: CanvasRenderingContext2D, x: number, floor: number, charge: number, radius: number) {
  const urgent = charge > .8;
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  g.fillStyle = urgent ? 'rgba(255,99,70,.16)' : 'rgba(255,191,93,.1)';
  g.strokeStyle = urgent ? '#ff8862' : '#ffe0a0'; g.lineWidth = 1.7;
  g.beginPath(); g.ellipse(x, floor, radius, 8, 0, 0, TAU); g.fill(); g.stroke();
  g.lineWidth = 3;
  g.beginPath(); g.ellipse(x, floor, radius, 8, 0, -Math.PI / 2, -Math.PI / 2 + TAU * charge); g.stroke();
  g.fillStyle = urgent ? '#f1935b' : '#d5a958'; g.strokeStyle = OUT; g.lineWidth = 1.2;
  // Acima da cabeça: no chão o próprio Karimbo ocultaria o símbolo de perigo.
  g.beginPath(); g.moveTo(x, floor - 112); g.lineTo(x + 9, floor - 97); g.lineTo(x - 9, floor - 97); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(x, floor - 106); g.lineTo(x, floor - 103); g.stroke();
  g.fillStyle = OUT; g.beginPath(); g.arc(x, floor - 100, 1, 0, TAU); g.fill();
  g.restore();
}
