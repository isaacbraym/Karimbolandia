/**
 * Sessão da perseguição pela copa (carregada só por import() pelo `minigameFlow`): liga a simulação
 * (sim/match.ts, headless) à cena (art/minigames/chase), aos sons e ao layout de toque (joystick + PULO).
 * Sem arma, sem perda de vida: cair só custa tempo. Depois da captura vêm o filminho da carta (duas
 * páginas) e o rebobinar da fita de volta ao ponto do roubo. O prêmio vem de quem pediu (letterScene).
 */
import type { MinigameContext, MinigameModule, MinigameResult, MinigameSession } from '../types';
import type { ControlState } from '../../../core/input';
import { audio } from '../../../core/audio';
import { ChaseMatch, type ChaseEvent } from './sim/match';
import { LetterFilm, Rewind } from './sim/letterFilm';
import { ChaseScene } from '../../../art/minigames/chase/scene';
import { FilmScene } from '../../../art/minigames/chase/filmScene';
import { ensureLetterFont } from '../../../art/minigames/chase/letterPaper';

type Phase = 'play' | 'film' | 'rewind' | 'over';

class ChaseSession implements MinigameSession {
  private match = new ChaseMatch();
  private scene: ChaseScene;
  private filmScene: FilmScene;
  private phase: Phase = 'play';
  private film: LetterFilm | null = null;
  private rewind: Rewind | null = null;
  private out: MinigameResult | null = null;
  private skipHold = 0;

  constructor(private ctx: MinigameContext) {
    this.scene = new ChaseScene(ctx.viewW, ctx.viewH, this.match.course);
    this.filmScene = new FilmScene(ctx.viewW, ctx.viewH);
    ctx.music('chase');
    ctx.touch('chase');
    void ensureLetterFont(); // a letra de mão carrega enquanto o Karimbo corre
    this.drain();
  }

  get done() { return this.phase === 'over'; }

  update(dt: number, ctl: ControlState) {
    switch (this.phase) {
      case 'play': this.play(dt, ctl); break;
      case 'film': this.reading(dt, ctl); break;
      case 'rewind': this.rewinding(dt); break;
      default: break;
    }
  }

  private play(dt: number, ctl: ControlState) {
    const m = this.match;
    m.step(dt, { moveX: ctl.moveX, down: ctl.moveY > 0.55, jump: { held: ctl.jump.held, pressed: ctl.jump.pressed } });
    this.scene.update(dt, m);
    this.drain();
    if (m.result) {
      const r = m.result;
      this.out = { id: 'chase', outcome: 'win', time: r.time, mistakes: r.falls };
      this.film = new LetterFilm();
      this.phase = 'film';
      this.ctx.music('calm');
      this.ctx.touch('chase');
    }
  }

  private reading(dt: number, ctl: ControlState) {
    const f = this.film!;
    f.update(dt);
    this.filmScene.update(dt, f);
    if (ctl.jump.pressed || ctl.interact?.pressed) { f.advance(); audio.play('uiClick', 0.35); }
    // segurar ↓ por 0,5 s (depois de 2 s) pula o filminho inteiro
    this.skipHold = f.canSkip && ctl.moveY > 0.6 ? this.skipHold + dt : 0;
    if (this.skipHold >= 0.5) f.skip();
    if (f.done) {
      this.rewind = new Rewind(this.match.trail, this.match.result!.time);
      this.phase = 'rewind';
      audio.play('tvStatic', 0.5);
      audio.play('servo', 0.5);
    }
  }

  private rewinding(dt: number) {
    const rw = this.rewind!;
    rw.update(dt);
    this.scene.updateRewind(dt, rw);
    if (rw.done) this.phase = 'over';
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
      default: break;
    }
  }

  draw(g: CanvasRenderingContext2D, W: number, H: number) {
    if (this.phase === 'film') this.filmScene.draw(g, this.film!, W, H);
    else if (this.phase === 'rewind') this.scene.drawRewind(g, this.match, this.rewind!, W, H);
    else this.scene.draw(g, this.match, W, H, g.getTransform().a);
  }

  resize(W: number, H: number) { this.scene.resize(W, H); this.filmScene.resize(W, H); }

  result(): MinigameResult | null { return this.out; }

  dispose() { this.scene.fx.reset(); }
}

export const create: MinigameModule['create'] = (ctx) => new ChaseSession(ctx);
export default { create } satisfies MinigameModule;
