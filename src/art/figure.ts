/**
 * Figuras de NPC com acabamento de ilustração, leves no jogo:
 * - ROSTO: assado UMA vez por aparência e expressão (olhos com íris e brilho, pálpebra, sobrancelha,
 *   nariz em 3/4, boca, bochecha, cabelo com mechas e brilho). O quadro só copia a imagem.
 * - CORPO: contínuo. Cada perna/braço é um único traço quadril→joelho→pé (ombro→cotovelo→mão) com
 *   juntas arredondadas; o contorno de tronco e pernas sai num passe só e o preenchimento por cima,
 *   então não aparecem "juntas de boneco". Nada é alocado por quadro (sem gradiente, sem canvas).
 */
import { bake, OUT, type Sprite } from './kit';
import { shade } from '../core/math';

// ------------------------------------------------------------------------------------------ rosto
export type FaceHair =
  | 'short' | 'long' | 'curly' | 'bun' | 'bald' | 'cap' | 'hat' | 'afro' | 'puffs' | 'braids' | 'wrap' | 'straw' | 'spiky';
export type Expr = 'calm' | 'talk' | 'fear' | 'joy';

export interface FaceSpec {
  skin: string;
  hair: string;
  hairStyle: FaceHair;
  /** cor do boné/chapéu/lenço */
  accent: string;
  iris: string;
  kid?: boolean;
  elder?: boolean;
  lashes?: boolean;
  beard?: 'none' | 'stubble' | 'mustache' | 'full';
  glasses?: boolean;
  headphones?: boolean;
  earring?: string;
  freckles?: boolean;
  /** pintura facial de festa (aldeia) */
  paint?: string;
}

const FW = 30;
const FH = 32;
/** origem do rosto: base do queixo, onde encaixa o pescoço */
export const FACE_OX = 15;
export const FACE_OY = 27;

export function bakeFace(f: FaceSpec, expr: Expr): Sprite {
  return bake(FW, FH, (g) => paintFace(g, f, expr), { scale: 4, ox: FACE_OX, oy: FACE_OY });
}

function headPath(g: CanvasRenderingContext2D, kid: boolean) {
  // crânio redondo atrás, mandíbula descendo para o queixo à frente (vista 3/4 olhando para +x)
  const k = kid ? 1.06 : 1;
  g.beginPath();
  g.moveTo(15, 5.5 / k);
  g.bezierCurveTo(8.5, 5.2, 5.2, 10, 5.6, 15.5);
  g.bezierCurveTo(5.9, 20.5, 9.5, kid ? 25 : 24.5, 15.2, kid ? 26.2 : 26.6);
  g.bezierCurveTo(19.5, kid ? 26.4 : 26.8, 22.6, 24, 23.4, 20.2);
  g.lineTo(24.1, 16.6);
  g.bezierCurveTo(24.6, 12.8, 23.8, 9.6, 21.8, 7.6);
  g.bezierCurveTo(20, 5.9, 17.6, 5.4, 15, 5.5 / k);
  g.closePath();
}

