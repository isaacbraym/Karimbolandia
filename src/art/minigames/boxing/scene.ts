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
import { ORELHADA_TIME, COUNT_TIME, PUNCHES } from '../../../game/minigames/boxing/sim/rules';
import type { Crowd } from '../../../game/minigames/boxing/sim/crowd';
import { drawKarimboBack, backPoseOf } from './karimboBack';
import { drawGatorBoxer, type GatorPose } from './gatorBoxer';
import { drawKids, drawShouts } from './kids';
import { boxLayout, type BoxLayout } from './layout';
import { drawRingArt, drawRingLive } from './ring';
import { drawBoxHud, drawResultCard, type ResultView } from './hud';
import { BoxFx, txt } from './fx';

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export class BoxingScene {
  readonly fx = new BoxFx();
  /** cartão de resultado (a sessão o liga quando a luta acaba) */
  card: ResultView | null = null;
  private ringArt: ReturnType<typeof drawRingArt> | null = null;
  private L: BoxLayout = boxLayout(667, 320);
  private W = 0;
  private H = 0;
  private lastAttack: GatorPose['lastAttack'] = null;
  private lastIdx = 0;
  private sinceImpact = 9;
  private time = 0;
  private dt = 1 / 60;
  private hand: -1 | 1 = 1;
  private lastCount = 0;
  /** reação do jacaré ao soco que levou (decai) */
  private react = 0;
  private reactSide: -1 | 1 = -1;
  private reactTier: 0 | 1 | 2 | 3 = 0;

  constructor(private backdrop: HTMLCanvasElement | null, W: number, H: number) { this.resize(W, H); }

  /** Refaz a geometria e o ringue assado no novo tamanho (girar o aparelho, mudar a janela). */
  resize(W: number, H: number) {
    this.W = W; this.H = H;
    this.L = boxLayout(W, H);
    this.ringArt = drawRingArt(this.L, this.backdrop, Math.min(2, 1800 / W));
  }

  /** Eventos da simulação viram efeitos (o som, a vibração e a torcida ficam na sessão). */
  handle(e: MatchEvent, m: BoxingMatch) {
    const W = this.W, H = this.H, u = H / 360;
    const gx = this.L.target.x, gy = this.L.target.y;
    const hx = this.L.head.x, hy = this.L.head.y;
    const fx = this.fx;
    switch (e.type) {
      case 'hit': {
        const tier = e.punch ? PUNCHES[e.punch].tier : 'jab';
        const side = e.punch && PUNCHES[e.punch].side === 'L' ? -1 : 1;
        if (e.punch) { this.react = 1; this.reactSide = side; this.reactTier = tier === 'jab' ? 0 : tier === 'direto' ? 1 : tier === 'cruzado' ? 2 : 3; }
        const heavy = (e.amount ?? 0) >= 12;
        fx.burst(hx + (Math.random() - 0.5) * 36 * u, hy + (Math.random() - 0.5) * 22 * u, tier === 'gancho' ? 12 : 7, 0, '#ffe27a', 230 * u, 2.4 * u);
        // suor voando na direção do soco (o soco da esquerda manda a cabeça para a direita)
        for (let i = 0; i < (heavy ? 7 : 4); i++) fx.burst(hx, hy, 1, 4, '#cfeaff', (150 + 120 * Math.random()) * u, 2.3 * u, 520);
        fx.pop(tier === 'gancho' ? 'POW!' : tier === 'cruzado' ? 'PAF!' : tier === 'direto' ? 'TCHAC!' : 'tap', hx + (Math.random() - 0.5) * 60 * u, hy - 26 * u, '#ffe27a', (tier === 'jab' ? 15 : 22) * u, 0.7);
        // câmera: o jab é um toque, o cruzado empurra para o lado, o gancho joga a imagem para cima
        if (tier === 'jab') fx.kick(0, -2.5 * u);
        else if (tier === 'direto') { fx.kick(0, -5 * u); fx.punch(0.012); }
        else if (tier === 'cruzado') { fx.kick(-side * 12 * u, 0); fx.addShake(1.2 * u, 0.1); fx.punch(0.018); }
        else { fx.kick(0, -11 * u); fx.addShake(2.4 * u, 0.14); fx.punch(0.026); }
        if (e.amount !== undefined && e.amount >= 14) fx.addFlash(0.12, '#ffffff');
        break;
      }
      case 'block': fx.pop('TOC', hx, hy - 10 * u, '#bfe8ff', 14 * u, 0.5); fx.burst(hx, hy, 4, 0, '#bfe8ff', 120 * u, 2 * u); break;
      case 'counter': fx.pop('CONTRA!', gx, H * 0.2, '#7ff9ff', 20 * u, 1.1); fx.addFlash(0.1, '#7ff9ff'); fx.burst(hx, hy, 2, 3, '#fbf6e4', 260 * u, 2.4 * u, 800); break;
      case 'perfect': fx.pop('PERFEITO!', W / 2, H * 0.3, '#7ff9ff', 24 * u, 1.3); fx.addFlash(0.16, '#7ff9ff'); fx.punch(0.03); break;
      case 'perfectGuard': fx.pop('DEFESA PERFEITA!', W * 0.36, H * 0.3, '#9ff5ff', 20 * u, 1.3); fx.addFlash(0.12, '#9ff5ff'); fx.punch(0.02); fx.burst(this.L.karimbo.x, this.L.karimbo.y - 90 * u, 8, 0, '#9ff5ff', 200 * u, 2.4 * u); break;
      case 'combo': fx.pop(`COMBO x${e.n ?? 1}!`, W / 2, H * 0.26, '#ffe27a', 24 * u, 1.1); fx.burst(W / 2, H * 0.45, 12, 1, '#ffd23a', 260 * u, 3 * u, 300); break;
      case 'star': fx.pop(`ESTRELA ${'★'.repeat(e.n ?? 1)}`, W * 0.36, H * 0.22, '#ffd23a', 20 * u, 1.2); fx.burst(this.L.karimbo.x, this.L.karimbo.y - 110 * u, 8, 1, '#ffd23a', 180 * u, 3 * u, 160); break;
      case 'fury': fx.pop('FÚRIA DAS ORELHAS!', W / 2, H * 0.25, '#ff7a3a', 26 * u, 1.6); fx.addFlash(0.3, '#ff6a2a'); fx.addShake(3 * u, 0.3); fx.punch(0.05); break;
      case 'furyEnd': fx.pop('a fúria passou...', W * 0.36, H * 0.25, '#ffc09a', 12 * u, 1); break;
      case 'read': fx.pop('LIDO! Ele leu o seu soco', gx, H * 0.2, '#ffd0a0', 15 * u, 1.4); break;
      case 'gatorAttack': this.lastAttack = e.attack ?? null; if (m.g.hitIdx === 0) this.hand = this.hand === 1 ? -1 : 1; this.sinceImpact = -9; break;
      case 'gatorMiss':
        this.sinceImpact = 0; this.lastAttack = e.attack ?? this.lastAttack; this.lastIdx = m.g.mode === 'tele' ? m.g.hitIdx - 1 : m.g.hitIdx;
        fx.pop('UUU!', gx, gy - 30 * u, '#ffffff', 18 * u, 0.7);
        break;
      case 'gatorHit': {
        this.sinceImpact = 0; this.lastAttack = e.attack ?? this.lastAttack; this.lastIdx = m.g.mode === 'tele' ? m.g.hitIdx - 1 : m.g.hitIdx;
        const big = e.attack === 'mordidona';
        fx.addShake((big ? 7 : 4) * u, big ? 0.3 : 0.2);
        fx.kick(0, (big ? 22 : 12) * u);
        fx.punch(big ? 0.07 : 0.04);
        fx.addFlash(big ? 0.34 : 0.26, '#ff3a3a');
        fx.pop(big ? 'CHOMP!' : e.attack === 'rabada' ? 'VUUM!' : e.attack === 'cabecada' ? 'TOC!' : 'POW!', W / 2, H * 0.62, '#ff9a8a', 26 * u, 0.9);
        fx.burst(this.L.karimbo.x, this.L.karimbo.y - 70 * u, big ? 14 : 8, 0, '#ff6a5a', 240 * u, 3 * u);
        for (let i = 0; i < 4; i++) fx.burst(this.L.karimbo.x, this.L.karimbo.y - 90 * u, 1, 4, '#cfeaff', (140 + 100 * Math.random()) * u, 2.4 * u, 520);
        break;
      }
      case 'dizzy': fx.pop('TONTO!', hx, hy - 50 * u, '#ffd23a', 20 * u, 1.1); fx.burst(hx, hy - 50 * u, 6, 1, '#ffd23a', 120 * u, 3 * u, 80); break;
      case 'groggy': fx.pop('GROGUE! ORELHADA!', W / 2, H * 0.22, '#ff9a3a', 26 * u, 1.6); fx.addShake(3 * u, 0.3); fx.punch(0.04); break;
      case 'kdG': fx.pop('NOCAUTE!', W / 2, H * 0.3, '#ffd23a', 32 * u, 1.6); fx.addShake(6 * u, 0.4); fx.punch(0.06); fx.addFlash(0.3, '#ffffff'); break;
      case 'rise': fx.pop(e.n ? 'ELE LEVANTOU!' : 'ELE SE RECUPEROU!', W / 2, H * 0.25, '#ff9a8a', 22 * u, 1.4); break;
      case 'kdK': fx.pop('VOCÊ CAIU!', W / 2, H * 0.3, '#ff8a8a', 32 * u, 1.6); fx.addShake(8 * u, 0.5); fx.punch(0.08); fx.addFlash(0.4, '#ff3a3a'); break;
      case 'getup': fx.pop('DE PÉ, KARIMBO!', W / 2, H * 0.28, '#9fe07a', 24 * u, 1.3); break;
      case 'phase': fx.pop(e.n === 3 ? 'JACARÉ FURIOSO!' : 'ELE ESQUENTOU!', W / 2, H * 0.22, '#ff7a5a', 22 * u, 1.6); fx.addShake(3 * u, 0.3); break;
      case 'taunt': fx.pop('Dança comigo, Parabólica!', gx, gy - 90 * u, '#ffffff', 11 * u, 1.5); break;
      case 'carga': fx.pop(`ORELHADA ${'★'.repeat(e.n ?? 1)}`, W / 2, H * 0.2, '#ffe27a', 26 * u, 1.2); fx.addFlash(0.2, '#ffe27a'); break;
      case 'orelhada': fx.addFlash(0.2, '#ffffff'); break;
      case 'impact': fx.addFlash(1, '#ffffff'); fx.addShake(10 * u, 0.5); fx.lines = 1; fx.punch(0.1); fx.burst(gx, gy, 20, 3, '#fbf6e4', 420 * u, 3 * u, 700); fx.burst(gx, gy, 24, 1, '#ffd23a', 380 * u, 3.4 * u, 300); break;
      case 'win': fx.burst(W / 2, H * 0.3, 40, 2, '#7bd05a', 320 * u, 3 * u, 200); break;
      case 'count': if ((e.n ?? 0) !== this.lastCount) { this.lastCount = e.n ?? 0; fx.addShake(1.2 * u, 0.1); } break;
      case 'lose': fx.addShake(6 * u, 0.4); fx.pop('HAHAHA, ORELHUDO!', W / 2, H * 0.28, '#ff9a8a', 20 * u, 1.8); break;
      default: break;
    }
  }

  /** `freeze`: parada de impacto (o golpe "gruda" na tela por uns quadros): só a câmera segue. */
  update(dt: number, freeze = false) {
    this.dt = dt;
    if (!freeze) {
      this.time += dt;
      this.sinceImpact += dt;
      this.react = Math.max(0, this.react - dt * 5.5);
    }
    this.fx.update(dt, freeze);
  }

  draw(g: CanvasRenderingContext2D, m: BoxingMatch, crowd: Crowd, W: number, H: number, k: number) {
    if (W !== this.W || H !== this.H) this.resize(W, H);
    const art = getArt();
    const L = this.L, u = L.u, t = this.time;
    g.save();
    g.translate(this.fx.sx, this.fx.sy);
    if (this.fx.zoom > 0.001) { const z = 1 + this.fx.zoom; g.translate(W / 2, H * 0.55); g.scale(z, z); g.translate(-W / 2, -H * 0.55); }
    if (this.ringArt) g.drawImage(this.ringArt.bg, -10, -10, W + 20, H + 20);
    if (this.ringArt) drawRingLive(g, L, this.ringArt, t);
    drawKids(g, L, crowd, t, k);
    drawShouts(g, L, crowd);
    // ---- jacaré (o corpo antes do Karimbo; o que vai por cima dele no impacto, depois)
    const gp: GatorPose = {
      mode: m.g.mode, guard: m.g.guard, attack: m.g.attack, hitIdx: m.g.hitIdx,
      tele01: m.g.mode === 'tele' ? 1 - m.g.tele / Math.max(1e-6, m.g.teleMax) : 0,
      since: m.g.mode === 'tele' ? 9 : this.sinceImpact, lastAttack: this.lastAttack, lastIdx: this.lastIdx, hand: this.hand,
      round: m.g.phase, time: t, react: this.react, reactSide: this.reactSide, reactTier: this.reactTier,
      fury: m.g.phase === 3, champion: false, hatOff: false, still: m.flow === 'intro' || m.flow === 'break',
    };
    const gs = L.gator.s, gx = L.gator.x, gy = L.gator.feetY;
    const cin = m.cine;
    const ko = cin === 'count' || m.g.mode === 'ko' || m.g.mode === 'down';
    if (cin === 'orelhada' && m.cineT >= 1.6) {
      // lançado pelo ar: gira, voa para trás e cai
      const Lp = clamp01((m.cineT - 1.6) / (ORELHADA_TIME - 1.6));
      g.save();
      g.translate(gx + 240 * Lp * u, gy - 120 * u * Math.sin(Lp * Math.PI) - 40 * u * Lp);
      g.rotate(Lp * 9);
      drawGatorBoxer(g, 0, 0, gs * (1 - 0.3 * Lp), { ...gp, mode: 'groggy', attack: null, since: 9 }, k, false, this.dt);
      g.restore();
    } else if (ko) {
      drawAlligatorKO(g, gx, gy + 6 * u, t, -1);
    } else drawGatorBoxer(g, gx, gy, gs, gp, k, false, this.dt);
    // ---- Karimbo de costas (embaixo, à esquerda)
    const fall = cin === 'lose' ? ease(clamp01(m.cineT / 0.7)) : undefined;
    const spin = cin === 'orelhada' ? ease(clamp01(m.cineT / 1.6)) * Math.PI * 2 : 0;
    const ears = cin === 'orelhada' ? 1 + 1.6 * ease(clamp01(m.cineT / 1.5)) : 1;
    const pose = backPoseOf(m.k, t, { spin, ears, fall, fury: m.furyOn });
    drawKarimboBack(g, art.karimbo, progress.equippedSkin, L, pose, k);
    if (!ko && !(cin === 'orelhada' && m.cineT >= 1.6)) drawGatorBoxer(g, gx, gy, gs, gp, k, true, this.dt);
    this.fx.draw(g);
    g.restore();
    drawBoxHud(g, m, W, H, t, k, L);
    this.drawCine(g, m, W, H);
    this.fx.drawOverlay(g, W, H);
    if (this.card) drawResultCard(g, W, H, this.card, t);
  }

  private drawCine(g: CanvasRenderingContext2D, m: BoxingMatch, W: number, H: number) {
    const u = H / 360, t = m.cineT;
    if (m.cine === 'orelhada') {
      if (t < 1.6) txt(g, 'ORELHADA!', W / 2, H * 0.2, 24 * u, '#ffe27a', 'center', Math.min(1, t * 3), 0.9 + 0.1 * Math.sin(this.time * 18));
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
    } else if (m.cine === 'decision') {
      const dots = '.'.repeat(1 + (Math.floor(this.time * 3) % 3));
      txt(g, `DECISÃO DOS JUÍZES${dots}`, W / 2, H * 0.3, 30 * u, '#ffe27a', 'center', Math.min(1, t * 3));
      if (t > 1.6) {
        const a = clamp01((t - 1.6) / 0.4);
        txt(g, `KARIMBO ${Math.round(m.scoreK / 10)}   ×   ${Math.round(m.scoreG / 10)} JACARÉ`, W / 2, H * 0.3 + 34 * u, 18 * u, '#ffffff', 'center', a);
        txt(g, m.scoreK > m.scoreG ? 'O PÚBLICO ENLOUQUECE!' : 'empate favorece o campeão...', W / 2, H * 0.3 + 58 * u, 13 * u, m.scoreK > m.scoreG ? '#9fe07a' : '#ff9a8a', 'center', a);
      }
    } else if (m.cine === 'lose') {
      txt(g, 'Volta pro berçário, Parabólica!', W / 2, H * 0.42, 14 * u, '#fff1cd', 'center', clamp01(t / 0.4));
      txt(g, 'Essa orelha apanha mais que bandeira em dia de vento!', W / 2, H * 0.42 + 18 * u, 12 * u, '#fff1cd', 'center', clamp01((t - 0.3) / 0.4));
    }
  }
}
