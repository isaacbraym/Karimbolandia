import { describe, expect, it } from 'vitest';
import { BoxingMatch } from '../src/game/minigames/boxing/sim/match';
import { PUNCHES, PUNCH_BUTTONS, GUARD_PASS, G_HP, type Punch } from '../src/game/minigames/boxing/sim/rules';
import { MINI_BUTTONS, type MiniButton, type MiniPad } from '../src/core/input';
import type { DifficultyId } from '../src/core/difficulty';

const DT = 1 / 60;
/** MiniPad com só estes botões apertados neste quadro (a segurança de "held" vem de `hold`). */
function pad(pressed: MiniButton[] = [], held: MiniButton[] = []): MiniPad {
  return Object.fromEntries(MINI_BUTTONS.map((b) => [b, { held: held.includes(b) || pressed.includes(b), pressed: pressed.includes(b), released: false }])) as MiniPad;
}
const stepN = (m: BoxingMatch, s: number, p: () => MiniPad = () => pad()) => { for (let i = 0; i < s * 60; i++) m.step(DT, p()); };

type Bot = (m: BoxingMatch, t: number) => MiniPad;

/** Defensivo: esquiva no tempo certo, contra-ataca na janela, acerta o golpe certo para a guarda e dá a orelhada. */
const defensive: Bot = (m) => {
  const g = m.g, k = m.k;
  if (m.orelhadaReady) return pad(['especial']);
  if (g.mode === 'tele' && g.tele <= 0.18 && k.dodgeCd <= 0 && k.action !== 'hurt') return pad([k.dodgeDir === 1 ? 'esqE' : 'esqD']);
  if (k.action !== 'idle' && k.action !== 'guard') return pad();
  if (g.mode === 'tele' && g.tele < 0.4) return pad(); // não começa golpe longo perto do impacto
  const open = g.counterT > 0 || g.guard === 'aberta' || g.guard === 'tonto';
  if (open) return pad([g.counterT > 0 || g.guard === 'tonto' ? 'ganchoD' : 'cruzD']);
  if (g.guard === 'alta') return pad(['ganchoE']);
  return pad(['cruzD']);
};

/** Afobado: só soca, nunca defende (cicla os seis golpes; dá a orelhada se der). */
const aggressive: Bot = (m, t) => {
  if (m.orelhadaReady) return pad(['especial']);
  return pad([PUNCH_BUTTONS[Math.floor(t * 4) % 6]]);
};

/** Cauteloso (um jogador de verdade): só esquiva e dá UM golpe por janela de contra-ataque. */
const cautious: Bot = (m) => {
  const g = m.g, k = m.k;
  if (m.orelhadaReady) return pad(['especial']);
  if (g.mode === 'tele' && g.tele <= 0.18 && k.dodgeCd <= 0 && k.action !== 'hurt') return pad([k.dodgeDir === 1 ? 'esqE' : 'esqD']);
  if (k.action !== 'idle') return pad();
  if (g.counterT > 0.1 && g.mode !== 'tele') return pad([g.guard === 'tonto' ? 'ganchoD' : 'cruzD']);
  return pad();
};

function play(bot: Bot, difficulty: DifficultyId = 'normal', maxSeconds = 200) {
  const m = new BoxingMatch(difficulty);
  let t = 0;
  while (!m.over && t < maxSeconds) { m.step(DT, bot(m, t)); t += DT; m.events.length = 0; }
  return { m, t };
}

