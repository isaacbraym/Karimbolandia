/**
 * Filminho em quadrinhos antes do Felipão: painéis inclinados de HQ com closes dramáticos nos rostos
 * reais (fotos), linhas de ação, retícula, "VS", balões com texto datilografado e, no fim, o encarar
 * olho no olho. Desenhado em espaço de tela (lógico) por cima do mundo congelado.
 *
 * A linha do tempo é escrita na duração "base" (COMIC_LEN) e esticada/encolhida para caber na
 * entrada do chefe (a HQ termina junto com o áudio da entrada).
 */
import { getArt } from '../art';
import { audio, type ClipHandle } from '../core/audio';

const DISPLAY = '"Lilita One", "Arial Black", Impact, sans-serif';
/** duração base da linha do tempo (s) */
export const COMIC_LEN = 8.6;
/** batida em que a foto do Karimbo entra (a voz dele toca aqui) */
const VOICE_AT = 0.35;
const VOICE_LEN = 3.7;

const FELI_LINE = 'VOU TE ENSINAR A JOGAR DE VERDADE, KARIMBO!';
const KARI_LINE = 'PODE VIR, FELIPÃO!';

// enquadramentos nas fotos originais (px da imagem)
const K_FACE = { x: 70, y: 120, w: 380, h: 470 }; // Karimbo: rosto inteiro (512×668)
const K_EYES = { x: 110, y: 250, w: 320, h: 150 }; // Karimbo: faixa dos olhos
const F_FACE = { x: 170, y: 0, w: 280, h: 230 }; // Felipão: rosto (560×885)
const F_EYES = { x: 222, y: 30, w: 170, h: 70 }; // Felipão: faixa dos olhos

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeBack = (t: number) => {
  const x = clamp01(t);
  const c1 = 1.7;
  return 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

export class BossComic {
  /** tempo na linha do tempo base (0..COMIC_LEN) */
  t = 0;
  done = false;
  /** segundos reais por segundo da linha do tempo base */
  private k: number;
  private voice: ClipHandle | null = null;
  /** abafa/devolve o áudio da entrada enquanto o Karimbo fala */
  onVoice: ((talking: boolean) => void) | null = null;

  constructor(len = COMIC_LEN) {
    this.k = len / COMIC_LEN;
  }

  /** Sincroniza com o relógio do áudio da entrada (segundos reais desde o início da HQ). */
  syncTo(realT: number) {
    if (realT < 0) return;
    const bt = realT / this.k;
    if (Math.abs(bt - this.t) > 0.05) this.t = Math.max(0, bt);
  }

  /** Corta a voz (pulou a cena). */
  stopVoice(fade = 0.12) {
    this.voice?.stop(fade);
    this.voice = null;
  }
  private beats = new Set<string>();
  private dots: HTMLCanvasElement | null = null;
  private pat: CanvasPattern | null = null;
  private lastTyped = 0;

  private beat(id: string, at: number, fn: () => void) {
    if (this.t >= at && !this.beats.has(id)) {
      this.beats.add(id);
      fn();
    }
  }

  update(dt: number) {
    this.t += dt / this.k;
    this.beat('open', 0, () => audio.play('lock', 1));
    this.beat('k', VOICE_AT, () => {
      audio.play('slam', 0.7);
      // as fotos dos dois aparecem: o Karimbo fala
      this.voice = audio.playClip('karimboEncara', { vol: 1 });
      if (this.voice.playing) this.onVoice?.(true);
    });
    this.beat('kEnd', VOICE_AT + VOICE_LEN / this.k, () => this.onVoice?.(false));
    this.beat('f', 1.0, () => audio.play('slam', 0.8));
    this.beat('vs', 1.55, () => audio.play('bossRoar', 0.9));
    this.beat('burp', 4.3, () => audio.play('burpBig', 1));
    this.beat('eyes', 6.2, () => audio.play('laserCharge', 0.7));
    this.beat('end', COMIC_LEN - 0.3, () => audio.play('bigExplosion', 0.6));
    // datilografia
    const n = this.typed(FELI_LINE, 2.05, 2.1) + this.typed(KARI_LINE, 4.9, 1.0);
    if (n !== this.lastTyped) {
      this.lastTyped = n;
      if (n % 2 === 0) audio.play('uiClick', 0.35);
    }
    if (this.t >= COMIC_LEN) this.done = true;
  }

  private typed(s: string, start: number, dur: number) {
    return Math.floor(s.length * clamp01((this.t - start) / dur));
  }

  private halftone(g: CanvasRenderingContext2D) {
    if (!this.dots) {
      const c = document.createElement('canvas');
      c.width = c.height = 8;
      const d = c.getContext('2d')!;
      d.fillStyle = 'rgba(0,0,0,0.55)';
      d.beginPath();
      d.arc(4, 4, 1.5, 0, Math.PI * 2);
      d.fill();
      this.dots = c;
    }
    if (!this.pat) this.pat = g.createPattern(this.dots, 'repeat');
    return this.pat;
  }

  draw(g: CanvasRenderingContext2D, W: number, H: number) {
    const t = this.t;
    const ph = getArt().photos;
    const endK = clamp01((t - (COMIC_LEN - 0.45)) / 0.45); // flash final
    g.save();
    // escurece o mundo
    g.fillStyle = `rgba(6,2,18,${0.78 * clamp01(t / 0.3) * (1 - endK)})`;
    g.fillRect(0, 0, W, H);

    const stare = clamp01((t - 6.1) / 0.35); // transição para o close dos olhos
    if (stare < 1) this.drawPanels(g, W, H, ph, 1 - stare);
    if (stare > 0) this.drawStare(g, W, H, ph, stare);

    // legenda de abertura
    const cap = clamp01(t / 0.25) * (1 - clamp01((t - 2.2) / 0.3));
    if (cap > 0.01) {
      g.globalAlpha = cap;
      g.fillStyle = '#ffe27a';
      g.strokeStyle = '#170f2e';
      g.lineWidth = 3;
      g.fillRect(14, 12, 236, 30);
      g.strokeRect(14, 12, 236, 30);
      g.fillStyle = '#170f2e';
      g.font = `400 15px ${DISPLAY}`;
      g.textAlign = 'left';
      g.fillText('ENQUANTO ISSO, NO TELHADO...', 24, 33);
      g.globalAlpha = 1;
    }
    // dica de pular
    if (t > 0.8 && t < COMIC_LEN - 0.5) {
      g.globalAlpha = 0.55 + 0.25 * Math.sin(t * 5);
      g.fillStyle = '#ffffff';
      g.font = `400 11px ${DISPLAY}`;
      g.textAlign = 'right';
      g.fillText('toque / tiro para pular ▶', W - 12, H - 10);
      g.globalAlpha = 1;
    }
    // flash branco final
    if (endK > 0) {
      g.fillStyle = `rgba(255,255,255,${Math.sin(endK * Math.PI)})`;
      g.fillRect(0, 0, W, H);
    }
    g.restore();
  }

  /** Dois painéis inclinados se encarando + VS + balões. */
  private drawPanels(g: CanvasRenderingContext2D, W: number, H: number, ph: ReturnType<typeof getArt>['photos'], vis: number) {
    const t = this.t;
    const kIn = easeBack((t - 0.3) / 0.45);
    const fIn = easeBack((t - 0.95) / 0.45);
    const shake = t > 1.55 && t < 1.85 ? (Math.random() - 0.5) * 8 : 0;
    g.save();
    g.globalAlpha = vis;
    g.translate(shake, shake * 0.6);
    const mid = W * 0.5;
    const slant = W * 0.07;
    // painel do Karimbo (esquerda)
    if (t > 0.3) {
      const off = (1 - kIn) * -W * 0.7;
      this.panel(g, off, [
        [8, 50],
        [mid + slant - 10, 50],
        [mid - slant - 10, H - 22],
        [8, H - 22],
      ], '#2a78d8', '#5ab8ff', () => {
        const zoom = 1 + clamp01((t - 0.3) / 5.5) * 0.12;
        this.photo(g, ph.head, K_FACE, off + W * 0.25, H * 0.57, (H * 0.84) / K_FACE.h * zoom, false);
      });
    }
    // painel do Felipão (direita)
    if (t > 0.95) {
      const off = (1 - fIn) * W * 0.7;
      this.panel(g, off, [
        [mid + slant + 10, 50],
        [W - 8, 50],
        [W - 8, H - 22],
        [mid - slant + 10, H - 22],
      ], '#b0182f', '#ff6a3a', () => {
        const zoom = 1 + clamp01((t - 0.95) / 5) * 0.14;
        this.photo(g, ph.felipao, F_FACE, off + W * 0.76, H * 0.63, (H * 0.7) / F_FACE.h * zoom, false);
      });
    }
    // VS
    if (t > 1.55) {
      const k = easeBack((t - 1.55) / 0.35);
      g.save();
      g.translate(mid, H * 0.56);
      g.rotate(-0.12);
      g.scale(k, k);
      this.burst(g, 0, 0, 46, 62, 14, '#ffe27a', '#170f2e');
      g.fillStyle = '#e2384a';
      g.strokeStyle = '#170f2e';
      g.lineWidth = 6;
      g.font = `400 46px ${DISPLAY}`;
      g.textAlign = 'center';
      g.strokeText('VS', 0, 16);
      g.fillText('VS', 0, 16);
      g.restore();
    }
    // balão do Felipão (grito)
    if (t > 2.0) {
      const s = FELI_LINE.slice(0, this.typed(FELI_LINE, 2.05, 2.1));
      const k = easeBack((t - 2.0) / 0.25);
      this.bubble(g, W * 0.72, 74, Math.min(W * 0.46, 290), s, k, 'shout', W * 0.74, H * 0.62);
    }
    // resposta do Karimbo
    if (t > 4.8) {
      const s = KARI_LINE.slice(0, this.typed(KARI_LINE, 4.9, 1.0));
      const k = easeBack((t - 4.8) / 0.25);
      this.bubble(g, W * 0.26, H - 64, 190, s, k, 'talk', W * 0.24, H - 110);
    }
    g.restore();
  }

  /** Encarada final: faixas horizontais só com os olhos, com linhas de velocidade. */
  private drawStare(g: CanvasRenderingContext2D, W: number, H: number, ph: ReturnType<typeof getArt>['photos'], k: number) {
    const t = this.t;
    const sh = H * 0.38;
    const slideK = easeOut(k);
    const tremble = Math.sin(t * 60) * 1.2;
    g.save();
    // faixa de cima: Karimbo
    const y1 = H * 0.08;
    const x1 = (1 - slideK) * -W;
    this.panel(g, 0, [
      [x1 + 6, y1],
      [x1 + W - 6, y1],
      [x1 + W - 6, y1 + sh],
      [x1 + 6, y1 + sh],
    ], '#1a4aa0', '#5ab8ff', () => {
      this.photo(g, ph.head, K_EYES, x1 + W * 0.5 + tremble, y1 + sh * 0.5, (W * 0.96) / K_EYES.w, false);
    });
    // faixa de baixo: Felipão
    const y2 = H * 0.54;
    const x2 = (1 - slideK) * W;
    this.panel(g, 0, [
      [x2 + 6, y2],
      [x2 + W - 6, y2],
      [x2 + W - 6, y2 + sh],
      [x2 + 6, y2 + sh],
    ], '#8a0f22', '#ff6a3a', () => {
      this.photo(g, ph.felipao, F_EYES, x2 + W * 0.5 - tremble, y2 + sh * 0.5, (W * 0.96) / F_EYES.w, false);
    });
    // faísca entre os olhares
    if (k >= 1) {
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(255,240,160,${0.6 + 0.4 * Math.sin(t * 40)})`;
      g.lineWidth = 3;
      g.beginPath();
      let x = W * 0.2;
      g.moveTo(x, H * 0.5);
      while (x < W * 0.8) {
        x += 18;
        g.lineTo(x, H * 0.5 + (Math.random() - 0.5) * 14);
      }
      g.stroke();
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();
  }

  /** Painel com fundo de linhas de ação + retícula + moldura de HQ. */
  private panel(g: CanvasRenderingContext2D, off: number, pts: [number, number][], c0: string, c1: string, content: () => void) {
    g.save();
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x + off, y) : g.moveTo(x + off, y)));
    g.closePath();
    g.save();
    g.clip();
    // fundo: gradiente + linhas de ação radiais
    const xs = pts.map((p) => p[0] + off);
    const ys = pts.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const gr = g.createRadialGradient(cx, cy, 10, cx, cy, 360);
    gr.addColorStop(0, c1);
    gr.addColorStop(1, c0);
    g.fillStyle = gr;
    g.fillRect(Math.min(...xs) - 10, Math.min(...ys) - 10, Math.max(...xs) - Math.min(...xs) + 20, Math.max(...ys) - Math.min(...ys) + 20);
    g.strokeStyle = 'rgba(255,255,255,0.28)';
    g.lineWidth = 2;
    const rot = this.t * 0.4;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 + rot;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40);
      g.lineTo(cx + Math.cos(a) * 520, cy + Math.sin(a) * 520);
      g.stroke();
    }
    content();
    // retícula de HQ por cima
    const pat = this.halftone(g);
    if (pat) {
      g.globalAlpha *= 0.35;
      g.fillStyle = pat;
      g.fillRect(Math.min(...xs) - 10, Math.min(...ys) - 10, Math.max(...xs) - Math.min(...xs) + 20, Math.max(...ys) - Math.min(...ys) + 20);
    }
    g.restore();
    // moldura (refaz o contorno: as linhas de ação trocaram o caminho atual)
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x + off, y) : g.moveTo(x + off, y)));
    g.closePath();
    g.lineJoin = 'round';
    g.strokeStyle = '#170f2e';
    g.lineWidth = 8;
    g.stroke();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3.5;
    g.stroke();
    g.restore();
  }

  private photo(g: CanvasRenderingContext2D, img: HTMLImageElement, r: { x: number; y: number; w: number; h: number }, cx: number, cy: number, s: number, flip: boolean) {
    const w = r.w * s;
    const h = r.h * s;
    g.save();
    g.translate(cx, cy);
    if (flip) g.scale(-1, 1);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, r.x, r.y, r.w, r.h, -w / 2, -h / 2, w, h);
    g.restore();
  }

  /** Estrela de impacto (onomatopeia/VS). */
  private burst(g: CanvasRenderingContext2D, x: number, y: number, r0: number, r1: number, n: number, fill: string, ink: string) {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const r = i % 2 ? r0 : r1;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = ink;
    g.lineWidth = 4;
    g.stroke();
  }

  /** Balão de fala: 'shout' (serrilhado) ou 'talk' (arredondado), com rabicho até (tx, ty). */
  private bubble(g: CanvasRenderingContext2D, cx: number, cy: number, maxW: number, text: string, k: number, kind: 'shout' | 'talk', tx: number, ty: number) {
    if (k <= 0.01) return;
    g.save();
    g.translate(cx, cy);
    g.scale(k, k);
    g.font = `400 ${kind === 'shout' ? 17 : 15}px ${DISPLAY}`;
    // quebra de linha
    const words = (kind === 'shout' ? FELI_LINE : KARI_LINE).split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const wd of words) {
      const test = cur ? cur + ' ' + wd : wd;
      if (g.measureText(test).width > maxW - 30 && cur) {
        lines.push(cur);
        cur = wd;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    const lh = kind === 'shout' ? 20 : 18;
    const bw = Math.min(maxW, Math.max(...lines.map((l) => g.measureText(l).width)) + 34);
    const bh = lines.length * lh + 22;
    // rabicho
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#170f2e';
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(-14, bh / 2 - 6);
    g.lineTo((tx - cx) / k, (ty - cy) / k);
    g.lineTo(14, bh / 2 - 6);
    g.closePath();
    g.fill();
    g.stroke();
    // corpo
    g.beginPath();
    if (kind === 'shout') {
      const n = 22;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = i % 2 ? 1 : 1.12;
        const px = Math.cos(a) * (bw / 2) * rr;
        const py = Math.sin(a) * (bh / 2) * rr;
        if (i) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      g.closePath();
    } else {
      g.ellipse(0, 0, bw / 2, bh / 2, 0, 0, Math.PI * 2);
    }
    g.fill();
    g.stroke();
    // texto (datilografado): mostra só as letras já "digitadas", mantendo a quebra de linha
    g.fillStyle = kind === 'shout' ? '#b0182f' : '#170f2e';
    g.textAlign = 'left';
    let left = text.length;
    lines.forEach((l, i) => {
      const part = l.slice(0, Math.max(0, left));
      left -= l.length + 1;
      // alinhado pela linha completa: o texto não "anda" enquanto é digitado
      g.fillText(part, -g.measureText(l).width / 2, -((lines.length - 1) * lh) / 2 + i * lh + 6);
    });
    g.restore();
  }
}
