/**
 * Vegetação de rio do lago e de Atlântida. As estáticas (sagitária, seixos, tronco, raízes de igapó,
 * esponja) entram no cache de decorações (`STATIC_BOUNDS`): pintadas uma vez numa imagem. As animadas
 * (vallisnéria, cabomba, aguapé, algas luminescentes) balançam girando peças assadas (≤ 3 `drawImage`
 * cada); o primeiro plano desfocado (estilo Rayman) é uma peça assada em baixa resolução e ampliada.
 */
import { bake, glowSprite, type Sprite } from '../kit';
import { Rng } from '../../core/math';

/** [x0, y0, x1, y1] relativos à base da decoração (y negativo = para cima). */
export const LAKE_BOUNDS: Record<string, [number, number, number, number]> = {
  lkSagit: [-44, -78, 44, 4],
  lkPebbles: [-40, -16, 40, 3],
  lkLog: [-74, -34, 74, 8],
  lkRoot: [-66, -6, 66, 170],
  lkSponge: [-28, -40, 28, 3],
  uVentLine: [-30, -14, 30, 3],
};

/** Só para o descarte (culling) das animadas: não entram no cache de imagens. */
export const LAKE_EXTENTS: Record<string, [number, number, number, number]> = {
  lkVallis: [-40, -150, 40, 6],
  lkCabomba: [-36, -100, 36, 6],
  lkAguape: [-40, -30, 40, 52],
  lkGlow: [-44, -90, 44, 6],
  lkFgWeed: [-130, -330, 130, 8],
};

const TAU = Math.PI * 2;

const pieces = new Map<string, Sprite>();
/** Peça assada uma vez (escala 2, ou menor para o desfoque do primeiro plano). */
function piece(key: string, w: number, h: number, ox: number, oy: number, fn: (g: CanvasRenderingContext2D) => void, scale = 2): Sprite {
  let s = pieces.get(key);
  if (!s) {
    s = bake(w, h, (g) => { g.translate(ox, oy); fn(g); }, { scale, ox, oy });
    pieces.set(key, s);
  }
  return s;
}

function put(g: CanvasRenderingContext2D, s: Sprite, rot = 0, alpha = 1) {
  g.save();
  if (rot) g.rotate(rot);
  if (alpha < 1) g.globalAlpha *= alpha;
  g.drawImage(s.c, -s.ox, -s.oy, s.w, s.h);
  g.restore();
}

/** Folha em forma de fita (vallisnéria): afina para a ponta, com nervura. */
function ribbon(g: CanvasRenderingContext2D, x: number, len: number, bend: number, w: number, a: string, b: string) {
  g.fillStyle = a;
  g.beginPath();
  g.moveTo(x - w / 2, 0);
  g.bezierCurveTo(x - w / 2 + bend * 0.2, -len * 0.4, x + bend * 0.7 - w * 0.2, -len * 0.75, x + bend, -len);
  g.bezierCurveTo(x + bend * 0.7 + w * 0.2, -len * 0.75, x + w / 2 + bend * 0.2, -len * 0.4, x + w / 2, 0);
  g.closePath();
  g.fill();
  g.strokeStyle = b;
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(x, 0);
  g.bezierCurveTo(x + bend * 0.2, -len * 0.4, x + bend * 0.65, -len * 0.75, x + bend, -len);
  g.stroke();
}

