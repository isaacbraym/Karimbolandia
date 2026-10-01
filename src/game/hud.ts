import { MAX_LIVES, COMBO_WINDOW, comboMult, type World } from './world';
import { getArt } from '../art';
import { WEAPONS } from './weapons';
import { clamp, easeOutBack, formatTime } from '../core/math';
import { drawSpr } from '../art/kit';
import type { Felipao } from './enemies/felipao';

export interface Banner {
  title: string;
  sub?: string;
  t: number;
  dur: number;
}

const DISPLAY = '"Lilita One", "Arial Black", Impact, sans-serif';
const UI = 'Rajdhani, "Segoe UI", Arial, sans-serif';

function pill(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke?: string) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.lineWidth = 1.4;
    g.strokeStyle = stroke;
    g.stroke();
  }
}

/**
 * Texto do HUD com contorno: cada combinação (texto, tamanho, cor, fonte) é desenhada UMA vez
 * numa imagem na resolução da tela e depois só copiada. strokeText/fillText a cada quadro custa
 * caro na GPU de celulares (e causava engasgos periódicos).
 */
interface TextSpr {
  c: HTMLCanvasElement;
  w: number;
  h: number;
  ax: number;
  ay: number;
}
const textCache = new Map<string, TextSpr>();
let textScale = 2;
let textBudget = 3;
/** Chamado a cada quadro: limita quantas imagens de texto novas são criadas (sem picos). */
export function resetTextBudget() {
  textBudget = 3;
}
let measureCtx: CanvasRenderingContext2D | null = null;
/** Escala (px de tela por unidade lógica) do HUD — chamado no resize. */
export function setHudTextScale(s: number) {
  const q = Math.max(1, Math.round(s * 4) / 4);
  if (q === textScale) return;
  textScale = q;
  textCache.clear();
  slots.clear();
}

/**
 * Textos que mudam o tempo todo (munição a cada tiro, pontuação a cada abate, relógio, combo...):
 * cada campo do HUD tem UMA imagem fixa ("vaga") que só é redesenhada quando o valor muda.
 * Antes cada valor novo criava um canvas novo (upload para a GPU + lixo para o coletor) — em
 * combate intenso isso dava as travadinhas. Nada é alocado nos quadros em que o valor não muda.
 */
interface Slot {
  c: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  val: number;
  color: string;
  w: number;
  h: number;
  ax: number;
  ay: number;
}
const slots = new Map<string, Slot>();
function numText(
  g: CanvasRenderingContext2D, slot: string, val: number, fmt: (v: number) => string, x: number, y: number, size: number,
  color = '#fff', align: CanvasTextAlign = 'left', font = UI, weight = '700'
) {
  if (typeof document === 'undefined') return;
  let e = slots.get(slot);
  if (!e || e.val !== val || e.color !== color) {
    const str = fmt(val);
    const f = `${weight} ${size}px ${font}`;
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')!;
    measureCtx.font = f;
    const lw = Math.max(2, size * 0.24);
    const pad = Math.ceil(lw + 2);
    const tw = Math.ceil(measureCtx.measureText(str).width);
    const w = tw + pad * 2;
    const h = Math.ceil(size * 1.45) + pad * 2;
    const pw = Math.max(1, Math.ceil(w * textScale));
    const ph = Math.max(1, Math.ceil(h * textScale));
    if (!e) {
      const c = document.createElement('canvas');
      // folga para valores maiores (o canvas só cresce em casos raros)
      c.width = Math.ceil(pw * 1.5);
      c.height = ph;
      e = { c, g: c.getContext('2d')!, val, color, w, h, ax: 0, ay: 0 };
      slots.set(slot, e);
    } else if (e.c.width < pw || e.c.height < ph) {
      e.c.width = Math.max(e.c.width, Math.ceil(pw * 1.5));
      e.c.height = Math.max(e.c.height, ph);
      e.g = e.c.getContext('2d')!;
    }
    const cg = e.g;
    cg.setTransform(1, 0, 0, 1, 0, 0);
    cg.clearRect(0, 0, e.c.width, e.c.height);
    cg.setTransform(textScale, 0, 0, textScale, 0, 0);
    cg.font = f;
    cg.textAlign = 'left';
    cg.textBaseline = 'alphabetic';
    cg.lineWidth = lw;
    cg.strokeStyle = '#170f2e';
    cg.lineJoin = 'round';
    const by = pad + Math.ceil(size * 1.1);
    cg.strokeText(str, pad, by);
    cg.fillStyle = color;
    cg.fillText(str, pad, by);
    e.val = val;
    e.color = color;
    e.w = w;
    e.h = h;
    e.ax = align === 'center' ? pad + tw / 2 : align === 'right' || align === 'end' ? pad + tw : pad;
    e.ay = by;
  }
  g.drawImage(e.c, 0, 0, Math.ceil(e.w * textScale), Math.ceil(e.h * textScale), x - e.ax, y - e.ay, e.w, e.h);
}
const fmtInt = (v: number) => String(v);
const fmtAmmo = (v: number) => (v === Infinity ? '∞' : String(v));
const fmtScore = (v: number) => String(v).padStart(7, '0');
const fmtEmblems = (v: number) => `${v} / 10`;
const fmtCombo = (v: number) => `${v} COMBO`;
const fmtMult = (v: number) => `x${v}`;
const fmtSupport = (v: number) => `APOIO ${v}s`;
const fmtFps = (v: number) => `${v} FPS`;
const fmtRemaining = (v: number) => (v === 1 ? 'FALTA 1 INIMIGO' : `FALTAM ${v} INIMIGOS`);
const fmtWave = (v: number) => `ONDA ${v >> 8}/${v & 255}`;

