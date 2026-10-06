import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runBot, SLOPPY } from './helpers/chaseBot';

/** Orçamento de desenho da perseguição: ≤ 250 `drawImage` por quadro e nada criado por quadro (contexto falso que só conta). */
let draws = 0, gradients = 0, canvases = 0;
const spr = () => ({ c: { width: 100, height: 100 }, w: 40, h: 40, ox: 20, oy: 20, s: 2 });
vi.mock('../src/art/index', () => ({
  getArt: () => ({
    karimbo: { heads: { earNear: spr(), earFar: spr(), portrait: spr(), right: spr() } },
    // pior caso para o desenhista de tiles: blocos em cache de vários chunks na tela
    tiles: { render: (g: CanvasRenderingContext2D) => { for (let i = 0; i < 12; i++) g.drawImage({} as CanvasImageSource, 0, 0, 10, 10); } },
  }),
}));
vi.mock('../src/art/karimbo', () => ({ drawKarimbo: (g: CanvasRenderingContext2D) => { for (let i = 0; i < 40; i++) g.drawImage({} as CanvasImageSource, 0, 0, 10, 10); } }));
vi.mock('../src/art/wildlife', () => ({ drawMonkey: (g: CanvasRenderingContext2D) => { for (let i = 0; i < 20; i++) g.drawImage({} as CanvasImageSource, 0, 0, 10, 10); } }));

const ctx = (): CanvasRenderingContext2D => new Proxy({} as object, {
  get(target, key) {
    if (key === 'drawImage') return () => { draws++; };
    if (key === 'getTransform') return () => ({ a: 2 });
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => { gradients++; return { addColorStop() {} }; };
    if (key === 'measureText') return () => ({ width: 40 });
    if (key in target) return (target as Record<string | symbol, unknown>)[key];
    return () => {};
  },
  set(target, key, value) { (target as Record<string | symbol, unknown>)[key] = value; return true; },
}) as unknown as CanvasRenderingContext2D;

beforeEach(() => {
  draws = gradients = canvases = 0;
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, key: () => null, length: 0 });
  vi.stubGlobal('document', { createElement: () => { canvases++; return { width: 1, height: 1, getContext: ctx }; } });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

describe('custo de desenho da perseguição', () => {
  it('nunca passa de 250 drawImage por quadro, sem gradiente por quadro e quase sem canvas novo', async () => {
    const { ChaseScene } = await import('../src/art/minigames/chase/scene');
    const g = ctx();
    const scene = new ChaseScene(667, 320);
    let worst = 0, scenes = 0, afterWarm = -1, gradWarm = -1;
    runBot(SLOPPY, 150, (m) => {
      for (const e of m.events) scene.handle(e, m);
      m.events.length = 0;
      scene.update(1 / 60, m);
      draws = 0;
      scene.draw(g, m, 667, 320, 2);
      worst = Math.max(worst, draws);
      scenes++;
      if (scenes === 30) { afterWarm = canvases; gradWarm = gradients; }
    });
    expect(scenes).toBeGreaterThan(3000);
    expect(worst).toBeLessThanOrEqual(250);
    expect(gradients).toBe(gradWarm);
    // só os letreiros novos viram canvas (uma vez cada, em cache): o cronômetro usa dígitos fixos
    expect(canvases - afterWarm).toBeLessThan(120);
  });
});

describe('custo de desenho do filminho e do rebobinar', () => {
  it('rebobina usando os mesmos galhos vivos da corrida, com cache aquecido', async () => {
    const { ChaseScene } = await import('../src/art/minigames/chase/scene');
    const { BranchCanopy } = await import('../src/art/minigames/chase/branches');
    const { ChaseMatch } = await import('../src/game/minigames/chase/sim/match');
    const { Rewind } = await import('../src/game/minigames/chase/sim/letterFilm');
    const m=new ChaseMatch(), scene=new ChaseScene(667,320,m.course),g=ctx();
    const canopy=vi.spyOn(BranchCanopy.prototype,'draw');
    const rw=new Rewind([{x:800,y:m.course.pathY(800),air:false,mx:1100,my:m.course.pathY(1100)}],20);
    scene.updateRewind(1/60,rw);scene.drawRewind(g,m,rw,667,320);
    const warm=canvases,grad=gradients;
    for(let i=0;i<120;i++){rw.update(1/60);scene.updateRewind(1/60,rw);scene.drawRewind(g,m,rw,667,320);}
    expect(canopy).toHaveBeenCalledTimes(121);
    expect(canvases-warm).toBeLessThan(30); // dígitos do cronômetro são cacheados
    expect(gradients).toBe(grad);
    canopy.mockRestore();
  });
  it('a carta revela linhas copiando imagens (poucas) e não cria canvas durante a leitura', async () => {
    const { LetterPaper } = await import('../src/art/minigames/chase/letterPaper');
    const { LETTER_PAGES, pageChars } = await import('../src/game/minigames/chase/sim/letterFilm');
    const g = ctx();
    const paper = new LetterPaper(667, 320, 2);
    const warm = canvases;
    let worst = 0;
    for (let page = 0; page < LETTER_PAGES.length; page++) {
      for (let shown = 0; shown <= pageChars(page); shown += 7) { draws = 0; paper.draw(g, page, shown); worst = Math.max(worst, draws); }
    }
    expect(worst).toBeLessThanOrEqual(40);
    expect(canvases).toBe(warm);
  });

  it('o efeito de fita só copia imagens assadas (≤ 12 por quadro com os textos, sem canvas novo)', async () => {
    const { RewindFx } = await import('../src/art/minigames/chase/rewindFx');
    const g = ctx();
    const fx = new RewindFx(667, 320);
    const warm = canvases;
    let worst = 0;
    for (let i = 0; i < 240; i++) { draws = 0; fx.draw(g, i / 60, 52 * (1 - i / 240)); worst = Math.max(worst, draws); }
    expect(worst).toBeLessThanOrEqual(12);
    // só os dígitos novos do cronômetro viram texto em cache
    expect(canvases - warm).toBeLessThan(60);
  });
});
