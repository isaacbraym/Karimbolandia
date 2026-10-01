/**
 * Arte da fase 2 (selva), carregada à parte: os peixes (fotos enviadas, recortadas), o fundo da
 * selva e os bandidos. Prepara tudo em segundo plano depois do menu, para a fase abrir na hora.
 */
import { makeCanvas } from './kit';
import { JungleBackground } from './jungleBg';
import { bakeBandit } from './bandits';
import type { SoldierArt, SoldierStyle } from './soldiers';
import type { Quality } from './index';

export interface FishArt {
  /** cópias reduzidas (maior → menor) para desenhar nítido e barato em qualquer tamanho */
  mips: HTMLCanvasElement[];
  w: number;
  h: number;
  /** onde começa a cauda (fração da largura) e altura do pivô dela (fração da altura) */
  tailX: number;
  tailY: number;
}

export interface JungleArt {
  fish: FishArt[];
  bg: JungleBackground;
  bandits: Record<SoldierStyle, SoldierArt>;
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

/** Carrega (uma vez) a arte da selva; chamadas repetidas devolvem a mesma promessa. */
export function loadJungle(base: string, quality: Quality): Promise<JungleArt> {
  if (jungle) return Promise.resolve(jungle);
  if (pending) return pending;
  pending = (async () => {
    const u = (n: string) => `${base}assets/img/${n}`;
    const [a, b] = await Promise.all([loadImage(u('fish_a.webp')), loadImage(u('fish_b.webp'))]);
    await tick();
    const fish = [fishArt(a, 0.79, 0.45), fishArt(b, 0.8, 0.47)];
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
    jungle = { fish, bg, bandits };
    return jungle;
  })();
  pending.catch(() => {
    pending = null;
  });
  return pending;
}
