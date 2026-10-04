/** Móveis da palafita do vigia. Coordenadas locais: ver `furniture.ts`. */
import { P, box, contactShadow, poly, registerPainter } from '../furniture';

const OUT = '#170f2e';
const WOOD = '#9a7650', WOOD_D = '#6b4f36', OLIVE = '#56633b', METAL = '#7d8a86';

const line = (g: CanvasRenderingContext2D, a: [number, number], b: [number, number], w: number, c: string) => {
  g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
};
const dot = (g: CanvasRenderingContext2D, p: [number, number], r: number, c: string) => { g.fillStyle = c; g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fill(); };

/** Quadro plano na parede: o renderer aplica a inclinação. Origem = base, centro. */
const frame = (g: CanvasRenderingContext2D, w: number, h: number, c = '#3a2a1c') => {
  g.fillStyle = c; g.strokeStyle = OUT; g.lineWidth = 1.2;
  g.beginPath(); g.roundRect(-w / 2, -h, w, h, 3); g.fill(); g.stroke();
};

// ───────────────────────────────────────────────────────────────────────── parede
registerPainter('portrait', (g, f, key) => {
  const w = 44, h = 52;
  g.save(); g.rotate(-0.03);
  frame(g, w, h, '#a3793f');
  g.fillStyle = '#5b6f64'; g.fillRect(-w / 2 + 4, -h + 4, w - 8, h - 8);
  g.fillStyle = '#3d4a35'; g.beginPath(); g.moveTo(-14, -6); g.quadraticCurveTo(0, -26, 14, -6); g.lineTo(14, -4); g.lineTo(-14, -4); g.fill();
  g.fillStyle = '#c98e65'; g.strokeStyle = OUT; g.lineWidth = 0.9; g.beginPath(); g.ellipse(0, -28, 11, 13, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#38472e'; g.beginPath(); g.moveTo(-12, -33); g.lineTo(-9, -44); g.lineTo(9, -45); g.lineTo(12, -33); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#efd084'; g.beginPath(); g.moveTo(0, -43); g.lineTo(-2, -47); g.lineTo(0, -50); g.lineTo(2, -47); g.closePath(); g.fill();
  g.fillStyle = '#292720'; g.fillRect(-6, -30, 2.4, 3); g.fillRect(4, -30, 2.4, 3);
  if (key === 'mustache') {
    g.fillStyle = '#17120e'; g.beginPath(); g.moveTo(-9, -22); g.quadraticCurveTo(-4, -28, 0, -23); g.quadraticCurveTo(4, -28, 9, -22); g.quadraticCurveTo(4, -20, 0, -21); g.quadraticCurveTo(-4, -20, -9, -22); g.fill();
    g.strokeStyle = '#17120e'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-9, -22); g.quadraticCurveTo(-12, -26, -10, -28); g.moveTo(9, -22); g.quadraticCurveTo(12, -26, 10, -28); g.stroke();
  } else { g.strokeStyle = '#5a2a22'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-5, -22); g.quadraticCurveTo(0, -20, 5, -22); g.stroke(); }
  dot(g, [9, -9], 3.2, '#d6b662'); g.strokeStyle = OUT; g.lineWidth = 0.7; g.stroke();
  g.fillStyle = '#c8ad75'; g.font = '4.4px sans-serif'; g.textAlign = 'center'; g.fillText('PRESENÇA CONFIRMADA', 0, -h + 9.4);
  g.restore();
});

