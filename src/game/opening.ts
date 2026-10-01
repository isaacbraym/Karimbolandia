/**
 * Camada de tela da abertura narrada: faixas de cinema, legenda de época e o título "KARIMBO" que
 * bate na tela quando o narrador diz o nome. Tudo pré-desenhado uma vez (nada criado por quadro).
 */
import { bake, OUT, type Sprite } from '../art/kit';
import { OPEN_BEATS, NARR_LEN } from './narrator';

const DISPLAY = '"Lilita One", "Arial Black", Impact, sans-serif';
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class OpeningOverlay {
  private title: Sprite | null = null;
  private sub: Sprite | null = null;
  private cap: Sprite | null = null;
  private skipTxt: Sprite | null = null;

  prepare() {
    if (this.title) return;
    this.title = bake(
      300,
      60,
      (g, w, h) => {
        g.font = `400 52px ${DISPLAY}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.strokeStyle = OUT;
        g.lineWidth = 11;
        g.strokeText('KARIMBO', w / 2, h / 2 + 2);
        const gr = g.createLinearGradient(0, 6, 0, h - 6);
        gr.addColorStop(0, '#fff6c9');
        gr.addColorStop(0.45, '#ffd23a');
        gr.addColorStop(1, '#ff7a3a');
        g.fillStyle = gr;
        g.fillText('KARIMBO', w / 2, h / 2 + 2);
      },
      { scale: 3 }
    );
    this.sub = bake(
      230,
      20,
      (g, w, h) => {
        g.fillStyle = '#1f9b96';
        g.beginPath();
        g.moveTo(8, 1);
        g.lineTo(w - 1, 1);
        g.lineTo(w - 8, h - 1);
        g.lineTo(1, h - 1);
        g.closePath();
        g.fill();
        g.strokeStyle = OUT;
        g.lineWidth = 2;
        g.stroke();
        g.font = `400 13px ${DISPLAY}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = '#ffffff';
        g.fillText('— O HERÓI DO POVO —', w / 2, h / 2 + 1);
      },
      { scale: 3 }
    );
    this.cap = bake(
      250,
      26,
      (g, w, h) => {
        g.fillStyle = '#ffe27a';
        g.fillRect(1, 1, w - 2, h - 2);
        g.strokeStyle = OUT;
        g.lineWidth = 2.5;
        g.strokeRect(1, 1, w - 2, h - 2);
        g.font = `400 13px ${DISPLAY}`;
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillStyle = OUT;
        g.fillText('KARIMBOLÂNDIA, PLANETA CHUPAKU...', 10, h / 2 + 1);
      },
      { scale: 3, ox: 0, oy: 0 }
    );
    this.skipTxt = bake(
      150,
      16,
      (g, w, h) => {
        g.font = `400 11px ${DISPLAY}`;
        g.textAlign = 'right';
        g.textBaseline = 'middle';
        g.fillStyle = '#ffffff';
        g.fillText('aguarde a narração...', w - 2, h / 2);
      },
      { scale: 3, ox: 150, oy: 16 }
    );
  }

  draw(g: CanvasRenderingContext2D, W: number, H: number, t: number) {
    if (!this.title) this.prepare();
    const end = NARR_LEN[1];
    const out = clamp01((t - end) / 0.5);
    g.save();
    // faixas de cinema
    const lb = 26 * clamp01(t / 0.5) * (1 - out);
    g.fillStyle = '#000000';
    g.fillRect(0, 0, W, lb);
    g.fillRect(0, H - lb, W, lb);
    // legenda de época (enquanto a câmera passeia pelas ruínas)
    const ck = clamp01((t - 0.3) / 0.4) * (1 - clamp01((t - OPEN_BEATS.hero + 0.6) / 0.5));
    if (ck > 0.01) {
      const c = this.cap!;
      g.globalAlpha = ck;
      g.drawImage(c.c, 14, lb + 10, c.w, c.h);
    }
    // título no "Karimbo!"
    const nk = clamp01((t - OPEN_BEATS.name) / 0.22);
    if (nk > 0) {
      const ti = this.title!;
      const s = 1 + 0.9 * (1 - nk) * (1 - nk);
      g.globalAlpha = nk * (1 - out);
      g.drawImage(ti.c, W / 2 - (ti.w * s) / 2, H * 0.2 - (ti.h * s) / 2, ti.w * s, ti.h * s);
      const k2 = clamp01((t - OPEN_BEATS.name - 0.25) / 0.25);
      if (k2 > 0) {
        const su = this.sub!;
        g.globalAlpha = k2 * (1 - out);
        g.drawImage(su.c, W / 2 - su.w / 2 + (1 - k2) * 30, H * 0.2 + 30, su.w, su.h);
      }
    }
    if (t > 0.6 && out < 1) {
      const sk = this.skipTxt!;
      g.globalAlpha = (0.55 + 0.25 * Math.sin(t * 5)) * (1 - out);
      g.drawImage(sk.c, W - 10 - sk.w, H - 6 - sk.h, sk.w, sk.h);
    }
    g.restore();
  }
}
