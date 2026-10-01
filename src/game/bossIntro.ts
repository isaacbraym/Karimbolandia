/**
 * Entrada dramática do Felipão (primeira vez da partida), guiada pelo áudio da entrada (~15,7 s):
 *   0 → 4 s   suspense: tela escurece, céu/luzes piscam, tremor crescente, sombra enorme, poeira,
 *             holofotes procurando e faixa de ALERTA (o Felipão ainda não aparece)
 *   ≈ 4 s     revelação: cai do céu, o chão racha, onda de choque, câmera em zoom lento, reator e
 *             canhões acendendo, título
 *   ≈ 7,8 s   HQ dos dois se encarando (o grito do Felipão acompanha o resto do áudio dele)
 *   ≈ 15,7 s  o áudio do chefe acaba e a voz do Karimbo entra logo em seguida ("PODE VIR, FELIPÃO!"
 *             e o close dos olhos) — as duas vozes nunca tocam juntas
 *   ≈ 19,7 s  fim da voz: música do chefe e a luta começa
 * Sem áudio (testes/sem som) tudo roda por tempo. A simulação fica no Director; aqui só há
 * constantes e o desenho em espaço de tela (tudo pré-desenhado uma vez).
 */
import { bake, softDot, OUT, type Sprite } from '../art/kit';

/** duração do áudio da entrada (s) */
export const INTRO_LEN = 15.7;
/** o Felipão começa a cair do céu */
export const INTRO_DROP = 3.45;
/** a HQ começa (pausa no áudio) */
export const INTRO_COMIC = 7.8;
/** voz do Karimbo (karimbo_encara, 3,7 s), logo depois do áudio do chefe */
export const KARIMBO_VOICE_LEN = 3.7;
/** dentro da HQ (tempo real): quando o áudio do chefe acaba e o Karimbo começa a falar */
export const INTRO_VOICE_AT = INTRO_LEN - INTRO_COMIC;
/** duração da HQ dentro da entrada (resto do áudio do chefe + voz do Karimbo + respiro) */
export const INTRO_COMIC_LEN = INTRO_VOICE_AT + KARIMBO_VOICE_LEN + 0.3;
/** duração total da entrada */
export const INTRO_TOTAL = INTRO_COMIC + INTRO_COMIC_LEN;

const DISPLAY = '"Lilita One", "Arial Black", Impact, sans-serif';
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Camada de tela da entrada (letterbox, escurecer, holofotes, sombra, ALERTA, título). */
export class IntroOverlay {
  private band: Sprite | null = null;
  private title: Sprite | null = null;
  private sub: Sprite | null = null;
  private skipTxt: Sprite | null = null;
  private beam: Sprite | null = null;
  crack: Sprite | null = null;

