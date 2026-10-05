/**
 * Cena da perseguição pela copa: fundo em paralaxe assado, galhos pelo desenhista de tiles do jogo
 * (mesmos blocos em cache), Karimbo com `drawKarimbo` (sem arma), o macaco da fauna com a carta, os
 * bichos e objetos de `critters.ts`, partículas em pool (`BoxFx`) e o HUD de distância. A simulação
 * mora em game/minigames/chase/sim; aqui só se desenha e se reage aos eventos.
 */
import { getArt } from '../../index';
import { progress } from '../../../core/storage';
import { drawKarimbo, type KPose, type KState } from '../../karimbo';
import { drawMonkey } from '../../wildlife';
import { TILE } from '../../../game/level';
import { BoxFx, txt } from '../boxing/fx';
import { bakeBackdrop, drawLayer, type ChaseBackdrop } from './backdrop';
import { drawBanana, drawBromeliad, drawCoati, drawCoconut, drawEnvelope, drawHive, drawSloth, drawSnake, drawToucan, drawVine } from './critters';
import type { ChaseEvent, ChaseMatch } from '../../../game/minigames/chase/sim/match';
import { CATCH_GAP, MIN_CATCH_T } from '../../../game/minigames/chase/sim/match';
import { CHASE_RUN } from '../../../game/minigames/chase/sim/runner';
import type { Rewind } from '../../../game/minigames/chase/sim/letterFilm';
import { RewindFx } from './rewindFx';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));

/** Texto mais longo que isto vira balão menor (cache de `txt` não cresce com falas dinâmicas). */
const BUBBLE_T = 2.4;

export class ChaseScene {
  readonly fx = new BoxFx();
  private bg: ChaseBackdrop | null = null;
  private W = 0;
  private H = 0;
  time = 0;
  camX = 0;
  camY = 0;
  private zoom = 1;
  private anchorY = 0;
  private runPhase = 0;
  private earGlide = 0;
  private squash = 0;
  private bubble: { text: string; t: number } | null = null;
  private speedLines = 0;
  private sinceLand = 9;
  private hiveAngry = new Map<object, number>();
  private slothBounce = new Map<object, number>();
  private vhs: RewindFx | null = null;

  constructor(W: number, H: number) { this.resize(W, H); }

  resize(W: number, H: number) {
    this.W = W; this.H = H;
    this.bg = bakeBackdrop(W, H);
    this.vhs = null;
  }