function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'left', font = UI, weight = '700') {
  if (typeof document === 'undefined') return;
  const key = s + '|' + size + '|' + color + '|' + align + '|' + font + '|' + weight;
  let e = textCache.get(key);
  if (!e && textBudget <= 0) {
    // orçamento do quadro esgotado: desenha direto (fica idêntico) e cria a imagem num quadro seguinte
    g.font = `${weight} ${size}px ${font}`;
    g.textAlign = align;
    g.textBaseline = 'alphabetic';
    g.lineWidth = Math.max(2, size * 0.24);
    g.strokeStyle = '#170f2e';
    g.lineJoin = 'round';
    g.strokeText(s, x, y);
    g.fillStyle = color;
    g.fillText(s, x, y);
    return;
  }
  if (!e) {
    textBudget--;
    const f = `${weight} ${size}px ${font}`;
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')!;
    measureCtx.font = f;
    const lw = Math.max(2, size * 0.24);
    const pad = Math.ceil(lw + 2);
    const tw = Math.ceil(measureCtx.measureText(s).width);
    const w = tw + pad * 2;
    const h = Math.ceil(size * 1.45) + pad * 2;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * textScale));
    c.height = Math.max(1, Math.ceil(h * textScale));
    const cg = c.getContext('2d')!;
    cg.scale(textScale, textScale);
    cg.font = f;
    cg.textAlign = 'left';
    cg.textBaseline = 'alphabetic';
    cg.lineWidth = lw;
    cg.strokeStyle = '#170f2e';
    cg.lineJoin = 'round';
    const by = pad + Math.ceil(size * 1.1);
    cg.strokeText(s, pad, by);
    cg.fillStyle = color;
    cg.fillText(s, pad, by);
    const ax = align === 'center' ? pad + tw / 2 : align === 'right' || align === 'end' ? pad + tw : pad;
    e = { c, w, h, ax, ay: by };
    if (textCache.size > 260) textCache.delete(textCache.keys().next().value as string);
    textCache.set(key, e);
  }
  g.drawImage(e.c, x - e.ax, y - e.ay, e.w, e.h);
}

export class Hud {
  banners: Banner[] = [];
  hint: { text: string; t: number } | null = null;
  time = 0;
  lowFlash = 0;
  showFps = false;
  fps = 60;
  hpShown = 100;
  bossShown = 1;
  private bossGrad: CanvasGradient | null = null;
  private bossGradX = 0;
  private bossGradW = 0;
  private bannerGrad: CanvasGradient | null = null;
  private bannerGradW = 0;
  /** vinheta vermelha de perigo (pouca vida / Nômad crítico): pré-desenhada por tamanho */
  private dangerVig: HTMLCanvasElement | null = null;
  private dangerW = 0;
  private dangerH = 0;
  private dangerBlue = -1;
  nomadShown = 1;
  safeL = 0;
  safeT = 0;
  safeR = 0;
  compact = false;

  banner(title: string, sub?: string, dur = 2.4) {
    this.banners.push({ title, sub, t: 0, dur });
    if (this.banners.length > 3) this.banners.shift();
  }
  setHint(text: string, dur = 4) {
    this.hint = { text, t: dur };
  }

