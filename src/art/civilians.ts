/**
 * Civis (moradores): personagens cartoon no mesmo acabamento dos soldados — peças assadas uma vez
 * (cabeça, cabeça gritando, tronco, braços, pernas, mochila) e um rig animado por transformações
 * (inclinação, respiração, peso, pulinhos). Também assa os balões de fala (um canvas por frase).
 */
import { bake, drawSpr, shadedRR, OUT, rrPath, type Sprite } from './kit';
import { shade } from '../core/math';
import { SOLDIER_SCALE } from './soldiers';
import { SKINS, HAIR_COLORS, CLOTH, SHOES, lookKey, buildDims, type CivLook, type BuildDims } from '../game/civLook';
import { PHRASES, SHOUTS, type CivAct } from '../game/civilians';

export interface CivArt {
  head: Sprite;
  headOpen: Sprite;
  torso: Sprite;
  armF: Sprite;
  armB: Sprite;
  legF: Sprite;
  legB: Sprite;
  pack: Sprite | null;
  dims: BuildDims;
}

const S = 3; // escala de bake (nítido no zoom da exploração)
const cache = new Map<string, CivArt>();

/** Assa as peças de cada aparência que existe na fase (chamado no carregamento). */
export function bakeCivilians(looks: (CivLook | undefined)[]) {
  for (const l of looks) {
    if (!l) continue;
    const k = lookKey(l);
    if (!cache.has(k)) cache.set(k, bakeOne(l));
  }
  bakeSpeech();
}

/** Arte de uma aparência já assada (null se não existe: o desenho apenas pula). */
export function civArtFor(look: CivLook | undefined): CivArt | null {
  if (!look) return null;
  return cache.get(lookKey(look)) ?? null;
}