  /** Reage a um evento da simulação com letreiros, poeira e folhas. */
  handle(e: ChaseEvent, m: ChaseMatch) {
    const r = m.runner, mk = m.monkey;
    const rx = r.x, ry = r.feetY;
    switch (e.type) {
      case 'start': this.fx.pop('VAI, KARIMBO!', rx + 90, ry - 90, '#ffe27a', 20, 1.3); break;
      case 'land': this.sinceLand = 0; this.squash = 0.5; this.fx.burst(rx, ry, 5, 0, '#d9c39a', 90, 2, 300); break;
      case 'jump': this.fx.burst(rx, ry, 3, 2, '#7cc04a', 60, 2.4, 200); break;
      case 'perfect': this.fx.pop('PERFEITO!', rx + 40, ry - 80, '#7cf5ff', 20, 1); this.fx.burst(rx, ry - 20, 14, 1, '#ffe27a', 190, 3, 420); this.speedLines = 1; break;
      case 'spring': this.fx.pop('BOING!', rx, ry - 60, '#ff9ac0', 18, 0.8); this.fx.burst(rx, ry, 10, 2, '#ff7a9c', 160, 3, 500); break;
      case 'sloth': this.fx.pop('Ôôô... calma... aí...', rx, ry - 100, '#e9d7b4', 12, 1.8); this.fx.burst(rx, ry, 8, 2, '#b79a74', 150, 3, 500); break;
      case 'stumble': this.fx.pop(e.kind === 'toucan' ? 'BICADA!' : e.kind === 'snake' ? 'SSSSS!' : 'ÚI!', rx, ry - 70, '#ffb347', 18, 0.9); this.fx.burst(rx, ry - 30, 8, 1, '#ffe27a', 150, 2.6, 400); this.fx.addShake(4, 0.2); break;
      case 'slip': this.fx.pop('ESCORREGOU!', rx, ry - 70, '#ffe27a', 18, 1); break;
      case 'bees': this.fx.pop('ABELHAS!', rx, ry - 80, '#ffd23a', 20, 1.2); break;
      case 'fall': this.fx.pop('SPLASH!', rx, Math.min(ry, m.course.floorY) - 40, '#bfe8ff', 20, 1); this.fx.burst(rx, m.course.floorY - 10, 14, 0, '#6d8a3a', 220, 3, 700); break;
      case 'shake': break;
      case 'break': this.fx.burst(e.x ?? rx, ry + 8, 7, 2, '#8a6a3e', 120, 3, 700); break;
      case 'throw': this.say(e.kind === 'coconut' ? 'Toma este coco!' : 'Escorrega, orelhudo!'); break;
      case 'quase': this.say(e.text ?? 'Quase, Parabólica!'); this.fx.pop('QUASE!', rx + 20, ry - 70, '#ffe27a', 16, 0.8); break;
      case 'taunt': case 'line': case 'read': this.say(e.text ?? 'Hihihi!'); break;
      case 'tired': this.say('Arf... arf...'); break;
      case 'caught': this.fx.pop('PEGUEI!', mk.x, m.course.pathY(mk.x) - 80, '#ffd23a', 26, 1.4); this.fx.addShake(6, 0.35); this.fx.addFlash(0.5, '#fff7d6'); this.fx.burst(mk.x, m.course.pathY(mk.x) - 20, 18, 1, '#ffffff', 260, 3, 200); break;
      default: break;
    }
  }

  private say(text: string) { this.bubble = { text, t: 0 }; }

  update(dt: number, m: ChaseMatch) {
    this.time += dt;
    this.fx.update(dt);
    this.sinceLand += dt;
    this.squash = Math.max(0, this.squash - dt * 4);
    this.speedLines = Math.max(0, this.speedLines - dt * 0.8);
    if (this.bubble) { this.bubble.t += dt; if (this.bubble.t > BUBBLE_T) this.bubble = null; }
    const r = m.runner, b = r.body;
    // câmera: antecipa para a direita; o chão segue suavemente (cair da copa não despenca a câmera)
    const s = this.scale(m);
    this.zoom = damp(this.zoom, s, 3, dt);
    const viewW = this.W / this.zoom, viewH = this.H / this.zoom;
    if (r.state !== 'fallen' && r.fallT <= 0) this.anchorY = b.onGround || r.vine ? r.feetY : damp(this.anchorY, r.feetY, 1.2, dt);
    const lead = clamp(b.vx * 0.22, 0, 70);
    const tx = Math.max(0, r.x - viewW * 0.34 + lead);
    const ty = this.anchorY - viewH * 0.62;
    this.camX = this.time < 0.05 ? tx : damp(this.camX, tx, 7, dt);
    this.camY = this.time < 0.05 ? ty : damp(this.camY, ty, 3.2, dt);
    this.camY = Math.min(this.camY, m.course.floorY - viewH * 0.55);
    // estado do corpo
    this.runPhase += dt * (8 + Math.abs(b.vx) * 0.035);
    this.earGlide = damp(this.earGlide, r.state === 'glide' ? 1 : 0, 14, dt);
    for (const h of m.hazards) {
      if (h.kind === 'hive') this.hiveAngry.set(h, h.hit ? 1 : Math.max(0, (this.hiveAngry.get(h) ?? 0) - dt));
      if (h.kind === 'sloth' && h.hit) this.slothBounce.set(h, (this.slothBounce.get(h) ?? 0) + dt);
    }
    if (m.monkey.mode === 'run' && this.time > 0.1 && Math.random() < dt * 4) this.fx.burst(m.monkey.x, m.monkey.y - 4, 1, 2, '#7cc04a', 40, 2.2, 160);
    if (r.state === 'run' && b.onGround && Math.random() < dt * 9) this.fx.burst(r.x - 8, r.feetY, 1, 0, '#d9c39a', 40, 1.8, 200);
  }

