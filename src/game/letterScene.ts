/**
 * A carta da princesa Júlia (fase 2), simulação sem arte: o pombo-correio pousa na cabeça do Karimbo
 * (entre as orelhas), entrega a carta, um macaco-prego desce num cipó, ARRANCA a carta, faz careta e
 * dança num galho; o Karimbo fica furioso e o macaco foge mato adentro. O Karimbo pula atrás e a
 * perseguição pelos galhos (minijogo `chase`) começa. A Júlia nunca é desenhada: só existe em texto.
 * Controle roteirizado até o fim; abandonar a perseguição não conclui (a cena pode acontecer de novo).
 */
import type { World } from './world';
import type { ControlState } from '../core/input';
import type { MinigameResult } from './minigames/types';
import { TILE } from './level';
import { nullControls } from './player';

export const LETTER_ID = 'jungle:letter-chase';
/**
 * A cena dispara no primeiro momento tranquilo depois das dicas de tutorial (hint:jump em 188): em
 * chão seco, sem inimigos por perto e longe da água. Começa em 205 (logo depois das dicas) e vale até
 * o desfiladeiro, para não se perder se o jogador passar correndo pelos soldados.
 */
export const LETTER_X0 = 205 * TILE;
export const LETTER_X1 = 326 * TILE;
/** distância mínima (px) de qualquer pântano/lago para a cena acontecer */
export const LETTER_WATER_GAP = 192;
/** a perseguição é baixada em silêncio a partir de ~60 tiles antes */
export const LETTER_PREFETCH_X = 145 * TILE;
export const LETTER_T = { whistle: 0, land: 2, peck: 2.2, give: 2.5, banner: 3, vine: 4.5, grab: 5.2, dance: 5.5, fury: 6.5, flee: 7.5, jump: 7.7, chase: 8.7 } as const;

export type PigeonMode = 'hidden' | 'fly' | 'perch' | 'leave';
export type LetterMode = 'none' | 'folded' | 'open' | 'stolen';
export interface Shout { who: 'karimbo' | 'monkey'; text: string; from: number; to: number }

export class LetterScene {
  readonly exists: boolean;
  /** -1 = não começou; ≥ 0 = segundos de cena */
  t = -1;
  active = false;
  /** ponto do roubo: onde o Karimbo estava (volta aqui depois da perseguição) */
  theftX = 0;
  theftY = 0;
  pigeon: PigeonMode = 'hidden';
  letter: LetterMode = 'none';
  /** macaco: modo e profundidade (0 = na trilha, 1 = enfiado no mato do fundo) */
  monkey: 'hidden' | 'vine' | 'branch' | 'flee' = 'hidden';
  readonly shouts: Shout[] = [];
  private ctl: ControlState = { ...nullControls, jump: { held: false, pressed: false, released: false } };
  private done = new Set<string>();
  private requested = false;
  private prefetched = false;
  private jumped = false;

  constructor(w: { data: World['data'] }) {
    this.exists = w.data.stage === 2;
  }

  get busy() { return this.active || this.requested; }

  reset(w?: World) {
    if (w && (this.active || this.requested)) { w.player.lockInput = false; w.camera.focus = null; }
    this.t = -1;
    this.jumped = false;
    this.active = false;
    this.requested = false;
    this.pigeon = 'hidden';
    this.letter = 'none';
    this.monkey = 'hidden';
    this.shouts.length = 0;
    this.done.clear();
  }

