/**
 * Tutorial do boxe: uma demonstração AO VIVO (a mesma simulação e a mesma arte da luta, sem a IA do jacaré)
 * em que cada passo mostra um comando e como a luta reage a ele, em ciclos. A pessoa também pode testar:
 * o que ela aperta é somado ao roteiro (o Espaço/Enter fica livre para "próximo").
 *
 * Passos: socar (as duas metades da tela), gancho e cruzado (arrastar), esquivar (vermelho), abaixar
 * (laranja), bloquear (amarelo) e a ORELHADA. Cada passo informa um `cue` (o que a interface desenha: o
 * dedo/cursor, o analógico, a tecla), calculado do mesmo relógio do roteiro, então a animação da dica e o
 * golpe na tela nunca ficam fora de sincronia.
 *
 * Módulo puro e determinístico (sem DOM): testado em tests/boxingTutorial.test.ts.
 */
import type { MiniPad, MiniButton } from '../../../core/input';
import { BoxingMatch, type MatchEvent } from './sim/match';
import type { AttackKind } from './sim/rules';

export type StepId = 'soco' | 'gancho' | 'esquiva' | 'abaixar' | 'bloqueio' | 'orelhada';
export const STEPS: readonly StepId[] = ['soco', 'gancho', 'esquiva', 'abaixar', 'bloqueio', 'orelhada'];

/** O que a interface desenha enquanto o roteiro roda. */
export type CueKind = 'none' | 'tap' | 'swipeUp' | 'swipeSide' | 'stickSide' | 'stickDown' | 'guard' | 'special';
export interface Cue {
  kind: CueKind;
  /** metade da tela / lado da esquiva (−1 esquerda, +1 direita) */
  side: -1 | 1;
  /** progresso do gesto 0..1 (no toque: 0,5 é o instante do aperto) */
  p: number;
  /** o comando está apertado agora (acende a tecla/botão) */
  down: boolean;
}

const BTNS: readonly MiniButton[] = ['jab', 'cruzE', 'ganchoE', 'direto', 'cruzD', 'ganchoD', 'esqE', 'esqD', 'abaixar', 'guarda', 'especial'];
const newPad = (): MiniPad => Object.fromEntries(BTNS.map((b) => [b, { held: false, pressed: false, released: false }])) as unknown as MiniPad;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

/** Cada ciclo reinicia a luta de demonstração (sem tontura, sem vida gasta). */
const LENGTH: Record<StepId, number> = { soco: 4.6, gancho: 5.2, esquiva: 4.8, abaixar: 4.8, bloqueio: 4.8, orelhada: 6.6 };
/** quanto antes do impacto (s) o roteiro aperta a defesa: dentro da janela PERFEITA de cada uma */
const LEAD = { esquiva: 0.11, abaixar: 0.11, bloqueio: 0.14 } as const;

export class TutorialDemo {
  match!: BoxingMatch;
  step = 0;
  /** tempo dentro do ciclo atual e quantos ciclos já completou neste passo */
  t = 0;
  loops = 0;
  readonly cue: Cue = { kind: 'none', side: 1, p: 0, down: false };
  private fired = new Set<string>();
  private marks = new Map<string, number>();
  private pad = newPad();

  constructor(private difficulty: 'facil' | 'normal' | 'dificil' = 'facil') { this.reset(); }

  get id(): StepId { return STEPS[this.step]; }

  setStep(i: number) {
    this.step = Math.max(0, Math.min(STEPS.length - 1, i));
    this.loops = 0;
    this.reset();
  }

  private reset() {
    const m = new BoxingMatch(this.difficulty, 4242 + this.step * 31 + this.loops, { tutorial: true });
    m.flow = 'fight';
    m.flowT = 0;
    m.g.thinkT = 1e9; m.g.stanceT = 1e9; // sem IA: só o que o roteiro manda
    if (this.id === 'orelhada') { m.g.mode = 'groggy'; m.g.groggyT = 99; }
    this.match = m;
    this.t = 0;
    this.fired.clear();
    this.marks.clear();
    this.cue.kind = 'none'; this.cue.p = 0; this.cue.down = false;
  }

  /** dispara `key` uma vez, na primeira vez em que `cond` vale */
  private once(key: string, cond: boolean): boolean {
    if (!cond || this.fired.has(key)) return false;
    this.fired.add(key);
    return true;
  }
  private press(b: MiniButton) { this.pad[b].pressed = true; this.pad[b].held = true; }
  private hold(b: MiniButton) { this.pad[b].held = true; }

  private setCue(kind: CueKind, side: -1 | 1, p: number, down: boolean) { this.cue.kind = kind; this.cue.side = side; this.cue.p = p; this.cue.down = down; }

