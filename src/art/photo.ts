/**
 * Personagens FOTOGRÁFICOS (Karimbo, Felipão, Nômad): carrega os recortes gerados por tools/*.py
 * e prepara sprites derivados. O rosto NUNCA é redesenhado: só recortado, ampliado (orelhas) e
 * levemente girado por projeção cilíndrica (para dar perspectiva lateral sem inventar feições).
 */
import { bake, makeCanvas, type Sprite } from './kit';

export interface CharMeta {
  head: { w: number; h: number };
  earL: { w: number; h: number; x: number; y: number };
  earR: { w: number; h: number; x: number; y: number };
  felipao: { w: number; h: number };
}
export interface NomadMeta {
  size: [number, number];
  cut: number;
  scale: number;
  sphere: { cx: number; cy: number; r: number; tex: number };
  muzzleA: [number, number];
  muzzleB: [number, number];
  cockpit: [number, number];
  turretPivot: [number, number];
}

export interface Photos {
  head: HTMLImageElement;
  earL: HTMLImageElement;
  earR: HTMLImageElement;
  felipao: HTMLImageElement;
  nomadUpper: HTMLImageElement;
  nomadFrame: HTMLImageElement;
  nomadSphere: HTMLImageElement;
  meta: CharMeta;
  nomadMeta: NomadMeta;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('Falha ao carregar ' + src));
    im.src = src;
  });
}

export async function loadPhotos(base: string, onProgress?: (p: number) => void): Promise<Photos> {
  const u = (n: string) => `${base}assets/img/${n}`;
  const names = ['karimbo_head.webp', 'karimbo_ear_l.webp', 'karimbo_ear_r.webp', 'felipao.webp', 'nomad_upper.webp', 'nomad_frame.webp', 'nomad_sphere.webp'];
  let done = 0;
  const imgs = await Promise.all(
    names.map((n) =>
      loadImage(u(n)).then((im) => {
        done++;
        onProgress?.(done / (names.length + 2));
        return im;
      })
    )
  );
  const [meta, nomadMeta] = await Promise.all([
    fetch(u('characters_meta.json')).then((r) => r.json() as Promise<CharMeta>),
    fetch(u('nomad_meta.json')).then((r) => r.json() as Promise<NomadMeta>),
  ]);
  onProgress?.(1);
  return {
    head: imgs[0],
    earL: imgs[1],
    earR: imgs[2],
    felipao: imgs[3],
    nomadUpper: imgs[4],
    nomadFrame: imgs[5],
    nomadSphere: imgs[6],
    meta,
    nomadMeta,
  };
}

/** Converte uma imagem em Sprite com tamanho lógico dado (para usar drawSpr/whiteOf). */
export function imageToSprite(img: HTMLImageElement, w: number, h: number, ox: number, oy: number, pxScale = 1): Sprite {
  const s = pxScale;
  const c = makeCanvas(Math.round(w * s), Math.round(h * s));
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, c.width, c.height);
  return { c, w, h, s, ox, oy };
}

// ------------------------------------------------------------------------------------------
export const KARIMBO_HEAD_H = 36; // altura lógica da cabeça no jogo (px)

export interface KarimboHeads {
  right: Sprite; // olhando para a direita (perspectiva), espelhar p/ esquerda
  front: Sprite; // frontal (retrato/HUD/menu)
  portrait: Sprite; // recorte circular p/ HUD
  /** Orelhas gigantes do EAR GLIDE (sprites com raiz de fixação) */
  earL: Sprite;
  earR: Sprite;
  /** raiz das orelhas na cabeça `right` (coordenadas lógicas relativas ao pivô do sprite) */
  earRootNear: [number, number];
  earRootFar: [number, number];
  /** tamanho lógico da orelha em repouso, p/ escala de glide */
  earH: number;
}

/**
 * Monta a cabeça: (1) foto + orelhas ampliadas 1.3x (ênfase); (2) perspectiva por projeção cilíndrica.
 */
