/**
 * Bloqueio do caminho de volta (depois de um checkpoint): na cidade, prédio desabado com lajes,
 * ferragens, cerca de arame e fita de "interditado"; na selva, árvore caída sobre pedras e cipós.
 */
import { bake, shadedRR, poly, glowSprite, OUT, type Sprite } from './kit';
import { Rng } from '../core/math';

const cache = new Map<number, Sprite>();

export function blockadeSprite(stage: number): Sprite {
  const hit = cache.get(stage);
  if (hit) return hit;
  const W = 170;
  const H = 230;
  const spr = bake(
    W,
    H,
    (g) => {
      g.translate(W / 2, H);
      const r = new Rng(stage * 13 + 5);
      if (stage === 2) {
        // pedras
        for (let i = 0; i < 9; i++) {
          const x = r.range(-70, 70);
          const y = -r.range(6, 60);
          g.fillStyle = i % 2 ? '#6f7a6a' : '#5a6458';
          g.beginPath();
          g.ellipse(x, y, r.range(18, 30), r.range(14, 22), r.range(-0.4, 0.4), 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = OUT;
          g.lineWidth = 1.2;
          g.stroke();
          g.fillStyle = 'rgba(92,154,56,0.75)';
          g.beginPath();
          g.ellipse(x - 4, y - 12, 12, 4, 0, 0, Math.PI * 2);
          g.fill();
        }
        // tronco gigante caído atravessado
        g.save();
        g.translate(0, -96);
        g.rotate(-1.15);
        shadedRR(g, -110, -22, 220, 44, 20, '#5a4030', { lw: 1.6 });
        g.fillStyle = '#b08a5a';
        g.beginPath();
        g.ellipse(110, 0, 10, 21, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#7a5a38';
        g.lineWidth = 1;
        for (const rr of [5, 10, 15]) {
          g.beginPath();
          g.ellipse(110, 0, rr * 0.6, rr * 1.3, 0, 0, Math.PI * 2);
          g.stroke();
        }
        g.restore();
        // cipós e folhas por cima
        g.strokeStyle = '#2e6a2e';
        g.lineWidth = 2.4;
        for (let i = 0; i < 5; i++) {
          const x = r.range(-60, 60);
          g.beginPath();
          g.moveTo(x, -r.range(150, 200));
          g.quadraticCurveTo(x + r.range(-20, 20), -100, x + r.range(-10, 10), -r.range(10, 40));
          g.stroke();
        }
        for (let i = 0; i < 16; i++) {
          g.save();
          g.translate(r.range(-70, 70), -r.range(20, 200));
          g.rotate(r.range(0, 6.28));
          g.fillStyle = i % 2 ? '#3f9446' : '#2f7a3a';
          g.beginPath();
          g.ellipse(6, 0, 9, 3.6, 0, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
      } else {
        // lajes de concreto empilhadas, tortas
        for (let i = 0; i < 6; i++) {
          g.save();
          g.translate(r.range(-40, 40), -14 - i * 30);
          g.rotate(r.range(-0.35, 0.35));
          shadedRR(g, -60, -14, 120, 26, 3, i % 2 ? '#6a6f8a' : '#5a5f7a', { lw: 1.4 });
          g.fillStyle = 'rgba(0,0,0,0.25)';
          for (let k = 0; k < 4; k++) g.fillRect(-50 + k * 28, -8, 3, 14);
          g.restore();
        }
        // ferragens retorcidas
        g.strokeStyle = '#8a4a2a';
        g.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const x = r.range(-60, 60);
          const y = -r.range(30, 180);
          g.beginPath();
          g.moveTo(x, y);
          g.quadraticCurveTo(x + r.range(-20, 20), y - 20, x + r.range(-30, 30), y - r.range(20, 40));
          g.stroke();
        }
        // cerca de arame
        g.strokeStyle = '#3a3f55';
        g.lineWidth = 3;
        for (const x of [-78, 78]) {
          g.beginPath();
          g.moveTo(x, 0);
          g.lineTo(x, -150);
          g.stroke();
        }
        g.strokeStyle = 'rgba(160,170,190,0.8)';
        g.lineWidth = 0.8;
        for (let y = -140; y < -10; y += 12) {
          g.beginPath();
          g.moveTo(-78, y);
          g.lineTo(78, y + 6);
          g.moveTo(-78, y + 6);
          g.lineTo(78, y);
          g.stroke();
        }
        // fita zebrada + placa
        g.save();
        g.translate(0, -96);
        g.rotate(-0.12);
        g.fillStyle = '#ffd23a';
        g.fillRect(-84, -5, 168, 10);
        g.fillStyle = '#1a1a1a';
        for (let x = -84; x < 84; x += 16) poly(g, [[x, -5], [x + 8, -5], [x + 2, 5], [x - 6, 5]], '#1a1a1a', { outline: null });
        g.restore();
        shadedRR(g, -34, -150, 68, 24, 2, '#e2384a', { lw: 1.4 });
        g.fillStyle = '#ffffff';
        g.font = '400 12px "Lilita One", Impact, sans-serif';
        g.textAlign = 'center';
        g.fillText('INTERDITADO', 0, -133);
      }
    },
    { scale: 2, ox: W / 2, oy: H }
  );
  cache.set(stage, spr);
  return spr;
}

// ------------------------------------------------------------------ desmoronamento
const fallCache = new Map<number, Sprite>();

/** Peça que desaba: pedaço de prédio em chamas (cidade) ou tronco rachado (selva). Pivô na base. */
export function collapseSprite(stage: number): Sprite {
  const hit = fallCache.get(stage);
  if (hit) return hit;
  const W = 90;
  const H = 300;
  const spr = bake(
    W,
    H,
    (g) => {
      g.translate(W / 2, H);
      const r = new Rng(stage * 7 + 3);
      if (stage === 2) {
        // tronco gigante já rachado, com a copa no alto
        shadedRR(g, -18, -250, 36, 252, 10, '#5a4030', { lw: 1.6 });
        g.fillStyle = '#7a5a40';
        g.fillRect(-14, -248, 8, 246);
        // rachadura (madeira clara aparecendo)
        g.strokeStyle = '#e0c08a';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(-17, -40);
        g.lineTo(-4, -52);
        g.lineTo(-10, -62);
        g.lineTo(6, -74);
        g.lineTo(17, -70);
        g.stroke();
        g.strokeStyle = '#2a1a10';
        g.lineWidth = 1.2;
        g.stroke();
        for (let i = 0; i < 9; i++) {
          g.fillStyle = r.pick(['#2f7a3a', '#3f9446', '#4fa64e']);
          g.beginPath();
          g.arc(r.range(-42, 42), -250 - r.range(0, 46), r.range(16, 26), 0, Math.PI * 2);
          g.fill();
        }
        g.strokeStyle = '#2e6a2e';
        g.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const x = r.range(-14, 14);
          g.beginPath();
          g.moveTo(x, -240);
          g.quadraticCurveTo(x + 10, -160, x - 4, r.range(-120, -60));
          g.stroke();
        }
      } else {
        // pedaço de prédio: parede de concreto com janelas quebradas, ferragens e fogo no alto
        shadedRR(g, -40, -280, 80, 282, 2, '#4a4f6e', { lw: 1.6 });
        for (let y = -266; y < -20; y += 30) {
          for (const x of [-30, 4]) {
            g.fillStyle = r.chance(0.5) ? '#ff9a3a' : '#120d33';
            g.fillRect(x, y, 24, 18);
            g.fillStyle = 'rgba(0,0,0,0.35)';
            g.fillRect(x, y + 14, 24, 4);
          }
        }
        g.strokeStyle = '#1a1830';
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(-40, -120);
        g.lineTo(-10, -132);
        g.lineTo(6, -118);
        g.lineTo(40, -140);
        g.stroke();
        g.strokeStyle = '#8a4a2a';
        g.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const x = r.range(-34, 34);
          g.beginPath();
          g.moveTo(x, -280);
          g.lineTo(x + r.range(-8, 8), -300);
          g.stroke();
        }
      }
    },
    { scale: 2, ox: W / 2, oy: H }
  );
  fallCache.set(stage, spr);
  return spr;
}

/** Duração das etapas: tremendo → desabando → impacto. */
export const COLLAPSE_SHAKE = 0.9;
export const COLLAPSE_FALL = 0.5;

/**
 * Desenha o bloqueio: durante a animação, a peça treme (com poeira/fagulhas vindas da simulação) e
 * cai girando sobre a base; depois do impacto fica a pilha de escombros. Na cidade, o fogo continua
 * ardendo nos escombros.
 */
export function drawBlockade(g: CanvasRenderingContext2D, stage: number, x: number, y: number, animT: number, time: number) {
  const pile = blockadeSprite(stage);
  const T1 = COLLAPSE_SHAKE;
  const T2 = COLLAPSE_SHAKE + COLLAPSE_FALL;
  const px = x + 46; // pivô da peça (cai para trás, por cima do caminho de volta)
  if (animT >= 0 && animT < T2) {
    const p = collapseSprite(stage);
    let rot = 0;
    let sx = 0;
    if (animT < T1) {
      const k = animT / T1;
      sx = Math.sin(time * 70) * (1 + k * 3);
      rot = Math.sin(time * 40) * 0.02 * k;
    } else {
      const k = (animT - T1) / COLLAPSE_FALL;
      rot = -1.42 * k * k; // acelera ao cair
    }
    g.save();
    g.translate(px + sx, y + 4);
    g.rotate(rot);
    g.drawImage(p.c, -p.ox, -p.oy, p.w, p.h);
    if (stage !== 2) {
      // fogo no alto do prédio enquanto desaba
      fireAt(g, 0, -282, time, 22);
    }
    g.restore();
  } else {
    g.drawImage(pile.c, x - pile.ox, y - pile.oy + 6, pile.w, pile.h);
  }
  if (stage !== 2 && (animT < 0 || animT >= T2)) {
    // os escombros seguem pegando fogo
    fireAt(g, x - 36, y - 40, time, 12);
    fireAt(g, x + 22, y - 74, time + 1.3, 9);
  }
}

function fireAt(g: CanvasRenderingContext2D, x: number, y: number, t: number, size: number) {
  const glow = glowSprite('#ff8a3a', 32);
  const core = glowSprite('#ffe27a', 32);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.4 + 0.1 * Math.sin(t * 9);
  g.drawImage(glow.c, x - size * 3, y - size * 3.4, size * 6, size * 6);
  for (let i = 0; i < 3; i++) {
    const ph = t * 8 + i * 2.1;
    const h = size * (1.7 + 0.5 * Math.sin(ph));
    const ox = Math.sin(ph * 1.3) * size * 0.3;
    g.globalAlpha = 0.85;
    g.drawImage(glow.c, x + ox - size * 0.7, y - h, size * 1.4, h * 1.1);
    g.globalAlpha = 0.9;
    g.drawImage(core.c, x + ox - size * 0.35, y - h * 0.6, size * 0.7, h * 0.65);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}
