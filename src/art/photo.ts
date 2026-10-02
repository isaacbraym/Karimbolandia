/**
 * Personagens FOTOGRÁFICOS (Karimbo, Felipão, Nômad): carrega os recortes gerados por tools/*.py
 * e prepara sprites derivados. O rosto NUNCA é redesenhado: só recortado, ampliado (orelhas) e
 * levemente girado por projeção cilíndrica (para dar perspectiva lateral sem inventar feições).
 */
import { bake, makeCanvas, type Sprite } from './kit';

export interface CharMeta {
  head: { w: number; h: number };
  earL: { w: number; h: number; x: number; y: number; rootX: number };
  earR: { w: number; h: number; x: number; y: number; rootX: number };
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
  shapeJawAndNeck(cg, comp.width, H, PAD);

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
  // Traço fino só na silhueta externa. Na altura das orelhas, as bochechas
  // ficam sem contorno para a foto do rosto se unir às orelhas desenhadas atrás.
  const earTop = Math.min(p.meta.earL.y, p.meta.earR.y) * k * sc;
  const earBottom = Math.max(p.meta.earL.y + p.meta.earL.h, p.meta.earR.y + p.meta.earR.h) * k * sc;
  const joinPad = Math.max(p.meta.earL.h, p.meta.earR.h) * k * sc * 0.18;
  const rightOutlined = outlineSprite(right, 0.55, headH * 0.9, '#170f2e', [
    { x: -2, y: earTop - joinPad, w: logicalW + 4, h: earBottom - earTop + joinPad * 2 },
  ]);

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

  // retrato circular (HUD): cabeça inteira (com orelhas) centralizada, nada cortado
  const PR = 26; // raio do medalhão
  const portrait = bake(
    PR * 2 + 4,
    PR * 2 + 4,
    (g) => {
      const c = PR + 2;
      g.save();
      g.beginPath();
      g.arc(c, c, PR, 0, Math.PI * 2);
      g.clip();
      const bgr = g.createRadialGradient(c, c - 6, 4, c, c, PR);
      bgr.addColorStop(0, '#5a2f9a');
      bgr.addColorStop(1, '#26124a');
      g.fillStyle = bgr;
      g.fillRect(0, 0, c * 2, c * 2);
      const ph = PR * 2 - 3; // altura total da cabeça cabe no medalhão
      const pw = ph * (p.head.width / p.head.height);
      g.imageSmoothingQuality = 'high';
      g.drawImage(p.head, c - pw / 2, c - ph / 2 + 1, pw, ph);
      g.restore();
      g.beginPath();
      g.arc(c, c, PR, 0, Math.PI * 2);
      g.lineWidth = 2.6;
      g.strokeStyle = '#ffffff';
      g.stroke();
      g.lineWidth = 1;
      g.strokeStyle = '#170f2e';
      g.beginPath();
      g.arc(c, c, PR + 1.5, 0, Math.PI * 2);
      g.stroke();
    },
    { scale: 2, ox: PR + 2, oy: PR + 2 }
  );

  // ---- orelhas independentes (pivô no lóbulo, lado do rosto)
  const EAR_ROOT = 0.5; // base no meio da orelha (altura do rosto): cresce para os lados a partir daqui
  const mkEar = (img: HTMLImageElement, m: CharMeta['earL']): Sprite => {
    const ew = m.w * k * sc;
    const eh = m.h * k * sc;
    return bake(
      ew,
      eh,
      (g) => {
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, ew, eh);
      },
      { scale, ox: ew * m.rootX, oy: eh * EAR_ROOT }
    );
  };
  const earNear = outlineSprite(mkEar(p.earL, p.meta.earL), 0.45);
  const earFar = outlineSprite(mkEar(p.earR, p.meta.earR), 0.45);
  const rootY = (p.meta.earL.y * k + p.meta.earL.h * k * EAR_ROOT) * sc - right.oy;
  const rootYr = (p.meta.earR.y * k + p.meta.earR.h * k * EAR_ROOT) * sc - right.oy;
  const nearSrcX = PAD + (p.meta.earL.x + p.meta.earL.w * p.meta.earL.rootX) * k;
  const farSrcX = PAD + (p.meta.earR.x + p.meta.earR.w * p.meta.earR.rootX) * k;
  const toLog = (x: number) => f(x) * (logicalW / comp.width) - right.ox;

  return {
    right: rightOutlined,
    front,
    portrait,
    earNear,
    earFar,
    earRootNear: [toLog(nearSrcX), rootY],
    earRootFar: [toLog(farSrcX), rootYr],
    earH: earNear.h,
  };
}

