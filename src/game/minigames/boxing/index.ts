/**
 * Sessão do boxe em 3ª pessoa (carregada só por import() pelo `minigameFlow`): liga a simulação
 * (sim/match.ts, headless) à cena (art/minigames/boxing), aos sons, à música por round, à vibração e ao
 * layout de toque. A luta não mexe no mundo: o prêmio (skin do Jacaré) é dado pela conversa
 * (alligatorTalk) quando chega a vitória.
 *
 * Presentação do golpe (estudo de game feel): a simulação para por instantes no impacto (parada de impacto,
 * 2–14 quadros conforme o peso) e a cena congela junto, só a câmera segue; câmera lenta na esquiva perfeita
 * vale também para a animação (dt × timeScale); cada golpe tem estalo + corpo + baque, e a música cresce com
 * os rounds.
 */
import type { MinigameContext, MinigameModule, MinigameResult, MinigameSession } from '../types';
import type { ControlState, MiniPad } from '../../../core/input';
import type { MusicState } from '../../world';
import { audio } from '../../../core/audio';
import { BoxingMatch, type MatchEvent } from './sim/match';
import { Crowd } from './sim/crowd';
import { sfxFor, hapticFor, musicFor } from './presentation';
import { BoxingScene } from '../../../art/minigames/boxing/scene';
import { resetHud } from '../../../art/minigames/boxing/hud';
import { loadBackPhotos } from '../../../art/minigames/boxing/backPhotos';

class BoxingSession implements MinigameSession {
  private match: BoxingMatch;
  private crowd = new Crowd();
  private scene: BoxingScene;
  private special = false;
  private time = 0;
  private finished = false;
  /** um golpe bloqueado emite `block` e depois `hit`: o segundo não faz o som de dano */
  private blocked = false;

  constructor(private ctx: MinigameContext) {
    this.match = new BoxingMatch(ctx.difficulty);
    this.scene = new BoxingScene(ctx.backdrop, ctx.viewW, ctx.viewH);
    resetHud();
    ctx.music('fight1');
    ctx.touch('boxing');
  }

  get done() { return this.finished; }

  update(dt: number, ctl: ControlState) {
    if (this.finished) return;
    const m = this.match;
    m.step(dt, ctl.mini ?? EMPTY);
    const frozen = m.hitStopT > 0;
    const sdt = dt * m.timeScale;
    this.time += dt;
    const chant = m.flow === 'intro' || m.flow === 'break' || m.flow === 'kdG' || m.cine === 'count';
    this.crowd.update(frozen ? 0 : sdt, chant);
    this.scene.update(sdt, frozen);
    for (const e of m.events) this.onEvent(e);
    m.events.length = 0;
    // o botão ORELHADA! aparece com o jacaré grogue ou com estrelas para gastar
    const want = m.specialKind !== null;
    if (want !== this.special) { this.special = want; this.ctx.special(want); }
    if (m.over) { this.finished = true; this.ctx.special(false); }
  }

  private onEvent(e: MatchEvent) {
    this.scene.handle(e, this.match);
    this.crowd.react(e);
    // um golpe bloqueado emite `block` e logo depois `hit`: o segundo não faz o baque nem a vibração de dano
    if (e.type === 'block' && e.punch) this.blocked = true;
    const blocked = e.type === 'hit' && this.blocked;
    if (e.type === 'hit') this.blocked = false;
    for (const [name, vol] of sfxFor(e, blocked)) audio.play(name, vol);
    if (e.type === 'roundEnd') window.setTimeout(() => audio.play('bell', 0.7), 160); // o fim do round toca o sino duas vezes
    const h = hapticFor(e, blocked);
    if (h) this.ctx.haptic?.(h.s, h.ms);
    const mu = musicFor(e, this.match.round);
    if (mu) this.ctx.music(mu);
    // depois da ORELHADA carregada a trilha volta
    if (e.type === 'impact' && this.match.cine === 'carga') this.ctx.music(`fight${this.match.round}` as MusicState);
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

const EMPTY = Object.fromEntries(['jab', 'cruzE', 'ganchoE', 'direto', 'cruzD', 'ganchoD', 'esqE', 'esqD', 'abaixar', 'guarda', 'especial'].map((b) => [b, { held: false, pressed: false, released: false }])) as unknown as MiniPad;

export const create: MinigameModule['create'] = (ctx) => new BoxingSession(ctx);
/** a foto de costas do Karimbo baixa durante a tela de carregamento (e a luta funciona sem ela, com silhueta) */
export const preload = () => loadBackPhotos().then(() => undefined);
export default { create, preload } satisfies MinigameModule;
