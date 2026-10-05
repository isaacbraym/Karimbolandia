/**
 * A luta de boxe (simulação headless e determinística): o Karimbo (de costas) contra o jacaré dançante.
 * Sem arte, sem DOM: a sessão (index.ts) lê o estado daqui e os `events` para desenhar e tocar sons.
 * PRNG com semente fixa por luta. Os bots dos testes jogam por esta mesma interface.
 */
import { Rng } from '../../../../core/math';
import type { MiniPad } from '../../../../core/input';
import type { DifficultyId } from '../../../../core/difficulty';
import {
  ATTACKS, COMBO_FINISH_BONUS, COMBO_GAP, COUNTER_MULT, COVER_HITS, COVER_TIME, COVER_WINDOW, COUNT_TIME, DIFF, DIZZY_STREAK, DIZZY_TIME, DODGE_COOLDOWN, DODGE_INVULN,
  ENERGY_REGEN, ENERGY_REGEN_DELAY, GROGGY_RECOVER, GROGGY_TIME, GUARD_DAMAGE, GUARD_PASS, G_HP, K_ENERGY, K_HP, ORELHADA_TIME,
  PERFECT_SLOWMO, PERFECT_WINDOW, PHASE2_AT, PHASE3_AT, PHASE_TELE, PUNCHES, PUNCH_BUTTONS, TIRED_SLOW,
  type AttackKind, type Guard, type Punch,
} from './rules';

export type MatchEventType =
  | 'bell' | 'punch' | 'hit' | 'whiff' | 'block' | 'dodge' | 'perfect' | 'counter' | 'combo' | 'dizzy' | 'groggy' | 'phase'
  | 'gatorAttack' | 'gatorHit' | 'gatorMiss' | 'taunt' | 'orelhada' | 'impact' | 'count' | 'ko' | 'lose' | 'win' | 'tired';
export interface MatchEvent { type: MatchEventType; amount?: number; punch?: Punch; attack?: AttackKind; n?: number }

export type KAction = 'idle' | 'punch' | 'dodge' | 'guard' | 'hurt' | 'down';
export type PunchPhase = 'wind' | 'active' | 'recover';
export type GMode = 'guard' | 'tele' | 'recover' | 'taunt' | 'dizzy' | 'groggy' | 'ko' | 'cover';
export type Cine = 'none' | 'orelhada' | 'count' | 'lose';

export interface KState {
  hp: number; maxHp: number; energy: number;
  action: KAction;
  punch: Punch | null; pPhase: PunchPhase; pT: number; pLen: number; didHit: boolean;
  dodgeDir: -1 | 1; dodgeT: number; dodgeStart: number; dodgeCd: number;
  hurtT: number; guarding: boolean;
  /** golpe guardado durante a recuperação (vale até `bufferT` acabar) */
  buffer: Punch | null; bufferT: number;
  sinceStrike: number;
  /** fator de lentidão do golpe em curso (sem energia = 1,4) */
  slow: number;
  /** instante em que o golpe em curso começou (o combo mede de começo a começo) */
  startT: number;
}
export interface GState {
  hp: number; maxHp: number; phase: 1 | 2 | 3;
  mode: GMode; guard: Guard;
  attack: AttackKind | null; tele: number; teleMax: number; plan: AttackKind[];
  recoverT: number; counterT: number; dizzyT: number; groggyT: number; tauntT: number; tauntHits: number;
  thinkT: number; stanceT: number; stance: 'alta' | 'baixa'; groggyUsed: number; flinchT: number; coverT: number;
  /** quantos ataques ele já lançou (a arte alterna a mão do golpe) */
  attackCount: number;
}

export interface MatchResult { outcome: 'win' | 'lose'; time: number; mistakes: number }

