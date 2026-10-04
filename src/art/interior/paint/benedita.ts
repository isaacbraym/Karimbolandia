/** Móveis da casa da Dona Benedita: cimento queimado, chita florida, barra azul e muito afeto. */
import { P, box, contactShadow, poly, registerPainter } from '../furniture';

const OUT = '#170f2e';
const WOOD = '#a77a4e', WOOD_D = '#6f4f34';

const line = (g: CanvasRenderingContext2D, a: [number, number], b: [number, number], w: number, c: string) => {
  g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
};
const dot = (g: CanvasRenderingContext2D, p: [number, number], r: number, c: string) => { g.fillStyle = c; g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fill(); };
const flower = (g: CanvasRenderingContext2D, p: [number, number], r: number, petal: string, core = '#ffe08a') => {
  g.fillStyle = petal; for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.beginPath(); g.arc(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r * 0.6, r * 0.7, 0, Math.PI * 2); g.fill(); }
  dot(g, p, r * 0.55, core);
};
const CHITA = ['#d9503a', '#e8b83a', '#4f8f6a', '#3f6fa8', '#c06a9a'];

// ───────────────────────────────────────────────────────────────────────── parede
registerPainter('calendar', (g) => {
  g.fillStyle = '#f6ecd0'; g.strokeStyle = OUT; g.lineWidth = 1; g.beginPath(); g.roundRect(-15, -38, 30, 38, 2); g.fill(); g.stroke();
  g.fillStyle = '#c4553a'; g.fillRect(-15, -38, 30, 11); g.fillStyle = '#fff4cf'; g.font = 'bold 4.6px sans-serif'; g.textAlign = 'center'; g.fillText('FARMÁCIA SÃO JOSÉ', 0, -31.5);
  g.font = 'bold 9px sans-serif'; g.fillStyle = '#c4553a'; g.fillText('2009', 0, -18);
  g.fillStyle = '#4a3a22'; for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) g.fillRect(-12 + c * 5.4, -14 + r * 4.4, 3.2, 2.2);
  dot(g, [0, -39], 1.6, '#4a3a22');
});

registerPainter('houseWindow', {
  base(g) {
    const w = 46, h = 56;
    g.fillStyle = '#e6dcc0'; g.fillRect(-w / 2, -h, w, h);
    const sky = g.createLinearGradient(0, -h, 0, 0); sky.addColorStop(0, '#9fd2f0'); sky.addColorStop(1, '#d6efc0');
    g.fillStyle = sky; g.fillRect(-w / 2 + 5, -h + 5, w - 10, h - 10);
    g.fillStyle = '#6fae5e'; g.fillRect(-w / 2 + 5, -20, w - 10, 15);
    g.fillStyle = '#4f8f4a'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(-17 + i * 7, -19, 5, Math.PI, 0); g.fill(); }
    g.fillStyle = '#f7f2e4'; g.beginPath(); g.ellipse(8, -12, 5, 3.4, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#d93a3a'; g.beginPath(); g.arc(11.5, -15, 1.6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8a6a44'; g.lineWidth = 2; g.strokeRect(-w / 2 + 5, -h + 5, w - 10, h - 10); line(g, [0, -h + 5], [0, -5], 2, '#8a6a44');
    // venezianas verdes abertas
    for (const s of [-1, 1]) {
      g.fillStyle = '#4f8f5a'; g.strokeStyle = OUT; g.lineWidth = 1;
      g.beginPath(); g.moveTo(s * w / 2, -h); g.lineTo(s * (w / 2 + 9), -h + 4); g.lineTo(s * (w / 2 + 9), -4); g.lineTo(s * w / 2, 0); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#2f6a3a'; g.lineWidth = 1; for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(s * w / 2, -h + 6 + i * 7.4); g.lineTo(s * (w / 2 + 9), -h + 8 + i * 7.4); g.stroke(); }
    }
    g.strokeStyle = OUT; g.lineWidth = 1; g.strokeRect(-w / 2, -h, w, h);
  },
});

