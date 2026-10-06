import { describe, expect, it } from 'vitest';
import { BoxingMatch } from '../src/game/minigames/boxing/sim/match';
import {
  ATTACKS, BEAT, BREAK_TIME, CARGA_DMG, COUNT_TIME, DODGE_INVULN, G_HP, G_RISE, GUARD_PASS, HALF, INTRO_TIME, K_HP, K_RISE, MAX_STARS, ORELHADA_TIME, PUNCHES,
  PUNCH_BUTTONS, ROUND_TIME, type AttackKind, type Punch,
} from '../src/game/minigames/boxing/sim/rules';
import { SCRIPT, pickPattern } from '../src/game/minigames/boxing/sim/gatorScript';
import { gradeOf, gradePoints } from '../src/game/minigames/boxing/sim/scoring';
import { Rng } from '../src/core/math';
import type { MiniButton, MiniPad } from '../src/core/input';
import { pad, reader, hammer, dodgerOnly, guarderOnly, play } from './helpers/boxingBots';
import type { DifficultyId } from '../src/core/difficulty';

const DT = 1 / 60;
const stepN = (m: BoxingMatch, s: number, p: () => MiniPad = () => pad()) => { for (let i = 0; i < Math.round(s * 60); i++) m.step(DT, p()); };
const priv = (m: BoxingMatch) => m as unknown as {
  startAttack: (k: AttackKind, speed?: number) => void; resolveHit: (p: Punch) => void; beginKdK: () => void; endRound: () => void; gatorZero: () => void;
};

/** Vai até o começo do round 1 de verdade e deixa o jacaré parado (sem pensar sozinho). */
function fight(opts: ConstructorParameters<typeof BoxingMatch>[2] = {}, difficulty: DifficultyId = 'normal') {
  const m = new BoxingMatch(difficulty, 1337, opts);
  while (m.flow === 'intro') m.step(DT, pad());
  m.g.thinkT = 1e9;
  m.events.length = 0;
  return m;
}
/** Passa pela telegrafia até `left` s antes do impacto. */
const untilTele = (m: BoxingMatch, left: number) => { while (m.g.mode === 'tele' && m.g.tele > left) m.step(DT, pad()); };

