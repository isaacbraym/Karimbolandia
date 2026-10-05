/**
 * Revelação da Praça do Pensador (Atlântida), uma vez por partida: o Karimbo se aproxima da estátua
 * e a câmera enquadra o monumento, os cristais acendem, um facho de luz desce do teto, dois anéis de
 * neon (40 peixes) orbitam a estátua em sentidos opostos e a música vira "monument". 6,5 s com o
 * Karimbo flutuando (controle roteirizado). Depois fica o halo: facho a 35%, cristais acesos e os
 * anéis em órbita. Simulação sem arte (testes headless); o desenho está em art/lake/thinkerFx.ts.
 */
import type { World } from '../world';
import type { ControlState } from '../../core/input';
import { TILE } from '../level';
import { nullControls } from '../player';
import { piranhasAggro } from '../enemies/piranha';

export const THINKER_ID = 'atlantis:thinker';
export const THINKER_T = { crystals: 0.3, rings: 0.8, banner: 1.2, bubbles0: 1.5, bubbles1: 2.5, camBack: 5.5, end: 6.5 } as const;
/** distância de disparo (tiles) */
export const THINKER_TRIGGER = 9;
export const THINKER_LIGHT_AFTER = 0.35;

export class ThinkerScene {
  /** centro da estátua no leito (px) */
  readonly x: number;
  readonly y: number;
  readonly exists: boolean;
  /** -1 = não começou; ≥ 0 = segundos de cena */
  t = -1;
  active = false;
  /** 0..1: cristais acesos; 0..1: facho de luz */
  crystal = 0;
  light = 0;
  private bubbleT = 0;
  private bannerDone = false;
  private ctl: ControlState = { ...nullControls };

  constructor(w: { data: World['data'] }) {
    const d = w.data.decos.find((s) => s.kind === 'aThinker');
    this.exists = !!d;
    this.x = d?.x ?? 0;
    this.y = d?.y ?? 0;
  }

  get done() { return this.t >= 0 && !this.active; }

  /** Voltar à primeira vez (nova partida / carregar outro save). */
  reset(w: World) {
    if (this.active) { w.camera.focus = null; w.setMusic('explore'); }
    this.active = false;
    this.t = -1;
    this.crystal = 0;
    this.light = 0;
    this.bannerDone = false;
  }

  /** Karimbo está perto o bastante para a revelação? */
  private near(w: World) {
    const p = w.player;
    return Math.abs(p.x - this.x) <= THINKER_TRIGGER * TILE && Math.abs(p.y - this.y) <= 14 * TILE;
  }

  update(w: World, dt: number) {
    if (!this.exists) return;
    const p = w.player;
    const completed = w.encounters.completed.has(THINKER_ID);
    if (!this.active) {
      if (completed) {
        // já viu (ou carregou um save): estado final estável, sem cena
        if (this.t < 0) {
          this.t = 99;
          this.crystal = 1;
          this.light = THINKER_LIGHT_AFTER;
          if (!w.water.rings.length) w.water.spawnRings(this.x, this.y - 90, false);
        }
        return;
      }
      if (this.t >= 0 || !p.swimming || p.mode !== 'foot' || !this.near(w) || w.director.cine || w.doorT >= 0) return;
      if (piranhasAggro(w, p.x, p.y, 600)) return;
      this.active = true;
      this.t = 0;
      this.bubbleT = 0;
      this.bannerDone = false;
      w.clearEnemyBullets();
      w.narrator.stop();
      w.setMusic('monument');
    }
    // interrompido (morreu, saiu da água por algum motivo): a cena pode acontecer de novo
    if (p.mode === 'dead' || !p.swimming) { this.abort(w); return; }
    this.t += dt;
    const t = this.t;
    // o Karimbo flutua parado
    p.body.vx *= 0.86;
    p.body.vy = Math.min(p.body.vy * 0.7, 0);
    // câmera enquadra a estátua inteira (ver camera())
    if (t >= THINKER_T.crystals) {
      this.crystal = Math.min(1, (t - THINKER_T.crystals) / 1.0);
      this.light = Math.min(1, (t - THINKER_T.crystals) / 1.2);
    }
    if (t >= THINKER_T.rings && !w.water.rings.length) w.water.spawnRings(this.x, this.y - 90, true);
    if (t >= THINKER_T.banner && !this.bannerDone) {
      this.bannerDone = true;
      w.hooks.onBanner?.('O PENSADOR', 'Praça de Atlântida — o monumento de Karimbo', 3.2);
      w.fx.addShake(1.4, 0.3);
    }
    if (t >= THINKER_T.bubbles0 && t <= THINKER_T.bubbles1) {
      this.bubbleT -= dt;
      while (this.bubbleT <= 0) {
        this.bubbleT += 0.034; // ≈ 30 bolhas em 1 s (o teto da água manda)
        const side = Math.random() < 0.5 ? -1 : 1;
        w.water.addBubble(this.x + side * (30 + Math.random() * 46), this.y - 8, 1.2 + Math.random() * 2.6, w.water.zoneAt(this.x, this.y)?.surface ?? 34 * TILE);
      }
    }
    if (t >= THINKER_T.end) this.finish(w);
  }

  private abort(w: World) {
    this.active = false;
    this.t = -1;
    this.crystal = 0;
    this.light = 0;
    w.camera.focus = null;
    w.setMusic('explore');
  }

  private finish(w: World) {
    this.active = false;
    this.t = 99;
    this.crystal = 1;
    this.light = THINKER_LIGHT_AFTER;
    w.camera.focus = null;
    w.encounters.completed.add(THINKER_ID);
    w.setMusic('explore');
    w.hooks.onControlReturned?.();
    w.hooks.onProgress?.();
  }

  /** Durante a cena o Karimbo só obedece ao roteiro. */
  control(ctl: ControlState): ControlState {
    return this.active ? this.ctl : ctl;
  }

  /** Câmera: enquadra a estátua inteira até 5,5 s; depois volta ao normal. */
  camera(w: World) {
    if (!this.active || this.t >= THINKER_T.camBack) return;
    w.camera.focus = { x: this.x, y: this.y - 110, rate: 3 };
    w.camera.zoomTarget = Math.min(w.camera.zoomTarget, w.camera.viewW / 900);
  }

  /** Música épica só durante a cena (depois o jogo volta à trilha normal). */
  music(w: World) {
    if (this.active && w.musicState !== 'monument') w.setMusic('monument');
  }
}
