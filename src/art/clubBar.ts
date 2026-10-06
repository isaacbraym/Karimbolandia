/**
 * O bar do fundo da balada: prateleira de garrafas com neon, balcão e o BARMAN trabalhando num ciclo de 9 s —
 * sacode a coqueteleira no ritmo, serve o drinque (o líquido sobe no copo), enfeita com uma fatia e desliza
 * o copo balcão afora, seca um copo conversando e faz um malabarismo com a garrafa (joga, gira e pega) para
 * servir uma dose. Tudo assado uma vez (prateleira e balcão); por quadro só o corpo do barman (as mesmas
 * formas dos seguranças) e as peças que ele segura. Nenhuma alocação, gradiente ou canvas por quadro.
 */
import { bake, drawSpr, OUT, type Sprite } from './kit';
import { bakeFace, drawFigure, figureLook, handPos, newPose, type FigureLook, type FigurePose } from './figure';
import { SOLDIER_SCALE } from './soldiers';

export const BAR_CYCLE = 9;
/** escala do barman (está no fundo da pista: menor que os seguranças da porta) */
const S = SOLDIER_SCALE * 0.72;
/** altura do tampo do balcão em unidades locais do barman (a cintura dele fica atrás do balcão) */
const CT = -14.5;

interface BarArt {
  shelf: Sprite;
  counter: Sprite;
  look: FigureLook;
  pose: FigurePose;
  faceJoy: Sprite;
  faceTalk: Sprite;
}
let art: BarArt | null = null;

const BOTTLES = ['#39f0ff', '#ff4fd0', '#ffb52e', '#7be07a', '#b48cff', '#ff6a4a', '#39f0ff', '#ffd23a'];
const DRINKS = ['#ff5a8a', '#ffb52e', '#58e3ff', '#a7ff6a'];

function bottle(g: CanvasRenderingContext2D, x: number, y: number, color: string, h = 15) {
  g.fillStyle = OUT; g.fillRect(x - 3.4, y - h - 0.8, 6.8, h + 1.6);
  g.fillRect(x - 1.6, y - h - 5.2, 3.2, 5);
  g.fillStyle = color; g.fillRect(x - 2.6, y - h, 5.2, h);
  g.fillRect(x - 0.9, y - h - 4.4, 1.8, 4);
  g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x - 1.7, y - h + 2, 1, h - 5);
  g.fillStyle = 'rgba(20,10,40,.45)'; g.fillRect(x - 2.6, y - h * 0.55, 5.2, 4);
}