describe('boxe: golpes, defesa e danos (simulação)', () => {
  it('os seis botões fazem seis golpes distintos com o dano da tabela', () => {
    const seen = new Set<Punch>();
    for (const p of PUNCH_BUTTONS) {
      const m = new BoxingMatch();
      m.g.mode = 'recover'; m.g.guard = 'aberta'; m.g.recoverT = 5; // aberta: leva 100%
      const hp0 = m.g.hp;
      m.step(DT, pad([p]));
      expect(m.k.punch).toBe(p);
      stepN(m, 0.6);
      expect(m.g.hp).toBeCloseTo(hp0 - PUNCHES[p].dmg, 5);
      seen.add(p);
    }
    expect(seen.size).toBe(6);
  });

  it('a guarda do jacaré reduz o dano conforme a tabela (alta, baixa, tonto)', () => {
    const hit = (guard: 'alta' | 'baixa' | 'tonto', p: Punch) => {
      const m = new BoxingMatch();
      m.g.stance = guard === 'tonto' ? 'alta' : guard; m.g.guard = guard === 'tonto' ? 'alta' : guard; m.g.thinkT = 99; m.g.stanceT = 99;
      if (guard === 'tonto') { m.g.mode = 'dizzy'; m.g.dizzyT = 9; }
      const hp0 = m.g.hp;
      m.step(DT, pad([p]));
      stepN(m, 0.6);
      return hp0 - m.g.hp;
    };
    expect(hit('alta', 'jab')).toBeCloseTo(PUNCHES.jab.dmg * GUARD_PASS.alta.jab);
    expect(hit('alta', 'ganchoD')).toBeCloseTo(PUNCHES.ganchoD.dmg);
    expect(hit('baixa', 'cruzD')).toBeCloseTo(PUNCHES.cruzD.dmg);
    expect(hit('baixa', 'ganchoE')).toBeCloseTo(PUNCHES.ganchoE.dmg * GUARD_PASS.baixa.gancho);
    expect(hit('tonto', 'direto')).toBeCloseTo(PUNCHES.direto.dmg * 1.5);
  });

  it('esquivar abre a janela de contra-ataque: dano em dobro; a perfeita cria câmera lenta', () => {
    const m = new BoxingMatch();
    m.g.thinkT = 0;
    while (m.g.mode !== 'tele') m.step(DT, pad());
    // esquiva nos últimos 0,2 s da telegrafia
    while (m.g.tele > 0.2) m.step(DT, pad());
    m.step(DT, pad(['esqE']));
    while (m.k.action !== 'idle') m.step(DT, pad());
    expect(m.events.some((e) => e.type === 'perfect')).toBe(true);
    expect(m.k.hp).toBe(100);
    expect(m.g.counterT).toBeGreaterThan(0);
    const hp0 = m.g.hp;
    m.step(DT, pad(['cruzD']));
    stepN(m, 0.5);
    expect(hp0 - m.g.hp).toBeCloseTo(PUNCHES.cruzD.dmg * 2);
  });

  it('guarda reduz o dano do ataque a 25%, mas não segura a rabada', () => {
    const tryAttack = (kind: 'patada' | 'rabada') => {
      const m = new BoxingMatch();
      m.g.thinkT = 99;
      (m as unknown as { startAttack: (k: string) => void }).startAttack(kind);
      const hp0 = m.k.hp;
      stepN(m, 1.5, () => pad([], ['guarda']));
      return hp0 - m.k.hp;
    };
    expect(tryAttack('patada')).toBeCloseTo(8 * 0.25);
    expect(tryAttack('rabada')).toBeCloseTo(14);
  });

  it('sem energia os golpes ficam 40% mais lentos e a energia volta depois de uma pausa', () => {
    const m = new BoxingMatch();
    m.k.energy = 0;
    m.step(DT, pad(['direto']));
    expect(m.k.pLen).toBeCloseTo(PUNCHES.direto.wind * 1.4);
    const m2 = new BoxingMatch();
    m2.step(DT, pad(['ganchoD']));
    expect(m2.k.pLen).toBeCloseTo(PUNCHES.ganchoD.wind);
    const e0 = m2.k.energy;
    stepN(m2, 1.5);
    expect(m2.k.energy).toBeGreaterThan(e0);
  });

  it('combo JAB→DIRETO→CRUZADO no ritmo dá +25% no último; cinco acertos seguidos deixam o jacaré tonto', () => {
    const m = new BoxingMatch();
    m.g.mode = 'recover'; m.g.recoverT = 99; m.g.guard = 'aberta';
    const hp0 = m.g.hp;
    for (const p of ['jab', 'direto', 'cruzD'] as Punch[]) { while (m.k.action !== 'idle') m.step(DT, pad()); m.step(DT, pad([p])); }
    stepN(m, 1.2);
    expect(hp0 - m.g.hp).toBeCloseTo(4 + 7 + 11 * 1.25, 4);
    expect(m.events.some((e) => e.type === 'combo')).toBe(true);
    const m2 = new BoxingMatch();
    m2.g.mode = 'recover'; m2.g.recoverT = 99; m2.g.guard = 'aberta';
    for (let i = 0; i < 5; i++) { while (m2.k.action !== 'idle') m2.step(DT, pad()); m2.step(DT, pad(['jab'])); }
    stepN(m2, 0.3);
    expect(m2.g.mode).toBe('dizzy');
  });

  it('especial antes do GROGUE não faz nada; GROGUE sem apertar em 5 s recupera 12% e volta à fase 3', () => {
    const m = new BoxingMatch();
    m.step(DT, pad(['especial']));
    expect(m.cine).toBe('none');
    m.g.hp = 0;
    m.step(DT, pad());
    expect(m.g.mode).toBe('groggy');
    expect(m.orelhadaReady).toBe(true);
    stepN(m, 5.2);
    expect(m.g.mode).toBe('guard');
    expect(m.g.hp).toBeCloseTo(Math.round(G_HP * 0.12));
    expect(m.g.phase).toBe(3);
  });

  it('a vitória só vem pela ORELHADA (cinemática de 2,4 s + contagem) e a derrota dá outcome lose', () => {
    const m = new BoxingMatch();
    m.g.hp = 0;
    m.step(DT, pad());
    m.step(DT, pad(['especial']));
    expect(m.cine).toBe('orelhada');
    let t = 0;
    while (!m.over && t < 10) { m.step(DT, pad()); t += DT; }
    expect(m.result?.outcome).toBe('win');
    expect(t).toBeGreaterThan(3.5); // 2,4 s da orelhada + 1,5 s de contagem (em câmera lenta no meio)
    const l = new BoxingMatch();
    l.k.hp = 0;
    l.step(DT, pad());
    expect(l.cine).toBe('lose');
    stepN(l, 3);
    expect(l.result?.outcome).toBe('lose');
  });

  it('determinismo: mesma semente e mesmas entradas dão o mesmo resultado', () => {
    const a = play(defensive), b = play(defensive);
    expect(a.t).toBeCloseTo(b.t, 6);
    expect(a.m.result).toEqual(b.m.result);
    expect(a.m.k.hp).toBeCloseTo(b.m.k.hp, 6);
  });
});

