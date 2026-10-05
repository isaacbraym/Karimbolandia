/**
 * Papel de carta do filminho (assado uma vez por tamanho de tela): mesa, folha com pauta, vincos,
 * mancha de café, beijo de batom e rabiscos nas margens (um desenho do Karimbo de orelhas gigantes — sem
 * desenhar a Júlia). O texto de cada página vira uma imagem à parte, escrita com a letra de mão
 * Caveat (carregada só aqui, com `FontFace`; sem ela cai em "Comic Sans MS"/cursiva). A "escrita"
 * revela a imagem do texto linha a linha: nenhum texto, canvas ou fonte é criado durante a leitura.
 */
import { makeCanvas } from '../../kit';
import { LETTER_PAGES } from '../../../game/minigames/chase/sim/letterFilm';
import caveatUrl from '@fontsource/caveat/files/caveat-latin-400-normal.woff2?url';

const STACK = '"Caveat","Comic Sans MS","Segoe Print",cursive';
let fontP: Promise<boolean> | null = null;

/** Carrega a Caveat (uma vez). Nunca rejeita: sem a fonte, a carta usa a cursiva do sistema. */
export function ensureLetterFont(): Promise<boolean> {
  if (fontP) return fontP;
  fontP = (async () => {
    try {
      if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return false;
      const f = new FontFace('Caveat', `url(${caveatUrl}) format("woff2")`);
      const ok = await Promise.race([f.load().then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 2500))]);
      if (ok) document.fonts.add(f);
      return ok;
    } catch { return false; }
  })();
  return fontP;
}

export interface LetterLine { y: number; h: number; w: number; start: number; end: number; prefixW: number[] }
export interface PageBake { text: HTMLCanvasElement; lines: LetterLine[]; total: number }
export interface PaperLayout { x: number; y: number; w: number; h: number; scale: number }