export class BoxingMatch {
  readonly k: KState;
  readonly g: GState;
  time = 0;
  /** relógio da luta (para em câmera lenta/cinemáticas só o que a sessão decidir) */
  combo = 0;
  comboIdx = 0;
  comboT = -9;
  streak = 0;
  hitsLanded = 0;
  mistakes = 0;
  cine: Cine = 'none';
  cineT = 0;
  slowT = 0;
  result: MatchResult | null = null;
  events: MatchEvent[] = [];
  /** o botão ORELHADA! está liberado (jacaré grogue) */
  get orelhadaReady() { return this.g.mode === 'groggy' && this.cine === 'none'; }
  private rng: Rng;
  private diff: (typeof DIFF)['normal'];
  private cineMark = 0;
  /** instantes dos últimos acertos (para o jacaré ler soco repetido) */
  private recentHits: number[] = [];

  constructor(difficulty: DifficultyId = 'normal', seed = 1337) {
    this.diff = DIFF[difficulty] ?? DIFF.normal;
    this.rng = new Rng(seed);
    this.k = {
      hp: K_HP, maxHp: K_HP, energy: K_ENERGY, action: 'idle', punch: null, pPhase: 'recover', pT: 0, pLen: 0, didHit: false,
      dodgeDir: 1, dodgeT: 0, dodgeStart: -9, dodgeCd: 0, hurtT: 0, guarding: false, buffer: null, bufferT: 0, sinceStrike: 9, slow: 1, startT: -9,
    };
    const hp = Math.round(G_HP * this.diff.gatorHp);
    this.g = {
      hp, maxHp: hp, phase: 1, mode: 'guard', guard: 'alta', attack: null, tele: 0, teleMax: 1, plan: [],
      recoverT: 0, counterT: 0, dizzyT: 0, groggyT: 0, tauntT: 0, tauntHits: 0, thinkT: 0.9, stanceT: 1.6, stance: 'alta', groggyUsed: 0, flinchT: 0, coverT: 0, attackCount: 0,
    };
    this.events.push({ type: 'bell' });
  }

  get over() { return this.result !== null; }
  private emit(type: MatchEventType, extra: Partial<MatchEvent> = {}) { this.events.push({ type, ...extra }); }

  /** O fator de tempo da sessão (câmera lenta na esquiva perfeita e no golpe final). */
  get timeScale() { return this.slowT > 0 ? PERFECT_SLOWMO : this.cine === 'orelhada' && this.cineT > 1.1 && this.cineT < 1.9 ? 0.35 : 1; }

  step(dt: number, pad: MiniPad) {
    if (this.result) return;
    // câmera lenta (esquiva perfeita): o relógio da luta anda mais devagar
    if (this.slowT > 0) this.slowT = Math.max(0, this.slowT - dt);
    const d = dt * this.timeScale;
    this.time += d;
    if (this.cine !== 'none') { this.stepCine(d); return; }
    if (pad.especial.pressed) this.tryOrelhada();
    if (this.cine !== 'none') return;
    this.stepKarimbo(d, pad);
    this.stepGator(d);
    this.phaseCheck();
    this.checkEnd();
  }

  // ───────────────────────── Karimbo ─────────────────────────
  private stepKarimbo(dt: number, pad: MiniPad) {
    const k = this.k;
    k.sinceStrike += dt;
    if (k.hurtT > 0) { k.hurtT -= dt; if (k.hurtT <= 0 && k.action === 'hurt') k.action = 'idle'; }
    if (k.dodgeCd > 0) k.dodgeCd -= dt;
    if (k.dodgeT > 0) { k.dodgeT -= dt; if (k.dodgeT <= 0 && k.action === 'dodge') k.action = 'idle'; }
    if (k.bufferT > 0) { k.bufferT -= dt; if (k.bufferT <= 0) k.buffer = null; }
    // energia volta depois de uma pausa nos golpes
    if (k.sinceStrike > ENERGY_REGEN_DELAY) k.energy = Math.min(K_ENERGY, k.energy + ENERGY_REGEN * dt);
    if (k.action === 'hurt') { k.guarding = false; return; }
    // esquiva (cancela a recuperação do golpe)
    if ((pad.esqE.pressed || pad.esqD.pressed) && k.dodgeCd <= 0 && k.action !== 'down' && !(k.action === 'punch' && k.pPhase !== 'recover')) {
      k.action = 'dodge';
      k.dodgeDir = pad.esqE.pressed ? -1 : 1;
      k.dodgeT = DODGE_INVULN;
      k.dodgeStart = this.time;
      k.dodgeCd = DODGE_INVULN + DODGE_COOLDOWN;
      k.punch = null;
      k.buffer = null;
      this.emit('dodge');
    }
    // golpes
    let want: Punch | null = null;
    for (const p of PUNCH_BUTTONS) if (pad[p].pressed) { want = p; break; }
    if (want) {
      if (k.action === 'idle' || k.action === 'guard') this.startPunch(want);
      else if (k.action === 'punch') { k.buffer = want; k.bufferT = 0.2; }
    }
    if (k.action === 'punch') this.stepPunch(dt);
    k.guarding = pad.guarda.held && (k.action === 'idle' || k.action === 'guard');
    if (k.guarding) k.action = 'guard';
    else if (k.action === 'guard') k.action = 'idle';
  }

