/** Native jungle illustration. Detailed textures are baked once; only a few rig parts move. */
import { bake, drawSpr, OUT, type Sprite } from './kit';
import type { Crocodile, Habitat, HabitatKind } from '../game/wildlife';

const TAU = Math.PI * 2;
function oval(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, c: string, rot = 0) {
  g.fillStyle = c; g.strokeStyle = OUT; g.lineWidth = 1.2;
  g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill(); g.stroke();
}
function line(g: CanvasRenderingContext2D, points: number[], c: string, width: number) {
  g.strokeStyle = c; g.lineWidth = width; g.beginPath(); g.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) g.lineTo(points[i], points[i + 1]);
  g.stroke();
}
function poly(g: CanvasRenderingContext2D, points: number[], c: string) {
  g.fillStyle = c; g.strokeStyle = OUT; g.lineWidth = 1.3; g.beginPath(); g.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) g.lineTo(points[i], points[i + 1]);
  g.closePath(); g.fill(); g.stroke();
}
function part(w: number, h: number, ox: number, oy: number, paint: (g: CanvasRenderingContext2D) => void): Sprite {
  return bake(w, h, g => { g.translate(ox, oy); paint(g); }, { ox, oy });
}
let art: ReturnType<typeof createArt> | null = null;
const branches = new Map<HabitatKind, Sprite>();

function nest(g: CanvasRenderingContext2D, eggs: boolean) {
  oval(g, 0, 0, eggs ? 26 : 23, 11, '#6a422c');
  oval(g, 0, -3, 21, 6, '#332622');
  if (eggs) {
    for (let i = 0; i < 3; i++) {
      oval(g, (i - 1) * 11, -9 - (i === 1 ? 3 : 0), 6, 9, i === 1 ? '#a9d2bd' : '#e8e0ba', (i - 1) * 0.2);
      for (let j = 0; j < 4; j++) { g.fillStyle = '#8b7453'; g.fillRect((i - 1) * 11 - 3 + j % 2 * 4, -13 + j * 2, 1.7, 1.3); }
    }
  }
  for (let i = 0; i < 18; i++) {
    const x = -24 + i * 2.6, y = 4 + Math.sin(i * 2.2) * 4;
    line(g, [x, y - 5, x + 7, y + 1, x + 13, y - 3], i % 3 ? '#b68a53' : '#d0ae70', 1.5);
  }
}

function branch(kind: HabitatKind) {
  const cached = branches.get(kind); if (cached) return cached;
  const wide = kind === 'marmoset' || kind === 'capuchin';
  const variant = ['eggs', 'bird', 'hive', 'snake', 'marmoset', 'capuchin'].indexOf(kind);
  const spr = part(310, 142, 28, 40, g => {
    poly(g, [-6, 30, 8, -4, 27, -8, 100, -1, wide ? 240 : 118, -13, wide ? 242 : 118, -5, 97, 9, 28, 2], '#67452c');
    line(g, [9, -1, 37, -4, 91, 4, wide ? 225 : 109, -8], '#b69255', 2.4);
    line(g, [43 + variant * 4, 3, 59 + variant * 3, -17 - variant, 85 + variant * 2, -22 - variant], '#765433', 4 + variant * 0.25);
    for (let i = 0; i < (wide ? 8 : 5); i++) {
      const x = 30 + i * (wide ? 27 : 16), y = -11 - Math.sin(i * 1.8 + variant) * 9;
      oval(g, x, y, 9 + i % 3 * 2, 4, i % 2 ? '#64913e' : '#3e7036', -0.5 + i % 3 * 0.5);
      line(g, [x - 6, y + 1, x + 5, y - 1], '#8fb55a', 0.7);
    }
    if (kind === 'eggs' || kind === 'bird') { g.save(); g.translate(76, -5); g.scale(.55, .55); nest(g, kind === 'eggs'); g.restore(); }
    if (kind === 'hive') {
      line(g, [72, 2, 76, 26], '#af874b', 4);
      oval(g, 77, 52, 23, 32, '#d4a44c');
      for (let i = 0; i < 8; i++) {
        const y = 29 + i * 6, r = Math.sqrt(Math.max(0, 1 - ((y - 52) / 32) ** 2)) * 22;
        line(g, [77 - r, y, 77, y + 3, 77 + r, y], i % 2 ? '#98713c' : '#f3ca6c', 2);
      }
      oval(g, 80, 64, 7, 5, '#342514');
      poly(g, [61, 61, 58, 83, 64, 80, 67, 61], '#ebba52');
    }
  });
  branches.set(kind, spr); return spr;
}

