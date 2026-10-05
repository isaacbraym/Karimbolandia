/**
 * Sessão da perseguição pela copa (carregada só por import() pelo `minigameFlow`): liga a simulação
 * (sim/match.ts, headless) à cena (art/minigames/chase), aos sons e ao layout de toque (joystick + PULO).
 * Sem arma, sem perda de vida: cair só custa tempo. O prêmio vem de quem pediu (letterScene).
 */
import type { MinigameContext, MinigameModule, MinigameResult, MinigameSession } from '../types';
import type { ControlState } from '../../../core/input';
import { audio } from '../../../core/audio';
import { ChaseMatch, type ChaseEvent } from './sim/match';
import { ChaseScene } from '../../../art/minigames/chase/scene';

class ChaseSession implements MinigameSession {
  private match = new ChaseMatch();
  private scene: ChaseScene;
  private finished = false;
  private out: MinigameResult | null = null;

  constructor(private ctx: MinigameContext) {
    this.scene = new ChaseScene(ctx.viewW, ctx.viewH);
    ctx.music('chase');
    ctx.touch('chase');
    this.drain();
  }

  get done() { return this.finished; }

  update(dt: number, ctl: ControlState) {
    if (this.finished) return;
    const m = this.match;
    m.step(dt, { moveX: ctl.moveX, down: ctl.moveY > 0.55, jump: { held: ctl.jump.held, pressed: ctl.jump.pressed } });
    this.scene.update(dt, m);
    this.drain();
    if (m.result) {
      const r = m.result;
      this.out = { id: 'chase', outcome: 'win', time: r.time, mistakes: r.falls };
      this.finished = true;
    }
  }

  private drain() {
    const m = this.match;
    for (const e of m.events) { this.scene.handle(e, m); this.sound(e); }
    m.events.length = 0;
  }

  private sound(e: ChaseEvent) {
    switch (e.type) {
      case 'start': audio.play('whistle', 0.5); break;
      case 'jump': audio.play('jump', 0.35); break;
      case 'land': audio.play('land', 0.3); break;
      case 'glide': audio.play('flap', 0.4); break;
      case 'slide': audio.play('whoosh', 0.4); break;
      case 'spring': audio.play('nomadHop', 0.7); break;
      case 'perfect': audio.play('secret', 0.6); break;
      case 'stumble': audio.play('hit', 0.6); audio.play('crowdLaugh', 0.25); break;
      case 'slip': audio.play('whoosh', 0.6); break;
      case 'bees': audio.play('insect', 0.8); break;
      case 'shake': audio.play('creak', 0.5); break;
      case 'break': audio.play('crunch', 0.6); break;
      case 'fall': audio.play('bigSplash', 0.8); break;
      case 'throw': audio.play('whoosh', 0.5); break;
      case 'sloth': audio.play('thump', 0.5); break;
      case 'quase': case 'taunt': case 'line': case 'read': audio.play('bird2', 0.3); break;
      case 'caught': audio.play('bigExplosion', 0.6); audio.play('punchHeavy', 0.8); break;
      case 'win': audio.play('victory', 0.8); break;
      default: break;
    }
  }

  draw(g: CanvasRenderingContext2D, W: number, H: number) {
    this.scene.draw(g, this.match, W, H, g.getTransform().a);
  }

  resize(W: number, H: number) { this.scene.resize(W, H); }

  result(): MinigameResult | null { return this.out; }

  dispose() { this.scene.fx.reset(); }
}

export const create: MinigameModule['create'] = (ctx) => new ChaseSession(ctx);
export default { create } satisfies MinigameModule;
