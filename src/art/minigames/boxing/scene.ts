/**
 * Cena do boxe: fundo da praça assado uma vez (retrato borrado do mundo + piso + corda), crianças em
 * elipse, jacaré de frente, Karimbo de costas ocupando ~40% da parte de baixo, efeitos, HUD e as
 * cinemáticas (ORELHADA, contagem do nocaute e derrota). A simulação vive em game/minigames/boxing/sim.
 */
import { makeCanvas } from '../../kit';
import { getArt } from '../../index';
import { progress } from '../../../core/storage';
import { drawAlligatorKO } from '../../alligatorKO';
import type { BoxingMatch, MatchEvent } from '../../../game/minigames/boxing/sim/match';
import { ORELHADA_TIME, COUNT_TIME } from '../../../game/minigames/boxing/sim/rules';
import type { Crowd } from '../../../game/minigames/boxing/sim/crowd';
import { drawKarimboBack, backPoseOf } from './karimboBack';
import { drawGatorFront, type GatorPose } from './gatorFront';
import { drawKidsBack, drawKidsFront, drawShouts } from './kids';
import { drawBoxHud } from './hud';
import { BoxFx, txt } from './fx';

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export class BoxingScene {
  readonly fx = new BoxFx();
  private bg: HTMLCanvasElement | null = null;
  private W = 0;
  private H = 0;
  private lastAttack: GatorPose['lastAttack'] = null;
  private sinceImpact = 9;
  private time = 0;
  private hand: -1 | 1 = 1;
  private lastCount = 0;

  constructor(private backdrop: HTMLCanvasElement | null, W: number, H: number) { this.resize(W, H); }

  /** Refaz o fundo no novo tamanho (girar o aparelho, mudar a janela). */
  resize(W: number, H: number) {
    this.W = W; this.H = H;
    const k = 2;
    const c = makeCanvas(W * k, H * k), g = c.getContext('2d')!;
    g.scale(k, k);
    if (this.backdrop) {
      g.imageSmoothingEnabled = true;
      g.drawImage(this.backdrop, 0, 0, W, H);
    } else {
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#3a2a6a'); sky.addColorStop(1, '#171033');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
    }
    g.fillStyle = 'rgba(10,6,30,.52)'; g.fillRect(0, 0, W, H);
    // piso do ringue (elipse de terra batida) com cordas
    const fy = H * 0.64;
    const fl = g.createRadialGradient(W / 2, fy, 10, W / 2, fy, W * 0.5);
    fl.addColorStop(0, '#9a7a4e'); fl.addColorStop(0.7, '#6c5336'); fl.addColorStop(1, 'rgba(40,28,20,0)');
    g.fillStyle = fl;
    g.beginPath(); g.ellipse(W / 2, fy, W * 0.52, H * 0.24, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,230,160,.55)'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(W / 2, fy, W * 0.43, H * 0.19, 0, 0, Math.PI * 2); g.stroke();
    // holofote em cima do jacaré
    const sp = g.createRadialGradient(W / 2, H * 0.3, 10, W / 2, H * 0.5, W * 0.45);
    sp.addColorStop(0, 'rgba(255,240,200,.22)'); sp.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = sp; g.fillRect(0, 0, W, H);
    // vinheta
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    this.bg = c;
  }

  /** Eventos da simulação viram efeitos (o som e a torcida ficam na sessão). */
  handle(e: MatchEvent, m: BoxingMatch) {
    const W = this.W, H = this.H, u = H / 360;
    const gx = W / 2, gy = H * 0.44;
    switch (e.type) {
      case 'hit':
        this.fx.burst(gx + (Math.random() - 0.5) * 40 * u, gy + (Math.random() - 0.5) * 30 * u, 8, 0, '#ffe27a', 230 * u, 2.4 * u);
        this.fx.pop(e.punch && e.punch.startsWith('gancho') ? 'POW!' : e.punch === 'jab' ? 'tap' : 'PAF!', gx + (Math.random() - 0.5) * 60 * u, gy - 20 * u, '#ffe27a', 22 * u, 0.7);
        this.fx.addShake((e.amount ?? 0) >= 14 ? 3 * u : 1.4 * u, 0.15);
        break;
      case 'counter': this.fx.pop('CONTRA-ATAQUE!', gx, H * 0.2, '#7ff9ff', 20 * u, 1.1); break;
      case 'perfect': this.fx.pop('ESQUIVA PERFEITA!', W / 2, H * 0.3, '#7ff9ff', 22 * u, 1.3); this.fx.addFlash(0.15, '#7ff9ff'); break;
      case 'combo': this.fx.pop(`COMBO x${e.n ?? 1}!`, W / 2, H * 0.26, '#ffe27a', 24 * u, 1.1); this.fx.burst(W / 2, H * 0.45, 12, 1, '#ffd23a', 260 * u, 3 * u, 300); break;
      case 'gatorAttack': this.lastAttack = e.attack ?? null; this.hand = this.hand === 1 ? -1 : 1; this.sinceImpact = -9; break;
      case 'gatorMiss': this.sinceImpact = 0; this.fx.pop('UUU!', gx, gy - 30 * u, '#ffffff', 18 * u, 0.7); break;
      case 'gatorHit':
        this.sinceImpact = 0;
        this.fx.addShake(e.attack === 'mordidona' ? 7 * u : 4 * u, 0.28);
        this.fx.addFlash(0.28, '#ff3a3a');
        this.fx.pop(e.attack === 'mordidona' ? 'CHOMP!' : e.attack === 'rabada' ? 'VUUM!' : 'POW!', W / 2, H * 0.62, '#ff9a8a', 26 * u, 0.9);
        this.fx.burst(W / 2, H * 0.7, 10, 0, '#ff6a5a', 240 * u, 3 * u);
        break;
      case 'block': this.fx.pop('TOC', W / 2, H * 0.55, '#bfe8ff', 14 * u, 0.5); break;
      case 'dizzy': this.fx.pop('TONTO!', gx, gy - 56 * u, '#ffd23a', 20 * u, 1.1); this.fx.burst(gx, gy - 50 * u, 6, 1, '#ffd23a', 120 * u, 3 * u, 80); break;
      case 'groggy': this.fx.pop('GROGUE!', gx, gy - 56 * u, '#ff9a3a', 26 * u, 1.4); this.fx.addShake(3 * u, 0.3); break;
      case 'phase': this.fx.pop(e.n === 3 ? 'AGORA EU FIQUEI BRAVO!' : 'ELE ESQUENTOU!', W / 2, H * 0.22, '#ff7a5a', 18 * u, 1.6); this.fx.addShake(3 * u, 0.3); break;
      case 'taunt': this.fx.pop('Dança comigo, Parabólica!', gx, gy - 70 * u, '#ffffff', 11 * u, 1.5); break;
      case 'orelhada': this.fx.addFlash(0.2, '#ffffff'); break;
      case 'impact': this.fx.addFlash(1, '#ffffff'); this.fx.addShake(10 * u, 0.5); this.fx.lines = 1; this.fx.burst(gx, gy, 20, 3, '#fbf6e4', 420 * u, 3 * u, 700); this.fx.burst(gx, gy, 24, 1, '#ffd23a', 380 * u, 3.4 * u, 300); break;
      case 'win': this.fx.burst(W / 2, H * 0.3, 40, 2, '#7bd05a', 320 * u, 3 * u, 200); break;
      case 'count': if ((e.n ?? 0) !== this.lastCount) { this.lastCount = e.n ?? 0; this.fx.addShake(1.2 * u, 0.1); } break;
      case 'lose': this.fx.addShake(6 * u, 0.4); this.fx.pop('HAHAHA, ORELHUDO!', W / 2, H * 0.28, '#ff9a8a', 20 * u, 1.8); break;
      default: break;
    }
    void m;
  }

  update(dt: number) {
    this.time += dt;
    this.sinceImpact += dt;
    this.fx.update(dt);
  }

  draw(g: CanvasRenderingContext2D, m: BoxingMatch, crowd: Crowd, W: number, H: number, k: number) {
    if (W !== this.W || H !== this.H) this.resize(W, H);
    const art = getArt();
    const u = H / 360, t = this.time;
    g.save();
    g.translate(this.fx.sx, this.fx.sy);
    if (this.bg) g.drawImage(this.bg, -8, -8, W + 16, H + 16);
    drawKidsBack(g, crowd, W, H, t);
    // ---- jacaré
    const gp: GatorPose = {
      mode: m.g.mode, guard: m.g.guard, attack: m.g.attack, tele01: m.g.mode === 'tele' ? 1 - m.g.tele / Math.max(1e-6, m.g.teleMax) : 0,
      since: m.g.mode === 'tele' ? 9 : this.sinceImpact, hand: this.hand, phase: m.g.phase, flinch: Math.max(0, m.g.flinchT / 0.12), time: t, lastAttack: this.lastAttack,
    };
    const gs = u * 0.92, gx = W / 2, gy = H * 0.66;
    const cin = m.cine;
    if (cin === 'orelhada' && m.cineT >= 1.6) {
      // lançado pelo ar: gira, voa para trás e cai
      const L = clamp01((m.cineT - 1.6) / (ORELHADA_TIME - 1.6));
      g.save();
      g.translate(gx + 240 * L * u, gy - 120 * u * Math.sin(L * Math.PI) - 40 * u * L);
      g.rotate(L * 9);
      drawGatorFront(g, 0, 0, gs * (1 - 0.3 * L), { ...gp, mode: 'groggy' });
      g.restore();
    } else if (cin === 'count' || m.g.mode === 'ko') {
      drawAlligatorKO(g, gx, gy + 6 * u, t, -1);
    } else drawGatorFront(g, gx, gy, gs, gp);
    // ---- Karimbo de costas (embaixo, ~40% da altura)
    const fall = cin === 'lose' ? ease(clamp01(m.cineT / 0.7)) : 0;
    const spin = cin === 'orelhada' ? ease(clamp01(m.cineT / 1.6)) * Math.PI * 2 : 0;
    const ears = cin === 'orelhada' ? 1 + 2.4 * ease(clamp01(m.cineT / 1.5)) : 1;
    const pose = backPoseOf(m.k, t, { spin, ears, fall });
    drawKarimboBack(g, art.karimbo, progress.equippedSkin, W / 2, H * 0.72, u * 0.62, pose);
    drawKidsFront(g, crowd, W, H, t);
    drawShouts(g, crowd, W, H);
    this.fx.draw(g);
    g.restore();
    drawBoxHud(g, m, W, H, t, k);
    this.drawCine(g, m, W, H);
    this.fx.drawOverlay(g, W, H);
  }

  private drawCine(g: CanvasRenderingContext2D, m: BoxingMatch, W: number, H: number) {
    const u = H / 360, t = m.cineT;
    if (m.cine === 'orelhada') {
      if (t < 1.6) txt(g, 'ORELHADA!', W / 2, H * 0.2, 24 * u * (0.9 + 0.1 * Math.sin(this.time * 18)), '#ffe27a', 'center', Math.min(1, t * 3));
      else {
        // quadro de impacto de HQ: letreiro enorme com retícula
        const k = clamp01((t - 1.6) / 0.25);
        g.save();
        g.globalAlpha = 0.9 * (1 - clamp01((t - 2.1) / 0.3));
        g.fillStyle = '#ffd23a';
        g.translate(W / 2, H * 0.42);
        g.rotate(-0.08);
        g.beginPath();
        for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r = (i % 2 ? 0.62 : 1) * W * 0.42 * ease(k); g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.7); }
        g.closePath(); g.fill();
        g.restore();
        txt(g, 'ORELHADA!!', W / 2, H * 0.47, 54 * u, '#e8262e', 'center', 1 - clamp01((t - 2.2) / 0.2), 0.6 + 0.6 * ease(k), -0.08);
      }
    } else if (m.cine === 'count') {
      const n = Math.min(10, Math.floor(t / (COUNT_TIME / 10)) + 1);
      if (t < COUNT_TIME) txt(g, `${n}...`, W / 2, H * 0.3, 40 * u, '#ffffff', 'center', 1, 1 + (1 - ((t / (COUNT_TIME / 10)) % 1)) * 0.35);
      else txt(g, 'NOCAUTE!', W / 2, H * 0.34, 54 * u, '#ffd23a', 'center', 1, 1 + Math.sin(this.time * 12) * 0.04);
    } else if (m.cine === 'lose') {
      txt(g, 'Volta pro berçário, Parabólica!', W / 2, H * 0.42, 14 * u, '#fff1cd', 'center', clamp01(t / 0.4));
      txt(g, 'Essa orelha apanha mais que bandeira em dia de vento!', W / 2, H * 0.42 + 18 * u, 12 * u, '#fff1cd', 'center', clamp01((t - 0.3) / 0.4));
    }
  }
}
