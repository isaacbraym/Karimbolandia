/**
 * Decoração da selva (fase 2): árvores gigantes, palmeiras, bananeiras, samambaias, juncos, mangue,
 * cipós, ruínas do templo (colunas, cabeças de pedra, totens, fachada, arco), acampamento dos
 * mercenários (barracas, fogueira, torre, paliçada, jipe, sacos de areia, caixas de munição),
 * a cachoeira e o fundo do lago (algas, arcos afundados, baú, estátua).
 * As estáticas são assadas uma vez pelo sistema de decorações; as animadas usam peças prontas.
 */
import { bake, glowSprite, softDot, shadedRR, poly, OUT, type Sprite } from './kit';
import { Rng, shade } from '../core/math';

/** Caixas (x0,y0,x1,y1) das decorações estáticas da selva — assadas em imagem. */
export const JUNGLE_BOUNDS: Record<string, [number, number, number, number]> = {
  jTree: [-96, -430, 96, 8],
  jPalm: [-84, -250, 84, 4],
  jPillar: [-30, -170, 30, 4],
  jFern: [-44, -46, 44, 2],
  jBush: [-50, -54, 50, 2],
  jRock: [-40, -40, 40, 4],
  jStump: [-28, -40, 28, 4],
  jCrates: [-44, -54, 44, 2],
  jStoneHead: [-48, -92, 48, 4],
  jRoots: [-64, -40, 64, 4],
  jTotem: [-22, -132, 22, 2],
  jBanana: [-56, -128, 56, 2],
  jFlowers: [-30, -30, 30, 2],
  jReeds: [-30, -70, 30, 4],
  jLily: [-34, -12, 34, 4],
  jMangrove: [-80, -210, 80, 10],
  jSign: [-24, -56, 24, 2],
  jHut: [-96, -150, 96, 104],
  jSkull: [-12, -64, 12, 2],
  uGrass: [-18, -34, 18, 2],
  uRock: [-34, -34, 34, 3],
  uArch: [-80, -150, 80, 3],
  uChest: [-22, -26, 22, 2],
  uBones: [-30, -16, 30, 2],
  uStatue: [-28, -96, 28, 3],
  jTower: [-60, -230, 60, 4],
  jPalisade: [-72, -100, 72, 4],
  jTent: [-64, -78, 64, 3],
  jGate: [-90, -200, 90, 4],
  jPost: [-12, -60, 12, 2],
  jTempleBack: [-230, -300, 230, 4],
  jJeep: [-70, -62, 70, 4],
  jSandbags: [-44, -30, 44, 2],
  jAmmo: [-30, -34, 30, 2],
  jFlag: [-6, -150, 60, 2],
  jBranch: [-176, -70, 20, 24],
  jDoorway: [-42, -90, 42, 2],
  jDoorExit: [-30, -74, 30, 2],
  jIdol: [-22, -52, 22, 2],
};

/** Quantas variações assadas por tipo (o resto da semente é ignorado). */
export function jungleVariants(kind: string): number {
  switch (kind) {
    case 'jTree':
      return 4;
    case 'jPalm':
    case 'jFern':
    case 'jBush':
    case 'jRock':
    case 'jBanana':
    case 'jReeds':
    case 'jFlowers':
    case 'uGrass':
    case 'uRock':
    case 'jStump':
    case 'jRoots':
      return 3;
    case 'jMangrove':
    case 'jTent':
    case 'jCrates':
      return 2;
    default:
      return 0;
  }
}

// ------------------------------------------------------------------ cores
const LEAF = ['#2f7a3a', '#3f9446', '#4fa64e', '#2a6a34'];
const LEAF_L = '#7fcf6a';
const LEAF_D = '#1d4a26';
const BARK = '#5a4030';
const BARK_D = '#3a281c';
const BARK_L = '#7a5a40';
const STONE = '#7f8a78';
const STONE_D = '#525c50';
const STONE_L = '#a8b29c';
const MOSS = '#5c9a38';
const CANVAS = '#6f6a46';

function leafBlade(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, wid: number, col: string, vein = true) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.45, -wid, len, 0);
  g.quadraticCurveTo(len * 0.45, wid, 0, 0);
  g.fillStyle = col;
  g.fill();
  g.lineWidth = 0.9;
  g.strokeStyle = 'rgba(10,30,14,0.55)';
  g.stroke();
  if (vein) {
    g.strokeStyle = 'rgba(200,255,170,0.35)';
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(1, 0);
    g.lineTo(len * 0.92, 0);
    g.stroke();
  }
  g.restore();
}

/** Fronde de samambaia/palmeira: haste curva com folíolos. */
function frond(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, droop: number, col: string, n = 9, lw = 4) {
  const ex = x + Math.cos(ang) * len;
  const ey = y + Math.sin(ang) * len + droop;
  const cx = x + Math.cos(ang) * len * 0.5;
  const cy = y + Math.sin(ang) * len * 0.5 - droop * 0.2;
  g.strokeStyle = shade(col, -0.25);
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(cx, cy, ex, ey);
  g.stroke();
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * ex;
    const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * ey;
    const l = lw * 2.4 * (1 - t * 0.6);
    const a = Math.atan2(ey - y, ex - x);
    leafBlade(g, px, py, l, a - 1.1, lw * 0.4, col, false);
    leafBlade(g, px, py, l, a + 1.1, lw * 0.4, shade(col, 0.08), false);
  }
}

