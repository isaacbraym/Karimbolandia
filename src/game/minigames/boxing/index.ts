/**
 * Sessão do boxe em 3ª pessoa (carregada só por import() pelo `minigameFlow`): liga a simulação
 * (sim/match.ts, headless) à cena (art/minigames/boxing), aos sons, à música por round, à vibração, ao
 * layout de toque e ao cartão de resultado (nota S–C, revanche). A luta não mexe no mundo: o prêmio (skin do
 * Jacaré) é dado pela conversa (alligatorTalk) quando chega a vitória.
 *
 * Presentação do golpe (estudo de game feel): a simulação para por instantes no impacto (parada de impacto,
 * 2–14 quadros conforme o peso) e a cena congela junto, só a câmera segue; câmera lenta na esquiva perfeita
 * vale também para a animação (dt × timeScale); cada golpe tem estalo + corpo + baque, e a música cresce com
 * os rounds.
 *
 * Fim da luta: o cartão de resultado fica na tela até o jogador dispensar. Depois de uma DERROTA ele pode
 * pedir REVANCHE na hora (um golpe) ou sair (esquiva/abaixar); depois de uma vitória qualquer golpe continua.
 */
import type { MinigameContext, MinigameModule, MinigameResult, MinigameSession } from '../types';
import type { ControlState, MiniPad } from '../../../core/input';
import type { MusicState } from '../../world';
import { audio } from '../../../core/audio';
import { boxingPerks, isFirstFight, readBoxingStats, recordFight } from '../../../core/boxingStats';
import { BoxingMatch, type MatchEvent } from './sim/match';
import { PUNCH_BUTTONS } from './sim/rules';
import { Crowd } from './sim/crowd';
import { sfxFor, hapticFor, musicFor } from './presentation';
import { BoxingScene } from '../../../art/minigames/boxing/scene';
import { resetHud } from '../../../art/minigames/boxing/hud';
import { loadBackPhotos } from '../../../art/minigames/boxing/backPhotos';

const SEED = 1337;
/** o cartão de uma vitória some sozinho depois disto (s) se ninguém tocar */
const CARD_AUTO = 20;

class BoxingSession implements MinigameSession {
  private match!: BoxingMatch;
  private crowd = new Crowd();
  private scene: BoxingScene;
  private specialLabel: string | null = null;
  private time = 0;
  private finished = false;
  /** um golpe bloqueado emite `block` e depois `hit`: o segundo não faz o som de dano */
  private blocked = false;
  /** o cartão de resultado está na tela (a luta acabou) */
  private cardT = -1;
  private attempts = 0;
  private final: MinigameResult | null = null;
  private champion: boolean;

  constructor(private ctx: MinigameContext) {
    this.champion = ctx.champion === true;
    this.scene = new BoxingScene(ctx.backdrop, ctx.viewW, ctx.viewH);
    this.scene.champion = this.champion;
    this.newMatch();
    ctx.touch('boxing');
  }

  private newMatch() {
    this.match = new BoxingMatch(this.ctx.difficulty, SEED + this.attempts * 7919, { tutorial: isFirstFight() && !this.champion, champion: this.champion });
    this.crowd = new Crowd();
    this.scene.card = null;
    this.scene.perks = boxingPerks();
    this.cardT = -1;
    this.blocked = false;
    resetHud();
    this.ctx.music('fight1');
  }

  get done() { return this.finished; }

  update(dt: number, ctl: ControlState) {
    if (this.finished) return;
    const pad = ctl.mini ?? EMPTY;
    if (this.cardT >= 0) { this.updateCard(dt, pad); return; }
    const m = this.match;
    m.step(dt, pad);
    const frozen = m.hitStopT > 0;
    const sdt = dt * m.timeScale;
    this.time += dt;
    const chant = m.flow === 'intro' || m.flow === 'break' || m.flow === 'kdG' || m.cine === 'count';
    this.crowd.update(frozen ? 0 : sdt, chant);
    this.scene.update(sdt, frozen);
    for (const e of m.events) this.onEvent(e);
    m.events.length = 0;
    // o botão ORELHADA! aparece com o jacaré grogue ou com estrelas para gastar
    const kind = m.specialKind;
    const label = kind === 'finale' ? 'ORELHADA!' : kind === 'carga' ? `ORELHADA ${'★'.repeat(m.stars)}` : null;
    if (label !== this.specialLabel) { this.specialLabel = label; this.ctx.special(label !== null, label ?? undefined); }
    if (m.over) this.showCard();
  }

  /** A luta acabou: registra a marca e mostra o cartão (nota, números, revanche). */
  private showCard() {
    const m = this.match, r = m.result!;
    const before = readBoxingStats().best;
    recordFight({ win: r.outcome === 'win', grade: r.grade, knockdowns: m.kdK, champion: this.champion });
    const RANK = { C: 0, B: 1, A: 2, S: 3 } as const;
    const newBest = r.outcome === 'win' && (before === null || RANK[r.grade] > RANK[before]);
    this.final = { id: 'boxing', outcome: r.outcome, time: r.time, mistakes: r.mistakes, grade: r.grade, champion: this.champion };
    this.cardT = 0;
    this.scene.card = { r, newBest, canRematch: r.outcome === 'lose', t: 0, champion: this.champion };
    if (this.specialLabel !== null) { this.specialLabel = null; this.ctx.special(false); }
    if (r.outcome === 'lose') this.ctx.music('silence');
  }

  private updateCard(dt: number, pad: MiniPad) {
    this.cardT += dt;
    this.time += dt;
    this.crowd.update(dt, false);
    this.scene.update(dt, false);
    const card = this.scene.card!;
    card.t = this.cardT;
    if (this.cardT < 1.1) return;
    const punch = PUNCH_BUTTONS.some((p) => pad[p].pressed) || pad.especial.pressed;
    const leave = pad.esqE.pressed || pad.esqD.pressed || pad.abaixar.pressed;
    if (card.canRematch) {
      if (punch) { this.attempts++; this.newMatch(); }
      else if (leave) this.finished = true;
    } else if (punch || leave || this.cardT > CARD_AUTO) this.finished = true;
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

  result(): MinigameResult | null { return this.finished ? this.final : null; }

  dispose() { this.scene.fx.reset(); this.ctx.special(false); }
}

const EMPTY = Object.fromEntries(['jab', 'cruzE', 'ganchoE', 'direto', 'cruzD', 'ganchoD', 'esqE', 'esqD', 'abaixar', 'guarda', 'especial'].map((b) => [b, { held: false, pressed: false, released: false }])) as unknown as MiniPad;

export const create: MinigameModule['create'] = (ctx) => new BoxingSession(ctx);
/** a foto de costas do Karimbo baixa durante a tela de carregamento (e a luta funciona sem ela, com silhueta) */
export const preload = () => loadBackPhotos().then(() => undefined);
export default { create, preload } satisfies MinigameModule;
