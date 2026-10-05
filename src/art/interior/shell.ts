/**
 * Casca do diorama (piso, laje, paredes, porta): assada UMA vez ao entrar no cômodo e liberada ao sair.
 * Duas imagens (piso e paredes) para a entrada poder montá-las em cascata.
 */
import { TILE_W as TW, TILE_H as TH } from '../../game/interior/iso';
import type { RoomDef } from '../../game/interior/types';
import { makeCanvas } from '../kit';

export const WALL_H = 100;
export const SLAB = 16;
export const BAKE = 2;
const PAD = 14;
const DEEP = 74; // pernas da palafita / raízes abaixo da laje

export interface Shell {
  floor: HTMLCanvasElement;
  walls: HTMLCanvasElement;
  /** posição (px lógicos, antes de BAKE) da origem iso (gx=0,gy=0) dentro das imagens */
  ox: number;
  oy: number;
  /** tamanho lógico das imagens */
  w: number;
  h: number;
  /** px de imagem por px lógico (acompanha a escala real da tela) */
  bake: number;
}

export const iso = (gx: number, gy: number, z = 0): [number, number] => [(gx - gy) * TW / 2, (gx + gy) * TH / 2 - z];

function hash(x: number, y: number) {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  h = (h ^ (h >>> 13)) >>> 0;
  return h / 4294967296;
}

function poly(g: CanvasRenderingContext2D, pts: [number, number][], fill?: string | CanvasGradient, stroke?: string, lw = 1) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}

const mix = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

interface Theme {
  floorA: string; floorB: string; gap: string; slabL: string; slabR: string; wallL: string; wallR: string; trim: string; base: string;
}
const THEMES: Record<string, Theme> = {
  stilt: { floorA: '#8a6a45', floorB: '#6d5236', gap: '#101c1b', slabL: '#4b3a2a', slabR: '#382c20', wallL: '#6b6a4a', wallR: '#7d7a55', trim: '#2a2418', base: '#3b3022' },
  house: { floorA: '#b4553f', floorB: '#9a4635', gap: '#5a2a22', slabL: '#6a4b36', slabR: '#533a2a', wallL: '#e8dcc2', wallR: '#f3e9d2', trim: '#4a3a2c', base: '#3d6fa0' },
};

export function bakeShell(room: RoomDef, bake = BAKE): Shell {
  const w = room.rows.reduce((m, r) => Math.max(m, r.length), 0), h = room.rows.length;
  const th = THEMES[room.theme];
  const W = (w + h) * TW / 2 + PAD * 2, ox = h * TW / 2 + PAD;
  const oy = WALL_H + PAD + 6;
  const H = oy + (w + h) * TH / 2 + SLAB + DEEP + PAD;
  const mk = () => {
    const c = makeCanvas(Math.ceil(W * bake), Math.ceil(H * bake));
    const g = c.getContext('2d')!;
    g.scale(bake, bake);
    g.translate(ox, oy);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    return { c, g };
  };
  const F = mk(), Wl = mk();
  paintFloor(F.g, room, th, w, h);
  paintWalls(Wl.g, room, th, w, h);
  return { floor: F.c, walls: Wl.c, ox, oy, w: W, h: H, bake };
}

