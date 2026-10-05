import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LETTER_PAGES, LetterFilm, Rewind, REWIND_T, SKIP_AFTER, pageChars } from '../src/game/minigames/chase/sim/letterFilm';
import type { TrailPoint } from '../src/game/minigames/chase/sim/match';

/** Texto final do Apêndice A do plano (não alterar sem pedido do usuário). */
const APENDICE_A = [
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

describe('filminho da carta', () => {
  it('o texto é exatamente o do Apêndice A', () => {
    expect(LETTER_PAGES.map((p) => [...p])).toEqual(APENDICE_A);
  });

  it('a escrita revela letra por letra e tocar completa a página, passa de página e encerra', () => {
    const f = new LetterFilm();
    expect(f.shown).toBe(0);
    f.update(1);
    expect(f.shown).toBeGreaterThan(20);
    expect(f.complete).toBe(false);
    f.advance(); // completa a página 1
    expect(f.page).toBe(0);
    expect(f.complete).toBe(true);
    expect(f.shown).toBe(pageChars(0));
    f.advance(); // próxima página
    expect(f.page).toBe(1);
    expect(f.shown).toBe(0);
    f.advance(); f.advance(); // completa e encerra
    expect(f.done).toBe(true);
  });

  it('pular tudo só vale depois de 2 s', () => {
    const f = new LetterFilm();
    f.update(SKIP_AFTER - 0.1);
    f.skip();
    expect(f.done).toBe(false);
    f.update(0.2);
    f.skip();
    expect(f.done).toBe(true);
  });
});

describe('rebobinar', () => {
  const trail: TrailPoint[] = Array.from({ length: 101 }, (_, i) => ({ x: i * 100, y: 640, air: false, mx: i * 100 + 500, my: 640 }));

  it('dura 4 s, o cronômetro volta a zero e o percurso rola de trás para a frente', () => {
    const rw = new Rewind(trail, 52);
    expect(rw.sample().x).toBe(10000);
    expect(rw.clock).toBeCloseTo(52);
    let last = rw.sample().x;
    for (let i = 0; i < REWIND_T * 60 - 1; i++) { rw.update(1 / 60); expect(rw.sample().x).toBeLessThanOrEqual(last); last = rw.sample().x; }
    expect(rw.done).toBe(false);
    rw.update(1 / 60);
    expect(rw.done).toBe(true);
    expect(rw.clock).toBeCloseTo(0, 1);
    expect(rw.sample().x).toBe(0);
  });

  it('sem trilha gravada não quebra', () => {
    const rw = new Rewind([], 0);
    rw.update(5);
    expect(rw.done).toBe(true);
    expect(rw.sample().x).toBe(0);
  });
});

describe('fonte da carta', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.resetModules(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('sem FontFace (ou sem document) cai no fallback na hora, sem travar', async () => {
    const { ensureLetterFont } = await import('../src/art/minigames/chase/letterPaper');
    await expect(ensureLetterFont()).resolves.toBe(false);
  });

  it('fonte que nunca carrega vence pelo tempo limite e resolve false', async () => {
    vi.stubGlobal('document', { fonts: { add: vi.fn() } });
    vi.stubGlobal('FontFace', class { load() { return new Promise(() => {}); } });
    const { ensureLetterFont } = await import('../src/art/minigames/chase/letterPaper');
    const p = ensureLetterFont();
    await vi.advanceTimersByTimeAsync(3000);
    await expect(p).resolves.toBe(false);
  });

  it('carregamento ok adiciona a fonte e falha resolve false', async () => {
    const add = vi.fn();
    vi.stubGlobal('document', { fonts: { add } });
    vi.stubGlobal('FontFace', class { load() { return Promise.resolve(this); } });
    const { ensureLetterFont } = await import('../src/art/minigames/chase/letterPaper');
    await expect(ensureLetterFont()).resolves.toBe(true);
    expect(add).toHaveBeenCalledTimes(1);
    vi.resetModules();
    vi.stubGlobal('FontFace', class { load() { return Promise.reject(new Error('x')); } });
    const again = await import('../src/art/minigames/chase/letterPaper');
    await expect(again.ensureLetterFont()).resolves.toBe(false);
  });
});

describe('sessão: captura, filminho, rebobinar e resultado', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock('../src/art/minigames/chase/scene'); vi.doUnmock('../src/art/minigames/chase/filmScene'); vi.doUnmock('../src/art/minigames/chase/letterPaper'); vi.doUnmock('../src/core/audio'); });

  it('só termina depois das duas páginas e dos 4 s de rebobinar, com o resultado de vitória', async () => {
    const stub = () => ({ update() {}, draw() {}, resize() {}, handle() {}, updateRewind() {}, drawRewind() {}, fx: { reset() {} } });
    vi.doMock('../src/art/minigames/chase/scene', () => ({ ChaseScene: class { constructor() { return stub() as never; } } }));
    vi.doMock('../src/art/minigames/chase/filmScene', () => ({ FilmScene: class { constructor() { return stub() as never; } } }));
    vi.doMock('../src/art/minigames/chase/letterPaper', () => ({ ensureLetterFont: () => Promise.resolve(false) }));
    vi.doMock('../src/core/audio', () => ({ audio: { play() {} } }));
    const music: string[] = [];
    const { create } = await import('../src/game/minigames/chase');
    const ctx = { w: {}, quality: 'low', viewW: 667, viewH: 320, difficulty: 'normal', backdrop: null, music: (s: string) => music.push(s), touch: () => {}, special: () => {} };
    const s = create(ctx as never) as unknown as { update(dt: number, c: unknown): void; done: boolean; result(): unknown; match: import('../src/game/minigames/chase/sim/match').ChaseMatch };
    const btn = (p = false) => ({ held: p, pressed: p, released: false });
    const ctl = (jump = false) => ({ moveX: 0, moveY: 0, jump: btn(jump), interact: btn(false) });
    // posiciona o macaco ao alcance depois do tempo mínimo: a captura acontece e o resultado nasce
    s.match.time = 60;
    s.match.runner.body.x = s.match.monkey.x - 20;
    for (let i = 0; i < 60 * 3 && !s.match.result; i++) s.update(1 / 60, ctl());
    expect(s.match.result).not.toBeNull();
    expect(s.done).toBe(false);
    expect(music.at(-1)).toBe('calm');
    expect(s.result()).toMatchObject({ id: 'chase', outcome: 'win' });
    // filminho: lê as duas páginas tocando PULAR
    for (let i = 0; i < 6; i++) { s.update(1 / 60, ctl(true)); s.update(1 / 60, ctl()); }
    expect(s.done).toBe(false);
    // rebobinar: 4 s
    for (let i = 0; i < 60 * 3.9; i++) s.update(1 / 60, ctl());
    expect(s.done).toBe(false);
    for (let i = 0; i < 20; i++) s.update(1 / 60, ctl());
    expect(s.done).toBe(true);
    expect(s.result()).toMatchObject({ id: 'chase', outcome: 'win' });
  });
});