registerPainter('window', {
  base(g) {
    const w = 50, h = 52;
    g.fillStyle = '#243a3a'; g.fillRect(-w / 2, -h, w, h);
    const sky = g.createLinearGradient(0, -h, 0, 0); sky.addColorStop(0, '#2a4f6a'); sky.addColorStop(1, '#6fa6a0');
    g.fillStyle = sky; g.fillRect(-w / 2 + 4, -h + 4, w - 8, h - 8);
    g.fillStyle = '#16301f';
    for (let i = 0; i < 6; i++) { const x = -20 + i * 8; g.beginPath(); g.moveTo(x, -6); g.lineTo(x + 3, -24 - (i % 3) * 5); g.lineTo(x + 7, -6); g.fill(); }
    g.fillStyle = '#7aa6a1'; g.fillRect(-w / 2 + 4, -12, w - 8, 8);
    g.strokeStyle = '#3a2a1c'; g.lineWidth = 3; g.strokeRect(-w / 2, -h, w, h);
    g.beginPath(); g.moveTo(0, -h); g.lineTo(0, 0); g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2, -h / 2); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 1; g.strokeRect(-w / 2, -h, w, h);
    g.fillStyle = '#6a7a4a'; g.beginPath(); g.moveTo(w / 2 - 4, -h); g.quadraticCurveTo(w / 2 - 14, -h + 18, w / 2 - 6, -h + 30); g.lineTo(w / 2, -h + 30); g.lineTo(w / 2, -h); g.fill();
  },
  live(g, _f, _k, t) {
    for (let i = 0; i < 5; i++) {
      const x = -16 + i * 8 + Math.sin(t * 0.9 + i * 2) * 4, y = -20 - ((i * 7) % 20) + Math.cos(t * 1.3 + i) * 3;
      g.globalAlpha = 0.45 + 0.45 * Math.sin(t * 3 + i * 1.7); g.fillStyle = '#e8ff9a'; g.beginPath(); g.arc(x, y, 1.3, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  },
});

registerPainter('lantern', {
  base(g) {
    line(g, [0, -34], [0, -26], 2, '#2a2118');
    g.fillStyle = '#c9a657'; g.strokeStyle = OUT; g.lineWidth = 1;
    g.beginPath(); g.roundRect(-8, -26, 16, 4, 1.5); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,228,150,.85)'; g.beginPath(); g.roundRect(-6, -22, 12, 16, 3); g.fill(); g.stroke();
    g.fillStyle = '#c9a657'; g.fillRect(-8, -6, 16, 4);
    g.strokeStyle = '#8a6a30'; g.lineWidth = 1; g.beginPath(); g.moveTo(-6, -22); g.lineTo(-6, -6); g.moveTo(6, -22); g.lineTo(6, -6); g.stroke();
  },
  live(g, _f, _k, t) {
    const k = 1 + Math.sin(t * 9) * 0.12;
    g.fillStyle = '#fff6c0'; g.beginPath(); g.ellipse(0, -13, 2.4 * k, 5 * k, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffb040'; g.beginPath(); g.ellipse(0, -11, 1.4, 3, 0, 0, Math.PI * 2); g.fill();
  },
});

registerPainter('map', (g) => {
  g.save(); g.rotate(0.02);
  g.fillStyle = '#e0cf9c'; g.strokeStyle = OUT; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-20, -2); g.lineTo(-19, -39); g.lineTo(20, -40); g.lineTo(21, -3); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = '#6aa0a4'; g.lineWidth = 2; g.beginPath(); g.moveTo(-14, -10); g.quadraticCurveTo(-4, -22, 4, -16); g.quadraticCurveTo(12, -10, 14, -28); g.stroke();
  for (const [x, y] of [[-12, -30], [2, -32], [10, -12]] as const) { line(g, [x, y], [x, y - 8], 1, '#4a3a22'); g.fillStyle = '#c4553a'; g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 6, y - 6); g.lineTo(x, y - 4); g.fill(); }
  g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(-10, -14, 4, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#8a5a10'; g.lineWidth = 0.8; g.stroke();
  g.strokeStyle = '#8a5a10'; g.beginPath(); g.arc(-10, -14, 2, 0.2, Math.PI - 0.2); g.stroke();
  g.fillStyle = '#d8d0b0'; g.fillRect(-23, -22, 5, 8); g.fillRect(18, -36, 5, 7);
  g.restore();
});