function createArt() {
  const crocBody = part(270, 80, 134, 55, g => {
    poly(g, [-22, -17, -64, -13, -107, -20, -130, -11, -82, 5, -48, 14, -16, 13], '#53693b');
    oval(g, -15, -1, 58, 22, '#688346');
    oval(g, -12, 10, 46, 8, '#a19e61');
    for (const x of [-48, 22]) {
      oval(g, x, 15, 17, 9, '#536c3a', 0.25);
      for (let i = 0; i < 3; i++) poly(g, [x + 3 + i * 5, 19, x + 10 + i * 4, 22, x + 6 + i * 5, 16], '#d6cd9a');
    }
    for (let i = 0; i < 13; i++) {
      const x = -103 + i * 11, y = -19 + Math.sin(i / 12 * Math.PI) * -6;
      poly(g, [x, y + 6, x + 5, y - 4, x + 10, y + 6], '#92a858');
    }
    for (let i = 0; i < 38; i++) { g.fillStyle = i % 3 ? '#425831' : '#9aab61'; g.fillRect(-62 + i % 12 * 8, -7 + Math.floor(i / 12) * 6, 4, 2); }
  });
  const lowerJaw = part(122, 47, 12, 18, g => {
    poly(g, [0, -4, 92, -3, 103, 3, 94, 13, 16, 12, -4, 3], '#a5a06a');
    poly(g, [9, -4, 92, -3, 97, 2, 13, 4], '#6c3841');
    oval(g, 47, 0, 27, 2.4, '#cd7d79');
    for (let i = 0; i < 9; i++) poly(g, [17 + i * 9, 0, 20 + i * 9, -8, 23 + i * 9, 0], '#fff0c2');
    line(g, [17, 9, 90, 8], '#ded095', 2);
  });
  const upperJaw = part(130, 63, 18, 41, g => {
    poly(g, [-6, 0, 0, -17, 15, -22, 40, -12, 89, -11, 101, -6, 104, 3, 10, 5], '#758d4b');
    line(g, [36, -9, 90, -7], '#b2bb72', 3);
    for (let i = 0; i < 9; i++) poly(g, [16 + i * 9, 4, 19 + i * 9, 13, 22 + i * 9, 4], '#fff2cd');
    oval(g, 16, -18, 10, 8, '#8c9e55');
    oval(g, 19, -19, 5, 4.5, '#efc65f');
    line(g, [20, -22, 20, -16], OUT, 2.5);
    oval(g, 91, -7, 2.5, 1.4, '#29352a');
  });
  const birdBody = part(65, 70, 34, 60, g => {
    poly(g, [-11, -7, -31, 14, -24, 19, -3, -3], '#356e7d');
    oval(g, 0, -12, 14, 19, '#bd6740', -0.2);
    oval(g, 6, -10, 9, 13, '#e4b65b');
    oval(g, -5, -13, 10, 14, '#43848d', -0.3);
    line(g, [-11, -14, -4, -1, -2, -18], '#8fbec0', 1.2);
    line(g, [-1, 4, 0, 10, -7, 11, 1, 10, 7, 11], '#dfa76b', 1.5);
  });
  const birdHead = part(43, 36, 20, 26, g => {
    oval(g, 0, -5, 11, 10, '#c96748');
    poly(g, [-6, -14, -8, -25, 0, -18, 4, -20, 6, -13], '#cc8a50');
    poly(g, [7, -7, 20, -4, 7, 1], '#ecc35a');
    oval(g, 3, -8, 3.7, 3.4, '#f1ddb7');
    oval(g, 4, -8, 1.7, 2, OUT);
  });
  const snakeHead = part(42, 29, 19, 16, g => {
    oval(g, 0, 0, 16, 9, '#65a756');
    poly(g, [-10, -5, 0, -10, 16, -4, 10, 4, -6, 3], '#80bc65');
    oval(g, 7, -4, 3, 2.7, '#efc454');
    line(g, [8, -6, 8, -2], OUT, 1.5);
    line(g, [0, 5, 14, 4], '#294531', 1);
  });
  const monkeys = (['marmoset', 'capuchin'] as const).map(kind => {
    const small = kind === 'marmoset';
    const fur = small ? '#817d6e' : '#8d563a', light = small ? '#d8ccad' : '#ca9865';
    const body = part(58, 64, 29, 44, g => {
      oval(g, 0, -2, small ? 12 : 17, small ? 18 : 21, fur, small ? 0.3 : -0.12);
      oval(g, 6, -2, small ? 7 : 10, 12, light);
      for (let i = 0; i < 5; i++) line(g, [-10, -12 + i * 4, -2, -10 + i * 4], small ? '#46463f' : '#75422f', 2);
    });
    const head = part(60, 51, 29, 30, g => {
      if (small) { oval(g, -12, -7, 11, 12, '#ded8bd', -0.3); oval(g, 14, -7, 10, 12, '#ded8bd', 0.3); }
      else { oval(g, -12, -1, 6, 7, '#be885c'); oval(g, 15, -1, 6, 7, '#be885c'); }
      oval(g, 0, -5, small ? 12 : 15, 13, small ? '#686355' : '#513629');
      oval(g, 3, 0, small ? 9 : 12, 9, light);
      oval(g, -3, -5, 3.6, 4, '#eee6cb'); oval(g, 8, -5, 3.6, 4, '#eee6cb');
      oval(g, -2, -5, 1.8, 2.2, OUT); oval(g, 9, -5, 1.8, 2.2, OUT);
      oval(g, 5, 1, 3, 2, '#493329');
      line(g, [1, 5, 5, 7, 10, 5], '#6e4434', 1);
      if (!small) poly(g, [-12, -13, -7, -22, -2, -16, 3, -22, 11, -13], '#38281e');
    });
    return { body, head, fur, light, small };
  });
  return { crocBody, lowerJaw, upperJaw, birdBody, birdHead, snakeHead, monkeys };
}

