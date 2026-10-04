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
import type { Rect } from '../core/math';
import { TILE } from './level';
import { rollLook, type CivLook } from './civLook';
import { nullControls } from './player';

export const CLUB_DANCE_ID = 'club:dance';
/** tempos da cena (s) */
export const CLUB_T = { walk: 1.1, dance: 1.3, sivirino: 4.6, turn: 8.6, max: 15 } as const;
const BPM = 150;



/** Aparências da multidão (dados; a arte é assada no carregamento junto com os civis). */
export const CLUB_CROWD: CivLook[] = Array.from({ length: 14 }, (_, i) => rollLook(9100 + i * 37));

export interface Dancer { x: number; look: CivLook; phase: number; facing: -1 | 1 }

export class ClubScene {
  readonly room: Rect | null;
  readonly floorY: number;
  readonly spotX: number;
  readonly crowd: Dancer[] = [];
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
    if (r) {
      // multidão espalhada pela pista (fora do caminho dos lasers do meio)
      for (let i = 0; i < CLUB_CROWD.length; i++) {
        const x = r.rect.x + (5 + i * 3.2 + (i % 3) * 0.6) * TILE;
        if (Math.abs(x - this.spotX) < 2 * TILE) continue;
        this.crowd.push({ x, look: CLUB_CROWD[i], phase: (i * 0.37) % 1, facing: i % 2 ? -1 : 1 });
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

  update(w: World, dt: number) {
    if (!this.room) return;
    const p = w.player;
    if (!this.active) {
      if (w.encounters.completed.has(CLUB_DANCE_ID)) {
        if (this.t < 0) this.t = 99;
        if (Number.isNaN(this.sivX)) this.sivX = this.spotX - 46;
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
        w.audio('whistle', 0.9, p.x);
        if (beat === 0) {
          w.fx.addFlash(0.25, '#ff4fd0');
          w.hooks.onBanner?.('MODO LATRELL!', 'Apito na boca e pulseira neon no braço', 2);
        }
      }
    } else if (t >= CLUB_T.turn) p.danceT = -1;
    // Sivirino entra de calção, dançando, por trás
    if (t >= CLUB_T.sivirino) {
      const from = this.room.x + 2 * TILE;
      const to = this.spotX - 46;
      const k = Math.min(1, (t - CLUB_T.sivirino) / 2.4);
      this.sivX = from + (to - from) * (1 - (1 - k) * (1 - k));
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
    if (this.active) w.setMusic(this.t >= CLUB_T.turn ? 'silence' : 'rave');
  }

  /** Durante a cena o Karimbo só obedece ao roteiro (não dá para pular nem cortar). */
  control(ctl: ControlState): ControlState {
    return this.active ? this.ctl : ctl;
  }

  /** câmera enquadra a dança */
  camera(w: World) {
    if (!this.active || !this.room) return;
    w.camera.focus = { x: this.spotX - 30, y: this.floorY - 70, rate: 4 };
    w.camera.zoomTarget = Math.min(1, w.camera.viewW / 560);
  }
}
