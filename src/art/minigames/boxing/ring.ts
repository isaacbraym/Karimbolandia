/**
 * O ringue da aldeia (arte assada UMA vez por tamanho de tela): fundo da praça borrado ao entardecer,
 * lona remendada de saco de farinha, cordas de cipó trançado com faixas de pano, postes de tronco com
 * lampiões e uma iluminação quente sobre o jacaré. Por quadro só se desenha a bandeirinha de festa
 * junina (balança) e o brilho dos lampiões (cintila): nenhum gradiente nem canvas novo.
 */
import { makeCanvas } from '../../kit';
import type { BoxLayout } from './layout';

const OUT = '#170f2e';
const CLOTH = ['#d9503a', '#e8c868', '#3f7d6b', '#7a3f6e', '#2f5c8a'];

interface RingArt {
  bg: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  /** lampiões: centros e raio do brilho */
  lamps: { x: number; y: number }[];
  /** bandeirinha: pontos da corda (catenária) e cor de cada flâmula */
  bunting: { x: number; y: number; c: number }[];
}
let cache: { key: string; art: RingArt; backdrop: HTMLCanvasElement | null } | null = null;

/** Posição de um ponto do chão (fração t do fundo à frente, lado −1/1) em tela. */
function floorEdge(L: BoxLayout, side: -1 | 1, yf: number) {
  const r = L.ring;
  const t = (yf - r.backY) / (r.frontY - r.backY);
  const xb = side < 0 ? r.x0 : r.x1;
  const xf = side < 0 ? r.fx0 : r.fx1;
  return xb + (xf - xb) * t;
}
/** altura aparente de uma corda a uma profundidade (perspectiva a partir da linha do horizonte) */
function ropeScale(L: BoxLayout, yf: number) {
  const r = L.ring;
  return (yf - r.horizonY) / (r.backY - r.horizonY);
}