  private scale(m: ChaseMatch) {
    const base = clamp(this.H / 330, 0.8, 1.9);
    return base * (1 - 0.07 * Math.min(1, Math.abs(m.runner.body.vx) / (CHASE_RUN * 1.15)));
  }

  draw(g: CanvasRenderingContext2D, m: ChaseMatch, W: number, H: number, k: number) {
    if (W !== this.W || H !== this.H) this.resize(W, H);
    const bg = this.bg!;
    const s = this.zoom, t = this.time;
    g.drawImage(bg.sky, 0, 0, W, H);
    // a base de cada camada nunca sobe acima do pé da tela (H − altura): sem faixa de céu embaixo
    drawLayer(g, bg.far, W, H, this.camX, 0.12, H * 0.06 - this.camY * 0.04);
    drawLayer(g, bg.mid, W, H, this.camX, 0.3, H * 0.1 - this.camY * 0.08);
    drawLayer(g, bg.near, W, H, this.camX, 0.55, H * 0.12 - this.camY * 0.16);
    g.save();
    g.translate(this.fx.sx, this.fx.sy);
    g.scale(s, s);
    g.translate(-Math.round(this.camX * s) / s, -Math.round(this.camY * s) / s);
    const vw = W / s, vh = H / s;
    getArt().tiles.render(g, m.course.level, this.camX, this.camY, vw, vh, t);
    this.drawShaky(g, m);
    this.drawCourse(g, m, vw, t);
    this.drawMonkeyActor(g, m, t);
    this.drawRunner(g, m);
    this.fx.draw(g);
    this.drawBubble(g, m);
    g.restore();
    // folhas na frente (paralaxe maior) e fachos de luz
    drawLayer(g, bg.leaves, W, 0, this.camX, 1.25, -H * 0.1, 1);
    g.globalAlpha = 0.5; g.globalCompositeOperation = 'lighter';
    g.drawImage(bg.rays, 0, 0, W, H);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    this.drawSpeed(g, W, H);
    this.drawHud(g, m, W, H, k);
    this.fx.drawOverlay(g, W, H);
  }

  // ───────────────────────── mundo ─────────────────────────
  private drawShaky(g: CanvasRenderingContext2D, m: ChaseMatch) {
    for (const s of m.shaky) {
      const x0 = s.def.x0 * TILE;
      if (x0 > this.camX + this.W / this.zoom + 64 || s.def.x1 * TILE < this.camX - 64) continue;
      const y = s.def.row * TILE;
      for (let i = 0; i < s.tiles!.length; i++) {
        const tm = s.tiles![i];
        if (tm < 0 || s.gone![i]) continue;
        const a = Math.min(1, tm / 0.28);
        g.fillStyle = `rgba(255,230,170,${0.12 + a * 0.3})`;
        g.fillRect(x0 + i * TILE + Math.sin(this.time * 70 + i) * 1.2, y - 1, TILE, 14);
        g.strokeStyle = 'rgba(30,18,8,.8)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x0 + i * TILE + 6, y + 1); g.lineTo(x0 + i * TILE + 13, y + 8); g.lineTo(x0 + i * TILE + 10, y + 13); g.stroke();
      }
    }
  }

