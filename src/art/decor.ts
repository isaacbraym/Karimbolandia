/** Decoração de cenário (atrás e na frente do gameplay). Tudo procedural e barato. */
import { glowSprite, softDot } from './kit';
import { Rng, clamp } from '../core/math';
import type { DecoSpawn } from '../game/level';

const rngCache = new Map<string, Rng>();
const seedOf = (d: DecoSpawn) => Math.floor(d.x * 7.13 + d.y * 3.1);

function neon(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, flick: number) {
  const spr = glowSprite(color, 32);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.5 * flick;
  g.drawImage(spr.c, x - w * 0.6, y - h * 0.6, w * 2.2, h * 2.2);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

export function drawDeco(g: CanvasRenderingContext2D, d: DecoSpawn, t: number) {
  const s = d.scale ?? 1;
  const seed = seedOf(d);
  g.save();
  g.translate(d.x, d.y);
  if (d.flip) g.scale(-1, 1);
  g.scale(s, s);
  switch (d.kind) {
    case 'facade': {
      // painel de fachada atrás do gameplay (profundidade)
      const w = 128;
      const h = 192;
      const gr = g.createLinearGradient(0, -h, 0, 0);
      gr.addColorStop(0, '#2b2260');
      gr.addColorStop(1, '#1b1544');
      g.fillStyle = gr;
      g.fillRect(-w / 2, -h, w, h);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect(-w / 2, -h, w, 3);
      const r = new Rng(seed);
      for (let yy = -h + 14; yy < -12; yy += 20) {
        for (let xx = -w / 2 + 10; xx < w / 2 - 12; xx += 20) {
          const on = r.chance(0.42);
          g.fillStyle = on ? (r.chance(0.5) ? '#ffcf7a' : '#7feaff') : '#120d33';
          g.globalAlpha = on ? 0.55 + 0.25 * Math.sin(t * 2 + xx) * 0 : 0.85;
          g.fillRect(xx, yy, 12, 10);
        }
      }
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(w / 2 - 14, -h, 14, h);
      break;
    }
    case 'neonSign': {
      const flick = 0.8 + 0.2 * Math.sin(t * 12 + seed) * (Math.sin(t * 1.3 + seed) > 0.85 ? 0.3 : 1) + (Math.sin(t * 0.7 + seed) > 0.96 ? -0.6 : 0);
      const colors = ['#ff3fb4', '#39f0ff', '#b6ff3a', '#ffb83a'];
      const c = colors[seed & 3 & 3];
      g.fillStyle = '#12092e';
      g.fillRect(-22, -44, 44, 36);
      g.strokeStyle = c;
      g.lineWidth = 2;
      g.globalAlpha = clamp(flick, 0.2, 1);
      g.strokeRect(-19, -41, 38, 30);
      g.fillStyle = c;
      g.fillRect(-11, -33, 22, 3);
      g.fillRect(-11, -26, 15, 3);
      g.fillRect(-11, -19, 19, 3);
      g.globalAlpha = 1;
      neon(g, -20, -42, 40, 32, c, clamp(flick, 0, 1));
      g.fillStyle = '#12092e';
      g.fillRect(-2, -8, 4, 8);
      break;
    }
    case 'lampPost': {
      g.fillStyle = '#2c2560';
      g.fillRect(-2, -70, 4, 70);
      g.fillRect(-2, -70, 16, 3);
      g.fillStyle = '#ffe9a8';
      g.fillRect(8, -68, 10, 3);
      const spr = glowSprite('#ffd7a0', 32);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.55 + 0.1 * Math.sin(t * 3 + seed);
      g.drawImage(spr.c, -10, -90, 60, 60);
      g.globalAlpha = 0.14;
      g.beginPath();
      g.moveTo(9, -66);
      g.lineTo(17, -66);
      g.lineTo(46, 0);
      g.lineTo(-20, 0);
      g.closePath();
      g.fillStyle = '#ffd7a0';
      g.fill();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'banner': {
      // bandeira da Legião ondulando
      g.fillStyle = '#2c2560';
      g.fillRect(-1.5, -96, 3, 96);
      g.beginPath();
      g.moveTo(1.5, -94);
      const n = 8;
      for (let i = 0; i <= n; i++) g.lineTo(1.5 + i * 6.5, -94 + Math.sin(t * 4 + i * 0.7 + seed) * 3 + i * 0.4);
      for (let i = n; i >= 0; i--) g.lineTo(1.5 + i * 6.5, -62 + Math.sin(t * 4 + i * 0.7 + seed) * 3 + i * 0.4);
      g.closePath();
      g.fillStyle = '#b13a8c';
      g.fill();
      g.strokeStyle = '#170f2e';
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = '#ffb83a';
      g.beginPath();
      g.moveTo(16, -84);
      g.lineTo(30, -76);
      g.lineTo(16, -68);
      g.closePath();
      g.fill();
      break;
    }
    case 'steam': {
      g.fillStyle = '#3a3f55';
      g.fillRect(-7, -10, 14, 10);
      g.fillStyle = '#586082';
      g.fillRect(-9, -13, 18, 4);
      const puff = softDot('#dcd6ee', 16);
      for (let i = 0; i < 5; i++) {
        const ph = ((t * 0.9 + i * 0.2 + seed * 0.07) % 1);
        g.globalAlpha = (1 - ph) * 0.5;
        const r = 5 + ph * 15;
        g.drawImage(puff.c, -r + Math.sin(ph * 6 + i) * 4, -14 - ph * 46 - r, r * 2, r * 2);
      }
      g.globalAlpha = 1;
      break;
    }
    case 'pipes': {
      g.fillStyle = '#4a5074';
      for (let i = 0; i < 3; i++) {
        g.fillRect(-48, -34 - i * 9, 96, 6);
        g.fillStyle = 'rgba(255,255,255,0.14)';
        g.fillRect(-48, -34 - i * 9, 96, 1.6);
        g.fillStyle = '#4a5074';
      }
      g.fillStyle = '#2c3252';
      for (let x = -40; x <= 40; x += 26) g.fillRect(x, -44, 4, 40);
      g.fillStyle = '#e2384a';
      g.fillRect(30, -40, 8, 3);
      break;
    }
    case 'hologram': {
      const flick = 0.75 + 0.25 * Math.sin(t * 6 + seed);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5 * flick;
      const gr = g.createLinearGradient(0, -90, 0, -20);
      gr.addColorStop(0, 'rgba(60,240,255,0.55)');
      gr.addColorStop(1, 'rgba(60,240,255,0.08)');
      g.fillStyle = gr;
      g.fillRect(-34, -90, 68, 70);
      g.globalAlpha = 0.9 * flick;
      g.strokeStyle = '#7ff9ff';
      g.lineWidth = 1.2;
      g.strokeRect(-34, -90, 68, 70);
      for (let i = 0; i < 5; i++) {
        g.fillStyle = '#c8ffff';
        g.fillRect(-26, -82 + i * 12, 20 + ((i * 17 + Math.floor(t * 3)) % 24), 3);
      }
      g.fillStyle = '#ff8ad4';
      g.fillRect(-26, -84 + 60, 52, 3);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#3a3f55';
      g.fillRect(-10, -20, 20, 5);
      break;
    }
    case 'fireBarrel': {
      g.fillStyle = '#4a3a3a';
      g.fillRect(-9, -26, 18, 26);
      g.fillStyle = '#2a2020';
      g.fillRect(-9, -22, 18, 2);
      g.fillRect(-9, -12, 18, 2);
      const spr = glowSprite('#ff9a3a', 32);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const ph = (t * 3 + i * 0.25 + seed) % 1;
        g.globalAlpha = 1 - ph;
        const r = 9 - ph * 5;
        g.drawImage(spr.c, -r + Math.sin(t * 9 + i) * 3, -26 - ph * 26 - r, r * 2, r * 2.4);
      }
      g.globalAlpha = 0.35;
      g.drawImage(spr.c, -34, -60, 68, 68);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'plant': {
      const r = new Rng(seed);
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.32 + Math.sin(t * 1.4 + i + seed) * 0.05;
        const L = r.range(20, 44);
        g.strokeStyle = i % 2 ? '#3f8a3f' : '#2f6f38';
        g.lineWidth = 4;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(Math.cos(a) * L * 0.5, Math.sin(a) * L * 0.6, Math.cos(a + 0.5) * L, Math.sin(a + 0.5) * L * 0.6 + L * 0.2);
        g.stroke();
      }
      break;
    }
    case 'vine': {
      const r = new Rng(seed);
      g.strokeStyle = '#2f6f38';
      g.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 8;
        const L = r.range(30, 70);
        g.beginPath();
        g.moveTo(x, 0);
        g.quadraticCurveTo(x + Math.sin(t * 1.2 + i) * 4, L * 0.5, x + Math.sin(t * 1.2 + i + 1) * 3, L);
        g.stroke();
        g.fillStyle = '#4fa04a';
        for (let k = 1; k < 5; k++) g.fillRect(x + Math.sin(t * 1.2 + i + k) * 3 - 2, (L / 5) * k, 5, 3);
      }
      break;
    }
    case 'spotlight': {
      g.fillStyle = '#3a3f55';
      g.fillRect(-4, -8, 8, 8);
      g.globalCompositeOperation = 'lighter';
      const a = -Math.PI / 2 + Math.sin(t * 0.8 + seed) * 0.5;
      g.fillStyle = 'rgba(200,240,255,0.10)';
      g.beginPath();
      g.moveTo(0, -8);
      g.lineTo(Math.cos(a - 0.09) * 200, -8 + Math.sin(a - 0.09) * 200);
      g.lineTo(Math.cos(a + 0.09) * 200, -8 + Math.sin(a + 0.09) * 200);
      g.closePath();
      g.fill();
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'arrow': {
      const pulse = 0.6 + 0.4 * Math.sin(t * 5);
      g.fillStyle = '#12092e';
      g.fillRect(-16, -34, 32, 22);
      g.fillStyle = '#39f0ff';
      g.globalAlpha = pulse;
      g.beginPath();
      g.moveTo(-9, -26);
      g.lineTo(4, -26);
      g.lineTo(4, -30);
      g.lineTo(13, -23);
      g.lineTo(4, -16);
      g.lineTo(4, -20);
      g.lineTo(-9, -20);
      g.closePath();
      g.fill();
      g.globalAlpha = 1;
      g.fillStyle = '#12092e';
      g.fillRect(-1.5, -12, 3, 12);
      break;
    }
    case 'crateStack': {
      const cols = ['#a06a3c', '#8a5a30', '#b07a44'];
      const r = new Rng(seed);
      const stack = [[0, 0], [30, 0], [15, -28]];
      stack.forEach(([x, y], i) => {
        g.fillStyle = cols[i % 3];
        g.fillRect(x - 15, y - 28, 28, 28);
        g.strokeStyle = '#170f2e';
        g.lineWidth = 1.2;
        g.strokeRect(x - 15, y - 28, 28, 28);
        g.beginPath();
        g.moveTo(x - 15, y - 28);
        g.lineTo(x + 13, y);
        g.moveTo(x + 13, y - 28);
        g.lineTo(x - 15, y);
        g.stroke();
      });
      void r;
      break;
    }
    case 'wreckCar': {
      g.fillStyle = '#2c2148';
      g.beginPath();
      g.moveTo(-50, -4);
      g.lineTo(-44, -20);
      g.lineTo(-20, -24);
      g.lineTo(-8, -36);
      g.lineTo(28, -36);
      g.lineTo(44, -22);
      g.lineTo(52, -14);
      g.lineTo(52, -4);
      g.closePath();
      g.fill();
      g.strokeStyle = '#170f2e';
      g.lineWidth = 1.4;
      g.stroke();
      g.fillStyle = '#ff7a2a';
      g.globalAlpha = 0.5 + 0.3 * Math.sin(t * 9 + seed);
      g.fillRect(-10, -33, 30, 3);
      g.globalAlpha = 1;
      const spr = glowSprite('#ff9a3a', 32);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const ph = (t * 2.6 + i * 0.33 + seed) % 1;
        g.globalAlpha = (1 - ph) * 0.9;
        const r = 10 - ph * 5;
        g.drawImage(spr.c, -6 + i * 12 - r, -36 - ph * 30 - r, r * 2, r * 2.4);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'waterfall': {
      g.fillStyle = '#4a5074';
      g.fillRect(-10, -80, 20, 8);
      const gr = g.createLinearGradient(0, -72, 0, 0);
      gr.addColorStop(0, 'rgba(140,240,255,0.85)');
      gr.addColorStop(1, 'rgba(120,200,255,0.35)');
      g.fillStyle = gr;
      g.fillRect(-6, -72, 12, 72);
      g.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 6; i++) g.fillRect(-4 + (i % 3) * 3, -72 + ((t * 90 + i * 22) % 72), 1.6, 12);
      const puff = softDot('#dff8ff', 16);
      g.globalAlpha = 0.5;
      g.drawImage(puff.c, -20, -12, 40, 24);
      g.globalAlpha = 1;
      break;
    }
    case 'antenna': {
      g.strokeStyle = '#2c2560';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -90);
      g.stroke();
      g.lineWidth = 1.5;
      for (let y = -12; y > -88; y -= 14) {
        g.beginPath();
        g.moveTo(-8, y);
        g.lineTo(8, y);
        g.stroke();
      }
      g.fillStyle = Math.sin(t * 4 + seed) > 0 ? '#ff3a4a' : '#5a1020';
      g.beginPath();
      g.arc(0, -92, 2.2, 0, 6.3);
      g.fill();
      break;
    }
    case 'cables': {
      g.strokeStyle = '#1a1240';
      g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(-60, -60 - i * 6);
        g.quadraticCurveTo(0, -30 + i * 8 + Math.sin(t * 0.8 + i) * 2, 60, -60 - i * 6);
        g.stroke();
      }
      break;
    }
    case 'fgPillar': {
      const gr = g.createLinearGradient(-14, 0, 14, 0);
      gr.addColorStop(0, '#0e0a26');
      gr.addColorStop(0.5, '#1c1544');
      gr.addColorStop(1, '#0a071c');
      g.fillStyle = gr;
      g.fillRect(-14, -420, 28, 440);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect(-14, -420, 3, 440);
      g.fillStyle = '#0a071c';
      g.fillRect(-18, -20, 36, 20);
      break;
    }
    case 'fgCable': {
      g.strokeStyle = '#0b0820';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-90, -170);
      g.quadraticCurveTo(0, -110 + Math.sin(t * 0.7 + seed) * 3, 90, -170);
      g.stroke();
      break;
    }
    case 'fgLeaves': {
      const r = new Rng(seed);
      g.fillStyle = '#12301f';
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.34 + Math.sin(t * 1.1 + i) * 0.04;
        const L = r.range(40, 96);
        g.save();
        g.rotate(a + Math.PI / 2);
        g.beginPath();
        g.ellipse(0, -L / 2, 7, L / 2, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      break;
    }
    case 'fgFence': {
      g.strokeStyle = '#0d0a22';
      g.lineWidth = 1.6;
      for (let x = -64; x <= 64; x += 8) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, -40);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(-64, -34);
      g.lineTo(64, -34);
      g.moveTo(-64, -8);
      g.lineTo(64, -8);
      g.stroke();
      break;
    }
    default:
      break;
  }
  g.restore();
  void rngCache;
}