  /** O Karimbo está em condições de ver a cena? (nunca no meio de um tiroteio nem na água) */
  canStart(w: World): boolean {
    const p = w.player;
    if (!this.exists || this.t >= 0 || w.encounters.completed.has(LETTER_ID)) return false;
    if (p.x < LETTER_X0 || p.x > LETTER_X1) return false;
    if (p.mode !== 'foot' || p.mounted || p.swimming || p.crouch || !p.body.onGround || p.hurtT > 0 || p.lockInput || p.vine) return false;
    if (p.sink > 0 || w.water.zones.some((z) => p.x > z.x - LETTER_WATER_GAP && p.x < z.x + z.w + LETTER_WATER_GAP && p.feetY > z.y - 120) || w.water.wadeDepth(p.x, p.feetY) > 0 || w.director.cine || w.finished || w.inRoom() || w.doorT >= 0 || w.village.active || w.club.active || w.thinker.active) return false;
    if (w.enemies.some((e) => e.alive && Math.abs(e.x - p.x) < 700)) return false;
    if (w.bullets.some((b) => !b.dead && b.team !== 0 && Math.abs(b.x - p.x) < 700)) return false;
    return true;
  }

  update(w: World, dt: number) {
    if (!this.exists) return;
    const p = w.player;
    if (!this.active) {
      if (!this.requested && this.t < 0) {
        // uma vez só: se a rede falhar, o fluxo tenta de novo quando o jogador realmente entrar
        if (!this.prefetched && p.x > LETTER_PREFETCH_X && !w.encounters.completed.has(LETTER_ID)) { this.prefetched = true; w.hooks.onMinigamePrefetch?.('chase'); }
        if (this.canStart(w)) this.begin(w);
      }
      return;
    }
    if (p.mode === 'dead' || p.mode !== 'foot') { this.reset(w); return; }
    this.t += Math.min(dt, 0.1);
    const t = this.t, T = LETTER_T;
    this.script(w, t);
    const c = this.ctl;
    c.moveX = 0;
    c.jump.pressed = false;
    c.jump.held = false;
    p.facing = 1;
    if (t >= T.flee) c.moveX = 0.9;
    // o apertar do pulo é uma borda única (quadros longos não a perdem)
    if (t >= T.jump && t < T.jump + 0.3) { c.jump.held = true; if (!this.jumped) { this.jumped = true; c.jump.pressed = true; } }
    if (t >= T.chase && !this.requested) this.requestChase(w);
  }

  private begin(w: World) {
    const p = w.player;
    this.active = true;
    this.t = 0;
    this.theftX = p.x;
    this.theftY = p.y;
    p.lockInput = false; // o controle é roteirizado (this.control), não travado
    p.body.vx = 0;
    w.clearEnemyBullets();
    w.narrator.stop();
    this.done.clear();
  }

  private once(key: string, at: number, t: number, fn: () => void) {
    if (t >= at && !this.done.has(key)) { this.done.add(key); fn(); }
  }

  /** Linha do tempo: cada passo roda uma vez. */
  private script(w: World, t: number) {
    const T = LETTER_T, p = w.player;
    this.once('whistle', T.whistle, t, () => { w.audio('whistle', 0.9, p.x); this.pigeon = 'fly'; });
    this.once('land', T.land, t, () => { this.pigeon = 'perch'; });
    this.once('peck', T.peck, t, () => { p.earPop(1.5); w.audio('cluck', 0.8, p.x); w.fx.sparks(p.x, p.y - 70, 4, '#ffffff', 90); });
    this.once('give', T.give, t, () => { this.letter = 'folded'; this.pigeon = 'leave'; });
    this.once('banner', T.banner, t, () => { this.letter = 'open'; w.hooks.onBanner?.('CARTA DA PRINCESA JÚLIA!', 'O pombo-correio entregou. Tem coração desenhado no envelope.', 2.6); w.audio('checkpoint', 0.6, p.x); });
    this.once('vine', T.vine, t, () => { this.monkey = 'vine'; w.audio('bird2', 0.7, p.x + 90); });
    this.once('grab', T.grab, t, () => {
      this.letter = 'stolen';
      w.audio('crunch', 0.8, p.x + 90);
      this.shout('monkey', 'Hihihi!', T.grab + 0.2, T.grab + 1.7);
    });
    this.once('dance', T.dance, t, () => { this.monkey = 'branch'; });
    this.once('fury', T.fury, t, () => {
      w.fx.addFlash(0.3, '#ff2a2a');
      w.fx.addShake(3, 0.4);
      p.earPop(2.8);
      w.audio('bossRoar', 0.35, p.x);
      w.fx.sparks(p.x - 8, p.y - 60, 8, '#d9d9d9', 70);
      w.fx.sparks(p.x + 8, p.y - 60, 8, '#d9d9d9', 70);
      this.shout('karimbo', 'DEVOLVE ISSO, SEU MACACO!!!', T.fury, T.fury + 2);
    });
    this.once('flee', T.flee, t, () => { this.monkey = 'flee'; w.audio('bird', 0.6, p.x + 200); });
  }

