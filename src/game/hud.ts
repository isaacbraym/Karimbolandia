import type { World } from './world';
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

function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'left', font = UI, weight = '700') {
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  g.lineWidth = Math.max(2, size * 0.24);
  g.strokeStyle = '#170f2e';
  g.lineJoin = 'round';
  g.strokeText(s, x, y);
  g.fillStyle = color;
  g.fillText(s, x, y);
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

  update(dt: number) {
    this.time += dt;
    for (const b of this.banners) b.t += dt;
    this.banners = this.banners.filter((b) => b.t < b.dur);
    if (this.hint) {
      this.hint.t -= dt;
      if (this.hint.t <= 0) this.hint = null;
    }
  }

  draw(g: CanvasRenderingContext2D, w: World, W: number, H: number) {
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
    drawSpr(g, pr, L + 24 + shake, T + 26, {});
    // barra de vida (5 segmentos de 20)
    this.hpShown += (p.hp - this.hpShown) * 0.2;
    const bx = L + 54;
    const by = T + 7;
    for (let i = 0; i < 5; i++) {
      const sx = bx + i * 22;
      const segHp = clamp(p.hp - i * 20, 0, 20) / 20;
      const segShown = clamp(this.hpShown - i * 20, 0, 20) / 20;
      pill(g, sx, by, 20, 10, 3, 'rgba(23,15,46,0.85)', '#170f2e');
      if (segShown > segHp) {
        pill(g, sx + 1, by + 1, Math.max(0, 18 * segShown), 8, 2.4, '#ffffff');
      }
      if (segHp > 0) {
        const low = p.hp <= 30;
        const col = low && Math.floor(this.time * 6) % 2 === 0 ? '#ff5a5a' : '#ff3f7a';
        pill(g, sx + 1, by + 1, 18 * segHp, 8, 2.4, col);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(sx + 2, by + 2, 18 * segHp - 2, 2);
      }
    }
    // arma + munição + granadas
    const wp = art.karimbo.weapons[p.cur];
    const def = WEAPONS[p.cur];
    pill(g, bx, by + 14, 108, 22, 6, 'rgba(23,15,46,0.7)', 'rgba(255,255,255,0.15)');
    const s = Math.min(1, 26 / wp.w);
    g.save();
    g.translate(bx + 5, by + 25);
    g.scale(s, s);
    g.drawImage(wp.c, -wp.ox, -wp.oy, wp.w, wp.h);
    g.restore();
    const ammo = p.weapons.get(p.cur) ?? 0;
    text(g, ammo === Infinity ? '∞' : String(ammo), bx + 104, by + 31.5, 14, ammo !== Infinity && ammo < 10 ? '#ff8a8a' : '#ffffff', 'right');
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
      const ny = T + 62;
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

    // ------------------------------------------------ topo central: coletáveis
    const cx = W / 2;
    const cw = 158;
    pill(g, cx - cw / 2, T, cw, 26, 8, 'rgba(23,15,46,0.72)', 'rgba(255,255,255,0.16)');
    drawSpr(g, art.pickups.token, cx - cw / 2 + 14, T + 13, { sx: 0.85, sy: 0.85 });
    text(g, String(w.tokens), cx - cw / 2 + 26, T + 19, 15, '#ffe27a');
    drawSpr(g, art.pickups.emblem, cx + 2, T + 13, { sx: 0.55, sy: 0.55 });
    text(g, `${w.emblems.size} / 10`, cx + 14, T + 19, 15, '#ffffff');
    for (let i = 0; i < 3; i++) {
      const got = w.secrets.has(i);
      g.globalAlpha = got ? 1 : 0.28;
      drawSpr(g, art.pickups.secret, cx + 62 + i * 13, T + 13, { sx: 0.34, sy: 0.34 });
    }
    g.globalAlpha = 1;
    // pontuação e tempo (lado direito, abaixo do botão de pausa)
    text(g, String(w.score).padStart(7, '0'), R - 44, T + 16, 15, '#ffffff', 'right');
    text(g, formatTime(w.time), R - 44, T + 31, 12, '#cfc6ee', 'right');

    // ------------------------------------------------ Chefe
    const boss = w.director.bossRef as Felipao | null;
    if (boss && (boss.alive || boss.dyingT > 0) && w.director.bossActive) {
      const bw = Math.min(420, W - 160);
      const bx2 = cx - bw / 2;
      const byy = T + 36;
      this.bossShown += (boss.hp / boss.maxHp - this.bossShown) * 0.12;
      pill(g, bx2 - 6, byy - 4, bw + 12, 34, 10, 'rgba(23,15,46,0.82)', 'rgba(255,255,255,0.25)');
      text(g, 'FELIPÃO', bx2 + 4, byy + 12, 13, '#ff9ad0', 'left', DISPLAY, '400');
      const ph = boss.phase;
      text(g, `FASE ${ph}`, bx2 + bw - 4, byy + 12, 10, '#cfc6ee', 'right');
      pill(g, bx2, byy + 16, bw, 11, 4, '#0e0a22');
      const f = clamp(boss.hp / boss.maxHp, 0, 1);
      const fs = clamp(this.bossShown, 0, 1);
      if (fs > f) pill(g, bx2 + 1, byy + 17, (bw - 2) * fs, 9, 3, '#ffffff');
      const grd = g.createLinearGradient(bx2, 0, bx2 + bw, 0);
      grd.addColorStop(0, '#ff3f7a');
      grd.addColorStop(1, '#ffb83a');
      if (f > 0) pill(g, bx2 + 1, byy + 17, (bw - 2) * f, 9, 3, grd);
      // marcas das fases (66% / 33%)
      g.fillStyle = '#170f2e';
      g.fillRect(bx2 + bw * 0.66 - 1, byy + 16, 2, 11);
      g.fillRect(bx2 + bw * 0.33 - 1, byy + 16, 2, 11);
    }

    // ------------------------------------------------ banners
    let by2 = H * 0.28;
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
      const grd = g.createLinearGradient(-wid / 2, 0, wid / 2, 0);
      grd.addColorStop(0, 'rgba(23,15,46,0)');
      grd.addColorStop(0.2, 'rgba(23,15,46,0.78)');
      grd.addColorStop(0.8, 'rgba(23,15,46,0.78)');
      grd.addColorStop(1, 'rgba(23,15,46,0)');
      g.fillStyle = grd;
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
    if (this.showFps) text(g, `${Math.round(this.fps)} FPS`, R - 4, H - 8, 10, '#9dfcff', 'right');
    g.restore();
  }

  /** Efeitos de tela: alarme do Nômad, pouca vida, velocidade. */
  drawScreenFx(g: CanvasRenderingContext2D, w: World, W: number, H: number) {
    const p = w.player;
    // alarme vermelho pulsando (Nômad quase destruído)
    if (p.nomad && p.nomad.hp / p.nomad.maxHp < 0.25) {
      const a = 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(this.time * 8));
      const gr = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
      gr.addColorStop(0, 'rgba(255,40,40,0)');
      gr.addColorStop(1, `rgba(255,40,40,${a * 2.2})`);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      text(g, '⚠ NÔMAD CRÍTICO', W / 2, H - 26, 13, Math.floor(this.time * 6) % 2 ? '#ff6a6a' : '#ffd0d0', 'center');
    } else if (!p.nomad && p.hp <= 30 && p.mode !== 'dead') {
      const a = 0.1 + 0.08 * Math.sin(this.time * 6);
      const gr = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
      gr.addColorStop(0, 'rgba(255,40,80,0)');
      gr.addColorStop(1, `rgba(255,40,80,${a * 2.4})`);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
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