export function bakeBarArt(): BarArt {
  if (art) return art;
  // móvel do fundo do bar: letreiro, painel com prateleiras de garrafas e um armário embaixo (o barman fica na frente dele)
  const shelf = bake(210, 150, (g) => {
    // armário de baixo, em pé no chão (altura 98..146)
    g.fillStyle = OUT; g.fillRect(2, 98, 206, 50);
    g.fillStyle = '#3a2a4c'; g.fillRect(4, 100, 202, 46);
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(4, 100, 202, 3);
    g.fillStyle = 'rgba(0,0,0,.3)'; for (let x = 36; x < 204; x += 34) g.fillRect(x, 103, 2, 43);
    g.fillStyle = '#d9b44a'; for (let x = 20; x < 204; x += 34) g.fillRect(x, 120, 6, 2.4);
    // painel de espelho escuro com luz de fundo
    g.fillStyle = OUT; g.fillRect(2, 18, 206, 80);
    g.fillStyle = '#1a1230'; g.fillRect(4, 20, 202, 76);
    g.fillStyle = 'rgba(255,79,208,.22)'; g.fillRect(4, 20, 202, 76);
    g.fillStyle = 'rgba(57,240,255,.16)'; g.fillRect(4, 56, 202, 40);
    // três prateleiras de garrafas
    for (const [i, y] of [[0, 46], [1, 70], [2, 94]] as [number, number][]) {
      g.fillStyle = '#5b4470'; g.fillRect(6, y, 198, 3.4);
      g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(6, y, 198, 1);
      for (let b = 0; b < 12; b++) bottle(g, 16 + b * 16.2, y, BOTTLES[(b + i * 3) % BOTTLES.length], 12 + ((b * 5 + i * 7) % 6));
    }
    // letreiro neon "BAR"
    g.font = 'bold 15px sans-serif'; g.textAlign = 'center';
    g.shadowColor = '#ff4fd0'; g.shadowBlur = 8;
    g.strokeStyle = OUT; g.lineWidth = 3; g.strokeText('BAR', 105, 14);
    g.fillStyle = '#ffd1f2'; g.fillText('BAR', 105, 14);
    g.shadowBlur = 0;
  }, { scale: 2, ox: 105, oy: 146 });
  const counter = bake(250, 60, (g) => {
    // tampo (faixa clara em perspectiva) e frente do balcão com ripas e neon
    g.fillStyle = OUT; g.fillRect(2, 2, 246, 56);
    g.fillStyle = '#7b5a83'; g.fillRect(4, 4, 242, 12);
    g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(4, 4, 242, 3);
    g.fillStyle = '#2b2040'; g.fillRect(4, 16, 242, 40);
    g.fillStyle = 'rgba(0,0,0,.28)';
    for (let x = 14; x < 246; x += 20) g.fillRect(x, 16, 2, 40);
    g.fillStyle = '#39f0ff'; g.shadowColor = '#39f0ff'; g.shadowBlur = 6; g.fillRect(4, 52, 242, 3); g.shadowBlur = 0;
    g.fillStyle = '#ff4fd0'; g.fillRect(4, 17, 242, 1.6);
  }, { scale: 2, ox: 125, oy: 4 });
  const face = (expr: 'joy' | 'talk') => bakeFace({ skin: '#8a5a3a', hair: '#1a1220', hairStyle: 'short', accent: '#111', iris: '#2a1a12', beard: 'mustache' }, expr);
  const look = figureLook({
    skin: '#8a5a3a', top: '#f1ede4', top2: '#c4202e', sleeve: 0.5, bottom: '#1d1b2a', bottomKind: 'pants', shoe: '#0c0c10',
    limb: 4.2, thigh: 9.4, shin: 8.8, torso: 12.8, shoulder: 15, hip: 11.5, arm: 6.7, fore: 6.5, headScale: 1.1, belly: 0.6, apron: '#2a2233',
  });
  const faceJoy = face('joy'), faceTalk = face('talk');
  art = { shelf, counter, look, pose: newPose(faceJoy), faceJoy, faceTalk };
  return art;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

/** posição de cada peça (unidades locais do barman) calculada junto com a pose */
interface Props {
  shaker: { x: number; y: number; rot: number } | null;
  /** copo do drinque: posição, nível do líquido (0..1), cor e opacidade */
  glass: { x: number; fill: number; color: string; a: number; slice: boolean } | null;
  stream: { x0: number; y0: number; x1: number; y1: number; color: string } | null;
  cloth: { x: number; y: number } | null;
  /** copo na mão (secando) */
  held: { x: number; y: number } | null;
  bottle: { x: number; y: number; rot: number } | null;
  /** dose servida no copinho do balcão */
  shot: { x: number; fill: number } | null;
}
const props: Props = { shaker: null, glass: null, stream: null, cloth: null, held: null, bottle: null, shot: null };
/** onde o copo do drinque fica no balcão (ao alcance da mão: o braço mede ~13) */
const GX = 12;
/** largura (s) da mistura entre duas etapas: a pose atravessa a troca sem salto */
const BLEND = 0.22;
const BOUNDS = [2.2, 3.8, 5.2, 7.0] as const;

/** Pose "crua" da etapa em que `t` está (só o corpo; sem peças). Os braços são limitados ao alcance. */
function segPose(L: FigureLook, P: FigurePose, t: number, beat: number) {
  const reach = L.arm + L.fore;
  P.lean = 0.05; P.hipX = 0; P.hipDrop = (1 - beat) * 0.5; P.breath = 0;
  P.footFX = 3; P.footFY = 0; P.footBX = -3; P.footBY = 0; P.headTilt = 0;
  if (t < 2.2) {
    // 1. sacode a coqueteleira por cima do ombro, no ritmo
    const s = Math.sin(t * 15), k = ramp(t, 0, 0.3);
    P.lean = 0.07 + 0.03 * s * k; P.hipX = s * 0.5 * k; P.headTilt = s * 0.05 * k;
    P.handFX = 7.5 + 0.9 * s * k; P.handFY = -2.4 + 2.6 * s * k;
    P.handBX = 5.6 + 0.9 * s * k; P.handBY = -1 + 2.6 * s * k;
  } else if (t < 3.8) {
    // 2. serve: inclina a coqueteleira sobre o copo
    const tilt = ease(ramp(t, 2.2, 2.7)) * (1 - ease(ramp(t, 3.3, 3.8)));
    P.lean = 0.05 + 0.1 * tilt;
    P.handFX = 7.5 + 3.5 * tilt; P.handFY = -2.4 - 1 * tilt; P.handBX = 7; P.handBY = -2.4;
  } else if (t < 5.2) {
    // 3. enfeita com uma fatia e empurra o copo balcão afora
    const reachK = ease(ramp(t, 3.8, 4.15)) * (1 - ease(ramp(t, 4.45, 4.7)));
    const push = ease(ramp(t, 4.7, 4.95)) * (1 - ease(ramp(t, 4.95, 5.2)));
    P.lean = 0.05 + 0.08 * reachK + 0.04 * push;
    P.handFX = 7.5 + 2.5 * reachK + 2.5 * push; P.handFY = -2.4 + 6.4 * reachK + 3 * push; P.handBX = 6; P.handBY = 0.5 + 1.5 * push;
  } else if (t < 7.0) {
    // 4. seca um copo, conversando com a pista
    const k = ramp(t, 5.2, 5.6) * (1 - ramp(t, 6.7, 7.0));
    P.headTilt = Math.sin(t * 3) * 0.07 * k;
    P.handBX = 7.2; P.handBY = -2.2;
    P.handFX = 7.4 + 1.8 * Math.cos((t - 5.2) * 7) * k; P.handFY = -2 + 1.1 * Math.sin((t - 5.2) * 7) * k;
  } else {
    // 5. malabarismo: pega a garrafa lá atrás, joga, gira, pega e serve uma dose
    const up = ease(ramp(t, 7.0, 7.45)) * (1 - ease(ramp(t, 7.45, 7.75)));
    const air = ramp(t, 7.75, 8.5);
    P.lean = 0.05 - 0.09 * up;
    P.handFX = 7.5 - 12 * up + 3.5 * ease(ramp(t, 7.75, 8.5)); P.handFY = -2.4 - 7.8 * up - 4.5 * Math.sin(air * Math.PI);
    P.handBX = 7; P.handBY = -1.6;
    P.headTilt = t >= 7.75 && t < 8.5 ? -0.08 : 0.03;
  }
  // nenhuma mão passa do alcance do braço (a figura corta por IK e a peça ficaria solta da mão)
  const lim = reach * 0.97;
  for (const front of [true, false]) {
    const x = front ? P.handFX : P.handBX, y = front ? P.handFY : P.handBY, d = Math.hypot(x, y);
    if (d > lim) { if (front) { P.handFX = x * lim / d; P.handFY = y * lim / d; } else { P.handBX = x * lim / d; P.handBY = y * lim / d; } }
  }
}

const Pa = newPose({} as Sprite), Pb = newPose({} as Sprite);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** Pose do barman em `time` (s): preenche `P` e devolve as peças que ele usa naquele instante. */
export function barmanPose(L: FigureLook, P: FigurePose, face: { joy: Sprite; talk: Sprite }, time: number, beat: number): Props {
  const cyc = Math.floor(time / BAR_CYCLE), t = time - cyc * BAR_CYCLE;
  const drink = DRINKS[cyc % DRINKS.length];
  props.shaker = props.glass = props.stream = props.cloth = props.held = props.bottle = props.shot = null;
  // corpo: perto de uma troca de etapa mistura o fim da anterior com o começo da seguinte (sem salto); o fim do ciclo volta ao começo
  const tt = t < BLEND ? t + BAR_CYCLE : t; // o fim do ciclo se mistura com o começo do seguinte
  let blendAt = -1;
  for (const b of BOUNDS) if (Math.abs(tt - b) < BLEND) blendAt = b;
  if (Math.abs(tt - BAR_CYCLE) < BLEND) blendAt = BAR_CYCLE;
  if (blendAt >= 0) {
    segPose(L, Pa, blendAt - BLEND - 1e-3, beat);
    segPose(L, Pb, (blendAt + BLEND) % BAR_CYCLE + 1e-3, beat);
    const kk = ease(clamp01((tt - (blendAt - BLEND)) / (2 * BLEND)));
    P.lean = mix(Pa.lean, Pb.lean, kk); P.hipX = mix(Pa.hipX, Pb.hipX, kk); P.hipDrop = Pa.hipDrop; P.breath = 0;
    P.footFX = 3; P.footFY = 0; P.footBX = -3; P.footBY = 0; P.headTilt = mix(Pa.headTilt, Pb.headTilt, kk);
    P.handFX = mix(Pa.handFX, Pb.handFX, kk); P.handFY = mix(Pa.handFY, Pb.handFY, kk);
    P.handBX = mix(Pa.handBX, Pb.handBX, kk); P.handBY = mix(Pa.handBY, Pb.handBY, kk);
  } else segPose(L, P, t, beat);
  P.breath = Math.sin(time * 1.7) * 0.02;
  P.head = t >= 5.2 && t < 7.0 && beat < 0.5 ? face.talk : face.joy;
  const hf = handPos(L, P, true), fx = hf.x, fy = hf.y;
  const hb = handPos(L, P, false), bx = hb.x, by = hb.y;
  if (t < 2.2) {
    // sacode: a coqueteleira entre as duas mãos
    const s = Math.sin(t * 15), k = ramp(t, 0, 0.3);
    props.shaker = { x: (fx + bx) / 2 + 1.2, y: (fy + by) / 2 - 2.2, rot: 0.35 + 0.3 * s * k };
    props.glass = { x: GX, fill: 0, color: drink, a: 1, slice: false };
  } else if (t < 3.8) {
    const tilt = ease(ramp(t, 2.2, 2.7)) * (1 - ease(ramp(t, 3.3, 3.8)));
    const pour = ramp(t, 2.6, 3.45);
    const rot = 0.2 + 1.75 * tilt;
    const sx = fx + Math.sin(rot) * 6 + 0.5, sy = fy - Math.cos(rot) * 6;
    props.shaker = { x: fx + 0.8, y: fy - 1, rot };
    const fill = Math.min(0.85, pour * 0.9);
    props.glass = { x: GX, fill, color: drink, a: 1, slice: false };
    if (tilt > 0.6 && pour > 0 && pour < 1) props.stream = { x0: sx, y0: sy, x1: GX, y1: CT - 8 + (1 - fill) * 5, color: drink };
  } else if (t < 5.2) {
    const slide = ease(ramp(t, 4.7, 5.2));
    props.glass = { x: GX + 20 * slide, fill: 0.85, color: drink, a: 1 - ease(ramp(t, 5.0, 5.2)) * 0.9, slice: t > 4.4 };
  } else if (t < 7.0) {
    props.held = { x: bx + 1.2, y: by - 2.6 };
    props.cloth = { x: fx, y: fy };
  } else {
    const air = ramp(t, 7.75, 8.5), flying = t >= 7.75 && t < 8.5;
    const dose = ramp(t, 8.55, 8.95);
    if (flying) props.bottle = { x: fx + 1.5 + 3 * air, y: fy - 3 - Math.sin(air * Math.PI) * 17, rot: air * Math.PI * 4 };
    else if (t < 8.9) props.bottle = { x: fx + 1.5, y: fy - 3, rot: t >= 8.5 ? 1.4 : 0 };
    props.shot = { x: GX, fill: ease(dose) * 0.8 };
    if (t >= 8.5 && dose > 0 && dose < 1) props.stream = { x0: fx + 6, y0: fy + 1, x1: GX + 9, y1: CT - 5, color: '#ffd23a' };
  }
  return props;
}

function drawGlass(g: CanvasRenderingContext2D, x: number, base: number, fill: number, color: string, a: number, slice: boolean, h = 8) {
  g.save(); g.globalAlpha = a;
  g.fillStyle = 'rgba(190,230,255,.35)'; g.beginPath(); g.moveTo(x - 3.2, base - h); g.lineTo(x + 3.2, base - h); g.lineTo(x + 2.2, base); g.lineTo(x - 2.2, base); g.closePath(); g.fill();
  if (fill > 0.02) { const lh = (h - 1) * fill; g.fillStyle = color; g.beginPath(); g.moveTo(x - 3 + (1 - fill) * 0.8, base - lh - 0.5); g.lineTo(x + 3 - (1 - fill) * 0.8, base - lh - 0.5); g.lineTo(x + 2.1, base - 0.4); g.lineTo(x - 2.1, base - 0.4); g.closePath(); g.fill(); }
  g.strokeStyle = OUT; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x - 3.2, base - h); g.lineTo(x - 2.2, base); g.lineTo(x + 2.2, base); g.lineTo(x + 3.2, base - h); g.stroke();
  if (slice) { g.fillStyle = '#ff9b2e'; g.beginPath(); g.arc(x + 3.2, base - h, 1.9, 0, Math.PI * 2); g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.5; g.stroke(); }
  g.restore();
}

