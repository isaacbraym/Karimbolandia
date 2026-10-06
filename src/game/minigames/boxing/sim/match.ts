/**
 * A luta de boxe v2 (simulação headless e determinística): o Karimbo (de costas) contra o jacaré dançante,
 * em 3 rounds de 60 s com quedas e contagem, estrelas de orelha, Fúria, defesa por cor, padrões autorados
 * e a ORELHADA final. Sem arte, sem DOM: a sessão (index.ts) lê o estado daqui e os `events` para
 * desenhar e tocar sons. PRNG com semente fixa por luta; os bots dos testes jogam por esta mesma interface.
 *
 * Princípios (docs/boxe-jacare/PLANO_BOXE_2.md): a esquiva é HONESTA (a invulnerabilidade é a fonte da
 * verdade; a animação segue a simulação), a entrada nunca se perde (buffer e parada de impacto guardam os
 * toques) e cada ataque do jacaré diz como se defender pela COR da telegrafia.
 */
import { Rng } from '../../../../core/math';
import type { MiniPad } from '../../../../core/input';
import type { DifficultyId } from '../../../../core/difficulty';
import {
  ATTACKS, BREAK_HEAL, BREAK_TIME, BUFFER_TIME, CARGA_DMG, CARGA_TIME, CARGA_WIND, CHAMPION, COMBO_FINISH_BONUS, COMBO_GAP, COUNTER_MULT, COUNT_TIME,
  COVER_TIME, DIFF, DIZZY_STREAK, DIZZY_TIME, DODGE_COOLDOWN, DODGE_INVULN, DUCK_COOLDOWN, DUCK_MIN, ENERGY_ON_DEFEND, ENERGY_REGEN, ENERGY_REGEN_DELAY,
  FURY_COMBO, FURY_DECAY, FURY_DMG, FURY_HIT, FURY_LOSS_ON_HIT, FURY_MAX, FURY_PERFECT, FURY_SPEED, FURY_TIME, GETUP_DECAY, GETUP_PER_TAP, GROGGY_RECOVER,
  GROGGY_TIME, GUARD_DAMAGE, GUARD_PASS, G_HP, G_RISE, HALF, INTRO_TIME, KD_G_TIME, KD_K_COUNT, KD_K_STEP, KD_POINTS, K_ENERGY, K_HP, K_RISE, MAX_KD_K,
  MAX_STARS, ORELHADA_TIME, PERFECT_GUARD_WINDOW, PERFECT_SLOWMO, PERFECT_WINDOW, PUNCHES, PUNCH_BUTTONS, READ_HITS, READ_WINDOW, ROUNDS, ROUND_TELE,
  ROUND_TIME, TIRED_SLOW,
  type AttackKind, type Guard, type Punch, type PunchTier,
} from './rules';
import { SCRIPT, pickPattern } from './gatorScript';
import { gradeOf, type FightStats, type Grade } from './scoring';

export type MatchEventType =
  | 'bell' | 'roundStart' | 'roundEnd' | 'punch' | 'hit' | 'whiff' | 'block' | 'dodge' | 'duck' | 'perfect' | 'perfectGuard' | 'counter' | 'combo'
  | 'dizzy' | 'groggy' | 'read' | 'star' | 'fury' | 'furyEnd' | 'phase' | 'gatorAttack' | 'gatorHit' | 'gatorMiss' | 'taunt' | 'orelhada' | 'carga'
  | 'impact' | 'count' | 'ko' | 'lose' | 'win' | 'tired' | 'kdG' | 'kdGCount' | 'rise' | 'kdK' | 'kdKCount' | 'getup' | 'decision' | 'hint';
export interface MatchEvent { type: MatchEventType; amount?: number; punch?: Punch; attack?: AttackKind; n?: number; tier?: PunchTier; hint?: HintId }

export type KAction = 'idle' | 'punch' | 'dodge' | 'duck' | 'guard' | 'hurt' | 'down';
export type PunchPhase = 'wind' | 'active' | 'recover';
export type GMode = 'guard' | 'tele' | 'recover' | 'taunt' | 'dizzy' | 'groggy' | 'ko' | 'cover' | 'down';
export type Cine = 'none' | 'orelhada' | 'count' | 'lose' | 'decision' | 'carga';
export type Flow = 'intro' | 'fight' | 'kdG' | 'kdK' | 'break' | 'end';
export type HintId = 'soco' | 'gancho' | 'esquiva' | 'abaixar' | 'descansa' | 'lido';
export type SpecialKind = 'finale' | 'carga' | null;

