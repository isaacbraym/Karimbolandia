/**
 * BALADA (fase 1). O prédio atravessa a calçada: a única passagem é entrar pela porta da frente
 * (seguranças, neon, holofotes) e sair pelos fundos. Na primeira entrada da partida toda a pista
 * reage: a música vira eletrônica frenética, o Karimbo se empolga — dança com pulseiras neon e
 * apito (como o Latrell) —, o Sivirino aparece de calção dançando atrás dele, o Karimbo se vira e
 * solta a mesma fala de quando viu o Nômad pela primeira vez. A cena não pode ser cortada: o
 * jogador recebe um controle roteirizado até o fim. Simulação sem arte (testes headless).
 */
import type { World } from './world';
import type { ControlState } from '../core/input';
import { Rng, type Rect } from '../core/math';
import { TILE } from './level';
import { rollLook, type CivLook } from './civLook';
import { nullControls } from './player';
import { BASE_ZOOM } from './camera';

export const CLUB_DANCE_ID = 'club:dance';
/**
 * tempos da cena (s): o Karimbo entra e dança (a câmera aproxima dele); o Sivirino entra dançando pela esquerda
 * e atravessa a pista em `sivWalk` s com a câmera acompanhando; chegando, o Karimbo se vira (`turn`).
 */
export const CLUB_T = { walk: 1.1, dance: 1.3, sivirino: 9.0, sivWalk: 4.4, turn: 14.2, max: 22 } as const;
const BPM = 150;
export const CLUB_FLOOR_DEPTH = 224;
export const SIV_CONTACT_DISTANCE = 20;



/** Aparências da multidão (dados; a arte é assada no carregamento junto com os civis). */
// A pista anterior instanciava 13 pessoas (14 aparências, uma posição reservada ao Karimbo).
export const CLUB_CROWD: CivLook[] = Array.from({ length: 13 * 5 }, (_, i) => rollLook(9100 + i * 37));

/** Quem anda dançando pela pista (alguns, não todos): vai e volta numa faixa, com pausas dançando parado. */
export interface Walk { dir: -1 | 1; x0: number; min: number; max: number; speed: number; pause: number; steps: number }
export interface Dancer { x: number; depth: number; scale: number; style: number; look: CivLook; phase: number; facing: -1 | 1; walk?: Walk }
/** uma em cada cinco pessoas anda pela balada */
export const walksAt = (i: number) => i % 5 === 2;
/**
 * o bar: uma ilha com balcão e prateleira atrás do ponto da dança do Karimbo (fica em cena na cutscene).
 * Mais fundo que 150 sairia do enquadramento da câmera (a parede do fundo fica acima da tela).
 */
export const BAR_DX = 110;
export const BAR_DEPTH = 140;
/** a faixa da pista ocupada pelo bar (nenhuma pessoa da multidão nasce aqui) */
const BAR_CLEAR = { half: 175, from: 100, to: 210 };
/** zoom do plano fechado no Karimbo (o enquadramento normal é BASE_ZOOM = 1,14) */
const CLOSE = 1.35;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => v * v * (3 - 2 * v);

export class ClubScene {
  readonly room: Rect | null;
  readonly floorY: number;
  readonly spotX: number;
  readonly crowd: Dancer[] = [];
  /** posição do bar (centro do balcão); nulo fora da fase da balada */
  readonly bar: { x: number; depth: number } | null;
  /** -1 = cena não começou; ≥ 0 = segundos de cena */
  t = -1;
  active = false;
  /** Sivirino na pista (x) depois que entrou dançando */
  sivX = NaN;
  private clip: { playing: boolean } | null = null;
  private whistleBeat = -1;
  private ctl: ControlState = { ...nullControls };