  private warPulse = 0;
  private lastRemaining = -1;
  /** Contador "faltam N" no topo + setas vermelhas nas bordas apontando os inimigos fora da tela (estilo GTA). */
  private drawWarZone(g: CanvasRenderingContext2D, w: World, W: number, H: number, wz: NonNullable<ReturnType<World['director']['warZone']>>, T: number) {
    if (wz.remaining !== this.lastRemaining) {
      if (this.lastRemaining >= 0 && wz.remaining < this.lastRemaining) this.warPulse = 1;
      this.lastRemaining = wz.remaining;
    }
    this.warPulse = Math.max(0, this.warPulse - 1 / 30);
    // painel
    const cx = W / 2;
    const y = T + 32;
    const pw = 190;
    const blink = 0.55 + 0.45 * Math.sin(this.time * 5);
    pill(g, cx - pw / 2, y, pw, 30, 9, 'rgba(60,6,20,0.82)', `rgba(255,70,80,${0.5 + 0.4 * blink})`);
    text(g, 'ZONA DE GUERRA', cx - pw / 2 + 10, y + 12, 10, '#ff9a9a', 'left', DISPLAY, '400');
    numText(g, 'wave', (wz.wave << 8) | wz.waves, fmtWave, cx + pw / 2 - 10, y + 12, 10, '#ffd0d0', 'right', DISPLAY, '400');
    const s = 1 + this.warPulse * 0.35;
    g.save();
    g.translate(cx, y + 26);
    g.scale(s, s);
    numText(g, 'remaining', wz.remaining, fmtRemaining, 0, 0, 13, '#ffffff', 'center', DISPLAY, '400');
    g.restore();

    // setas vermelhas para inimigos fora da tela
    const cam = w.camera;
    const m = 26;
    const top = T + 72;
    const bottom = H - 22;
    const ccx = W / 2;
    const ccy = (top + bottom) / 2;
    for (const e of wz.enemies) {
      const sx = cam.wx(e.x);
      const sy = cam.wy(e.y - 10);
      if (sx > 0 && sx < W && sy > 0 && sy < H) continue; // visível: sem seta
      const dx = sx - ccx;
      const dy = sy - ccy;
      const hw = W / 2 - m;
      const hh = (bottom - top) / 2;
      const k = Math.min(Math.abs(hw / (dx || 1e-3)), Math.abs(hh / (dy || 1e-3)));
      const ax = ccx + dx * k;
      const ay = ccy + dy * k;
      const ang = Math.atan2(dy, dx);
      const dist = Math.hypot(e.x - w.player.x, e.y - w.player.y);
      const near = clamp(1 - dist / 900, 0.35, 1);
      const pulse = 1 + 0.18 * Math.sin(this.time * 8 + e.x * 0.01);
      const sz = (9 + near * 5) * pulse;
      g.save();
      g.translate(ax, ay);
      g.rotate(ang);
      g.globalAlpha = 0.55 + near * 0.45;
      // brilho
      g.fillStyle = 'rgba(255,40,60,0.25)';
      g.beginPath();
      g.arc(0, 0, sz * 1.5, 0, Math.PI * 2);
      g.fill();
      // seta
      g.fillStyle = '#ff2d3f';
      g.strokeStyle = '#2a0610';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(sz, 0);
      g.lineTo(-sz * 0.7, -sz * 0.75);
      g.lineTo(-sz * 0.3, 0);
      g.lineTo(-sz * 0.7, sz * 0.75);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    }
    g.globalAlpha = 1;
  }

  update(dt: number) {
    this.time += dt;
    for (let i = this.banners.length - 1; i >= 0; i--) {
      const b = this.banners[i];
      b.t += dt;
      if (b.t >= b.dur) this.banners.splice(i, 1);
    }
    if (this.hint) {
      this.hint.t -= dt;
      if (this.hint.t <= 0) this.hint = null;
    }
  }