describe('boxe: equilíbrio com bots', () => {
  it('o bot afobado (só soca, nunca defende) perde no normal', () => {
    const { m } = play(aggressive, 'normal');
    expect(m.result?.outcome).toBe('lose');
  });

  it('a dificuldade escala o dano, a telegrafia e a vida do jacaré', () => {
    const f = new BoxingMatch('facil'), n = new BoxingMatch('normal'), d = new BoxingMatch('dificil');
    expect(f.g.maxHp).toBe(Math.round(G_HP * 0.85));
    expect(d.g.maxHp).toBe(Math.round(G_HP * 1.15));
    const dmgTaken = (m: BoxingMatch) => {
      m.g.thinkT = 99;
      (m as unknown as { startAttack: (k: string) => void }).startAttack('patada');
      const tele = m.g.teleMax;
      stepN(m, 1.5);
      return { hp: 100 - m.k.hp, tele };
    };
    const a = dmgTaken(f), b = dmgTaken(n), c = dmgTaken(d);
    expect(a.hp).toBeCloseTo(8 * 0.7);
    expect(c.hp).toBeCloseTo(8 * 1.25);
    expect(a.tele).toBeGreaterThan(b.tele);
    expect(c.tele).toBeLessThan(b.tele);
  });

  it('no fácil o bot afobado já se sai melhor que no difícil', () => {
    const easy = play(aggressive, 'facil').m, hard = play(aggressive, 'dificil').m;
    expect(easy.k.hp).toBeGreaterThanOrEqual(hard.k.hp);
  });
});

describe('boxe: revisão T5–T8', () => {
  it('socos dados enquanto ele debocha (guarda aberta) não o fazem se cobrir quando volta à guarda', () => {
    const m = new BoxingMatch();
    const hit = (m as unknown as { resolveHit: (p: Punch) => void }).resolveHit.bind(m);
    for (let i = 0; i < 4; i++) { m.g.mode = 'taunt'; m.g.guard = 'aberta'; hit('cruzD'); }
    m.g.mode = 'guard';
    m.g.thinkT = 9;
    stepN(m, 0.1);
    expect(m.g.mode).toBe('guard');
  });
});