export interface KState {
  hp: number; maxHp: number; energy: number;
  action: KAction;
  punch: Punch | null; pPhase: PunchPhase; pT: number; pLen: number; didHit: boolean;
  dodgeDir: -1 | 1; dodgeT: number; dodgeStart: number; dodgeCd: number;
  /** abaixar: tempo mínimo restante, instante em que começou e recarga */
  duckT: number; duckStart: number; duckCd: number;
  hurtT: number; guarding: boolean;
  /** instante em que a guarda foi apertada (defesa perfeita = até PERFECT_GUARD_WINDOW antes do impacto) */
  guardAt: number;
  /** golpe guardado durante a recuperação (vale até `bufferT` acabar) */
  buffer: Punch | null; bufferT: number;
  sinceStrike: number;
  /** fator de lentidão do golpe em curso (sem energia = 1,4; Fúria = 0,77) */
  slow: number;
  /** instante em que o golpe em curso começou (o combo mede de começo a começo) */
  startT: number;
  /** progresso de levantar (0..1) e contagem do juiz enquanto está no chão */
  getup: number; downCount: number;
}
export interface GState {
  hp: number; maxHp: number;
  /** o round (1..3): é também a "fase" de fúria do jacaré (a arte usa os olhos vermelhos no 3) */
  phase: 1 | 2 | 3;
  mode: GMode; guard: Guard;
  attack: AttackKind | null; tele: number; teleMax: number; plan: AttackKind[];
  /** índice do golpe em curso dentro de um ataque de vários golpes (chapelada, giro) */
  hitIdx: number;
  recoverT: number; counterT: number; counterPerfect: boolean; dizzyT: number; groggyT: number; tauntT: number; tauntHits: number; tauntStar: boolean;
  thinkT: number; stanceT: number; stance: 'alta' | 'baixa'; groggyUsed: number; flinchT: number; coverT: number;
  /** quantos ataques ele já lançou (a arte alterna a mão do golpe) */
  attackCount: number;
  /** tipo de soco que ele "leu" (cobertura) */
  readTier: PunchTier | null;
}

export interface MatchResult {
  outcome: 'win' | 'lose';
  time: number;
  mistakes: number;
  by: FightStats['by'];
  grade: Grade;
  stats: FightStats;
}
export interface MatchOptions {
  /** primeira luta guiada: o round 1 é mais brando e as dicas aparecem */
  tutorial?: boolean;
  /** revanche: o Jacaré Campeão */
  champion?: boolean;
}

const QUARTER = HALF / 2;
/** menor múltiplo de QUARTER (a partir de `now`) que não é menor que `d`: o golpe cai no ritmo */
const gridDelay = (now: number, d: number) => Math.ceil((now + d) / QUARTER - 1e-6) * QUARTER - now;

const BTNS = ['jab', 'cruzE', 'ganchoE', 'direto', 'cruzD', 'ganchoD', 'esqE', 'esqD', 'abaixar', 'guarda', 'especial'] as const;
const mkPad = () => Object.fromEntries(BTNS.map((b) => [b, { held: false, pressed: false, released: false }])) as unknown as MiniPad;

export class BoxingMatch {
  readonly k: KState;
  readonly g: GState;
  /** relógio da luta (só avança em jogo; para na parada de impacto) */
  time = 0;
  round: 1 | 2 | 3 = 1;
  flow: Flow = 'intro';
  flowT = 0;
  /** tempo que falta no round (s) */
  roundT = ROUND_TIME;
  /** quedas do jacaré (no chão e levantou) e do Karimbo */
  kdG = 0;
  kdK = 0;
  stars = 0;
  fury = 0;
  furyT = 0;
  scoreK = 0;
  scoreG = 0;
  combo = 0;
  comboIdx = 0;
  comboT = -9;
  streak = 0;
  hitsLanded = 0;
  mistakes = 0;
  cine: Cine = 'none';
  cineT = 0;
  slowT = 0;
  /** parada de impacto restante (s): a sessão congela o desenho; a entrada fica guardada */
  hitStopT = 0;
  /** dica ativa (a arte escolhe o texto) e por quanto tempo ainda */
  hint: HintId | null = null;
  hintT = 0;
  result: MatchResult | null = null;
  events: MatchEvent[] = [];
  readonly stats = { punches: 0, dodges: 0, ducks: 0, perfects: 0, blocks: 0, damageTaken: 0, starsUsed: 0 };
  private rng: Rng;
  private diff: (typeof DIFF)['normal'];
  private opts: Required<MatchOptions>;
  private cineMark = 0;
  /** últimos socos na guarda fechada (para o jacaré LER o soco repetido) */
  private tierHist: { tier: PunchTier; t: number }[] = [];
  private cargaStars = 0;
  private cargaDone = false;
  private by: FightStats['by'] = 'decision';
  private lastPattern = -1;
  private patternCount = 0;
  private sinceTaunt = 9;
  private kdKT = 0;
  private altaT = 0;
  private blockedRecently = 0;
  private shown = new Set<HintId>();
  private stashPad = mkPad();
  private mergedPad = mkPad();
  private hasStash = false;

  constructor(difficulty: DifficultyId = 'normal', seed = 1337, opts: MatchOptions = {}) {
    this.diff = DIFF[difficulty] ?? DIFF.normal;
    this.opts = { tutorial: opts.tutorial ?? false, champion: opts.champion ?? false };
    this.rng = new Rng(seed);
    this.k = {
      hp: K_HP, maxHp: K_HP, energy: K_ENERGY, action: 'idle', punch: null, pPhase: 'recover', pT: 0, pLen: 0, didHit: false,
      dodgeDir: 1, dodgeT: 0, dodgeStart: -9, dodgeCd: 0, duckT: 0, duckStart: -9, duckCd: 0, hurtT: 0, guarding: false, guardAt: -9,
      buffer: null, bufferT: 0, sinceStrike: 9, slow: 1, startT: -9, getup: 0, downCount: 0,
    };
    const hp = Math.round(G_HP * this.diff.gatorHp * (this.opts.champion ? CHAMPION.hp : 1));
    this.g = {
      hp, maxHp: hp, phase: 1, mode: 'guard', guard: 'alta', attack: null, tele: 0, teleMax: 1, plan: [], hitIdx: 0,
      recoverT: 0, counterT: 0, counterPerfect: false, dizzyT: 0, groggyT: 0, tauntT: 0, tauntHits: 0, tauntStar: false, thinkT: 1.2, stanceT: 1.6, stance: 'alta',
      groggyUsed: 0, flinchT: 0, coverT: 0, attackCount: 0, readTier: null,
    };
    this.beginRound(1);
  }