describe('boxe v2: golpes e guarda do jacaré', () => {
  it('os seis botões fazem seis golpes distintos com o dano da tabela', () => {
    const seen = new Set<Punch>();
    for (const p of PUNCH_BUTTONS) {
      const m = fight();
      m.g.mode = 'recover'; m.g.guard = 'aberta'; m.g.recoverT = 5;
      const hp0 = m.g.hp;
      m.step(DT, pad([p]));
      expect(m.k.punch).toBe(p);
      stepN(m, 0.6);
      expect(hp0 - m.g.hp).toBeCloseTo(PUNCHES[p].dmg, 5);
      seen.add(p);
    }
    expect(seen.size).toBe(6);
  });

  it('a guarda do jacaré reduz o dano conforme a tabela: o gancho abre a alta, o reto passa pela baixa', () => {
    const hit = (guard: 'alta' | 'baixa', p: Punch) => {
      const m = fight();
      m.g.stance = guard; m.g.guard = guard; m.g.stanceT = 99;
      const hp0 = m.g.hp;
      m.step(DT, pad([p]));
      stepN(m, 0.6);
      return hp0 - m.g.hp;
    };
    expect(hit('alta', 'jab')).toBeCloseTo(PUNCHES.jab.dmg * GUARD_PASS.alta.jab);
    expect(hit('alta', 'ganchoD')).toBeCloseTo(PUNCHES.ganchoD.dmg);
    expect(hit('baixa', 'cruzD')).toBeCloseTo(PUNCHES.cruzD.dmg);
    expect(hit('baixa', 'ganchoE')).toBeCloseTo(PUNCHES.ganchoE.dmg * GUARD_PASS.baixa.gancho);
  });

  it('o jacaré LÊ o soco repetido: três do mesmo tipo em 3 s e ele se cobre; variar o soco não faz isso', () => {
    const m = fight();
    m.g.stance = 'baixa'; m.g.guard = 'baixa'; m.g.stanceT = 99;
    for (let i = 0; i < 3; i++) { while (m.k.action !== 'idle') m.step(DT, pad()); m.step(DT, pad(['direto'])); }
    stepN(m, 0.4);
    expect(m.g.mode).toBe('cover');
    expect(m.events.some((e) => e.type === 'read')).toBe(true);
    const v = fight();
    v.g.stance = 'baixa'; v.g.guard = 'baixa'; v.g.stanceT = 99;
    for (const p of ['direto', 'cruzD', 'jab', 'direto'] as Punch[]) { while (v.k.action !== 'idle') v.step(DT, pad()); v.step(DT, pad([p])); }
    stepN(v, 0.4);
    expect(v.g.mode).not.toBe('cover');
  });

  it('combo JAB→DIRETO→CRUZADO no ritmo dá +25% no último; cinco acertos seguidos deixam o jacaré tonto', () => {
    const m = fight();
    m.g.mode = 'recover'; m.g.recoverT = 99; m.g.guard = 'aberta';
    const hp0 = m.g.hp;
    for (const p of ['jab', 'direto', 'cruzD'] as Punch[]) { while (m.k.action !== 'idle') m.step(DT, pad()); m.step(DT, pad([p])); }
    stepN(m, 1.2);
    expect(hp0 - m.g.hp).toBeCloseTo(PUNCHES.jab.dmg + PUNCHES.direto.dmg + PUNCHES.cruzD.dmg * 1.25, 4);
    expect(m.events.some((e) => e.type === 'combo')).toBe(true);
    const m2 = fight();
    m2.g.mode = 'recover'; m2.g.recoverT = 99; m2.g.guard = 'aberta';
    const seq: Punch[] = ['jab', 'direto', 'cruzE', 'jab', 'direto'];
    for (const p of seq) { while (m2.k.action !== 'idle') m2.step(DT, pad()); m2.step(DT, pad([p])); }
    stepN(m2, 0.3);
    expect(m2.g.mode).toBe('dizzy');
  });

  it('cada soco que passa tira uma fatia VISÍVEL da barra do jacaré (relato: "a vida quase não desce")', () => {
    const open = (p: Punch) => {
      const m = fight();
      m.g.mode = 'recover'; m.g.recoverT = 99; m.g.guard = 'aberta';
      const hp0 = m.g.hp;
      m.step(DT, pad([p]));
      stepN(m, 0.8);
      return (hp0 - m.g.hp) / m.g.maxHp;
    };
    // com a guarda aberta nenhum soco tira menos de 0,4% e o gancho passa de 1,5%
    for (const p of ['jab', 'direto', 'cruzE', 'cruzD', 'ganchoE', 'ganchoD'] as Punch[]) expect(open(p), p).toBeGreaterThan(0.004);
    expect(open('ganchoD')).toBeGreaterThan(0.015);
    // e mesmo contra a guarda alta (o estado mais comum) um reto já passa de 0,12% e o cruzado de 1%
    const high = (p: Punch) => { const m = fight(); m.g.mode = 'guard'; m.g.guard = 'alta'; m.g.thinkT = 99; const hp0 = m.g.hp; m.step(DT, pad([p])); stepN(m, 0.8); return (hp0 - m.g.hp) / m.g.maxHp; };
    expect(high('jab')).toBeGreaterThan(0.0012);
    expect(high('cruzD')).toBeGreaterThan(0.008);
  });

  it('sem energia os golpes ficam 40% mais lentos; defender devolve energia', () => {
    const m = fight();
    m.k.energy = 0;
    m.step(DT, pad(['direto']));
    expect(m.k.pLen).toBeCloseTo(PUNCHES.direto.wind * 1.4);
    const d = fight();
    d.k.energy = 10;
    priv(d).startAttack('patada');
    untilTele(d, 0.15);
    d.step(DT, pad(['esqE']));
    stepN(d, 0.3);
    expect(d.k.energy).toBeGreaterThan(20);
  });
});