function bakeOne(l: CivLook): CivArt {
  const skin = SKINS[l.skin];
  const hairC = HAIR_COLORS[l.hairColor];
  const top = CLOTH[l.topColor];
  const top2 = CLOTH[l.topColor2];
  const bot = l.top === 'overalls' ? top : CLOTH[l.bottomColor];
  const shoe = SHOES[l.shoe];

  const mkHead = (open: boolean) =>
    bake(
      22,
      24,
      (g) => {
        const cx = 11;
        const cy = 12.5;
        // cabelo comprido / coque: atrás do rosto
        if (l.hair === 'long') {
          g.beginPath();
          g.moveTo(3.2, 10);
          g.quadraticCurveTo(2, 22, 6, 23.4);
          g.lineTo(13, 23.4);
          g.quadraticCurveTo(10.5, 16, 12, 8);
          g.closePath();
          g.fillStyle = shade(hairC, -0.12);
          g.fill();
          g.lineWidth = 1;
          g.strokeStyle = OUT;
          g.stroke();
        }
        if (l.hair === 'bun') {
          g.beginPath();
          g.arc(5, 4.4, 3.6, 0, Math.PI * 2);
          g.fillStyle = hairC;
          g.fill();
          g.lineWidth = 1;
          g.strokeStyle = OUT;
          g.stroke();
        }
        // rosto
        g.beginPath();
        g.ellipse(cx, cy, 7.6, 8.2, 0, 0, Math.PI * 2);
        g.fillStyle = skin;
        g.fill();
        // sombreado lateral (volume)
        g.save();
        g.clip();
        g.fillStyle = 'rgba(40,10,40,0.16)';
        g.fillRect(cx - 9, cy - 9, 5, 18);
        g.fillStyle = 'rgba(255,255,255,0.14)';
        g.fillRect(cx + 1, cy - 8, 6, 4);
        g.restore();
        g.beginPath();
        g.ellipse(cx, cy, 7.6, 8.2, 0, 0, Math.PI * 2);
        g.lineWidth = 1.2;
        g.strokeStyle = OUT;
        g.stroke();
        // orelha (vista 3/4: fica atrás do centro)
        g.beginPath();
        g.ellipse(7.2, 13, 1.7, 2.3, 0, 0, Math.PI * 2);
        g.fillStyle = shade(skin, -0.08);
        g.fill();
        g.lineWidth = 0.8;
        g.stroke();
        // olhos (olhando para a frente = +x)
        for (const [ex, r] of [[13.2, 1], [17.4, 0.82]] as [number, number][]) {
          g.beginPath();
          g.ellipse(ex, 11.6, 1.6 * r, 2 * r, 0, 0, Math.PI * 2);
          g.fillStyle = '#ffffff';
          g.fill();
          g.lineWidth = 0.6;
          g.strokeStyle = OUT;
          g.stroke();
          g.beginPath();
          g.arc(ex + 0.6 * r, 11.9, 1 * r, 0, Math.PI * 2);
          g.fillStyle = '#1c1424';
          g.fill();
          g.fillStyle = '#ffffff';
          g.fillRect(ex + 0.7 * r, 11.1, 0.6, 0.6);
        }
        // sobrancelhas
        g.strokeStyle = shade(hairC === HAIR_COLORS[7] ? '#8a8496' : hairC, -0.2);
        g.lineWidth = 0.9;
        g.beginPath();
        g.moveTo(11.6, 8.6);
        g.lineTo(14.6, 8.2);
        g.moveTo(16.4, 8.3);
        g.lineTo(18.6, 8.7);
        g.stroke();
        // nariz
        g.beginPath();
        g.moveTo(18.2, 12.4);
        g.quadraticCurveTo(20.2, 14.4, 18.2, 15);
        g.lineWidth = 0.8;
        g.strokeStyle = shade(skin, -0.35);
        g.stroke();
        // bochecha
        g.fillStyle = 'rgba(255,90,120,0.22)';
        g.beginPath();
        g.ellipse(13.4, 15.4, 1.8, 1.1, 0, 0, Math.PI * 2);
        g.fill();
        // boca
        if (open) {
          g.beginPath();
          g.ellipse(16, 17.4, 1.9, 2.1, 0, 0, Math.PI * 2);
          g.fillStyle = '#3a0f1e';
          g.fill();
          g.lineWidth = 0.7;
          g.strokeStyle = OUT;
          g.stroke();
          g.fillStyle = '#ff6a7a';
          g.beginPath();
          g.ellipse(16, 18.6, 1.2, 0.7, 0, 0, Math.PI * 2);
          g.fill();
        } else {
          g.beginPath();
          g.moveTo(14.4, 16.8);
          g.quadraticCurveTo(16.2, 18.2, 17.8, 16.8);
          g.lineWidth = 0.8;
          g.strokeStyle = OUT;
          g.stroke();
        }
        if (l.build === 'elder') {
          // rugas e bigode grisalho
          g.strokeStyle = shade(skin, -0.3);
          g.lineWidth = 0.5;
          g.beginPath();
          g.moveTo(11, 14.6);
          g.lineTo(12.4, 15.6);
          g.moveTo(17.4, 6.8);
          g.lineTo(13, 6.6);
          g.stroke();
          if (!open) {
            g.fillStyle = HAIR_COLORS[7];
            rrPath(g, 14, 15.2, 5, 1.6, 0.8);
            g.fill();
          }
        }
        // cabelo por cima
        drawHair(g, l, hairC, top2);
        // acessórios de cabeça
        if (l.acc === 'glasses') {
          g.strokeStyle = '#1c1424';
          g.lineWidth = 0.9;
          rrPath(g, 11.4, 9.8, 3.8, 3.4, 1.2);
          g.stroke();
          rrPath(g, 16, 9.9, 3.2, 3.2, 1.1);
          g.stroke();
          g.beginPath();
          g.moveTo(15.2, 11.2);
          g.lineTo(16, 11.2);
          g.moveTo(11.4, 11);
          g.lineTo(7.6, 11.6);
          g.stroke();
          g.fillStyle = 'rgba(160,240,255,0.25)';
          g.fillRect(11.8, 10.2, 3, 1.2);
        }
        if (l.acc === 'headphones') {
          g.strokeStyle = '#2a2440';
          g.lineWidth = 1.6;
          g.beginPath();
          g.arc(cx - 0.6, cy + 0.6, 8.4, Math.PI * 1.05, Math.PI * 1.75);
          g.stroke();
          shadedRR(g, 4.6, 10.2, 4.6, 6, 2, top2, { lw: 0.8 });
        }
      },
      { scale: S, ox: 11, oy: 21.5 }
    );

  // tronco: corpo do quadril (y=20) aos ombros (y=3); saia/vestido descem até y=30
  const torso = bake(
    18,
    31,
    (g) => {
      const x0 = 2;
      const w = 14;
      if (l.top === 'dress') {
        // saia do vestido (evasê)
        g.beginPath();
        g.moveTo(3.6, 15);
        g.lineTo(14.4, 15);
        g.lineTo(17.2, 29.4);
        g.lineTo(0.8, 29.4);
        g.closePath();
        g.fillStyle = top;
        g.fill();
        g.lineWidth = 1.1;
        g.strokeStyle = OUT;
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(7, 16, 1.4, 12);
        g.fillStyle = top2;
        g.fillRect(1.6, 26.6, 14.8, 1.6);
      } else if (l.bottom === 'skirt') {
        g.beginPath();
        g.moveTo(3, 17);
        g.lineTo(15, 17);
        g.lineTo(16.6, 27);
        g.lineTo(1.4, 27);
        g.closePath();
        g.fillStyle = bot;
        g.fill();
        g.lineWidth = 1.1;
        g.strokeStyle = OUT;
        g.stroke();
      }
      if (l.top === 'tank' || l.top === 'dress') {
        // ombros de fora
        shadedRR(g, x0, 3, w, 14, 4.2, skin, { lw: 1.1 });
        shadedRR(g, x0 + 1.6, 6, w - 3.2, 13, 2.6, top);
        g.fillStyle = top;
        g.fillRect(x0 + 2.4, 3.4, 2, 4);
        g.fillRect(x0 + w - 4.4, 3.4, 2, 4);
      } else if (l.top === 'overalls') {
        shadedRR(g, x0, 3, w, 17.5, 4.2, top2);
        shadedRR(g, x0 + 2.4, 8.4, w - 4.8, 11.6, 2, top, { lw: 0.9 });
        g.fillStyle = top;
        g.fillRect(x0 + 2.6, 3.4, 1.8, 6);
        g.fillRect(x0 + w - 4.4, 3.4, 1.8, 6);
        g.fillStyle = '#ffd23a';
        g.fillRect(x0 + 3, 8.6, 1.4, 1.4);
        g.fillRect(x0 + w - 4.2, 8.6, 1.4, 1.4);
      } else if (l.top === 'jacket') {
        shadedRR(g, x0, 3, w, 17.5, 4.2, top);
        // camiseta por dentro (jaqueta aberta)
        g.fillStyle = top2;
        g.fillRect(x0 + w / 2 - 1.6, 4, 4.4, 15);
        g.strokeStyle = OUT;
        g.lineWidth = 0.8;
        g.strokeRect(x0 + w / 2 - 1.6, 4, 4.4, 15);
        // gola
        g.fillStyle = shade(top, -0.2);
        g.beginPath();
        g.moveTo(x0 + 3, 3.2);
        g.lineTo(x0 + w / 2 - 1.4, 8);
        g.lineTo(x0 + w / 2 - 1.6, 3.4);
        g.closePath();
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.fillRect(x0 + w / 2 + 3.4, 10, 0.8, 0.8);
        g.fillRect(x0 + w / 2 + 3.4, 13, 0.8, 0.8);
      } else {
        // camiseta com estampa
        shadedRR(g, x0, 3, w, 17.5, 4.2, top);
        g.beginPath();
        g.arc(x0 + w / 2 + 1, 10.4, 2.8, 0, Math.PI * 2);
        g.fillStyle = top2;
        g.fill();
        g.lineWidth = 0.6;
        g.strokeStyle = OUT;
        g.stroke();
        // gola
        g.fillStyle = skin;
        g.beginPath();
        g.ellipse(x0 + w / 2 + 1.4, 3.4, 2.6, 1.4, 0, 0, Math.PI);
        g.fill();
      }
      // cós (calça/bermuda)
      if (l.top !== 'dress' && l.top !== 'overalls' && l.bottom !== 'skirt') {
        shadedRR(g, x0 + 0.4, 17.2, w - 0.8, 3.6, 1.2, bot, { lw: 0.9 });
      }
      if (l.acc === 'bag') {
        // bolsa a tiracolo
        g.strokeStyle = '#2a1a14';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(x0 + 3, 3.6);
        g.lineTo(x0 + w - 1, 17.4);
        g.stroke();
        shadedRR(g, x0 + w - 4.6, 15.2, 6.8, 6, 1.6, CLOTH[(l.topColor2 + 6) % CLOTH.length], { lw: 0.9 });
      }
    },
    { scale: S, ox: 9, oy: 20 }
  );

  const mkArm = (front: boolean) =>
    bake(
      7,
      17,
      (g) => {
        const sleeveC = l.top === 'overalls' ? top2 : top;
        const k = front ? 0 : -0.22;
        const sleeve = l.top === 'jacket' ? 11 : l.top === 'tank' || l.top === 'dress' ? 0 : 5.4;
        // braço (pele)
        shadedRR(g, 1.4, 0.6, 4.2, 13.4, 2, shade(skin, k), { lw: 1 });
        if (sleeve > 0) shadedRR(g, 0.8, 0.2, 5.4, sleeve, 2.2, shade(sleeveC, k), { lw: 1 });
        // mão
        g.beginPath();
        g.arc(3.5, 14.2, 2.3, 0, Math.PI * 2);
        g.fillStyle = shade(skin, k);
        g.fill();
        g.lineWidth = 0.9;
        g.strokeStyle = OUT;
        g.stroke();
        if (front && l.acc === 'phone') {
          // celular na mão (tela acesa)
          shadedRR(g, 3.2, 12.4, 3.4, 4.6, 0.8, '#1c1424', { lw: 0.6, shine: false });
          g.fillStyle = '#7ff9ff';
          g.fillRect(3.8, 13, 2.2, 3.2);
        }
      },
      { scale: S, ox: 3.5, oy: 2 }
    );

  const mkLeg = (front: boolean) =>
    bake(
      9,
      16,
      (g) => {
        const k = front ? 0 : -0.2;
        const bare = l.top === 'dress' || l.bottom === 'skirt';
        if (bare) shadedRR(g, 2.4, 0, 4.2, 13, 2, shade(skin, k), { lw: 1 });
        else if (l.bottom === 'shorts') {
          shadedRR(g, 2.4, 3, 4.2, 10.4, 2, shade(skin, k), { lw: 1 });
          shadedRR(g, 1.4, 0, 6.2, 6.4, 2, shade(bot, k), { lw: 1 });
        } else shadedRR(g, 1.6, 0, 5.8, 13.2, 2.2, shade(bot, k), { lw: 1 });
        // tênis
        shadedRR(g, 0.6, 11.6, 8.2, 4.2, 1.8, shade(shoe, k), { lw: 1 });
        g.fillStyle = front ? '#ffffff' : '#cfc8e0';
        g.fillRect(1, 14.4, 7.4, 0.9);
      },
      { scale: S, ox: 4.5, oy: 1 }
    );

  let pack: Sprite | null = null;
  if (l.acc === 'backpack') {
    const pc = CLOTH[(l.topColor2 + 4) % CLOTH.length];
    pack = bake(
      9,
      13,
      (g) => {
        shadedRR(g, 0.6, 0.6, 7.8, 11.6, 2.6, pc);
        shadedRR(g, 1.4, 6.4, 6.2, 4.6, 1.4, shade(pc, -0.2), { lw: 0.8 });
        g.fillStyle = '#ffd23a';
        g.fillRect(3.6, 7.8, 1.8, 0.9);
      },
      { scale: S, ox: 8, oy: 1 }
    );
  }

  return { head: mkHead(false), headOpen: mkHead(true), torso, armF: mkArm(true), armB: mkArm(false), legF: mkLeg(true), legB: mkLeg(false), pack, dims: buildDims(l.build) };
}