function rng(seed: number) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class LetterPaper {
  readonly layout: PaperLayout;
  readonly bg: HTMLCanvasElement;
  readonly pages: PageBake[] = [];
  readonly fontPx: number;
  private k: number;

  constructor(readonly W: number, readonly H: number, dpr = 2) {
    this.k = dpr;
    const w = Math.min(W * 0.92, 980), h = H * 0.76;
    this.layout = { x: (W - w) / 2, y: H * 0.035, w, h, scale: 1 };
    this.fontPx = this.fit();
    this.bg = this.bakeBg();
    for (let i = 0; i < LETTER_PAGES.length; i++) this.pages.push(this.bakePage(i));
  }

  private ctx2() { const c = makeCanvas(8, 8).getContext('2d')!; return c; }

  /** maior tamanho de letra em que as DUAS páginas cabem na folha */
  private fit(): number {
    const m = this.ctx2(), L = this.layout;
    const innerW = L.w - 44, innerH = L.h - 34;
    for (let px = Math.min(30, Math.round(this.H * 0.07)); px >= 11; px--) {
      m.font = `${px}px ${STACK}`;
      let ok = true;
      for (const page of LETTER_PAGES) {
        let rows = 0;
        for (const para of page) rows += this.wrap(m, para, innerW).length;
        const hgt = (rows + (page.length - 1) * 0.35) * px * 1.18;
        if (hgt > innerH) { ok = false; break; }
      }
      if (ok) return px;
    }
    return 11;
  }

  private wrap(m: CanvasRenderingContext2D, para: string, maxW: number): string[] {
    const words = para.split(' '), out: string[] = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (cur && m.measureText(t).width > maxW) { out.push(cur); cur = w; } else cur = t;
    }
    if (cur) out.push(cur);
    return out;
  }

  private bakeBg(): HTMLCanvasElement {
    const { W, H, k } = this, L = this.layout;
    const c = makeCanvas(W * k, H * k), g = c.getContext('2d')!;
    g.scale(k, k);
    // mesa
    const wood = g.createLinearGradient(0, 0, 0, H);
    wood.addColorStop(0, '#5a3b27'); wood.addColorStop(1, '#3a2418');
    g.fillStyle = wood; g.fillRect(0, 0, W, H);
    const r = rng(9);
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1;
    for (let i = 0; i < 26; i++) { const y = r() * H; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + r() * 8, W * 0.7, y - r() * 8, W, y + r() * 6); g.stroke(); }
    // folha (sombra + papel levemente girado)
    g.save();
    g.translate(L.x + L.w / 2, L.y + L.h / 2);
    g.rotate(-0.006);
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(-L.w / 2 + 5, -L.h / 2 + 7, L.w, L.h);
    const paper = g.createLinearGradient(-L.w / 2, -L.h / 2, L.w / 2, L.h / 2);
    paper.addColorStop(0, '#fbf3da'); paper.addColorStop(1, '#efe0b8');
    g.fillStyle = paper; g.fillRect(-L.w / 2, -L.h / 2, L.w, L.h);
    // fibras
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(150,110,60,${0.03 + r() * 0.05})`; g.fillRect(-L.w / 2 + r() * L.w, -L.h / 2 + r() * L.h, 1 + r() * 2, 1); }
    // sem pauta: a letra de mão corre solta; só a margem avermelhada
    g.strokeStyle = 'rgba(210,90,90,.35)'; g.beginPath(); g.moveTo(-L.w / 2 + 28, -L.h / 2); g.lineTo(-L.w / 2 + 28, L.h / 2); g.stroke();
    // vincos
    g.strokeStyle = 'rgba(120,90,50,.25)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(-L.w / 2, -L.h / 6); g.lineTo(L.w / 2, -L.h / 6 + 3); g.moveTo(-L.w / 2, L.h / 6); g.lineTo(L.w / 2, L.h / 6 - 2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.45)';
    g.beginPath(); g.moveTo(-L.w / 2, -L.h / 6 + 2); g.lineTo(L.w / 2, -L.h / 6 + 5); g.stroke();
    // mancha de café
    const cx = L.w * 0.34, cy = -L.h * 0.26;
    const stain = g.createRadialGradient(cx, cy, L.h * 0.02, cx, cy, L.h * 0.13);
    stain.addColorStop(0, 'rgba(150,95,45,.0)'); stain.addColorStop(0.7, 'rgba(150,95,45,.28)'); stain.addColorStop(0.85, 'rgba(120,70,30,.42)'); stain.addColorStop(1, 'rgba(120,70,30,0)');
    g.fillStyle = stain; g.beginPath(); g.arc(cx, cy, L.h * 0.13, 0, Math.PI * 2); g.fill();
    // rabisco: o Karimbo de orelhas gigantes (canto de baixo)
    this.doodleKarimbo(g, L.w * 0.36, L.h * 0.3, Math.min(1.1, L.h / 280));
    g.restore();
    return c;
  }

  /** boneco a lápis com orelhas enormes e uma setinha "você" */
  private doodleKarimbo(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.strokeStyle = 'rgba(70,70,90,.7)'; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.stroke();                       // cabeça
    for (const k of [-1, 1]) { g.beginPath(); g.ellipse(k * 24, -2, 11, 17, k * 0.3, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.ellipse(k * 24, -2, 6, 11, k * 0.3, 0, Math.PI * 2); g.stroke(); } // orelhas
    g.beginPath(); g.arc(-4, -2, 1.3, 0, 7); g.arc(4, -2, 1.3, 0, 7); g.stroke();      // olhos
    g.beginPath(); g.arc(0, 3, 5, 0.2, Math.PI - 0.2); g.stroke();                    // sorriso
    g.beginPath(); g.moveTo(0, 12); g.lineTo(0, 38); g.moveTo(0, 20); g.lineTo(-12, 30); g.moveTo(0, 20); g.lineTo(12, 30); g.moveTo(0, 38); g.lineTo(-8, 54); g.moveTo(0, 38); g.lineTo(8, 54); g.stroke(); // corpo
    g.font = `15px ${STACK}`; g.fillStyle = 'rgba(70,70,90,.8)';
    g.fillText('você', 44, 40);
    g.beginPath(); g.moveTo(42, 36); g.quadraticCurveTo(24, 34, 16, 24); g.stroke();
    g.beginPath(); g.moveTo(16, 24); g.lineTo(22, 25); g.moveTo(16, 24); g.lineTo(18, 30); g.stroke();
    g.restore();
  }

  private bakePage(i: number): PageBake {
    const { W, H, k } = this, L = this.layout, px = this.fontPx, lh = px * 1.18;
    const c = makeCanvas(W * k, H * k), g = c.getContext('2d')!;
    g.scale(k, k);
    g.font = `${px}px ${STACK}`;
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#23305a';
    const lines: LetterLine[] = [];
    // origem alinhada com o papel girado (-0,012 rad) no desenho; aqui o texto fica na folha reta
    const x0 = L.x + 22, innerW = L.w - 44;
    let y = L.y + 22 + px * 0.9, off = 0;
    for (const para of LETTER_PAGES[i]) {
      const rows = this.wrap(g, para, innerW);
      let idx = 0;
      for (const row of rows) {
        const prefixW: number[] = [0];
        for (let j = 1; j <= row.length; j++) prefixW.push(g.measureText(row.slice(0, j)).width);
        // a letra tem leve inclinação própria por linha (mão levantada)
        g.save();
        g.translate(x0, y);
        g.rotate(((lines.length * 7919) % 11 - 5) * 0.0011);
        g.fillText(row, 0, 0);
        g.restore();
        const len = row.length + (idx + row.length < para.length ? 1 : 0); // o espaço da quebra pertence à linha de cima
        lines.push({ y: y - px, h: lh + 4, w: prefixW[row.length] + 6, start: off + idx, end: off + idx + len, prefixW });
        idx += len;
        y += lh;
      }
      off += para.length;
      y += lh * 0.35;
    }
    // beijo de batom na página 2 (perto da assinatura)
    if (i === 1) this.kiss(g, L.x + L.w * 0.78, y - lh * 2.3, 1);
    return { text: c, lines, total: off };
  }

  private kiss(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
    g.save();
    g.translate(x, y);
    g.rotate(-0.25);
    g.scale(s, s);
    g.fillStyle = 'rgba(200,30,60,.78)';
    g.beginPath();
    g.moveTo(-17, 0);
    g.bezierCurveTo(-14, -9, -5, -11, 0, -5);
    g.bezierCurveTo(5, -11, 14, -9, 17, 0);
    g.bezierCurveTo(12, 9, -12, 9, -17, 0);
    g.fill();
    g.strokeStyle = 'rgba(120,10,30,.5)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-16, 0); g.quadraticCurveTo(0, 4, 16, 0); g.stroke();
    g.restore();
  }

  /** Desenha a mesa, a folha e o trecho já "escrito" (`shown` letras) da página `page`. */
  draw(g: CanvasRenderingContext2D, page: number, shown: number) {
    const { W, H } = this;
    g.drawImage(this.bg, 0, 0, W, H);
    const pb = this.pages[page], k = this.k;
    for (const ln of pb.lines) {
      if (shown <= ln.start) break;
      const n = Math.min(ln.end, shown) - ln.start, full = shown >= ln.end;
      const wpx = full ? ln.w + 4 : ln.prefixW[Math.min(ln.prefixW.length - 1, n)] + 4;
      const sy = Math.max(0, ln.y - 2), sh = ln.h + 2;
      g.drawImage(pb.text, this.layout.x * k, sy * k, Math.min(wpx + 24, W - this.layout.x) * k, sh * k, this.layout.x, sy, Math.min(wpx + 24, W - this.layout.x), sh);
    }
  }
}