function paintFace(g: CanvasRenderingContext2D, f: FaceSpec, expr: Expr) {
  const kid = !!f.kid;
  const hairD = shade(f.hair, -0.28);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // ---------- cabelo de trás
  backHair(g, f, hairD);
  // ---------- orelha
  g.fillStyle = shade(f.skin, -0.06);
  g.strokeStyle = OUT;
  g.lineWidth = 0.9;
  g.beginPath();
  g.ellipse(9.4, 16.2, 2.1, 2.9, -0.15, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.strokeStyle = shade(f.skin, -0.32);
  g.lineWidth = 0.6;
  g.beginPath();
  g.arc(9.6, 16.2, 1.1, -1.2, 1.4);
  g.stroke();
  if (f.earring) {
    g.fillStyle = f.earring;
    g.beginPath();
    g.arc(9.6, 19.4, 0.9, 0, Math.PI * 2);
    g.fill();
  }
  // ---------- cabeça com volume (gradiente só aqui, no assar)
  headPath(g, kid);
  const vol = g.createRadialGradient(19, 12, 1, 15, 16, 13);
  vol.addColorStop(0, shade(f.skin, 0.1));
  vol.addColorStop(0.55, f.skin);
  vol.addColorStop(1, shade(f.skin, -0.18));
  g.fillStyle = vol;
  g.fill();
  g.save();
  g.clip();
  // sombra do maxilar e da nuca
  g.fillStyle = 'rgba(60,20,40,0.13)';
  g.beginPath();
  g.ellipse(9, 18, 4.5, 9, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(60,20,40,0.1)';
  g.beginPath();
  g.ellipse(17, 27.5, 8, 2.6, 0, 0, Math.PI * 2);
  g.fill();
  // blush e sardas
  g.fillStyle = kid ? 'rgba(255,96,120,0.32)' : 'rgba(255,100,120,0.2)';
  g.beginPath();
  g.ellipse(17.2, 20, 2.4, 1.4, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(23, 19.6, 1, 1.2, 0, 0, Math.PI * 2);
  g.fill();
  if (f.freckles) {
    g.fillStyle = shade(f.skin, -0.3);
    for (const [x, y] of [[16, 18.4], [17.6, 18], [19, 18.6], [21.6, 18.2], [22.6, 18.9]]) g.fillRect(x, y, 0.55, 0.55);
  }
  if (f.paint) {
    g.strokeStyle = f.paint;
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(15.4, 21.4);
    g.lineTo(18.6, 21.6);
    g.moveTo(15.8, 22.8);
    g.lineTo(18.4, 23);
    g.stroke();
    g.fillStyle = f.paint;
    g.fillRect(19.2, 7.6, 1, 1);
    g.fillRect(17.4, 7.9, 1, 1);
  }
  // barba
  if (f.beard === 'full' || f.beard === 'stubble') {
    g.fillStyle = f.beard === 'full' ? f.hair : 'rgba(40,25,30,0.22)';
    g.beginPath();
    g.moveTo(8, 18);
    g.bezierCurveTo(9, 24, 12, 27.4, 16, 27.4);
    g.bezierCurveTo(20.6, 27.4, 23.6, 24.6, 23.6, 20.4);
    g.bezierCurveTo(21, 22.8, 18, 22.4, 16.4, 22.6);
    g.bezierCurveTo(13.6, 22.8, 11.4, 21.4, 10, 18);
    g.closePath();
    g.fill();
  }
  g.restore();
  headPath(g, kid);
  g.strokeStyle = OUT;
  g.lineWidth = 1.15;
  g.stroke();
  // ---------- rugas (idosos)
  if (f.elder) {
    g.strokeStyle = shade(f.skin, -0.34);
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(13.4, 15);
    g.lineTo(12.4, 15.8);
    g.moveTo(13.6, 16.2);
    g.lineTo(12.6, 16.9);
    g.moveTo(16.5, 9.6);
    g.quadraticCurveTo(19, 9, 21.5, 9.7);
    g.moveTo(20.4, 19.5);
    g.quadraticCurveTo(21.6, 21, 21.2, 22.6);
    g.stroke();
  }
  // ---------- olhos
  const eyeY = kid ? 15.6 : 14.6;
  const eyes: [number, number][] = [[16.4, kid ? 1.18 : 1], [21.5, kid ? 0.92 : 0.8]];
  for (const [ex, s] of eyes) {
    if (expr === 'joy') {
      g.strokeStyle = OUT;
      g.lineWidth = 0.95;
      g.beginPath();
      g.arc(ex, eyeY + 0.8, 1.7 * s, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
      continue;
    }
    const ry = (expr === 'fear' ? 2.2 : 1.75) * s;
    const rx = 1.95 * s;
    g.fillStyle = '#fbf7f2';
    g.beginPath();
    g.ellipse(ex, eyeY, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.beginPath();
    g.ellipse(ex, eyeY, rx, ry, 0, 0, Math.PI * 2);
    g.clip();
    const ir = (expr === 'fear' ? 1.0 : 1.32) * s;
    const ix = ex + 0.55 * s;
    g.fillStyle = f.iris;
    g.beginPath();
    g.arc(ix, eyeY + 0.15, ir, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = shade(f.iris, -0.45);
    g.beginPath();
    g.arc(ix, eyeY + 0.15, ir * 0.52, 0, Math.PI * 2);
    g.fill();
    // sombra da pálpebra
    g.fillStyle = 'rgba(40,20,40,0.22)';
    g.fillRect(ex - 3, eyeY - ry - 1, 6, 1.6);
    g.restore();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(ix + 0.45 * s, eyeY - 0.5 * s, 0.48 * s, 0, Math.PI * 2);
    g.fill();
    // linha dos cílios (pálpebra superior)
    g.strokeStyle = OUT;
    g.lineWidth = f.lashes ? 1.15 : 0.85;
    g.beginPath();
    g.ellipse(ex, eyeY, rx, ry, 0, Math.PI * 1.08, Math.PI * 1.98);
    g.stroke();
    if (f.lashes) {
      g.beginPath();
      g.moveTo(ex + rx * 0.95, eyeY - ry * 0.35);
      g.lineTo(ex + rx * 1.45, eyeY - ry * 0.85);
      g.stroke();
    }
  }
  // ---------- sobrancelhas (expressão)
  const browC = f.elder ? '#c9c4cf' : hairD;
  g.strokeStyle = browC;
  g.lineWidth = kid ? 0.9 : 1.15;
  const by = eyeY - (expr === 'fear' ? 3.6 : 3);
  g.beginPath();
  if (expr === 'fear') {
    g.moveTo(14.4, by + 0.4);
    g.quadraticCurveTo(16.2, by - 0.6, 18, by - 0.2);
    g.moveTo(20.2, by - 0.3);
    g.quadraticCurveTo(21.6, by - 0.6, 23, by + 0.2);
  } else {
    g.moveTo(14.4, by + 0.5);
    g.quadraticCurveTo(16.4, by - 0.5, 18.3, by + 0.2);
    g.moveTo(20.3, by + 0.1);
    g.quadraticCurveTo(21.8, by - 0.3, 23.1, by + 0.5);
  }
  g.stroke();
  // ---------- nariz (perfil 3/4)
  g.fillStyle = shade(f.skin, -0.05);
  g.strokeStyle = shade(f.skin, -0.42);
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(22.6, eyeY + 0.6);
  g.quadraticCurveTo(25.2, eyeY + 3.8, 24.6, eyeY + 4.4);
  g.quadraticCurveTo(23.6, eyeY + 5, 22.2, eyeY + 4.4);
  g.fill();
  g.stroke();
  g.fillStyle = shade(f.skin, -0.45);
  g.fillRect(22.7, eyeY + 3.9, 0.7, 0.5);
  // ---------- bigode
  if (f.beard === 'mustache' || f.beard === 'full') {
    g.fillStyle = f.elder ? '#d9d4de' : f.hair;
    g.strokeStyle = OUT;
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(17.4, eyeY + 6);
    g.quadraticCurveTo(20.4, eyeY + 4.2, 23.6, eyeY + 5.4);
    g.quadraticCurveTo(20.6, eyeY + 6.6, 17.4, eyeY + 6);
    g.fill();
    g.stroke();
  }
  // ---------- boca
  const mx = 20.2;
  const my = eyeY + 7;
  g.strokeStyle = OUT;
  g.lineWidth = 0.8;
  if (expr === 'calm') {
    g.beginPath();
    g.moveTo(mx - 2.2, my - 0.2);
    g.quadraticCurveTo(mx, my + 1.3, mx + 2.2, my - 0.6);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(mx - 0.6, my + 1.6);
    g.lineTo(mx + 0.8, my + 1.5);
    g.stroke();
  } else {
    const open = expr === 'fear' ? 1.5 : expr === 'joy' ? 2.3 : 1.9;
    g.fillStyle = '#4a1324';
    g.beginPath();
    if (expr === 'joy') {
      g.moveTo(mx - 2.8, my - 0.6);
      g.quadraticCurveTo(mx, my - 0.1, mx + 2.6, my - 1);
      g.quadraticCurveTo(mx + 1.2, my + open + 1, mx - 0.4, my + open);
      g.quadraticCurveTo(mx - 2.2, my + open * 0.6, mx - 2.8, my - 0.6);
    } else g.ellipse(mx, my + 0.6, expr === 'fear' ? 1.3 : 2, open, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // dentes e língua
    g.fillStyle = '#fffaf0';
    if (expr !== 'fear') g.fillRect(mx - 1.4, my - 0.5, 2.8, 0.75);
    g.fillStyle = '#ff7a8c';
    g.beginPath();
    g.ellipse(mx + 0.2, my + open * 0.75, 1.1, 0.6, 0, 0, Math.PI * 2);
    g.fill();
  }
  // ---------- cabelo de cima, acessórios
  topHair(g, f, hairD);
  if (f.glasses) {
    g.strokeStyle = '#1c1424';
    g.lineWidth = 0.85;
    g.fillStyle = 'rgba(170,230,255,0.22)';
    for (const [ex, rx] of [[16.4, 2.6], [21.6, 2]] as [number, number][]) {
      g.beginPath();
      g.ellipse(ex, eyeY, rx, 2.1, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.beginPath();
    g.moveTo(19, eyeY - 0.3);
    g.lineTo(19.6, eyeY - 0.3);
    g.moveTo(13.8, eyeY - 0.4);
    g.lineTo(9.8, eyeY - 1.2);
    g.stroke();
  }
  if (f.headphones) {
    g.strokeStyle = '#2a2440';
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(14.4, 15.4, 9.6, Math.PI * 1.08, Math.PI * 1.72);
    g.stroke();
    g.fillStyle = f.accent;
    g.strokeStyle = OUT;
    g.lineWidth = 0.8;
    g.beginPath();
    g.ellipse(8.8, 16.2, 2.4, 3.3, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
}

/** cabelo atrás da cabeça (comprido, tranças, coque, black power, puffs) */
function backHair(g: CanvasRenderingContext2D, f: FaceSpec, hairD: string) {
  g.fillStyle = f.hair;
  g.strokeStyle = OUT;
  g.lineWidth = 1;
  const s = f.hairStyle;
  if (s === 'long') {
    g.beginPath();
    g.moveTo(7, 9);
    g.bezierCurveTo(2.2, 15, 3, 25, 6.2, 29.5);
    g.bezierCurveTo(9, 30.5, 12.5, 30, 14, 28.6);
    g.bezierCurveTo(11.4, 22, 11, 15, 14, 8);
    g.closePath();
    g.fill();
    g.stroke();
    g.strokeStyle = hairD;
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(6.4, 14);
    g.quadraticCurveTo(5, 21, 7.4, 28);
    g.moveTo(9.4, 15);
    g.quadraticCurveTo(8.6, 22, 10.6, 28.4);
    g.stroke();
  } else if (s === 'braids') {
    for (const bx of [6.4, 9.2]) {
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.ellipse(bx - i * 0.2, 17 + i * 2.6, 1.6, 1.5, 0.3, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
    }
  } else if (s === 'afro') {
    g.beginPath();
    g.arc(13.6, 11.6, 9.6, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else if (s === 'puffs') {
    for (const [x, y] of [[7.2, 6.6], [19.6, 3.6]] as [number, number][]) {
      g.beginPath();
      g.arc(x, y, 3.8, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  } else if (s === 'bun') {
    g.beginPath();
    g.arc(8.4, 5.8, 3.6, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
}

/** calota de cabelo com franja, mechas e brilho; boné, chapéus e lenço por cima */
function topHair(g: CanvasRenderingContext2D, f: FaceSpec, hairD: string) {
  const s = f.hairStyle;
  g.strokeStyle = OUT;
  g.lineWidth = 1;
  const cap = (fringe: number) => {
    g.fillStyle = f.hair;
    g.beginPath();
    g.moveTo(6.2, 17);
    g.bezierCurveTo(4.4, 8.4, 9.6, 3.6, 15.6, 3.8);
    g.bezierCurveTo(21, 4, 24.6, 7.4, 24, 11.4);
    g.bezierCurveTo(22, 9.4 + fringe, 19.4, 9.6 + fringe, 17.2, 10.2 + fringe);
    g.bezierCurveTo(14.6, 9.4, 12.4, 10.6, 11.6, 13.2);
    g.bezierCurveTo(10.8, 14.6, 10.6, 16, 10.8, 17.4);
    g.lineTo(8.6, 18.6);
    g.closePath();
    g.fill();
    g.stroke();
    g.strokeStyle = hairD;
    g.lineWidth = 0.55;
    g.beginPath();
    g.moveTo(9, 9);
    g.quadraticCurveTo(13, 6, 17.6, 6.4);
    g.moveTo(8.2, 12.4);
    g.quadraticCurveTo(10.6, 9.2, 14.2, 8.2);
    g.moveTo(18.6, 7);
    g.quadraticCurveTo(21.6, 7.6, 23, 10);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.beginPath();
    g.ellipse(13.6, 5.9, 3.6, 1.1, -0.18, 0, Math.PI * 2);
    g.fill();
  };
  switch (s) {
    case 'short':
    case 'long':
    case 'bun':
    case 'braids':
      cap(s === 'short' ? 0 : 0.8);
      break;
    case 'spiky': {
      cap(-0.4);
      g.fillStyle = f.hair;
      g.strokeStyle = OUT;
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(9, 6.6);
      g.lineTo(10.6, 1.6);
      g.lineTo(13, 4.4);
      g.lineTo(15.6, 0.8);
      g.lineTo(17.4, 4.2);
      g.lineTo(20.6, 2);
      g.lineTo(20.8, 6);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    }
    case 'curly':
    case 'afro': {
      const pts: [number, number, number][] = s === 'afro'
        ? [[8, 6, 3.8], [12.4, 3.2, 4], [17.4, 3.2, 3.9], [21.6, 6.4, 3.2], [6.4, 11, 3.2]]
        : [[7.6, 9.4, 3], [9.6, 5.8, 3.2], [13.6, 4, 3.3], [17.8, 4.4, 3.1], [21.2, 6.8, 2.6], [6.8, 13.6, 2.4]];
      g.fillStyle = f.hair;
      for (const [x, y, r] of pts) {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      g.beginPath();
      for (const [x, y, r] of pts) {
        g.moveTo(x + r * 0.72, y);
        g.arc(x, y, r * 0.72, 0, Math.PI * 2);
      }
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.22)';
      for (const [x, y, r] of pts) {
        g.beginPath();
        g.arc(x - r * 0.25, y - r * 0.35, r * 0.32, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'puffs':
      cap(1.4);
      g.strokeStyle = f.accent;
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(9.4, 8.4);
      g.lineTo(10.4, 6.6);
      g.moveTo(18, 5.6);
      g.lineTo(19, 3.6);
      g.stroke();
      break;
    case 'bald':
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.beginPath();
      g.ellipse(15, 7.8, 4.2, 1.6, -0.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = f.hair;
      g.strokeStyle = OUT;
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(6.2, 12.6);
      g.quadraticCurveTo(6.6, 18, 8.4, 19.4);
      g.lineTo(9.2, 13.4);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    case 'cap':
      cap(0);
      g.fillStyle = f.accent;
      g.beginPath();
      g.moveTo(5.8, 12);
      g.bezierCurveTo(5.4, 4.8, 10.6, 2.6, 15.6, 2.8);
      g.bezierCurveTo(20.6, 3, 23.6, 5.6, 23.8, 9.6);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = shade(f.accent, -0.3);
      g.beginPath();
      g.moveTo(20.6, 8.6);
      g.quadraticCurveTo(26.4, 8, 28.6, 9.8);
      g.quadraticCurveTo(25, 10.8, 20.8, 10.4);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath();
      g.arc(15, 6, 1.2, 0, Math.PI * 2);
      g.fill();
      break;
    case 'hat':
    case 'straw': {
      cap(0);
      const straw = s === 'straw';
      const c = straw ? '#d9b867' : f.accent;
      g.fillStyle = c;
      g.beginPath();
      g.ellipse(15, 8.4, 12.6, 2.6, -0.04, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(8.4, 8.4);
      g.bezierCurveTo(8.6, 1.4, 21.2, 1.2, 21.4, 8);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = straw ? '#9c4a32' : shade(f.accent, -0.35);
      g.fillRect(8.6, 6.4, 12.6, 1.5);
      if (straw) {
        g.strokeStyle = '#a98a45';
        g.lineWidth = 0.4;
        g.beginPath();
        for (let x = 4; x < 27; x += 2.2) {
          g.moveTo(x, 7.4);
          g.lineTo(x + 0.8, 9.6);
        }
        g.stroke();
      }
      break;
    }
    case 'wrap': {
      // lenço amarrado (aldeia), com estampa de pontos
      g.fillStyle = f.accent;
      g.beginPath();
      g.moveTo(5.8, 15);
      g.bezierCurveTo(4, 5.6, 10.6, 1, 16.2, 1.6);
      g.bezierCurveTo(22.4, 2.2, 25, 6.6, 23.8, 11);
      g.bezierCurveTo(19.6, 9.4, 13, 9.4, 9.6, 12.4);
      g.lineTo(8.4, 16.4);
      g.closePath();
      g.fill();
      g.stroke();
      g.beginPath();
      g.ellipse(7, 4.6, 3, 2.4, -0.6, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = 'rgba(255,240,200,0.75)';
      for (const [x, y] of [[11, 5], [14.6, 4], [18.4, 4.6], [21.6, 7], [13, 8], [17, 7.4], [9, 9]]) {
        g.beginPath();
        g.arc(x, y, 0.65, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
  }
}

// ------------------------------------------------------------------------------------------ corpo
export interface FigureLook {
  skin: string;
  skinD: string;
  top: string;
  topD: string;
  /** detalhe da roupa (gola, estampa, alças) */
  top2: string;
  /** manga: 0 = sem, 0.5 = curta, 1 = longa */
  sleeve: number;
  bottom: string;
  bottomD: string;
  bottomKind: 'pants' | 'shorts' | 'skirt' | 'dress';
  shoe: string;
  /** largura dos membros e proporções */
  limb: number;
  thigh: number;
  shin: number;
  torso: number;
  shoulder: number;
  hip: number;
  arm: number;
  fore: number;
  headScale: number;
  belly?: number;
  pack?: string;
  bag?: string;
  apron?: string;
  necklace?: string;
}

export function figureLook(o: Omit<FigureLook, 'skinD' | 'topD' | 'bottomD'>): FigureLook {
  return { ...o, skinD: shade(o.skin, -0.2), topD: shade(o.top, -0.24), bottomD: shade(o.bottom, -0.24) };
}

/** Pose em unidades locais: pés no chão (y=0), olhando para +x. Vetores reaproveitáveis. */
export interface FigurePose {
  /** inclinação do tronco (rad, + = para frente) */
  lean: number;
  /** quadril: deslocamento vertical (agachar = +) e lateral */
  hipDrop: number;
  hipX: number;
  /** respiração (escala vertical do tronco, ~0) */
  breath: number;
  footBX: number;
  footBY: number;
  footFX: number;
  footFY: number;
  /** mãos relativas ao ombro */
  handBX: number;
  handBY: number;
  handFX: number;
  handFY: number;
  headTilt: number;
  head: Sprite;
}

export const newPose = (head: Sprite): FigurePose => ({
  lean: 0, hipDrop: 0, hipX: 0, breath: 0, footBX: -2, footBY: 0, footFX: 2, footFY: 0,
  handBX: -1.5, handBY: 12, handFX: 1.5, handFY: 12, headTilt: 0, head,
});

// buffers de juntas (sem alocar por quadro)
const J = { x: 0, y: 0 };
/** junta do meio (joelho/cotovelo) por IK de dois ossos; `bend` = lado da dobra (+1 para frente) */
function joint(ax: number, ay: number, bx: number, by: number, l1: number, l2: number, bend: number) {
  let dx = bx - ax;
  let dy = by - ay;
  let d = Math.hypot(dx, dy) || 0.001;
  const max = l1 + l2 - 0.05;
  if (d > max) {
    dx *= max / d;
    dy *= max / d;
    d = max;
  }
  const a = Math.atan2(dy, dx);
  const c = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const t = a - bend * Math.acos(c);
  J.x = ax + Math.cos(t) * l1;
  J.y = ay + Math.sin(t) * l1;
}

function limbPath(g: CanvasRenderingContext2D, ax: number, ay: number, jx: number, jy: number, bx: number, by: number) {
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(jx, jy);
  g.lineTo(bx, by);
}

/** Pedaço da perna/braço coberto pela roupa: do início até a fração `t` do comprimento. */
function partialPath(g: CanvasRenderingContext2D, ax: number, ay: number, jx: number, jy: number, bx: number, by: number, t: number) {
  const l1 = Math.hypot(jx - ax, jy - ay);
  const l2 = Math.hypot(bx - jx, by - jy);
  const L = (l1 + l2) * t;
  g.beginPath();
  g.moveTo(ax, ay);
  if (L <= l1) {
    const k = L / (l1 || 1);
    g.lineTo(ax + (jx - ax) * k, ay + (jy - ay) * k);
  } else {
    g.lineTo(jx, jy);
    const k = (L - l1) / (l2 || 1);
    g.lineTo(jx + (bx - jx) * k, jy + (by - jy) * k);
  }
}

function leg(g: CanvasRenderingContext2D, L: FigureLook, hx: number, hy: number, fx: number, fy: number, back: boolean, outline: boolean) {
  joint(hx, hy, fx, fy - 1.2, L.thigh, L.shin, 1);
  const jx = J.x;
  const jy = J.y;
  const w = L.limb * 1.12;
  const ky = fy - 1.2;
  if (outline) {
    g.strokeStyle = OUT;
    g.lineWidth = w + 2;
    limbPath(g, hx, hy, jx, jy, fx, ky);
    g.stroke();
    return;
  }
  const bare = L.bottomKind !== 'pants';
  g.lineWidth = w;
  g.strokeStyle = back ? L.skinD : L.skin;
  if (bare) {
    limbPath(g, hx, hy, jx, jy, fx, ky);
    g.stroke();
  }
  const cover = L.bottomKind === 'pants' ? 1 : L.bottomKind === 'shorts' ? 0.42 : 0;
  if (cover > 0) {
    g.strokeStyle = back ? L.bottomD : L.bottom;
    g.lineWidth = w + (L.bottomKind === 'shorts' ? 0.8 : 0.3);
    if (cover >= 1) limbPath(g, hx, hy, jx, jy, fx, ky);
    else partialPath(g, hx, hy, jx, jy, fx, ky, cover);
    g.stroke();
  }
  // sapato: oval apontando para a frente
  g.fillStyle = back ? shade(L.shoe, -0.25) : L.shoe;
  g.strokeStyle = OUT;
  g.lineWidth = 0.9;
  g.beginPath();
  g.ellipse(fx + 1.4, fy - 1.1, 2.9, 1.5, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
}

function arm(g: CanvasRenderingContext2D, L: FigureLook, sx: number, sy: number, hx: number, hy: number, back: boolean) {
  joint(sx, sy, hx, hy, L.arm, L.fore, -1);
  const jx = J.x;
  const jy = J.y;
  const w = L.limb;
  g.strokeStyle = OUT;
  g.lineWidth = w + 1.9;
  limbPath(g, sx, sy, jx, jy, hx, hy);
  g.stroke();
  g.strokeStyle = back ? L.skinD : L.skin;
  g.lineWidth = w;
  limbPath(g, sx, sy, jx, jy, hx, hy);
  g.stroke();
  if (L.sleeve > 0) {
    g.strokeStyle = back ? L.topD : L.top;
    g.lineWidth = w + 0.9;
    partialPath(g, sx, sy, jx, jy, hx, hy, L.sleeve >= 1 ? 0.88 : 0.36);
    g.stroke();
  }
  // mão
  g.fillStyle = back ? L.skinD : L.skin;
  g.strokeStyle = OUT;
  g.lineWidth = 0.8;
  g.beginPath();
  g.arc(hx, hy, w * 0.62, 0, Math.PI * 2);
  g.fill();
  g.stroke();
}

function torsoPath(g: CanvasRenderingContext2D, L: FigureLook, sy: number, hy: number) {
  const sw = L.shoulder;
  const hw = L.hip;
  const b = L.belly ?? 0;
  g.beginPath();
  g.moveTo(-sw * 0.5, sy + 1.4);
  g.quadraticCurveTo(-sw * 0.52, sy - 0.4, -sw * 0.2, sy - 0.6);
  g.lineTo(sw * 0.3, sy - 0.6);
  g.quadraticCurveTo(sw * 0.56, sy - 0.2, sw * 0.52, sy + 1.6);
  g.quadraticCurveTo(sw * 0.5 + b, (sy + hy) / 2, hw * 0.52, hy);
  g.lineTo(-hw * 0.5, hy);
  g.quadraticCurveTo(-sw * 0.48 - b * 0.3, (sy + hy) / 2, -sw * 0.5, sy + 1.4);
  g.closePath();
}

/**
 * Desenha a figura com os pés em (0,0) no sistema já transladado/espelhado pelo chamador.
 * Ordem: braço de trás, contorno único (pernas+tronco), preenchimentos, cabeça, braço da frente.
 */
export function drawFigure(g: CanvasRenderingContext2D, L: FigureLook, P: FigurePose) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const legLen = L.thigh + L.shin;
  const hy = -legLen + 0.6 + P.hipDrop;
  const hx = P.hipX;
  const tl = L.torso * (1 + P.breath);
  // ombros giram com a inclinação em torno do quadril
  const sx = hx + Math.sin(P.lean) * tl;
  const sy = hy - Math.cos(P.lean) * tl;
  const bx = hx - 1.6;
  const fx = hx + 1.6;
  if (L.pack) {
    g.fillStyle = L.pack;
    g.strokeStyle = OUT;
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(sx - L.shoulder * 0.5 - 4.2, sy + 1, 5.4, tl * 0.72, 2);
    g.fill();
    g.stroke();
  }
  arm(g, L, sx - 1.4, sy + 1.6, sx + P.handBX, sy + P.handBY, true);
  // pernas: contorno de trás → preenchimento de trás → contorno conjunto da frente
  leg(g, L, bx, hy, P.footBX, P.footBY, true, true);
  leg(g, L, bx, hy, P.footBX, P.footBY, true, false);
  leg(g, L, fx, hy, P.footFX, P.footFY, false, true);
  g.save();
  g.translate(hx, hy);
  g.rotate(P.lean);
  const tsy = -tl;
  const hy0 = 0;
  torsoPath(g, L, tsy, hy0 + 1);
  g.strokeStyle = OUT;
  g.lineWidth = 2;
  g.stroke();
  g.restore();
  leg(g, L, fx, hy, P.footFX, P.footFY, false, false);
  // tronco (roupa) por cima das pernas: some a emenda do quadril
  g.save();
  g.translate(hx, hy);
  g.rotate(P.lean);
  if (L.bottomKind === 'skirt' || L.bottomKind === 'dress') {
    const c = L.bottomKind === 'dress' ? L.top : L.bottom;
    g.fillStyle = c;
    g.strokeStyle = OUT;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-L.hip * 0.55, hy0 - 2.5);
    g.lineTo(L.hip * 0.6, hy0 - 2.5);
    g.lineTo(L.hip * 0.95, hy0 + L.thigh * 0.85);
    g.quadraticCurveTo(0, hy0 + L.thigh * 1.0, -L.hip * 0.9, hy0 + L.thigh * 0.85);
    g.closePath();
    g.fill();
    g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(-1, hy0);
    g.lineTo(-2, hy0 + L.thigh * 0.8);
    g.moveTo(2.4, hy0);
    g.lineTo(3.4, hy0 + L.thigh * 0.8);
    g.stroke();
  }
  torsoPath(g, L, tsy, hy0 + 1);
  g.fillStyle = L.top;
  g.fill();
  // sombra das costas e brilho no peito (formas simples, sem gradiente)
  g.fillStyle = L.topD;
  g.beginPath();
  g.moveTo(-L.shoulder * 0.5, tsy + 1.6);
  g.quadraticCurveTo(-L.shoulder * 0.2, (tsy + hy0) / 2, -L.hip * 0.5, hy0 + 1);
  g.lineTo(-L.hip * 0.5 + 2, hy0 + 1);
  g.quadraticCurveTo(-L.shoulder * 0.05, (tsy + hy0) / 2, -L.shoulder * 0.3, tsy + 0.8);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(L.shoulder * 0.34, tsy + 2);
  g.quadraticCurveTo(L.shoulder * 0.42, tsy + tl * 0.4, L.shoulder * 0.3, tsy + tl * 0.62);
  g.stroke();
  // gola / decote em pele
  g.fillStyle = L.skin;
  g.beginPath();
  g.ellipse(0.6, tsy - 0.2, 2.4, 1.6, 0, 0, Math.PI);
  g.fill();
  // detalhe da roupa
  g.fillStyle = L.top2;
  if (L.bottomKind === 'pants' || L.bottomKind === 'shorts') {
    // cós
    g.fillStyle = L.bottom;
    g.fillRect(-L.hip * 0.5, hy0 - 1.6, L.hip, 2.6);
    g.fillStyle = shade(L.bottom, 0.25);
    g.fillRect(L.hip * 0.1, hy0 - 1.2, 1.4, 1.6);
  }
  g.fillStyle = L.top2;
  g.beginPath();
  g.arc(L.shoulder * 0.12, tsy + tl * 0.42, Math.min(2.6, L.shoulder * 0.16), 0, Math.PI * 2);
  g.fill();
  if (L.apron) {
    g.fillStyle = L.apron;
    g.strokeStyle = OUT;
    g.lineWidth = 0.7;
    g.beginPath();
    g.roundRect(-L.hip * 0.25, tsy + tl * 0.45, L.hip * 0.8, tl * 0.75, 1.4);
    g.fill();
    g.stroke();
  }
  if (L.necklace) {
    g.fillStyle = L.necklace;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.arc(0.6 + i * 1.3, tsy + 1.6 + Math.abs(i) * -0.3 + 0.9, 0.7, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (L.bag) {
    g.strokeStyle = '#2a1a14';
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(-L.shoulder * 0.35, tsy + 0.4);
    g.lineTo(L.hip * 0.45, hy0 - 2);
    g.stroke();
    g.fillStyle = L.bag;
    g.strokeStyle = OUT;
    g.lineWidth = 0.8;
    g.beginPath();
    g.roundRect(L.hip * 0.25, hy0 - 4, 5, 4.4, 1.2);
    g.fill();
    g.stroke();
  }
  // pescoço e cabeça
  g.strokeStyle = OUT;
  g.lineWidth = L.limb + 2;
  g.beginPath();
  g.moveTo(0.6, tsy + 0.4);
  g.lineTo(0.9, tsy - 2.4);
  g.stroke();
  g.strokeStyle = L.skin;
  g.lineWidth = L.limb;
  g.stroke();
  g.restore();
  const hs = L.headScale * 0.5;
  const headX = sx + 0.9;
  const headY = sy - 2.2;
  // braço erguido passa por trás da cabeça (o rosto nunca fica tapado)
  const raised = P.handFY < -(L.arm + L.fore) * 0.3;
  if (raised) arm(g, L, sx + 1.2, sy + 1.6, sx + P.handFX, sy + P.handFY, false);
  g.save();
  g.translate(headX, headY);
  if (P.headTilt) g.rotate(P.headTilt);
  g.scale(hs, hs);
  g.drawImage(P.head.c, -P.head.ox, -P.head.oy, P.head.w, P.head.h);
  g.restore();
  if (!raised) arm(g, L, sx + 1.2, sy + 1.6, sx + P.handFX, sy + P.handFY, false);
}

/** Posição (local, antes da escala do chamador) de uma das mãos na pose — para ferramentas e cestos. */
export const HAND = { x: 0, y: 0 };
export function handPos(L: FigureLook, P: FigurePose, front: boolean) {
  const hy = -(L.thigh + L.shin) + 0.6 + P.hipDrop;
  const tl = L.torso * (1 + P.breath);
  const sx = P.hipX + Math.sin(P.lean) * tl;
  const sy = hy - Math.cos(P.lean) * tl;
  HAND.x = sx + (front ? P.handFX : P.handBX);
  HAND.y = sy + (front ? P.handFY : P.handBY);
  return HAND;
}