  get over() { return this.result !== null; }
  /** o golpe final está liberado (jacaré grogue) */
  get orelhadaReady() { return this.g.mode === 'groggy' && this.cine === 'none' && this.flow === 'fight'; }
  /** o que o botão ESPECIAL faz agora */
  get specialKind(): SpecialKind {
    if (this.orelhadaReady) return 'finale';
    if (this.stars > 0 && this.canCarga()) return 'carga';
    return null;
  }
  get furyOn() { return this.furyT > 0; }
  /** segundos de round já jogados */
  get elapsed() { return ROUND_TIME - this.roundT; }
  private emit(type: MatchEventType, extra: Partial<MatchEvent> = {}) { this.events.push({ type, ...extra }); }
  private stop(s: number) { if (s > this.hitStopT) this.hitStopT = s; }

  /** O fator de tempo da sessão (câmera lenta na esquiva perfeita e no golpe final). */
  get timeScale() { return this.slowT > 0 ? PERFECT_SLOWMO : this.cine === 'orelhada' && this.cineT > 1.1 && this.cineT < 1.9 ? 0.35 : 1; }

  // ───────────────────────── laço ─────────────────────────
  step(dt: number, rawPad: MiniPad) {
    if (this.result) return;
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) this.hint = null; }
    // parada de impacto: o relógio da luta espera, mas os toques ficam guardados
    if (this.hitStopT > 0) {
      this.hitStopT -= dt;
      for (const b of BTNS) if (rawPad[b].pressed) { this.stashPad[b].pressed = true; this.hasStash = true; }
      return;
    }
    const pad = this.merged(rawPad);
    if (this.slowT > 0) this.slowT = Math.max(0, this.slowT - dt);
    const d = dt * this.timeScale;
    this.time += d;
    if (this.cine !== 'none') { this.stepCine(d, pad); return; }
    switch (this.flow) {
      case 'intro':
        this.flowT -= d;
        if (this.flowT <= 0) { this.flow = 'fight'; this.roundT = ROUND_TIME; this.g.thinkT = gridDelay(this.time, SCRIPT[this.round].think[0] + 0.8); }
        break;
      case 'fight': this.stepFight(d, pad); break;
      case 'kdG': this.stepKdG(d); break;
      case 'kdK': this.stepKdK(d, pad); break;
      case 'break':
        this.flowT -= d;
        this.k.energy = Math.min(K_ENERGY, this.k.energy + ENERGY_REGEN * d * 2);
        // depois de 2,5 s o jogador pode pular o intervalo com um soco
        if (this.flowT <= BREAK_TIME - 2.5 && PUNCH_BUTTONS.some((p) => pad[p].pressed)) this.flowT = 0;
        if (this.flowT <= 0) this.beginRound((this.round + 1) as 2 | 3);
        break;
      case 'end': break;
    }
  }

  private merged(pad: MiniPad): MiniPad {
    if (!this.hasStash) return pad;
    const m = this.mergedPad;
    for (const b of BTNS) {
      m[b].held = pad[b].held;
      m[b].pressed = pad[b].pressed || this.stashPad[b].pressed;
      m[b].released = pad[b].released;
      this.stashPad[b].pressed = false;
    }
    this.hasStash = false;
    return m;
  }

  private beginRound(n: 1 | 2 | 3) {
    this.round = n;
    this.g.phase = n;
    this.flow = 'intro';
    this.flowT = INTRO_TIME;
    this.roundT = ROUND_TIME;
    this.k.energy = K_ENERGY;
    this.k.action = 'idle';
    this.k.punch = null;
    this.k.buffer = null;
    this.g.mode = 'guard';
    this.g.attack = null;
    this.g.plan.length = 0;
    this.g.thinkT = 1.2;
    this.tierHist.length = 0;
    this.sinceTaunt = 9;
    this.emit('bell');
    this.emit('roundStart', { n });
    if (n > 1) this.emit('phase', { n });
  }

  private stepFight(dt: number, pad: MiniPad) {
    if (pad.especial.pressed) { if (!this.tryOrelhada()) this.tryCarga(); }
    if (this.cine !== 'none') return;
    this.stepKarimbo(dt, pad);
    this.stepGator(dt);
    this.stepFury(dt);
    this.stepHints(dt);
    if (this.flow !== 'fight') return;
    if (this.k.hp <= 0 && this.k.action !== 'down') { this.beginKdK(); return; }
    // o round não acaba com o jacaré grogue (a janela da ORELHADA é sagrada)
    if (this.g.mode !== 'groggy') this.roundT -= dt;
    if (this.roundT <= 0) this.endRound();
  }

  // ───────────────────────── Karimbo ─────────────────────────
  private stepKarimbo(dt: number, pad: MiniPad) {
    const k = this.k;
    k.sinceStrike += dt;
    if (k.hurtT > 0) { k.hurtT -= dt; if (k.hurtT <= 0 && k.action === 'hurt') k.action = 'idle'; }
    if (k.dodgeCd > 0) k.dodgeCd -= dt;
    if (k.duckCd > 0) k.duckCd -= dt;
    if (k.dodgeT > 0) { k.dodgeT -= dt; if (k.dodgeT <= 0 && k.action === 'dodge') k.action = 'idle'; }
    if (k.duckT > 0) k.duckT -= dt;
    if (k.bufferT > 0) { k.bufferT -= dt; if (k.bufferT <= 0) k.buffer = null; }
    // energia volta depois de uma pausa nos golpes
    if (k.sinceStrike > ENERGY_REGEN_DELAY) k.energy = Math.min(K_ENERGY, k.energy + ENERGY_REGEN * dt);
    if (pad.guarda.pressed) k.guardAt = this.time;
    if (k.action === 'hurt') { k.guarding = false; return; }
    const canReact = k.action !== 'down' && !(k.action === 'punch' && k.pPhase !== 'recover');
    // esquiva (cancela a recuperação do golpe)
    if ((pad.esqE.pressed || pad.esqD.pressed) && k.dodgeCd <= 0 && canReact) {
      k.action = 'dodge';
      k.dodgeDir = pad.esqE.pressed ? -1 : 1;
      k.dodgeT = DODGE_INVULN;
      k.dodgeStart = this.time;
      k.dodgeCd = DODGE_INVULN + DODGE_COOLDOWN;
      k.punch = null;
      k.buffer = null;
      this.stats.dodges++;
      this.emit('dodge');
    } else if (pad.abaixar.pressed && k.duckCd <= 0 && canReact && k.action !== 'dodge') {
      k.action = 'duck';
      k.duckT = DUCK_MIN;
      k.duckStart = this.time;
      k.punch = null;
      k.buffer = null;
      this.stats.ducks++;
      this.emit('duck');
    }
    // abaixado: segura enquanto o botão estiver apertado (e pelo mínimo)
    if (k.action === 'duck' && k.duckT <= 0 && !pad.abaixar.held) { k.action = 'idle'; k.duckCd = DUCK_COOLDOWN; }
    // golpes
    let want: Punch | null = null;
    for (const p of PUNCH_BUTTONS) if (pad[p].pressed) { want = p; break; }
    if (want) {
      if (k.action === 'duck' && k.duckT <= 0) { k.action = 'idle'; k.duckCd = DUCK_COOLDOWN; }
      if (k.action === 'idle' || k.action === 'guard') this.startPunch(want);
      else if (k.action === 'punch' || k.action === 'duck') { k.buffer = want; k.bufferT = BUFFER_TIME; }
    }
    if (k.action === 'punch') this.stepPunch(dt);
    k.guarding = pad.guarda.held && (k.action === 'idle' || k.action === 'guard');
    if (k.guarding) k.action = 'guard';
    else if (k.action === 'guard') k.action = 'idle';
  }

  private startPunch(p: Punch) {
    const k = this.k, def = PUNCHES[p];
    const tired = k.energy < def.energy;
    const slow = (tired ? TIRED_SLOW : 1) * (this.furyT > 0 ? FURY_SPEED : 1);
    k.energy = Math.max(0, k.energy - def.energy);
    k.sinceStrike = 0;
    k.action = 'punch';
    k.punch = p;
    k.pPhase = 'wind';
    k.pT = 0;
    k.pLen = def.wind * slow;
    k.didHit = false;
    k.slow = slow;
    k.startT = this.time;
    this.stats.punches++;
    if (tired) this.emit('tired');
    this.emit('punch', { punch: p });
  }

  private stepPunch(dt: number) {
    const k = this.k, def = PUNCHES[k.punch!];
    const slow = k.slow;
    k.pT += dt;
    if (k.pPhase === 'wind' && k.pT >= k.pLen) {
      k.pPhase = 'active'; k.pT = 0; k.pLen = def.active * slow;
      this.resolveHit(k.punch!);
    } else if (k.pPhase === 'active' && k.pT >= k.pLen) {
      k.pPhase = 'recover'; k.pT = 0; k.pLen = def.recover * slow;
      if (!k.didHit) this.emit('whiff', { punch: k.punch! });
    } else if (k.pPhase === 'recover' && k.pT >= k.pLen) {
      k.action = 'idle';
      const b = k.buffer;
      k.punch = null;
      k.buffer = null;
      if (b) this.startPunch(b);
    }
  }

  /** O soco chega: guarda do jacaré, contra-ataque, leitura de repetição, combo, estrelas, Fúria e pontos. */
  private resolveHit(p: Punch) {
    const g = this.g, def = PUNCHES[p];
    if (g.mode === 'ko' || g.mode === 'down') return;
    let mult = GUARD_PASS[g.guard][def.tier];
    const countering = g.counterT > 0;
    if (countering) mult = Math.max(mult, GUARD_PASS.aberta[def.tier]) * COUNTER_MULT;
    // combo JAB → DIRETO → CRUZADO, cada golpe até 0,45 s depois do anterior: o último vale +25%
    const expect = this.comboIdx === 0 ? 'jab' : this.comboIdx === 1 ? 'direto' : 'cruzado';
    const inTime = this.k.startT - this.comboT <= COMBO_GAP;
    let comboDone = false;
    if (def.tier === expect && (this.comboIdx === 0 || inTime)) {
      this.comboIdx++;
      if (this.comboIdx === 3) { mult *= COMBO_FINISH_BONUS; this.combo++; this.comboIdx = 0; comboDone = true; }
    } else this.comboIdx = def.tier === 'jab' ? 1 : 0;
    this.comboT = this.k.startT;
    const dmg = def.dmg * mult * (this.furyT > 0 ? FURY_DMG : 1);
    const blocked = !countering && ((g.guard === 'alta' && def.tier !== 'gancho') || (g.guard === 'baixa' && def.tier === 'gancho') || g.guard === 'cobertura');
    if (blocked) this.emit('block', { punch: p });
    g.hp = Math.max(0, g.hp - dmg);
    this.scoreK += dmg;
    this.k.didHit = true;
    this.hitsLanded++;
    this.streak++;
    // o jacaré LÊ o soco repetido (mesmo tipo, vários seguidos): se fecha e contra-ataca
    if (g.mode === 'guard') {
      this.tierHist.push({ tier: def.tier, t: this.time });
      while (this.tierHist.length && (this.time - this.tierHist[0].t > READ_WINDOW || this.tierHist.length > READ_HITS)) this.tierHist.shift();
      if (this.tierHist.length >= READ_HITS && this.tierHist.every((h) => h.tier === def.tier)) {
        this.tierHist.length = 0;
        g.mode = 'cover'; g.coverT = COVER_TIME; g.readTier = def.tier;
        this.emit('read', { tier: def.tier });
        this.showHint('lido');
      }
    }
    if (g.mode === 'taunt') {
      g.tauntHits++;
      if (!g.tauntStar) { g.tauntStar = true; this.addStar(); }
    }
    this.emit('hit', { punch: p, amount: dmg });
    if (countering) {
      this.emit('counter', { amount: dmg });
      if (g.counterPerfect) { g.counterPerfect = false; this.addStar(); }
    }
    if (comboDone) { this.emit('combo', { n: this.combo }); this.addFury(FURY_COMBO); }
    if (!blocked) this.addFury(FURY_HIT);
    this.stop(countering ? 0.15 : def.stop);
    g.flinchT = 0.12;
    if (g.hp <= 0) { this.gatorZero(); return; }
    if (this.streak >= DIZZY_STREAK && g.mode !== 'dizzy' && g.mode !== 'groggy') {
      this.streak = 0;
      g.mode = 'dizzy'; g.dizzyT = DIZZY_TIME; g.attack = null; g.plan.length = 0; g.guard = 'tonto';
      this.emit('dizzy');
    }
  }

  private addStar() {
    if (this.stars >= MAX_STARS) return;
    this.stars++;
    this.emit('star', { n: this.stars });
  }

  private addFury(v: number) {
    if (this.furyT > 0) return;
    this.fury = Math.min(FURY_MAX, this.fury + v);
    if (this.fury >= FURY_MAX) { this.furyT = FURY_TIME; this.emit('fury'); }
  }

  private stepFury(dt: number) {
    if (this.furyT > 0) {
      this.furyT -= dt;
      this.fury = FURY_MAX * Math.max(0, this.furyT / FURY_TIME);
      if (this.furyT <= 0) { this.furyT = 0; this.fury = 0; this.emit('furyEnd'); }
    } else if (this.fury > 0) this.fury = Math.max(0, this.fury - FURY_DECAY * dt);
  }

  // ───────────────────────── jacaré ─────────────────────────
  private teleOf(kind: AttackKind) {
    let t = ATTACKS[kind].tele * ROUND_TELE[this.round] * this.diff.tele * (this.opts.champion ? CHAMPION.tele : 1);
    if (this.opts.tutorial && this.round === 1) t *= 1.25;
    return Math.max(QUARTER * 2, Math.round(t / QUARTER) * QUARTER);
  }

  private startAttack(kind: AttackKind, speed = 1) {
    const g = this.g;
    g.mode = 'tele';
    g.attackCount++;
    g.attack = kind;
    g.hitIdx = 0;
    g.teleMax = this.teleOf(kind) * speed;
    g.tele = g.teleMax;
    g.guard = 'ataque';
    this.emit('gatorAttack', { attack: kind });
    // a primeira cabeçada e a primeira rabada/mordidona ensinam a defesa certa
    if (kind === 'cabecada' && this.stats.ducks === 0) this.showHint('abaixar');
    else if ((kind === 'rabada' || kind === 'mordidona') && this.stats.dodges === 0) this.showHint('esquiva');
  }

  private goGuard(think?: number) {
    const g = this.g;
    const [a, b] = SCRIPT[this.round].think;
    g.mode = 'guard';
    g.guard = g.stance;
    g.thinkT = gridDelay(this.time, think ?? a + this.rng.next() * (b - a));
    g.stanceT = this.round === 3 ? 0.7 + this.rng.next() * 0.6 : 1.1 + this.rng.next() * 0.9;
  }

  private decide() {
    const g = this.g, sc = SCRIPT[this.round];
    this.patternCount++;
    if (this.sinceTaunt > 10 && this.patternCount % sc.tauntEvery === 0) {
      g.mode = 'taunt'; g.tauntT = gridDelay(this.time, 1.5); g.tauntHits = 0; g.tauntStar = false; g.guard = 'aberta';
      this.sinceTaunt = 0;
      this.emit('taunt');
      return;
    }
    const pick = pickPattern(this.round, this.elapsed, this.rng, this.lastPattern);
    this.lastPattern = pick.index;
    g.plan.length = 0;
    for (const s of pick.steps) g.plan.push(s);
    this.startAttack(g.plan.shift()!);
  }

  private stepGator(dt: number) {
    const g = this.g, k = this.k;
    this.sinceTaunt += dt;
    if (g.flinchT > 0) g.flinchT -= dt;
    if (g.counterT > 0) { g.counterT -= dt; if (g.counterT <= 0) g.counterPerfect = false; }
    switch (g.mode) {
      case 'guard': {
        g.guard = g.stance;
        g.stanceT -= dt;
        if (g.stanceT <= 0) { g.stance = g.stance === 'alta' ? 'baixa' : 'alta'; g.stanceT = (this.round === 3 ? 0.7 : 1.1) + this.rng.next() * 0.9; }
        this.altaT = g.guard === 'alta' ? this.altaT + dt : 0;
        g.thinkT -= dt;
        if (g.thinkT <= 0 && k.action !== 'down') this.decide();
        break;
      }
      case 'cover': {
        g.guard = 'cobertura';
        g.coverT -= dt;
        if (g.coverT <= 0) { g.readTier = null; this.startAttack('patada', 0.75); }
        break;
      }
      case 'tele': {
        g.guard = 'ataque';
        g.tele -= dt;
        if (g.tele <= 0) this.impact();
        break;
      }
      case 'recover': {
        g.guard = 'aberta';
        g.recoverT -= dt;
        if (g.recoverT <= 0) {
          if (g.plan.length) this.startAttack(g.plan.shift()!);
          else this.goGuard();
        }
        break;
      }
      case 'taunt': {
        g.guard = 'aberta';
        g.tauntT -= dt;
        if (g.tauntT <= 0) {
          if (g.tauntHits >= 3) this.startAttack('contrape');
          else this.goGuard(0.4 + this.rng.next() * 0.4);
        }
        break;
      }
      case 'dizzy': {
        g.guard = 'tonto';
        g.dizzyT -= dt;
        if (g.dizzyT <= 0) { g.stanceT = 0.8; this.goGuard(0.8); }
        break;
      }
      case 'groggy': {
        g.guard = 'tonto';
        g.groggyT -= dt;
        if (g.groggyT <= 0) {
          // não deu o golpe final: ele se recupera e volta furioso
          g.hp = Math.round(g.maxHp * GROGGY_RECOVER); g.groggyUsed++;
          g.stanceT = 0.8; this.goGuard(0.9);
          this.emit('rise', { n: 0 });
        }
        break;
      }
      case 'ko': case 'down': break;
    }
  }

  /** Impacto de um golpe do jacaré sobre o Karimbo: esquiva, abaixar, guarda (perfeita ou não) ou dano cheio. */
  private impact() {
    const g = this.g, k = this.k, kind = g.attack!, def = ATTACKS[kind];
    const idx = g.hitIdx;
    const last = !def.more || idx >= def.more.length;
    let dmg = (idx === 0 ? def.dmg : def.more![idx - 1].dmg) * this.diff.gatorDmg * (this.opts.champion ? CHAMPION.dmg : 1);
    if (this.opts.tutorial && this.round === 1) dmg *= 0.7;
    const side = def.sides?.[idx] ?? 0;
    const dodged = k.action === 'dodge' && k.dodgeT > 0 && (side === 0 || k.dodgeDir === -side);
    const ducked = def.duck && k.action === 'duck';
    let safe = false;
    if (dodged || ducked) {
      safe = true;
      const since = this.time - (dodged ? k.dodgeStart : k.duckStart);
      const perfect = since <= PERFECT_WINDOW;
      this.emit('gatorMiss', { attack: kind });
      k.energy = Math.min(K_ENERGY, k.energy + ENERGY_ON_DEFEND);
      if (perfect) {
        this.emit('perfect'); this.stats.perfects++; this.slowT = 0.3; this.addFury(FURY_PERFECT);
        if (last) g.counterPerfect = true;
      }
      if (last) g.counterT = def.counter * (perfect ? 1.25 : 1);
    } else if (k.guarding && def.guard) {
      const perfectGuard = this.time - k.guardAt <= PERFECT_GUARD_WINDOW;
      if (perfectGuard) {
        safe = true;
        this.emit('perfectGuard', { attack: kind });
        this.stats.perfects++;
        k.energy = Math.min(K_ENERGY, k.energy + ENERGY_ON_DEFEND);
        this.addFury(FURY_PERFECT);
        if (last) { g.counterT = def.counter; g.counterPerfect = true; }
      } else {
        dmg *= GUARD_DAMAGE;
        this.stats.blocks++;
        this.emit('block', { attack: kind });
      }
    }
    if (!safe) {
      k.hp = Math.max(0, k.hp - dmg);
      this.scoreG += dmg;
      this.stats.damageTaken += dmg;
      this.mistakes++;
      this.streak = 0;
      this.comboIdx = 0;
      this.stars = 0;
      this.fury = Math.max(0, this.fury - FURY_LOSS_ON_HIT);
      if (this.furyT > 0) this.furyT = Math.max(0, this.furyT - 1.5);
      k.action = 'hurt';
      k.hurtT = k.guarding ? 0.12 : 0.38;
      k.punch = null;
      k.buffer = null;
      this.emit('gatorHit', { attack: kind, amount: dmg });
      this.stop(kind === 'mordidona' ? 0.16 : kind === 'rabada' ? 0.12 : 0.07);
    }
    if (!last) {
      // próximo golpe do mesmo ataque (chapelada volta, giro gira de novo)
      g.hitIdx++;
      // o intervalo entre golpes do mesmo ataque NÃO encurta por round: a esquiva precisa de 0,54 s entre uma e outra
      g.teleMax = Math.round(def.more![idx].gap / QUARTER) * QUARTER;
      g.tele = g.teleMax;
      return;
    }
    g.attack = null;
    g.mode = 'recover';
    g.recoverT = gridDelay(this.time, Math.max(0.5, def.counter * 0.8) + SCRIPT[this.round].stepGap);
  }

  /** A vida do jacaré zerou: queda e contagem (rounds 1 e 2) ou grogue com a ORELHADA liberada (3º nocaute ou round 3). */
  private gatorZero() {
    const g = this.g;
    this.kdG++;
    this.scoreK += KD_POINTS;
    g.attack = null; g.plan.length = 0; g.counterT = 0;
    if (this.round === ROUNDS || this.kdG >= 3) {
      g.mode = 'groggy'; g.groggyT = GROGGY_TIME; g.guard = 'tonto';
      this.emit('groggy');
      return;
    }
    g.mode = 'down'; g.guard = 'tonto';
    this.flow = 'kdG'; this.flowT = KD_G_TIME;
    this.k.action = this.k.action === 'punch' ? 'idle' : this.k.action;
    this.cineMark = 0;
    this.emit('kdG', { n: this.kdG });
  }

  private stepKdG(dt: number) {
    this.flowT -= dt;
    const step = KD_G_TIME / 8;
    const n = Math.min(8, Math.floor((KD_G_TIME - this.flowT) / step) + 1);
    if (n !== this.cineMark) { this.cineMark = n; this.emit('kdGCount', { n }); }
    this.k.energy = Math.min(K_ENERGY, this.k.energy + ENERGY_REGEN * dt);
    if (this.flowT <= 0) {
      const g = this.g;
      g.hp = Math.round(g.maxHp * G_RISE[Math.min(this.kdG, 3) - 1]);
      g.stanceT = 0.8;
      this.flow = 'fight';
      this.goGuard(1.1);
      this.emit('rise', { n: this.kdG });
    }
  }

  // ───────────────────────── Karimbo no chão ─────────────────────────
  private beginKdK() {
    const k = this.k;
    this.kdK++;
    this.scoreG += KD_POINTS;
    k.action = 'down'; k.punch = null; k.buffer = null; k.guarding = false;
    k.getup = 0; k.downCount = 0;
    this.kdKT = 0;
    this.stars = 0; this.fury = 0; this.furyT = 0;
    this.g.attack = null; this.g.plan.length = 0;
    this.g.mode = 'guard'; this.g.thinkT = 99;
    this.emit('kdK', { n: this.kdK });
    if (this.kdK >= MAX_KD_K) { this.by = 'tko'; this.startLose(); return; }
    this.flow = 'kdK';
  }

  private stepKdK(dt: number, pad: MiniPad) {
    const k = this.k;
    this.kdKT += dt;
    const n = Math.floor(this.kdKT / KD_K_STEP) + 1;
    if (n !== k.downCount) { k.downCount = n; if (n <= KD_K_COUNT) this.emit('kdKCount', { n }); }
    let taps = 0;
    for (const b of BTNS) if (pad[b].pressed) taps++;
    k.getup = Math.max(0, Math.min(1, k.getup + taps * GETUP_PER_TAP - GETUP_DECAY * dt));
    if (k.getup >= 1) {
      k.hp = Math.round(k.maxHp * K_RISE[Math.min(this.kdK, 2) - 1]);
      k.energy = 60; k.action = 'idle'; k.getup = 0; k.hurtT = 0;
      this.flow = 'fight';
      this.g.thinkT = 1.3;
      this.emit('getup', { n: this.kdK });
    } else if (n > KD_K_COUNT) { this.by = 'tko'; this.startLose(); }
  }

  // ───────────────────────── rounds, intervalo e decisão ─────────────────────────
  private endRound() {
    this.g.attack = null; this.g.plan.length = 0;
    if (this.g.mode === 'tele' || this.g.mode === 'recover' || this.g.mode === 'taunt' || this.g.mode === 'cover') this.g.mode = 'guard';
    this.g.thinkT = 99;
    this.k.punch = null; this.k.buffer = null;
    if (this.k.action === 'punch' || this.k.action === 'dodge' || this.k.action === 'duck' || this.k.action === 'guard') this.k.action = 'idle';
    this.emit('roundEnd', { n: this.round });
    if (this.round >= ROUNDS) {
      this.cine = 'decision'; this.cineT = 0; this.flow = 'end';
      this.emit('decision');
      return;
    }
    this.flow = 'break'; this.flowT = BREAK_TIME;
    this.k.hp = Math.min(this.k.maxHp, this.k.hp + this.k.maxHp * BREAK_HEAL);
    this.g.hp = Math.min(this.g.maxHp, this.g.hp + this.g.maxHp * BREAK_HEAL);
  }

  private startLose() {
    this.cine = 'lose'; this.cineT = 0; this.flow = 'end';
    this.emit('lose');
  }

  // ───────────────────────── especiais e cinemáticas ─────────────────────────
  /** Aperta o botão ORELHADA! (só vale com o jacaré grogue). */
  tryOrelhada(): boolean {
    if (!this.orelhadaReady) return false;
    this.cine = 'orelhada';
    this.cineT = 0;
    this.k.action = 'idle';
    this.by = 'orelhada';
    this.cineMark = 0;
    this.emit('orelhada');
    return true;
  }

  private canCarga() {
    const g = this.g, k = this.k;
    return this.flow === 'fight' && this.cine === 'none' && this.stars > 0 && (k.action === 'idle' || k.action === 'guard') && g.mode !== 'groggy' && g.mode !== 'down' && g.mode !== 'ko';
  }

  /** ORELHADA carregada: gasta as estrelas num golpe que ignora a guarda (dano × (1 + estrelas)). */
  tryCarga(): boolean {
    if (!this.canCarga()) return false;
    this.cine = 'carga';
    this.cineT = 0;
    this.cargaDone = false;
    this.cargaStars = this.stars;
    this.stats.starsUsed += this.stars;
    this.stars = 0;
    this.k.action = 'idle'; this.k.guarding = false;
    this.g.attack = null; this.g.plan.length = 0;
    if (this.g.mode === 'tele' || this.g.mode === 'recover' || this.g.mode === 'taunt') this.g.mode = 'guard';
    this.emit('carga', { n: this.cargaStars });
    return true;
  }

  private stepCine(dt: number, pad: MiniPad) {
    void pad;
    this.cineT += dt;
    const g = this.g;
    if (this.cine === 'carga') {
      if (!this.cargaDone && this.cineT >= CARGA_WIND) {
        this.cargaDone = true;
        const dmg = CARGA_DMG * (1 + this.cargaStars) * (this.furyT > 0 ? FURY_DMG : 1);
        g.hp = Math.max(0, g.hp - dmg);
        this.scoreK += dmg;
        this.hitsLanded++;
        this.emit('hit', { amount: dmg });
        this.emit('impact', { n: this.cargaStars });
        this.stop(0.2);
        g.flinchT = 0.2;
        this.addFury(20);
        if (g.hp <= 0) { this.cine = 'none'; this.gatorZero(); return; }
        g.mode = 'dizzy'; g.dizzyT = 1.4; g.guard = 'tonto';
      }
      if (this.cineT >= CARGA_TIME) this.cine = 'none';
    } else if (this.cine === 'orelhada') {
      if (this.cineT >= 1.6 && !this.cineMark) { this.cineMark = 1; this.emit('impact'); }
      if (this.cineT >= ORELHADA_TIME) { this.cine = 'count'; this.cineT = 0; g.mode = 'ko'; this.cineMark = 0; this.flow = 'end'; this.emit('ko'); }
    } else if (this.cine === 'count') {
      const n = Math.min(10, Math.floor(this.cineT / (COUNT_TIME / 10)) + 1);
      if (n !== this.cineMark) { this.cineMark = n; this.emit('count', { n }); }
      if (this.cineT >= COUNT_TIME + 0.4) this.finish(true);
    } else if (this.cine === 'lose') {
      if (this.cineT >= 2.8) this.finish(false);
    } else if (this.cine === 'decision') {
      if (this.cineT >= 3.2) {
        const win = this.scoreK > this.scoreG;
        this.by = 'decision';
        this.finish(win);
      }
    }
  }

  private finish(win: boolean) {
    const stats: FightStats = {
      win, by: this.by, time: this.time, damageTaken: this.stats.damageTaken, maxHp: this.k.maxHp,
      perfects: this.stats.perfects, starsUsed: this.stats.starsUsed, knockdownsTaken: this.kdK,
    };
    this.result = { outcome: win ? 'win' : 'lose', time: this.time, mistakes: this.mistakes, by: this.by, grade: gradeOf(stats), stats };
    this.emit(win ? 'win' : 'lose');
  }

  // ───────────────────────── dicas (a primeira luta ensina lendo a situação) ─────────────────────────
  private showHint(id: HintId) {
    if (this.shown.has(id)) return;
    this.shown.add(id);
    this.hint = id;
    this.hintT = 2.8;
    this.emit('hint', { hint: id });
  }

  private stepHints(_dt: number) {
    const k = this.k;
    if (this.round === 1 && this.elapsed > 5 && this.stats.punches === 0) this.showHint('soco');
    if (this.altaT > 2.5 && this.hitsLanded > 1 && this.g.guard === 'alta') this.showHint('gancho');
    if (k.energy < 12) this.showHint('descansa');
  }

  /** Gente de teste/arte: segundos que faltam para o impacto do golpe em curso (Infinity se não há). */
  teleLeft(): number { return this.g.mode === 'tele' ? this.g.tele : Infinity; }
}
