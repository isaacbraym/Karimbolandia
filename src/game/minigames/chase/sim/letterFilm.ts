/**
 * Filminho da carta da princesa Júlia e o rebobinar da fita (simulação pura, sem desenho). O texto das
 * duas páginas é o do Apêndice A do plano: NÃO alterar sem pedido do usuário (há teste que o confere).
 * Tocar/pular escreve o resto da página e depois passa de página; só depois de 2 s dá para pular tudo.
 */
import type { TrailPoint } from './match';

export const LETTER_PAGES: readonly (readonly string[])[] = [
  [
    'Querido Karimbo,',
    'Se esta carta chegou, é porque o pombo sobreviveu — o que já é mais do que eu posso garantir sobre mim.',
    'Estou presa num lugar escuro, úmido e cheio de capangas. Pensei logo em você, porque é o único homem que eu conheço capaz de me ouvir gritando daqui sem precisar de telefone. Cada orelha sua é uma antena parabólica, Karimbo. Usa isso.',
    'Os sequestradores até que me tratam bem. A tortura é só uma vez por dia: eles leem em voz alta os poemas que você me mandou. Ontem o chefe chorou. Não foi de emoção.',
    'Por favor, venha rápido. Mas venha de frente pro vento: se pegar uma rajada de lado, você decola e só para na Bolívia. Se cair de algum lugar, abre as orelhas e plana. Deus não te deu beleza, mas te deu aerodinâmica.',
  ],
  [
    'Mamãe sempre disse que eu ia acabar com alguém de orelha grande. Eu achei que era força de expressão. Ela, coitada, achou que era praga. Acertou as duas.',
    'Se eu não sobreviver, deixo pra você a minha coleção de brincos. Espaço pra pendurar não falta: cabe a coleção inteira e ainda sobra lugar pro varal.',
    'E se você não chegar a tempo, tudo bem: já deixei avisado que quero ser velada debaixo das suas orelhas. Ninguém vai precisar alugar tenda.',
    'Com amor (e um pouco de vergonha),',
    'Júlia ♥',
    'PS: Não mostra esta carta pra ninguém. Principalmente pra macaco.',
    'PPS: O pombo se chama Orelhudo II. O primeiro morreu de inveja.',
  ],
];

/** letras por segundo da "escrita" */
export const CHARS_PER_S = 48;
/** o filminho só pode ser pulado inteiro depois disto */
export const SKIP_AFTER = 2;
/** duração do rebobinar (s) */
export const REWIND_T = 4;

export const pageChars = (page: number) => LETTER_PAGES[page].reduce((n, p) => n + p.length, 0);

export class LetterFilm {
  page = 0;
  /** tempo total no filminho / na página atual */
  t = 0;
  pt = 0;
  done = false;
  /** momentos de "tremidinha" nas piadas (o Karimbo reage): índices de parágrafo já alcançados */
  get shown() { return Math.min(pageChars(this.page), Math.floor(this.pt * CHARS_PER_S)); }
  get complete() { return this.shown >= pageChars(this.page); }
  get lastPage() { return this.page === LETTER_PAGES.length - 1; }
  get canSkip() { return this.t >= SKIP_AFTER; }

  update(dt: number) {
    if (this.done) return;
    this.t += dt;
    this.pt += dt;
  }

  /** Tocar/pular: completa a página; com a página completa passa para a próxima; na última, encerra. */
  advance() {
    if (this.done) return;
    if (!this.complete) { this.pt = pageChars(this.page) / CHARS_PER_S + 0.001; return; }
    if (this.lastPage) this.done = true;
    else { this.page++; this.pt = 0; }
  }

  /** Pula tudo (só depois de SKIP_AFTER). */
  skip() { if (this.canSkip) this.done = true; }
}

/** Rebobinar: 4 s andando para trás pelo percurso gravado; o cronômetro volta de `endTime` a zero. */
export class Rewind {
  t = 0;
  constructor(readonly trail: readonly TrailPoint[], readonly endTime: number) {}
  get done() { return this.t >= REWIND_T - 1e-6; }
  /** 0..1 (suave: acelera e freia) */
  get p() { const u = Math.min(1, this.t / REWIND_T); return u * u * (3 - 2 * u); }
  get clock() { return this.endTime * (1 - this.p); }
  update(dt: number) { if (!this.done) this.t += dt; }
  /** amostra do percurso gravado no ponto atual (de trás para a frente) */
  sample(): TrailPoint {
    const n = this.trail.length;
    if (!n) return { x: 0, y: 0, air: false, mx: 0, my: 0 };
    const f = (1 - this.p) * (n - 1), i = Math.max(0, Math.min(n - 1, Math.floor(f)));
    return this.trail[i];
  }
}