/**
 * A foto acabava num retângulo largo de pele abaixo do queixo (parecia "colado" no corpo).
 * Aqui o queixo vira uma curva e sobra só um pescoço mais estreito, com sombra embaixo do queixo.
 */
function shapeJawAndNeck(g: CanvasRenderingContext2D, w: number, h: number, pad: number) {
  const W = w - pad * 2;
  const L = pad;
  const jawTop = h * 0.74;
  const chin = h * 0.905;
  const neckL = L + W * 0.31;
  const neckR = L + W * 0.69;
  g.save();
  g.globalCompositeOperation = 'destination-in';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(w, 0);
  g.lineTo(w, jawTop);
  // lado direito do maxilar descendo até o queixo
  g.bezierCurveTo(L + W * 0.86, h * 0.84, L + W * 0.7, chin, L + W * 0.5, chin);
  g.bezierCurveTo(L + W * 0.3, chin, L + W * 0.14, h * 0.84, 0, jawTop);
  g.closePath();
  g.fill();
  g.restore();
  // pescoço (atrás do queixo): mesma pele da foto, mais estreito e arredondado nas laterais
  g.save();
  g.globalCompositeOperation = 'destination-over';
  // amostra a cor da pele logo abaixo da boca
  const s = g.getImageData(Math.round(L + W * 0.5), Math.round(h * 0.84), 1, 1).data;
  const skin = `rgb(${s[0]},${s[1]},${s[2]})`;
  const gr = g.createLinearGradient(0, h * 0.8, 0, h);
  gr.addColorStop(0, `rgb(${Math.round(s[0] * 0.62)},${Math.round(s[1] * 0.58)},${Math.round(s[2] * 0.58)})`);
  gr.addColorStop(0.45, skin);
  gr.addColorStop(1, skin);
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(neckL, h * 0.8);
  g.quadraticCurveTo(neckL - W * 0.02, h * 0.93, neckL - W * 0.06, h);
  g.lineTo(neckR + W * 0.06, h);
  g.quadraticCurveTo(neckR + W * 0.02, h * 0.93, neckR, h * 0.8);
  g.closePath();
  g.fill();
  g.restore();
  // sombra do queixo sobre o pescoço
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const sh = g.createLinearGradient(0, chin - h * 0.01, 0, chin + h * 0.05);
  sh.addColorStop(0, 'rgba(40,20,10,0.35)');
  sh.addColorStop(1, 'rgba(40,20,10,0)');
  g.fillStyle = sh;
  g.fillRect(neckL - W * 0.08, chin - h * 0.01, neckR - neckL + W * 0.16, h * 0.06);
  g.restore();
}

/**
 * Copia do sprite com um contorno escuro em volta (silhueta engordada em 12 direções, por baixo).
 * `cutY` (lógico, a partir do topo): abaixo disso o contorno some (a base do pescoço entra na roupa).
 */
function outlineSprite(spr: Sprite, width = 1.1, cutY = Infinity, color = '#170f2e', openings: { x: number; y: number; w: number; h: number }[] = []): Sprite {
  const s = spr.s;
  const padL = Math.ceil(width + 1);
  const c = makeCanvas(spr.c.width + padL * 2 * s, spr.c.height + padL * 2 * s);
  const g = c.getContext('2d')!;
  // silhueta colorida
  const sil = makeCanvas(spr.c.width, spr.c.height);
  const sg = sil.getContext('2d')!;
  sg.drawImage(spr.c, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = color;
  sg.fillRect(0, 0, sil.width, sil.height);
  const o = padL * s;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.drawImage(sil, o + Math.cos(a) * width * s, o + Math.sin(a) * width * s);
  }
  if (Number.isFinite(cutY)) {
    // sem traço na base do pescoço
    g.clearRect(0, o + cutY * s, c.width, c.height);
  }
  // Recorta somente o traço extra; a foto original volta intacta por cima.
  for (const r of openings) g.clearRect(o + r.x * s, o + r.y * s, r.w * s, r.h * s);
  g.drawImage(spr.c, o, o);
  return { c, w: spr.w + padL * 2, h: spr.h + padL * 2, s, ox: spr.ox + padL, oy: spr.oy + padL };
}
