/** Decoração de cenário (atrás e na frente do gameplay). Tudo procedural e barato. */
import { barkTrunk, CITY_LEAVES, foliage } from './foliage';
import { glowSprite, softDot, drawSpr, OUT } from './kit';
import { Rng, clamp, shade } from '../core/math';
import type { DecoSpawn } from '../game/level';
import { getArt } from './index';
import { JUNGLE_BOUNDS, jungleVariants, paintJungle, setDecoAt } from './jungleDecor';
import { STORY_BOUNDS, paintStoryProp } from './storyProps';
import { VILLAGE_BOUNDS, paintVillageProp } from './village';
import { ATLANTIS_BOUNDS, paintAtlantis } from './atlantisDecor';
import { LAKE_BOUNDS, LAKE_EXTENTS, paintLake } from './lake/lakeFlora';
import { paintBuilding } from './buildings';
import { drawWindFlag, drawWindSprite, windAt, windFlex, windTip } from './wind';

const rngCache = new Map<string, Rng>();
const seedOf = (d: DecoSpawn) => Math.floor(d.x * 7.13 + d.y * 3.1);

function neon(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, flick: number) {
  const spr = glowSprite(color, 32);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.5 * flick;
  g.drawImage(spr.c, x - w * 0.6, y - h * 0.6, w * 2.2, h * 2.2);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

/** Escala por tipo: os personagens cresceram, o cenário acompanha. */
const DECO_SCALE: Record<string, number> = {
  lampPost: 1.55,
  wreckCar: 1.7,
  crateStack: 1.45,
  fireBarrel: 1.4,
  pipes: 1.3,
  steam: 1.3,
  plant: 1.45,
  neonSign: 1.3,
  hologram: 1.3,
  banner: 1.25,
  facade: 1.35,
  fgFence: 1.5,
  fgPillar: 1.2,
  antenna: 1.25,
  vine: 1.2,
};

/**
 * Decorações 100% estáticas são desenhadas UMA vez numa imagem (na densidade de pixels da tela)
 * e depois só copiadas: mesmo visual, uma fração do custo (fachadas têm dezenas de janelas etc.).
 * As animadas (neon piscando, fogo, plantas balançando...) continuam desenhadas ao vivo.
 */
const STATIC_BOUNDS: Record<string, [number, number, number, number]> = {
  facade: [-66, -206, 84, 2],
  pipes: [-50, -46, 50, 2],
  fgPillar: [-20, -422, 20, 22],
  parkedCar: [-64, -54, 64, 6],
  bench: [-32, -40, 32, 2],
  dumpster: [-40, -52, 40, 2],
  hydrant: [-14, -42, 14, 2],
  powerPole: [-26, -174, 206, 4],
  trashCans: [-24, -38, 24, 2],
  shopFront: [-86, -114, 70, 12],
  streetTree: [-44, -122, 44, 2],
  kiosk: [-60, -82, 60, 8],
  crateStack: [-18, -58, 46, 2],
  ...JUNGLE_BOUNDS,
  ...STORY_BOUNDS,
  ...VILLAGE_BOUNDS,
  ...ATLANTIS_BOUNDS,
  ...LAKE_BOUNDS,
};
let decoDensity = 2;
const baked = new Map<string, HTMLCanvasElement>();
const MAX_BAKED = 120;
let bakeBudget = 2;
/** Chamado uma vez por quadro: limita quantas decorações novas são pré-desenhadas. */
export function resetDecoBudget(n = 2) {
  bakeBudget = n;
}

/** Densidade (px de tela por unidade) usada para pré-desenhar as decorações estáticas. */
export function setDecoDensity(dens: number) {
  const d = Math.max(1, Math.min(3.2, Math.round(dens * 4) / 4));
  if (d === decoDensity) return;
  decoDensity = d;
  baked.clear();
}

function bakedDeco(key: string, kind: string, seed: number, s: number, b: [number, number, number, number]): HTMLCanvasElement {
  const hit = baked.get(key);
  if (hit) return hit;
  const D = s * decoDensity;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil((b[2] - b[0]) * D));
  c.height = Math.max(1, Math.ceil((b[3] - b[1]) * D));
  const g = c.getContext('2d')!;
  g.scale(D, D);
  g.translate(-b[0], -b[1]);
  paintDeco(g, kind, seed, 0);
  baked.set(key, c);
  if (baked.size > MAX_BAKED) baked.delete(baked.keys().next().value as string);
  return c;
}

/** Escala final da decoração (a do spawn × a do tipo). */
export function decoScale(d: DecoSpawn) {
  return (d.scale ?? 1) * (DECO_SCALE[d.kind] ?? 1);
}

/** Bounds in world coordinates, including flips and the spawn's scale. */
export function decoExtent(d: DecoSpawn): [number, number, number, number] {
  const b = STATIC_BOUNDS[d.kind] ?? LAKE_EXTENTS[d.kind] ?? [-320, -512, 320, 320], s = decoScale(d);
  const margin = windFlex(d.kind) * 1.2 * s;
  return [d.x + (d.flip ? -b[2] : b[0]) * s - margin, d.y + b[1] * s,
    d.x + (d.flip ? -b[0] : b[2]) * s + margin, d.y + b[3] * s];
}

/**
 * Semente das decorações estáticas: as que não sorteiam nada usam uma imagem só para todas (antes
 * cada poste/banco/hidrante idêntico era assado de novo); o carro só varia a cor (5); fachadas,
 * lojas, árvores e pilhas de caixas ficam com 8 variações. Assim as imagens prontas cabem todas no
 * cache e nada é recriado enquanto o Nômad atravessa a cidade em alta velocidade.
 */
function bakeSeed(kind: string, seed: number) {
  switch (kind) {
    case 'parkedCar':
      return Math.abs(seed) % 5;
    case 'facade':
    case 'shopFront':
    case 'streetTree':
    case 'crateStack':
    case 'villageHome':
      return (Math.abs(seed) % 8) * 977 + 13;
    default: {
      const nv = jungleVariants(kind);
      return nv ? (Math.abs(seed) % nv) * 977 + 13 : 0;
    }
  }
}
type KeyedDeco = DecoSpawn & { _bk?: string; _bs?: number };

