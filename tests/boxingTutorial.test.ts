import { describe, expect, it } from 'vitest';
import { STEPS, TutorialDemo, type StepId } from '../src/game/minigames/boxing/tutorial';
import type { MatchEvent } from '../src/game/minigames/boxing/sim/match';
import type { MiniButton, MiniPad } from '../src/core/input';

const BTNS: MiniButton[] = ['jab', 'cruzE', 'ganchoE', 'direto', 'cruzD', 'ganchoD', 'esqE', 'esqD', 'abaixar', 'guarda', 'especial'];
const pad = (pressed: MiniButton[] = []): MiniPad =>
  Object.fromEntries(BTNS.map((b) => [b, { held: pressed.includes(b), pressed: pressed.includes(b), released: false }])) as unknown as MiniPad;
const EMPTY = pad();

/** roda o passo por `seconds` (1/60 s) e devolve todos os eventos da luta */
function run(id: StepId, seconds: number, user: () => MiniPad = () => EMPTY) {
  const d = new TutorialDemo();
  d.setStep(STEPS.indexOf(id));
  const ev: MatchEvent[] = [];
  const cues = new Set<string>();
  for (let i = 0; i < seconds * 60; i++) { ev.push(...d.update(1 / 60, user())); cues.add(d.cue.kind); }
  return { d, ev, cues };
}
const has = (ev: MatchEvent[], type: MatchEvent['type'], pick?: (e: MatchEvent) => boolean) => ev.some((e) => e.type === type && (!pick || pick(e)));

describe('tutorial do boxe: a demonstração mostra cada comando e a reação da luta', () => {
  it('socar: o roteiro dá um jab (mão esquerda) e um direto (mão direita) que ACERTAM o jacaré', () => {
    const { ev, cues } = run('soco', 4.4);
    expect(has(ev, 'hit', (e) => e.punch === 'jab')).toBe(true);
    expect(has(ev, 'hit', (e) => e.punch === 'direto')).toBe(true);
    expect(cues.has('tap')).toBe(true);
  });

  it('gancho e cruzado: o roteiro acerta os dois e mostra o gesto de arrastar', () => {
    const { ev, cues } = run('gancho', 5);
    expect(has(ev, 'hit', (e) => e.punch === 'ganchoD')).toBe(true);
    expect(has(ev, 'hit', (e) => e.punch === 'cruzE')).toBe(true);
    expect(cues.has('swipeUp')).toBe(true);
    expect(cues.has('swipeSide')).toBe(true);
  });

  it('esquivar (vermelho): a esquiva sai no tempo e é PERFEITA; sem apanhar', () => {
    const { ev } = run('esquiva', 4.6);
    expect(has(ev, 'gatorAttack', (e) => e.attack === 'mordidona')).toBe(true);
    expect(has(ev, 'dodge')).toBe(true);
    expect(has(ev, 'perfect')).toBe(true);
    expect(has(ev, 'impact')).toBe(false);
    // só o ataque do roteiro: a IA do jacaré não decide nada durante o tutorial
    expect(ev.filter((e) => e.type === 'gatorAttack').length).toBe(1);
  });

  it('abaixar (laranja): a cabeçada passa por cima, perfeito', () => {
    const { ev } = run('abaixar', 4.6);
    expect(has(ev, 'gatorAttack', (e) => e.attack === 'cabecada')).toBe(true);
    expect(has(ev, 'duck')).toBe(true);
    expect(has(ev, 'perfect')).toBe(true);
  });

  it('bloquear (amarelo): a patada é bloqueada no tempo certo (dano zero)', () => {
    const { ev } = run('bloqueio', 4.6);
    expect(has(ev, 'gatorAttack', (e) => e.attack === 'patada')).toBe(true);
    expect(has(ev, 'perfectGuard')).toBe(true);
    expect(has(ev, 'impact')).toBe(false);
  });

  it('ORELHADA: com o jacaré grogue o roteiro aperta o botão e a cena começa', () => {
    const { ev } = run('orelhada', 3);
    expect(has(ev, 'orelhada')).toBe(true);
  });

  it('o ciclo recomeça sozinho, com a luta zerada (nunca tontura, vida gasta ou derrota)', () => {
    for (const id of STEPS) {
      const { d } = run(id, 40);
      expect(d.loops, id).toBeGreaterThanOrEqual(3);
      // (a demonstração da ORELHADA termina a luta de mentira no meio do ciclo; o ciclo seguinte recomeça limpo)
      if (id !== 'orelhada') expect(d.match.over, id).toBe(false);
      expect(d.match.k.hp, id).toBe(d.match.k.maxHp);
      expect(d.match.kdK, id).toBe(0);
    }
  });

  it('o que a pessoa aperta também vale (modo "experimente"): um jab dela acerta o jacaré', () => {
    const d = new TutorialDemo();
    d.setStep(0);
    const ev: MatchEvent[] = [];
    // espera o roteiro ficar quieto (antes do 1º golpe dele) e aperta o jab
    ev.push(...d.update(1 / 60, pad(['jab'])));
    for (let i = 0; i < 40; i++) ev.push(...d.update(1 / 60, EMPTY));
    expect(has(ev, 'punch', (e) => e.punch === 'jab')).toBe(true);
    expect(has(ev, 'hit', (e) => e.punch === 'jab')).toBe(true);
  });

  it('o Espaço/Enter (especial) da pessoa NÃO vira orelhada: fica livre para "próximo"', () => {
    const d = new TutorialDemo();
    d.setStep(STEPS.indexOf('orelhada'));
    const ev: MatchEvent[] = [];
    for (let i = 0; i < 40; i++) ev.push(...d.update(1 / 60, pad(['especial'])));
    expect(has(ev, 'orelhada')).toBe(false);
  });

  it('setStep limita o índice e cada passo tem texto de comando previsto (cue) em algum instante', () => {
    const d = new TutorialDemo();
    d.setStep(99);
    expect(d.step).toBe(STEPS.length - 1);
    d.setStep(-3);
    expect(d.step).toBe(0);
    for (const id of STEPS) expect(run(id, 5).cues.size, id).toBeGreaterThan(1);
  });
});