/** Called while the jungle loading screen is active, never on the first gameplay frame. */
export function prepareWildlifeArt() {
  if (!art) art = createArt();
  for (const k of ['eggs', 'bird', 'hive', 'snake', 'marmoset', 'capuchin'] as const) branch(k);
}

export function drawCrocodile(g: CanvasRenderingContext2D, c: Crocodile, t: number) {
  const a = art; if (!a) return;
  g.save(); g.translate(c.x, c.y + Math.sin(t * 1.9) * 1.2); g.scale(c.facing, 1);
  drawSpr(g, a.crocBody, 0, 0, { sy: 1 + Math.sin(t * 2.4) * 0.015 });
  drawSpr(g, a.lowerJaw, 15, -9, { rot: c.open * 0.17 });
  drawSpr(g, a.upperJaw, 15, -13, { rot: -c.open * 0.92 });
  // Eye blink is a tiny lid, not a texture regeneration.
  if (t % 5.2 > 5.05 && c.open < 0.2) line(g, [28, -33, 40, -32], '#657e43', 5);
  if (c.bite > 0) { line(g, [91, -27, 98, -33], '#f1ddb0', 1.5); line(g, [104, -18, 114, -20], '#f1ddb0', 1.5); }
  g.restore();
}

export function drawHabitat(g: CanvasRenderingContext2D, h: Habitat, t: number) {
  const a = art; if (!a) return;
  g.save(); g.translate(h.x, h.y); g.scale(h.side, 1); g.lineCap = 'round'; g.lineJoin = 'round';
  drawSpr(g, branch(h.kind), 0, 0);
  if (h.kind === 'bird') {
    const bob = Math.sin(t * 3) * 0.6;
    g.save(); g.translate(77, -7); g.scale(.3, .3);
    drawSpr(g, a.birdBody, 0, -10 + bob);
    const look = Math.sin(t * 0.7 + Math.sin(t * 0.31));
    drawSpr(g, a.birdHead, 5, -36 + bob, { flip: look < -0.25, rot: Math.sin(t * 1.1) * 0.1 });
    if (t % 4.9 > 4.78) line(g, [6, -44 + bob, 12, -44 + bob], '#be7147', 3);
    g.restore();
  } else if (h.kind === 'hive') {
    for (let i = 0; i < 6; i++) {
      const v = t * (0.8 + i * 0.12) + i * 1.7;
      const x = 78 + Math.sin(v) * (30 + i * 7), y = 49 + Math.cos(v * 1.6) * (12 + i * 4);
      oval(g, x - 1, y - 4, 4.5, 2 + Math.abs(Math.sin(t * 38 + i)) * 2, '#dceccc', -0.5);
      oval(g, x, y, 5, 3, '#eac257');
      line(g, [x - 1, y - 2.5, x - 1, y + 2.5], '#3e342b', 1.8);
      oval(g, x + (Math.cos(v) > 0 ? 4 : -4), y, 2.3, 2.5, '#42342b');
    }
  } else if (h.kind === 'snake') {
    g.save(); g.translate(64, -10);
    g.beginPath(); g.moveTo(-51, 5);
    for (let i = 0; i < 6; i++) {
      const x = -36 + i * 13, y = Math.sin(i * 1.7 + t * 0.8) * 3;
      g.quadraticCurveTo(x - 8, y + 6, x, y);
    }
    g.lineTo(43, -3 + Math.sin(t * 0.8) * 2);
    g.strokeStyle = OUT; g.lineWidth = 17; g.stroke();
    g.strokeStyle = '#509049'; g.lineWidth = 14; g.stroke();
    for (let i = 0; i < 6; i++) {
      const x = -36 + i * 13, y = Math.sin(i * 1.7 + t * 0.8) * 3;
      poly(g, [x - 4, y - 3, x, y - 7, x + 4, y - 3, x, y], '#d6c765');
    }
    drawSpr(g, a.snakeHead, 43, -3 + Math.sin(t * 0.8) * 2, { rot: Math.sin(t * 0.9) * 0.06 });
    if (t % 3.4 < 0.32) { line(g, [57, -2, 68, -1, 72, -4], '#d46b65', 1.2); line(g, [68, -1, 72, 2], '#d46b65', 1.2); }
    g.restore();
  } else if (h.kind === 'marmoset' || h.kind === 'capuchin') {
    const m = a.monkeys[h.kind === 'marmoset' ? 0 : 1];
    // Walk, pause, inspect and hop between the two forks; species have separate tempos.
    const phase = (t * (m.small ? 0.75 : 0.5) + (m.small ? 0 : 3)) % 12;
    const travel = phase < 4 ? phase / 4 : phase < 6 ? 1 : phase < 10 ? 1 - (phase - 6) / 4 : 0;
    const walking = phase < 4 || phase >= 6 && phase < 10;
    const stride = walking ? Math.sin(t * (m.small ? 12 : 8)) : 0;
    const hop = walking ? Math.max(0, 1 - Math.abs(travel - 0.5) * 9) * 16 : 0;
    g.translate(42 + travel * 167, -24 - Math.max(0, (42 + travel * 167 - 97) / 143) * 12 - hop - Math.abs(stride) * 1.8);
    g.scale(phase < 6 ? 1 : -1, 1);
    g.strokeStyle = OUT; g.lineWidth = m.small ? 6 : 9; g.beginPath(); g.moveTo(-8, 9);
    g.bezierCurveTo(-35, 26, -45, -8 + Math.sin(t) * 7, -31, -18); g.stroke();
    g.strokeStyle = m.fur; g.lineWidth -= 2; g.stroke();
    if (m.small) for (let i = 0; i < 4; i++) line(g, [-21 - i * 3, 15 - i * 5, -27 - i * 3, 12 - i * 5], '#d9cfb6', 2);
    for (const s of [-1, 1]) {
      line(g, [s * 7, 2, s * 11 + stride * s * 6, 12, s * 12 - stride * s * 8, 24], OUT, 7);
      line(g, [s * 7, 2, s * 11 + stride * s * 6, 12, s * 12 - stride * s * 8, 24], m.fur, 4.5);
      oval(g, s * 12 - stride * s * 8 + 3, 24, 6, 2.8, m.light);
    }
    drawSpr(g, m.body, 0, 0, { rot: stride * 0.07 });
    line(g, [9, -10, 18 + stride * 4, 3, 13 - stride * 6, 18], OUT, 6);
    line(g, [9, -10, 18 + stride * 4, 3, 13 - stride * 6, 18], m.fur, 4);
    drawSpr(g, m.head, 5, -22, { rot: walking ? stride * 0.04 : Math.sin(t * 1.8) * 0.18 });
  }
  g.restore();
}