export function drawRingArt(L: BoxLayout, backdrop: HTMLCanvasElement | null, k: number): RingArt {
  const { W, H, u, ring: r } = L;
  const key = `${W}x${H}x${k}`;
  if (cache && cache.key === key && cache.backdrop === backdrop) return cache.art;
  const c = makeCanvas(Math.ceil(W * k), Math.ceil(H * k));
  const g = c.getContext('2d')!;
  g.scale(k, k);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';

  // ---- 1) a praça ao fundo (retrato borrado do mundo) com entardecer
  if (backdrop) g.drawImage(backdrop, 0, 0, W, H);
  else { const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#3a2a6a'); sky.addColorStop(1, '#171033'); g.fillStyle = sky; g.fillRect(0, 0, W, H); }
  const dusk = g.createLinearGradient(0, 0, 0, r.backY);
  dusk.addColorStop(0, 'rgba(46,22,92,.62)'); dusk.addColorStop(0.7, 'rgba(240,120,60,.30)'); dusk.addColorStop(1, 'rgba(40,20,20,.35)');
  g.fillStyle = dusk; g.fillRect(0, 0, W, r.backY + 8 * u);
  // chão de terra batida fora do ringue
  const dirt = g.createLinearGradient(0, r.backY - 6 * u, 0, H);
  dirt.addColorStop(0, '#3d2c1e'); dirt.addColorStop(1, '#1b120b');
  g.fillStyle = dirt; g.fillRect(0, r.backY - 6 * u, W, H - r.backY + 6 * u);

  // ---- 2) lona do ringue (trapézio em perspectiva)
  g.save();
  g.beginPath();
  g.moveTo(r.x0, r.backY); g.lineTo(r.x1, r.backY); g.lineTo(r.fx1, r.frontY); g.lineTo(r.fx0, r.frontY); g.closePath();
  const lona = g.createLinearGradient(0, r.backY, 0, r.frontY);
  lona.addColorStop(0, '#8d7852'); lona.addColorStop(0.5, '#b49c6c'); lona.addColorStop(1, '#d2bb8a');
  g.fillStyle = lona; g.fill();
  g.clip();
  // remendos de saco de farinha e costuras (em perspectiva)
  const patch = (nx0: number, nx1: number, t0: number, t1: number, col: string) => {
    const pt = (nx: number, t: number): [number, number] => {
      const y = r.backY + (r.frontY - r.backY) * t;
      const xl = floorEdge(L, -1, y), xr = floorEdge(L, 1, y);
      return [xl + (xr - xl) * nx, y];
    };
    g.beginPath();
    const a = pt(nx0, t0), b = pt(nx1, t0), cc = pt(nx1, t1), d = pt(nx0, t1);
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(cc[0], cc[1]); g.lineTo(d[0], d[1]); g.closePath();
    g.fillStyle = col; g.fill();
    g.setLineDash([4 * u, 3 * u]); g.strokeStyle = 'rgba(60,40,20,.5)'; g.lineWidth = 1.1 * u; g.stroke(); g.setLineDash([]);
  };
  patch(0.1, 0.3, 0.2, 0.5, 'rgba(201,165,105,.55)');
  patch(0.62, 0.86, 0.08, 0.34, 'rgba(120,90,55,.35)');
  patch(0.34, 0.5, 0.58, 0.82, 'rgba(236,215,170,.35)');
  patch(0.72, 0.96, 0.6, 0.9, 'rgba(150,110,70,.35)');
  // tábuas sob a lona: linhas que convergem para o horizonte e faixas que se abrem para a frente
  g.strokeStyle = 'rgba(40,24,10,.10)'; g.lineWidth = 1 * u;
  for (let i = 1; i < 9; i++) {
    const nx = i / 9;
    g.beginPath(); g.moveTo(r.x0 + (r.x1 - r.x0) * nx, r.backY); g.lineTo(r.fx0 + (r.fx1 - r.fx0) * nx, r.frontY); g.stroke();
  }
  for (let i = 1; i < 11; i++) {
    const y = r.backY + (r.frontY - r.backY) * Math.pow(i / 11, 1.8);
    g.beginPath(); g.moveTo(floorEdge(L, -1, y), y); g.lineTo(floorEdge(L, 1, y), y); g.stroke();
  }
  // emblema pintado à mão no chão (achatado pela perspectiva)
  g.save();
  g.translate(W * 0.7, H * 0.915);
  g.scale(1, 0.34);
  g.font = `${36 * u}px "Lilita One","Rajdhani",Impact,sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6 * u; g.strokeStyle = 'rgba(70,30,20,.5)'; g.strokeText('KARIMBOLÂNDIA', 0, 0);
  g.fillStyle = 'rgba(217,80,58,.55)'; g.fillText('KARIMBOLÂNDIA', 0, 0);
  g.restore();
  // luz quente sobre o jacaré e escuridão nas bordas da lona
  const sp = g.createRadialGradient(L.gator.x, r.backY + (r.frontY - r.backY) * 0.2, 10 * u, L.gator.x, r.backY + (r.frontY - r.backY) * 0.3, W * 0.42);
  sp.addColorStop(0, 'rgba(255,224,160,.34)'); sp.addColorStop(1, 'rgba(255,224,160,0)');
  g.fillStyle = sp; g.fillRect(0, 0, W, H);
  g.restore();

  // faixa de borda da lona (vermelho e amarelo), mais larga para perto da câmera
  for (const side of [-1, 1] as const) {
    const band = (w0: number, w1: number, col: string) => {
      g.beginPath();
      const xb = side < 0 ? r.x0 : r.x1, xf = side < 0 ? r.fx0 : r.fx1;
      g.moveTo(xb, r.backY); g.lineTo(xf, r.frontY); g.lineTo(xf - side * w1, r.frontY); g.lineTo(xb - side * w0, r.backY); g.closePath();
      g.fillStyle = col; g.fill();
    };
    band(5 * u, 34 * u, '#a83a2c'); band(2 * u, 14 * u, '#e8c868');
  }
  g.beginPath(); g.rect(r.x0 - 4 * u, r.backY - 2 * u, r.x1 - r.x0 + 8 * u, 4.5 * u); g.fillStyle = '#a83a2c'; g.fill();
  g.fillStyle = '#e8c868'; g.fillRect(r.x0 - 4 * u, r.backY + 0.2 * u, r.x1 - r.x0 + 8 * u, 1.6 * u);

  // ---- 3) cordas de cipó e postes de tronco
  const lamps: { x: number; y: number }[] = [];
  const ropeTop = (side: -1 | 1, i: number): [number, number] => [side < 0 ? r.x0 : r.x1, r.backY - r.ropeH[i]];
  const vine = (x0: number, y0: number, x1: number, y1: number, sag: number, w: number) => {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + sag;
    g.lineCap = 'round';
    g.strokeStyle = OUT; g.lineWidth = w + 2.2 * u; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
    g.strokeStyle = '#6b4a2a'; g.lineWidth = w; g.stroke();
    g.strokeStyle = '#9a7440'; g.lineWidth = w * 0.38; g.setLineDash([w * 1.4, w * 1.1]); g.stroke(); g.setLineDash([]);
    // faixas de pano amarradas
    for (let j = 1; j <= 5; j++) {
      const t = j / 6, px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1, py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y1;
      g.fillStyle = CLOTH[(j + Math.round(x0)) % CLOTH.length];
      g.fillRect(px - 1.7 * u, py - w * 0.85, 3.4 * u, w * 1.7);
    }
  };
  // cordas do fundo
  for (let i = 0; i < 3; i++) { const a = ropeTop(-1, i), b = ropeTop(1, i); vine(a[0], a[1], b[0], b[1], 2.4 * u, (3.4 - i * 0.2) * u); }
  // cordas laterais: do poste até a borda da tela (a corda mais alta fica à altura do horizonte)
  for (const side of [-1, 1] as const) {
    const edgeY = r.backY + (r.frontY - r.backY) * ((0 - (side < 0 ? r.x0 : r.x1)) / ((side < 0 ? r.fx0 : r.fx1) - (side < 0 ? r.x0 : r.x1)));
    const yE = side < 0 ? edgeY : r.backY + (r.frontY - r.backY) * (((W) - r.x1) / (r.fx1 - r.x1));
    const sc = ropeScale(L, yE);
    for (let i = 0; i < 3; i++) {
      const a = ropeTop(side, i);
      vine(a[0], a[1], side < 0 ? -4 * u : W + 4 * u, yE - r.ropeH[i] * sc, 6 * u * Math.min(1.5, sc * 0.4), (3.6 + i * 0.2) * u * Math.min(1.8, sc * 0.55));
    }
  }
  // postes de tronco nos cantos de trás, com amarras de pano e lampião
  for (const side of [-1, 1] as const) {
    const px = side < 0 ? r.x0 : r.x1, base = r.backY + 2 * u, top = r.backY - r.ropeH[2] * 1.5, w = 9 * u;
    g.fillStyle = OUT; g.fillRect(px - w / 2 - 1.4 * u, top - 1.4 * u, w + 2.8 * u, base - top + 2.8 * u);
    const wood = g.createLinearGradient(px - w / 2, 0, px + w / 2, 0);
    wood.addColorStop(0, '#5a3a22'); wood.addColorStop(0.45, '#8a5e38'); wood.addColorStop(1, '#4a2e1a');
    g.fillStyle = wood; g.fillRect(px - w / 2, top, w, base - top);
    g.strokeStyle = 'rgba(30,16,8,.5)'; g.lineWidth = 1 * u;
    for (let j = 0; j < 6; j++) { const yy = top + ((base - top) * (j + 0.5)) / 6; g.beginPath(); g.moveTo(px - w / 2, yy); g.lineTo(px + w / 2, yy + 3 * u); g.stroke(); }
    for (let i = 0; i < 3; i++) { g.fillStyle = CLOTH[(i * 2 + (side < 0 ? 0 : 1)) % CLOTH.length]; g.fillRect(px - w / 2 - 1 * u, r.backY - r.ropeH[i] - 3 * u, w + 2 * u, 6 * u); }
    // lampião pendurado no poste
    g.strokeStyle = OUT; g.lineWidth = 2 * u; g.beginPath(); g.moveTo(px, top); g.lineTo(px + side * 9 * u, top - 4 * u); g.lineTo(px + side * 9 * u, top + 2 * u); g.stroke();
    const lx = px + side * 9 * u, ly = top + 9 * u;
    g.fillStyle = OUT; g.fillRect(lx - 5 * u, ly - 8 * u, 10 * u, 16 * u);
    g.fillStyle = '#ffd98a'; g.fillRect(lx - 3.5 * u, ly - 6 * u, 7 * u, 12 * u);
    lamps.push({ x: lx, y: ly });
  }

  // bandeirinha (só os pontos; a flâmula balança por quadro)
  const bunting: { x: number; y: number; c: number }[] = [];
  const bx0 = W * 0.025, bx1 = W * 0.975, by = H * 0.075, sag = H * 0.06;
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    bunting.push({ x: bx0 + (bx1 - bx0) * t, y: by + 4 * sag * t * (1 - t), c: i % CLOTH.length });
  }
  // postes de bambu das pontas da bandeirinha
  for (const px of [bx0, bx1]) {
    g.fillStyle = OUT; g.fillRect(px - 2.8 * u, by - 14 * u, 5.6 * u, r.backY - by + 20 * u);
    g.fillStyle = '#9a8a4a'; g.fillRect(px - 1.8 * u, by - 14 * u, 3.6 * u, r.backY - by + 20 * u);
    g.fillStyle = '#6b5a2a'; for (let j = 0; j < 7; j++) g.fillRect(px - 2.4 * u, by + j * 38 * u, 4.8 * u, 1.6 * u);
  }

  // vinheta
  const vg = g.createRadialGradient(W / 2, H * 0.52, H * 0.34, W / 2, H * 0.52, W * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,4,20,.62)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);

  // brilho dos lampiões (assado; desenhado com 'lighter' por quadro)
  const gs = Math.ceil(70 * u * 2);
  const glow = makeCanvas(gs, gs);
  const gg = glow.getContext('2d')!;
  const rg = gg.createRadialGradient(gs / 2, gs / 2, 2, gs / 2, gs / 2, gs / 2);
  rg.addColorStop(0, 'rgba(255,214,140,.9)'); rg.addColorStop(0.35, 'rgba(255,170,80,.35)'); rg.addColorStop(1, 'rgba(255,140,60,0)');
  gg.fillStyle = rg; gg.fillRect(0, 0, gs, gs);

  const art = { bg: c, glow, lamps, bunting };
  cache = { key, art, backdrop };
  return art;
}

/** Bandeirinha que balança e brilho dos lampiões: tudo o que se move do ringue (≈ 6 operações de desenho). */
export function drawRingLive(g: CanvasRenderingContext2D, L: BoxLayout, art: RingArt, t: number) {
  const { u } = L;
  // corda da bandeirinha
  g.strokeStyle = '#2a1a12'; g.lineWidth = 1.2 * u; g.beginPath();
  art.bunting.forEach((p, i) => { if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); });
  g.stroke();
  // flâmulas: 5 cores, um path por cor
  for (let c = 0; c < CLOTH.length; c++) {
    g.fillStyle = CLOTH[c];
    g.beginPath();
    for (let i = 0; i < art.bunting.length; i++) {
      const p = art.bunting[i];
      if (p.c !== c) continue;
      const sw = Math.sin(t * 2.1 + i * 0.9) * 2.2 * u;
      g.moveTo(p.x - 5 * u, p.y);
      g.lineTo(p.x + 5 * u, p.y);
      g.lineTo(p.x + sw, p.y + 12 * u);
      g.closePath();
    }
    g.fill();
  }
  // lampiões
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gw = art.glow.width / 2 / 1;
  for (let i = 0; i < art.lamps.length; i++) {
    const lp = art.lamps[i];
    g.globalAlpha = 0.72 + 0.2 * Math.sin(t * 7.3 + i * 2.1) * Math.sin(t * 3.1 + i);
    g.drawImage(art.glow, lp.x - gw / 2, lp.y - gw / 2, gw, gw);
  }
  g.restore();
}
