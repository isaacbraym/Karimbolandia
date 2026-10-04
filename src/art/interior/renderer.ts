/**
 * Desenho do diorama isométrico. Tudo que é caro (casca, móveis, vinheta) é assado ao entrar e
 * liberado ao sair; por quadro só há `drawImage`, polígonos simples e partículas de pool fixo.
 */
import { TILE_H as TH, TILE_W as TW, depthKey } from '../../game/interior/iso';
import type { InteriorSim } from '../../game/interior/sim';
import type { Cell, FurnitureDef, Npc } from '../../game/interior/types';
import { glowSprite, makeCanvas } from '../kit';
import { BAKE, SLAB, WALL_H, bakeShell, type Shell } from './shell';
import { heightOf, painterOf } from './furniture';
import { FX_PALETTE, Particles, drawPop, type Pop } from './fx';
import { drawKarimboIso, drawNpc } from './actors';
import type { Quality } from '../index';

export interface SceneState {
  /** 0 = desmontado, 1 = montado (entrada/saída) */
  assemble: number;
  hover: Cell | null;
  selFid: string | null;
  dest: Cell | null;
  pops: Pop[];
  /** furniture com o contorno de “alvo” pulsando */
  pulseFid?: string | null;
  /** luz do dia (0 = noite) só para tingir a porta */
  time: number;
}

interface Spr { key: string; c: HTMLCanvasElement; ox: number; oy: number; w: number; h: number }
interface Item { depth: number; kind: 0 | 1 | 2; f?: FurnitureDef; n?: Npc }