describe('boxe v2: defesa honesta, cores e defesa perfeita', () => {
  it('a esquiva é honesta: cobre o impacto se começou até 0,32 s antes, e NÃO cobre se terminou antes', () => {
    const ok = fight();
    priv(ok).startAttack('patada');
    untilTele(ok, 0.2);
    ok.step(DT, pad(['esqE']));
    stepN(ok, 0.5);
    expect(ok.k.hp).toBe(K_HP);
    const early = fight();
    priv(early).startAttack('mordidona');
    untilTele(early, 0.7); // esquiva cedo demais: a invulnerabilidade acaba antes do impacto
    early.step(DT, pad(['esqE']));
    stepN(early, 1.2);
    expect(early.k.hp).toBeLessThan(K_HP);
    expect(DODGE_INVULN).toBeLessThan(0.7);
  });

  it('esquiva perfeita (≤ 0,18 s) dá câmera lenta, estrela e contra-ataque em dobro', () => {
    const m = fight();
    m.g.stance = 'baixa';
    priv(m).startAttack('patada');
    untilTele(m, 0.1);
    m.step(DT, pad(['esqE']));
    stepN(m, 0.15);
    expect(m.events.some((e) => e.type === 'perfect')).toBe(true);
    expect(m.g.counterT).toBeGreaterThan(0);
    while (m.k.action !== 'idle') m.step(DT, pad());
    const hp0 = m.g.hp;
    m.step(DT, pad(['cruzD']));
    stepN(m, 0.5);
    expect(hp0 - m.g.hp).toBeCloseTo(PUNCHES.cruzD.dmg * 2);
    expect(m.stars).toBe(1);
  });

  it('cabeçada (laranja): abaixar protege; a guarda não; patada (amarela): abaixar não protege', () => {
    const duck = (kind: AttackKind, how: 'duck' | 'guard') => {
      const m = fight();
      priv(m).startAttack(kind);
      untilTele(m, 0.3);
      if (how === 'duck') m.step(DT, pad(['abaixar'], ['abaixar']));
      else m.step(DT, pad(['guarda'], ['guarda']));
      stepN(m, 0.6, () => (how === 'duck' ? pad([], ['abaixar']) : pad([], ['guarda'])));
      return K_HP - m.k.hp;
    };
    expect(duck('cabecada', 'duck')).toBe(0);
    expect(duck('cabecada', 'guard')).toBeCloseTo(ATTACKS.cabecada.dmg);
    expect(duck('patada', 'duck')).toBeCloseTo(ATTACKS.patada.dmg);
  });

  it('guarda: 25% do dano, ZERO se apertada nos últimos 0,22 s (defesa perfeita); a rabada não é guardável', () => {
    const run = (kind: AttackKind, pressLeft: number) => {
      const m = fight();
      priv(m).startAttack(kind);
      untilTele(m, pressLeft);
      m.step(DT, pad(['guarda'], ['guarda']));
      stepN(m, 0.8, () => pad([], ['guarda']));
      return { dmg: K_HP - m.k.hp, perfect: m.events.some((e) => e.type === 'perfectGuard'), m };
    };
    const late = run('patada', 0.1);
    expect(late.dmg).toBe(0);
    expect(late.perfect).toBe(true);
    const win = fight();
    priv(win).startAttack('patada');
    untilTele(win, 0.1);
    win.step(DT, pad(['guarda'], ['guarda']));
    stepN(win, 0.12, () => pad([], ['guarda']));
    expect(win.g.counterT).toBeGreaterThan(0);
    const early = run('patada', 0.4);
    expect(early.dmg).toBeCloseTo(ATTACKS.patada.dmg * 0.25);
    expect(early.perfect).toBe(false);
    expect(run('rabada', 0.1).dmg).toBeCloseTo(ATTACKS.rabada.dmg);
  });

  it('o giro exige esquivar PARA O LADO OPOSTO de cada golpe (esq, dir, esq → dir, esq, dir)', () => {
    const wrong = fight();
    priv(wrong).startAttack('giro');
    untilTele(wrong, 0.1);
    wrong.step(DT, pad(['esqE'])); // o primeiro golpe vem da esquerda (−1): esquivar para a esquerda erra
    stepN(wrong, 0.3);
    expect(wrong.k.hp).toBeLessThan(K_HP);
    const right = fight();
    priv(right).startAttack('giro');
    const dirs: MiniButton[] = ['esqD', 'esqE', 'esqD'];
    for (const d of dirs) {
      while (right.g.mode === 'tele' && right.g.tele > 0.1) right.step(DT, pad());
      while (right.k.dodgeCd > 0) right.step(DT, pad());
      right.step(DT, pad([d]));
      stepN(right, 0.2);
    }
    stepN(right, 1);
    expect(right.k.hp).toBe(K_HP);
  });

  it('a chapelada tem dois golpes (a guarda precisa segurar os dois)', () => {
    const m = fight();
    priv(m).startAttack('chapelada');
    untilTele(m, 0.15);
    m.step(DT, pad(['guarda'], ['guarda']));
    stepN(m, 1.4, () => pad([], ['guarda']));
    const blocks = m.events.filter((e) => e.type === 'perfectGuard' || e.type === 'block').length;
    expect(blocks).toBe(2);
  });
});