function crownBlob(g: CanvasRenderingContext2D, r: Rng, x: number, y: number, rad: number) {
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < 8; i++) blobs.push([x + r.range(-1, 1) * rad, y + r.range(-0.5, 0.5) * rad * 0.7, rad * r.range(0.4, 0.7)]);
  g.fillStyle = LEAF_D;
  for (const [bx, by, br] of blobs) {
    g.beginPath();
    g.arc(bx, by + br * 0.2, br, 0, Math.PI * 2);
    g.fill();
  }
  for (const [bx, by, br] of blobs) {
    g.fillStyle = r.pick(LEAF);
    g.beginPath();
    g.arc(bx, by, br * 0.92, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(160,230,120,0.35)';
  for (const [bx, by, br] of blobs) {
    g.beginPath();
    g.arc(bx - br * 0.3, by - br * 0.35, br * 0.42, 0, Math.PI * 2);
    g.fill();
  }
}

function stoneBlock(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: Rng) {
  shadedRR(g, x, y, w, h, 2, STONE, { lw: 1.2 });
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(x + w * 0.65, y + 2, w * 0.3, h - 4);
  if (r.chance(0.6)) {
    g.fillStyle = MOSS;
    g.globalAlpha = 0.75;
    g.beginPath();
    g.ellipse(x + r.range(4, w - 4), y + 2, r.range(5, 12), 3, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ pintura das estáticas
/** Pinta uma decoração estática da selva; retorna false se o tipo não é da selva. */
export function paintJungle(g: CanvasRenderingContext2D, kind: string, seed: number, t: number): boolean {
  const r = new Rng(seed * 31 + 7);
  switch (kind) {
    case 'jTree': {
      // árvore gigante: tronco largo, raízes tabulares, epífitas, copa cortada no alto
      const tw = r.range(26, 38);
      const top = -410;
      g.fillStyle = BARK_D;
      g.beginPath();
      g.moveTo(-tw * 0.5, top);
      g.lineTo(tw * 0.5, top);
      g.lineTo(tw * 0.62, -40);
      g.lineTo(tw * 0.5, 0);
      g.lineTo(-tw * 0.5, 0);
      g.lineTo(-tw * 0.62, -40);
      g.closePath();
      g.fill();
      g.fillStyle = BARK;
      g.fillRect(-tw * 0.45, top, tw * 0.55, 400);
      g.fillStyle = BARK_L;
      g.fillRect(-tw * 0.4, top, tw * 0.14, 400);
      // casca
      g.strokeStyle = 'rgba(20,10,4,0.4)';
      g.lineWidth = 1;
      for (let y = top + 10; y < -10; y += r.range(12, 22)) {
        g.beginPath();
        g.moveTo(-tw * 0.4, y);
        g.quadraticCurveTo(0, y + 3, tw * 0.4, y - 1);
        g.stroke();
      }
      // raízes tabulares
      for (const s of [-1, 1]) {
        g.fillStyle = s < 0 ? BARK : BARK_D;
        g.beginPath();
        g.moveTo(s * tw * 0.4, -70);
        g.quadraticCurveTo(s * tw * 1.1, -20, s * tw * 2.3, 2);
        g.lineTo(s * tw * 0.3, 2);
        g.closePath();
        g.fill();
        g.strokeStyle = OUT;
        g.lineWidth = 1;
        g.stroke();
      }
      // trepadeira enrolada no tronco
      g.strokeStyle = '#2e6a2e';
      g.lineWidth = 2.4;
      g.beginPath();
      for (let y = top + 20; y < -20; y += 6) {
        const x = Math.sin(y * 0.05 + seed) * tw * 0.45;
        if (y === top + 20) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      for (let i = 0; i < 14; i++) {
        const y = top + 30 + i * 26;
        leafBlade(g, Math.sin(y * 0.05 + seed) * tw * 0.45, y, r.range(8, 13), r.range(-2.6, -0.4), 4, r.pick(LEAF));
      }
      // bromélias
      for (let i = 0; i < 3; i++) {
        const y = r.range(top + 60, -80);
        const x = r.range(-tw * 0.4, tw * 0.4);
        for (let k = 0; k < 6; k++) leafBlade(g, x, y, r.range(9, 14), -Math.PI / 2 + (k - 2.5) * 0.45, 3.4, k % 2 ? '#c84a5a' : '#5fa83a');
      }
      // galhos e copa no alto
      crownBlob(g, r, 0, top + 6, 70);
      crownBlob(g, r, r.range(-50, -30), top + 30, 40);
      crownBlob(g, r, r.range(30, 50), top + 24, 44);
      // samambaias na base
      for (let k = 0; k < 5; k++) frond(g, r.range(-20, 20), 0, r.range(26, 40), -Math.PI / 2 + (k - 2) * 0.55, 10, r.pick(LEAF), 7, 4);
      return true;
    }
    case 'jPalm': {
      const lean = r.range(-0.25, 0.25);
      const h = r.range(170, 220);
      const tx = Math.sin(lean) * h;
      // tronco em anéis
      for (let i = 0; i < 18; i++) {
        const k = i / 18;
        const x = tx * k * k;
        const y = -h * k;
        g.fillStyle = i % 2 ? '#8a6a44' : '#7a5a38';
        g.beginPath();
        g.ellipse(x, y, 7 - k * 2, 7, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(30,18,8,0.5)';
        g.lineWidth = 0.8;
        g.stroke();
      }
      // cocos
      g.fillStyle = '#5a3e1c';
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(tx + (i - 1) * 5, -h + 6, 3.6, 0, Math.PI * 2);
        g.fill();
      }
      // folhas
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI + (i / 8) * Math.PI + r.range(-0.15, 0.15);
        frond(g, tx, -h, r.range(60, 80), a, 26 + Math.abs(Math.cos(a)) * 18, r.pick(LEAF), 10, 5);
      }
      return true;
    }
    case 'jPillar': {
      // coluna do templo quebrada, com musgo e cipó
      const h = r.range(110, 160);
      for (let y = 0; y > -h; y -= 26) stoneBlock(g, -18, y - 26, 36, 26, r);
      // topo quebrado
      poly(g, [[-20, -h], [-8, -h - 10], [4, -h - 4], [20, -h - 12], [20, -h + 4], [-20, -h + 4]], STONE_L);
      // base
      shadedRR(g, -26, -12, 52, 12, 2, STONE_D, { lw: 1.2 });
      g.strokeStyle = '#2e6a2e';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-16, -h + 6);
      g.bezierCurveTo(10, -h * 0.7, -14, -h * 0.4, 12, -10);
      g.stroke();
      for (let i = 0; i < 6; i++) leafBlade(g, r.range(-14, 14), -h + 10 + i * (h / 6), 9, r.range(-2.8, -0.3), 3.6, r.pick(LEAF));
      return true;
    }
    case 'jFern': {
      const n = 7 + r.int(0, 3);
      for (let i = 0; i < n; i++) frond(g, r.range(-6, 6), 0, r.range(26, 42), -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.4, 12, r.pick(LEAF), 8, 4.4);
      return true;
    }
    case 'jBush': {
      crownBlob(g, r, 0, -24, 30);
      for (let i = 0; i < 6; i++) leafBlade(g, r.range(-30, 30), -6, r.range(14, 20), -Math.PI / 2 + r.range(-1.2, 1.2), 5, r.pick(LEAF));
      // flores/frutinhas
      const fc = r.pick(['#ff5a7a', '#ffd23a', '#ff8a3a', '#d06aff']);
      for (let i = 0; i < 7; i++) {
        g.fillStyle = fc;
        g.beginPath();
        g.arc(r.range(-28, 28), r.range(-46, -12), 2.4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.fillRect(r.range(-28, 28), r.range(-46, -12), 0.9, 0.9);
      }
      return true;
    }
    case 'jRock': {
      g.fillStyle = STONE_D;
      g.beginPath();
      g.moveTo(-36, 2);
      g.quadraticCurveTo(-38, -26, -12, -34);
      g.quadraticCurveTo(18, -40, 34, -16);
      g.quadraticCurveTo(40, -2, 36, 2);
      g.closePath();
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 1.3;
      g.stroke();
      g.fillStyle = STONE;
      g.beginPath();
      g.ellipse(-6, -22, 22, 10, -0.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = MOSS;
      g.beginPath();
      g.ellipse(-4, -32, 20, 6, -0.15, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = LEAF_L;
      g.globalAlpha = 0.5;
      g.beginPath();
      g.ellipse(-8, -34, 10, 2.4, -0.15, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      for (let i = 0; i < 4; i++) frond(g, r.range(-30, 30), 2, r.range(12, 20), -Math.PI / 2 + r.range(-1, 1), 6, r.pick(LEAF), 5, 3);
      return true;
    }
    case 'jStump': {
      shadedRR(g, -18, -26, 36, 28, 4, BARK, { lw: 1.2 });
      g.fillStyle = '#b08a5a';
      g.beginPath();
      g.ellipse(0, -26, 18, 5, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#7a5a38';
      g.lineWidth = 0.8;
      for (const rr of [4, 8, 12]) {
        g.beginPath();
        g.ellipse(0, -26, rr * 1.4, rr * 0.38, 0, 0, Math.PI * 2);
        g.stroke();
      }
      // cogumelos
      for (let i = 0; i < 3; i++) {
        const x = r.range(-16, 16);
        const y = r.range(-16, -4);
        g.fillStyle = '#efe6d0';
        g.fillRect(x - 1, y, 2, 5);
        g.fillStyle = i % 2 ? '#e2484a' : '#e8a040';
        g.beginPath();
        g.ellipse(x, y, 5, 3, 0, Math.PI, Math.PI * 2);
        g.fill();
        g.fillStyle = '#fff';
        g.fillRect(x - 2, y - 2, 1.2, 1.2);
      }
      return true;
    }
    case 'jCrates': {
      // caixas militares de munição e sacos (pilhagem dos mercenários)
      shadedRR(g, -40, -26, 36, 26, 2, '#4f5a36', { lw: 1.2 });
      shadedRR(g, -2, -22, 40, 22, 2, '#5d6a42', { lw: 1.2 });
      shadedRR(g, -30, -50, 30, 24, 2, '#4a5432', { lw: 1.2 });
      g.fillStyle = '#e8d6a0';
      g.font = '700 7px Rajdhani, sans-serif';
      g.fillText('7.62', -34, -10);
      g.fillText('ARM', 6, -8);
      g.fillStyle = '#c8a46a';
      for (const [x, y] of [[-40, -18], [-2, -14], [-30, -42]]) g.fillRect(x, y, 3, 6);
      g.fillStyle = '#b8a27a';
      g.beginPath();
      g.ellipse(26, -28, 12, 8, 0.2, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 1;
      g.stroke();
      return true;
    }
    case 'jStoneHead': {
      // cabeça colossal de pedra (estilo olmeca) coberta de musgo
      g.fillStyle = STONE_D;
      g.beginPath();
      g.ellipse(0, -46, 42, 46, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 1.4;
      g.stroke();
      g.fillStyle = STONE;
      g.beginPath();
      g.ellipse(-4, -50, 36, 40, 0, 0, Math.PI * 2);
      g.fill();
      // capacete
      poly(g, [[-40, -60], [-30, -88], [30, -88], [40, -60], [30, -66], [-30, -66]], STONE_D);
      // olhos fechados, nariz largo, lábios grossos
      g.strokeStyle = '#3a4238';
      g.lineWidth = 2.2;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(s * 18 - 8, -54);
        g.quadraticCurveTo(s * 18, -50, s * 18 + 8, -54);
        g.stroke();
      }
      poly(g, [[-8, -48], [8, -48], [12, -32], [-12, -32]], STONE_L, { lw: 1 });
      shadedRR(g, -16, -26, 32, 10, 5, STONE_D, { lw: 1 });
      g.fillStyle = MOSS;
      g.beginPath();
      g.ellipse(-6, -88, 30, 6, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(26, -40, 10, 18, 0.3, 0, Math.PI * 2);
      g.fill();
      for (let i = 0; i < 5; i++) frond(g, r.range(-40, 40), 2, r.range(16, 24), -Math.PI / 2 + r.range(-1, 1), 6, r.pick(LEAF), 6, 3.4);
      return true;
    }
    case 'jRoots': {
      g.strokeStyle = BARK;
      g.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        g.lineWidth = r.range(4, 8);
        const x0 = r.range(-60, -10);
        const x1 = r.range(10, 60);
        g.beginPath();
        g.moveTo(x0, 2);
        g.quadraticCurveTo((x0 + x1) / 2, -r.range(14, 36), x1, 2);
        g.stroke();
      }
      g.strokeStyle = BARK_L;
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(-40, 0);
      g.quadraticCurveTo(0, -30, 40, 0);
      g.stroke();
      for (let i = 0; i < 4; i++) leafBlade(g, r.range(-40, 40), -r.range(6, 20), 10, r.range(-2.6, -0.5), 3.6, r.pick(LEAF));
      return true;
    }
    case 'jTotem': {
      // totem esculpido: rostos empilhados com cores gastas
      for (let i = 0; i < 4; i++) {
        const y = -30 - i * 28;
        shadedRR(g, -16, y, 32, 30, 3, i % 2 ? '#8a6a44' : '#7a5a38', { lw: 1.2 });
        g.fillStyle = i % 2 ? '#c84a3a' : '#3a7aa8';
        g.globalAlpha = 0.7;
        g.fillRect(-12, y + 6, 8, 5);
        g.fillRect(4, y + 6, 8, 5);
        g.globalAlpha = 1;
        g.fillStyle = '#1e140c';
        g.fillRect(-9, y + 7, 3, 3);
        g.fillRect(6, y + 7, 3, 3);
        g.fillRect(-7, y + 18, 14, 4);
        g.fillStyle = '#e8d6b0';
        for (let k = 0; k < 4; k++) g.fillRect(-6 + k * 3.4, y + 18, 1.6, 2);
      }
      poly(g, [[-22, -122], [0, -132], [22, -122], [16, -114], [-16, -114]], '#c84a3a');
      return true;
    }
    case 'jBanana': {
      g.strokeStyle = '#6a8a3a';
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(r.range(-4, 4), -70);
      g.stroke();
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.5 + r.range(-0.1, 0.1);
        const l = r.range(48, 60);
        g.save();
        g.translate(0, -66);
        g.rotate(a);
        g.fillStyle = r.pick(LEAF);
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(l * 0.5, -14, l, 4);
        g.quadraticCurveTo(l * 0.5, 14, 0, 0);
        g.fill();
        g.strokeStyle = 'rgba(10,30,14,0.55)';
        g.lineWidth = 1;
        g.stroke();
        g.strokeStyle = 'rgba(200,255,170,0.4)';
        g.beginPath();
        g.moveTo(2, 0);
        g.quadraticCurveTo(l * 0.5, 0, l, 4);
        g.stroke();
        // rasgos nas folhas
        g.strokeStyle = 'rgba(10,30,14,0.35)';
        for (let k = 0.3; k < 0.9; k += 0.18) {
          g.beginPath();
          g.moveTo(l * k, 0);
          g.lineTo(l * k + 4, 9);
          g.stroke();
        }
        g.restore();
      }
      // cacho de bananas
      g.fillStyle = '#d6c43a';
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.ellipse(6 + (i % 3) * 4, -52 + Math.floor(i / 3) * 7, 2.4, 5, 0.4, 0, Math.PI * 2);
        g.fill();
      }
      return true;
    }
    case 'jFlowers': {
      for (let i = 0; i < 8; i++) {
        const x = r.range(-24, 24);
        const h = r.range(10, 26);
        g.strokeStyle = '#3e7f28';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(x, 0);
        g.quadraticCurveTo(x + 3, -h * 0.5, x + r.range(-3, 3), -h);
        g.stroke();
        leafBlade(g, x, -h * 0.4, 7, -0.6, 2.4, LEAF[1], false);
      }
      for (let i = 0; i < 5; i++) {
        const x = r.range(-22, 22);
        const y = -r.range(12, 26);
        // helicônia (bico-de-papagaio)
        for (let k = 0; k < 3; k++) poly(g, [[x, y + k * 4], [x + 7, y + k * 4 - 2], [x + 2, y + k * 4 + 3]], k % 2 ? '#ffd23a' : '#ff4a3a', { lw: 0.6 });
      }
      return true;
    }
    case 'jReeds': {
      // taboas (juncos com espiga marrom)
      for (let i = 0; i < 9; i++) {
        const x = r.range(-24, 24);
        const h = r.range(36, 66);
        const lean = r.range(-6, 6);
        g.strokeStyle = r.pick(['#6a8a3a', '#7a9a44', '#5a7a30']);
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(x, 4);
        g.quadraticCurveTo(x + lean * 0.3, -h * 0.5, x + lean, -h);
        g.stroke();
        if (i % 2 === 0) {
          g.fillStyle = '#6a4a2a';
          g.beginPath();
          g.ellipse(x + lean * 0.9, -h + 6, 2.2, 7, lean * 0.02, 0, Math.PI * 2);
          g.fill();
        } else leafBlade(g, x, -h * 0.3, h * 0.6, -Math.PI / 2 + lean * 0.06 + 0.3, 2, '#7a9a44', false);
      }
      return true;
    }
    case 'jLily': {
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 20 + r.range(-4, 4);
        g.fillStyle = i % 2 ? '#5f9a3a' : '#4f8a34';
        g.beginPath();
        g.ellipse(x, -2, 14, 4.6, 0, 0.3, Math.PI * 2);
        g.lineTo(x, -2);
        g.closePath();
        g.fill();
        g.strokeStyle = '#2f5a1e';
        g.lineWidth = 1;
        g.stroke();
      }
      g.fillStyle = '#ffd0e6';
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.ellipse(4 + Math.cos(k) * 2.6, -8 + Math.sin(k) * 1.2, 2, 4, k * 0.5, 0, Math.PI * 2);
        g.fill();
      }
      return true;
    }
    case 'jMangrove': {
      // mangue: raízes em arco saindo da água, tronco torto e copa
      g.strokeStyle = BARK;
      g.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        g.lineWidth = r.range(3, 5);
        const x0 = r.range(-70, 70);
        g.beginPath();
        g.moveTo(x0, 8);
        g.quadraticCurveTo(x0 * 0.6, -60, r.range(-8, 8), -80);
        g.stroke();
      }
      g.lineWidth = 12;
      g.strokeStyle = BARK_D;
      g.beginPath();
      g.moveTo(0, -78);
      g.quadraticCurveTo(r.range(-14, 14), -130, r.range(-8, 8), -160);
      g.stroke();
      crownBlob(g, r, 0, -168, 50);
      // musgo-barba pendurado
      g.strokeStyle = 'rgba(150,170,110,0.7)';
      g.lineWidth = 1.2;
      for (let i = 0; i < 12; i++) {
        const x = r.range(-48, 48);
        g.beginPath();
        g.moveTo(x, -150);
        g.quadraticCurveTo(x + 2, -128, x - 1, r.range(-120, -96));
        g.stroke();
      }
      return true;
    }
    case 'jSign': {
      shadedRR(g, -3, -50, 6, 50, 1, BARK, { lw: 1 });
      shadedRR(g, -22, -52, 44, 20, 2, '#b08a5a', { lw: 1.2 });
      g.fillStyle = '#7a1a14';
      g.font = '400 10px "Lilita One", Impact, sans-serif';
      g.textAlign = 'center';
      g.fillText('PERIGO', 0, -38);
      g.textAlign = 'left';
      // marcas de tiro
      g.fillStyle = '#2a1a10';
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(r.range(-18, 18), r.range(-50, -34), 1.4, 0, Math.PI * 2);
        g.fill();
      }
      return true;
    }
    case 'jHut': {
      // palafita: estacas descendo até a água, parede de bambu, telhado de palha
      g.fillStyle = BARK_D;
      for (const x of [-60, -20, 20, 60]) g.fillRect(x - 3, 0, 6, 104);
      g.strokeStyle = BARK;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-60, 20);
      g.lineTo(-20, 70);
      g.moveTo(20, 70);
      g.lineTo(60, 20);
      g.stroke();
      // paredes
      for (let x = -56; x < 56; x += 7) {
        g.fillStyle = (x / 7) % 2 ? '#b89a5a' : '#a88a4a';
        g.fillRect(x, -92, 7, 92);
      }
      g.strokeStyle = 'rgba(40,24,10,0.45)';
      g.lineWidth = 1;
      for (let y = -86; y < 0; y += 18) {
        g.beginPath();
        g.moveTo(-56, y);
        g.lineTo(56, y);
        g.stroke();
      }
      // janela com luz
      g.fillStyle = '#2a1a10';
      g.fillRect(-36, -70, 26, 22);
      g.fillStyle = 'rgba(255,200,110,0.5)';
      g.fillRect(-34, -68, 22, 18);
      g.fillStyle = '#2a1a10';
      g.fillRect(-24, -70, 2, 22);
      // porta
      g.fillStyle = '#3a2416';
      g.fillRect(14, -66, 24, 66);
      // telhado de palha
      poly(g, [[-90, -84], [0, -146], [90, -84], [70, -80], [-70, -80]], '#c8a45a');
      g.strokeStyle = 'rgba(120,80,30,0.6)';
      g.lineWidth = 1;
      for (let i = -80; i < 80; i += 6) {
        g.beginPath();
        g.moveTo(i * 0.1, -142);
        g.lineTo(i, -82);
        g.stroke();
      }
      // bandeira dos mercenários + caveira pintada
      g.fillStyle = '#2a2a2a';
      g.fillRect(-4, -40, 22, 14);
      g.fillStyle = '#e8e0d0';
      g.beginPath();
      g.arc(7, -34, 3.4, 0, Math.PI * 2);
      g.fill();
      return true;
    }
    case 'jSkull': {
      shadedRR(g, -2, -50, 4, 50, 1, BARK, { lw: 0.9 });
      g.fillStyle = '#e8e0cc';
      g.beginPath();
      g.arc(0, -54, 8, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = '#1a120c';
      g.fillRect(-5, -57, 3.4, 3.4);
      g.fillRect(1.6, -57, 3.4, 3.4);
      g.fillRect(-3, -50, 6, 2);
      g.strokeStyle = '#c8a46a';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-8, -40);
      g.lineTo(8, -36);
      g.stroke();
      return true;
    }
    case 'jPost': {
      // poste da ponte de corda
      shadedRR(g, -5, -56, 10, 58, 2, BARK, { lw: 1.1 });
      g.fillStyle = '#c8a46a';
      g.fillRect(-6, -48, 12, 3);
      g.fillRect(-6, -20, 12, 3);
      g.strokeStyle = '#c8a46a';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(0, -46);
      g.quadraticCurveTo(8, -30, 12, -22);
      g.stroke();
      return true;
    }
    case 'uGrass': {
      for (let i = 0; i < 7; i++) {
        const x = r.range(-14, 14);
        const h = r.range(14, 32);
        g.strokeStyle = r.pick(['#3f8a5a', '#2f7a5a', '#5aa46a']);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, 2);
        g.quadraticCurveTo(x + r.range(-6, 6), -h * 0.6, x + r.range(-4, 4), -h);
        g.stroke();
      }
      return true;
    }
    case 'uRock': {
      g.fillStyle = '#2f4a52';
      g.beginPath();
      g.ellipse(0, -10, 32, 18, 0, Math.PI, Math.PI * 2);
      g.lineTo(32, 3);
      g.lineTo(-32, 3);
      g.closePath();
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = 'rgba(160,230,220,0.18)';
      g.beginPath();
      g.ellipse(-8, -22, 16, 5, 0, 0, Math.PI * 2);
      g.fill();
      // coral de água doce / esponjas
      for (let i = 0; i < 3; i++) {
        g.fillStyle = r.pick(['#e8805a', '#d0a040', '#c85a8a']);
        g.beginPath();
        g.arc(r.range(-24, 24), -r.range(10, 24), r.range(2, 4), 0, Math.PI * 2);
        g.fill();
      }
      return true;
    }
    case 'uArch': {
      // arcada do templo afundada
      g.fillStyle = '#35565a';
      g.fillRect(-72, -140, 28, 140);
      g.fillRect(44, -110, 28, 110);
      g.beginPath();
      g.moveTo(-72, -140);
      g.quadraticCurveTo(0, -200, 72, -110);
      g.lineTo(44, -100);
      g.quadraticCurveTo(0, -160, -44, -120);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(10,30,34,0.8)';
      g.lineWidth = 1.4;
      for (let y = -130; y < 0; y += 22) {
        g.beginPath();
        g.moveTo(-72, y);
        g.lineTo(-44, y);
        g.moveTo(44, y + 10);
        g.lineTo(72, y + 10);
        g.stroke();
      }
      g.fillStyle = 'rgba(90,170,120,0.45)';
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.ellipse(r.range(-70, 70), r.range(-150, -10), r.range(5, 10), 3, 0, 0, Math.PI * 2);
        g.fill();
      }
      return true;
    }
    case 'uChest': {
      shadedRR(g, -18, -16, 36, 16, 2, '#6a4a2a', { lw: 1.2 });
      g.fillStyle = '#5a3a1e';
      g.beginPath();
      g.moveTo(-18, -16);
      g.quadraticCurveTo(0, -30, 18, -16);
      g.closePath();
      g.fill();
      g.strokeStyle = OUT;
      g.stroke();
      g.fillStyle = '#d6b04a';
      g.fillRect(-18, -12, 36, 2.4);
      g.fillRect(-3, -14, 6, 7);
      // moedas espalhadas
      for (let i = 0; i < 5; i++) {
        g.fillStyle = '#ffd23a';
        g.beginPath();
        g.ellipse(r.range(-22, 22), 0, 3, 1.4, 0, 0, Math.PI * 2);
        g.fill();
      }
      return true;
    }
    case 'uBones': {
      g.fillStyle = '#d8d0b8';
      g.beginPath();
      g.arc(-14, -6, 6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1a1a1a';
      g.fillRect(-17, -8, 2, 2);
      g.fillRect(-12, -8, 2, 2);
      g.fillStyle = '#d8d0b8';
      for (let i = 0; i < 4; i++) {
        g.save();
        g.translate(r.range(-4, 26), -r.range(2, 6));
        g.rotate(r.range(-0.8, 0.8));
        g.fillRect(-8, -1, 16, 2.4);
        g.restore();
      }
      return true;
    }
    case 'uStatue': {
      // ídolo de pedra tombado, com algas
      g.fillStyle = '#3a5a5e';
      shadedRR(g, -20, -26, 40, 26, 3, '#3a5a5e', { lw: 1.2 });
      g.beginPath();
      g.ellipse(0, -56, 20, 30, 0.1, 0, Math.PI * 2);
      g.fillStyle = '#44686a';
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = '#1a2a2c';
      g.fillRect(-10, -64, 7, 4);
      g.fillRect(3, -64, 7, 4);
      g.fillRect(-6, -48, 12, 3);
      // olhos de pedra preciosa
      g.fillStyle = '#5affc0';
      g.fillRect(-8, -63, 3, 2);
      g.fillRect(5, -63, 3, 2);
      poly(g, [[-22, -78], [0, -94], [22, -78]], '#3a5a5e');
      return true;
    }
    case 'jTower': {
      // torre de vigia de madeira (a plataforma é o próprio piso one-way)
      g.strokeStyle = BARK_D;
      g.lineWidth = 6;
      for (const x of [-50, 50]) {
        g.beginPath();
        g.moveTo(x, 4);
        g.lineTo(x * 0.8, -190);
        g.stroke();
      }
      g.strokeStyle = BARK;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-48, -10);
      g.lineTo(42, -90);
      g.moveTo(48, -10);
      g.lineTo(-42, -90);
      g.moveTo(-42, -100);
      g.lineTo(40, -180);
      g.moveTo(42, -100);
      g.lineTo(-40, -180);
      g.stroke();
      // guarda-corpo do topo e telhado
      g.fillStyle = '#7a5a38';
      g.fillRect(-46, -224, 92, 6);
      poly(g, [[-56, -222], [0, -246], [56, -222]], '#5d6a42');
      // holofote
      g.fillStyle = '#2a2a2a';
      g.fillRect(28, -212, 12, 8);
      return true;
    }
    case 'jPalisade': {
      // paliçada de troncos apontados com arame
      for (let x = -66; x < 66; x += 12) {
        const h = r.range(78, 96);
        g.fillStyle = (x / 12) % 2 ? '#7a5a38' : '#6a4a2e';
        g.fillRect(x, -h + 10, 11, h - 10);
        poly(g, [[x, -h + 10], [x + 5.5, -h], [x + 11, -h + 10]], '#8a6a44', { lw: 0.8 });
        g.strokeStyle = 'rgba(20,10,4,0.5)';
        g.lineWidth = 1;
        g.strokeRect(x, -h + 10, 11, h - 10);
      }
      g.strokeStyle = '#3a3a3a';
      g.lineWidth = 1.2;
      for (const y of [-30, -60]) {
        g.beginPath();
        g.moveTo(-68, y);
        g.lineTo(68, y + 2);
        g.stroke();
      }
      // placa de alerta dos mercenários
      shadedRR(g, -14, -56, 28, 18, 1, '#d8c070', { lw: 1 });
      g.fillStyle = '#2a1a10';
      g.font = '700 8px Rajdhani, sans-serif';
      g.textAlign = 'center';
      g.fillText('PROIBIDO', 0, -44);
      g.textAlign = 'left';
      return true;
    }
    case 'jTent': {
      // barraca de lona militar
      const w = r.chance(0.5) ? 60 : 52;
      poly(g, [[-w, 0], [-w * 0.2, -72], [w * 0.2, -72], [w, 0]], CANVAS);
      poly(g, [[-w * 0.2, -72], [w * 0.2, -72], [w * 0.45, 0], [-w * 0.45, 0]], shade(CANVAS, 0.12));
      // abertura escura
      poly(g, [[-14, 0], [0, -52], [14, 0]], '#1e1c12', { lw: 1 });
      g.strokeStyle = '#4a4630';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-w, 0);
      g.lineTo(-w - 10, 2);
      g.moveTo(w, 0);
      g.lineTo(w + 10, 2);
      g.stroke();
      // remendos e camuflagem
      g.fillStyle = 'rgba(40,46,24,0.4)';
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.ellipse(r.range(-w * 0.6, w * 0.6), r.range(-60, -10), r.range(5, 10), r.range(3, 6), r.range(0, 3), 0, Math.PI * 2);
        g.fill();
      }
      return true;
    }
    case 'jGate': {
      // portal de saída: dois troncos com viga e caveira de búfalo
      for (const x of [-72, 72]) shadedRR(g, x - 9, -190, 18, 192, 3, BARK, { lw: 1.2 });
      shadedRR(g, -88, -196, 176, 16, 3, BARK_D, { lw: 1.2 });
      g.fillStyle = '#e8e0cc';
      g.beginPath();
      g.ellipse(0, -176, 12, 14, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#e8e0cc';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(-10, -184);
      g.quadraticCurveTo(-30, -196, -32, -210);
      g.moveTo(10, -184);
      g.quadraticCurveTo(30, -196, 32, -210);
      g.stroke();
      g.fillStyle = '#1a1a1a';
      g.fillRect(-6, -180, 3, 3);
      g.fillRect(3, -180, 3, 3);
      for (let i = 0; i < 6; i++) leafBlade(g, r.range(-80, 80), -r.range(140, 190), 12, r.range(0.5, 2.6), 4, r.pick(LEAF));
      return true;
    }
    case 'jTempleBack': {
      // fachada do templo ao fundo: degraus, colunas, portal escuro e telhado em pirâmide
      const D = '#5a6658';
      const M = '#6c786a';
      g.fillStyle = D;
      g.fillRect(-220, -120, 440, 120);
      g.fillStyle = M;
      g.fillRect(-180, -200, 360, 84);
      g.fillStyle = D;
      g.fillRect(-120, -260, 240, 64);
      poly(g, [[-90, -258], [0, -300], [90, -258]], M);
      // portal
      g.fillStyle = '#141a14';
      g.beginPath();
      g.moveTo(-34, -120);
      g.lineTo(-34, -170);
      g.quadraticCurveTo(0, -196, 34, -170);
      g.lineTo(34, -120);
      g.closePath();
      g.fill();
      // colunas
      for (const x of [-150, -100, 100, 150]) {
        g.fillStyle = '#7c8878';
        g.fillRect(x - 9, -196, 18, 76);
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.fillRect(x + 3, -196, 6, 76);
      }
      // frisos entalhados
      g.strokeStyle = 'rgba(20,26,20,0.5)';
      g.lineWidth = 1.4;
      for (let x = -170; x < 170; x += 20) {
        g.strokeRect(x, -212, 14, 10);
      }
      // musgo e cipós
      g.fillStyle = 'rgba(92,154,56,0.7)';
      for (let i = 0; i < 12; i++) {
        g.beginPath();
        g.ellipse(r.range(-210, 210), r.range(-260, -110), r.range(10, 24), r.range(3, 6), 0, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = '#2e6a2e';
      g.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const x = r.range(-200, 200);
        g.beginPath();
        g.moveTo(x, -250 + r.range(0, 60));
        g.quadraticCurveTo(x + r.range(-10, 10), -150, x + r.range(-6, 6), r.range(-90, -20));
        g.stroke();
      }
      // escuro para ficar atrás do jogo
      g.fillStyle = 'rgba(20,40,30,0.32)';
      g.fillRect(-222, -302, 444, 304);
      return true;
    }
    case 'jJeep': {
      // jipe militar velho dos mercenários
      shadedRR(g, -62, -40, 124, 26, 5, '#5d6a42', { lw: 1.3 });
      shadedRR(g, -30, -58, 52, 20, 3, '#4f5a36', { lw: 1.2 });
      g.fillStyle = 'rgba(160,210,230,0.55)';
      g.fillRect(-26, -55, 20, 13);
      g.fillStyle = '#e8d6a0';
      g.fillRect(40, -34, 10, 6);
      g.fillStyle = '#ffffff';
      g.font = '700 9px Rajdhani, sans-serif';
      g.fillText('★', -50, -22);
      // estepe e galão
      shadedRR(g, -70, -40, 8, 20, 2, '#2a2a2a', { lw: 1 });
      shadedRR(g, 54, -50, 8, 12, 1, '#7a2a1a', { lw: 0.9 });
      for (const x of [-36, 36]) {
        g.fillStyle = '#1a1a1a';
        g.beginPath();
        g.arc(x, -10, 13, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#5a5a5a';
        g.beginPath();
        g.arc(x, -10, 5, 0, Math.PI * 2);
        g.fill();
      }
      return true;
    }
    case 'jSandbags': {
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 4 - row; i++) {
          const x = -36 + row * 11 + i * 22;
          const y = -9 - row * 9;
          g.fillStyle = row % 2 ? '#b8a27a' : '#a8946a';
          g.beginPath();
          g.ellipse(x + 10, y, 11, 5.4, 0, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = OUT;
          g.lineWidth = 1;
          g.stroke();
          g.strokeStyle = 'rgba(80,60,30,0.5)';
          g.beginPath();
          g.moveTo(x + 3, y);
          g.lineTo(x + 17, y);
          g.stroke();
        }
      }
      return true;
    }
    case 'jAmmo': {
      shadedRR(g, -28, -18, 56, 18, 2, '#4f5a36', { lw: 1.2 });
      shadedRR(g, -18, -32, 34, 14, 2, '#5d6a42', { lw: 1.1 });
      g.fillStyle = '#d6b04a';
      for (let i = 0; i < 8; i++) g.fillRect(-14 + i * 3.6, -38, 2, 6);
      g.fillStyle = '#e8d6a0';
      g.font = '700 7px Rajdhani, sans-serif';
      g.fillText('MUNIÇÃO', -22, -6);
      return true;
    }
    case 'jBranch': {
      // galho grosso saindo de uma árvore gigante (o cipó fica preso na ponta)
      g.fillStyle = BARK_D;
      g.beginPath();
      g.moveTo(-170, -14);
      g.quadraticCurveTo(-60, -26, 10, -6);
      g.lineTo(12, 6);
      g.quadraticCurveTo(-60, -6, -170, 14);
      g.closePath();
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 1.4;
      g.stroke();
      g.fillStyle = BARK;
      g.fillRect(-160, -10, 150, 4);
      g.fillStyle = MOSS;
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.ellipse(-150 + i * 34, -12, 14, 4, 0, 0, Math.PI * 2);
        g.fill();
      }
      crownBlob(g, r, -40, -34, 30);
      for (let i = 0; i < 6; i++) leafBlade(g, r.range(-150, 0), r.range(-6, 10), r.range(10, 16), r.range(0.4, 2.6), 4, r.pick(LEAF));
      // amarração do cipó
      g.fillStyle = '#c8a46a';
      g.fillRect(-4, -6, 8, 12);
      return true;
    }
    case 'jDoorway': {
      // portal do templo no topo da pirâmide (entrada): batentes de pedra, verga entalhada, escuro
      g.fillStyle = '#0c0f0c';
      g.beginPath();
      g.moveTo(-20, 0);
      g.lineTo(-20, -60);
      g.quadraticCurveTo(0, -78, 20, -60);
      g.lineTo(20, 0);
      g.closePath();
      g.fill();
      stoneBlock(g, -32, -66, 12, 66, r);
      stoneBlock(g, 20, -66, 12, 66, r);
      shadedRR(g, -38, -84, 76, 20, 3, STONE_L, { lw: 1.2 });
      g.strokeStyle = 'rgba(30,36,28,0.6)';
      g.lineWidth = 1.4;
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.arc(i * 13, -74, 4, 0, Math.PI * 2);
        g.stroke();
      }
      // brilho dourado lá dentro
      g.fillStyle = 'rgba(255,200,90,0.25)';
      g.beginPath();
      g.ellipse(0, -18, 12, 18, 0, 0, Math.PI * 2);
      g.fill();
      return true;
    }
    case 'jDoorExit': {
      // passagem estreita (saída / porta interna)
      g.fillStyle = '#0c0f0c';
      g.fillRect(-16, -56, 32, 56);
      stoneBlock(g, -26, -60, 10, 60, r);
      stoneBlock(g, 16, -60, 10, 60, r);
      shadedRR(g, -30, -70, 60, 14, 2, STONE_L, { lw: 1.1 });
      g.fillStyle = '#9ad14a';
      g.beginPath();
      g.moveTo(0, -66);
      g.lineTo(5, -60);
      g.lineTo(-5, -60);
      g.closePath();
      g.fill();
      return true;
    }
    case 'jIdol': {
      // ídolo dourado num altar
      shadedRR(g, -20, -18, 40, 18, 2, STONE, { lw: 1.2 });
      g.fillStyle = '#e8b030';
      g.beginPath();
      g.ellipse(0, -34, 11, 15, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#7a5214';
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = '#7a5214';
      g.fillRect(-6, -38, 4, 3);
      g.fillRect(2, -38, 4, 3);
      g.fillRect(-4, -30, 8, 2);
      g.fillStyle = '#5affc0';
      g.fillRect(-5, -37.4, 2, 1.6);
      g.fillRect(3, -37.4, 2, 1.6);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(-6, -44, 3, 6);
      return true;
    }
    case 'jFlag': {
      g.fillStyle = BARK;
      g.fillRect(-3, -150, 5, 152);
      poly(g, [[2, -148], [56, -140], [52, -112], [2, -118]], '#2a2a2a', { lw: 1 });
      g.fillStyle = '#e8e0cc';
      g.beginPath();
      g.arc(26, -130, 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2a2a2a';
      g.fillRect(22, -132, 3, 3);
      g.fillRect(28, -132, 3, 3);
      g.strokeStyle = '#e8e0cc';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(14, -120);
      g.lineTo(38, -140);
      g.moveTo(14, -140);
      g.lineTo(38, -120);
      g.stroke();
      return true;
    }
    default:
      break;
  }
  return paintAnimated(g, kind, seed, t);
}