function drawShaker(g: CanvasRenderingContext2D, x: number, y: number, rot: number) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = OUT; g.beginPath(); g.moveTo(-2.7, -5.4); g.lineTo(2.7, -5.4); g.lineTo(2, 4.2); g.lineTo(-2, 4.2); g.closePath(); g.fill();
  g.fillStyle = '#cfd8e2'; g.beginPath(); g.moveTo(-2.1, -4.7); g.lineTo(2.1, -4.7); g.lineTo(1.5, 3.6); g.lineTo(-1.5, 3.6); g.closePath(); g.fill();
  g.fillStyle = '#9fb0c2'; g.fillRect(-2.4, -6.6, 4.8, 2);
  g.fillStyle = '#ffffff'; g.fillRect(-1.5, -4.2, 0.9, 7);
  g.restore();
}

function drawBottle(g: CanvasRenderingContext2D, x: number, y: number, rot: number) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = OUT; g.fillRect(-2.2, -5, 4.4, 11); g.fillRect(-1.1, -9, 2.2, 4.5);
  g.fillStyle = '#3fbf5a'; g.fillRect(-1.6, -4.4, 3.2, 10); g.fillRect(-0.6, -8.4, 1.2, 4);
  g.fillStyle = '#f4efe2'; g.fillRect(-1.6, -0.6, 3.2, 3);
  g.restore();
}