// ───────────────────────────────────────────────────────────────────────── chão
registerPainter('doormat', (g) => {
  poly(g, [P(-0.42, -0.32, 2), P(0.42, -0.32, 2), P(0.42, 0.32, 2), P(-0.42, 0.32, 2)], '#8a3a3a', OUT, 1);
  poly(g, [P(-0.32, -0.22, 2.2), P(0.32, -0.22, 2.2), P(0.32, 0.22, 2.2), P(-0.32, 0.22, 2.2)], '#c9a45a');
  g.strokeStyle = '#6b2a2a'; g.lineWidth = 1;
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(...P(i * 0.13, -0.22, 2.3)); g.lineTo(...P(i * 0.13, 0.22, 2.3)); g.stroke(); }
});

registerPainter('weaponRack', {
  base(g) {
    contactShadow(g, 2, 1, 0.3);
    box(g, -1, 1, -0.4, -0.14, 0, 6, { top: WOOD_D });
    poly(g, [P(-1, -0.3, 6), P(1, -0.3, 6), P(1, -0.3, 58), P(-1, -0.3, 58)], '#4b3b2c', OUT, 1);
    for (let i = 0; i < 4; i++) line(g, P(-0.9 + i * 0.6, -0.3, 8), P(-0.9 + i * 0.6, -0.3, 56), 1, 'rgba(0,0,0,.35)');
    poly(g, [P(-1, -0.3, 30), P(1, -0.3, 30), P(1, -0.18, 30), P(-1, -0.18, 30)], WOOD, OUT, 1);
    poly(g, [P(-1, -0.3, 54), P(1, -0.3, 54), P(1, -0.18, 54), P(-1, -0.18, 54)], WOOD, OUT, 1);
    for (let k = 0; k < 3; k++) {
      const u = -0.62 + k * 0.62;
      line(g, P(u, -0.12, 6), P(u + 0.06, -0.16, 54), 4.2, OUT);
      line(g, P(u, -0.12, 6), P(u + 0.06, -0.16, 54), 2.6, k === 1 ? '#9aa5a0' : '#5a6460');
      line(g, P(u, -0.12, 6), P(u + 0.02, -0.13, 25), 4.6, OUT); line(g, P(u, -0.12, 6), P(u + 0.02, -0.13, 25), 3, '#8a5a36');
      line(g, P(u + 0.03, -0.15, 40), P(u + 0.05, -0.16, 52), 1, '#e7efe8');
    }
    g.strokeStyle = '#2a2a2a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(...P(-0.95, -0.1, 34)); g.quadraticCurveTo(...P(0, -0.1, 24), ...P(0.95, -0.1, 34)); g.stroke();
    dot(g, P(0, -0.1, 25), 2.6, '#c9a657');
    poly(g, [P(0.55, -0.31, 46), P(0.95, -0.31, 46), P(0.95, -0.31, 36), P(0.55, -0.31, 36)], '#e8e0c0', OUT, 0.6);
  },
});

registerPainter('desk', {
  base(g, f, key) {
    contactShadow(g, 2, 1, 0.28);
    for (const [u, v] of [[-0.9, -0.3], [0.9, -0.3], [-0.9, 0.3], [0.9, 0.3]] as const) box(g, u - 0.07, u + 0.07, v - 0.07, v + 0.07, 0, 22, { top: WOOD_D });
    box(g, -0.8, 0.8, -0.28, 0.28, 12, 22, { top: WOOD });
    box(g, -1, 1, -0.4, 0.4, 22, 26, { top: '#b08a5c' });
    const open = key === 'open' || key === 'done';
    if (open) {
      box(g, -0.7, 0.7, 0.28, 0.72, 13, 20, { top: key === 'done' ? '#2a2018' : '#3a2c20', left: '#8a6a44', right: '#6a4e34' });
      if (key === 'open') { g.fillStyle = '#d8b46d'; for (let i = 0; i < 5; i++) { const p = P(-0.5 + i * 0.25, 0.52, 20.6); g.fillRect(p[0] - 2, p[1] - 1, 4, 2.2); } }
    } else {
      poly(g, [P(-0.72, 0.28, 20), P(0.72, 0.28, 20), P(0.72, 0.28, 13), P(-0.72, 0.28, 13)], '#806343', OUT, 1);
      line(g, P(-0.15, 0.29, 16.5), P(0.15, 0.29, 16.5), 2.4, '#d0ab68');
      g.strokeStyle = '#e8dcc0'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(...P(-0.15, 0.3, 16.5)); g.quadraticCurveTo(...P(0, 0.34, 9), ...P(0.18, 0.3, 11)); g.stroke();
    }
    void f;
  },
});