function paintFloor(g: CanvasRenderingContext2D, room: RoomDef, th: Theme, w: number, h: number) {
  const L = iso(0, h), B = iso(w, h), R = iso(w, 0);
  if (room.theme === 'stilt') {
    // estacas e água escura sob a laje
    const posts: [number, number][] = [[1, 1], [w - 1, 1], [1, h - 1], [w - 1, h - 1], [Math.floor(w / 2), h - 1], [w - 1, Math.floor(h / 2)]];
    for (const [gx, gy] of posts.sort((a, b) => a[0] + a[1] - (b[0] + b[1]))) {
      const [x, y] = iso(gx, gy);
      const gr = g.createLinearGradient(x - 4, 0, x + 4, 0);
      gr.addColorStop(0, '#2a2118'); gr.addColorStop(0.5, '#5a4630'); gr.addColorStop(1, '#241c14');
      g.fillStyle = gr;
      g.fillRect(x - 4, y, 8, SLAB + DEEP - 8);
      g.fillStyle = 'rgba(10,28,26,.55)'; g.beginPath(); g.ellipse(x, y + SLAB + DEEP - 6, 10, 3.6, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(140,200,190,.35)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(x, y + SLAB + DEEP - 6, 12, 4.4, 0, 0, Math.PI * 2); g.stroke();
    }
  }
  // laje: lados com espessura
  poly(g, [L, B, [B[0], B[1] + SLAB], [L[0], L[1] + SLAB]], th.slabL, '#140f0a', 1.2);
  poly(g, [B, R, [R[0], R[1] + SLAB], [B[0], B[1] + SLAB]], th.slabR, '#140f0a', 1.2);
  if (room.theme === 'house') {
    // terra e raízes na borda da laje
    g.strokeStyle = 'rgba(30,60,30,.9)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(L[0], L[1] + 1); g.lineTo(B[0], B[1] + 1); g.lineTo(R[0], R[1] + 1); g.stroke();
    g.strokeStyle = 'rgba(40,24,16,.55)'; g.lineWidth = 1;
    for (let i = 1; i < w + h; i++) {
      const t = i / (w + h), x = L[0] + (R[0] - L[0]) * t, y = (t < h / (w + h) ? L[1] + (B[1] - L[1]) * (t * (w + h) / h) : B[1] - (B[1] - R[1]) * ((t * (w + h) - h) / w)) + SLAB;
      g.beginPath(); g.moveTo(x, y - SLAB + 3); g.quadraticCurveTo(x + 3, y - 4, x - 2, y + hash(i, 3) * 8); g.stroke();
    }
  } else {
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
    for (let i = 1; i < w + h; i++) {
      const t = i / (w + h);
      if (t < h / (w + h)) { const k = t * (w + h) / h, x = L[0] + (B[0] - L[0]) * k, y = L[1] + (B[1] - L[1]) * k; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + SLAB); g.stroke(); }
    }
  }
  // piso
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      if ((room.rows[gy]?.[gx] ?? '#') === '#') continue;
      const squeak = room.rows[gy][gx] === 's';
      const n = hash(gx, gy), a = iso(gx, gy), b = iso(gx + 1, gy), c = iso(gx + 1, gy + 1), d = iso(gx, gy + 1);
      if (room.theme === 'stilt') {
        poly(g, [a, b, c, d], th.gap);
        // três tábuas por tile, com frestas por onde se vê a água
        for (let k = 0; k < 3; k++) {
          const k0 = k / 3 + 0.025, k1 = (k + 1) / 3 - 0.025;
          const p0 = iso(gx, gy + k0), p1 = iso(gx + 1, gy + k0), p2 = iso(gx + 1, gy + k1), p3 = iso(gx, gy + k1);
          const col = mix(squeak ? '#a07a50' : th.floorA, th.floorB, (hash(gx * 3 + k, gy) * 0.9));
          poly(g, [p0, p1, p2, p3], col);
          g.strokeStyle = 'rgba(30,18,8,.35)'; g.lineWidth = 0.6;
          g.beginPath(); g.moveTo(p0[0] * 0.6 + p1[0] * 0.4, p0[1] * 0.6 + p1[1] * 0.4); g.lineTo(p0[0] * 0.2 + p1[0] * 0.8, p0[1] * 0.2 + p1[1] * 0.8); g.stroke();
          if (squeak && k === 1) { g.fillStyle = '#2a1c10'; for (const t of [0.22, 0.78]) { const q = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t + 2]; g.fillRect(q[0] - 0.6, q[1] - 0.6, 1.2, 1.2); } }
        }
      } else {
        poly(g, [a, b, c, d], mix(th.floorA, th.floorB, n * 0.8), th.gap, 0.8);
        g.fillStyle = `rgba(255,255,255,${0.04 + n * 0.05})`;
        const m = iso(gx + 0.5, gy + 0.5);
        g.beginPath(); g.moveTo(m[0], m[1] - 6); g.lineTo(m[0] + 12, m[1]); g.lineTo(m[0], m[1] + 6); g.lineTo(m[0] - 12, m[1]); g.closePath(); g.fill();
      }
    }
  }
  // sombra de contato junto das paredes de fundo
  const T = iso(0, 0);
  const sh = g.createLinearGradient(0, T[1], 0, T[1] + 36);
  sh.addColorStop(0, 'rgba(0,0,0,.34)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.save();
  poly(g, [iso(0, 0), iso(w, 0), iso(w, h), iso(0, h)]);
  g.clip();
  g.fillStyle = sh;
  g.beginPath(); g.moveTo(...iso(0, 0)); g.lineTo(...iso(w, 0)); g.lineTo(...iso(w, 1.1)); g.lineTo(...iso(0, 1.1)); g.fill();
  g.beginPath(); g.moveTo(...iso(0, 0)); g.lineTo(...iso(0, h)); g.lineTo(...iso(1.1, h)); g.lineTo(...iso(1.1, 0)); g.fill();
  g.restore();
}