/**
 * Desenha o bar: prateleira na parede, o barman (atrás do balcão), o balcão e as peças em cima dele.
 * `x` = centro do bar; `y` = chão do barman (fundo da pista).
 */
export function drawBar(g: CanvasRenderingContext2D, x: number, y: number, time: number, beat: number) {
  const a = art ?? bakeBarArt();
  drawSpr(g, a.shelf, x, y + 2);
  const pr = barmanPose(a.look, a.pose, { joy: a.faceJoy, talk: a.faceTalk }, time, beat);
  // sombra e corpo
  g.save();
  g.translate(x, y);
  g.scale(-S, S);
  drawFigure(g, a.look, a.pose);
  g.restore();
  // balcão por cima das pernas do barman
  drawSpr(g, a.counter, x, y + CT * S + 4);
  // peças (no mesmo espaço do barman, por cima do balcão)
  g.save();
  g.translate(x, y);
  g.scale(-S, S);
  g.lineCap = 'round';
  if (pr.glass) drawGlass(g, pr.glass.x, CT + 2.4, pr.glass.fill, pr.glass.color, pr.glass.a, pr.glass.slice);
  if (pr.shot) drawGlass(g, pr.shot.x + 9, CT + 2.4, pr.shot.fill, '#ffd23a', 1, false, 5);
  if (pr.stream) { g.strokeStyle = pr.stream.color; g.lineWidth = 1.1; g.beginPath(); g.moveTo(pr.stream.x0, pr.stream.y0); g.quadraticCurveTo((pr.stream.x0 + pr.stream.x1) / 2 + 1, pr.stream.y0 + 2, pr.stream.x1, pr.stream.y1); g.stroke(); }
  if (pr.shaker) drawShaker(g, pr.shaker.x, pr.shaker.y, pr.shaker.rot);
  if (pr.bottle) drawBottle(g, pr.bottle.x, pr.bottle.y, pr.bottle.rot);
  if (pr.held) drawGlass(g, pr.held.x, pr.held.y + 4, 0, '#fff', 1, false, 7.5);
  if (pr.cloth) { g.fillStyle = '#f4efe2'; g.strokeStyle = OUT; g.lineWidth = 0.6; g.beginPath(); g.roundRect(pr.cloth.x - 2.4, pr.cloth.y - 1.6, 5.2, 3.2, 1); g.fill(); g.stroke(); }
  g.restore();
}