/** Pinta uma decoração do lago; devolve false se o tipo não é daqui. */
export function paintLake(g: CanvasRenderingContext2D, kind: string, seed: number, t: number): boolean {
  switch (kind) {
    case 'lkSagit': {
      // sagitária: hastes finas com folhas em ponta de flecha
      const r = new Rng(seed * 17 + 3);
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 14 + r.range(-4, 4);
        const h = r.range(40, 74);
        g.strokeStyle = '#2f7a3c';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, 2);
        g.quadraticCurveTo(x + r.range(-6, 6), -h * 0.5, x + r.range(-5, 5), -h);
        g.stroke();
        g.save();
        g.translate(x + r.range(-5, 5), -h);
        g.rotate(r.range(-0.4, 0.4));
        g.fillStyle = i % 2 ? '#3f9a4a' : '#4fae58';
        g.beginPath();
        g.moveTo(0, -14);
        g.lineTo(9, 3);
        g.lineTo(2.5, 0);
        g.lineTo(0, 7);
        g.lineTo(-2.5, 0);
        g.lineTo(-9, 3);
        g.closePath();
        g.fill();
        g.strokeStyle = '#1f5a2c';
        g.lineWidth = 0.7;
        g.stroke();
        g.restore();
      }
      return true;
    }
    case 'lkPebbles': {
      const r = new Rng(seed * 13 + 5);
      for (let i = 0; i < 11; i++) {
        const x = r.range(-34, 34), y = r.range(-8, 1), rx = r.range(3, 8), ry = rx * r.range(0.5, 0.75);
        g.fillStyle = r.pick(['#5d6a64', '#76827a', '#8a948a', '#4a5650']);
        g.beginPath();
        g.ellipse(x, y, rx, ry, 0, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,.18)';
        g.beginPath();
        g.ellipse(x - rx * 0.25, y - ry * 0.35, rx * 0.5, ry * 0.3, 0, 0, TAU);
        g.fill();
      }
      return true;
    }
    case 'lkLog': {
      // tronco submerso coberto de musgo, com um buraco escuro e fiapos de alga
      g.fillStyle = '#4a3a2a';
      g.beginPath();
      g.moveTo(-70, -2);
      g.quadraticCurveTo(-72, -22, -52, -24);
      g.lineTo(58, -26);
      g.quadraticCurveTo(76, -22, 72, -2);
      g.quadraticCurveTo(0, 8, -70, -2);
      g.closePath();
      g.fill();
      g.strokeStyle = '#2a1f16';
      g.lineWidth = 1.2;
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.28)';
      g.lineWidth = 1;
      for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(-60 + i * 16, -22); g.quadraticCurveTo(-56 + i * 16, -12, -62 + i * 16, -3); g.stroke(); }
      g.fillStyle = '#16100a';
      g.beginPath();
      g.ellipse(-62, -12, 6, 10, 0, 0, TAU);
      g.fill();
      const r = new Rng(seed + 91);
      for (let i = 0; i < 16; i++) {
        g.fillStyle = r.pick(['#3a6a46', '#4d7f55', '#6a9a62']);
        g.beginPath();
        g.ellipse(r.range(-50, 62), r.range(-27, -22), r.range(4, 10), r.range(1.4, 3), 0, 0, TAU);
        g.fill();
        if (i % 3 === 0) { g.strokeStyle = '#3a6a46'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(r.range(-40, 55), -24); g.quadraticCurveTo(r.range(-44, 58), -34, r.range(-40, 58), -42); g.stroke(); }
      }
      return true;
    }
    case 'lkRoot': {
      // raízes de igapó: descem da margem/teto (a base da decoração é o teto)
      const r = new Rng(seed * 29 + 11);
      for (let i = 0; i < 7; i++) {
        const x = r.range(-44, 44);
        const len = r.range(70, 160);
        g.strokeStyle = i % 2 ? '#4a3626' : '#5a4430';
        g.lineWidth = r.range(2.5, 6);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + r.range(-16, 16), len * 0.35, x + r.range(-22, 22), len * 0.7, x + r.range(-14, 14), len);
        g.stroke();
        g.strokeStyle = '#3a2a1c';
        g.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          const yy = len * (0.35 + k * 0.2);
          g.beginPath();
          g.moveTo(x + r.range(-6, 6), yy);
          g.lineTo(x + r.range(-18, 18), yy + r.range(10, 24));
          g.stroke();
        }
      }
      return true;
    }
    case 'lkSponge': {
      // esponja de água doce: galhinhos amarelo-esverdeados e furadinhos
      const r = new Rng(seed * 7 + 2);
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 9 + r.range(-3, 3);
        const h = r.range(18, 38);
        g.strokeStyle = r.pick(['#b8c26a', '#c9d27a', '#a4b45c']);
        g.lineWidth = r.range(5, 8);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x, 0);
        g.quadraticCurveTo(x + r.range(-6, 6), -h * 0.5, x + r.range(-5, 5), -h);
        g.stroke();
        g.fillStyle = 'rgba(70,84,30,.45)';
        for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + r.range(-2, 2), -r.range(2, h), 1, 0, TAU); g.fill(); }
      }
      return true;
    }
    case 'uVentLine': {
      // fileira de fendinhas no leito, de onde sobe uma cortina de bolhas (as bolhas vêm da simulação)
      g.fillStyle = '#233a40';
      for (const o of [-18, 0, 18]) {
        g.beginPath();
        g.ellipse(o, -1, 11, 5, 0, Math.PI, TAU);
        g.fill();
        g.fillStyle = '#0c1c22';
        g.beginPath();
        g.ellipse(o, -2, 6, 2.2, 0, 0, TAU);
        g.fill();
        g.fillStyle = '#233a40';
      }
      return true;
    }
    case 'lkVallis': {
      // vallisnéria: fitas longas; dois leques balançando em fases diferentes
      const a = piece('vallisA', 80, 156, 40, 150, (c) => {
        ribbon(c, -10, 120, -16, 5, '#3f9a46', '#2a6a32');
        ribbon(c, -2, 146, 10, 5.5, '#4fae56', '#2f7a3a');
        ribbon(c, 8, 100, 20, 5, '#5abb60', '#35823f');
      });
      const b = piece('vallisB', 80, 156, 40, 150, (c) => {
        ribbon(c, -14, 90, 18, 4.6, '#35893f', '#256030');
        ribbon(c, 4, 128, -14, 5.2, '#47a24f', '#2c7236');
      });
      const k = seed * 0.7;
      put(g, b, Math.sin(t * 1.1 + k) * 0.07 + 0.04);
      put(g, a, Math.sin(t * 0.9 + k + 1.7) * 0.06 - 0.03);
      return true;
    }
    case 'lkCabomba': {
      // cabomba: hastes plumosas, com folhinhas em leque
      const s = piece('cabomba', 72, 100, 36, 96, (c) => {
        const r = new Rng(31);
        for (let i = 0; i < 3; i++) {
          const x = (i - 1) * 14;
          const h = 70 + i * 12 - (i === 1 ? 0 : 14);
          c.strokeStyle = '#4a9a4a';
          c.lineWidth = 1.8;
          c.beginPath();
          c.moveTo(x, 0);
          c.quadraticCurveTo(x + r.range(-8, 8), -h * 0.5, x + r.range(-6, 6), -h);
          c.stroke();
          for (let k = 1; k < 9; k++) {
            const yy = -h * (k / 9);
            const ww = 11 * (1 - k / 11);
            c.strokeStyle = k % 2 ? '#62b862' : '#52a852';
            c.lineWidth = 1;
            for (let f = -3; f <= 3; f++) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + f * ww / 3, yy - 5 - Math.abs(f)); c.stroke(); }
          }
        }
      });
      const k = seed * 0.9;
      put(g, s, Math.sin(t * 1.3 + k) * 0.08);
      return true;
    }
    case 'lkAguape': {
      // aguapé: roseta flutuando na superfície e raízes penduradas (balançam separadas)
      const roots = piece('aguapeRoots', 70, 54, 35, 2, (c) => {
        c.strokeStyle = '#3a2f26';
        c.lineWidth = 1;
        const r = new Rng(8);
        for (let i = 0; i < 16; i++) {
          const x = r.range(-22, 22);
          c.beginPath();
          c.moveTo(x * 0.5, 0);
          c.quadraticCurveTo(x, 22, x * 1.15, r.range(30, 50));
          c.stroke();
        }
      });
      const rosette = piece('aguapeTop', 80, 40, 40, 30, (c) => {
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU;
          c.save();
          c.rotate(Math.sin(a) * 0.15);
          c.fillStyle = i % 2 ? '#6aae3a' : '#7bbf46';
          c.beginPath();
          c.ellipse(Math.cos(a) * 17, -Math.abs(Math.sin(a)) * 5 - 6, 13, 7, Math.cos(a) * 0.4, 0, TAU);
          c.fill();
          c.strokeStyle = '#3c6a22';
          c.lineWidth = 0.9;
          c.stroke();
          c.restore();
        }
        c.fillStyle = '#c9a6ee';
        for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(-8 + i * 5, -20 - (i % 2) * 3, 2.3, 4.2, i * 0.3 - 0.4, 0, TAU); c.fill(); }
        c.fillStyle = '#f4e27a';
        c.beginPath();
        c.arc(1, -20, 1.3, 0, TAU);
        c.fill();
      });
      const bob = Math.sin(t * 1.4 + seed) * 1.1;
      g.save();
      g.translate(0, bob);
      put(g, roots, Math.sin(t * 0.9 + seed * 1.3) * 0.12);
      put(g, rosette, Math.sin(t * 1.1 + seed) * 0.03);
      g.restore();
      return true;
    }
    case 'lkGlow': {
      // algas luminescentes: hastes com pontas que pulsam devagar
      const stems = piece('glowStems', 80, 94, 40, 90, (c) => {
        const r = new Rng(55);
        c.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const x = (i - 2.5) * 11;
          const h = r.range(44, 82);
          c.strokeStyle = i % 2 ? '#2a7f78' : '#2f9a8c';
          c.lineWidth = 2.4;
          c.beginPath();
          c.moveTo(x, 0);
          c.quadraticCurveTo(x + r.range(-9, 9), -h * 0.5, x + r.range(-7, 7), -h);
          c.stroke();
          c.fillStyle = '#9ff7e8';
          c.beginPath();
          c.arc(x + r.range(-7, 7), -h, 2.2, 0, TAU);
          c.fill();
        }
      });
      const glow = glowSprite('#5ff0d8', 32);
      const k = seed * 0.8;
      put(g, stems, Math.sin(t * 0.8 + k) * 0.05);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.28 + 0.16 * Math.sin(t * 0.7 + k);
      g.drawImage(glow.c, -44, -92, 88, 88);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      return true;
    }
    case 'lkFgWeed': {
      // primeiro plano desfocado: assada em 0,35× e ampliada (macia, mais barata que a nítida)
      const s = piece('fgWeed' + (Math.abs(seed) % 2), 260, 340, 130, 330, (c) => {
        const r = new Rng((Math.abs(seed) % 2) + 77);
        c.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
          const x = r.range(-100, 100);
          const h = r.range(220, 320);
          c.strokeStyle = i % 2 ? '#0a2c2a' : '#0c3632';
          c.lineWidth = r.range(9, 16);
          c.beginPath();
          c.moveTo(x, 0);
          c.bezierCurveTo(x + 36, -h * 0.35, x - 34, -h * 0.7, x + r.range(-24, 24), -h);
          c.stroke();
        }
      }, 0.35);
      put(g, s, Math.sin(t * 0.8 + seed) * 0.035, 0.92);
      return true;
    }
  }
  return false;
}