export function drawDeco(g: CanvasRenderingContext2D, d: DecoSpawn, t: number) {
  const s = (d.scale ?? 1) * (DECO_SCALE[d.kind] ?? 1);
  const b = STATIC_BOUNDS[d.kind];
  const kd = d as KeyedDeco;
  // chave da imagem pronta calculada uma vez por decoração (nada de strings novas por quadro)
  if (b && kd._bk === undefined) {
    kd._bs = d.variant ?? bakeSeed(d.kind, seedOf(d));
    kd._bk = d.kind + '|' + kd._bs + '|' + s;
  }
  const seed = b ? kd._bs! : seedOf(d);
  if (!b) setDecoAt(d.x, d.y, !!d.flip);
  g.save();
  g.translate(d.x, d.y);
  if (d.flip) g.scale(-1, 1);
  g.scale(s, s);
  const ready = b && typeof document !== 'undefined' ? baked.get(kd._bk!) : undefined;
  if (b && (ready || (typeof document !== 'undefined' && bakeBudget-- > 0))) {
    const image = ready ?? bakedDeco(kd._bk!, d.kind, seed, s, b);
    if (d.kind === 'jFlag') drawWindFlag(g, image, windTip(d.kind, d.x, t));
    else if (windFlex(d.kind)) drawWindSprite(g, image, b[0], b[1], b[2] - b[0], b[3] - b[1],
      Math.min(-2, b[1] * .22), windTip(d.kind, d.x, t) * (d.flip ? -1 : 1));
    else g.drawImage(image, b[0], b[1], b[2] - b[0], b[3] - b[1]);
  } else paintDeco(g, d.kind, seed, t, d.x);
  g.restore();
  void rngCache;
}