  private startPunch(p: Punch) {
    const k = this.k, def = PUNCHES[p];
    const tired = k.energy < def.energy;
    const slow = tired ? TIRED_SLOW : 1;
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
    } else if (k.pPhase === 'recover' && k.pT >= k.pLen) {
      k.action = 'idle';
      const b = k.buffer;
      k.punch = null;
      k.buffer = null;
      if (b) this.startPunch(b);
    }
  }

  /** O soco chega: aplica a guarda do jacaré, a janela de contra-ataque, o combo e a sequência de acertos. */
  private resolveHit(p: Punch) {
    const g = this.g, def = PUNCHES[p];
    if (g.mode === 'ko') return;
    let mult = GUARD_PASS[g.guard][def.tier];
    const countering = g.counterT > 0;
    if (countering) mult = Math.max(mult, GUARD_PASS.aberta[def.tier]) * COUNTER_MULT;
    // combo JAB → DIRETO → CRUZADO, cada golpe até 0,45 s depois do anterior: o último vale +25%
    const expect = this.comboIdx === 0 ? 'jab' : this.comboIdx === 1 ? 'direto' : 'cruzado';
    const inTime = this.k.startT - this.comboT <= COMBO_GAP;
    if (def.tier === expect && (this.comboIdx === 0 || inTime)) {
      this.comboIdx++;
      if (this.comboIdx === 3) { mult *= COMBO_FINISH_BONUS; this.combo++; this.comboIdx = 0; this.emit('combo', { n: this.combo }); }
    } else this.comboIdx = def.tier === 'jab' ? 1 : 0;
    this.comboT = this.k.startT;
    const dmg = def.dmg * mult;
    if (g.guard === 'alta' && def.tier !== 'gancho' && !countering) this.emit('block', { punch: p });
    else if (g.guard === 'baixa' && def.tier === 'gancho' && !countering) this.emit('block', { punch: p });
    g.hp = Math.max(0, g.hp - dmg);
    this.k.didHit = true;
    this.hitsLanded++;
    this.streak++;
    this.recentHits.push(this.time);
    while (this.recentHits.length && this.time - this.recentHits[0] > COVER_WINDOW) this.recentHits.shift();
    if (g.mode === 'taunt') g.tauntHits++;
    this.emit('hit', { punch: p, amount: dmg });
    if (countering) this.emit('counter', { amount: dmg });
    g.flinchT = 0.12;
    if (g.hp > 0 && this.streak >= DIZZY_STREAK && g.mode !== 'dizzy' && g.mode !== 'groggy') {
      this.streak = 0;
      g.mode = 'dizzy'; g.dizzyT = DIZZY_TIME; g.attack = null; g.plan.length = 0; g.guard = 'tonto';
      this.emit('dizzy');
    }
  }

  // ───────────────────────── jacaré ─────────────────────────
  private teleOf(kind: AttackKind) {
    return ATTACKS[kind].tele * PHASE_TELE[this.g.phase] * this.diff.tele;
  }

  private startAttack(kind: AttackKind, speed = 1) {
    const g = this.g;
    g.mode = 'tele';
    g.attackCount++;
    g.attack = kind;
    g.teleMax = this.teleOf(kind) * speed;
    g.tele = g.teleMax;
    g.guard = 'ataque';
    this.emit('gatorAttack', { attack: kind });
  }

  private decide() {
    const g = this.g, r = this.rng.next();
    const ph = g.phase;
    // taunt / patada / rabada / mordidona / cabeçada por fase
    let pick: AttackKind | 'taunt';
    if (ph === 1) pick = r < 0.55 ? 'patada' : r < 0.75 ? 'rabada' : 'taunt';
    else if (ph === 2) pick = r < 0.3 ? 'patada' : r < 0.5 ? 'rabada' : r < 0.8 ? 'mordidona' : 'taunt';
    else pick = r < 0.22 ? 'patada' : r < 0.42 ? 'rabada' : r < 0.62 ? 'mordidona' : r < 0.92 ? 'cabecada' : 'taunt';
    if (pick === 'taunt') {
      g.mode = 'taunt'; g.tauntT = 1.5; g.tauntHits = 0; g.guard = 'aberta';
      this.emit('taunt');
      return;
    }
    const n = ph === 1 ? 1 : ph === 2 ? 2 : 3;
    g.plan.length = 0;
    for (let i = 1; i < n; i++) {
      const q = this.rng.next();
      g.plan.push(ph === 3 ? (q < 0.3 ? 'patada' : q < 0.55 ? 'rabada' : q < 0.8 ? 'cabecada' : 'mordidona') : (q < 0.5 ? 'patada' : q < 0.75 ? 'rabada' : 'mordidona'));
    }
    this.startAttack(pick);
  }

  private stepGator(dt: number) {
    const g = this.g, k = this.k;
    if (g.flinchT > 0) g.flinchT -= dt;
    if (g.counterT > 0) g.counterT -= dt;
    switch (g.mode) {
      case 'guard': {
        g.guard = g.stance;
        g.stanceT -= dt;
        if (g.stanceT <= 0) { g.stance = g.stance === 'alta' ? 'baixa' : 'alta'; g.stanceT = 1.2 + this.rng.next() * 1.0; }
        // soco repetido sem parar: ele lê, se cobre e depois contra-ataca
        if (this.recentHits.length >= COVER_HITS) { g.mode = 'cover'; g.coverT = COVER_TIME; break; }
        g.thinkT -= dt;
        if (g.thinkT <= 0 && k.action !== 'down') this.decide();
        break;
      }
      case 'cover': {
        g.guard = 'cobertura';
        g.coverT -= dt;
        if (g.coverT <= 0) { g.mode = 'guard'; this.recentHits.length = 0; this.startAttack(g.phase === 1 ? 'patada' : 'rabada', 0.7); }
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
          else { g.mode = 'guard'; g.thinkT = (0.2 + this.rng.next() * 0.4) * (g.phase === 1 ? 1 : g.phase === 2 ? 0.7 : 0.45); g.stanceT = 0.8; }
        }
        break;
      }
      case 'taunt': {
        g.guard = 'aberta';
        g.tauntT -= dt;
        if (g.tauntT <= 0) {
          if (g.tauntHits >= 3) { g.mode = 'guard'; this.startAttack('contrape'); }
          else { g.mode = 'guard'; g.thinkT = 0.4 + this.rng.next() * 0.5; }
        }
        break;
      }
      case 'dizzy': {
        g.guard = 'tonto';
        g.dizzyT -= dt;
        if (g.dizzyT <= 0) { g.mode = 'guard'; g.thinkT = 0.8; g.stanceT = 0.8; }
        break;
      }
      case 'groggy': {
        g.guard = 'tonto';
        g.groggyT -= dt;
        if (g.groggyT <= 0) {
          // não deu o golpe final: ele se recupera e volta furioso
          g.hp = Math.round(g.maxHp * GROGGY_RECOVER); g.mode = 'guard'; g.phase = 3; g.thinkT = 0.9; g.groggyUsed++;
          this.emit('phase', { n: 3 });
        }
        break;
      }
      case 'ko': break;
    }
    // vida zerada: grogue (uma vez por vez)
    if (g.hp <= 0 && g.mode !== 'groggy' && g.mode !== 'ko') {
      g.mode = 'groggy'; g.groggyT = GROGGY_TIME; g.attack = null; g.plan.length = 0; g.guard = 'tonto';
      this.emit('groggy');
    }
  }

  /** Impacto de um ataque do jacaré sobre o Karimbo. */
  private impact() {
    const g = this.g, k = this.k, kind = g.attack!, def = ATTACKS[kind];
    g.attack = null;
    g.mode = 'recover';
    g.recoverT = def.counter > 0.5 ? 0.6 : 0.5;
    let dmg = def.dmg * this.diff.gatorDmg;
    if (k.dodgeT > 0 && k.action === 'dodge') {
      // esquivou: abre a janela de contra-ataque
      g.counterT = def.counter;
      const perfect = this.time - k.dodgeStart <= PERFECT_WINDOW;
      this.emit('gatorMiss', { attack: kind });
      if (perfect) { this.emit('perfect'); this.slowT = 0.3; g.counterT = def.counter * 1.25; }
      return;
    }
    if (k.guarding && def.guardable) { dmg *= GUARD_DAMAGE; this.emit('block', { attack: kind }); }
    k.hp = Math.max(0, k.hp - dmg);
    this.mistakes++;
    this.streak = 0;
    this.comboIdx = 0;
    k.action = 'hurt';
    k.hurtT = k.guarding ? 0.12 : 0.38;
    k.punch = null;
    k.buffer = null;
    this.emit('gatorHit', { attack: kind, amount: dmg });
  }

  private phaseCheck() {
    const g = this.g;
    const f = g.hp / g.maxHp;
    const ph: 1 | 2 | 3 = f < PHASE3_AT ? 3 : f < PHASE2_AT ? 2 : 1;
    if (ph > g.phase) { g.phase = ph; this.emit('phase', { n: ph }); }
  }

  private checkEnd() {
    const k = this.k;
    if (k.hp <= 0 && this.cine !== 'lose') {
      k.action = 'down';
      this.cine = 'lose';
      this.cineT = 0;
      this.emit('lose');
    }
  }

  // ───────────────────────── cinemáticas ─────────────────────────
  /** Aperta o botão ORELHADA! (só vale com o jacaré grogue). */
  tryOrelhada(): boolean {
    if (!this.orelhadaReady) return false;
    this.cine = 'orelhada';
    this.cineT = 0;
    this.k.action = 'idle';
    this.emit('orelhada');
    return true;
  }

  private stepCine(dt: number) {
    this.cineT += dt;
    if (this.cine === 'orelhada') {
      if (this.cineT >= 1.6 && !this.cineMark) { this.cineMark = 1; this.emit('impact'); }
      if (this.cineT >= ORELHADA_TIME) { this.cine = 'count'; this.cineT = 0; this.g.mode = 'ko'; this.cineMark = 0; this.emit('ko'); }
    } else if (this.cine === 'count') {
      const n = Math.min(10, Math.floor(this.cineT / (COUNT_TIME / 10)) + 1);
      if (n !== this.cineMark) { this.cineMark = n; this.emit('count', { n }); }
      if (this.cineT >= COUNT_TIME + 0.4) { this.result = { outcome: 'win', time: this.time, mistakes: this.mistakes }; this.emit('win'); }
    } else if (this.cine === 'lose') {
      if (this.cineT >= 2.8) this.result = { outcome: 'lose', time: this.time, mistakes: this.mistakes };
    }
  }

  /** Gente de teste/arte: o jacaré chega a este ponto quando o ataque `kind` está nos últimos `s` segundos de telegrafia. */
  teleLeft(): number { return this.g.mode === 'tele' ? this.g.tele : Infinity; }
}