registerPainter('radio', {
  base(g) {
    box(g, -0.3, 0.3, -0.2, 0.2, 0, 13, { top: '#7a8878', left: '#657366', right: '#4f5c52' });
    poly(g, [P(-0.24, 0.2, 11), P(0.05, 0.2, 11), P(0.05, 0.2, 3), P(-0.24, 0.2, 3)], '#2b3934', OUT, 0.8);
    for (let i = 0; i < 4; i++) line(g, P(-0.22, 0.21, 9 - i * 1.8), P(0.03, 0.21, 9 - i * 1.8), 0.7, '#73847b');
    poly(g, [P(0.1, 0.2, 11), P(0.26, 0.2, 11), P(0.26, 0.2, 7), P(0.1, 0.2, 7)], '#d7ba73', OUT, 0.6);
    dot(g, P(0.18, 0.21, 4), 2, '#bba575');
    line(g, P(-0.2, -0.1, 13), P(-0.28, -0.1, 34), 1.2, '#acb6a0'); dot(g, P(-0.28, -0.1, 34), 1.2, '#e0e8d0');
  },
  live(g, f, key, t) {
    if (key !== 'on') return;
    const a = P(0.18, 0.21, 9);
    g.fillStyle = `rgba(255,220,120,${0.55 + 0.35 * Math.sin(t * 12)})`; g.fillRect(a[0] - 4, a[1] - 1.4, 8, 2.8);
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.9 + i / 3) % 1);
      g.globalAlpha = 1 - k; g.strokeStyle = '#ffe9a0'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(a[0] - 4, a[1] - 14, 4 + k * 12, -2.4, -0.7); g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = '#ffe9a0'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center';
    g.globalAlpha = 0.8; g.fillText('♪', a[0] + 6 + Math.sin(t * 3) * 5, a[1] - 18 - ((t * 14) % 14)); g.globalAlpha = 1;
    void f;
  },
});

