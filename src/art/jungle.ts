/**
 * Arte da fase 2 (selva), carregada à parte: os peixes (fotos enviadas, recortadas), o fundo da
 * selva e os bandidos. Prepara tudo em segundo plano depois do menu, para a fase abrir na hora.
 */
import { makeCanvas } from './kit';
import { bakeVillagers } from './village';
import { JungleBackground } from './jungleBg';
import { bakeBandit } from './bandits';
import type { SoldierArt, SoldierStyle } from './soldiers';
import type { Quality } from './index';
import { prepareWildlifeArt } from './wildlife';
import { prepareForestLight } from './forestLight';
import { prepareLakeLife } from './lake/lakeLife';
import { prepareLetterActors } from './letterActors';

export interface FishArt {
  /** cópias reduzidas (maior → menor) para desenhar nítido e barato em qualquer tamanho */
  mips: HTMLCanvasElement[];
  w: number;
  h: number;
  /** onde começa a cauda (fração da largura) e altura do pivô dela (fração da altura) */
  tailX: number;
  tailY: number;
}

/** Piranha: quadro de boca fechada (a) e mordendo (b), já reduzidos (a foto olha para a ESQUERDA). */
export interface PiranhaArt { a: HTMLCanvasElement; b: HTMLCanvasElement; aspect: number }
export interface JungleArt {
  thinker: HTMLCanvasElement;
  fish: FishArt[];
  piranhas: PiranhaArt[];
  bg: JungleBackground;
  bandits: Record<SoldierStyle, SoldierArt>;
  banditVariants: Record<SoldierStyle, SoldierArt>[];
}

let jungle: JungleArt | null = null;
let pending: Promise<JungleArt> | null = null;
export const getJungle = () => jungle;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('Falha ao carregar ' + src));
    im.src = src;
  });
}

function fishArt(img: HTMLImageElement, tailX: number, tailY: number): FishArt {
  const mips: HTMLCanvasElement[] = [];
  let src: CanvasImageSource = img;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  // reduções sucessivas pela metade (boa filtragem, sem serrilhado nos peixinhos)
  for (let i = 0; i < 5; i++) {
    const c = makeCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    const g = c.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, c.width, c.height);
    mips.push(c);
    src = c;
    w /= 2;
    h /= 2;
    if (w < 24) break;
  }
  return { mips, w: img.naturalWidth, h: img.naturalHeight, tailX, tailY };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/** Remove the baked dark checkerboard at load time; keeps source statue pixels intact. */
function thinkerArt(img: HTMLImageElement) {
  const c = makeCanvas(img.naturalWidth, img.naturalHeight), g = c.getContext('2d')!;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height), pixels = data.data;
  const seen = new Uint8Array(c.width * c.height), queue = new Int32Array(seen.length);
  let head = 0, tail = 0;
  const add = (i: number) => {
    if (seen[i]) return;
    seen[i] = 1;
    const k = i * 4;
    if (Math.max(pixels[k], pixels[k + 1], pixels[k + 2]) > 85) return;
    queue[tail++] = i;
  };
  for (let x = 0; x < c.width; x++) { add(x); add((c.height - 1) * c.width + x); }
  for (let y = 0; y < c.height; y++) { add(y * c.width); add(y * c.width + c.width - 1); }
  while (head < tail) {
    const i = queue[head++], x = i % c.width;
    pixels[i * 4 + 3] = 0;
    if (x) add(i - 1);
    if (x < c.width - 1) add(i + 1);
    if (i >= c.width) add(i - c.width);
    if (i < seen.length - c.width) add(i + c.width);
  }
  g.putImageData(data, 0, 0);
  const small = makeCanvas(320, Math.round(320 * c.height / c.width));
  const sg = small.getContext('2d')!;
  sg.imageSmoothingQuality = 'high'; sg.drawImage(c, 0, 0, small.width, small.height);
  return small;
}

/** Carrega (uma vez) a arte da selva; chamadas repetidas devolvem a mesma promessa. */
export function loadJungle(base: string, quality: Quality): Promise<JungleArt> {
  if (jungle) return Promise.resolve(jungle);
  if (pending) return pending;
  pending = (async () => {
    const u = (n: string) => `${base}assets/img/${n}`;
    const [a, b] = await Promise.all([loadImage(u('fish_a.webp')), loadImage(u('fish_b.webp'))]);
    await tick();
    const fish = [fishArt(a, 0.79, 0.45), fishArt(b, 0.8, 0.47)];
    const pir = await Promise.all(['piranha1a', 'piranha1b', 'piranha2a', 'piranha2b'].map((n) => loadImage(u(n + '.webp'))));
    const shrink = (img: HTMLImageElement) => {
      const c = makeCanvas(160, Math.round(160 * img.naturalHeight / img.naturalWidth));
      const g = c.getContext('2d')!;
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, c.width, c.height);
      return c;
    };
    const thinker = thinkerArt(await loadImage(u('karimbo-thinker.jpeg')));
    const piranhas: PiranhaArt[] = [0, 2].map((i) => ({ a: shrink(pir[i]), b: shrink(pir[i + 1]), aspect: pir[i].naturalHeight / pir[i].naturalWidth }));
    await tick();
    const bg = new JungleBackground(quality === 'high' ? 1.5 : quality === 'medium' ? 1.25 : 1);
    await tick();
    const bandits = {
      rifle: bakeBandit('rifle'),
      shotgun: bakeBandit('shotgun'),
      shield: bakeBandit('shield'),
      jetpack: bakeBandit('rifle'),
      sniper: bakeBandit('sniper'),
    };
    const banditVariants = [bandits];
    for (let v = 1; v < 3; v++) {
      const set = {} as Record<SoldierStyle, SoldierArt>;
      for (const style of ['rifle', 'shotgun', 'shield', 'jetpack', 'sniper'] as const) {
        set[style] = bakeBandit(style, v);
        await tick();
      }
      banditVariants.push(set);
    }
    await tick();
    prepareWildlifeArt();
    prepareForestLight();
    prepareLakeLife();
    prepareLetterActors();
    await tick();
    bakeVillagers();
    jungle = { fish, piranhas, bg, bandits, banditVariants, thinker };
    return jungle;
  })();
  pending.catch(() => {
    pending = null;
  });
  return pending;
}