  constructor(w: { data: World['data'] }) {
    const r = w.data.stage === 1 ? w.data.secretRooms.find((s) => s.id === 'club') : undefined;
    this.room = r ? r.rect : null;
    this.floorY = r ? r.rect.y + r.rect.h : 0;
    this.spotX = r ? r.rect.x + 12 * TILE : 0;
    this.bar = r ? { x: r.rect.x + 12 * TILE + BAR_DX, depth: BAR_DEPTH } : null;
    if (r) {
      // Pontos contínuos: escolhe espaços livres, sem fileiras ou colunas visíveis.
      // Apenas na criação da cena; não há busca, sorteio ou ordenação por quadro.
      const rng = new Rng(9237);
      const spots: { x: number; depth: number }[] = [];
      for (let i = 0; i < CLUB_CROWD.length; i++) {
        let best = { x: 0, depth: 0 }, bestSpace = -1;
        for (let c = 0; c < 64; c++) {
          const depth = rng.range(32, CLUB_FLOOR_DEPTH - 28);
          const x = rng.range(r.rect.x + 48 + depth * .55, r.rect.x + r.rect.w - 48 - depth * .1);
          // o bar tem a sua ilha: ninguém dança em cima do balcão
          if (this.bar && Math.abs(x - this.bar.x) < BAR_CLEAR.half && depth > BAR_CLEAR.from && depth < BAR_CLEAR.to) continue;
          let space = Infinity;
          for (const other of spots) {
            // Dá mais peso à separação em profundidade para preservar silhuetas e rostos.
            const dx = x - other.x, dy = (depth - other.depth) * 2;
            space = Math.min(space, dx * dx + dy * dy);
          }
          if (space > bestSpace) { best = { x, depth }; bestSpace = space; }
        }
        spots.push(best);
      }
      // Ordena os pontos antes de atribuir identidades; índices continuam iguais aos sprites assados.
      spots.sort((a, b) => b.depth - a.depth);
      for (const [i, { x, depth }] of spots.entries()) {
        this.crowd.push({ x, depth, scale: .95 - depth / 650, style: i % 4,
          look: CLUB_CROWD[i], phase: rng.next(), facing: rng.chance(.5) ? -1 : 1 });
      }
      // alguns andam dançando (faixa limitada pela pista e longe do bar); semente própria: a pista parada continua igual
      const wr = new Rng(9301);
      for (const [i, d] of this.crowd.entries()) {
        if (!walksAt(i)) continue;
        const lo = r.rect.x + 48 + d.depth * .55 + 8, hi = r.rect.x + r.rect.w - 48 - d.depth * .1 - 8;
        const half = wr.range(110, 220);
        let min = Math.max(lo, d.x - half), max = Math.min(hi, d.x + half);
        // ninguém atravessa a ilha do bar: a faixa para antes do balcão, do lado em que a pessoa está
        if (this.bar && d.depth > BAR_CLEAR.from - 20 && d.depth < BAR_CLEAR.to + 20) {
          if (d.x < this.bar.x) max = Math.min(max, this.bar.x - BAR_CLEAR.half);
          else min = Math.max(min, this.bar.x + BAR_CLEAR.half);
        }
        d.walk = { dir: wr.chance(.5) ? -1 : 1, x0: d.x, min, max: Math.max(min, max), speed: wr.range(22, 34), pause: wr.range(0, 2), steps: wr.next() };
        d.facing = d.walk.dir;
      }
    }
  }

  get done() {
    return this.t >= 0 && !this.active;
  }

  inside(w: World) {
    const r = this.room;
    const p = w.player;
    return !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y - 20 && p.y <= r.y + r.h + 20;
  }

  /** Respawn/reinício: nunca deixa o Karimbo travado dançando. */
  reset(w: World) {
    if (this.active) {
      w.player.danceT = -1;
      w.camera.focus = null;
      w.setMusic('explore');
    }
    this.active = false;
    if (!w.encounters.completed.has(CLUB_DANCE_ID)) this.t = -1;
    this.sivX = NaN;
    this.clip = null;
  }

  /** Os que andam dançando: vão e voltam na faixa e param para dançar nas pontas (determinístico, sem sorteio por quadro). */
  private walkCrowd(dt: number) {
    for (const d of this.crowd) {
      const k = d.walk;
      if (!k) continue;
      if (k.pause > 0) { k.pause -= dt; continue; }
      d.x += k.dir * k.speed * dt;
      k.steps += k.speed * dt / 18;
      if (d.x >= k.max) { d.x = k.max; k.dir = -1; k.pause = 1.2 + (k.steps % 1) * 2.2; d.facing = -1; }
      else if (d.x <= k.min) { d.x = k.min; k.dir = 1; k.pause = 1.2 + (k.steps % 1) * 2.2; d.facing = 1; }
      else d.facing = k.dir;
    }
  }

