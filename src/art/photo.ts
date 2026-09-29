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
  headNoEars: HTMLImageElement;
  earL: HTMLImageElement;
  earR: HTMLImageElement;
  felipao: HTMLImageElement;
  felipaoUpper: HTMLImageElement;
  felipaoLegL: HTMLImageElement;
  felipaoLegR: HTMLImageElement;
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
  const names = ['karimbo_head.webp', 'karimbo_ear_l.webp', 'karimbo_ear_r.webp', 'felipao.webp', 'nomad_upper.webp', 'nomad_frame.webp', 'nomad_sphere.webp', 'karimbo_head_noears.webp', 'felipao_upper.webp', 'felipao_legL.webp', 'felipao_legR.webp'];
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
    headNoEars: imgs[7],
    felipaoUpper: imgs[8],
    felipaoLegL: imgs[9],
    felipaoLegR: imgs[10],
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
export const KARIMBO_HEAD_H = 41; // altura lógica da cabeça (rosto em destaque)

export interface KarimboHeads {
  right: Sprite; // cabeça SEM orelhas, em perspectiva p/ a direita (espelhar p/ esquerda)
  front: Sprite; // frontal com orelhas (menu/debug)
  portrait: Sprite; // recorte circular p/ HUD
  /** orelhas como camadas independentes (pivô no lóbulo/raiz): crescem no EAR GLIDE */
  earNear: Sprite;
  earFar: Sprite;
  /** raiz das orelhas (relativa ao pivô do sprite `right`) */
  earRootNear: [number, number];
  earRootFar: [number, number];
  earH: number;
}

/**
 * Cabeça: foto sem orelhas + perspectiva por projeção cilíndrica. As orelhas são sprites à parte
 * (mesma textura da foto), posicionadas na raiz; assim o EAR GLIDE as faz crescer de verdade.
 */
export function bakeKarimboHeads(p: Photos, scale = 3): KarimboHeads {
  const src = p.headNoEars;
  const W = src.width;
  const H = src.height;
  const k = W / p.meta.head.w; // px reduzido / px original
  const PAD = 4;

  const comp = makeCanvas(W + PAD * 2, H);
  const cg = comp.getContext('2d')!;
  cg.imageSmoothingQuality = 'high';
  cg.drawImage(src, PAD, 0);

  // projeção cilíndrica (cabeça virada ~20° para a direita)
  const yaw = 0.34;
  const cx = comp.width / 2;
  const R = comp.width * 0.5 * 0.985;
  const yawed = makeCanvas(comp.width, H);
  const yg = yawed.getContext('2d')!;
  yg.imageSmoothingQuality = 'high';
  const f = (x: number) => cx + R * Math.sin(Math.asin(Math.max(-1, Math.min(1, (x - cx) / R))) + yaw);
  for (let x = 0; x < comp.width; x++) {
    const th = Math.asin(Math.max(-1, Math.min(1, (x + 0.5 - cx) / R)));
    if (th + yaw >= Math.PI / 2 - 0.01) continue;
    const d0 = f(x);
    const d1 = f(x + 1);
    const dw = Math.max(1.2, Math.abs(d1 - d0) + 0.6);
    yg.drawImage(comp, x, 0, 1, H, d0, 0, dw, H);
  }
  const headH = KARIMBO_HEAD_H;
  const sc = headH / H;
  const wsc = 0.94; // estreitamento p/ perspectiva
  const logicalW = comp.width * sc * wsc;
  const right = bake(
    logicalW,
    headH,
    (g) => {
      g.imageSmoothingQuality = 'high';
      g.drawImage(yawed, 0, 0, logicalW, headH);
    },
    { scale, ox: logicalW / 2 + 0.6, oy: headH * 0.94 }
  );

  // frontal com orelhas (foto original)
  const fw = (p.head.width / p.head.height) * headH;
  const front = bake(
    fw,
    headH,
    (g) => {
      g.imageSmoothingQuality = 'high';
      g.drawImage(p.head, 0, 0, fw, headH);
    },
    { scale, ox: fw / 2, oy: headH * 0.94 }
  );

  // retrato circular (HUD): rosto com orelhas
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
      const ph = 62;
      const pw = ph * (p.head.width / p.head.height);
      g.imageSmoothingQuality = 'high';
      g.drawImage(p.head, 24 - pw / 2 + 0.5, 24 - ph * 0.5 + 1, pw, ph);
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

  // ---- orelhas independentes (pivô no lóbulo, lado do rosto)
  const EAR_ROOT = 0.8;
  const mkEar = (img: HTMLImageElement, m: CharMeta['earL'], left: boolean): Sprite => {
    const ew = m.w * k * sc;
    const eh = m.h * k * sc;
    return bake(
      ew,
      eh,
      (g) => {
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, ew, eh);
      },
      { scale, ox: left ? ew * 0.985 : ew * 0.015, oy: eh * EAR_ROOT }
    );
  };
  const earNear = mkEar(p.earL, p.meta.earL, true);
  const earFar = mkEar(p.earR, p.meta.earR, false);
  const rootY = (p.meta.earL.y * k + p.meta.earL.h * k * EAR_ROOT) * sc - right.oy;
  const rootYr = (p.meta.earR.y * k + p.meta.earR.h * k * EAR_ROOT) * sc - right.oy;
  const nearSrcX = PAD + (p.meta.earL.x + p.meta.earL.w * 0.985) * k;
  const farSrcX = PAD + (p.meta.earR.x + p.meta.earR.w * 0.015) * k;
  const toLog = (x: number) => f(x) * (logicalW / comp.width) - right.ox;

  return {
    right,
    front,
    portrait,
    earNear,
    earFar,
    earRootNear: [toLog(nearSrcX), rootY],
    earRootFar: [toLog(farSrcX), rootYr],
    earH: earNear.h,
  };
}