  draw(g: CanvasRenderingContext2D, w: World, W: number, H: number) {
    resetTextBudget();
    const art = getArt();
    const p = w.player;
    const L = 14 + this.safeL;
    const T = 10 + this.safeT;
    const R = W - 14 - this.safeR;
    g.save();
    g.lineJoin = 'round';

    // ------------------------------------------------ retrato + vida
    const pr = art.karimbo.heads.portrait;
    const shake = p.invuln > 0.9 ? Math.sin(this.time * 90) * 1.2 : 0;
    drawSpr(g, pr, L + 26 + shake, T + 28, {});
    text(g, 'KARIMBO', L + 26, T + 64, 10, '#ffffff', 'center', DISPLAY, '400');
    // vidas (3 mini-retratos): as apagadas já foram gastas
    const nLives = Math.max(MAX_LIVES, w.lives);
    for (let i = 0; i < nLives; i++) {
      const on = i < w.lives;
      g.globalAlpha = on ? 1 : 0.22;
      drawSpr(g, pr, L + 68 + i * 19, T + 62, { sx: 0.32, sy: 0.32 });
    }
    g.globalAlpha = 1;
    // barra de vida (5 segmentos de 20)
    this.hpShown += (p.hp - this.hpShown) * 0.2;
    const bx = L + 60;
    const by = T + 7;
    for (let i = 0; i < 5; i++) {
      const sx = bx + i * 19;
      const seg = p.maxHp / 5;
      const segHp = clamp(p.hp - i * seg, 0, seg) / seg;
      const segShown = clamp(this.hpShown - i * seg, 0, seg) / seg;
      pill(g, sx, by, 17, 10, 3, 'rgba(23,15,46,0.85)', '#170f2e');
      if (segShown > segHp) {
        pill(g, sx + 1, by + 1, Math.max(0, 15 * segShown), 8, 2.4, '#ffffff');
      }
      if (segHp > 0) {
        const low = p.hp <= p.maxHp * 0.25;
        const col = low && Math.floor(this.time * 6) % 2 === 0 ? '#ff5a5a' : '#ff3f7a';
        pill(g, sx + 1, by + 1, 15 * segHp, 8, 2.4, col);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(sx + 2, by + 2, 15 * segHp - 2, 2);
      }
    }
    // arma + munição + granadas
    const wp = art.karimbo.weapons[p.cur];
    const def = WEAPONS[p.cur];
    pill(g, bx, by + 14, 96, 22, 6, 'rgba(23,15,46,0.7)', 'rgba(255,255,255,0.15)');
    const s = Math.min(1, 26 / wp.w);
    g.save();
    g.translate(bx + 5, by + 25);
    g.scale(s, s);
    g.drawImage(wp.c, -wp.ox, -wp.oy, wp.w, wp.h);
    g.restore();
    const ammo = p.weapons.get(p.cur) ?? 0;
    numText(g, 'ammo', ammo, fmtAmmo, bx + 92, by + 31.5, 14, ammo !== Infinity && ammo < 10 ? '#ff8a8a' : '#ffffff', 'right');
    // granadas
    for (let i = 0; i < p.maxGrenades; i++) {
      const gx = bx + 4 + i * 8;
      const on = i < p.grenades;
      g.fillStyle = on ? '#8fd070' : 'rgba(255,255,255,0.15)';
      g.beginPath();
      g.arc(gx + 3, by + 44, 3, 0, 6.283);
      g.fill();
      if (on) {
        g.fillStyle = '#ffd23a';
        g.fillRect(gx, by + 43, 6, 1.2);
      }
    }
    void def;

    // ------------------------------------------------ Nômad
    if (p.nomad) {
      const n = p.nomad;
      this.nomadShown += (n.hp - this.nomadShown) * 0.2;
      const ny = T + 74;
      pill(g, L, ny, 172, 30, 8, 'rgba(23,15,46,0.78)', 'rgba(255,255,255,0.2)');
      text(g, 'NÔMAD', L + 8, ny + 12, 11, '#ffe27a', 'left', DISPLAY, '400');
      const w0 = 156;
      const f = clamp(n.hp / n.maxHp, 0, 1);
      const fs = clamp(this.nomadShown / n.maxHp, 0, 1);
      pill(g, L + 8, ny + 16, w0, 9, 3, '#0e0a22');
      if (fs > f) pill(g, L + 9, ny + 17, (w0 - 2) * fs, 7, 2.4, '#ffffff');
      const low = f < 0.25;
      const col = low ? (Math.floor(this.time * 8) % 2 ? '#ff4a4a' : '#ff9a3a') : f < 0.5 ? '#ffb83a' : '#8fe05a';
      if (f > 0) pill(g, L + 9, ny + 17, (w0 - 2) * f, 7, 2.4, col);
      if (n.timeLeft !== Infinity) {
        const tf = clamp(n.timeLeft / n.maxTime, 0, 1);
        const blink = n.timeLeft < 8 && Math.floor(this.time * 6) % 2 === 0;
        pill(g, L + 8, ny + 27, w0, 4, 2, '#0e0a22');
        if (tf > 0) pill(g, L + 9, ny + 27.5, (w0 - 2) * tf, 3, 1.5, blink ? '#ff5a5a' : '#7ff9ff');
        numText(g, 'support', Math.ceil(n.timeLeft), fmtSupport, L + 8 + w0, ny + 12, 10, blink ? '#ff8a8a' : '#7ff9ff', 'right', DISPLAY, '400');
      }
      // ícone do avanço + anel sutil da janela de 5 s
      const ix = L + 176 + 12;
      const iy = ny + 15;
      const ready = n.dashKind === 0 || (n.cooldown <= 0 && n.window <= 0);
      g.beginPath();
      g.arc(ix, iy, 11, 0, 6.283);
      g.fillStyle = ready ? 'rgba(60,240,255,0.32)' : 'rgba(23,15,46,0.7)';
      g.fill();
      g.strokeStyle = ready ? '#7ff9ff' : 'rgba(255,255,255,0.3)';
      g.lineWidth = 1.6;
      g.stroke();
      g.fillStyle = ready ? '#ffffff' : 'rgba(255,255,255,0.4)';
      g.beginPath();
      g.moveTo(ix + 1, iy - 6.5);
      g.lineTo(ix - 4.5, iy + 1);
      g.lineTo(ix - 0.5, iy + 1);
      g.lineTo(ix - 2, iy + 6.5);
      g.lineTo(ix + 4.5, iy - 1.5);
      g.lineTo(ix + 0.5, iy - 1.5);
      g.closePath();
      g.fill();
      if (n.window > 0 && n.hintShown) {
        // indicação sutil: só aparece após algumas tentativas sem descobrir o segundo avanço
        g.strokeStyle = '#ffb060';
        g.globalAlpha = 0.55 + 0.35 * Math.sin(this.time * 7);
        g.lineWidth = 2;
        g.beginPath();
        g.arc(ix, iy, 14.5, -Math.PI / 2, -Math.PI / 2 + (n.window / 5) * Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      }
    }

    // ------------------------------------------------ zona de guerra: contador + setas
    const wz = w.director.warZone();
    if (wz) {
      this.drawWarZone(g, w, W, H, wz, T);
    }

    // ------------------------------------------------ topo central: coletáveis
    const cx = W / 2;
    const cw = 158;
    pill(g, cx - cw / 2, T, cw, 26, 8, 'rgba(23,15,46,0.72)', 'rgba(255,255,255,0.16)');
    drawSpr(g, art.pickups.token, cx - cw / 2 + 14, T + 13, { sx: 0.85, sy: 0.85 });
    numText(g, 'tokens', w.tokens, fmtInt, cx - cw / 2 + 26, T + 19, 15, '#ffe27a');
    drawSpr(g, art.pickups.emblem, cx + 2, T + 13, { sx: 0.55, sy: 0.55 });
    numText(g, 'emblems', w.emblems.size, fmtEmblems, cx + 14, T + 19, 15, '#ffffff');
    for (let i = 0; i < 3; i++) {
      const got = w.secrets.has(i);
      g.globalAlpha = got ? 1 : 0.28;
      drawSpr(g, art.pickups.secret, cx + 62 + i * 13, T + 13, { sx: 0.34, sy: 0.34 });
    }
    g.globalAlpha = 1;
    // pontuação e tempo (lado direito, abaixo do botão de pausa)
    numText(g, 'score', w.score, fmtScore, R - 44, T + 16, 15, '#ffffff', 'right');
    numText(g, 'time', Math.floor(w.time), formatTime, R - 44, T + 31, 12, '#cfc6ee', 'right');
    // combo
    if (w.combo >= 2 && w.comboT > 0) {
      const m = comboMult(w.combo);
      const pop = 1 + Math.max(0, w.comboT - (COMBO_WINDOW - 0.18)) * 3;
      const cx0 = R - 44;
      const cy0 = T + 58;
      g.save();
      g.translate(cx0, cy0);
      g.scale(pop, pop);
      numText(g, 'combo', w.combo, fmtCombo, 0, 0, 15, m >= 4 ? '#ff5ab4' : m >= 3 ? '#ffb83a' : '#ffe27a', 'right', DISPLAY, '400');
      if (m > 1) numText(g, 'mult', m, fmtMult, 0, 15, 12, '#ffffff', 'right', DISPLAY, '400');
      g.restore();
      const bw = 64;
      pill(g, cx0 - bw, cy0 + 20, bw, 4, 2, 'rgba(23,15,46,0.7)');
      pill(g, cx0 - bw, cy0 + 20, bw * clamp(w.comboT / COMBO_WINDOW, 0, 1), 4, 2, '#ffe27a');
    }

    // ------------------------------------------------ Chefe
    const boss = w.director.bossRef as Felipao | null;
    if (boss && (boss.alive || boss.dyingT > 0) && w.director.bossActive) {
      const bw = Math.max(150, Math.min(420, W - 2 * 205));
      const bx2 = cx - bw / 2;
      const byy = T + 34;
      this.bossShown += (boss.hp / boss.maxHp - this.bossShown) * 0.12;
      pill(g, bx2 - 6, byy - 4, bw + 12, 34, 10, 'rgba(23,15,46,0.82)', 'rgba(255,255,255,0.25)');
      text(g, 'FELIPÃO', bx2 + 4, byy + 12, 13, '#ff9ad0', 'left', DISPLAY, '400');
      const ph = boss.phase;
      text(g, `FASE ${ph}`, bx2 + bw - 4, byy + 12, 10, '#cfc6ee', 'right');
      pill(g, bx2, byy + 16, bw, 11, 4, '#0e0a22');
      const f = clamp(boss.hp / boss.maxHp, 0, 1);
      const fs = clamp(this.bossShown, 0, 1);
      if (fs > f) pill(g, bx2 + 1, byy + 17, (bw - 2) * fs, 9, 3, '#ffffff');
      if (!this.bossGrad || this.bossGradX !== bx2 || this.bossGradW !== bw) {
        const grd = g.createLinearGradient(bx2, 0, bx2 + bw, 0);
        grd.addColorStop(0, '#ff3f7a');
        grd.addColorStop(1, '#ffb83a');
        this.bossGrad = grd;
        this.bossGradX = bx2;
        this.bossGradW = bw;
      }
      if (f > 0) pill(g, bx2 + 1, byy + 17, (bw - 2) * f, 9, 3, this.bossGrad);
      // marcas das fases (66% / 33%)
      g.fillStyle = '#170f2e';
      g.fillRect(bx2 + bw * 0.66 - 1, byy + 16, 2, 11);
      g.fillRect(bx2 + bw * 0.33 - 1, byy + 16, 2, 11);
    }

    // ------------------------------------------------ banners
    let by2 = H * 0.34;
    for (const b of this.banners) {
      const t = b.t;
      const inT = clamp(t / 0.4, 0, 1);
      const outT = clamp((b.dur - t) / 0.4, 0, 1);
      const a = Math.min(inT, outT);
      const sc = easeOutBack(inT);
      g.save();
      g.globalAlpha = a;
      g.translate(cx, by2);
      g.scale(0.7 + 0.3 * sc, 0.7 + 0.3 * sc);
      // faixa
      const wid = Math.min(W - 40, 360);
      if (!this.bannerGrad || this.bannerGradW !== wid) {
        const grd = g.createLinearGradient(-wid / 2, 0, wid / 2, 0);
        grd.addColorStop(0, 'rgba(23,15,46,0)');
        grd.addColorStop(0.2, 'rgba(23,15,46,0.78)');
        grd.addColorStop(0.8, 'rgba(23,15,46,0.78)');
        grd.addColorStop(1, 'rgba(23,15,46,0)');
        this.bannerGrad = grd;
        this.bannerGradW = wid;
      }
      g.fillStyle = this.bannerGrad;
      g.fillRect(-wid / 2, -22, wid, b.sub ? 52 : 38);
      g.fillStyle = '#ffb83a';
      g.fillRect(-wid * 0.32, -22, wid * 0.64, 2);
      text(g, b.title, 0, 6, 26, '#ffffff', 'center', DISPLAY, '400');
      if (b.sub) text(g, b.sub, 0, 24, 12.5, '#ffd9a0', 'center', UI, '700');
      g.restore();
      by2 += 56;
    }

    // ------------------------------------------------ dica de controle
    if (this.hint) {
      const a = clamp(this.hint.t / 0.5, 0, 1) * clamp((4 - this.hint.t) / 0.3 + 0.2, 0, 1);
      g.globalAlpha = Math.min(1, a);
      const tw = Math.min(W - 60, 30 + this.hint.text.length * 6.6);
      pill(g, cx - tw / 2, H - 62 - this.safeT * 0, tw, 26, 10, 'rgba(23,15,46,0.78)', 'rgba(255,255,255,0.25)');
      text(g, this.hint.text, cx, H - 44, 13, '#ffffff', 'center');
      g.globalAlpha = 1;
    }

    // ------------------------------------------------ FPS
    if (this.showFps) numText(g, 'fps', Math.round(this.fps), fmtFps, R - 4, H - 8, 10, '#9dfcff', 'right');
    g.restore();
  }

  /**
   * Vinheta vermelha (mesmo gradiente radial de antes), pré-desenhada uma vez por tamanho e
   * desenhada com transparência — antes era um gradiente de tela cheia criado a cada quadro.
   */
  private drawDanger(g: CanvasRenderingContext2D, W: number, H: number, alpha: number, r0: number, r1: number, blue: number) {
    if (alpha <= 0.003) return;
    if (!this.dangerVig || this.dangerW !== W || this.dangerH !== H || this.dangerBlue !== blue) {
      const c = this.dangerVig ?? document.createElement('canvas');
      // metade da resolução lógica: é um degradê suave (escalado fica idêntico)
      c.width = Math.ceil(W / 2);
      c.height = Math.ceil(H / 2);
      const cg = c.getContext('2d')!;
      cg.setTransform(0.5, 0, 0, 0.5, 0, 0);
      cg.clearRect(0, 0, W, H);
      const gr = cg.createRadialGradient(W / 2, H / 2, H * r0, W / 2, H / 2, H * r1);
      gr.addColorStop(0, `rgba(255,40,${blue},0)`);
      gr.addColorStop(1, `rgba(255,40,${blue},1)`);
      cg.fillStyle = gr;
      cg.fillRect(0, 0, W, H);
      this.dangerVig = c;
      this.dangerW = W;
      this.dangerH = H;
      this.dangerBlue = blue;
    }
    const prev = g.globalAlpha;
    g.globalAlpha = prev * Math.min(1, alpha);
    g.drawImage(this.dangerVig, 0, 0, W, H);
    g.globalAlpha = prev;
  }

  /** Efeitos de tela: alarme do Nômad, pouca vida, velocidade. */
  drawScreenFx(g: CanvasRenderingContext2D, w: World, W: number, H: number) {
    const p = w.player;
    // alarme vermelho pulsando (Nômad quase destruído)
    if (p.nomad && p.nomad.hp / p.nomad.maxHp < 0.25) {
      const a = 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(this.time * 8));
      this.drawDanger(g, W, H, a * 2.2, 0.3, 0.9, 40);
      text(g, '⚠ NÔMAD CRÍTICO', W / 2, H - 26, 13, Math.floor(this.time * 6) % 2 ? '#ff6a6a' : '#ffd0d0', 'center');
    } else if (!p.nomad && p.hp <= 30 && p.mode !== 'dead') {
      const a = 0.1 + 0.08 * Math.sin(this.time * 6);
      this.drawDanger(g, W, H, a * 2.4, 0.35, 0.95, 80);
    }
    // linhas de velocidade no avanço
    if (w.speedLines > 0) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = 'rgba(255,255,255,0.22)';
      g.lineWidth = 1.4;
      const dir = p.facing;
      for (let i = 0; i < 14; i++) {
        const y = ((i * 97.3 + this.time * 500) % H);
        const len = 40 + ((i * 53) % 90);
        const x = ((i * 191 + this.time * 900 * dir * -1) % (W + 200));
        const xx = dir === 1 ? W - (((x % (W + 200)) + (W + 200)) % (W + 200)) : ((x % (W + 200)) + (W + 200)) % (W + 200);
        g.beginPath();
        g.moveTo(xx, y);
        g.lineTo(xx - dir * len, y);
        g.stroke();
      }
      g.restore();
    }
    // flash de tela
    if (w.fx.flash > 0.01) {
      g.globalAlpha = clamp(w.fx.flash, 0, 1);
      g.fillStyle = w.fx.flashColor;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
  }
}
