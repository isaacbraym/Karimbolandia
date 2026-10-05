/**
 * Skin Jacaré: o chapéu de caça (a própria cabeça de um jacaré usada de fantasia, como troféu, no alto
 * da cabeça do Karimbo, entre as orelhas, sem cobrir o rosto) e o rabo. Assados uma vez junto com as
 * outras variantes de traje. O rosto continua sendo a foto; o chapéu só cobre o topo da cabeça.
 * Convenção do rig: o Karimbo olha para a DIREITA (o desenho espelha ao virar).
 */
import { bake, OUT, type Sprite } from './kit';
import { shade } from '../core/math';

export const GATOR_GREEN = '#5f8a45';
export const GATOR_DARK = '#3f6430';
export const GATOR_BELLY = '#e2d8a4';

/**
 * Cabeça de jacaré vista de lado, de ponta-cabeça sobre a cabeça do Karimbo: o crânio forma a cúpula
 * do chapéu, o focinho comprido aponta para a frente (direita) e a mandíbula superior mostra os dentes
 * na borda de baixo (a "aba"). Pivô: centro da base.
 */
export function bakeGatorHood(): Sprite {
  const W = 48, H = 24;
  return bake(W, H, (g) => {
    const base = H; // linha de base (onde o chapéu assenta)
    // crista de escamas do crânio (atrás)
    g.fillStyle = GATOR_DARK;
    g.strokeStyle = OUT;
    g.lineWidth = 0.9;
    for (let i = 0; i < 4; i++) {
      const x = 8 + i * 4.6;
      g.beginPath();
      g.moveTo(x, base - 12.5 - i * 0.4);
      g.lineTo(x + 2.4, base - 17.5 + i * 0.5);
      g.lineTo(x + 4.4, base - 12.5);
      g.closePath();
      g.fill();
      g.stroke();
    }
    // cúpula do crânio + focinho (um único contorno contínuo)
    const body = () => {
      g.beginPath();
      g.moveTo(5, base);
      g.bezierCurveTo(3, base - 8, 9, base - 17, 20, base - 17.5); // nuca → testa
      g.bezierCurveTo(27, base - 17, 31, base - 12.4, 38, base - 11.4); // testa → dorso do focinho
      g.bezierCurveTo(43, base - 10.8, 46.4, base - 9.2, 46.6, base - 6.6); // ponta do focinho
      g.bezierCurveTo(46.8, base - 4.2, 45, base - 2.6, 42, base - 2.4); // queixo da frente
      g.lineTo(5, base);
      g.closePath();
    };
    body();
    const gr = g.createLinearGradient(0, base - 18, 0, base);
    gr.addColorStop(0, shade(GATOR_GREEN, 0.18));
    gr.addColorStop(0.55, GATOR_GREEN);
    gr.addColorStop(1, GATOR_DARK);
    g.fillStyle = gr;
    g.fill();
    g.lineWidth = 1.1;
    g.strokeStyle = OUT;
    g.stroke();
    // escamas e brilho do focinho
    g.save();
    body();
    g.clip();
    g.strokeStyle = 'rgba(25,55,20,.55)';
    g.lineWidth = 0.6;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 9; c++) {
        const x = 9 + c * 4.1 + (r % 2) * 2, y = base - 14 + r * 3.6;
        g.beginPath();
        g.arc(x, y, 1.7, 0, Math.PI);
        g.stroke();
      }
    }
    g.fillStyle = 'rgba(255,255,255,.28)';
    g.beginPath();
    g.ellipse(30, base - 13.2, 9, 1.5, 0.12, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // olho saltado (a "bossa" de cima) com pupila de fenda
    g.fillStyle = shade(GATOR_GREEN, 0.1);
    g.beginPath();
    g.ellipse(25, base - 16.6, 4.6, 3.9, -0.15, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 0.9;
    g.strokeStyle = OUT;
    g.stroke();
    g.fillStyle = '#f2e27a';
    g.beginPath();
    g.ellipse(25.4, base - 16.4, 2.9, 2.5, -0.15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#10141a';
    g.beginPath();
    g.ellipse(26.2, base - 16.3, 0.8, 2.1, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.fillRect(24.2, base - 18, 1.1, 1.1);
    // narina na ponta do focinho
    g.fillStyle = OUT;
    g.beginPath();
    g.ellipse(43.8, base - 8.6, 1.1, 0.8, 0.3, 0, Math.PI * 2);
    g.fill();
    // fileira de dentes na borda de baixo do focinho (mandíbula de cima)
    g.fillStyle = '#fbf6e4';
    g.strokeStyle = OUT;
    g.lineWidth = 0.55;
    for (let i = 0; i < 9; i++) {
      const x = 16 + i * 3.2;
      const y0 = base - 1.2 - (x - 16) * 0.0 - (i > 5 ? (i - 5) * 0.22 : 0);
      g.beginPath();
      g.moveTo(x, y0);
      g.lineTo(x + 1.6, y0 + 2.6);
      g.lineTo(x + 3.1, y0);
      g.closePath();
      g.fill();
      g.stroke();
    }
    // faixa de costura na base (a aba do chapéu)
    g.strokeStyle = shade(GATOR_DARK, -0.25);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(6, base - 0.4);
    g.lineTo(15, base - 0.8);
    g.stroke();
  }, { scale: 3, ox: W / 2 - 4, oy: H });
}

/** Rabo de jacaré (preso à cintura, cai para trás e balança): pivô na raiz. */
export function bakeGatorTail(): Sprite {
  const W = 30, H = 12;
  return bake(W, H, (g) => {
    g.beginPath();
    g.moveTo(W, 2.4);
    g.bezierCurveTo(20, 1.4, 10, 3.2, 1.2, 8.8); // dorso até a ponta
    g.bezierCurveTo(5, 10.6, 15, 10.8, W, 9.6); // barriga
    g.closePath();
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, shade(GATOR_GREEN, 0.15));
    gr.addColorStop(0.6, GATOR_GREEN);
    gr.addColorStop(1, GATOR_BELLY);
    g.fillStyle = gr;
    g.fill();
    g.lineWidth = 1;
    g.strokeStyle = OUT;
    g.stroke();
    // espinhos do dorso
    g.fillStyle = GATOR_DARK;
    for (let i = 0; i < 5; i++) {
      const x = 5 + i * 5;
      const y = 2.6 + (W - x) * 0.0 + (1 - i / 5) * 3.8 - 0.4;
      g.beginPath();
      g.moveTo(x - 1.7, y + 0.9);
      g.lineTo(x, y - 2.4);
      g.lineTo(x + 1.7, y + 0.7);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }, { scale: 3, ox: W - 1, oy: 5.5 });
}