  update(w: World, dt: number) {
    if (!this.room) return;
    this.walkCrowd(Math.min(dt, 0.1));
    const p = w.player;
    if (!this.active) {
      if (w.encounters.completed.has(CLUB_DANCE_ID)) {
        if (this.t < 0) this.t = 99;
        if (Number.isNaN(this.sivX)) this.sivX = this.spotX - SIV_CONTACT_DISTANCE;
        return;
      }
      if (this.t >= 0 || !this.inside(w) || p.mode !== 'foot' || !p.body.onGround || w.director.cine || w.doorT >= 0) return;
      this.active = true;
      this.t = 0;
      w.clearEnemyBullets();
      w.narrator.stop();
      w.setMusic('rave');
      w.hooks.onBanner?.('BALADA!', 'Karimbo sentiu a batida...', 1.6);
    }
    this.t += dt;
    const t = this.t;
    // ---- roteiro
    const c = this.ctl;
    c.moveX = 0;
    if (t < CLUB_T.walk + 1.5 && Math.abs(p.x - this.spotX) > 6) {
      c.moveX = p.x < this.spotX ? 0.6 : -0.6;
    } else if (t < CLUB_T.turn) p.facing = 1;
    // dança (apito no tempo, a cada dois tempos)
    if (t >= CLUB_T.dance && t < CLUB_T.turn) {
      p.danceT = t - CLUB_T.dance;
      const beat = Math.floor(p.danceT * (BPM / 60) / 2);
      if (beat !== this.whistleBeat) {
        this.whistleBeat = beat;
        w.audio('whistle', 1, p.x);
        if (beat === 0) {
          w.fx.addFlash(0.25, '#ff4fd0');
          w.hooks.onBanner?.('MODO LATRELL!', 'Apito na boca e pulseira neon no braço', 2);
        }
      }
    } else if (t >= CLUB_T.turn) p.danceT = -1;
    // Sivirino entra de calção, dançando, por trás
    if (t >= CLUB_T.sivirino) {
      const from = this.room.x + 24;
      const to = p.x - SIV_CONTACT_DISTANCE;
      const k = clamp01((t - CLUB_T.sivirino) / CLUB_T.sivWalk);
      // passo quase constante (a câmera acompanha); só entra e chega devagar
      this.sivX = from + (to - from) * (0.8 * k + 0.2 * smooth(k));
    }
    // o Karimbo se vira, a música cai e sai a fala do primeiro encontro com o Nômad
    if (t >= CLUB_T.turn && !this.clip) {
      p.facing = -1;
      w.setMusic('silence');
      this.clip = w.voice('karimboNomad');
      w.fx.addShake(2, 0.25);
    }
    const clipDone = this.clip && !this.clip.playing && t > CLUB_T.turn + 0.6;
    if ((clipDone && t > CLUB_T.turn + 1.4) || t > CLUB_T.max) this.finish(w);
  }

  private finish(w: World) {
    this.active = false;
    this.t = 99;
    w.player.danceT = -1;
    w.camera.focus = null;
    w.encounters.completed.add(CLUB_DANCE_ID);
    w.setMusic(w.rhythm.done ? 'drop' : 'club');
    w.hooks.onControlReturned?.();
    w.hooks.onBanner?.('BORA, KARIMBO!', 'A saída fica nos fundos da pista →', 2.4);
    w.hooks.onProgress?.();
  }

  /** Fim do quadro: rave durante a dança, silêncio na fala (nenhuma outra trilha por cima). */
  music(w: World) {
    if (!this.inside(w) || w.player.mode === 'dead' || w.finished || w.director.bossActive) return;
    w.setMusic(this.active ? (this.t >= CLUB_T.turn ? 'silence' : 'rave') : w.rhythm.done ? 'drop' : 'club');
  }

  /** Durante a cena o Karimbo só obedece ao roteiro (não dá para pular nem cortar). */
  control(ctl: ControlState): ControlState {
    return this.active ? this.ctl : ctl;
  }

  /**
   * Câmera do filminho: aproxima do Karimbo ao entrar e durante a dança; quando o Sivirino chega dançando ela vai
   * com ele, atravessando a pista até o Karimbo; na virada fecha nos dois, com o Karimbo em destaque.
   */
  camera(w: World) {
    if (!this.active || !this.room) return;
    const t = this.t, p = w.player, zb = Math.min(1, w.camera.viewW / 560);
    const sivEnd = CLUB_T.sivirino + CLUB_T.sivWalk;
    let fx: number, fy: number, z: number, rate = 4;
    if (t < CLUB_T.sivirino) {
      // zoom no Karimbo: do enquadramento normal para um plano fechado nele durante a entrada e a dança
      const k = smooth(clamp01(t / (CLUB_T.dance + 1.2)));
      z = BASE_ZOOM + (CLOSE - BASE_ZOOM) * k;
      // o Karimbo na metade de baixo do quadro (inteiro, com os pés) e o bar com o barman aparecendo ao fundo, em cima
      fx = p.x + 10; fy = p.y - 40 - 20 * k;
    } else if (t < sivEnd + 0.4) {
      // acompanha o Sivirino dançando até ele chegar no Karimbo (um pouco à frente dele, para ver para onde vai)
      z = Math.max(zb * 1.1, CLOSE);
      fx = Math.min(this.sivX + 34, p.x); fy = this.floorY - 52;
      rate = t < CLUB_T.sivirino + 1 ? 3 : 6.5;
    } else {
      // chegou: plano fechado nos dois, Karimbo em destaque na virada e na fala
      z = Math.max(zb * 1.3, 1.5) + 0.2 * smooth(clamp01((t - sivEnd) / 1.5));
      fx = p.x - 12; fy = p.y - 46; rate = 3.5;
    }
    w.camera.focus = { x: fx, y: fy, rate };
    w.camera.zoomTarget = Math.min(2, z);
  }
}