  /** Pré-desenha tudo (chamado no carregamento, depois das fontes). */
  prepare() {
    if (this.band) return;
    // faixa de ALERTA: listras de perigo + texto (um segmento que se repete rolando)
    this.band = bake(
      220,
      24,
      (g, w, h) => {
        g.fillStyle = '#1a0610';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#ffd23a';
        for (let x = -h; x < w + h; x += 16) {
          g.beginPath();
          g.moveTo(x, h);
          g.lineTo(x + 8, h);
          g.lineTo(x + 8 + h * 0.5, 0);
          g.lineTo(x + h * 0.5, 0);
          g.closePath();
          g.globalAlpha = 0.85;
          g.fill();
        }
        g.globalAlpha = 1;
        g.fillStyle = '#c0102a';
        g.fillRect(36, 2, 148, h - 4);
        g.strokeStyle = OUT;
        g.lineWidth = 1.5;
        g.strokeRect(36, 2, 148, h - 4);
        g.font = `400 15px ${DISPLAY}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = '#ffffff';
        g.fillText('⚠ ALERTA ⚠', 110, h / 2 + 1);
      },
      { scale: 3, ox: 0, oy: 0 }
    );
    this.title = bake(
      300,
      56,
      (g, w, h) => {
        g.font = `400 46px ${DISPLAY}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.strokeStyle = OUT;
        g.lineWidth = 10;
        g.strokeText('FELIPÃO', w / 2, h / 2 + 2);
        const gr = g.createLinearGradient(0, 6, 0, h - 6);
        gr.addColorStop(0, '#fff2a0');
        gr.addColorStop(0.5, '#ffb83a');
        gr.addColorStop(1, '#ff4a2a');
        g.fillStyle = gr;
        g.fillText('FELIPÃO', w / 2, h / 2 + 2);
      },
      { scale: 3 }
    );
    this.sub = bake(
      240,
      22,
      (g, w, h) => {
        g.fillStyle = '#e2384a';
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
        g.font = `400 14px ${DISPLAY}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = '#ffffff';
        g.fillText('— O CHEFE DA LEGIÃO —', w / 2, h / 2 + 1);
      },
      { scale: 3 }
    );
    this.skipTxt = bake(
      150,
      16,
      (g, w, h) => {
        g.font = `400 11px ${DISPLAY}`;
        g.textAlign = 'right';
        g.textBaseline = 'middle';
        g.fillStyle = '#ffffff';
        g.fillText('toque / tiro para pular ▶', w - 2, h / 2);
      },
      { scale: 3, ox: 150, oy: 16 }
    );
    // facho de holofote (cone vertical que sai da base)
    this.beam = bake(
      80,
      300,
      (g, w, h) => {
        const gr = g.createLinearGradient(0, h, 0, 0);
        gr.addColorStop(0, 'rgba(255,250,220,0.9)');
        gr.addColorStop(0.6, 'rgba(200,230,255,0.25)');
        gr.addColorStop(1, 'rgba(200,230,255,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(w / 2 - 3, h);
        g.lineTo(w / 2 + 3, h);
        g.lineTo(w, 0);
        g.lineTo(0, 0);
        g.closePath();
        g.fill();
      },
      { scale: 1, ox: 40, oy: 300 }
    );
    // rachaduras do pouso (decalque no chão, com brilho de calor por baixo)
    this.crack = bake(
      220,
      18,
      (g, w) => {
        const draw = (lw: number, col: string) => {
          g.strokeStyle = col;
          g.lineWidth = lw;
          g.beginPath();
          const cx = w / 2;
          for (const s of [-1, 1]) {
            g.moveTo(cx, 1);
            let x = cx;
            let y = 1;
            for (let i = 0; i < 7; i++) {
              x += s * (12 + ((i * 7) % 5) * 2);
              y = 1 + ((i * 5 + (s > 0 ? 3 : 0)) % 6) * 1.6 + i * 0.6;
              g.lineTo(x, y);
              if (i === 2 || i === 4) {
                g.moveTo(x, y);
                g.lineTo(x + s * 8, y + 6);
                g.moveTo(x, y);
              }
            }
          }
          g.stroke();
        };
        draw(4, 'rgba(255,120,40,0.55)');
        draw(1.6, '#12060e');
      },
      { scale: 2, ox: 110, oy: 1 }
    );
    // sombra gigante (cache compartilhado; assada já no carregamento)
    softDot('#000000', 64);
  }

  /**
   * t: tempo da entrada; landT: quando o Felipão pousou (−1 = ainda não). Desenha por cima do mundo,
   * em espaço de tela lógico. Sem alocação: só drawImage/fillRect.
   */
  draw(g: CanvasRenderingContext2D, W: number, H: number, t: number, landT: number) {
    if (!this.band) this.prepare();
    const sus = clamp01(t / INTRO_DROP); // 0..1 suspense
    const out = clamp01((t - (INTRO_COMIC - 0.4)) / 0.4);
    g.save();
    // escurece (mais forte no suspense; a revelação "acende" a cena)
    const dark = landT < 0 ? 0.25 + 0.4 * sus : Math.max(0.12, 0.6 - (t - landT) * 0.8);
    g.fillStyle = '#060212';
    g.globalAlpha = dark;
    g.fillRect(0, 0, W, H);
    // alarme vermelho pulsando
    if (landT < 0) {
      const pulse = Math.sin(t * 7.5) > 0.2 ? 1 : 0;
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.1 * pulse * (0.4 + sus);
      g.fillStyle = '#ff2030';
      g.fillRect(0, 0, W, H);
      // holofotes procurando no céu
      const bm = this.beam!;
      g.globalAlpha = 0.28 + 0.12 * sus;
      for (let i = 0; i < 2; i++) {
        const bx = i === 0 ? W * 0.16 : W * 0.84;
        const ang = (i === 0 ? 0.35 : -0.35) + Math.sin(t * (1.3 + i * 0.4) + i * 2) * 0.55;
        g.save();
        g.translate(bx, H + 10);
        g.rotate(ang);
        g.drawImage(bm.c, -bm.ox * 1.4, -bm.oy * 1.5, bm.w * 1.4, bm.h * 1.5);
        g.restore();
      }
      g.globalCompositeOperation = 'source-over';
      // sombra enorme passando por cima (algo gigante sobrevoando)
      const sh = softDot('#000000', 64);
      for (let i = 0; i < 2; i++) {
        const t0 = i === 0 ? 1.1 : 2.75;
        const dur = i === 0 ? 1.5 : 0.75;
        const k = (t - t0) / dur;
        if (k > 0 && k < 1) {
          const x = W * (1.35 - 1.7 * k);
          g.globalAlpha = 0.6 * Math.sin(k * Math.PI);
          g.drawImage(sh.c, x - W * 0.55, -H * 0.12, W * 1.1, H * 0.8);
        }
      }
      // faixa de ALERTA rolando
      const band = this.band!;
      const bk = clamp01(t / 0.35) * (1 - clamp01((t - INTRO_DROP + 0.2) / 0.3));
      if (bk > 0.01) {
        const y = H * 0.17;
        const off = -((t * 90) % band.w);
        g.globalAlpha = bk;
        for (let x = off; x < W; x += band.w) g.drawImage(band.c, x, y, band.w, band.h);
      }
    }
    // título na revelação
    if (landT >= 0) {
      const k = clamp01((t - landT - 0.35) / 0.3);
      if (k > 0) {
        const fade = 1 - out;
        const s = 1 + 0.6 * (1 - k) * (1 - k);
        const ti = this.title!;
        g.globalAlpha = k * fade;
        const tw = ti.w * s;
        const th = ti.h * s;
        g.drawImage(ti.c, W / 2 - tw / 2, H * 0.17 - th / 2, tw, th);
        const k2 = clamp01((t - landT - 0.65) / 0.25);
        if (k2 > 0) {
          const su = this.sub!;
          g.globalAlpha = k2 * fade;
          g.drawImage(su.c, W / 2 - su.w / 2 + (1 - k2) * 40, H * 0.17 + 26, su.w, su.h);
        }
      }
    }
    // letterbox de cinema
    const lb = 26 * clamp01(t / 0.45);
    g.globalAlpha = 1;
    g.fillStyle = '#000000';
    g.fillRect(0, 0, W, lb);
    g.fillRect(0, H - lb, W, lb);
    if (t > 0.6) {
      const sk = this.skipTxt!;
      g.globalAlpha = 0.55 + 0.25 * Math.sin(t * 5);
      g.drawImage(sk.c, W - 10 - sk.w, H - 6 - sk.h, sk.w, sk.h);
    }
    // flash de transição para a HQ
    if (out > 0) {
      g.globalAlpha = Math.sin(out * Math.PI) * 0.9;
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, W, H);
    }
    g.restore();
  }
}