function paintDeco(g: CanvasRenderingContext2D, kind: string, seed: number, t: number, worldX = 0) {
  const wind = windAt(worldX, t);
  if (kind === 'jHut') { paintBuilding(g, seed, true); return; }
  if (paintAtlantis(g, kind, seed)) return;
  if (paintLake(g, kind, seed, t)) return;
  switch (kind) {
    case 'facade': {
      // prédio de fundo: reboco com faixas de andar, janelas emolduradas com vida dentro, sacada,
      // ar-condicionado, cano e letreiro vertical de neon (assado uma vez por variação)
      const w = 128;
      const h = 192;
      const r = new Rng(seed);
      const base = r.pick(['#2f2766', '#22305e', '#3a2452', '#1f3b52', '#33284a']);
      // telhado e lateral em perspectiva
      g.fillStyle = shade(base, 0.35);
      g.beginPath(); g.moveTo(-w/2,-h); g.lineTo(w/2,-h);
      g.lineTo(w/2+18,-h-12); g.lineTo(-w/2+18,-h-12); g.closePath(); g.fill();
      g.fillStyle = shade(base, -0.55);
      g.beginPath(); g.moveTo(w/2,-h); g.lineTo(w/2+18,-h-12);
      g.lineTo(w/2+18,-12); g.lineTo(w/2,0); g.closePath(); g.fill();
      // janelinhas na lateral
      g.fillStyle = 'rgba(255,207,122,0.35)';
      for (let yy = -h + 18; yy < -20; yy += 24) if (r.chance(0.5)) { g.beginPath(); g.moveTo(w/2+5, yy); g.lineTo(w/2+12, yy-5); g.lineTo(w/2+12, yy+5); g.lineTo(w/2+5, yy+10); g.closePath(); g.fill(); }
      const gr = g.createLinearGradient(0, -h, 0, 0);
      gr.addColorStop(0, shade(base, 0.18));
      gr.addColorStop(1, shade(base, -0.25));
      g.fillStyle = gr;
      g.fillRect(-w / 2, -h, w, h);
      // textura do reboco (manchas e respingos)
      for (let i = 0; i < 90; i++) {
        g.fillStyle = r.chance(0.5) ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.07)';
        g.fillRect(r.range(-w / 2, w / 2 - 3), r.range(-h, -2), r.range(1, 4), r.range(1, 3));
      }
      // escorridos de chuva sob as janelas
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < 6; i++) g.fillRect(r.range(-w / 2 + 6, w / 2 - 10), r.range(-h + 20, -60), 2, r.range(16, 40));
      // cornija e faixas de andar
      g.fillStyle = shade(base, 0.45);
      g.fillRect(-w / 2 - 3, -h, w + 3, 5);
      g.fillStyle = shade(base, -0.4);
      g.fillRect(-w / 2 - 3, -h + 5, w + 3, 2);
      const floors = 4;
      const fh = (h - 30) / floors;
      const cols = r.pick([2, 3, 3]);
      const ww = cols === 2 ? 30 : 22;
      const balconyFloor = r.int(0, floors - 2);
      for (let f = 0; f < floors; f++) {
        const fy = -h + 10 + f * fh;
        g.fillStyle = 'rgba(255,255,255,0.07)';
        g.fillRect(-w / 2, fy + fh - 3, w, 2);
        for (let c = 0; c < cols; c++) {
          const wx = -w / 2 + (w - cols * ww) / (cols + 1) * (c + 1) + c * ww;
          const wy = fy + 8;
          const wh = fh - 16;
          // moldura e peitoril
          g.fillStyle = shade(base, -0.5);
          g.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
          g.fillStyle = shade(base, 0.4);
          g.fillRect(wx - 3, wy + wh + 1, ww + 6, 2.5);
          const lit = r.chance(0.5);
          const warm = r.chance(0.6);
          const glass = g.createLinearGradient(0, wy, 0, wy + wh);
          if (lit) {
            glass.addColorStop(0, warm ? '#ffe2a0' : '#a8f4ff');
            glass.addColorStop(1, warm ? '#e8963a' : '#3aa8d8');
          } else {
            glass.addColorStop(0, '#2a2f5a');
            glass.addColorStop(1, '#0e0c26');
          }
          g.fillStyle = glass;
          g.fillRect(wx, wy, ww, wh);
          if (lit) {
            // vida dentro: cortina, planta ou silhueta
            const k = r.int(0, 2);
            g.fillStyle = 'rgba(40,20,40,0.55)';
            if (k === 0) { g.fillRect(wx, wy, ww * 0.3, wh); g.fillRect(wx + ww * 0.75, wy, ww * 0.25, wh); }
            else if (k === 1) { g.beginPath(); g.ellipse(wx + ww * 0.5, wy + wh - 6, 5, 7, 0, 0, Math.PI * 2); g.fill(); g.fillRect(wx + ww * 0.5 - 3, wy + wh - 4, 6, 4); }
            else { g.beginPath(); g.arc(wx + ww * 0.45, wy + wh * 0.45, 3.2, 0, Math.PI * 2); g.fill(); g.fillRect(wx + ww * 0.45 - 4, wy + wh * 0.45 + 3, 8, wh); }
          }
          // reflexo diagonal e caixilho
          g.fillStyle = 'rgba(255,255,255,0.14)';
          g.beginPath(); g.moveTo(wx + 2, wy + wh); g.lineTo(wx + ww * 0.45, wy); g.lineTo(wx + ww * 0.6, wy); g.lineTo(wx + ww * 0.15, wy + wh); g.closePath(); g.fill();
          g.fillStyle = shade(base, -0.5);
          g.fillRect(wx + ww / 2 - 0.8, wy, 1.6, wh);
          if (!lit && r.chance(0.4)) {
            // ar-condicionado pendurado
            g.fillStyle = '#9aa0b4';
            g.fillRect(wx + ww - 10, wy + wh - 4, 12, 8);
            g.fillStyle = '#5a5f74';
            for (let i = 0; i < 4; i++) g.fillRect(wx + ww - 9, wy + wh - 3 + i * 2, 10, 0.8);
          }
        }
        if (f === balconyFloor) {
          const by = fy + fh - 6;
          g.fillStyle = shade(base, 0.3);
          g.fillRect(-w / 2 + 6, by, w - 12, 3);
          g.strokeStyle = shade(base, 0.45);
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(-w / 2 + 6, by - 10); g.lineTo(w / 2 - 6, by - 10);
          for (let x = -w / 2 + 8; x < w / 2 - 6; x += 5) { g.moveTo(x, by - 10); g.lineTo(x, by); }
          g.stroke();
          // varal com roupas
          if (r.chance(0.6)) for (let i = 0; i < 4; i++) { g.fillStyle = r.pick(['#ff5a7a', '#ffd23a', '#7feaff', '#ffffff']); g.fillRect(-w / 2 + 16 + i * 14, by - 22, 7, 9); }
        }
      }
      // cano vertical e térreo com porta de enrolar
      g.fillStyle = '#4a4560';
      g.fillRect(-w / 2 + 3, -h + 8, 3, h - 8);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(-w / 2 + 3, -h + 8, 1, h - 8);
      g.fillStyle = '#2a2640';
      g.fillRect(-26, -22, 52, 22);
      g.fillStyle = '#3a3656';
      for (let y = -21; y < 0; y += 3) g.fillRect(-25, y, 50, 1.4);
      // letreiro vertical de neon
      const neonC = r.pick(['#ff4fd0', '#39f0ff', '#ffd23a', '#7a5cff']);
      g.fillStyle = '#120d33';
      g.fillRect(w / 2 - 14, -h + 30, 11, 70);
      g.strokeStyle = neonC;
      g.lineWidth = 1.6;
      g.strokeRect(w / 2 - 13, -h + 31, 9, 68);
      g.fillStyle = neonC;
      for (let i = 0; i < 4; i++) g.fillRect(w / 2 - 11.5, -h + 38 + i * 15, 6, 7);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(w / 2 - 16, -h, 16, h);
      break;
    }
    case 'bossPoster': {
      const art = getArt().felipao;
      const flick = 0.75 + 0.25 * Math.sin(t * 5 + seed);
      // postes
      g.fillStyle = '#20233a';
      g.fillRect(-26, -30, 4, 30);
      g.fillRect(22, -30, 4, 30);
      // painel
      g.fillStyle = '#0d0722';
      g.fillRect(-38, -128, 76, 100);
      g.save();
      g.beginPath();
      g.rect(-34, -112, 68, 70);
      g.clip();
      const bg = g.createLinearGradient(0, -112, 0, -42);
      bg.addColorStop(0, '#5a1240');
      bg.addColorStop(1, '#a8341f');
      g.fillStyle = bg;
      g.fillRect(-34, -112, 68, 70);
      drawSpr(g, art.upper, 0, -34, { sx: 0.5, sy: 0.5 });
      g.restore();
      g.strokeStyle = '#ff3a4a';
      g.globalAlpha = flick;
      g.lineWidth = 2.4;
      g.strokeRect(-36, -126, 72, 96);
      g.globalAlpha = 1;
      g.fillStyle = '#ffd23a';
      g.font = '400 11px "Lilita One", Impact, sans-serif';
      g.textAlign = 'center';
      g.fillText('PROCURADO', 0, -116);
      g.fillStyle = '#ffffff';
      g.font = '400 13px "Lilita One", Impact, sans-serif';
      g.fillText('FELIPÃO', 0, -32);
      neon(g, -36, -126, 72, 96, '#ff3a4a', flick * 0.6);
      break;
    }
    case 'garageWall': {
      // parede de fundo da garagem: painéis escuros com faixas de luz
      const w0 = 128;
      const h0 = 300;
      const gr = g.createLinearGradient(0, -h0, 0, 0);
      gr.addColorStop(0, '#120e2c');
      gr.addColorStop(1, '#241c52');
      g.fillStyle = gr;
      g.fillRect(-w0 / 2, -h0, w0, h0);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (let x = -w0 / 2 + 8; x < w0 / 2; x += 32) g.fillRect(x, -h0, 2, h0);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = -h0 + 30; y < 0; y += 60) g.fillRect(-w0 / 2, y, w0, 3);
      const fl = 0.6 + 0.4 * Math.sin(t * 2 + seed);
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(255,190,90,${0.18 * fl})`;
      g.fillRect(-w0 / 2 + 20, -h0 + 24, 6, 90);
      g.fillRect(w0 / 2 - 26, -h0 + 24, 6, 90);
      g.fillStyle = `rgba(90,240,255,${0.22 * fl})`;
      g.fillRect(-40, -110, 80, 3);
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'neonSign': {
      const flick = 0.8 + 0.2 * Math.sin(t * 12 + seed) * (Math.sin(t * 1.3 + seed) > 0.85 ? 0.3 : 1) + (Math.sin(t * 0.7 + seed) > 0.96 ? -0.6 : 0);
      const colors = ['#ff3fb4', '#39f0ff', '#b6ff3a', '#ffb83a'];
      const c = colors[seed & 3 & 3];
      g.fillStyle = '#12092e';
      g.fillRect(-22, -44, 44, 36);
      g.strokeStyle = c;
      g.lineWidth = 2;
      g.globalAlpha = clamp(flick, 0.2, 1);
      g.strokeRect(-19, -41, 38, 30);
      g.fillStyle = c;
      g.fillRect(-11, -33, 22, 3);
      g.fillRect(-11, -26, 15, 3);
      g.fillRect(-11, -19, 19, 3);
      g.globalAlpha = 1;
      neon(g, -20, -42, 40, 32, c, clamp(flick, 0, 1));
      g.fillStyle = '#12092e';
      g.fillRect(-2, -8, 4, 8);
      break;
    }
    case 'lampPost': {
      g.fillStyle = '#2c2560';
      g.fillRect(-2, -70, 4, 70);
      g.fillRect(-2, -70, 16, 3);
      g.fillStyle = '#ffe9a8';
      g.fillRect(8, -68, 10, 3);
      const spr = glowSprite('#ffd7a0', 32);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.55 + 0.1 * Math.sin(t * 3 + seed);
      g.drawImage(spr.c, -10, -90, 60, 60);
      g.globalAlpha = 0.14;
      g.beginPath();
      g.moveTo(9, -66);
      g.lineTo(17, -66);
      g.lineTo(46, 0);
      g.lineTo(-20, 0);
      g.closePath();
      g.fillStyle = '#ffd7a0';
      g.fill();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'banner': {
      // bandeira da Legião ondulando
      g.fillStyle = '#2c2560';
      g.fillRect(-1.5, -96, 3, 96);
      g.beginPath();
      g.moveTo(1.5, -94);
      const n = 8;
      for (let i = 0; i <= n; i++) g.lineTo(1.5 + i * 6.5, -94 + Math.sin(t * 4 - i * .7 + seed) * (2 + wind * 3) * i / n + i * .4);
      for (let i = n; i >= 0; i--) g.lineTo(1.5 + i * 6.5, -62 + Math.sin(t * 4 - i * .7 + seed) * (2 + wind * 3) * i / n + i * .4);
      g.closePath();
      g.fillStyle = '#b13a8c';
      g.fill();
      g.strokeStyle = '#170f2e';
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = '#ffb83a';
      g.beginPath();
      g.moveTo(16, -84);
      g.lineTo(30, -76);
      g.lineTo(16, -68);
      g.closePath();
      g.fill();
      break;
    }
    case 'steam': {
      g.fillStyle = '#3a3f55';
      g.fillRect(-7, -10, 14, 10);
      g.fillStyle = '#586082';
      g.fillRect(-9, -13, 18, 4);
      const puff = softDot('#dcd6ee', 16);
      for (let i = 0; i < 5; i++) {
        const ph = ((t * 0.9 + i * 0.2 + seed * 0.07) % 1);
        g.globalAlpha = (1 - ph) * 0.5;
        const r = 5 + ph * 15;
        g.drawImage(puff.c, -r + Math.sin(ph * 6 + i) * 4 + wind * ph * 24, -14 - ph * 46 - r, r * 2, r * 2);
      }
      g.globalAlpha = 1;
      break;
    }
    case 'pipes': {
      g.fillStyle = '#4a5074';
      for (let i = 0; i < 3; i++) {
        g.fillRect(-48, -34 - i * 9, 96, 6);
        g.fillStyle = 'rgba(255,255,255,0.14)';
        g.fillRect(-48, -34 - i * 9, 96, 1.6);
        g.fillStyle = '#4a5074';
      }
      g.fillStyle = '#2c3252';
      for (let x = -40; x <= 40; x += 26) g.fillRect(x, -44, 4, 40);
      g.fillStyle = '#e2384a';
      g.fillRect(30, -40, 8, 3);
      break;
    }
    case 'hologram': {
      const flick = 0.75 + 0.25 * Math.sin(t * 6 + seed);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5 * flick;
      const gr = g.createLinearGradient(0, -90, 0, -20);
      gr.addColorStop(0, 'rgba(60,240,255,0.55)');
      gr.addColorStop(1, 'rgba(60,240,255,0.08)');
      g.fillStyle = gr;
      g.fillRect(-34, -90, 68, 70);
      g.globalAlpha = 0.9 * flick;
      g.strokeStyle = '#7ff9ff';
      g.lineWidth = 1.2;
      g.strokeRect(-34, -90, 68, 70);
      for (let i = 0; i < 5; i++) {
        g.fillStyle = '#c8ffff';
        g.fillRect(-26, -82 + i * 12, 20 + ((i * 17 + Math.floor(t * 3)) % 24), 3);
      }
      g.fillStyle = '#ff8ad4';
      g.fillRect(-26, -84 + 60, 52, 3);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#3a3f55';
      g.fillRect(-10, -20, 20, 5);
      break;
    }
    case 'fireBarrel': {
      g.fillStyle = '#4a3a3a';
      g.fillRect(-9, -26, 18, 26);
      g.fillStyle = '#2a2020';
      g.fillRect(-9, -22, 18, 2);
      g.fillRect(-9, -12, 18, 2);
      const spr = glowSprite('#ff9a3a', 32);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const ph = (t * 3 + i * 0.25 + seed) % 1;
        g.globalAlpha = 1 - ph;
        const r = 9 - ph * 5;
        g.drawImage(spr.c, -r + Math.sin(t * 9 + i) * 3 + wind * ph * 9, -26 - ph * 26 - r, r * 2, r * 2.4);
      }
      g.globalAlpha = 0.35;
      g.drawImage(spr.c, -34, -60, 68, 68);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'plant': {
      const r = new Rng(seed);
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * .32 + wind * .12 + Math.sin(t * 1.4 + i + seed) * .05;
        const L = r.range(20, 44);
        g.strokeStyle = i % 2 ? '#3f8a3f' : '#2f6f38';
        g.lineWidth = 4;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(Math.cos(a) * L * 0.5, Math.sin(a) * L * 0.6, Math.cos(a + 0.5) * L, Math.sin(a + 0.5) * L * 0.6 + L * 0.2);
        g.stroke();
      }
      break;
    }
    case 'vine': {
      const r = new Rng(seed);
      g.strokeStyle = '#2f6f38';
      g.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 8;
        const L = r.range(30, 70);
        g.beginPath();
        g.moveTo(x, 0);
        g.quadraticCurveTo(x + Math.sin(t * 1.2 + i) * 4, L * 0.5, x + Math.sin(t * 1.2 + i + 1) * 3, L);
        g.stroke();
        g.fillStyle = '#4fa04a';
        for (let k = 1; k < 5; k++) g.fillRect(x + Math.sin(t * 1.2 + i + k) * 3 - 2, (L / 5) * k, 5, 3);
      }
      break;
    }
    case 'spotlight': {
      g.fillStyle = '#3a3f55';
      g.fillRect(-4, -8, 8, 8);
      g.globalCompositeOperation = 'lighter';
      const a = -Math.PI / 2 + Math.sin(t * 0.8 + seed) * 0.5;
      g.fillStyle = 'rgba(200,240,255,0.10)';
      g.beginPath();
      g.moveTo(0, -8);
      g.lineTo(Math.cos(a - 0.09) * 200, -8 + Math.sin(a - 0.09) * 200);
      g.lineTo(Math.cos(a + 0.09) * 200, -8 + Math.sin(a + 0.09) * 200);
      g.closePath();
      g.fill();
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'arrow': {
      const pulse = 0.6 + 0.4 * Math.sin(t * 5);
      g.fillStyle = '#12092e';
      g.fillRect(-16, -34, 32, 22);
      g.fillStyle = '#39f0ff';
      g.globalAlpha = pulse;
      g.beginPath();
      g.moveTo(-9, -26);
      g.lineTo(4, -26);
      g.lineTo(4, -30);
      g.lineTo(13, -23);
      g.lineTo(4, -16);
      g.lineTo(4, -20);
      g.lineTo(-9, -20);
      g.closePath();
      g.fill();
      g.globalAlpha = 1;
      g.fillStyle = '#12092e';
      g.fillRect(-1.5, -12, 3, 12);
      break;
    }
    case 'crateStack': {
      const cols = ['#a06a3c', '#8a5a30', '#b07a44'];
      const r = new Rng(seed);
      const stack = [[0, 0], [30, 0], [15, -28]];
      stack.forEach(([x, y], i) => {
        g.fillStyle = cols[i % 3];
        g.fillRect(x - 15, y - 28, 28, 28);
        g.strokeStyle = '#170f2e';
        g.lineWidth = 1.2;
        g.strokeRect(x - 15, y - 28, 28, 28);
        g.beginPath();
        g.moveTo(x - 15, y - 28);
        g.lineTo(x + 13, y);
        g.moveTo(x + 13, y - 28);
        g.lineTo(x - 15, y);
        g.stroke();
      });
      void r;
      break;
    }
    case 'wreckCar': {
      g.fillStyle = '#2c2148';
      g.beginPath();
      g.moveTo(-50, -4);
      g.lineTo(-44, -20);
      g.lineTo(-20, -24);
      g.lineTo(-8, -36);
      g.lineTo(28, -36);
      g.lineTo(44, -22);
      g.lineTo(52, -14);
      g.lineTo(52, -4);
      g.closePath();
      g.fill();
      g.strokeStyle = '#170f2e';
      g.lineWidth = 1.4;
      g.stroke();
      g.fillStyle = '#ff7a2a';
      g.globalAlpha = 0.5 + 0.3 * Math.sin(t * 9 + seed);
      g.fillRect(-10, -33, 30, 3);
      g.globalAlpha = 1;
      const spr = glowSprite('#ff9a3a', 32);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const ph = (t * 2.6 + i * 0.33 + seed) % 1;
        g.globalAlpha = (1 - ph) * 0.9;
        const r = 10 - ph * 5;
        g.drawImage(spr.c, -6 + i * 12 - r, -36 - ph * 30 - r, r * 2, r * 2.4);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'waterfall': {
      g.fillStyle = '#4a5074';
      g.fillRect(-10, -80, 20, 8);
      const gr = g.createLinearGradient(0, -72, 0, 0);
      gr.addColorStop(0, 'rgba(140,240,255,0.85)');
      gr.addColorStop(1, 'rgba(120,200,255,0.35)');
      g.fillStyle = gr;
      g.fillRect(-6, -72, 12, 72);
      g.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 6; i++) g.fillRect(-4 + (i % 3) * 3, -72 + ((t * 90 + i * 22) % 72), 1.6, 12);
      const puff = softDot('#dff8ff', 16);
      g.globalAlpha = 0.5;
      g.drawImage(puff.c, -20, -12, 40, 24);
      g.globalAlpha = 1;
      break;
    }
    case 'crane3':
    case 'crane4':
    case 'crane5':
    case 'crane6':
    case 'crane7':
    case 'crane8': {
      // viga de aço pendurada por cabos no gancho de um guindaste (o guindaste fica lá no alto)
      const n = +kind.slice(5);
      const hw = n * 16;
      const sway = Math.sin(t * 0.8 + seed) * 2.5;
      const hy = -150;
      // alma da viga em I por baixo do piso
      g.fillStyle = '#2a3a48';
      g.fillRect(-hw + 2, 10, hw * 2 - 4, 5);
      g.fillStyle = '#3d5566';
      g.fillRect(-hw + 2, 15, hw * 2 - 4, 3);
      // placas zebradas nas pontas
      for (const s of [-1, 1]) {
        g.fillStyle = '#ffd23a';
        g.fillRect(s < 0 ? -hw : hw - 10, 2, 10, 8);
        g.fillStyle = '#1a1a1a';
        g.fillRect(s < 0 ? -hw + 3 : hw - 7, 2, 3, 8);
      }
      // lingas: cabos das pontas até o gancho
      g.strokeStyle = '#8a92b4';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(-hw + 6, 2);
      g.lineTo(sway - 4, hy + 18);
      g.moveTo(hw - 6, 2);
      g.lineTo(sway + 4, hy + 18);
      g.stroke();
      // gancho + moitão
      g.fillStyle = '#ffb83a';
      g.fillRect(sway - 9, hy - 6, 18, 20);
      g.fillStyle = '#1a1a1a';
      g.fillRect(sway - 9, hy + 2, 18, 3);
      g.strokeStyle = '#3a3f55';
      g.lineWidth = 2.6;
      g.beginPath();
      g.arc(sway, hy + 20, 5, -0.2, Math.PI + 0.6);
      g.stroke();
      // cabo de aço subindo até a lança (fora da tela)
      g.strokeStyle = '#8a92b4';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(sway - 3, hy - 6);
      g.lineTo(sway * 0.3 - 3, -760);
      g.moveTo(sway + 3, hy - 6);
      g.lineTo(sway * 0.3 + 3, -760);
      g.stroke();
      // luz de aviso piscando no moitão
      if (Math.sin(t * 4 + seed) > 0.3) neon(g, sway - 2, hy - 10, 4, 4, '#ff3a2a', 1);
      break;
    }
    case 'antenna': {
      g.strokeStyle = '#2c2560';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -90);
      g.stroke();
      g.lineWidth = 1.5;
      for (let y = -12; y > -88; y -= 14) {
        g.beginPath();
        g.moveTo(-8, y);
        g.lineTo(8, y);
        g.stroke();
      }
      g.fillStyle = Math.sin(t * 4 + seed) > 0 ? '#ff3a4a' : '#5a1020';
      g.beginPath();
      g.arc(0, -92, 2.2, 0, 6.3);
      g.fill();
      break;
    }
    case 'cables': {
      g.strokeStyle = '#1a1240';
      g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(-60, -60 - i * 6);
        g.quadraticCurveTo(0, -30 + i * 8 + Math.sin(t * 0.8 + i) * 2, 60, -60 - i * 6);
        g.stroke();
      }
      break;
    }
    case 'fgPillar': {
      const gr = g.createLinearGradient(-14, 0, 14, 0);
      gr.addColorStop(0, '#0e0a26');
      gr.addColorStop(0.5, '#1c1544');
      gr.addColorStop(1, '#0a071c');
      g.fillStyle = gr;
      g.fillRect(-14, -420, 28, 440);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect(-14, -420, 3, 440);
      g.fillStyle = '#0a071c';
      g.fillRect(-18, -20, 36, 20);
      break;
    }
    case 'fgCable': {
      g.strokeStyle = '#0b0820';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-90, -170);
      g.quadraticCurveTo(0, -110 + Math.sin(t * 0.7 + seed) * 3, 90, -170);
      g.stroke();
      break;
    }
    case 'fgLeaves': {
      const r = new Rng(seed);
      g.fillStyle = '#12301f';
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.34 + Math.sin(t * 1.1 + i) * 0.04;
        const L = r.range(40, 96);
        g.save();
        g.rotate(a + Math.PI / 2);
        g.beginPath();
        g.ellipse(0, -L / 2, 7, L / 2, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      break;
    }
    case 'fgFence': {
      g.strokeStyle = '#0d0a22';
      g.lineWidth = 1.6;
      for (let x = -64; x <= 64; x += 8) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, -40);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(-64, -34);
      g.lineTo(64, -34);
      g.moveTo(-64, -8);
      g.lineTo(64, -8);
      g.stroke();
      break;
    }

    case 'parkedCar': {
      // carro inteiro estacionado (cor pela semente)
      const cols = ['#d94a7a', '#3aa6d9', '#e0a02a', '#6a5ad9', '#3ad9a0'];
      const col = cols[Math.abs(seed) % cols.length];
      g.fillStyle = '#120d2a';
      g.beginPath();
      g.ellipse(0, 0, 62, 4, 0, 0, 6.283);
      g.fill();
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(-58, -8);
      g.lineTo(-56, -26);
      g.lineTo(-30, -30);
      g.lineTo(-16, -50);
      g.lineTo(26, -50);
      g.lineTo(44, -30);
      g.lineTo(58, -26);
      g.lineTo(58, -8);
      g.closePath();
      g.fill();
      g.strokeStyle = '#170f2e';
      g.lineWidth = 1.8;
      g.stroke();
      g.fillStyle = '#243a5a';
      g.beginPath();
      g.moveTo(-12, -32);
      g.lineTo(-2, -46);
      g.lineTo(22, -46);
      g.lineTo(34, -32);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(-8, -44, 6, 10);
      g.fillStyle = '#111';
      for (const wx of [-36, 34]) {
        g.beginPath();
        g.arc(wx, -8, 10, 0, 6.283);
        g.fill();
        g.fillStyle = '#8a86a8';
        g.beginPath();
        g.arc(wx, -8, 4.5, 0, 6.283);
        g.fill();
        g.fillStyle = '#111';
      }
      g.fillStyle = '#ffe9a8';
      g.fillRect(54, -24, 5, 5);
      g.fillStyle = '#ff4a5a';
      g.fillRect(-59, -24, 4, 5);
      break;
    }
    case 'bench': {
      g.fillStyle = '#3a2f5c';
      g.fillRect(-30, -20, 60, 6);
      g.fillRect(-30, -38, 60, 5);
      g.fillStyle = '#2a2244';
      g.fillRect(-27, -14, 4, 14);
      g.fillRect(23, -14, 4, 14);
      g.fillRect(-27, -38, 4, 20);
      g.fillRect(23, -38, 4, 20);
      g.strokeStyle = '#170f2e';
      g.lineWidth = 1.2;
      g.strokeRect(-30, -20, 60, 6);
      break;
    }
    case 'dumpster': {
      g.fillStyle = '#2f7a5a';
      g.fillRect(-36, -44, 72, 40);
      g.fillStyle = '#245f46';
      g.fillRect(-38, -50, 76, 8);
      g.fillStyle = '#1c4a37';
      for (let x = -28; x < 34; x += 14) g.fillRect(x, -40, 3, 32);
      g.fillStyle = '#111';
      g.fillRect(-30, -4, 8, 4);
      g.fillRect(22, -4, 8, 4);
      g.strokeStyle = '#170f2e';
      g.lineWidth = 1.6;
      g.strokeRect(-36, -44, 72, 40);
      break;
    }
    case 'hydrant': {
      g.fillStyle = '#e0453a';
      g.fillRect(-7, -32, 14, 32);
      g.beginPath();
      g.arc(0, -32, 8, Math.PI, 0);
      g.fill();
      g.fillRect(-12, -22, 24, 6);
      g.fillStyle = '#ffd23a';
      g.fillRect(-9, -8, 18, 3);
      g.strokeStyle = '#170f2e';
      g.lineWidth = 1.2;
      g.strokeRect(-7, -32, 14, 32);
      break;
    }
    case 'trafficLight': {
      g.fillStyle = '#2c2560';
      g.fillRect(-2.5, -120, 5, 120);
      g.fillRect(-2.5, -120, 34, 4);
      g.fillStyle = '#17112f';
      g.fillRect(24, -118, 16, 40);
      const ph = Math.floor((t * 0.5 + seed * 0.13) % 3);
      const cols = ['#ff3a4a', '#ffd23a', '#3aff8a'];
      for (let i = 0; i < 3; i++) {
        g.fillStyle = i === ph ? cols[i] : '#2a2444';
        g.beginPath();
        g.arc(32, -108 + i * 12, 4.5, 0, 6.283);
        g.fill();
      }
      const spr = glowSprite(cols[ph], 32);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.6;
      g.drawImage(spr.c, 12, -128 + ph * 12, 40, 40);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'busStop': {
      g.fillStyle = '#2c2560';
      g.fillRect(-52, -104, 4, 104);
      g.fillRect(48, -104, 4, 104);
      g.fillStyle = '#3a3378';
      g.fillRect(-58, -112, 116, 8);
      g.fillStyle = 'rgba(120,220,255,0.10)';
      g.fillRect(-48, -104, 96, 84);
      const flick = 0.75 + 0.25 * Math.sin(t * 4 + seed);
      g.fillStyle = '#ff3fb4';
      g.globalAlpha = flick;
      g.fillRect(24, -98, 22, 60);
      g.fillStyle = '#ffe9a8';
      g.fillRect(28, -92, 14, 4);
      g.fillRect(28, -84, 14, 3);
      g.globalAlpha = 1;
      neon(g, 24, -98, 22, 60, '#ff3fb4', flick * 0.6);
      g.fillStyle = '#3a2f5c';
      g.fillRect(-40, -22, 50, 5);
      g.fillRect(-36, -17, 4, 17);
      g.fillRect(2, -17, 4, 17);
      break;
    }
    case 'vending': {
      g.fillStyle = '#2a4a9a';
      g.fillRect(-20, -70, 40, 70);
      g.strokeStyle = '#170f2e';
      g.lineWidth = 1.6;
      g.strokeRect(-20, -70, 40, 70);
      g.fillStyle = '#9fe9ff';
      g.globalAlpha = 0.8 + 0.15 * Math.sin(t * 5 + seed);
      g.fillRect(-15, -64, 22, 44);
      g.globalAlpha = 1;
      const r = new Rng(seed);
      for (let i = 0; i < 12; i++) {
        g.fillStyle = r.pick(['#ff5a7a', '#ffd23a', '#7aff9a', '#ff9a3a']);
        g.fillRect(-13 + (i % 3) * 7, -62 + Math.floor(i / 3) * 10, 5, 7);
      }
      g.fillStyle = '#111a3a';
      g.fillRect(-15, -14, 22, 8);
      g.fillStyle = '#ffd23a';
      g.fillRect(11, -60, 5, 4);
      neon(g, -15, -64, 22, 44, '#7feaff', 0.6);
      break;
    }
    case 'powerPole': {
      g.fillStyle = '#3a2f5c';
      g.fillRect(-3, -170, 6, 170);
      g.fillRect(-22, -160, 44, 4);
      g.fillRect(-16, -140, 32, 3);
      g.strokeStyle = '#0d0a22';
      g.lineWidth = 1.4;
      for (const [x, y] of [[-20, -160], [20, -160], [-14, -140], [14, -140]]) {
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + 90, y + 34, x + 180, y + 4);
        g.stroke();
      }
      break;
    }
    case 'trashCans': {
      for (const [x, h] of [[-12, 30], [12, 26]] as const) {
        g.fillStyle = x < 0 ? '#5a6a8a' : '#4a5a7a';
        g.fillRect(x - 9, -h, 18, h);
        g.fillStyle = '#7a8aaa';
        g.fillRect(x - 11, -h - 4, 22, 5);
        g.strokeStyle = '#170f2e';
        g.lineWidth = 1.2;
        g.strokeRect(x - 9, -h, 18, h);
      }
      break;
    }
    case 'shopFront': {
      // loja de rua: parede de tijolo, letreiro com neon, toldo listrado com borda recortada,
      // vitrine com prateleiras e reflexo, porta de vidro e vaso de planta
      const r = new Rng(seed);
      const c1 = r.pick(['#ff5a7a', '#3aa6d9', '#ffb83a', '#7a5ad9', '#2fd68a']);
      const name = r.pick(['LOJA', 'PIZZA', 'CAFÉ', 'MERCADO', 'FARMÁCIA', 'BAR', 'AÇAÍ', 'PADARIA']);
      g.fillStyle = '#2a1f55';
      g.fillRect(-62, -110, 124, 110);
      // tijolos
      for (let y = -108, row = 0; y < -2; y += 6, row++) {
        for (let x = -62 + (row % 2 ? 7 : 0); x < 60; x += 14) {
          g.fillStyle = r.chance(0.5) ? '#33276a' : '#2e2361';
          g.fillRect(x + 0.6, y + 0.6, 12.8, 4.8);
        }
      }
      // letreiro
      g.fillStyle = '#140f33';
      g.fillRect(-46, -110, 92, 16);
      g.strokeStyle = c1;
      g.lineWidth = 1.6;
      g.strokeRect(-44, -108, 88, 12);
      g.fillStyle = '#ffffff';
      g.font = '400 10px "Lilita One", Impact, sans-serif';
      g.textAlign = 'center';
      g.fillText(name, 0, -98.5);
      g.globalAlpha = 0.35;
      g.fillStyle = c1;
      g.fillRect(-46, -94, 92, 3);
      g.globalAlpha = 1;
      // vitrine
      const vx = -50, vy = -68, vw = 66, vh = 50;
      g.fillStyle = '#1a1438';
      g.fillRect(vx - 3, vy - 3, vw + 6, vh + 6);
      const glass = g.createLinearGradient(0, vy, 0, vy + vh);
      glass.addColorStop(0, '#fff2c8');
      glass.addColorStop(1, '#f0b060');
      g.fillStyle = glass;
      g.fillRect(vx, vy, vw, vh);
      // prateleiras e produtos
      for (let s = 0; s < 3; s++) {
        const sy = vy + 14 + s * 15;
        g.fillStyle = '#8a5a3a';
        g.fillRect(vx + 2, sy, vw - 4, 2);
        for (let x = vx + 4; x < vx + vw - 6; x += r.range(5, 8)) {
          const ph = r.range(5, 10);
          g.fillStyle = r.pick(['#ff5a7a', '#3aa6d9', '#ffd23a', '#2fd68a', '#ffffff', '#7a5ad9']);
          g.fillRect(x, sy - ph, r.range(3, 5), ph);
        }
      }
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.moveTo(vx + 6, vy + vh); g.lineTo(vx + 26, vy); g.lineTo(vx + 34, vy); g.lineTo(vx + 14, vy + vh); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.beginPath(); g.moveTo(vx + 40, vy + vh); g.lineTo(vx + 58, vy); g.lineTo(vx + 61, vy); g.lineTo(vx + 43, vy + vh); g.closePath(); g.fill();
      // porta
      g.fillStyle = '#120d33';
      g.fillRect(22, -72, 30, 72);
      g.fillStyle = 'rgba(127,234,255,0.25)';
      g.fillRect(26, -68, 22, 40);
      g.fillStyle = '#ffd23a';
      g.fillRect(44, -36, 3, 7);
      g.fillStyle = c1;
      g.fillRect(28, -62, 18, 7);
      g.fillStyle = '#ffffff';
      g.font = '700 5px sans-serif';
      g.fillText('ABERTO', 37, -56.6);
      // toldo listrado com sombra e borda recortada
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? '#f6f0ff' : c1;
        g.beginPath();
        g.moveTo(-64 + i * 16, -90);
        g.lineTo(-64 + (i + 1) * 16, -90);
        g.lineTo(-66 + (i + 1) * 16.4, -76);
        g.quadraticCurveTo(-66 + (i + 0.5) * 16.4, -70, -66 + i * 16.4, -76);
        g.closePath();
        g.fill();
      }
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(-64, -90, 128, 4);
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(-64, -74, 128, 6);
      g.strokeStyle = OUT;
      g.lineWidth = 1;
      g.strokeRect(-64, -91, 128, 1);
      // calçada e vaso
      g.fillStyle = '#4a4466';
      g.fillRect(-64, -2, 128, 4);
      g.fillStyle = '#9a5a3a';
      g.beginPath(); g.moveTo(-60, -14); g.lineTo(-48, -14); g.lineTo(-50, 0); g.lineTo(-58, 0); g.closePath(); g.fill();
      foliage(g, r, -54, -22, 10, CITY_LEAVES, 4);
      neon(g, vx, vy, vw, vh, '#ffd7a0', 0.5);
      break;
    }
    case 'billboard': {
      g.fillStyle = '#2c2560';
      g.fillRect(-30, -60, 5, 60);
      g.fillRect(25, -60, 5, 60);
      g.fillStyle = '#0d0722';
      g.fillRect(-52, -120, 104, 60);
      const flick = 0.8 + 0.2 * Math.sin(t * 3 + seed);
      const gr = g.createLinearGradient(-48, -116, 48, -64);
      gr.addColorStop(0, '#ff3fb4');
      gr.addColorStop(1, '#39f0ff');
      g.fillStyle = gr;
      g.globalAlpha = flick;
      g.fillRect(-48, -116, 96, 52);
      g.globalAlpha = 1;
      g.fillStyle = '#fff';
      g.font = '400 16px "Lilita One", Impact, sans-serif';
      g.textAlign = 'center';
      g.fillText('KARIMBO', 0, -86);
      g.font = '400 8px "Lilita One", Impact, sans-serif';
      g.fillText('A CIDADE É NOSSA', 0, -72);
      neon(g, -48, -116, 96, 52, '#ff3fb4', flick * 0.5);
      break;
    }
    case 'roadBarrier': {
      g.fillStyle = '#e8e8f0';
      g.fillRect(-34, -30, 68, 14);
      g.fillStyle = '#ff7a2a';
      for (let x = -34; x < 30; x += 16) g.fillRect(x, -30, 8, 14);
      g.fillStyle = '#5a5674';
      g.fillRect(-28, -16, 5, 16);
      g.fillRect(23, -16, 5, 16);
      g.strokeStyle = '#170f2e';
      g.lineWidth = 1.2;
      g.strokeRect(-34, -30, 68, 14);
      const spr = glowSprite('#ffb83a', 32);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5 + 0.5 * Math.max(0, Math.sin(t * 6 + seed));
      g.drawImage(spr.c, -44, -52, 20, 20);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'streetTree': {
      // árvore de calçada: canteiro com grade, tronco com casca, galhos e copa volumosa
      const r = new Rng(seed);
      g.fillStyle = '#2a2440';
      g.fillRect(-18, -4, 36, 6);
      g.strokeStyle = '#6a6488';
      g.lineWidth = 1;
      for (let x = -16; x <= 16; x += 4) { g.beginPath(); g.moveTo(x, -4); g.lineTo(x, 2); g.stroke(); }
      barkTrunk(g, r, 0, -70, -2, 7, 10, '#5a4436');
      g.strokeStyle = '#4a3628';
      g.lineCap = 'round';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, -56); g.quadraticCurveTo(-10, -66, -18, -78);
      g.moveTo(1, -62); g.quadraticCurveTo(10, -72, 16, -86);
      g.stroke();
      foliage(g, r, -14, -80, 22, CITY_LEAVES, 6);
      foliage(g, r, 14, -86, 22, CITY_LEAVES, 6);
      foliage(g, r, 0, -96, 24, CITY_LEAVES, 7);
      break;
    }
    case 'kiosk': {
      g.fillStyle = '#2a2058';
      g.fillRect(-32, -70, 64, 70);
      g.fillStyle = '#ffd7a0';
      g.globalAlpha = 0.9;
      g.fillRect(-26, -52, 52, 26);
      g.globalAlpha = 1;
      for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 ? '#fff' : '#3aa6d9';
        g.fillRect(-36 + i * 12, -78, 12, 12);
      }
      g.fillStyle = '#ff5a7a';
      for (let i = 0; i < 5; i++) g.fillRect(-22 + i * 10, -48, 6, 8);
      neon(g, -26, -52, 52, 26, '#ffd7a0', 0.5);
      break;
    }
    default:
      if (!paintStoryProp(g, kind, seed) && !paintVillageProp(g, kind, seed)) paintJungle(g, kind, seed, t);
      break;
  }
}