  private shout(who: Shout['who'], text: string, from: number, to: number) {
    this.shouts.push({ who, text, from, to });
  }

  private requestChase(w: World) {
    this.requested = true;
    const hook = w.hooks.onMinigame;
    if (!hook) { this.onResult(w, { id: 'chase', outcome: 'abort', time: 0, mistakes: 0 }); return; }
    hook('chase', (r) => this.onResult(w, r));
  }

  /** Resultado da perseguição. `win` conclui (a T11 mostra a carta e rebobina antes de devolver o jogo). */
  onResult(w: World, r: MinigameResult) {
    this.requested = false;
    this.active = false;
    w.camera.focus = null;
    const p = w.player;
    if (r.outcome === 'win') {
      // o prêmio e a carta lida são da T10/T11 (resultado traz tempo e erros)
      this.finishWin(w, r);
    } else {
      // abandonou ou perdeu: nada é concluído e a cena pode acontecer de novo no mesmo trecho
      this.reset(w);
      if (p.mode === 'foot') this.backToTheft(w); // sem ficar ~6 tiles adiante: a cena pode recomeçar do mesmo ponto
      w.hooks.onControlReturned?.();
    }
  }

  /** Devolve o Karimbo ao ponto do roubo (`theftY` é o centro do corpo), virado para a direita, com 1 s de folga. */
  private backToTheft(w: World) {
    const p = w.player;
    p.body.x = this.theftX;
    p.body.y = this.theftY;
    p.body.vx = p.body.vy = 0;
    p.facing = 1;
    p.invuln = Math.max(p.invuln, 1);
    p.lockInput = false;
    w.cameraSnap();
  }

  /** Vitória: coloca o Karimbo no ponto do roubo virado para a direita e devolve o controle. */
  finishWin(w: World, r: MinigameResult) {
    const p = w.player;
    w.encounters.completed.add(LETTER_ID);
    const medal = r.mistakes === 0 && r.time <= 55 ? 'ouro' : r.time <= 68 ? 'prata' : 'bronze';
    const coins = medal === 'ouro' ? 30 : medal === 'prata' ? 20 : 12;
    w.encounters.grant(w, `${LETTER_ID}:coins`, `CARTA RECUPERADA • medalha de ${medal}`, coins);
    // de volta ao ponto do roubo (sem curar: só reposiciona e dá 1 s de folga)
    this.backToTheft(w);
    this.t = 99;
    this.pigeon = 'hidden';
    this.letter = 'none';
    this.monkey = 'hidden';
    this.shouts.length = 0;
    w.hooks.onBanner?.('CARTA RECUPERADA!', 'A Júlia conta com você (e com essas orelhas).', 3);
    w.hooks.onControlReturned?.();
    w.hooks.onProgress?.();
  }

  /** Controle roteirizado durante a cena. */
  control(ctl: ControlState): ControlState {
    return this.active ? this.ctl : ctl;
  }

  /** Câmera: enquadra o Karimbo e o macaco. */
  camera(w: World) {
    if (!this.active) return;
    w.camera.focus = { x: this.theftX + 70, y: this.theftY - 90, rate: 3.5 };
    w.camera.zoomTarget = Math.min(w.camera.zoomTarget, w.camera.viewW / 540);
  }
}
