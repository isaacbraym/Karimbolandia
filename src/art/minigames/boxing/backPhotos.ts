/**
 * Fotos do Karimbo de COSTAS (cabeça + nuca sem pescoço, orelhas separadas com a raiz como pivô),
 * recortadas por tools/cutout_karimbo_back. Só o boxe usa; carregam antes da luta (o `preload` do módulo
 * espera por elas) e viram sprites com contorno cartoon na primeira vez que se desenha.
 */
export interface BackMeta {
  head: { w: number; h: number; cx: number; neckY: number };
  earL: { w: number; h: number; rootX: number; rootY: number; headX: number; headY: number };
  earR: { w: number; h: number; rootX: number; rootY: number; headX: number; headY: number };
}
export interface BackPhotos { head: HTMLImageElement; earL: HTMLImageElement; earR: HTMLImageElement; meta: BackMeta }

let photos: BackPhotos | null = null;
let loading: Promise<BackPhotos | null> | null = null;

const img = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
  const im = new Image();
  im.decoding = 'async';
  im.onload = () => res(im);
  im.onerror = () => rej(new Error('Falha ao carregar ' + src));
  im.src = src;
});

/** Carrega uma vez. Se falhar, devolve null: o desenho usa a silhueta procedural (a luta nunca trava por isso). */
export function loadBackPhotos(): Promise<BackPhotos | null> {
  if (photos) return Promise.resolve(photos);
  if (!loading) {
    const u = (n: string) => new URL(`assets/img/${n}`, document.baseURI).href;
    loading = Promise.all([img(u('karimbo_back_head.webp')), img(u('karimbo_back_ear_l.webp')), img(u('karimbo_back_ear_r.webp')), fetch(u('karimbo_back_meta.json')).then((r) => r.json() as Promise<BackMeta>)])
      .then(([head, earL, earR, meta]) => (photos = { head, earL, earR, meta }))
      .catch((e) => { console.error('fotos de costas', e); loading = null; return null; });
  }
  return loading;
}
export const getBackPhotos = () => photos;