  /** Roteiro do passo atual: preenche `pad` e `cue` para o instante `t`. */
  private script(t: number) {
    const m = this.match;
    switch (this.id) {
      case 'soco': {
        // toque na metade esquerda (jab) e depois na direita (direto)
        const a = 0.9, b = 2.5;
        if (this.once('a', t >= a)) this.press('jab');
        if (this.once('b', t >= b)) this.press('direto');
        if (t < b - 0.55) this.setCue('tap', -1, ramp(t, a - 0.55, a + 0.45) * 0.5 + (t >= a ? ramp(t, a, a + 0.45) * 0.5 : 0), t >= a && t < a + 0.35);
        else this.setCue('tap', 1, ramp(t, b - 0.55, b + 0.45), t >= b && t < b + 0.35);
        if (t >= b + 0.8) this.cue.kind = 'none';
        break;
      }
      case 'gancho': {
        // arrasta para cima (gancho) e depois para o lado (cruzado)
        const a = 0.7, b = 2.8;
        if (this.once('a', t >= a + 0.35)) this.press('ganchoD');
        if (this.once('b', t >= b + 0.35)) this.press('cruzE');
        if (t < b - 0.3) this.setCue('swipeUp', 1, ramp(t, a, a + 0.8), t >= a + 0.35 && t < a + 0.8);
        else this.setCue('swipeSide', -1, ramp(t, b, b + 0.8), t >= b + 0.35 && t < b + 0.8);
        if (t >= b + 1.2) this.cue.kind = 'none';
        break;
      }
      case 'esquiva': case 'abaixar': case 'bloqueio': {
        const atk: AttackKind = this.id === 'esquiva' ? 'mordidona' : this.id === 'abaixar' ? 'cabecada' : 'patada';
        if (this.once('atk', t >= 0.7)) { m.demoAttack(atk); this.marks.set('atk', t); }
        const at = this.marks.get('atk');
        const lead = LEAD[this.id];
        if (at !== undefined && m.g.mode === 'tele' && m.g.tele <= lead && this.once('def', true)) {
          this.marks.set('def', t);
          if (this.id === 'esquiva') this.press('esqE');
          else if (this.id === 'abaixar') this.press('abaixar');
          else this.press('guarda');
        }
        const dt = this.marks.get('def');
        // enquanto a defesa está apertada: abaixar e bloquear seguram um pouco; depois do impacto vem o contra-ataque
        if (dt !== undefined) {
          if (this.id === 'abaixar' && t - dt < 0.55) this.hold('abaixar');
          if (this.id === 'bloqueio' && t - dt < 0.7) this.hold('guarda');
          if (this.id === 'esquiva' && this.once('counter', t - dt >= 0.5 && m.g.counterT > 0)) this.press('direto');
        }
        const kind: CueKind = this.id === 'esquiva' ? 'stickSide' : this.id === 'abaixar' ? 'stickDown' : 'guard';
        const side: -1 | 1 = this.id === 'esquiva' ? -1 : 1;
        const shown = at !== undefined && t < (dt ?? 99) + 1.1;
        this.setCue(shown ? kind : 'none', side, dt === undefined ? 0 : clamp01((t - dt) / 0.18), dt !== undefined && t - dt < 0.75);
        break;
      }
      case 'orelhada': {
        if (this.once('go', t >= 1.4)) this.press('especial');
        this.setCue(t < 3.0 ? 'special' : 'none', 1, ramp(t, 0.9, 1.4), t >= 1.4 && t < 2.1);
        break;
      }
    }
  }

  /** Um quadro: roteiro + o que a pessoa apertar (sem o `especial`, que é "próximo"); devolve os eventos da luta. */
  update(dt: number, user: MiniPad): MatchEvent[] {
    const m = this.match;
    // a demonstração nunca "ganha" nem "perde": a vida é sempre reposta
    m.k.hp = m.k.maxHp; m.k.energy = 100;
    // depois de cada ataque a luta volta à guarda e a IA "pensaria" de novo: aqui ela nunca decide nada
    if (m.g.mode === 'guard') { m.g.thinkT = 1e9; m.g.stanceT = 1e9; }
    if (this.id !== 'orelhada') m.g.hp = m.g.maxHp;
    for (const b of BTNS) { const x = this.pad[b]; x.pressed = x.held = x.released = false; }
    if (m.hitStopT <= 0) this.t += dt * m.timeScale;
    this.script(this.t);
    // soma a entrada real
    for (const b of BTNS) {
      if (b === 'especial') continue;
      const u = user[b];
      if (u.pressed) this.pad[b].pressed = true;
      if (u.held) this.pad[b].held = true;
      if (u.released) this.pad[b].released = true;
    }
    m.step(dt, this.pad);
    m.hint = null;
    // o sino, o "round 1" e as dicas da luta de verdade não tocam na demonstração
    const out = m.events.filter((e) => e.type !== 'bell' && e.type !== 'roundStart' && e.type !== 'hint');
    m.events.length = 0;
    if (this.t >= LENGTH[this.id]) { this.loops++; this.reset(); }
    return out;
  }
}