describe('boxe v2: rounds, quedas, estrelas e Fúria', () => {
  it('a luta tem intro, 60 s de round, 8 s de intervalo (que cura 15%) e 3 rounds', () => {
    const m = new BoxingMatch();
    expect(m.flow).toBe('intro');
    m.g.thinkT = 1e9;
    stepN(m, INTRO_TIME + 0.1);
    expect(m.flow).toBe('fight');
    m.k.hp = 50;
    m.g.hp = m.g.maxHp - 20;
    const keep = () => { m.g.thinkT = 1e9; return pad(); };
    stepN(m, ROUND_TIME + 0.2, keep);
    expect(m.flow).toBe('break');
    expect(m.k.hp).toBeCloseTo(50 + K_HP * 0.15);
    stepN(m, BREAK_TIME + 0.2, keep);
    expect(m.round).toBe(2);
    expect(m.events.some((e) => e.type === 'roundStart' && e.n === 2)).toBe(true);
  });

  it('empate nos pontos favorece o campeão (derrota por decisão); quem fez mais pontos vence', () => {
    const run = (scoreK: number) => {
      const m = new BoxingMatch();
      m.g.thinkT = 1e9;
      m.round = 3; m.flow = 'fight'; m.roundT = 0.05;
      m.scoreK = scoreK; m.scoreG = 10;
      stepN(m, 5, () => { m.g.thinkT = 1e9; return pad(); });
      return m.result;
    };
    expect(run(10)?.outcome).toBe('lose');
    expect(run(11)?.outcome).toBe('win');
    expect(run(11)?.by).toBe('decision');
  });

  it('vida do jacaré zerada nos rounds 1 e 2: queda, contagem e ele levanta com 70% e depois 45%', () => {
    const m = fight();
    m.g.hp = 0.5;
    m.g.stance = 'baixa'; m.g.guard = 'aberta'; m.g.mode = 'recover'; m.g.recoverT = 99;
    m.step(DT, pad(['cruzD']));
    stepN(m, 0.5);
    expect(m.flow).toBe('kdG');
    expect(m.g.mode).toBe('down');
    const counts = () => m.events.filter((e) => e.type === 'kdGCount').length;
    stepN(m, 4);
    expect(counts()).toBe(8);
    expect(m.flow).toBe('fight');
    expect(m.g.hp).toBe(Math.round(m.g.maxHp * G_RISE[0]));
    // segunda queda: levanta com 45%
    m.g.hp = 0.5; m.g.mode = 'recover'; m.g.guard = 'aberta'; m.g.recoverT = 99;
    while (m.k.action !== 'idle') m.step(DT, pad());
    m.step(DT, pad(['cruzD']));
    stepN(m, 5);
    expect(m.g.hp).toBe(Math.round(m.g.maxHp * G_RISE[1]));
  });

  it('no round 3 a vida zerada deixa o jacaré GROGUE; só a ORELHADA vence (cinemática + contagem)', () => {
    const m = fight();
    m.round = 3; m.g.phase = 3;
    m.g.hp = 0.5; m.g.guard = 'aberta'; m.g.mode = 'recover'; m.g.recoverT = 99;
    m.step(DT, pad(['cruzD']));
    stepN(m, 0.4);
    expect(m.g.mode).toBe('groggy');
    expect(m.orelhadaReady).toBe(true);
    expect(m.specialKind).toBe('finale');
    m.step(DT, pad(['especial']));
    expect(m.cine).toBe('orelhada');
    let t = 0;
    while (!m.over && t < 10) { m.step(DT, pad()); t += DT; }
    expect(m.result?.outcome).toBe('win');
    expect(m.result?.by).toBe('orelhada');
    expect(t).toBeGreaterThan(3.5);
    expect(ORELHADA_TIME + COUNT_TIME).toBeGreaterThan(3.5);
  });

  it('GROGUE sem apertar: em 4,5 s ele se recupera com 25% e volta; o round não acaba durante o grogue', () => {
    const m = fight();
    m.round = 3; m.g.phase = 3;
    m.g.hp = 0.5; m.g.mode = 'recover'; m.g.guard = 'aberta'; m.g.recoverT = 99;
    m.step(DT, pad(['cruzD']));
    while ((m.g.mode as string) !== 'groggy') m.step(DT, pad());
    const t0 = m.roundT;
    stepN(m, 2);
    expect(m.roundT).toBeCloseTo(t0, 1);
    stepN(m, 3);
    expect(m.g.mode).toBe('guard');
    expect(m.g.hp).toBe(Math.round(m.g.maxHp * 0.25));
  });

  it('estrelas: acertar na provocação dá 1, levar golpe perde todas, a ORELHADA carregada gasta e ignora a guarda', () => {
    const m = fight();
    m.g.mode = 'taunt'; m.g.guard = 'aberta'; m.g.tauntT = 9; m.g.tauntStar = false;
    m.step(DT, pad(['jab']));
    stepN(m, 0.3);
    expect(m.stars).toBe(1);
    m.stars = MAX_STARS;
    m.g.mode = 'guard'; m.g.guard = 'alta'; m.g.stance = 'alta'; m.g.stanceT = 99; m.g.hp = m.g.maxHp;
    while (m.k.action !== 'idle') m.step(DT, pad());
    expect(m.specialKind).toBe('carga');
    m.step(DT, pad(['especial']));
    expect(m.cine).toBe('carga');
    stepN(m, 1.2);
    expect(m.stars).toBe(0);
    expect(m.g.maxHp - m.g.hp).toBeCloseTo(CARGA_DMG * 4);
    // levar golpe zera as estrelas
    const h = fight();
    h.stars = 2;
    priv(h).startAttack('patada');
    stepN(h, 0.8);
    expect(h.stars).toBe(0);
  });

  it('Fúria: enche com acertos e esquivas perfeitas, deixa os socos 30% mais rápidos e +25% de dano por 6 s', () => {
    const m = fight();
    m.g.mode = 'recover'; m.g.guard = 'aberta'; m.g.recoverT = 99;
    m.fury = 99;
    m.step(DT, pad(['direto']));
    stepN(m, 0.3);
    expect(m.furyT).toBeGreaterThan(0);
    expect(m.events.some((e) => e.type === 'fury')).toBe(true);
    while (m.k.action !== 'idle') m.step(DT, pad());
    const hp0 = m.g.hp;
    m.step(DT, pad(['direto']));
    expect(m.k.slow).toBeCloseTo(0.77);
    stepN(m, 0.5);
    expect(hp0 - m.g.hp).toBeCloseTo(PUNCHES.direto.dmg * 1.25);
    stepN(m, 6.5, () => { m.g.mode = 'recover'; m.g.recoverT = 99; return pad(); });
    expect(m.furyT).toBe(0);
  });
});