function paintWalls(g: CanvasRenderingContext2D, room: RoomDef, th: Theme, w: number, h: number) {
  const z = WALL_H;
  const wr = (u: number, zz: number): [number, number] => iso(u, 0, zz);
  const wl = (v: number, zz: number): [number, number] => iso(0, v, zz);
  // paredes
  const gl = g.createLinearGradient(0, -z, 0, 0);
  gl.addColorStop(0, th.wallL); gl.addColorStop(1, mix(th.wallL, '#000000', 0.32));
  const gr = g.createLinearGradient(0, -z, 0, (w * TH) / 2);
  gr.addColorStop(0, th.wallR); gr.addColorStop(1, mix(th.wallR, '#000000', 0.28));
  poly(g, [wl(0, 0), wl(h, 0), wl(h, z), wl(0, z)], gl);
  poly(g, [wr(0, 0), wr(w, 0), wr(w, z), wr(0, z)], gr);
  if (room.theme === 'stilt') {
    // bambu: gomos verticais e faixas de amarração
    for (let u = 0; u < w; u += 0.25) {
      const n = hash(Math.floor(u * 4), 9);
      g.strokeStyle = `rgba(30,24,10,${0.16 + n * 0.16})`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(...wr(u, 3)); g.lineTo(...wr(u, z - 3)); g.stroke();
      g.strokeStyle = 'rgba(255,240,190,.08)';
      g.beginPath(); g.moveTo(...wr(u + 0.06, 3)); g.lineTo(...wr(u + 0.06, z - 3)); g.stroke();
    }
    for (let v = 0; v < h; v += 0.25) {
      const n = hash(Math.floor(v * 4), 4);
      g.strokeStyle = `rgba(20,18,8,${0.2 + n * 0.16})`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(...wl(v, 3)); g.lineTo(...wl(v, z - 3)); g.stroke();
    }
    g.strokeStyle = 'rgba(60,44,20,.9)'; g.lineWidth = 2.4;
    for (const zz of [28, 62]) { g.beginPath(); g.moveTo(...wr(0, zz)); g.lineTo(...wr(w, zz)); g.stroke(); g.beginPath(); g.moveTo(...wl(0, zz)); g.lineTo(...wl(h, zz)); g.stroke(); }
    // lona verde-oliva remendada
    poly(g, [wr(w * 0.55, 74), wr(w * 0.9, 74), wr(w * 0.9, 20), wr(w * 0.55, 24)], 'rgba(74,86,44,.45)', 'rgba(20,24,10,.5)', 1);
  } else {
    // caiado com barra azul, rodapé e manchas de umidade
    const barZ = 34;
    poly(g, [wr(0, 0), wr(w, 0), wr(w, barZ), wr(0, barZ)], th.base);
    poly(g, [wl(0, 0), wl(h, 0), wl(h, barZ), wl(0, barZ)], mix(th.base, '#000000', 0.18));
    g.strokeStyle = '#f5ecd2'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(...wr(0, barZ)); g.lineTo(...wr(w, barZ)); g.stroke(); g.beginPath(); g.moveTo(...wl(0, barZ)); g.lineTo(...wl(h, barZ)); g.stroke();
    for (let i = 0; i < 26; i++) {
      const u = hash(i, 1) * w, zz = barZ + 10 + hash(i, 2) * (z - barZ - 24), r = 5 + hash(i, 3) * 9;
      const p = wr(u, zz);
      g.fillStyle = 'rgba(120,96,60,.07)'; g.beginPath(); g.ellipse(p[0], p[1], r, r * 0.6, 0, 0, Math.PI * 2); g.fill();
    }
  }
  // porta aberta na parede esquerda: luz da selva entrando
  const dv = room.door.y;
  const dz = 82;
  const A = wl(dv + 0.1, 0), Bq = wl(dv + 0.9, 0), C = wl(dv + 0.9, dz), D = wl(dv + 0.1, dz);
  g.save();
  poly(g, [A, Bq, C, D], '#9fd4a0');
  g.clip();
  const lg = g.createLinearGradient(0, D[1], 0, A[1]);
  lg.addColorStop(0, '#d6f0b8'); lg.addColorStop(0.55, '#8fcf8a'); lg.addColorStop(1, '#3f7f58');
  g.fillStyle = lg; g.fillRect(A[0] - 30, D[1] - 6, 70, 120);
  g.fillStyle = 'rgba(25,70,40,.7)';
  for (let i = 0; i < 7; i++) { const p = wl(dv + 0.1 + hash(i, 5) * 0.8, 8 + hash(i, 6) * 60); g.beginPath(); g.ellipse(p[0], p[1], 9, 4, hash(i, 7) - 0.5, 0, Math.PI * 2); g.fill(); }
  g.restore();
  poly(g, [A, Bq, C, D], undefined, th.trim, 5);
  g.strokeStyle = '#c9a56a'; g.lineWidth = 1.2; poly(g, [A, Bq, C, D], undefined, '#c9a56a', 1.2);
  // espessura das pontas e viga de cima
  const T = wr(0, z);
  poly(g, [wr(w, 0), wr(w, z), [wr(w, z)[0] + 7, wr(w, z)[1] + 3.5], [wr(w, 0)[0] + 7, wr(w, 0)[1] + 3.5]], mix(th.wallR, '#000000', 0.45), th.trim, 1);
  poly(g, [wl(h, 0), wl(h, z), [wl(h, z)[0] - 7, wl(h, z)[1] + 3.5], [wl(h, 0)[0] - 7, wl(h, 0)[1] + 3.5]], mix(th.wallL, '#000000', 0.5), th.trim, 1);
  g.strokeStyle = th.trim; g.lineWidth = 6;
  g.beginPath(); g.moveTo(...wl(h, z)); g.lineTo(...T); g.lineTo(...wr(w, z)); g.stroke();
  g.strokeStyle = 'rgba(255,230,170,.22)'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(...wl(h, z - 3)); g.lineTo(wr(0, z - 3)[0], wr(0, z - 3)[1]); g.lineTo(...wr(w, z - 3)); g.stroke();
  // quina interna
  g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(...wr(0, 0)); g.lineTo(...T); g.stroke();
}