function drawHair(g: CanvasRenderingContext2D, l: CivLook, c: string, accent: string) {
  const cx = 11;
  const cy = 12.5;
  g.lineWidth = 1;
  g.strokeStyle = OUT;
  const cap = (fill: string) => {
    // calota de cabelo sobre a testa, com franja para a frente
    g.beginPath();
    g.moveTo(cx - 7.8, cy + 1);
    g.quadraticCurveTo(cx - 8.4, cy - 9.6, cx + 1, cy - 9.2);
    g.quadraticCurveTo(cx + 8.6, cy - 8.4, cx + 7.8, cy - 3.2);
    g.quadraticCurveTo(cx + 3, cy - 5.6, cx - 1.6, cy - 4.2);
    g.quadraticCurveTo(cx - 3.6, cy - 1, cx - 4.6, cy + 2.2);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath();
    g.ellipse(cx - 1.4, cy - 7.4, 3.4, 1.2, -0.2, 0, Math.PI * 2);
    g.fill();
  };
  switch (l.hair) {
    case 'short':
    case 'long':
    case 'bun':
      cap(c);
      break;
    case 'curly': {
      g.fillStyle = c;
      const pts: [number, number, number][] = [[4.4, 9, 3], [6, 5.4, 3.2], [9.6, 3.6, 3.3], [13.4, 3.8, 3.1], [16.6, 5.8, 2.8], [4, 12.6, 2.6]];
      for (const [x, y, r] of pts) {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      g.beginPath();
      for (const [x, y, r] of pts) {
        g.moveTo(x + r * 0.7, y);
        g.arc(x, y, r * 0.7, 0, Math.PI * 2);
      }
      g.fill();
      break;
    }
    case 'bald':
      g.fillStyle = 'rgba(255,255,255,0.32)';
      g.beginPath();
      g.ellipse(cx - 1, cy - 6, 3.6, 1.6, -0.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = c;
      rrPath(g, 3.4, 9.4, 2.4, 4.6, 1.2);
      g.fill();
      break;
    case 'cap':
      cap(c);
      // boné com aba para a frente
      g.beginPath();
      g.moveTo(cx - 7.6, cy - 3);
      g.quadraticCurveTo(cx - 7.4, cy - 10.4, cx + 1, cy - 10);
      g.quadraticCurveTo(cx + 7.6, cy - 9.4, cx + 7.4, cy - 4.4);
      g.closePath();
      g.fillStyle = accent;
      g.fill();
      g.stroke();
      shadedRR(g, cx + 3, cy - 5.6, 8.4, 2.2, 1, shade(accent, -0.25), { lw: 0.9, shine: false });
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fillRect(cx - 1, cy - 8.6, 2, 2);
      break;
    case 'hat':
      cap(c);
      // chapéu de aba larga
      shadedRR(g, cx - 10, cy - 6.8, 21.2, 2.6, 1.3, accent, { lw: 0.9 });
      shadedRR(g, cx - 5.6, cy - 12.4, 11.6, 6.6, 2.6, accent, { lw: 1 });
      g.fillStyle = shade(accent, -0.35);
      g.fillRect(cx - 5.2, cy - 7.8, 10.8, 1.4);
      break;
  }
}

// ------------------------------------------------------------------ rig animado
export interface CivPoseSrc {
  facing: -1 | 1;
  act: CivAct;
  t: number;
  hop: number;
  crouch: number;
  runPhase: number;
  phase: number;
}

/** Desenha o civil com pés em (x, y). Nada é alocado aqui (só transformações). */
export function drawCivilian(g: CanvasRenderingContext2D, a: CivArt, x: number, y: number, c: CivPoseSrc, talking: boolean) {
  const d = a.dims;
  const t = c.t;
  const act = c.act;
  const cr = c.crouch;
  const run = act === 'run';
  const air = c.hop > 0.5;
  const tremble = act === 'cower' ? Math.sin(t * 47) * 0.45 : 0;
  g.save();
  g.translate(x + tremble, y - c.hop);
  if (c.facing === -1) g.scale(-1, 1);
  const sc = SOLDIER_SCALE * d.k;
  g.scale(sc, sc);
  // peso: inclina para a frente ao correr, para trás comemorando; idoso levemente curvado
  const lean = d.lean + (run ? 0.16 : act === 'cheer' ? -0.05 : act === 'cower' ? 0.1 * cr : 0);
  if (lean) g.rotate(lean);
  const sy = d.sy;
  const bob = run ? -Math.abs(Math.sin(c.runPhase)) * 1.8 : 0;
  const breath = act === 'idle' || act === 'help' ? Math.sin(t * 2.4 + c.phase * 6) * 0.025 : 0;
  // pernas
  let legF = 0;
  let legB = 0;
  let legSy = sy;
  if (run) {
    legF = Math.sin(c.runPhase) * 0.95;
    legB = -legF;
  } else if (air) {
    legF = 0.55;
    legB = -0.35;
  }
  if (cr > 0.02) {
    legF = legF * (1 - cr) + 1.25 * cr;
    legB = legB * (1 - cr) - 0.95 * cr;
    legSy = sy * (1 - 0.4 * cr);
  }
  const drop = 8 * cr * sy;
  const hipY = -13.5 * sy + drop + bob * 0.5;
  // braços: ângulo 0 = pendurado; negativo = para a frente/cima, positivo = para trás/cima (±π = para cima)
  let aF = 0.06 + Math.sin(t * 2.2 + c.phase * 5) * 0.04;
  let aB = -0.08;
  const w = t * 9 + c.phase * 6;
  switch (act) {
    case 'cheer': {
      // punho no ar (comemorando): braços em "V", o da frente bombeando
      const pump = Math.sin(t * 11 + c.phase * 4);
      aF = -2.05 + pump * 0.35;
      aB = air ? 2.75 : 2.45 + pump * 0.25;
      break;
    }
    case 'help':
      // acena com os dois braços abertos
      aF = -2.0 + Math.sin(w) * 0.4;
      aB = 2.55 - Math.sin(w) * 0.4;
      break;
    case 'run':
      // pânico: braços balançando no alto
      aF = -1.9 + Math.sin(c.runPhase) * 0.5;
      aB = 2.3 - Math.sin(c.runPhase) * 0.5;
      break;
    case 'cower':
      // agachado abraçando os joelhos (o rosto fica à mostra, olhando para os lados)
      aF = -0.75 + Math.sin(t * 30) * 0.05;
      aB = -0.45;
      break;
  }
  const shY = hipY - 15.6 * sy + bob * 0.5;
  drawSpr(g, a.armB, -2.6, shY, { rot: aB });
  drawSpr(g, a.legB, -1.8, hipY, { rot: legB, sy: legSy });
  drawSpr(g, a.legF, 1.8, hipY, { rot: legF, sy: legSy });
  if (a.pack) drawSpr(g, a.pack, -4.6 * d.sx, shY - 0.6, {});
  drawSpr(g, a.torso, 0, hipY, { sx: d.sx * (1 - breath * 0.4), sy: sy * (1 + breath), rot: run ? 0.06 : 0 });
  // cabeça: segue o corpo com um leve atraso; grita comemorando/correndo, fala no balão
  const open = talking ? Math.sin(t * 22) > -0.2 : act === 'cheer' ? air || Math.sin(t * 6) > 0 : act === 'run';
  const tilt = act === 'cheer' ? -0.14 : act === 'help' ? -0.08 + Math.sin(w) * 0.04 : act === 'cower' ? 0.06 : run ? 0.08 : Math.sin(t * 0.9 + c.phase * 9) * 0.04;
  const hs = 0.88 * d.head;
  drawSpr(g, open ? a.headOpen : a.head, 0.8, hipY - 17.4 * sy * (1 + breath) + bob * 0.3, { rot: tilt, sx: hs, sy: hs });
  drawSpr(g, a.armF, 1.8, shY, { rot: aF });
  g.restore();
}

// ------------------------------------------------------------------ balões de fala
const DISPLAY = '"Lilita One", "Arial Black", Impact, sans-serif';
let speech: Sprite[] | null = null;

/** Balão pré-desenhado da frase i (null antes do carregamento). */
export function speechSprite(i: number): Sprite | null {
  return speech ? speech[i] ?? null : null;
}

function bakeSpeech() {
  if (speech) return;
  speech = PHRASES.map((txt, i) => bakeBalloon(txt, SHOUTS.includes(i)));
}

function bakeBalloon(text: string, shout: boolean): Sprite {
  // mede e quebra as linhas num canvas descartável (só no carregamento)
  const font = `400 ${shout ? 9.5 : 9}px ${DISPLAY}`;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = font;
  const maxW = 118;
  const lines: string[] = [];
  let cur = '';
  for (const wd of text.split(' ')) {
    const test = cur ? cur + ' ' + wd : wd;
    if (probe.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = wd;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  let tw = 0;
  for (const ln of lines) tw = Math.max(tw, probe.measureText(ln).width);
  const lh = 10.5;
  const bw = Math.ceil(tw + (shout ? 22 : 16));
  const bh = Math.ceil(lines.length * lh + (shout ? 14 : 9));
  const pad = shout ? 5 : 3;
  const W = bw + pad * 2;
  const H = bh + pad * 2 + 9;
  return bake(
    W,
    H,
    (g) => {
      const x0 = pad;
      const y0 = pad;
      const cx = x0 + bw / 2;
      const cy = y0 + bh / 2;
      g.fillStyle = '#ffffff';
      g.strokeStyle = OUT;
      g.lineWidth = 1.6;
      // rabicho apontando para o falante (embaixo, à esquerda)
      const tipX = W * 0.32;
      g.beginPath();
      g.moveTo(cx - 12, y0 + bh - 3);
      g.lineTo(tipX, H - 1);
      g.lineTo(cx - 2, y0 + bh - 3);
      g.closePath();
      g.fill();
      g.stroke();
      g.beginPath();
      if (shout) {
        const n = 20;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2;
          const rr = i % 2 ? 1 : 1.14;
          const px = cx + Math.cos(ang) * (bw / 2) * rr;
          const py = cy + Math.sin(ang) * (bh / 2) * rr;
          if (i) g.lineTo(px, py);
          else g.moveTo(px, py);
        }
        g.closePath();
      } else rrPath(g, x0, y0, bw, bh, Math.min(9, bh / 2));
      g.fill();
      g.stroke();
      // refaz o rabicho por cima da borda (sem a linha do balão cortando)
      g.beginPath();
      g.moveTo(cx - 10.6, y0 + bh - 4);
      g.lineTo(tipX + 0.6, H - 3);
      g.lineTo(cx - 3.2, y0 + bh - 4);
      g.closePath();
      g.fill();
      g.fillStyle = shout ? '#b0182f' : OUT;
      g.font = font;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (let i = 0; i < lines.length; i++) g.fillText(lines[i], cx, cy - ((lines.length - 1) * lh) / 2 + i * lh + 0.5);
    },
    { scale: 4, ox: Math.round(W * 0.32), oy: H }
  );
}
