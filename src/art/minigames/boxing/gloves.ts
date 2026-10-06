/**
 * Luvas de boxe dos dois lutadores, assadas uma vez em três visões: COSTAS (a luva vista por trás, em
 * guarda e nos retos), PERFIL (com o polegar à mostra: o arco do cruzado) e QUENTE (a de costas
 * avermelhada no impacto). O desenho encolhe a luva ao esticar o braço e solta rastros de movimento, o
 * que dá a perspectiva sem 3D. Estilos: Karimbo (vermelha), ouro (nota S) e jacaré (verde com garras).
 */
import { makeCanvas } from '../../kit';

/** `+onca`: punhos estampados de onça (enfeite de quem venceu sem cair) */
export type GloveStyle = 'karimbo' | 'ouro' | 'jacare' | 'karimbo+onca' | 'ouro+onca';
export type GloveView = 'costas' | 'perfil' | 'quente';
const OUT = '#170f2e';
/** unidades lógicas do quadro assado: a luva ocupa ~(GW × GH) com o punho (cuff) embaixo */
export const GW = 64, GH = 66;

interface Pal { hi: string; mid: string; lo: string; cuff: string; cuffStripe: string; text: string; claws: boolean; hotHi: string; hotMid: string }
const PAL: Record<'karimbo' | 'ouro' | 'jacare', Pal> = {
  karimbo: { hi: '#ff8f7c', mid: '#e0343a', lo: '#8f1422', cuff: '#f3efe2', cuffStripe: '#c4202e', text: '#c4202e', claws: false, hotHi: '#ffd0c4', hotMid: '#ff6f5f' },
  ouro: { hi: '#fff3a0', mid: '#f0b82e', lo: '#a86a10', cuff: '#fff7d8', cuffStripe: '#a86a10', text: '#a86a10', claws: false, hotHi: '#fffbd0', hotMid: '#ffd84a' },
  jacare: { hi: '#a8d878', mid: '#5f8a45', lo: '#2f4f26', cuff: '#e2d8a4', cuffStripe: '#3f6430', text: '#3f6430', claws: true, hotHi: '#e8ffc8', hotMid: '#9fe06a' },
};
const cache = new Map<string, HTMLCanvasElement>();

/** o estilo da luva do Karimbo conforme os enfeites ganhos */
export const gloveStyleFor = (perks: { goldGloves: boolean; leopardCuffs: boolean }): GloveStyle =>
  `${perks.goldGloves ? 'ouro' : 'karimbo'}${perks.leopardCuffs ? '+onca' : ''}` as GloveStyle;