describe('boxe v2: o Karimbo no chão', () => {
  const knock = () => { const m = fight(); m.k.hp = 0.5; priv(m).startAttack('mordidona'); stepN(m, 1.3); return m; };

  it('vida zerada: no chão com contagem; martelar os socos levanta com 35% antes do 10', () => {
    const m = knock();
    expect(m.flow).toBe('kdK');
    expect(m.k.action).toBe('down');
    for (let i = 0; i < 80 && m.flow === 'kdK'; i++) m.step(DT, i % 5 === 0 ? pad(['jab']) : pad());
    expect(m.flow).toBe('fight');
    expect(m.k.hp).toBe(Math.round(K_HP * K_RISE[0]));
    expect(m.kdK).toBe(1);
  });

  it('sem martelar: a contagem chega ao 10 e é derrota por TKO', () => {
    const m = knock();
    stepN(m, 9);
    expect(m.cine).toBe('lose');
    stepN(m, 3);
    expect(m.result?.outcome).toBe('lose');
    expect(m.result?.by).toBe('tko');
  });

  it('o terceiro nocaute é TKO imediato', () => {
    const m = fight();
    m.kdK = 2;
    m.k.hp = 0.5; priv(m).startAttack('mordidona');
    stepN(m, 1.3);
    expect(m.cine).toBe('lose');
  });
});