const easeOutBack = (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export class InteriorRenderer {
  readonly shell: Shell;
  readonly w: number;
  readonly h: number;
  readonly particles = new Particles();
  private sprites = new Map<string, Spr>();
  private vignette: HTMLCanvasElement | null = null;
  private backdrop: HTMLCanvasElement | null;
  private lw = 0; private lh = 0;
  s = 1; ox = 0; oy = 0;
  private items: Item[] = [];
  private tmp: [number, number] = [0, 0];
  readonly quality: Quality;
  private skin: string | undefined;
  /** contador de debug: quantos canvases este renderer mantém vivos */
  static alive = 0;
  private disposed = false;

  constructor(readonly sim: InteriorSim, backdrop: HTMLCanvasElement | null, quality: Quality) {
    this.w = sim.grid.w; this.h = sim.grid.h;
    this.quality = quality;
    this.backdrop = backdrop;
    this.shell = bakeShell(sim.room);
    InteriorRenderer.alive += 2 + (backdrop ? 1 : 0);
    this.particles.density = quality === 'high' ? 1 : quality === 'medium' ? 0.7 : 0.45;
  }

  /** Libera tudo o que foi assado (chamado ao sair do cômodo). */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const kill = (c: HTMLCanvasElement | null) => { if (c) { c.width = 0; c.height = 0; } };
    kill(this.shell.floor); kill(this.shell.walls); kill(this.vignette); kill(this.backdrop);
    InteriorRenderer.alive -= 2 + (this.backdrop ? 1 : 0) + (this.vignette ? 1 : 0);
    for (const s of this.sprites.values()) { kill(s.c); InteriorRenderer.alive--; }
    this.sprites.clear(); this.vignette = null; this.backdrop = null;
    this.particles.clear();
  }

  // ─────────────── projeção ───────────────
  fit(W: number, H: number) {
    if (W === this.lw && H === this.lh) return;
    this.lw = W; this.lh = H;
    const bw = (this.w + this.h) * TW / 2 + 36, bh = WALL_H + (this.w + this.h) * TH / 2 + SLAB + 26;
    const top = 30, bottom = 40;
    this.s = Math.max(0.5, Math.min((W - 24) / bw, (H - top - bottom) / bh, 1.6));
    const cx = W / 2 + (this.w - this.h) * TW / 4 * this.s * 0.0;
    this.ox = cx - ((this.w - this.h) * TW / 4) * this.s;
    this.oy = top + (H - top - bottom - bh * this.s) / 2 + (WALL_H + 10) * this.s;
    if (!this.vignette) {
      this.vignette = makeCanvas(Math.max(2, Math.round(W)), Math.max(2, Math.round(H)));
      InteriorRenderer.alive++;
    }
    this.vignette.width = Math.max(2, Math.round(W)); this.vignette.height = Math.max(2, Math.round(H));
    const g = this.vignette.getContext('2d')!;
    const gr = g.createRadialGradient(W / 2, H * 0.52, Math.min(W, H) * 0.3, W / 2, H * 0.52, Math.max(W, H) * 0.72);
    gr.addColorStop(0, 'rgba(10,6,18,0)'); gr.addColorStop(1, 'rgba(10,6,18,.62)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }

  toScreen(gx: number, gy: number, z = 0, out: [number, number] = this.tmp): [number, number] {
    out[0] = this.ox + (gx - gy) * TW / 2 * this.s;
    out[1] = this.oy + ((gx + gy) * TH / 2 - z) * this.s;
    return out;
  }

  /** Tela → célula de piso (ou null fora da sala). */
  cellAt(sx: number, sy: number): Cell | null {
    const x = (sx - this.ox) / this.s, y = (sy - this.oy) / this.s;
    const gx = x / TW + y / TH, gy = y / TH - x / TW;
    const c = { x: Math.floor(gx), y: Math.floor(gy) };
    return c.x >= 0 && c.y >= 0 && c.x < this.w && c.y < this.h ? c : null;
  }

  /** Polígono (convexo) de clique do móvel em coordenadas de tela. */
  private hull(f: FurnitureDef): [number, number][] {
    const out: [number, number][] = [];
    if (f.wall) {
      const [a, b] = this.wallEnds(f);
      const z0 = f.wall.z, z1 = f.wall.z + f.wall.h;
      out.push(this.toScreen(a[0], a[1], z0, [0, 0]), this.toScreen(b[0], b[1], z0, [0, 0]), this.toScreen(b[0], b[1], z1, [0, 0]), this.toScreen(a[0], a[1], z1, [0, 0]));
      return out;
    }
    // itens pequenos (sobre mesas) ficam com uma área de clique mais justa para não brigar com o vizinho
    const inset = f.lift ? 0.2 : 0.04;
    const x0 = f.gx + inset, x1 = f.gx + f.w - inset, y0 = f.gy + inset, y1 = f.gy + f.h - inset, lf = f.lift ?? 0, hz = heightOf(f) + lf;
    out.push(this.toScreen(x0, y1, hz, [0, 0]), this.toScreen(x0, y0, hz, [0, 0]), this.toScreen(x1, y0, hz, [0, 0]),
      this.toScreen(x1, y0, lf, [0, 0]), this.toScreen(x1, y1, lf, [0, 0]), this.toScreen(x0, y1, lf, [0, 0]));
    return out;
  }

  private wallEnds(f: FurnitureDef): [[number, number], [number, number]] {
    const wd = f.wall!;
    const half = wd.w / TW; // largura em tiles ao longo da parede (aprox.)
    if (wd.side === 'right') { const c = f.gx + f.w / 2; return [[c - half / 2, 0], [c + half / 2, 0]]; }
    const c = f.gy + f.h / 2;
    return [[0, c - half / 2], [0, c + half / 2]];
  }

  private inside(poly: [number, number][], x: number, y: number) {
    let pos = 0, neg = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
      if (cr > 0) pos++; else if (cr < 0) neg++;
      if (pos && neg) return false;
    }
    return true;
  }

  /** Móvel sob o ponteiro (o mais à frente). */
  pickFurniture(sx: number, sy: number): FurnitureDef | null {
    let best: FurnitureDef | null = null, bd = -1e9;
    for (const f of this.sim.room.furniture) {
      if (!f.verbs(this.sim, f).length) continue;
      const d = f.wall ? -1 : depthKey(f.gx + f.w / 2, f.gy + f.h / 2) + (f.lift ? 1 : 0);
      if (d > bd && this.inside(this.hull(f), sx, sy)) { best = f; bd = d; }
    }
    return best;
  }

  /** Ponto de ancoragem (topo, centro) do móvel para menus e rótulos. */
  anchor(f: FurnitureDef, out: [number, number] = [0, 0]): [number, number] {
    if (f.wall) {
      const [a, b] = this.wallEnds(f);
      return this.toScreen((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, f.wall.z + f.wall.h, out);
    }
    return this.toScreen(f.gx + f.w / 2, f.gy + f.h / 2, heightOf(f) + (f.lift ?? 0), out);
  }

  // ─────────────── móveis assados ───────────────
  private sprite(f: FurnitureDef): Spr | null {
    const key = f.look ? f.look(this.sim, f) : '';
    const hit = this.sprites.get(f.id);
    if (hit && hit.key === key) return hit;
    if (hit) { hit.c.width = 0; hit.c.height = 0; InteriorRenderer.alive--; this.sprites.delete(f.id); }
    let spr: Spr;
    if (f.wall) {
      const w = f.wall.w + 8, h = f.wall.h + 8;
      const c = makeCanvas(Math.ceil(w * BAKE), Math.ceil(h * BAKE));
      const g = c.getContext('2d')!;
      g.scale(BAKE, BAKE); g.translate(w / 2, h - 4);
      g.lineJoin = 'round'; g.lineCap = 'round';
      painterOf(f.paint).base(g, f, key);
      spr = { key, c, ox: w / 2, oy: h - 4, w, h };
    } else {
      const span = f.w + f.h, hz = heightOf(f);
      const hw = span * TW / 4 + 16, up = hz + span * TH / 4 + 22, down = span * TH / 4 + 14;
      const c = makeCanvas(Math.ceil(hw * 2 * BAKE), Math.ceil((up + down) * BAKE));
      const g = c.getContext('2d')!;
      g.scale(BAKE, BAKE); g.translate(hw, up);
      g.lineJoin = 'round'; g.lineCap = 'round';
      painterOf(f.paint).base(g, f, key);
      spr = { key, c, ox: hw, oy: up, w: hw * 2, h: up + down };
    }
    InteriorRenderer.alive++;
    this.sprites.set(f.id, spr);
    return spr;
  }

  // ─────────────── quadro ───────────────
  draw(g: CanvasRenderingContext2D, W: number, H: number, t: number, st: SceneState) {
    if (this.disposed) return;
    this.fit(W, H);
    const sim = this.sim, s = this.s, sh = this.shell;
    // fundo: memória desfocada do mundo, escurecida
    g.fillStyle = '#0d0a16';
    g.fillRect(0, 0, W, H);
    if (this.backdrop) {
      g.imageSmoothingEnabled = true;
      g.globalAlpha = 0.9;
      g.drawImage(this.backdrop, 0, 0, W, H);
      g.globalAlpha = 1;
    }
    g.fillStyle = 'rgba(12,8,22,.62)';
    g.fillRect(0, 0, W, H);
    const asm = clamp01(st.assemble);
    if (asm <= 0.001) return;
    // origem da casca na tela
    const bx = this.ox - sh.ox * s, by = this.oy - sh.oy * s;
    const bw = sh.floor.width / BAKE * s, bh = sh.floor.height / BAKE * s;
    g.imageSmoothingEnabled = true;
    // piso (cascata diagonal na montagem)
    if (asm >= 0.999) g.drawImage(sh.floor, bx, by, bw, bh);
    else this.floorCascade(g, bx, by, bw, bh, asm);
    this.floorFx(g, st, t);
    // paredes (sobem do chão)
    this.drawWalls(g, bx, by, bw, bh, asm);
    // itens de parede
    for (const f of sim.room.furniture) if (f.wall) this.drawWallItem(g, f, asm, st);
    // móveis, NPCs e Karimbo por profundidade
    const items = this.items;
    items.length = 0;
    for (const f of sim.room.furniture) if (!f.wall) items.push({ depth: depthKey(f.gx + f.w / 2, f.gy + f.h / 2, 0) + (f.lift ? 1 : 0), kind: 0, f });
    for (const n of sim.npcs) if (!n.away) items.push({ depth: depthKey(n.gx, n.gy, 0.5), kind: 1, n });
    items.push({ depth: depthKey(sim.px, sim.py, 0.4), kind: 2 });
    items.sort((a, b) => a.depth - b.depth);
    const kDepth = depthKey(sim.px, sim.py, 0.4);
    const kp = this.toScreen(sim.px, sim.py, 0, [0, 0]);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 0) this.drawFurniture(g, it.f!, asm, st, t, it.depth > kDepth, kp);
      else if (it.kind === 1) this.drawActor(g, it.n!, asm, t);
      else if (asm > 0.8) this.drawPlayer(g, t, (asm - 0.8) / 0.2);
    }
    // partículas e luzes
    this.particles.draw(g, (gx, gy, z, out) => this.toScreen(gx, gy, z, out), s, FX_PALETTE);
    this.lights(g, t);
    for (const p of st.pops) drawPop(g, p);
    if (this.vignette) g.drawImage(this.vignette, 0, 0, W, H);
  }

  private floorCascade(g: CanvasRenderingContext2D, bx: number, by: number, bw: number, bh: number, asm: number) {
    const s = this.s, n = this.w + this.h;
    for (let gy = 0; gy < this.h; gy++) {
      for (let gx = 0; gx < this.w; gx++) {
        const k = (gx + gy) / n;
        const p = clamp01((asm * 1.6 - k * 0.9) / 0.55);
        if (p <= 0) continue;
        const e = easeOutBack(p), dy = (1 - e) * -70 * s;
        const a = this.toScreen(gx, gy, 0, [0, 0]), b = this.toScreen(gx + 1, gy, 0, [0, 0]);
        const c = this.toScreen(gx + 1, gy + 1, 0, [0, 0]), d = this.toScreen(gx, gy + 1, 0, [0, 0]);
        g.save();
        g.globalAlpha = Math.min(1, p * 1.5);
        g.beginPath(); g.moveTo(a[0], a[1] + dy); g.lineTo(b[0], b[1] + dy); g.lineTo(c[0], c[1] + dy); g.lineTo(d[0], d[1] + dy); g.closePath(); g.clip();
        g.drawImage(this.shell.floor, bx, by + dy, bw, bh);
        g.restore();
      }
    }
    g.globalAlpha = 1;
  }

  private drawWalls(g: CanvasRenderingContext2D, bx: number, by: number, bw: number, bh: number, asm: number) {
    const s = this.s, w = this.w, h = this.h;
    const e = asm >= 0.999 ? 1 : easeOutBack(clamp01((asm - 0.18) / 0.5));
    const dy = (1 - e) * WALL_H * s;
    g.save();
    if (asm < 0.999) {
      const T = this.toScreen(0, 0, 0, [0, 0]), R = this.toScreen(w, 0, 0, [0, 0]), L = this.toScreen(0, h, 0, [0, 0]);
      const RT = this.toScreen(w, 0, WALL_H + 8, [0, 0]), LT = this.toScreen(0, h, WALL_H + 8, [0, 0]), TT = this.toScreen(0, 0, WALL_H + 8, [0, 0]);
      g.beginPath(); g.moveTo(T[0], T[1]); g.lineTo(R[0], R[1]); g.lineTo(RT[0], RT[1]); g.lineTo(TT[0], TT[1]); g.lineTo(LT[0], LT[1]); g.lineTo(L[0], L[1]); g.closePath();
      g.clip();
    }
    g.drawImage(this.shell.walls, bx, by + dy, bw, bh);
    g.restore();
  }

  private drawWallItem(g: CanvasRenderingContext2D, f: FurnitureDef, asm: number, st: SceneState) {
    if (asm < 0.7) return;
    const spr = this.sprite(f);
    if (!spr) return;
    const [a, b] = this.wallEnds(f);
    const m = this.toScreen((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, f.wall!.z, [0, 0]);
    const slope = f.wall!.side === 'right' ? TH / TW : -TH / TW;
    g.save();
    g.globalAlpha = clamp01((asm - 0.7) / 0.3);
    g.transform(1, slope, 0, 1, m[0], m[1]);
    g.drawImage(spr.c, -spr.ox * this.s, -spr.oy * this.s, spr.w * this.s, spr.h * this.s);
    const live = painterOf(f.paint).live;
    if (live) { g.scale(this.s, this.s); live(g, f, spr.key, this.sim.t); }
    g.restore();
    if (st.selFid === f.id || st.pulseFid === f.id) this.outline(g, f, st.selFid === f.id);
  }

  private drawFurniture(g: CanvasRenderingContext2D, f: FurnitureDef, asm: number, st: SceneState, t: number, inFront: boolean, kp: [number, number]) {
    const spr = this.sprite(f);
    if (!spr) return;
    const n = this.w + this.h;
    const p = clamp01((asm * 1.7 - 0.45 - ((f.gx + f.gy) / n) * 0.55) / 0.45);
    if (p <= 0) return;
    const e = easeOutBack(p), s = this.s;
    const c = this.toScreen(f.gx + f.w / 2, f.gy + f.h / 2, f.lift ?? 0, [0, 0]);
    const drop = (1 - e) * -90 * s;
    const squash = p < 1 ? 1 - Math.max(0, Math.sin(p * Math.PI)) * 0.0 : 1;
    // raio-X: móvel alto na frente do Karimbo fica translúcido quando o cobre
    let alpha = Math.min(1, p * 1.4);
    let xray = false;
    if (inFront && f.tall && asm > 0.95) {
      const top = c[1] - (heightOf(f) + (f.w + f.h) * TH / 4) * s, bot = c[1] + (f.w + f.h) * TH / 4 * s;
      const hw = (f.w + f.h) * TW / 4 * s;
      if (kp[0] > c[0] - hw - 8 && kp[0] < c[0] + hw + 8 && kp[1] - 70 * s < bot && kp[1] > top) { alpha *= 0.36; xray = true; }
    }
    g.save();
    g.globalAlpha = alpha;
    g.translate(c[0], c[1] + drop);
    if (squash !== 1) g.scale(1, squash);
    g.drawImage(spr.c, -spr.ox * s, -spr.oy * s, spr.w * s, spr.h * s);
    const live = painterOf(f.paint).live;
    if (live && p >= 1) { g.scale(s, s); live(g, f, spr.key, this.sim.t); }
    g.restore();
    if (xray) this.outline(g, f, false);
    if (p >= 1 && (st.selFid === f.id || st.pulseFid === f.id)) this.outline(g, f, st.selFid === f.id);
    void t;
  }

  /** Contorno do alvo: losango no piso + traço pulsante no corpo. */
  private outline(g: CanvasRenderingContext2D, f: FurnitureDef, strong: boolean) {
    const pulse = 0.55 + 0.45 * Math.sin(this.sim.t * 6);
    g.save();
    g.lineJoin = 'round';
    g.strokeStyle = strong ? `rgba(255,236,150,${0.55 + pulse * 0.4})` : 'rgba(255,255,255,.35)';
    g.fillStyle = strong ? 'rgba(255,236,150,.12)' : 'rgba(255,255,255,.06)';
    g.lineWidth = strong ? 2 : 1.2;
    const hull = this.hull(f);
    g.beginPath();
    g.moveTo(hull[0][0], hull[0][1]);
    for (let i = 1; i < hull.length; i++) g.lineTo(hull[i][0], hull[i][1]);
    g.closePath();
    if (!f.wall) g.fill();
    g.stroke();
    g.restore();
  }

  private drawActor(g: CanvasRenderingContext2D, n: Npc, asm: number, t: number) {
    if (asm < 0.9) return;
    const p = this.toScreen(n.gx, n.gy, 0, [0, 0]);
    drawNpc(g, this.sim, n, p[0], p[1], this.s, t);
  }

  private drawPlayer(g: CanvasRenderingContext2D, t: number, k: number) {
    const sim = this.sim;
    const p = this.toScreen(sim.px, sim.py, 0, [0, 0]);
    drawKarimboIso(g, sim, p[0], p[1], this.s * (0.9 + 0.1 * easeOutBack(clamp01(k))), t, clamp01(k));
  }

  /** Brilhos no piso: raios das janelas, anéis de ruído, destino, cursor. */
  private floorFx(g: CanvasRenderingContext2D, st: SceneState, t: number) {
    const sim = this.sim, s = this.s;
    // anéis de ruído
    for (const r of sim.rings) {
      const k = r.age / r.life;
      if (k >= 1) continue;
      const c = this.toScreen(r.gx, r.gy, 0, [0, 0]);
      const rad = (0.4 + k * (1.2 + r.power / 14)) * TW * s;
      g.strokeStyle = `rgba(255,236,170,${(1 - k) * 0.65})`;
      g.lineWidth = 2.4 * (1 - k) + 0.6;
      g.beginPath(); g.ellipse(c[0], c[1], rad, rad * 0.5, 0, 0, Math.PI * 2); g.stroke();
    }
    // manchas: cacos, poças, migalhas
    for (const d of sim.decals) {
      const c = this.toScreen(d.gx, d.gy, 0, [0, 0]);
      if (d.kind === 'glass') {
        g.fillStyle = 'rgba(190,235,225,.8)';
        for (let i = 0; i < 7; i++) { const a = i * 2.4, r = 3 + (i % 3) * 3.5; g.beginPath(); g.moveTo(c[0] + Math.cos(a) * r * s, c[1] + Math.sin(a) * r * 0.5 * s); g.lineTo(c[0] + Math.cos(a + 0.5) * (r + 2.4) * s, c[1] + Math.sin(a + 0.5) * (r + 2.4) * 0.5 * s); g.lineTo(c[0] + Math.cos(a + 0.2) * (r + 1) * s, c[1] + Math.sin(a + 0.2) * (r + 3) * 0.5 * s); g.fill(); }
      } else if (d.kind === 'puddle') {
        g.fillStyle = 'rgba(150,200,215,.55)'; g.beginPath(); g.ellipse(c[0], c[1], 17 * s, 8 * s, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.beginPath(); g.ellipse(c[0] - 3 * s, c[1] - 1 * s, 8 * s, 3 * s, 0, 0, Math.PI * 2); g.stroke();
      } else if (d.kind === 'beans') {
        g.fillStyle = '#6b3a22'; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(c[0] + Math.cos(i * 2.1) * (4 + i) * s, c[1] + Math.sin(i * 2.1) * (2 + i * 0.5) * s, 1.8 * s, 1.1 * s, i, 0, Math.PI * 2); g.fill(); }
      } else if (d.kind === 'crumbs') {
        g.fillStyle = '#f0d89a'; for (let i = 0; i < 8; i++) g.fillRect(c[0] + Math.cos(i * 2.3) * (3 + i) * s, c[1] + Math.sin(i * 2.3) * (1.5 + i * 0.4) * s, 1.8 * s, 1.4 * s);
      }
    }
    // destino do clique
    if (st.dest) {
      const c = this.toScreen(st.dest.x + 0.5, st.dest.y + 0.5, 0, [0, 0]);
      const k = (Math.sin(t * 7) + 1) / 2;
      g.strokeStyle = `rgba(160,255,230,${0.5 + k * 0.4})`; g.lineWidth = 1.6;
      g.beginPath(); g.ellipse(c[0], c[1], TW * 0.3 * s * (0.8 + k * 0.2), TH * 0.3 * s * (0.8 + k * 0.2), 0, 0, Math.PI * 2); g.stroke();
    }
    // pegadas pontilhadas do caminho
    if (sim.path.length) {
      g.fillStyle = 'rgba(255,255,255,.55)';
      let px = sim.px, py = sim.py;
      for (let i = 0; i < sim.path.length; i++) {
        const q = sim.path[i];
        const nx = q.x + 0.5, ny = q.y + 0.5;
        for (let k = 0.5; k <= 1; k += 0.5) {
          const c = this.toScreen(px + (nx - px) * k, py + (ny - py) * k, 0, [0, 0]);
          g.beginPath(); g.ellipse(c[0], c[1], 2.2 * s, 1.1 * s, 0, 0, Math.PI * 2); g.fill();
        }
        px = nx; py = ny;
      }
    }
    // cursor em losango
    if (st.hover) {
      const x = st.hover.x, y = st.hover.y;
      if (sim.grid.walkable(x, y)) {
        const a = this.toScreen(x, y, 0, [0, 0]), b = this.toScreen(x + 1, y, 0, [0, 0]), c = this.toScreen(x + 1, y + 1, 0, [0, 0]), d = this.toScreen(x, y + 1, 0, [0, 0]);
        g.fillStyle = 'rgba(255,255,255,.14)'; g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill(); g.stroke();
      }
    }
  }

  private lights(g: CanvasRenderingContext2D, t: number) {
    if (this.quality === 'low') return;
    const lights = this.sim.room.lights;
    if (!lights?.length) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < lights.length; i++) {
      const L = lights[i];
      const c = this.toScreen(L.gx, L.gy, L.z, [0, 0]);
      const fl = L.flicker ? 1 + Math.sin(t * 9 + i * 2) * L.flicker * 0.5 + Math.sin(t * 23 + i) * L.flicker * 0.5 : 1;
      const spr = glowSprite(L.color, 32);
      const r = L.r * this.s * fl;
      g.globalAlpha = 0.34 * fl;
      g.drawImage(spr.c, c[0] - r, c[1] - r, r * 2, r * 2);
    }
    g.restore();
  }
}