  private drawCourse(g: CanvasRenderingContext2D, m: ChaseMatch, vw: number, t: number) {
    const x0 = this.camX - 90, x1 = this.camX + vw + 90;
    const c = m.course;
    for (const v of c.vines) {
      if (v.ax < x0 - v.len || v.ax > x1 + v.len) continue;
      const held = m.runner.vine && m.runner.vine.def === v;
      if (held) drawVine(g, v.ax, v.ay, m.runner.x, m.runner.y - 14, t);
      else { const a = Math.sin(t * 1.6 + v.ax * 0.01) * 0.16; drawVine(g, v.ax, v.ay, v.ax + Math.sin(a) * v.len, v.ay + Math.cos(a) * v.len, t); }
    }
    c.springs.forEach((sp, i) => { if (sp.x > x0 && sp.x < x1) drawBromeliad(g, sp.x + sp.w / 2, sp.y, sp.w, Math.max(0, m.springs[i].press * 2.2), t); });
    for (const h of m.hazards) {
      if (h.x < x0 - 400 || h.x > x1 + 700) continue;
      switch (h.kind) {
        case 'sloth': { const bt = this.slothBounce.get(h) ?? 9; drawSloth(g, h.x, h.y, t, bt < 0.4 ? Math.sin((bt / 0.4) * Math.PI) : 0); break; }
        case 'coati': for (const co of h.coatis!) if (co.alive && co.x > x0 - 40 && co.x < x1 + 40) drawCoati(g, co.x, h.y, t + co.x * 0.01); break;
        case 'toucan': if (h.on) drawToucan(g, h.px, h.y - 50 + Math.sin(t * 6 + h.x) * 3, t); break;
        case 'snake': drawSnake(g, h.px, h.y - 150, h.y - 38, t, Math.sin(h.t * 2.4) * 8); break;
        case 'hive': drawHive(g, h.x, h.y - 62, t, h.hit ? 1 : (this.hiveAngry.get(h) ?? 0), h.y - 150); break;
      }
    }
    for (const o of m.thrown) if (o.alive) { if (o.kind === 'banana') drawBanana(g, o.x, o.y); else drawCoconut(g, o.x, o.y, -o.x * 0.08); }
  }