describe('boxe v2: entrada e padrões', () => {
  it('a parada de impacto guarda os toques: um soco apertado DURANTE a parada ainda sai', () => {
    const m = fight();
    m.g.mode = 'recover'; m.g.recoverT = 99; m.g.guard = 'aberta';
    m.step(DT, pad(['jab']));
    while (m.hitStopT <= 0) m.step(DT, pad());
    // o jab acertou e o jogo parou por um instante: o direto apertado AGORA fica guardado
    m.step(DT, pad(['direto']));
    expect(m.hitStopT).toBeGreaterThan(0);
    stepN(m, 0.6);
    expect(m.stats.punches).toBe(2);
  });

  it('os padrões respeitam o desbloqueio por tempo, não repetem seguido e são determinísticos', () => {
    const rng = new Rng(5);
    const first = new Set<number>();
    for (let i = 0; i < 40; i++) first.add(pickPattern(1, 0, rng, -1).index);
    expect([...first].every((i) => (SCRIPT[1].patterns[i].from ?? 0) === 0)).toBe(true);
    const a = new Rng(9), b = new Rng(9);
    let last = -1, lastB = -1;
    for (let i = 0; i < 30; i++) {
      const pa = pickPattern(2, 30, a, last), pb = pickPattern(2, 30, b, lastB);
      expect(pa.index).toBe(pb.index);
      expect(pa.index).not.toBe(last);
      last = pa.index; lastB = pb.index;
    }
  });

  it('sem o jogador, os ataques do jacaré começam e caem na grade do ritmo (1/4 de batida)', () => {
    const m = new BoxingMatch();
    const starts: number[] = [];
    const impacts: number[] = [];
    for (let i = 0; i < 60 * 40; i++) {
      m.step(DT, pad());
      for (const e of m.events) if (e.type === 'gatorAttack') starts.push(m.time);
      for (const e of m.events) if (e.type === 'gatorMiss' || e.type === 'gatorHit') impacts.push(m.time);
      m.events.length = 0;
      m.k.hp = K_HP; // não deixa o Karimbo cair
    }
    expect(starts.length).toBeGreaterThan(5);
    const q = HALF / 2;
    // dt de 1/60 s não casa exatamente com a grade: tolera um quadro
    for (const t of starts.slice(0, 6)) { const r = t % q; expect(Math.min(r, q - r)).toBeLessThan(DT * 1.5); }
    expect(impacts.length).toBeGreaterThan(3);
    expect(BEAT).toBeCloseTo(0.4545, 3);
  });

  it('as dicas da primeira luta aparecem uma vez cada (abaixar na 1ª cabeçada)', () => {
    const m = fight({ tutorial: true });
    priv(m).startAttack('cabecada');
    expect(m.hint).toBe('abaixar');
    const n = m.events.filter((e) => e.type === 'hint').length;
    priv(m).startAttack('cabecada');
    expect(m.events.filter((e) => e.type === 'hint').length).toBe(n);
  });
});

describe('boxe v2: nota', () => {
  it('S exige vencer sem apanhar, com perfeitas e a ORELHADA; derrota é sempre C', () => {
    const base = { win: true, by: 'orelhada' as const, time: 150, damageTaken: 0, maxHp: 100, perfects: 6, starsUsed: 2, knockdownsTaken: 0 };
    expect(gradeOf(base)).toBe('S');
    expect(gradeOf({ ...base, damageTaken: 90, perfects: 0, starsUsed: 0, knockdownsTaken: 1, by: 'decision' })).not.toBe('S');
    expect(gradeOf({ ...base, win: false })).toBe('C');
    expect(gradePoints({ ...base, damageTaken: 50 })).toBeLessThan(gradePoints(base));
    expect(gradePoints({ ...base, knockdownsTaken: 2 })).toBeLessThan(gradePoints(base));
  });
});