/** estampa de onça num retângulo (rosetas marrons em fundo dourado) */
function leopard(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = '#e9ad3f'; g.fillRect(x, y, w, h);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) {
    const px = x + 2 + i * (w / 5.4) + (j % 2) * 2.6, py = y + 1.5 + j * (h / 2.6);
    g.fillStyle = '#6b3a14'; g.beginPath(); g.ellipse(px, py, 2.1, 1.6, 0.5 * (i + j), 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e9ad3f'; g.beginPath(); g.ellipse(px + 0.2, py, 0.9, 0.7, 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function bakeGlove(style: GloveStyle, view: GloveView, k: number): HTMLCanvasElement {
  const onca = style.endsWith('+onca');
  const base = (onca ? style.slice(0, -5) : style) as 'karimbo' | 'ouro' | 'jacare';
  const p = PAL[base];
  const c = makeCanvas(Math.ceil(GW * k), Math.ceil(GH * k));
  const g = c.getContext('2d')!;
  g.scale(k, k);
  g.lineJoin = 'round';
  const hot = view === 'quente';
  const body = (cx: number, cy: number, rx: number, ry: number, rot: number) => {
    // contorno + degradê (luz no alto à esquerda)
    g.fillStyle = OUT; g.beginPath(); g.ellipse(cx, cy, rx + 2.4, ry + 2.4, rot, 0, Math.PI * 2); g.fill();
    const gr = g.createRadialGradient(cx - rx * 0.35, cy - ry * 0.4, 2, cx, cy, Math.max(rx, ry) * 1.1);
    gr.addColorStop(0, hot ? p.hotHi : p.hi); gr.addColorStop(0.45, hot ? p.hotMid : p.mid); gr.addColorStop(1, p.lo);
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); g.fill();
  };
  if (view === 'perfil') {
    // visão de lado: corpo comprido, polegar colado, punho à esquerda
    body(34, 28, 26, 19, -0.08);
    // polegar
    g.fillStyle = OUT; g.beginPath(); g.ellipse(38, 44, 16.5, 8.6, 0.12, 0, Math.PI * 2); g.fill();
    const tg = g.createLinearGradient(0, 38, 0, 52); tg.addColorStop(0, p.mid); tg.addColorStop(1, p.lo);
    g.fillStyle = tg; g.beginPath(); g.ellipse(38, 44, 14.2, 6.3, 0.12, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(20,6,14,.45)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(20, 34); g.quadraticCurveTo(38, 38, 56, 33); g.stroke();
    // punho
    g.fillStyle = OUT; g.fillRect(2.5, 14, 14.5, 30);
    g.fillStyle = p.cuff; g.fillRect(4, 15.5, 11.5, 27);
    if (onca) leopard(g, 4, 15.5, 11.5, 27);
    g.fillStyle = p.cuffStripe; g.fillRect(4, 26, 11.5, 5);
  } else {
    // visão de costas: luva redonda de frente para quem olha, polegar na lateral, punho em baixo
    g.fillStyle = OUT; g.fillRect(17, 46, 30, 18.5);
    g.fillStyle = p.cuff; g.fillRect(18.5, 47.5, 27, 15.5);
    if (onca) leopard(g, 18.5, 47.5, 27, 15.5);
    g.fillStyle = p.cuffStripe; g.fillRect(18.5, 53, 27, 4.4);
    g.fillStyle = p.text; g.font = '800 7px "Lilita One",Impact,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (base === 'karimbo' && !onca) g.fillText('KRB', 32, 50.6);
    // polegar do lado de dentro
    g.fillStyle = OUT; g.beginPath(); g.ellipse(11.5, 34, 9.5, 14, 0.35, 0, Math.PI * 2); g.fill();
    g.fillStyle = hot ? '#ff6f5f' : p.mid; g.beginPath(); g.ellipse(11.5, 34, 7.2, 11.6, 0.35, 0, Math.PI * 2); g.fill();
    body(34, 27, 23.5, 25, 0);
    // costura em arco e brilho
    g.strokeStyle = 'rgba(20,6,14,.4)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(21, 43); g.quadraticCurveTo(34, 31, 47, 43); g.stroke();
    g.setLineDash([2.2, 2]); g.strokeStyle = 'rgba(255,240,230,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(21, 40.5); g.quadraticCurveTo(34, 28.5, 47, 40.5); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(25, 14, 8.5, 4.4, -0.55, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.ellipse(41, 18, 3.4, 2, -0.4, 0, Math.PI * 2); g.fill();
  }
  if (p.claws) {
    // garras do jacaré furando a ponta da luva
    g.fillStyle = OUT;
    for (const [x, y, r] of [[24, 4, -0.5], [34, 1.5, 0], [44, 4, 0.5]] as [number, number, number][]) {
      g.save(); g.translate(x, y); g.rotate(r);
      g.beginPath(); g.moveTo(-3.6, 3); g.quadraticCurveTo(0, -9.4, 3.6, 3); g.closePath(); g.fill();
      g.fillStyle = '#fbf6e4'; g.beginPath(); g.moveTo(-2.1, 2.6); g.quadraticCurveTo(0, -7, 2.1, 2.6); g.closePath(); g.fill(); g.fillStyle = OUT;
      g.restore();
    }
  }
  return c;
}

/** A luva assada (cache por estilo, visão e densidade de pixels). */
export function gloveImg(style: GloveStyle, view: GloveView, k: number): HTMLCanvasElement {
  const key = `${style}|${view}|${k.toFixed(1)}`;
  let c = cache.get(key);
  if (!c) { c = bakeGlove(style, view, k); cache.set(key, c); }
  return c;
}

/** Desenha a luva com o centro do punho (base do cuff) em (x, y), tamanho `w` (largura) e giro `rot`. */
export function drawGlove(g: CanvasRenderingContext2D, style: GloveStyle, view: GloveView, k: number, x: number, y: number, w: number, rot = 0, alpha = 1, flip = false) {
  const c = gloveImg(style, view, k);
  const s = w / GW;
  const prev = g.globalAlpha;
  if (alpha !== 1) g.globalAlpha = prev * alpha;
  g.save();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  if (flip) g.scale(-1, 1);
  g.drawImage(c, -GW * 0.5 * s, -GH * 0.78 * s, GW * s, GH * s);
  g.restore();
  g.globalAlpha = prev;
}