  private drawMonkeyActor(g: CanvasRenderingContext2D, m: ChaseMatch, t: number) {
    const mk = m.monkey, c = m.course;
    const flee = mk.mode === 'caught' && mk.caughtT > 1.15 ? (mk.caughtT - 1.15) * 360 : 0;
    const x = mk.x + flee, feet = mk.y - mk.hop;
    if (x < this.camX - 80 || x > this.camX + this.W / this.zoom + 80) return;
    const stride = mk.mode === 'run' || mk.mode === 'tired' ? Math.sin(t * (mk.mode === 'tired' ? 9 : 17)) : Math.sin(t * 4) * 0.2;
    const taunting = mk.mode === 'taunt' || mk.mode === 'cornered';
    const cloud = mk.mode === 'caught' && mk.caughtT < 1.15;
    if (!cloud) {
      drawMonkey(g, x, feet, 1.2, t, {
        facing: mk.mode === 'slip' ? -1 : mk.mode === 'caught' && flee > 0 ? 1 : (mk.facing as 1 | -1),
        stride,
        arms: taunting ? 'up' : mk.hasLetter ? 'hold' : 'rest',
        headRot: taunting ? Math.sin(t * 10) * 0.22 : Math.sin(t * 6) * 0.05,
        bodyRot: mk.mode === 'slip' ? t * 7 : 0,
        tired: mk.mode === 'tired',
      });
      if (mk.hasLetter && mk.mode !== 'slip') drawEnvelope(g, x + 32 * (mk.facing || 1), feet - 38 + Math.sin(t * 14) * 1.2, Math.sin(t * 8) * 0.25, 1.15);
      if (mk.mode === 'caught') { g.fillStyle = '#ff9a3a'; g.strokeStyle = '#170f2e'; g.lineWidth = 1.2; g.beginPath(); g.arc(x + 9, feet - 52, 5, 0, Math.PI * 2); g.fill(); g.stroke(); }
    } else {
      // nuvem de briga de desenho animado: bolas de fumaça com bracinhos e perninhas saindo
      const L = mk.caughtT, cx = (mk.x + m.runner.x) / 2 + 20, cy = feet - 26;
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4 + L * 7, r = 12 + (i % 3) * 7 + Math.sin(L * 20 + i) * 3, px = cx + Math.cos(a) * (18 + i * 1.6), py = cy + Math.sin(a * 1.2) * 16;
        g.fillStyle = i % 2 ? '#f4f0e6' : '#e1dccb'; g.strokeStyle = '#170f2e'; g.lineWidth = 1.4;
        g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill(); g.stroke();
      }
      g.strokeStyle = '#170f2e'; g.lineWidth = 3;
      for (let i = 0; i < 6; i++) { const a = i * 1.05 + L * 12; g.beginPath(); g.moveTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 20); g.lineTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 30); g.stroke(); }
      txt(g, 'POF! BAF! PLAFT!', cx, cy - 46, 12, '#ffe27a', 'center', 1, 1 + Math.sin(L * 20) * 0.06);
      // a carta voa para fora da nuvem
      const q = clamp((L - 0.7) / 0.45, 0, 1);
      if (q > 0) drawEnvelope(g, cx + (m.runner.x + 18 - cx) * q, cy - Math.sin(q * Math.PI) * 60 + (m.runner.feetY - 36 - cy) * q, q * 9, 1.2);
    }
    void c;
  }

  private drawRunner(g: CanvasRenderingContext2D, m: ChaseMatch) {
    const r = m.runner, b = r.body;
    if (r.state === 'fallen') return;
    // pisca depois de tropeçar / reaparecer (invulnerável)
    const alpha = r.invuln > 0 && Math.floor(this.time * 18) % 2 ? 0.45 : 1;
    const caught = m.monkey.mode === 'caught';
    let st: KState = 'run';
    if (r.state === 'glide') st = 'glide';
    else if (r.state === 'slide') st = 'slide';
    else if (r.state === 'stumble' || r.state === 'slip') st = 'hurt';
    else if (r.state === 'vine') st = 'fall';
    else if (!b.onGround) st = b.vy < 0 ? 'jump' : 'fall';
    else if (caught) st = 'idle';
    const pose: KPose = {
      facing: 1, state: st, t: this.time, runPhase: this.runPhase, speed01: Math.abs(b.vx) / 196, aim: 0, weapon: 'rifle', kick: 0,
      flash: false, earGlide: this.earGlide, vy: b.vy, alpha, hasGun: false,
      squash: b.onGround ? this.squash * 0.5 : -clamp(Math.abs(b.vy) / 1700, 0, 0.3),
      lean: r.state === 'run' ? 0.1 : r.state === 'slip' ? 0.28 : 0,
      earSpring: r.boostT > 0 ? 0.6 : 0,
      idleT: this.time,
    };
    const feet = r.feetY;
    if (r.vine) {
      g.save();
      const hy = b.y - 14;
      g.translate(b.x, hy); g.rotate(-r.vine.ang * 0.85); g.translate(-b.x, -hy);
      drawKarimbo(g, getArt().karimbo, b.x, feet, pose, progress.equippedSkin);
      g.restore();
    } else drawKarimbo(g, getArt().karimbo, b.x, feet, pose, progress.equippedSkin);
    // abelhas em volta da cabeça enquanto agitado
    if (r.agitatedT > 0) {
      for (let i = 0; i < 6; i++) {
        const a = this.time * (7 + i) + i * 1.1;
        g.fillStyle = '#ffd23a'; g.beginPath(); g.ellipse(b.x + Math.cos(a) * 22, feet - 48 + Math.sin(a * 1.3) * 16, 3, 2.2, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#170f2e'; g.fillRect(b.x + Math.cos(a) * 22 - 0.6, feet - 50 + Math.sin(a * 1.3) * 16, 1.2, 4);
      }
    }
    if (r.boostT > 0) { g.globalAlpha = 0.5 * Math.min(1, r.boostT); g.fillStyle = '#7cf5ff'; for (let i = 1; i <= 3; i++) g.fillRect(b.x - 16 - i * 14, feet - 34 + i * 4, 12, 2); g.globalAlpha = 1; }
  }

  private drawBubble(g: CanvasRenderingContext2D, m: ChaseMatch) {
    const bb = this.bubble;
    if (!bb) return;
    const mk = m.monkey;
    const onScreen = mk.x > this.camX + 30 && mk.x < this.camX + this.W / this.zoom - 30;
    const half = Math.min(120, this.W / this.zoom * 0.2);
    const x = clamp(onScreen ? mk.x : this.camX + this.W / this.zoom - half, this.camX + half, this.camX + this.W / this.zoom - half);
    const y = onScreen ? mk.y - mk.hop - 74 : mk.y - 80;
    const alpha = clamp(1 - (bb.t - 1.9) / 0.5, 0, 1), pop = 1 + Math.max(0, 0.25 - bb.t * 0.8);
    // fala longa vira duas linhas (cada metade é um texto em cache)
    const txtv = bb.text;
    if (txtv.length > 20) {
      const cut = txtv.lastIndexOf(' ', Math.ceil(txtv.length / 2) + 4);
      if (cut > 0) { txt(g, txtv.slice(0, cut), x, y - 14, 12, '#fff7d6', 'center', alpha, pop); txt(g, txtv.slice(cut + 1), x, y, 12, '#fff7d6', 'center', alpha, pop); return; }
    }
    txt(g, txtv, x, y, 13, '#fff7d6', 'center', alpha, pop);
  }

  private drawSpeed(g: CanvasRenderingContext2D, W: number, H: number) {
    if (this.speedLines < 0.03) return;
    g.save();
    g.globalAlpha = this.speedLines * 0.45; g.strokeStyle = '#ffffff'; g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < 14; i++) { const y = ((i * 97 + this.time * 900) % H), x = ((i * 211 - this.time * 1800) % (W + 160) + W + 160) % (W + 160) - 80; g.moveTo(x, y); g.lineTo(x + 70, y); }
    g.stroke();
    g.restore();
  }


  // ───────────────────────── rebobinar ─────────────────────────
  /** Câmera do rebobinar: segue o ponto gravado (a altura suaviza, o resto acompanha rápido). */
  updateRewind(dt: number, rw: Rewind) {
    this.time += dt;
    this.runPhase -= dt * 16;
    this.speedLines = 0.7;
    const sm = rw.sample(), viewW = this.W / this.zoom, viewH = this.H / this.zoom;
    this.anchorY = this.time < 0.05 || rw.t < 0.05 ? sm.y : damp(this.anchorY, sm.y, 5, dt);
    this.camX = Math.max(0, sm.x - viewW * 0.34);
    this.camY = this.anchorY - viewH * 0.62;
  }

  /** O percurso gravado rola ao contrário: o Karimbo anda de costas segurando a carta e o macaco corre de costas. */
  drawRewind(g: CanvasRenderingContext2D, m: ChaseMatch, rw: Rewind, W: number, H: number) {
    if (W !== this.W || H !== this.H) this.resize(W, H);
    const bg = this.bg!, s = this.zoom, t = this.time, sm = rw.sample();
    g.drawImage(bg.sky, 0, 0, W, H);
    drawLayer(g, bg.far, W, H, this.camX, 0.12, H * 0.06 - this.camY * 0.04);
    drawLayer(g, bg.mid, W, H, this.camX, 0.3, H * 0.1 - this.camY * 0.08);
    drawLayer(g, bg.near, W, H, this.camX, 0.55, H * 0.12 - this.camY * 0.16);
    g.save();
    g.scale(s, s);
    g.translate(-Math.round(this.camX * s) / s, -Math.round(this.camY * s) / s);
    getArt().tiles.render(g, m.course.level, this.camX, this.camY, W / s, H / s, t);
    // macaco correndo de costas (aparece quando entra na tela)
    if (sm.mx > this.camX - 60 && sm.mx < this.camX + W / s + 60) {
      drawMonkey(g, sm.mx, sm.my, 1.2, t, { facing: 1, stride: Math.sin(-t * 17), arms: 'hold', headRot: 0.1 });
      drawEnvelope(g, sm.mx + 32, sm.my - 38, Math.sin(t * 8) * 0.25, 1.15);
    }
    const pose: KPose = {
      facing: 1, state: sm.air ? 'fall' : 'run', t, runPhase: this.runPhase, speed01: 1, aim: 0, weapon: 'rifle', kick: 0, flash: false,
      earGlide: 0, vy: 0, alpha: 1, hasGun: false, lean: -0.12, earSpring: 0.4, idleT: t,
    };
    drawKarimbo(g, getArt().karimbo, sm.x, sm.y, pose, progress.equippedSkin);
    drawEnvelope(g, sm.x + 18, sm.y - 30, -0.4, 1.1);
    g.restore();
    this.drawSpeed(g, W, H);
    (this.vhs ??= new RewindFx(W, H)).draw(g, rw.t, rw.clock);
  }

  // ───────────────────────── HUD ─────────────────────────
  private drawHud(g: CanvasRenderingContext2D, m: ChaseMatch, W: number, H: number, _k: number) {
    const u = H / 360, bw = Math.min(W * 0.5, 380 * u), bh = 9 * u, x = (W - bw) / 2, y = 14 * u;
    const total = m.course.endX - m.course.spawn.x;
    const f = (px: number) => clamp((px - m.course.spawn.x) / total, 0, 1);
    g.fillStyle = 'rgba(23,15,46,.85)'; g.fillRect(x - 2, y - 2, bw + 4, bh + 4);
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x, y, bw, bh);
    g.fillStyle = '#7cc04a'; g.fillRect(x, y, bw * f(m.runner.x), bh);
    // faixa em que o macaco ainda escapa nos pulos (antes de MIN_CATCH_T)
    const mx = x + bw * f(m.monkey.x), kx = x + bw * f(m.runner.x);
    g.fillStyle = '#8a5a2a'; g.strokeStyle = '#170f2e'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(mx, y + bh / 2, 7 * u, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#fbf3da'; g.fillRect(mx - 3.4 * u, y + bh / 2 - 2.2 * u, 6.8 * u, 4.4 * u);
    g.fillStyle = '#ffe27a';
    g.beginPath(); g.arc(kx, y + bh / 2, 7 * u, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#170f2e'; g.fillRect(kx - 1.2 * u, y + bh / 2 - 3 * u, 2.4 * u, 6 * u);
    const sec = Math.floor(m.time), label = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    // dígito a dígito: só 11 textos em cache, nada de canvas novo a cada segundo
    const col = m.time >= MIN_CATCH_T ? '#ffe27a' : '#ffffff', adv = 7.4 * u, x0 = x + bw + 22 * u - (label.length * adv) / 2 + adv / 2;
    for (let i = 0; i < label.length; i++) txt(g, label[i], x0 + i * adv, y + bh + 2 * u, 12 * u, col, 'center');
    if (m.falls) {
      const d = String(Math.min(99, m.falls));
      txt(g, 'Quedas', x - 38 * u, y + bh + 2 * u, 10 * u, '#ffd0b0', 'center');
      for (let i = 0; i < d.length; i++) txt(g, d[i], x - 8 * u + i * 6 * u, y + bh + 2 * u, 10 * u, '#ffd0b0', 'center');
    }
    // indicador do macaco fora da tela
    const off = m.monkey.x - (this.camX + W / this.zoom);
    if (off > -20) txt(g, '▶', W - 22 * u, H * 0.4, 16 * u, '#ffe27a', 'center', clamp(off / 200, 0, 1) * (0.6 + 0.4 * Math.sin(this.time * 8)));
    if (m.time < 7) txt(g, 'Segure PULAR para pular mais alto  •  ↓ desliza  •  ← freia', W / 2, H - 14 * u, 10.5 * u, '#fff1cd', 'center', clamp(1 - (m.time - 5.5) / 1.5, 0, 1));
    void CATCH_GAP;
  }
}