export function bakeKarimboHeads(p: Photos, scale = 3): KarimboHeads {
  const src = p.head;
  const W = src.width;
  const H = src.height;
  const k = W / p.meta.head.w; // px imagem reduzida / px original
  const PAD = Math.round(W * 0.12);

  // ---- (1) foto + orelhas enfatizadas
  const comp = makeCanvas(W + PAD * 2, H);
  const cg = comp.getContext('2d')!;
  cg.imageSmoothingQuality = 'high';
  cg.drawImage(src, PAD, 0);
  const EAR_UP = 1.32;
  const EAR_ROOT = 0.8; // fração da altura onde a orelha 'dobra' (lóbulo)
  const drawEar = (img: HTMLImageElement, m: CharMeta['earL'], left: boolean) => {
    const ew = m.w * k;
    const eh = m.h * k;
    const ex = PAD + m.x * k;
    const ey = m.y * k;
    const rootX = left ? ex + ew : ex; // raiz fica do lado do rosto
    const rootY = ey + eh * EAR_ROOT;
    cg.save();
    cg.translate(rootX, rootY);
    cg.scale(EAR_UP, EAR_UP);
    cg.drawImage(img, ex - rootX, ey - rootY, ew, eh);
    cg.restore();
  };
  drawEar(p.earL, p.meta.earL, true);
  drawEar(p.earR, p.meta.earR, false);

  // ---- (2) yaw cilíndrico
  const yaw = 0.34; // ~19.5°
  const cx = comp.width / 2;
  const R = comp.width * 0.5 * 0.985;
  const yawed = makeCanvas(comp.width, H);
  const yg = yawed.getContext('2d')!;
  yg.imageSmoothingQuality = 'high';
  const f = (x: number) => cx + R * Math.sin(Math.asin(Math.max(-1, Math.min(1, (x - cx) / R))) + yaw);
  for (let x = 0; x < comp.width; x++) {
    const th = Math.asin(Math.max(-1, Math.min(1, (x + 0.5 - cx) / R)));
    if (th + yaw >= Math.PI / 2 - 0.01) continue; // parte de trás (ocluída)
    const d0 = f(x);
    const d1 = f(x + 1);
    const dw = Math.max(1.2, Math.abs(d1 - d0) + 0.6);
    yg.drawImage(comp, x, 0, 1, H, d0, 0, dw, H);
  }
  // reduz levemente a largura (perspectiva) e encaixa no sprite lógico
  const headH = KARIMBO_HEAD_H;
  const sc = headH / H;
  const logicalW = comp.width * sc * 0.93;
  const right = bake(
    logicalW,
    headH,
    (g) => {
      g.imageSmoothingQuality = 'high';
      g.drawImage(yawed, 0, 0, logicalW, headH);
    },
    { scale, ox: logicalW / 2 + 0.6, oy: headH * 0.94 }
  );

  const frontW = comp.width * sc;
  const front = bake(
    frontW,
    headH,
    (g) => {
      g.imageSmoothingQuality = 'high';
      g.drawImage(comp, 0, 0, frontW, headH);
    },
    { scale, ox: frontW / 2, oy: headH * 0.94 }
  );

  // ---- retrato circular (HUD): rosto sem orelhas gigantes
  const portrait = bake(
    48,
    48,
    (g) => {
      g.save();
      g.beginPath();
      g.arc(24, 24, 22, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = '#26124a';
      g.fillRect(0, 0, 48, 48);
      // enquadra do cabelo ao queixo, com orelhas
      const ph = 62;
      const pw = ph * (src.width / src.height) * 1.0;
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, 24 - pw / 2 + 0.5, 24 - ph * 0.5 + 1, pw, ph * 1.0);
      g.restore();
      g.beginPath();
      g.arc(24, 24, 22, 0, Math.PI * 2);
      g.lineWidth = 2.4;
      g.strokeStyle = '#ffffff';
      g.stroke();
      g.lineWidth = 1;
      g.strokeStyle = '#170f2e';
      g.beginPath();
      g.arc(24, 24, 23.4, 0, Math.PI * 2);
      g.stroke();
    },
    { scale: 2, ox: 24, oy: 24 }
  );

  // ---- orelhas gigantes do glide (raiz = pivô)
  const earHLogical = ((p.meta.earL.h * k) / H) * headH * EAR_UP;
  const mkEar = (img: HTMLImageElement, m: CharMeta['earL'], left: boolean): Sprite => {
    const ew = m.w * k * sc * EAR_UP;
    const eh = m.h * k * sc * EAR_UP;
    return bake(
      ew,
      eh,
      (g) => {
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, ew, eh);
      },
      { scale, ox: left ? ew * 0.97 : ew * 0.03, oy: eh * 0.8 }
    );
  };
  const earL = mkEar(p.earL, p.meta.earL, true);
  const earR = mkEar(p.earR, p.meta.earR, false);

  // raízes das orelhas no espaço do sprite `right` (relativo ao pivô)
  const rootYLogical = (p.meta.earL.y * k + p.meta.earL.h * k * 0.8) * sc - right.oy;
  const nearX = (PAD + (p.meta.earL.x + p.meta.earL.w) * k) * sc * 0.93 - right.ox + 0.5;
  const farX = (PAD + p.meta.earR.x * k) * sc * 0.93 - right.ox - 0.5;

  return {
    right,
    front,
    portrait,
    earL,
    earR,
    earRootNear: [nearX, rootYLogical],
    earRootFar: [farX, rootYLogical],
    earH: earHLogical,
  };
}