registerPainter('mirror', {
  base(g) {
    const grad = g.createLinearGradient(-15, -46, 15, 0); grad.addColorStop(0, '#d9f0ee'); grad.addColorStop(0.5, '#9ac8c8'); grad.addColorStop(1, '#6f9aa8');
    g.fillStyle = '#c9a45a'; g.strokeStyle = OUT; g.lineWidth = 1.4; g.beginPath(); g.ellipse(0, -23, 16, 23, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = grad; g.beginPath(); g.ellipse(0, -23, 12.5, 19.5, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-6, -33); g.lineTo(-2, -38); g.stroke();
    dot(g, [0, -46], 2, '#a37e36');
  },
  live(g, _f, _k, t) {
    const k = (t * 0.45) % 1;
    g.globalAlpha = Math.max(0, 1 - Math.abs(k - 0.5) * 3); g.strokeStyle = '#ffffff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-10 + k * 20, -40); g.lineTo(-4 + k * 20, -12); g.stroke(); g.globalAlpha = 1;
  },
});

// ───────────────────────────────────────────────────────────────────────── cozinha
registerPainter('stove', {
  base(g) {
    contactShadow(g, 2, 1, 0.3);
    box(g, -1, 1, -0.4, 0.4, 0, 30, { top: '#55555e', left: '#44444c', right: '#34343c' });
    box(g, -0.96, 0.96, -0.36, 0.36, 30, 34, { top: '#2a2a30' });
    for (const u of [-0.5, 0.5]) { g.fillStyle = '#17171c'; g.beginPath(); g.ellipse(...P(u, 0, 34), 11, 5.4, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#5a5a64'; g.lineWidth = 1; g.beginPath(); g.ellipse(...P(u, 0, 34.2), 7.5, 3.6, 0, 0, Math.PI * 2); g.stroke(); }
    // porta do forno com brasa
    poly(g, [P(-0.8, 0.4, 20), P(-0.1, 0.4, 20), P(-0.1, 0.4, 4), P(-0.8, 0.4, 4)], '#2a2a30', OUT, 1);
    poly(g, [P(-0.72, 0.41, 17), P(-0.18, 0.41, 17), P(-0.18, 0.41, 7), P(-0.72, 0.41, 7)], '#ff8a2a');
    // lenha empilhada
    for (let i = 0; i < 3; i++) box(g, 0.1 + i * 0.26, 0.3 + i * 0.26, 0.4, 0.62, 0, 7, { top: '#8a5a36' });
    // cano da chaminé
    line(g, P(0.8, -0.25, 34), P(0.8, -0.25, 46), 5, OUT); line(g, P(0.8, -0.25, 34), P(0.8, -0.25, 46), 3, '#4a4a52');
  },
  live(g, _f, _k, t) {
    const a = P(-0.45, 0.42, 12);
    g.fillStyle = `rgba(255,200,90,${0.5 + 0.3 * Math.sin(t * 11)})`; g.beginPath(); g.ellipse(a[0], a[1], 8, 3.4 + Math.sin(t * 13) * 0.6, 0, 0, Math.PI * 2); g.fill();
  },
});

registerPainter('beansPot', (g, _f, key) => {
  g.fillStyle = 'rgba(8,8,10,.28)'; g.beginPath(); g.ellipse(0, 1, 11, 5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2f2f36'; g.strokeStyle = OUT; g.lineWidth = 1; g.beginPath(); g.moveTo(-10, 0); g.lineTo(-11, -12); g.lineTo(11, -12); g.lineTo(10, 0); g.quadraticCurveTo(0, 4, -10, 0); g.fill(); g.stroke();
  g.fillStyle = '#5a3a24'; g.beginPath(); g.ellipse(0, -12, 11, 4, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  const level = key === 'empty' ? 0 : key === 'low' ? 1 : key === 'half' ? 2 : 3;
  if (level) { g.fillStyle = '#2a1810'; g.beginPath(); g.ellipse(0, -12 - level * 0.3, 9, 3 + level * 0.3, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#5a3a28'; for (let i = 0; i < level * 4; i++) { g.beginPath(); g.ellipse(-6 + (i * 5) % 12, -12.5 + (i % 3) - 1, 1.6, 1, i, 0, Math.PI * 2); g.fill(); } }
  g.strokeStyle = '#888a94'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, -12, 12, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
});

registerPainter('filter', (g, _f, key) => {
  contactShadow(g, 1, 1, 0.24);
  box(g, -0.3, 0.3, -0.26, 0.26, 0, 14, { top: WOOD, left: '#8a6240', right: '#6a4a30' });
  const vessel = (z0: number, rx: number, ry: number, c: string, h: number) => {
    const p = P(0, 0, z0 + h / 2);
    g.fillStyle = c; g.strokeStyle = OUT; g.lineWidth = 1; g.beginPath(); g.ellipse(p[0], p[1], rx, h / 2 + 1.5, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(p[0] - rx * 0.3, p[1] - 2, rx * 0.25, h * 0.32, 0, 0, Math.PI * 2); g.fill(); void ry;
  };
  if (key === 'broken') {
    vessel(14, 11, 4, '#b98a62', 8);
    g.fillStyle = '#b98a62'; g.strokeStyle = OUT; g.lineWidth = 0.9;
    for (const [x, y, r] of [[-14, -3, 4], [14, -2, 3.4], [4, 3, 3]] as const) { g.beginPath(); g.moveTo(x - r, y); g.lineTo(x, y - r); g.lineTo(x + r, y + r * 0.5); g.closePath(); g.fill(); g.stroke(); }
    g.fillStyle = 'rgba(150,200,215,.7)'; g.beginPath(); g.ellipse(0, 3, 10, 3, 0, 0, Math.PI * 2); g.fill();
  } else { vessel(14, 11, 4, '#c5946a', 14); vessel(28, 9, 4, '#b98a62', 11); const t = P(0.3, 0.08, 17); dot(g, t, 2.2, '#4a3a22'); g.fillStyle = '#7ab0d0'; g.fillRect(t[0] - 0.8, t[1] + 2, 1.6, 4); }
});

registerPainter('plant', (g, _f, key) => {
  contactShadow(g, 1, 1, 0.2);
  box(g, -0.22, 0.22, -0.22, 0.22, 0, 14, { top: '#8a5a3a' });
  g.fillStyle = '#c0704a'; g.strokeStyle = OUT; g.lineWidth = 1; g.beginPath(); g.moveTo(-8, -14); g.lineTo(-6, -26); g.lineTo(6, -26); g.lineTo(8, -14); g.closePath(); g.fill(); g.stroke();
  const col = key === 'happy' ? '#4fc86a' : '#5f8f4a', n = key === 'happy' ? 9 : 6;
  g.strokeStyle = OUT; g.lineWidth = 1; g.fillStyle = col;
  for (let i = 0; i < n; i++) { const a = -Math.PI * 0.85 + (i / (n - 1)) * Math.PI * 0.7, L = (key === 'happy' ? 22 : 17) + (i % 2) * 5; g.beginPath(); g.moveTo(0, -26); g.quadraticCurveTo(Math.cos(a) * L * 0.5, -26 + Math.sin(a) * L * 0.9, Math.cos(a) * L, -26 + Math.sin(a) * L + 6); g.quadraticCurveTo(Math.cos(a) * L * 0.5 + 3, -26 + Math.sin(a) * L * 0.9 + 2, 0, -26); g.fill(); g.stroke(); }
  if (key === 'happy') { g.fillStyle = '#ffe06a'; for (const [x, y] of [[-10, -42], [8, -45]] as const) { g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill(); } }
});

registerPainter('houseTable', (g) => {
  contactShadow(g, 2, 2, 0.3);
  for (const [u, v] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]] as const) box(g, u - 0.07, u + 0.07, v - 0.07, v + 0.07, 0, 20, { top: WOOD_D });
  box(g, -1, 1, -1, 1, 20, 22, { top: '#9a6a44' });
  // toalha de chita escorrendo pelas bordas
  poly(g, [P(-1.04, 1.04, 22.4), P(1.04, 1.04, 22.4), P(1.04, 1.04, 12), P(-1.04, 1.04, 12)], '#e8c68a', OUT, 1);
  poly(g, [P(1.04, -1.04, 22.4), P(1.04, 1.04, 22.4), P(1.04, 1.04, 12), P(1.04, -1.04, 12)], '#c9a46a', OUT, 1);
  poly(g, [P(-1.04, -1.04, 22.4), P(1.04, -1.04, 22.4), P(1.04, 1.04, 22.4), P(-1.04, 1.04, 22.4)], '#f0d99a', OUT, 1);
  for (let i = 0; i < 9; i++) flower(g, P(-0.8 + (i % 3) * 0.8, -0.8 + Math.floor(i / 3) * 0.8, 22.6), 2.4, CHITA[i % 5]);
  for (let i = 0; i < 6; i++) { const p = P(-0.8 + i * 0.32, 1.04, 17); dot(g, p, 1.6, CHITA[(i + 2) % 5]); }
});

registerPainter('cake', (g, _f, key) => {
  g.fillStyle = '#f2ede0'; g.strokeStyle = OUT; g.lineWidth = 0.9; g.beginPath(); g.ellipse(0, -1, 13, 5.6, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#f0c868'; g.beginPath(); g.ellipse(0, -7, 9.4, 4.6, 0, 0, Math.PI * 2); g.fill(); g.fillRect(-9.4, -7, 18.8, 6); g.beginPath(); g.ellipse(0, -1.4, 9.4, 4.6, 0, 0, Math.PI); g.fill();
  g.strokeStyle = OUT; g.beginPath(); g.ellipse(0, -7, 9.4, 4.6, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#ffe9a8'; g.beginPath(); g.ellipse(0, -7, 6.8, 3, 0, 0, Math.PI * 2); g.fill();
  if (key === 'cut') { g.fillStyle = '#f2ede0'; g.beginPath(); g.moveTo(0, -7); g.lineTo(11, -9); g.lineTo(11, -2); g.closePath(); g.fill(); g.fillStyle = '#d8c09a'; g.fillRect(8, -5, 2, 2); }
});

registerPainter('chair', (g) => {
  contactShadow(g, 1, 1, 0.22);
  for (const [u, v] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]] as const) box(g, u - 0.05, u + 0.05, v - 0.05, v + 0.05, 0, 13, { top: WOOD_D });
  box(g, -0.34, 0.34, -0.34, 0.34, 13, 16, { top: '#d9b46a' });
  box(g, -0.34, 0.34, -0.34, -0.24, 16, 34, { top: '#a77a4e' });
  g.strokeStyle = '#6f4f34'; g.lineWidth = 1.2; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(...P(i * 0.12, -0.24, 18)); g.lineTo(...P(i * 0.12, -0.24, 32)); g.stroke(); }
});

registerPainter('cat', {
  base(g, _f, key) {
    if (key === 'gone') return;
    g.fillStyle = '#e8963a'; g.strokeStyle = OUT; g.lineWidth = 1;
    g.beginPath(); g.ellipse(0, -7, 10, 7.5, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.arc(7, -14, 6.4, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(3, -19); g.lineTo(4, -25); g.lineTo(8, -20); g.moveTo(9, -20); g.lineTo(12, -25); g.lineTo(13, -18); g.fill(); g.stroke();
    g.strokeStyle = '#b86a20'; g.lineWidth = 1.4; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-6 + i * 4, -12); g.lineTo(-5 + i * 4, -4); g.stroke(); }
    g.fillStyle = '#2a1a10'; g.fillRect(5, -15, 1.6, 1.4); g.fillRect(9.4, -15, 1.6, 1.4);
    g.fillStyle = '#ff9aa8'; g.beginPath(); g.arc(8.2, -12, 1, 0, Math.PI * 2); g.fill();
  },
  live(g, _f, key, t) {
    if (key === 'gone') return;
    g.strokeStyle = OUT; g.lineWidth = 3.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(-9, -4); g.quadraticCurveTo(-18, -4 + Math.sin(t * 2.4) * 4, -15, -16 + Math.sin(t * 2.4 + 1) * 3); g.stroke();
    g.strokeStyle = '#e8963a'; g.lineWidth = 1.8; g.stroke();
  },
});

registerPainter('cabinet', (g, _f, key) => {
  contactShadow(g, 1, 1, 0.26);
  box(g, -0.4, 0.4, -0.38, 0.38, 0, 54, { top: '#c9a574', left: '#b08a5a', right: '#8a6a44' });
  poly(g, [P(0.4, -0.3, 46), P(0.4, 0.3, 46), P(0.4, 0.3, 28), P(0.4, -0.3, 28)], key === 'open' || key === 'tin' ? '#2a1c12' : '#9a7648', OUT, 1);
  poly(g, [P(0.4, -0.3, 24), P(0.4, 0.3, 24), P(0.4, 0.3, 6), P(0.4, -0.3, 6)], '#9a7648', OUT, 1);
  if (key === 'open' || key === 'tin') {
    g.fillStyle = '#c9a574'; g.strokeStyle = OUT; g.lineWidth = 1; g.beginPath(); g.moveTo(...P(0.4, 0.3, 46)); g.lineTo(...P(0.74, 0.5, 46)); g.lineTo(...P(0.74, 0.5, 28)); g.lineTo(...P(0.4, 0.3, 28)); g.closePath(); g.fill(); g.stroke();
    const t = P(0.4, -0.05, 34); g.fillStyle = '#d8c070'; g.strokeStyle = OUT; g.beginPath(); g.ellipse(t[0], t[1], 6, 3, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#3f6fa8'; g.fillRect(t[0] - 4, t[1] - 5, 8, 5); if (key === 'tin') { dot(g, [t[0], t[1] - 6], 1.4, '#e8e0c0'); }
  }
  dot(g, P(0.41, 0.2, 38), 1.5, '#e8d0a0'); dot(g, P(0.41, 0.2, 15), 1.5, '#e8d0a0');
});

registerPainter('tv', {
  base(g, _f, key) {
    contactShadow(g, 1, 1, 0.26);
    box(g, -0.3, 0.3, -0.3, 0.3, 0, 12, { top: WOOD, left: '#8a6240', right: '#6a4a30' });
    box(g, -0.36, 0.36, -0.34, 0.34, 12, 38, { top: '#3a3a3a', left: '#2a2a2a', right: '#222' });
    poly(g, [P(0.36, -0.26, 35), P(0.36, 0.26, 35), P(0.36, 0.26, 17), P(0.36, -0.26, 17)], key === 'on' ? '#7fb4d8' : '#4a5258', OUT, 1);
    line(g, P(-0.1, -0.1, 38), P(-0.26, -0.3, 56), 1.4, '#c9c9c9'); line(g, P(-0.1, -0.1, 38), P(0.1, -0.3, 56), 1.4, '#c9c9c9');
    dot(g, P(0.37, 0.3, 30), 1.6, '#c9a45a');
  },
  live(g, _f, key, t) {
    const a = P(0.36, -0.26, 35), b = P(0.36, 0.26, 35), c = P(0.36, 0.26, 17), d = P(0.36, -0.26, 17);
    g.save(); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.clip();
    if (key === 'on') {
      g.fillStyle = '#f0c27a'; g.fillRect(a[0] - 4, a[1], 40, 20);
      g.fillStyle = '#c4553a'; g.beginPath(); g.arc(a[0] + 9, a[1] + 7, 3.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3f6fa8'; g.beginPath(); g.arc(a[0] + 17, a[1] + 8, 3.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgba(255,255,255,${0.12 + 0.08 * Math.sin(t * 6)})`; g.fillRect(a[0], a[1] + ((t * 20) % 16), 36, 2);
    } else {
      for (let i = 0; i < 16; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + 0.4 * Math.abs(Math.sin(t * 40 + i * 7.1))})`; g.fillRect(a[0] + ((i * 7 + t * 90) % 24), a[1] + ((i * 5) % 17), 3, 1.4); }
    }
    g.restore();
  },
});

// ───────────────────────────────────────────────────────────────────────── quarto
registerPainter('bed', (g) => {
  contactShadow(g, 2, 2, 0.3);
  box(g, -1, 1, -1, 1, 0, 12, { top: '#8a5a38', left: '#7a4e30', right: '#5e3a24' });
  box(g, -0.96, 0.96, -0.96, -0.82, 12, 34, { top: '#7a4e30' }); // cabeceira
  box(g, -0.94, 0.94, -0.92, 0.94, 12, 20, { top: '#efe6d0', left: '#e0d4b8', right: '#cbbf9e' });
  // colcha de retalhos em quadrados de chita
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const u0 = -0.9 + i * 0.45, v0 = -0.5 + j * 0.36;
    poly(g, [P(u0, v0, 20.4), P(u0 + 0.45, v0, 20.4), P(u0 + 0.45, v0 + 0.36, 20.4), P(u0, v0 + 0.36, 20.4)], CHITA[(i + j * 2) % 5], 'rgba(23,15,46,.5)', 0.6);
  }
  box(g, -0.8, 0.8, -0.88, -0.5, 20, 26, { top: '#fff4e0', left: '#e6dcc4', right: '#cfc4a8' }); // travesseiro
});

registerPainter('dresser', (g, _f, key) => {
  contactShadow(g, 1, 1, 0.26);
  box(g, -0.4, 0.4, -0.4, 0.4, 0, 34, { top: '#b58a58', left: '#9a7248', right: '#7a5636' });
  for (let i = 0; i < 3; i++) {
    const z1 = 32 - i * 10.5;
    const open = key === 'open' && i === 0;
    poly(g, [P(0.4, -0.34, z1), P(0.4, 0.34, z1), P(0.4, 0.34, z1 - 9), P(0.4, -0.34, z1 - 9)], open ? '#2a1c12' : '#a37e50', OUT, 1);
    if (open) { g.fillStyle = '#e8e0c8'; for (let k = 0; k < 3; k++) g.fillRect(...(P(0.56, -0.2 + k * 0.2, z1 - 4) as [number, number]), 5, 3); }
    dot(g, P(0.41, 0, z1 - 4.5), 1.4, '#e8d0a0');
  }
  box(g, -0.34, 0.34, -0.34, 0.34, 34, 36, { top: '#efe6d0' }); // paninho de crochê
});

registerPainter('piggy', (g, _f, key) => {
  if (key === 'gone') return;
  if (key === 'broken') {
    g.fillStyle = '#e8a0b0'; g.strokeStyle = OUT; g.lineWidth = 0.9;
    for (const [x, y, r] of [[-8, -2, 4], [6, -3, 4.4], [0, 0, 3.4], [11, 0, 3]] as const) { g.beginPath(); g.moveTo(x - r, y); g.lineTo(x, y - r); g.lineTo(x + r, y + r * 0.6); g.closePath(); g.fill(); g.stroke(); }
    g.fillStyle = '#ffd95a'; for (let i = 0; i < 6; i++) dot(g, [-10 + i * 4, 1 + (i % 2)], 1.8, '#ffd95a');
    return;
  }
  g.fillStyle = '#eb9fb2'; g.strokeStyle = OUT; g.lineWidth = 1;
  g.beginPath(); g.ellipse(0, -8, 11, 8, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(10, -8, 5, 4.4, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#c86a82'; g.beginPath(); g.ellipse(13, -8, 1.2, 2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#eb9fb2'; g.beginPath(); g.moveTo(5, -14); g.lineTo(6, -19); g.lineTo(10, -14); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = OUT; g.fillRect(8, -11, 1.6, 1.8); g.fillRect(-4, -15.5, 8, 1.4);
  for (const x of [-6, 4]) { g.fillStyle = '#d9849a'; g.fillRect(x, -2, 3, 3); }
});

registerPainter('trunk', (g, _f, key) => {
  contactShadow(g, 1, 2, 0.28);
  box(g, -0.4, 0.4, -0.9, 0.9, 0, 14, { top: '#8a5a38', left: '#7a4e30', right: '#5e3a24' });
  g.strokeStyle = '#c9a45a'; g.lineWidth = 2; for (const v of [-0.55, 0.55]) { g.beginPath(); g.moveTo(...P(0.4, v, 0)); g.lineTo(...P(0.4, v, 14)); g.stroke(); }
  if (key === 'open') {
    poly(g, [P(-0.4, -0.9, 14), P(0.4, -0.9, 14), P(0.4, -0.9, 32), P(-0.4, -0.9, 32)], '#7a4e30', OUT, 1);
    poly(g, [P(-0.34, -0.84, 14), P(0.34, -0.84, 14), P(0.34, 0.84, 14), P(-0.34, 0.84, 14)], '#f0e0b0');
    for (let i = 0; i < 4; i++) poly(g, [P(-0.3, -0.7 + i * 0.4, 14.4), P(0.3, -0.7 + i * 0.4, 14.4), P(0.3, -0.5 + i * 0.4, 14.4), P(-0.3, -0.5 + i * 0.4, 14.4)], CHITA[i], 'rgba(23,15,46,.4)', 0.5);
  } else poly(g, [P(-0.44, -0.94, 14), P(0.44, -0.94, 14), P(0.44, 0.94, 14), P(-0.44, 0.94, 14)], '#9a6a44', OUT, 1);
  dot(g, P(0.41, 0, 8), 1.8, '#e8d0a0');
});

registerPainter('chitaHammock', (g) => {
  contactShadow(g, 3, 1, 0.22);
  for (const u of [-1.42, 1.42]) { line(g, P(u, 0, 0), P(u, 0, 52), 5, OUT); line(g, P(u, 0, 0), P(u, 0, 52), 3, WOOD_D); }
  const zAt = (u: number, e: number) => 17 + (e > 0 ? -2 : 1) + Math.pow(u / 1.25, 2) * 15;
  const N = 10, us = Array.from({ length: N + 1 }, (_, i) => -1.25 + (2.5 * i) / N);
  g.strokeStyle = '#efe6c8'; g.lineWidth = 1.2;
  for (const [u, end] of [[-1.42, -1.25], [1.42, 1.25]] as const) for (const v of [-0.28, 0.28]) { g.beginPath(); g.moveTo(...P(u, 0, 48)); g.lineTo(...P(end, v, zAt(end, v))); g.stroke(); }
  g.beginPath(); us.forEach((u, i) => { const p = P(u, -0.28, zAt(u, -1)); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
  [...us].reverse().forEach((u) => { const p = P(u, 0.28, zAt(u, 1)); g.lineTo(p[0], p[1]); });
  g.closePath(); g.fillStyle = '#f0d27a'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.3; g.stroke();
  for (let i = 1; i < N; i++) { const u = us[i]; g.strokeStyle = CHITA[i % 5]; g.lineWidth = 2.2; g.beginPath(); g.moveTo(...P(u, -0.28, zAt(u, -1))); g.lineTo(...P(u, 0.28, zAt(u, 1))); g.stroke(); }
  g.beginPath(); us.forEach((u, i) => { const p = P(u, 0.28, zAt(u, 1)); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
  g.strokeStyle = '#c4553a'; g.lineWidth = 2.2; g.stroke();
});

registerPainter('hen', {
  base(g, _f, key) {
    if (key === 'gone') return;
    g.fillStyle = 'rgba(8,8,10,.25)'; g.beginPath(); g.ellipse(0, 1, 10, 4.4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f6f0e2'; g.strokeStyle = OUT; g.lineWidth = 1;
    g.beginPath(); g.ellipse(0, -9, 10, 8, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-9, -12); g.quadraticCurveTo(-18, -16, -14, -6); g.lineTo(-8, -6); g.fill(); g.stroke();
    g.fillStyle = '#d93a3a'; g.beginPath(); g.arc(8, -20, 2.4, 0, Math.PI * 2); g.arc(10.4, -19, 1.8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f6f0e2'; g.beginPath(); g.arc(9, -16, 4.4, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#e8a030'; g.beginPath(); g.moveTo(12.6, -16); g.lineTo(17, -14.6); g.lineTo(12.6, -13.4); g.fill();
    g.fillStyle = OUT; g.fillRect(9, -17.6, 1.4, 1.4);
    g.strokeStyle = '#e8a030'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-2, -1); g.lineTo(-2, 2); g.moveTo(3, -1); g.lineTo(3, 2); g.stroke();
  },
  live(g, _f, key, t) {
    if (key === 'gone') return;
    const k = Math.max(0, Math.sin(t * 3.2));
    g.fillStyle = '#d93a3a'; g.beginPath(); g.arc(8 + k * 3, -19 + k * 8, 1, 0, Math.PI * 2); g.fill();
  },
});

registerPainter('houseDoormat', (g) => {
  poly(g, [P(-0.42, -0.32, 2), P(0.42, -0.32, 2), P(0.42, 0.32, 2), P(-0.42, 0.32, 2)], '#a8483a', OUT, 1);
  poly(g, [P(-0.32, -0.22, 2.2), P(0.32, -0.22, 2.2), P(0.32, 0.22, 2.2), P(-0.32, 0.22, 2.2)], '#f0d27a');
  flower(g, P(0, 0, 2.6), 2.2, '#c4553a');
});