// ------------------------------------------------------------------ animadas
const sprCache = new Map<string, Sprite>();
function piece(key: string, w: number, h: number, ox: number, oy: number, fn: (g: CanvasRenderingContext2D) => void): Sprite {
  let s = sprCache.get(key);
  if (!s) {
    s = bake(w, h, (g) => {
      g.translate(ox, oy);
      fn(g);
    }, { scale: 2.5, ox, oy });
    sprCache.set(key, s);
  }
  return s;
}

function drawPiece(g: CanvasRenderingContext2D, s: Sprite, rot = 0, alpha = 1) {
  g.save();
  if (rot) g.rotate(rot);
  if (alpha < 1) g.globalAlpha *= alpha;
  g.drawImage(s.c, -s.ox, -s.oy, s.w, s.h);
  g.restore();
}

function flame(g: CanvasRenderingContext2D, t: number, seed: number, size: number) {
  const fl = 0.85 + 0.15 * Math.sin(t * 13 + seed) + 0.08 * Math.sin(t * 29 + seed * 2);
  const glow = glowSprite('#ff9a3a', 32);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.45 * fl;
  g.drawImage(glow.c, -size * 3, -size * 3.6, size * 6, size * 6);
  g.globalAlpha = 1;
  const outer = glowSprite('#ff7a1a', 32);
  const inner = glowSprite('#ffe27a', 32);
  for (let i = 0; i < 3; i++) {
    const ph = t * 7 + i * 2.1 + seed;
    const h = size * (1.6 + 0.4 * Math.sin(ph)) * fl;
    const x = Math.sin(ph * 1.3) * size * 0.25;
    g.globalAlpha = 0.85;
    g.drawImage(outer.c, x - size * 0.6, -h, size * 1.2, h * 1.1);
    g.globalAlpha = 0.9;
    g.drawImage(inner.c, x - size * 0.3, -h * 0.65, size * 0.6, h * 0.7);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

function paintAnimated(g: CanvasRenderingContext2D, kind: string, seed: number, t: number): boolean {
  switch (kind) {
    case 'jLightShaft': {
      // facho de sol atravessando a copa (aditivo)
      const a = 0.08 + 0.05 * Math.sin(t * 0.5 + seed);
      const s = piece('shaft', 120, 420, 60, 420, (c) => {
        const gr = c.createLinearGradient(0, -420, 0, 0);
        gr.addColorStop(0, 'rgba(255,248,200,0.9)');
        gr.addColorStop(1, 'rgba(255,248,200,0)');
        c.fillStyle = gr;
        c.beginPath();
        c.moveTo(-20, -420);
        c.lineTo(20, -420);
        c.lineTo(60, 0);
        c.lineTo(-30, 0);
        c.closePath();
        c.fill();
      });
      g.globalCompositeOperation = 'lighter';
      drawPiece(g, s, -0.18, a);
      g.globalCompositeOperation = 'source-over';
      return true;
    }
    case 'jVine': {
      // cipó pendurado balançando (pivô no alto)
      const v = Math.abs(seed) % 3;
      const len = 120 + v * 40;
      const s = piece('vine' + v, 40, len + 10, 20, 0, (c) => {
        const r = new Rng(v * 17 + 5);
        c.strokeStyle = '#2f5a24';
        c.lineWidth = 2.2;
        c.beginPath();
        c.moveTo(0, 0);
        c.bezierCurveTo(8, len * 0.3, -8, len * 0.7, 2, len);
        c.stroke();
        for (let i = 1; i < 12; i++) {
          const y = (i / 12) * len;
          const x = Math.sin(y * 0.03) * 5;
          leafBlade(c, x, y, r.range(8, 13), r.chance(0.5) ? r.range(0.2, 1) : r.range(2.2, 3), 3.4, r.pick(LEAF));
        }
        // flor no fim
        c.fillStyle = r.pick(['#ff5a7a', '#ffd23a', '#d06aff']);
        c.beginPath();
        c.arc(2, len + 2, 3.4, 0, Math.PI * 2);
        c.fill();
      });
      // cipós ficam "presos" no alto da tela: a base do deco é o topo do cipó
      g.translate(0, -len);
      drawPiece(g, s, Math.sin(t * 0.9 + seed) * 0.05 + Math.sin(t * 2.1 + seed * 0.3) * 0.015);
      return true;
    }
    case 'jFireflies': {
      g.globalCompositeOperation = 'lighter';
      const dot = softDot('#d8ff7a', 16);
      for (let i = 0; i < 7; i++) {
        const ph = seed * 0.37 + i * 1.7;
        const x = Math.sin(t * 0.4 + ph) * 46 + Math.sin(t * 1.1 + ph * 2) * 10;
        const y = -30 - Math.abs(Math.sin(t * 0.3 + ph)) * 60 + Math.sin(t * 1.7 + ph) * 6;
        const tw = Math.max(0, Math.sin(t * 2.4 + ph * 3));
        g.globalAlpha = 0.85 * tw;
        g.drawImage(dot.c, x - 4, y - 4, 8, 8);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      return true;
    }
    case 'jFgLeaves': {
      // folhas enormes no primeiro plano (escuras, balançando)
      const s = piece('fgl' + (Math.abs(seed) % 2), 260, 150, 130, 150, (c) => {
        const r = new Rng(Math.abs(seed) % 2 + 3);
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI / 2 + (i - 4) * 0.32 + r.range(-0.1, 0.1);
          const l = r.range(90, 140);
          c.save();
          c.rotate(a);
          c.fillStyle = i % 2 ? '#0f2a16' : '#143520';
          c.beginPath();
          c.moveTo(0, 0);
          c.quadraticCurveTo(l * 0.5, -22, l, 0);
          c.quadraticCurveTo(l * 0.5, 22, 0, 0);
          c.fill();
          c.strokeStyle = 'rgba(80,140,80,0.35)';
          c.lineWidth = 1.4;
          c.beginPath();
          c.moveTo(4, 0);
          c.lineTo(l * 0.95, 0);
          c.stroke();
          c.restore();
        }
      });
      drawPiece(g, s, Math.sin(t * 0.8 + seed) * 0.03);
      return true;
    }
    case 'jFgVines': {
      const s = piece('fgv' + (Math.abs(seed) % 2), 120, 260, 60, 0, (c) => {
        const r = new Rng(Math.abs(seed) % 2 + 9);
        for (let k = 0; k < 3; k++) {
          const x0 = (k - 1) * 34;
          const len = r.range(160, 250);
          c.strokeStyle = '#0f2412';
          c.lineWidth = 4;
          c.beginPath();
          c.moveTo(x0, 0);
          c.bezierCurveTo(x0 + 14, len * 0.4, x0 - 14, len * 0.7, x0 + 4, len);
          c.stroke();
          for (let i = 1; i < 9; i++) {
            const y = (i / 9) * len;
            leafBlade(c, x0 + Math.sin(y * 0.02) * 8, y, r.range(16, 24), r.chance(0.5) ? 0.5 : 2.6, 6, '#12301a', false);
          }
        }
      });
      drawPiece(g, s, Math.sin(t * 0.6 + seed) * 0.03);
      return true;
    }
    case 'jMist': {
      // névoa rasteira do pântano se arrastando
      const d = softDot('#e6f2dc', 16);
      for (let i = 0; i < 6; i++) {
        const x = ((i * 70 + t * 9 + seed) % 420) - 210;
        g.globalAlpha = 0.16 + 0.06 * Math.sin(t * 0.7 + i);
        g.drawImage(d.c, x - 60, -40 + Math.sin(t * 0.5 + i) * 4, 120, 60);
      }
      g.globalAlpha = 1;
      return true;
    }
    case 'jTorch': {
      // tocha de bambu
      shadedRR(g, -2.5, -64, 5, 64, 1.4, '#a8864a', { lw: 0.9 });
      g.fillStyle = '#5a3a1e';
      g.fillRect(-4, -68, 8, 7);
      g.translate(0, -68);
      flame(g, t, seed, 7);
      return true;
    }
    case 'jCampfire': {
      // fogueira: pedras, toras cruzadas, chamas e brilho no chão
      const glow = glowSprite('#ff8a3a', 32);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.28 + 0.06 * Math.sin(t * 11 + seed);
      g.drawImage(glow.c, -110, -90, 220, 120);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      const base = piece('fire', 70, 22, 35, 20, (c) => {
        for (let i = 0; i < 7; i++) {
          c.fillStyle = i % 2 ? '#6a6a62' : '#55554e';
          c.beginPath();
          c.ellipse(-26 + i * 8.6, -2, 5, 4, 0, 0, Math.PI * 2);
          c.fill();
        }
        c.save();
        c.rotate(-0.35);
        shadedRR(c, -20, -10, 40, 6, 3, BARK, { lw: 0.9 });
        c.restore();
        c.save();
        c.rotate(0.35);
        shadedRR(c, -20, -6, 40, 6, 3, BARK_D, { lw: 0.9 });
        c.restore();
      });
      drawPiece(g, base);
      g.translate(0, -8);
      flame(g, t, seed, 12);
      // fagulhas
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = '#ffd27a';
      for (let i = 0; i < 6; i++) {
        const k = ((t * 0.6 + i / 6 + seed * 0.01) % 1);
        g.globalAlpha = 1 - k;
        g.fillRect(Math.sin(i * 2 + t * 3) * 10 * k, -k * 70, 1.6, 1.6);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      return true;
    }
    case 'jFall': {
      // cachoeira: cai do paredão até o lago, com faixas correndo, espuma e névoa
      const H = 560;
      const W = 70;
      const rock = piece('fallRock', 240, H + 30, 120, H, (c) => {
        const r = new Rng(3);
        // paredão: silhueta irregular, luz pela esquerda e sombra à direita
        const pts: [number, number][] = [[-118, 24]];
        for (let i = 0; i <= 10; i++) pts.push([-112 + Math.sin(i * 1.7) * 10 + i * 2, -i * (H / 10)]);
        for (let i = 10; i >= 0; i--) pts.push([104 - Math.sin(i * 1.3) * 12 - (10 - i) * 1.5, -i * (H / 10)]);
        pts.push([118, 24]);
        c.beginPath();
        c.moveTo(pts[0][0], pts[0][1]);
        for (const [x, y] of pts) c.lineTo(x, y);
        c.closePath();
        const gr = c.createLinearGradient(-118, 0, 118, 0);
        gr.addColorStop(0, '#7d8a76');
        gr.addColorStop(0.45, '#5f6b5a');
        gr.addColorStop(1, '#3a4238');
        c.fillStyle = gr;
        c.fill();
        c.lineWidth = 2;
        c.strokeStyle = OUT;
        c.stroke();
        c.save();
        c.clip();
        // camadas de rocha (estratos) e rachaduras
        for (let y = -H + 30; y < 0; y += r.range(34, 60)) {
          c.fillStyle = 'rgba(0,0,0,0.16)';
          c.fillRect(-120, y, 240, 5);
          c.fillStyle = 'rgba(255,255,255,0.08)';
          c.fillRect(-120, y - 3, 240, 3);
        }
        c.strokeStyle = 'rgba(20,24,18,0.5)';
        c.lineWidth = 1.4;
        for (let i = 0; i < 9; i++) {
          let x = r.range(-100, 100);
          let y = r.range(-H, -40);
          c.beginPath();
          c.moveTo(x, y);
          for (let k = 0; k < 4; k++) {
            x += r.range(-10, 10);
            y += r.range(14, 30);
            c.lineTo(x, y);
          }
          c.stroke();
        }
        // musgo escorrendo (úmido perto da água)
        c.fillStyle = 'rgba(80,150,60,0.75)';
        for (let i = 0; i < 18; i++) {
          c.beginPath();
          c.ellipse(r.range(-110, 110), r.range(-H, -10), r.range(8, 20), r.range(3, 7), 0, 0, Math.PI * 2);
          c.fill();
        }
        c.restore();
        // vegetação no topo e cipós caindo
        for (let i = 0; i < 6; i++) crownBlob(c, r, -100 + i * 40, -H - 4, 24);
        c.strokeStyle = '#2e5a24';
        c.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          const x = r.range(-110, 110);
          if (Math.abs(x) < 40) continue;
          c.beginPath();
          c.moveTo(x, -H);
          c.quadraticCurveTo(x + 6, -H * 0.7, x - 2, -H * r.range(0.35, 0.6));
          c.stroke();
        }
        for (let i = 0; i < 10; i++) frond(c, r.range(-110, 110), r.range(-H + 20, -30), r.range(20, 34), r.range(-2.6, -0.6), 6, r.pick(LEAF), 6, 3.4);
      });
      drawPiece(g, rock);
      const sheet = piece('fallSheet', W, 64, W / 2, 64, (c) => {
        const gr = c.createLinearGradient(-W / 2, 0, W / 2, 0);
        gr.addColorStop(0, 'rgba(200,245,255,0.2)');
        gr.addColorStop(0.2, 'rgba(210,248,255,0.7)');
        gr.addColorStop(0.8, 'rgba(190,240,255,0.65)');
        gr.addColorStop(1, 'rgba(200,245,255,0.18)');
        c.fillStyle = gr;
        c.fillRect(-W / 2, -64, W, 64);
      });
      // água caindo: lençol + filetes correndo (sem passar da superfície do lago)
      g.drawImage(sheet.c, -W / 2, -H + 6, W, H - 6);
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 9; i++) {
        const x = -W / 2 + 6 + i * ((W - 12) / 8);
        const sp = 220 + (i % 3) * 70;
        const len = 38 + (i % 2) * 22;
        for (let k = 0; k < 4; k++) {
          const y = -H + 6 + ((t * sp + i * 97 + k * 140) % (H - 6));
          g.fillRect(x, y, 2.2, Math.min(len, -y));
        }
      }
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(-W / 2, -H + 6, 6, H - 6);
      // espuma e névoa na base
      const d = softDot('#ffffff', 16);
      for (let i = 0; i < 8; i++) {
        const k = (t * 0.8 + i / 8) % 1;
        g.globalAlpha = 0.5 * (1 - k);
        const sz = 30 + k * 60;
        g.drawImage(d.c, Math.sin(i * 2.3) * W * 0.6 - sz / 2, -sz * 0.6 - k * 30, sz, sz * 0.8);
      }
      g.globalAlpha = 1;
      return true;
    }
    case 'uKelp': {
      // alga alta ondulando (o topo balança mais que a base)
      const v = Math.abs(seed) % 3;
      const len = 70 + v * 34;
      g.strokeStyle = v === 1 ? '#3f8a4a' : '#2f7a46';
      g.lineWidth = 3.4;
      const sway = Math.sin(t * 1.1 + seed) * 10;
      g.beginPath();
      g.moveTo(0, 2);
      g.bezierCurveTo(sway * 0.2, -len * 0.35, sway * 0.6 - 6, -len * 0.7, sway, -len);
      g.stroke();
      g.fillStyle = v === 2 ? '#4f9a5a' : '#3f8a4a';
      for (let i = 1; i < 7; i++) {
        const k = i / 7;
        const x = sway * k * k;
        const y = -len * k;
        const a = Math.sin(t * 1.4 + seed + i) * 0.3;
        g.save();
        g.translate(x, y);
        g.rotate((i % 2 ? 0.9 : -0.9) + a - Math.PI / 2);
        g.beginPath();
        g.ellipse(7, 0, 8, 2.6, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      return true;
    }
    case 'uVent': {
      // fenda de onde sobem bolhas (as bolhas vêm da simulação da água)
      g.fillStyle = '#2a3e44';
      g.beginPath();
      g.ellipse(0, -2, 16, 7, 0, Math.PI, Math.PI * 2);
      g.fill();
      g.fillStyle = '#0e1a1e';
      g.beginPath();
      g.ellipse(0, -3, 5, 2.4, 0, 0, Math.PI * 2);
      g.fill();
      return true;
    }
    case 'jFrog':
    case 'jFrogLily': {
      // sapo: fica parado, infla o papo coaxando e às vezes pula para lá e para cá
      const lily = kind === 'jFrogLily';
      const base = lily ? -25 : 0;
      if (lily) {
        g.fillStyle = '#5f9a3a';
        g.beginPath();
        g.ellipse(0, base + 1, 15, 4.4, 0, 0.3, Math.PI * 2);
        g.lineTo(0, base + 1);
        g.closePath();
        g.fill();
        g.strokeStyle = '#2f5a1e';
        g.lineWidth = 1;
        g.stroke();
      }
      const P = 5 + (Math.abs(seed) % 3);
      const ph = (t + (Math.abs(seed) % 7)) % P;
      const cyc = Math.floor((t + (Math.abs(seed) % 7)) / P);
      const dir = lily ? 0 : cyc % 2 ? 1 : -1;
      let x = 0;
      let y = base;
      let squat = 0;
      if (!lily && ph < 0.45) {
        const k = ph / 0.45;
        x = dir * (k * 22 - 11);
        y = base - Math.sin(k * Math.PI) * 16;
      } else if (!lily) x = dir * 11;
      if (ph > 0.45 && ph < 0.6) squat = 1 - (ph - 0.45) / 0.15;
      const croak = ph > 2 && ph < 2.9 ? Math.max(0, Math.sin(((ph - 2) / 0.9) * Math.PI * 3)) : 0;
      g.save();
      g.translate(x, y);
      if (dir < 0) g.scale(-1, 1);
      // pernas
      g.fillStyle = '#3f7f2a';
      g.beginPath();
      g.ellipse(-5, -2, 6, 3 - squat, 0.3, 0, Math.PI * 2);
      g.fill();
      // corpo
      g.fillStyle = '#5aa63a';
      g.beginPath();
      g.ellipse(0, -5 + squat, 8, 5.5 - squat, -0.1, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#1d3a14';
      g.lineWidth = 0.9;
      g.stroke();
      g.fillStyle = '#3a7a24';
      g.beginPath();
      g.arc(-2, -7, 1.6, 0, Math.PI * 2);
      g.arc(2.4, -5, 1.2, 0, Math.PI * 2);
      g.fill();
      // papo (coaxando)
      if (croak > 0.05) {
        g.fillStyle = 'rgba(255,240,200,0.9)';
        g.beginPath();
        g.ellipse(6, -2, 2 + croak * 4, 1.6 + croak * 3.4, 0, 0, Math.PI * 2);
        g.fill();
      }
      // olhos saltados
      for (const ex of [2, 6]) {
        g.fillStyle = '#7cc94a';
        g.beginPath();
        g.arc(ex, -10 + squat, 2.4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#1a1a1a';
        g.fillRect(ex - 0.4, -10.8 + squat, 1.4, 1.4);
      }
      g.restore();
      return true;
    }
    case 'jDragonfly': {
      // libélula: voa em oito, para no ar de vez em quando, asas tremendo
      const s = seed * 0.37;
      const slow = 0.6 + 0.4 * Math.sin(t * 0.5 + s);
      const tt = t * slow;
      const x = Math.sin(tt * 0.9 + s) * 70 + Math.sin(tt * 2.3 + s) * 12;
      const y = -20 + Math.sin(tt * 1.8 + s) * 16;
      const dx = Math.cos(tt * 0.9 + s) * 0.9;
      g.save();
      g.translate(x, y);
      if (dx < 0) g.scale(-1, 1);
      g.strokeStyle = '#1f8aa8';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(-10, 1);
      g.lineTo(4, 0);
      g.stroke();
      g.fillStyle = '#2fc0d0';
      g.beginPath();
      g.arc(5, -0.4, 2, 0, Math.PI * 2);
      g.fill();
      const fl = Math.sin(t * 70 + s) > 0 ? 0.55 : 0.3;
      g.fillStyle = '#dcfaff';
      const a0 = g.globalAlpha;
      g.globalAlpha = a0 * fl;
      for (const [wx, a] of [[1, -0.5], [1, 0.5], [-2, -0.35], [-2, 0.35]] as [number, number][]) {
        g.save();
        g.translate(wx, -1);
        g.rotate(a - Math.PI / 2);
        g.beginPath();
        g.ellipse(0, -6, 1.8, 6, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      g.globalAlpha = a0;
      g.restore();
      return true;
    }
    case 'jButterfly': {
      const s = seed * 0.51;
      const x = Math.sin(t * 0.45 + s) * 60 + Math.sin(t * 1.3 + s * 2) * 14;
      const y = -24 + Math.sin(t * 0.8 + s) * 20 + Math.sin(t * 7 + s) * 2;
      const flap = Math.abs(Math.sin(t * 11 + s));
      const col = ['#ff8a3a', '#3a8aff', '#ffd23a', '#ff5ab4'][Math.abs(seed) % 4];
      g.save();
      g.translate(x, y);
      g.fillStyle = col;
      for (const sgn of [-1, 1]) {
        g.save();
        g.scale(sgn * (0.25 + flap * 0.75), 1);
        g.beginPath();
        g.ellipse(4, -3, 4.6, 3.6, -0.4, 0, Math.PI * 2);
        g.ellipse(3.4, 3, 3, 2.4, 0.4, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      g.fillStyle = '#1a1a1a';
      g.fillRect(-0.7, -4, 1.4, 8);
      g.restore();
      return true;
    }
    case 'pWeb': {
      // teia no canto (perto da câmera) com uma aranha subindo e descendo no fio
      const web = piece('pweb', 180, 180, 0, 0, (c) => {
        c.strokeStyle = 'rgba(235,235,245,0.55)';
        c.lineWidth = 1;
        const n = 7;
        const ends: [number, number][] = [];
        for (let i = 0; i < n; i++) {
          const a = (i / (n - 1)) * (Math.PI / 2);
          const L = 150 + (i % 2) * 20;
          ends.push([Math.cos(a) * L, Math.sin(a) * L]);
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(Math.cos(a) * L, Math.sin(a) * L);
          c.stroke();
        }
        c.strokeStyle = 'rgba(235,235,245,0.35)';
        for (let k = 1; k <= 7; k++) {
          const f = k / 7.5;
          c.beginPath();
          for (let i = 0; i < n; i++) {
            const [ex, ey] = ends[i];
            const x = ex * f;
            const y = ey * f;
            if (i === 0) c.moveTo(x, y);
            else {
              const [px, py] = ends[i - 1];
              c.quadraticCurveTo(((px + ex) / 2) * f * 0.92, ((py + ey) / 2) * f * 0.92, x, y);
            }
          }
          c.stroke();
        }
      });
      drawPiece(g, web);
      // aranha: desce devagar, para, sobe rápido
      const ph = (t * 0.22 + (Math.abs(seed) % 10) * 0.1) % 1;
      const drop = ph < 0.6 ? ph / 0.6 : ph < 0.8 ? 1 : 1 - (ph - 0.8) / 0.2;
      const ax = 70;
      const ay = 60;
      const sy = ay + drop * 120 + Math.sin(t * 3 + seed) * 2;
      g.strokeStyle = 'rgba(235,235,245,0.6)';
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(ax, sy);
      g.stroke();
      g.save();
      g.translate(ax, sy + 8);
      const wig = Math.sin(t * 14 + seed) * 0.15;
      g.strokeStyle = '#140c0c';
      g.lineWidth = 1.6;
      for (const sgn of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const a = (-0.9 + i * 0.55 + (i % 2 ? wig : -wig)) * sgn;
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(sgn * 8 * Math.cos(a), -4 + 8 * Math.sin(Math.abs(a)));
          g.lineTo(sgn * 13 * Math.cos(a * 0.8), 4 + 8 * Math.sin(Math.abs(a)));
          g.stroke();
        }
      }
      g.fillStyle = '#1a1010';
      g.beginPath();
      g.ellipse(0, 3, 5.5, 7, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(0, -5, 3.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#c8202a';
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(2.4, 4);
      g.lineTo(0, 8);
      g.lineTo(-2.4, 4);
      g.closePath();
      g.fill();
      g.fillStyle = '#ff6a5a';
      g.fillRect(-2, -6.5, 1.2, 1.2);
      g.fillRect(0.8, -6.5, 1.2, 1.2);
      g.restore();
      return true;
    }
    case 'pRoots': {
      // raízes escuras penduradas do teto (primeiro plano)
      const v = Math.abs(seed) % 2;
      const s = piece('proots' + v, 220, 260, 110, 0, (c) => {
        const r = new Rng(v * 7 + 2);
        c.strokeStyle = '#0d0a08';
        c.lineCap = 'round';
        for (let i = 0; i < 9; i++) {
          const x0 = r.range(-100, 100);
          const len = r.range(90, 250);
          c.lineWidth = r.range(4, 11);
          c.beginPath();
          c.moveTo(x0, -4);
          c.bezierCurveTo(x0 + r.range(-30, 30), len * 0.35, x0 + r.range(-40, 40), len * 0.7, x0 + r.range(-20, 20), len);
          c.stroke();
        }
        c.fillStyle = '#0d0a08';
        c.fillRect(-110, -10, 220, 14);
      });
      drawPiece(g, s, Math.sin(t * 0.5 + seed) * 0.02, 0.92);
      return true;
    }
    case 'pPillar': {
      // coluna escura bem perto da câmera (atravessa a tela mais rápido que o cenário)
      const s = piece('ppillar', 90, 520, 45, 520, (c) => {
        c.fillStyle = '#080a08';
        c.fillRect(-34, -500, 68, 500);
        c.fillRect(-45, -26, 90, 26);
        c.fillRect(-45, -520, 90, 30);
        c.fillStyle = 'rgba(90,110,80,0.14)';
        c.fillRect(-30, -500, 8, 474);
        c.strokeStyle = 'rgba(0,0,0,0.5)';
        c.lineWidth = 2;
        for (let y = -470; y < -30; y += 46) {
          c.beginPath();
          c.moveTo(-34, y);
          c.lineTo(34, y);
          c.stroke();
        }
        c.fillStyle = 'rgba(60,100,50,0.35)';
        for (let i = 0; i < 6; i++) {
          c.beginPath();
          c.ellipse(-20 + (i % 3) * 18, -480 + i * 80, 14, 5, 0, 0, Math.PI * 2);
          c.fill();
        }
      });
      drawPiece(g, s, 0, 0.95);
      return true;
    }
    case 'pBranch': {
      // galho com folhas escuras no alto da tela (primeiro plano)
      const v = Math.abs(seed) % 2;
      const s = piece('pbranch' + v, 420, 200, 210, 0, (c) => {
        const r = new Rng(v * 5 + 11);
        c.strokeStyle = '#06100a';
        c.lineWidth = 16;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(-210, 10);
        c.quadraticCurveTo(-40, 40, 160, 20);
        c.stroke();
        c.lineWidth = 6;
        for (let i = 0; i < 5; i++) {
          const x = r.range(-160, 120);
          c.beginPath();
          c.moveTo(x, 26);
          c.quadraticCurveTo(x + 20, 70, x + r.range(-10, 40), r.range(90, 140));
          c.stroke();
        }
        for (let i = 0; i < 26; i++) {
          c.save();
          c.translate(r.range(-200, 180), r.range(10, 170));
          c.rotate(r.range(0, 6.28));
          c.fillStyle = i % 2 ? '#08160c' : '#0b1d10';
          c.beginPath();
          c.ellipse(16, 0, 22, 8, 0, 0, Math.PI * 2);
          c.fill();
          c.restore();
        }
      });
      drawPiece(g, s, Math.sin(t * 0.7 + seed) * 0.025, 0.95);
      return true;
    }
    case 'pLeaves': {
      // folhagem escura subindo do pé da tela (primeiro plano)
      const v = Math.abs(seed) % 2;
      const s = piece('pleaves' + v, 360, 200, 180, 200, (c) => {
        const r = new Rng(v * 3 + 17);
        for (let i = 0; i < 14; i++) {
          const a = -Math.PI / 2 + r.range(-1.2, 1.2);
          const l = r.range(110, 190);
          c.save();
          c.translate(r.range(-120, 120), 0);
          c.rotate(a);
          c.fillStyle = i % 2 ? '#07130a' : '#0a1a0e';
          c.beginPath();
          c.moveTo(0, 0);
          c.quadraticCurveTo(l * 0.5, -26, l, 0);
          c.quadraticCurveTo(l * 0.5, 26, 0, 0);
          c.fill();
          c.restore();
        }
      });
      drawPiece(g, s, Math.sin(t * 0.9 + seed) * 0.03, 0.96);
      return true;
    }
    case 'jChasm': {
      return true;
    }
    default:
      return false;
  }
}
