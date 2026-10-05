/**
 * Tela cheia do filminho da carta: mesa + folha (LetterPaper) e o Karimbo no canto de baixo lendo, com
 * orelhas mexendo, gota de suor e rubor nas piadas e uma tremidinha a cada parágrafo que termina.
 */
import { getArt } from '../../index';
import { progress } from '../../../core/storage';
import { drawKarimbo, type KPose } from '../../karimbo';
import { txt } from '../boxing/fx';
import { LetterPaper } from './letterPaper';
import { LETTER_PAGES, SKIP_AFTER, type LetterFilm } from '../../../game/minigames/chase/sim/letterFilm';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export class FilmScene {
  private paper: LetterPaper | null = null;
  private time = 0;
  private lastPara = -1;
  private lastPage = -1;
  private shake = 0;

  constructor(private W: number, private H: number) {}

  /** Assa a mesa e as páginas (na primeira vez que a cena é desenhada). */
  private ensure() {
    if (!this.paper) this.paper = new LetterPaper(this.W, this.H, Math.max(1, Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2)));
    return this.paper;
  }

  resize(W: number, H: number) { this.W = W; this.H = H; this.paper = null; }

  /** Parágrafo (da página atual) em que a letra `shown` está. */
  private paraOf(page: number, shown: number) {
    let acc = 0;
    for (let i = 0; i < LETTER_PAGES[page].length; i++) { acc += LETTER_PAGES[page][i].length; if (shown < acc) return i; }
    return LETTER_PAGES[page].length;
  }

  update(dt: number, film: LetterFilm) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt);
    if (film.page !== this.lastPage) { this.lastPage = film.page; this.lastPara = -1; }
    const p = this.paraOf(film.page, film.shown);
    if (p !== this.lastPara) { if (this.lastPara >= 0 && p > this.lastPara) this.shake = 0.45; this.lastPara = p; }
  }

  draw(g: CanvasRenderingContext2D, film: LetterFilm, W: number, H: number) {
    if (W !== this.W || H !== this.H) this.resize(W, H);
    const paper = this.ensure(), u = H / 360, t = this.time;
    paper.draw(g, film.page, film.shown);
    this.drawReader(g, film, W, H, u, t);
    // dicas no centro de baixo: os botões de toque (joystick à esquerda, PULO à direita) ficam livres
    const done = film.complete, cx = W / 2;
    txt(g, done ? (film.lastPage ? 'PULAR ▶ continuar' : 'PULAR ▶ próxima página') : 'PULAR ▶ ler logo', cx, H - 12 * u, 10.5 * u, '#fff1cd', 'center', 0.55 + 0.45 * Math.sin(t * 5));
    if (film.canSkip) txt(g, 'Segure ↓ para pular tudo', cx, H - 26 * u, 9 * u, '#ffd9a0', 'center', clamp01((film.t - SKIP_AFTER) * 2) * 0.9);
    txt(g, `${film.page + 1}/${LETTER_PAGES.length}`, cx + 110 * u, H - 12 * u, 10 * u, '#ffe9b0', 'center');
    // abertura: sai do preto
    if (film.t < 0.6) { g.globalAlpha = 1 - film.t / 0.6; g.fillStyle = '#05030a'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  }

  private drawReader(g: CanvasRenderingContext2D, film: LetterFilm, W: number, H: number, u: number, t: number) {
    const s = 1.5 * u, x = W * 0.1, feet = H - 8 * u;
    const trem = this.shake > 0 ? Math.sin(t * 60) * 2.2 * (this.shake / 0.45) : 0;
    const writing = film.shown > 0 && !film.complete;
    const pose: KPose = {
      facing: 1, state: 'idle', t, runPhase: 0, speed01: 0, aim: 0, weapon: 'rifle', kick: 0, flash: false, earGlide: 0, vy: 0, alpha: 1, hasGun: false,
      idleT: t, earSpring: Math.sin(t * (writing ? 9 : 4)) * (writing ? 0.7 : 0.25) + (this.shake > 0 ? 1 : 0), lean: this.shake > 0 ? 0.06 : 0.02, squash: 0,
    };
    g.save();
    g.translate(x + trem * u, feet);
    g.scale(s, s);
    drawKarimbo(g, getArt().karimbo, 0, 0, pose, progress.equippedSkin);
    // gota de suor (parágrafos do meio da página 1) e rubor (final da página 2)
    const para = this.paraOf(film.page, film.shown);
    if (film.page === 0 && para >= 3) { g.fillStyle = '#bfe8ff'; g.strokeStyle = '#170f2e'; g.lineWidth = 1; g.beginPath(); g.ellipse(24, -64 + (t * 14) % 6, 2.6, 4, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
    if (film.page === 1 && para >= 3) { g.fillStyle = 'rgba(255,70,110,.5)'; for (const dx of [-9, 11]) { g.beginPath(); g.ellipse(dx + 2, -42, 5, 3, 0, 0, Math.PI * 2); g.fill(); } }
    g.restore();
  }
}