describe('boxe v2: equilíbrio com bots', () => {
  const hpOf = (d: DifficultyId) => Math.round(G_HP * ({ facil: 0.85, normal: 1, dificil: 1.15 } as const)[d]);

  it('o leitor perfeito (defende pela cor, pune e varia) vence no normal pela ORELHADA, nem rápido demais nem arrastado', () => {
    const { m, t } = play(reader());
    expect(m.result?.outcome).toBe('win');
    expect(m.result?.by).toBe('orelhada');
    expect(t).toBeGreaterThan(100); // a luta tem corpo: o golpe final não chega no round 1
    expect(t).toBeLessThan(260);
    expect(m.result?.grade).toMatch(/[SA]/); // quase sem apanhar: nota alta
  });

  it('um jogador médio (reage em 0,28 s) vence no normal, no round 2 ou 3; no fácil até o bem lento (0,34 s) vence', () => {
    const n = play(reader(0.28), 'normal');
    expect(n.m.result?.outcome).toBe('win');
    expect(n.t).toBeGreaterThan(125); // mais lento que o leitor perfeito (~115 s)
    expect(n.t).toBeLessThan(330);
    expect(play(reader(0.34), 'facil').m.result?.outcome).toBe('win');
  });

  it('no difícil o leitor ainda vence (mais devagar, apanhando mais)', () => {
    const e = play(reader(0.14), 'facil'), d = play(reader(0.14), 'dificil');
    expect(d.m.result?.outcome).toBe('win');
    expect(d.t).toBeGreaterThan(e.t);
    expect(d.m.stats.damageTaken).toBeGreaterThanOrEqual(e.m.stats.damageTaken);
  });

  it('o martelador (só soca, nunca defende) perde por TKO, em qualquer dificuldade', () => {
    for (const d of ['facil', 'normal', 'dificil'] as const) {
      const r = play(hammer, d).m.result;
      expect(r?.outcome, d).toBe('lose');
      expect(r?.by, d).toBe('tko');
    }
  });

  it('só se esquivar (sem socar) perde por pontos; só segurar a guarda também perde', () => {
    const d = play(dodgerOnly);
    expect(d.m.result?.outcome).toBe('lose');
    expect(d.m.result?.by).toBe('decision');
    expect(d.m.k.hp).toBe(K_HP); // ele não levou um arranhão: perdeu por não lutar
    expect(play(guarderOnly).m.result?.outcome).toBe('lose');
  });

  it('determinismo: mesma semente e mesmas entradas dão o mesmo resultado', () => {
    const a = play(reader()), b = play(reader());
    expect(a.t).toBeCloseTo(b.t, 6);
    expect(a.m.result?.outcome).toBe(b.m.result?.outcome);
    expect(a.m.k.hp).toBeCloseTo(b.m.k.hp, 6);
  });

  it('a dificuldade escala o dano, a telegrafia e a vida do jacaré', () => {
    const f = new BoxingMatch('facil'), n = new BoxingMatch('normal'), d = new BoxingMatch('dificil');
    expect(f.g.maxHp).toBe(hpOf('facil'));
    expect(d.g.maxHp).toBe(hpOf('dificil'));
    expect(n.g.maxHp).toBe(G_HP);
    const take = (diff: DifficultyId) => {
      const m = fight({}, diff);
      priv(m).startAttack('patada');
      const tele = m.g.teleMax;
      stepN(m, 1.5);
      return { hp: K_HP - m.k.hp, tele };
    };
    const a = take('facil'), b = take('normal'), c = take('dificil');
    expect(a.hp).toBeCloseTo(8 * 0.7);
    expect(c.hp).toBeCloseTo(8 * 1.25);
    expect(a.tele).toBeGreaterThan(b.tele);
    expect(c.tele).toBeLessThan(b.tele);
  });

  it('a revanche (Jacaré Campeão) tem mais vida e bate mais forte', () => {
    const c = new BoxingMatch('normal', 1, { champion: true });
    expect(c.g.maxHp).toBeGreaterThan(G_HP);
    const m = fight({ champion: true });
    priv(m).startAttack('patada');
    stepN(m, 1.5);
    expect(K_HP - m.k.hp).toBeCloseTo(8 * 1.1);
  });
});
