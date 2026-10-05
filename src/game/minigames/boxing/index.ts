/**
 * Sessão do boxe em 3ª pessoa (carregada só por import() pelo `minigameFlow`): liga a simulação
 * (sim/match.ts, headless) à cena (art/minigames/boxing), aos sons e ao layout de toque. A luta não
 * mexe no mundo: o prêmio (skin do Jacaré) é dado pela conversa (alligatorTalk) quando chega a vitória.
 */
import type { MinigameContext, MinigameModule, MinigameResult, MinigameSession } from '../types';
import type { ControlState } from '../../../core/input';
import { audio } from '../../../core/audio';
import { BoxingMatch, type MatchEvent } from './sim/match';
import { Crowd } from './sim/crowd';
import { BoxingScene } from '../../../art/minigames/boxing/scene';
import { resetHud } from '../../../art/minigames/boxing/hud';

class BoxingSession implements MinigameSession {
  private match: BoxingMatch;
  private crowd = new Crowd();
  private scene: BoxingScene;
  private special = false;
  private time = 0;
  private finished = false;

  constructor(private ctx: MinigameContext) {
    this.match = new BoxingMatch(ctx.difficulty);
    this.scene = new BoxingScene(ctx.backdrop, ctx.viewW, ctx.viewH);
    resetHud();
    ctx.music('fight');
    ctx.touch('boxing');
  }

  get done() { return this.finished; }

  update(dt: number, ctl: ControlState) {
    if (this.finished) return;
    const m = this.match;
    const pad = ctl.mini;
    if (pad) m.step(dt, pad);
    else m.step(dt, EMPTY);
    this.time += dt;
    this.crowd.update(dt, this.time < 4.5 || m.cine === 'count');
    this.scene.update(dt);
    for (const e of m.events) this.onEvent(e);
    m.events.length = 0;
    // o botão ORELHADA! só aparece com o jacaré grogue
    const want = m.orelhadaReady;
    if (want !== this.special) { this.special = want; this.ctx.special(want); }
    if (m.over) { this.finished = true; this.ctx.special(false); }
  }

  private onEvent(e: MatchEvent) {
    this.scene.handle(e, this.match);
    this.crowd.react(e);
    switch (e.type) {
      case 'bell': audio.play('bell', 0.9); break;
      case 'punch': audio.play('whoosh', 0.35); break;
      case 'hit': audio.play((e.amount ?? 0) >= 12 ? 'punchHeavy' : 'punchLight', 0.8); break;
      case 'block': audio.play('hitMetal', 0.4); break;
      case 'dodge': audio.play('whoosh', 0.5); break;
      case 'perfect': audio.play('secret', 0.5); break;
      case 'gatorAttack': audio.play(e.attack === 'mordidona' ? 'chomp' : 'whoosh', 0.7); break;
      case 'gatorHit': audio.play(e.attack === 'mordidona' ? 'chomp' : 'punchHeavy', 1); audio.play('crowdGasp', 0.6); break;
      case 'gatorMiss': audio.play('crowdLaugh', 0.4); break;
      case 'combo': audio.play('emblem', 0.5); break;
      case 'dizzy': case 'groggy': audio.play('crowdGasp', 0.7); break;
      case 'orelhada': this.ctx.music('silence'); audio.play('laserCharge', 0.8); break;
      case 'impact': audio.play('bigExplosion', 1); audio.play('punchHeavy', 1); break;
      case 'count': audio.play('thump', 0.4); break;
      case 'win': audio.play('victory', 0.9); break;
      case 'lose': audio.play('crowdLaugh', 0.9); break;
      default: break;
    }
  }

  draw(g: CanvasRenderingContext2D, W: number, H: number) {
    this.scene.draw(g, this.match, this.crowd, W, H, g.getTransform().a);
  }

  resize(W: number, H: number) { this.scene.resize(W, H); }

  result(): MinigameResult | null {
    const r = this.match.result;
    return r ? { id: 'boxing', outcome: r.outcome, time: r.time, mistakes: r.mistakes } : null;
  }

  dispose() { this.scene.fx.reset(); this.ctx.special(false); }
}

const EMPTY = Object.fromEntries(['jab', 'cruzE', 'ganchoE', 'direto', 'cruzD', 'ganchoD', 'esqE', 'esqD', 'guarda', 'especial'].map((b) => [b, { held: false, pressed: false, released: false }])) as unknown as import('../../../core/input').MiniPad;

export const create: MinigameModule['create'] = (ctx) => new BoxingSession(ctx);
export default { create } satisfies MinigameModule;