registerPainter('bottle', (g, f, key) => {
  if (key === 'broken') {
    g.fillStyle = '#4c8a5a'; g.strokeStyle = OUT; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(-4, 0); g.lineTo(-5, -5); g.lineTo(-2, -3); g.lineTo(0, -7); g.lineTo(2, -3); g.lineTo(5, -5); g.lineTo(4, 0); g.closePath(); g.fill(); g.stroke();
    return;
  }
  g.fillStyle = 'rgba(8,16,16,.28)'; g.beginPath(); g.ellipse(0, 1, 6, 2.6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4c8a5a'; g.strokeStyle = OUT; g.lineWidth = 0.9;
  g.beginPath(); g.moveTo(-4.4, 0); g.lineTo(-4.4, -12); g.quadraticCurveTo(-4.4, -15, -1.6, -17); g.lineTo(-1.6, -22); g.lineTo(1.6, -22); g.lineTo(1.6, -17); g.quadraticCurveTo(4.4, -15, 4.4, -12); g.lineTo(4.4, 0); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#e6d6a0'; g.fillRect(-4.4, -10, 8.8, 5.4); g.fillStyle = '#6a4a20'; g.font = '3.4px sans-serif'; g.textAlign = 'center'; g.fillText('70%', 0, -6.2);
  g.fillStyle = '#a2d6aa'; g.fillRect(-3.2, -14, 1.2, 3);
});

registerPainter('hammock', {
  base(g) {
    contactShadow(g, 3, 1, 0.22);
    for (const u of [-1.42, 1.42]) { line(g, P(u, 0, 0), P(u, 0, 52), 5, OUT); line(g, P(u, 0, 0), P(u, 0, 52), 3, '#6b4f36'); }
    const zAt = (u: number, edge: number) => 17 + (edge > 0 ? -2 : 1) + Math.pow(u / 1.25, 2) * 15;
    const N = 10, us = Array.from({ length: N + 1 }, (_, i) => -1.25 + (2.5 * i) / N);
    // cordas das estacas até as pontas do pano
    g.strokeStyle = '#d8c89a'; g.lineWidth = 1.2;
    for (const [u, end] of [[-1.42, -1.25], [1.42, 1.25]] as const) for (const v of [-0.28, 0.28]) { g.beginPath(); g.moveTo(...P(u, 0, 48)); g.lineTo(...P(end, v, zAt(end, v))); g.stroke(); }
    // pano: borda de trás (v−) e da frente (v+), com o bojo no meio
    g.beginPath();
    us.forEach((u, i) => { const p = P(u, -0.28, zAt(u, -1)); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
    [...us].reverse().forEach((u) => { const p = P(u, 0.28, zAt(u, 1)); g.lineTo(p[0], p[1]); });
    g.closePath(); g.fillStyle = OLIVE; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.3; g.stroke();
    for (let i = 1; i < N; i++) { const u = us[i]; g.strokeStyle = i % 2 ? '#7f8f55' : '#475330'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(...P(u, -0.28, zAt(u, -1))); g.lineTo(...P(u, 0.28, zAt(u, 1))); g.stroke(); }
    g.beginPath(); us.forEach((u, i) => { const p = P(u, 0.28, zAt(u, 1)); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
    g.strokeStyle = '#c4553a'; g.lineWidth = 2.2; g.stroke();
    // ponta do cobertor pendurada
    g.fillStyle = '#7a5a3a'; g.strokeStyle = OUT; g.lineWidth = 1; g.beginPath(); g.moveTo(...P(0.2, 0.28, zAt(0.2, 1))); g.lineTo(...P(0.8, 0.28, zAt(0.8, 1))); g.lineTo(...P(0.74, 0.3, 6)); g.lineTo(...P(0.28, 0.3, 4)); g.closePath(); g.fill(); g.stroke();
  },
});

registerPainter('boots', (g, f, key) => {
  contactShadow(g, 1, 1, 0.22);
  const boot = (u: number, v: number) => {
    box(g, u - 0.14, u + 0.14, v - 0.1, v + 0.1, 0, 10, { top: '#6a4a30' });
    box(g, u - 0.16, u + 0.2, v + 0.04, v + 0.26, 0, 5, { top: '#4a3220' });
    g.strokeStyle = '#efe6c8'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(...P(u - 0.08, v + 0.1, 8)); g.lineTo(...P(u + 0.08, v + 0.1, 5)); g.moveTo(...P(u + 0.08, v + 0.1, 8)); g.lineTo(...P(u - 0.08, v + 0.1, 5)); g.stroke();
  };
  boot(-0.2, -0.05); boot(0.22, 0.05);
  if (key === 'tied') {
    g.strokeStyle = '#efe6c8'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(...P(-0.18, 0.1, 3)); g.bezierCurveTo(...P(-0.05, 0.3, 1), ...P(0.05, 0.3, 1), ...P(0.2, 0.15, 3)); g.stroke();
    dot(g, P(0, 0.26, 2), 2.4, '#efe6c8'); g.strokeStyle = OUT; g.lineWidth = 0.6; g.stroke();
  }
  void f;
});

registerPainter('lowTable', (g) => {
  contactShadow(g, 2, 1, 0.25);
  for (const [u, v] of [[-0.85, -0.28], [0.85, -0.28], [-0.85, 0.28], [0.85, 0.28]] as const) box(g, u - 0.07, u + 0.07, v - 0.07, v + 0.07, 0, 14, { top: WOOD_D });
  box(g, -1, 1, -0.38, 0.38, 14, 18, { top: '#a57d53' });
  for (let i = 0; i < 3; i++) line(g, P(-0.8, -0.2 + i * 0.2, 18.2), P(0.8, -0.2 + i * 0.2, 18.2), 0.6, 'rgba(60,36,16,.35)');
});

registerPainter('letter', (g) => {
  // caneca verde e carta dobrada
  g.fillStyle = '#dfd1a2'; g.strokeStyle = OUT; g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(...P(-0.35, -0.05, 0)); g.lineTo(...P(-0.02, -0.18, 0)); g.lineTo(...P(0.1, 0.12, 0)); g.lineTo(...P(-0.25, 0.22, 0)); g.closePath(); g.fill(); g.stroke();
  for (let i = 0; i < 3; i++) line(g, P(-0.28 + i * 0.03, 0.02 + i * 0.05, 0.3), P(-0.02 + i * 0.03, -0.08 + i * 0.05, 0.3), 0.7, '#76715a');
  box(g, 0.1, 0.34, -0.22, 0.02, 0, 9, { top: '#658a78', left: '#5a8070', right: '#47695a' });
  g.strokeStyle = '#658a78'; g.lineWidth = 2; g.beginPath(); g.arc(...P(0.34, -0.1, 5), 3, -1.2, 1.2); g.stroke();
});

registerPainter('magazine', (g) => {
  g.fillStyle = '#d0a47c'; g.strokeStyle = OUT; g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(...P(-0.3, -0.2, 0)); g.lineTo(...P(0.3, -0.2, 0)); g.lineTo(...P(0.3, 0.2, 0)); g.lineTo(...P(-0.3, 0.2, 0)); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#72554b'; g.beginPath(); g.moveTo(...P(-0.26, -0.16, 0.4)); g.lineTo(...P(0.0, -0.16, 0.4)); g.lineTo(...P(0.0, -0.02, 0.4)); g.lineTo(...P(-0.26, -0.02, 0.4)); g.fill();
  g.fillStyle = '#ffdeb0'; g.font = '3.6px sans-serif'; g.textAlign = 'center'; const p = P(-0.13, -0.08, 0.5); g.fillText('MERC.', p[0], p[1] + 1);
});

registerPainter('ammoBox', (g, f, key) => {
  contactShadow(g, 1, 1, 0.26);
  box(g, -0.4, 0.4, -0.3, 0.3, 0, 16, { top: '#596943', left: '#4a5a36', right: '#394829' });
  g.strokeStyle = '#d6cfa0'; g.lineWidth = 0.9;
  for (const v of [-0.15, 0.15]) { g.beginPath(); g.moveTo(...P(-0.38, 0.3, 8 + v * 4)); g.lineTo(...P(0.38, 0.3, 8 + v * 4)); g.stroke(); }
  g.fillStyle = '#d6cfa0'; g.font = 'bold 4px sans-serif'; g.textAlign = 'center'; const t = P(0, 0.3, 11); g.fillText('MUNIÇÃO', t[0], t[1]);
  if (key === 'open') {
    poly(g, [P(-0.4, -0.3, 16), P(0.4, -0.3, 16), P(0.4, -0.3, 30), P(-0.4, -0.3, 30)], '#4a5a36', OUT, 1);
    poly(g, [P(-0.34, -0.24, 16), P(0.34, -0.24, 16), P(0.34, 0.24, 16), P(-0.34, 0.24, 16)], '#1c241a');
  } else poly(g, [P(-0.42, -0.32, 16), P(0.42, -0.32, 16), P(0.42, 0.32, 17), P(-0.42, 0.32, 17)], '#657650', OUT, 1);
  void f;
});

registerPainter('pot', (g, f, key) => {
  if (key === 'gone') return;
  g.fillStyle = 'rgba(8,16,16,.28)'; g.beginPath(); g.ellipse(0, 2, 11, 5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#b56a45'; g.strokeStyle = OUT; g.lineWidth = 1;
  g.beginPath(); g.ellipse(0, -8, 11, 9.5, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#8a4a2c'; g.beginPath(); g.ellipse(0, -15.5, 8, 2.6, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.strokeStyle = '#e8c88a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-9, -8); g.quadraticCurveTo(0, -4, 9, -8); g.stroke();
  g.fillStyle = '#b56a45'; g.beginPath(); g.ellipse(-12, -9, 2.6, 3.4, 0, 0, Math.PI * 2); g.ellipse(12, -9, 2.6, 3.4, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#fff2c0'; g.strokeStyle = OUT; g.lineWidth = 0.7; g.beginPath(); g.roundRect(-5, -9, 10, 6, 1); g.fill(); g.stroke();
  g.fillStyle = '#7a3b2a'; g.font = 'bold 2.8px sans-serif'; g.textAlign = 'center'; g.fillText('RÁDIO INIMIGO', 0, -4.8);
  void f;
});

registerPainter('chest', (g, f, key) => {
  contactShadow(g, 1, 2, 0.28);
  box(g, -0.4, 0.4, -0.9, 0.9, 0, 14, { top: '#697552', left: '#546044', right: '#3f4a33' });
  g.strokeStyle = '#ac9c71'; g.lineWidth = 2;
  for (const v of [-0.55, 0.55]) { g.beginPath(); g.moveTo(...P(0.4, v, 0)); g.lineTo(...P(0.4, v, 14)); g.stroke(); }
  if (key === 'open' || key === 'done') {
    poly(g, [P(-0.4, -0.9, 14), P(0.4, -0.9, 14), P(0.4, -0.9, 34), P(-0.4, -0.9, 34)], '#546044', OUT, 1);
    poly(g, [P(-0.34, -0.84, 14), P(0.34, -0.84, 14), P(0.34, 0.84, 14), P(-0.34, 0.84, 14)], '#1d2418');
    if (key === 'open') { g.fillStyle = '#d8b46d'; for (let i = 0; i < 6; i++) { const p = P(-0.2 + (i % 2) * 0.25, -0.5 + i * 0.2, 14.5); g.fillRect(p[0] - 2, p[1] - 1, 4, 2); } }
    else { g.fillStyle = '#c8b898'; g.beginPath(); g.ellipse(...P(0, 0.1, 14.4), 7, 3, 0, 0, Math.PI * 2); g.fill(); }
  } else {
    poly(g, [P(-0.44, -0.94, 14), P(0.44, -0.94, 14), P(0.44, 0.94, 14), P(-0.44, 0.94, 14)], '#7b8860', OUT, 1);
    const latch = P(0.42, 0, 9); g.fillStyle = '#d3b272'; g.fillRect(latch[0] - 3, latch[1] - 3, 6, 7);
  }
  void f;
});

registerPainter('tin', (g) => {
  g.fillStyle = 'rgba(8,16,16,.28)'; g.beginPath(); g.ellipse(0, 2, 11, 5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#b9b2a0'; g.strokeStyle = OUT; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-7, 0); g.lineTo(-7, -13); g.lineTo(7, -13); g.lineTo(7, 0); g.quadraticCurveTo(0, 3, -7, 0); g.fill(); g.stroke();
  g.fillStyle = '#d8d0b4'; g.beginPath(); g.ellipse(0, -13, 7, 2.4, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#7a3b2a'; g.fillRect(-6, -10, 12, 6); g.fillStyle = '#fff4cf'; g.font = 'bold 4px sans-serif'; g.textAlign = 'center'; g.fillText('SOLDO', 0, -5.6);
});
