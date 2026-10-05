/**
 * A perseguição (simulação headless e determinística): o Karimbo corre pela copa atrás do macaco que
 * levou a carta. Sem arma. O macaco tem regras de ritmo para o jogador perfeito pegá-lo entre ~48 e
 * 56 s, o comum entre 60 e 72 s e ninguém passar de ~90 s: antes de MIN_CATCH_T ele escapa com um
 * salto; se a distância passa de 1100 px ele provoca até voltar a 700; cansa depois de TIRED_T;
 * e encurralado na clareira final ou escorregando na casca (RESCUE_T) é pego. Bichos fazem tropeçar,
 * nunca machucam; cair da copa só custa tempo.
 */
import type { Course, HazardKind, ThrowDef } from './course';
import { buildCourse } from './course';
import { Runner, type RunInput, type RunnerEvents, CHASE_RUN } from './runner';

export const LEAD0 = 520;
export const FAR_GAP = 1100;
export const NEAR_GAP = 700;
export const MIN_CATCH_T = 48;
export const TIRED_T = 68;
export const RESCUE_T = 82;
/** velocidade base do macaco (px/s): ≈ 0,9 da do Karimbo; ajustada por teste com os bots */
export const MONKEY_V = 214;
export const CATCH_GAP = 46;
export const SLIP_V = 260;
export const LEAP = 160;
/** tempo que um tile do galho que treme aguenta depois de pisado: só frear ou parar faz cair */
export const SHAKE_T = 0.28;

export type ChaseEventType =
  | 'start' | 'jump' | 'land' | 'glide' | 'slide' | 'fall' | 'respawn' | 'stumble' | 'slip' | 'sloth' | 'spring' | 'perfect' | 'break' | 'shake'
  | 'bees' | 'throw' | 'quase' | 'taunt' | 'read' | 'line' | 'caught' | 'win' | 'tired' | 'cornered';
export interface ChaseEvent { type: ChaseEventType; text?: string; kind?: HazardKind | 'banana' | 'coconut'; x?: number }

export type MonkeyMode = 'run' | 'taunt' | 'tired' | 'slip' | 'caught' | 'cornered';
export interface Coati { x: number; alive: boolean }
export interface HazardState {
  kind: HazardKind;
  x: number;
  y: number;
  /** ativo (já saiu/entrou em cena) */
  on: boolean;
  /** posições dinâmicas */
  px: number;
  py: number;
  hit: boolean;
  /** quique da preguiça / balanço da cobra */
  t: number;
  coatis?: Coati[];
}
export interface Thrown { kind: 'banana' | 'coconut'; x: number; y: number; vx: number; alive: boolean }
export interface ShakyState { def: Course['shaky'][number]; tiles?: number[]; gone?: boolean[] }
export interface SpringState { press: number }

/** Amostra do percurso (20 por segundo) para rebobinar a fita depois da captura. */
export interface TrailPoint { x: number; y: number; air: boolean; mx: number; my: number }

export interface ChaseResult { outcome: 'win'; time: number; falls: number; stumbles: number }

const RUNNER_EV = (m: ChaseMatch): RunnerEvents => ({
  jump: () => m.emit('jump'), land: () => m.emit('land'), glide: () => m.emit('glide'), slide: () => m.emit('slide'),
  fall: () => { m.falls++; m.emit('fall'); }, respawn: () => { m.restoreShaky(); m.emit('respawn'); },
});

export class ChaseMatch {
  readonly course: Course;
  readonly runner: Runner;
  readonly hazards: HazardState[] = [];
  readonly thrown: Thrown[] = [];
  readonly shaky: ShakyState[] = [];
  readonly springs: SpringState[] = [];
  readonly trail: TrailPoint[] = [];
  private lastRec = -1;
  time = 0;
  falls = 0;
  stumbles = 0;
  events: ChaseEvent[] = [];
  result: ChaseResult | null = null;
  readonly monkey = { x: 0, y: 0, mode: 'run' as MonkeyMode, hop: 0, tauntT: 0, leapCd: 0, slipT: 0, caughtT: 0, bob: 0, hasLetter: true, facing: 1 as 1 | -1 };
  private ev: RunnerEvents;
  private gaps: { x0: number; x1: number }[] = [];
  private throwsDone = new Set<number>();
  private lines = new Set<string>();
  private lastRunnerX = 0;
  private cd = new Map<string, number>();

  constructor(course: Course = buildCourse()) {
    this.course = course;
    this.runner = new Runner(course.spawn.x, course.spawn.y);
    this.ev = RUNNER_EV(this);
    this.monkey.x = course.spawn.x + LEAD0;
    this.monkey.y = course.pathY(this.monkey.x);
    for (const h of course.hazards) this.hazards.push({ kind: h.kind, x: h.x, y: h.y, on: false, px: h.x, py: h.y, hit: false, t: 0, coatis: h.kind === 'coati' ? [0, 1, 2].map((i) => ({ x: h.x + i * 38, alive: true })) : undefined });
    for (const s of course.shaky) this.shaky.push({ def: s, tiles: new Array(s.x1 - s.x0).fill(-1), gone: new Array(s.x1 - s.x0).fill(false) });
    for (const _ of course.springs) this.springs.push({ press: 0 });
    // vãos entre galhos (o macaco salta por cima)
    const br = [...course.branches].sort((a, b) => a[0] - b[0]);
    for (let i = 0; i + 1 < br.length; i++) if (br[i + 1][0] > br[i][1]) this.gaps.push({ x0: br[i][1] * 32, x1: br[i + 1][0] * 32 });
    this.emit('start');
  }

  emit(type: ChaseEventType, extra: Partial<ChaseEvent> = {}) { this.events.push({ type, ...extra }); }
  get over() { return this.result !== null; }
  get gap() { return this.monkey.x - this.runner.x; }
  private onCd(key: string, t: number) { const c = this.cd.get(key) ?? -9; if (this.time - c < t) return true; this.cd.set(key, this.time); return false; }

  /** Restaura galhos quebrados quando o Karimbo reaparece. */
  restoreShaky() {
    for (const s of this.shaky) {
      for (let i = 0; i < s.gone!.length; i++) if (s.gone![i]) this.course.level.set(s.def.x0 + i, s.def.row, 2, 7);
      s.gone!.fill(false);
      s.tiles!.fill(-1);
    }
  }

  step(dt: number, inp: RunInput) {
    if (this.result) return;
    this.time += dt;
    const m = this.monkey;
    if (m.mode === 'caught') {
      m.caughtT += dt;
      if (m.caughtT >= 1.8) { this.result = { outcome: 'win', time: this.time, falls: this.falls, stumbles: this.stumbles }; this.emit('win'); }
      return;
    }
    this.lastRunnerX = this.runner.x;
    this.runner.step(dt, inp, this.course, this.ev);
    if (this.runner.fallT <= 0 && this.runner.state !== 'fallen') {
      this.perfectCheck();
      this.hazardsStep(dt);
      this.springsStep(dt);
      this.shakyStep(dt);
      if (this.runner.body.onGround && this.runner.stumbleT <= 0) this.safeCheck();
    }
    this.thrownStep(dt);
    this.monkeyStep(dt);
    this.talk();
    if (this.time - this.lastRec >= 0.05 && this.trail.length < 4000) {
      this.lastRec = this.time;
      this.trail.push({ x: this.runner.x, y: this.runner.feetY, air: !this.runner.body.onGround, mx: this.monkey.x, my: this.monkey.y - this.monkey.hop });
    }
  }

  // ───────────────────────── macaco ─────────────────────────
  private monkeyStep(dt: number) {
    const m = this.monkey, r = this.runner, gap = this.gap;
    if (m.leapCd > 0) m.leapCd -= dt;
    // encurralado na clareira: o macaco para e é pego quando o Karimbo chega
    const cornerX = this.course.endX;
    let v = MONKEY_V;
    if (m.mode !== 'slip' && this.time >= RESCUE_T) { m.mode = 'slip'; m.slipT = 0; this.emit('line', { text: 'Ai! Minha casca de banana!' }); }
    // escorregou na própria casca: desliza para trás, de volta ao Karimbo (garante o fim da perseguição)
    if (m.mode === 'slip') { m.slipT += dt; v = -SLIP_V; }
    else if (m.mode === 'cornered') v = 0;
    else {
      if (this.time >= TIRED_T) { v *= 0.75; if (m.mode === 'run') { m.mode = 'tired'; this.emit('tired'); } }
      if (m.mode === 'taunt') {
        m.tauntT += dt;
        v = 0;
        if (gap < NEAR_GAP) m.mode = this.time >= TIRED_T ? 'tired' : 'run';
      } else if (gap > FAR_GAP && m.x < cornerX - 600) { m.mode = 'taunt'; m.tauntT = 0; this.emit('taunt', { text: 'Corre, orelhudo!' }); v = 0; }
    }
    if (m.x >= cornerX && m.mode !== 'cornered' && m.mode !== 'slip') { m.mode = 'cornered'; v = 0; this.emit('cornered'); }
    m.x += v * dt;
    m.facing = v < 0 ? -1 : 1;
    // vertical: sobre o galho; nos vãos salta em arco
    let y = this.course.pathY(m.x);
    let hop = Math.abs(Math.sin(this.time * 8)) * (m.mode === 'run' || m.mode === 'tired' ? 6 : 0);
    for (const g of this.gaps) if (m.x > g.x0 - 20 && m.x < g.x1 + 20) { const u = (m.x - (g.x0 - 20)) / (g.x1 - g.x0 + 40); hop = Math.sin(Math.min(1, Math.max(0, u)) * Math.PI) * 54; }
    m.y = y;
    m.hop = hop;
    m.bob = this.time;
    // jogou algo para trás?
    this.course.throws.forEach((t: ThrowDef, i) => {
      if (this.throwsDone.has(i) || m.x < t.x + 160) return;
      this.throwsDone.add(i);
      const py = this.course.pathY(t.x + 160);
      this.thrown.push({ kind: t.kind, x: t.x + 160, y: py, vx: t.kind === 'coconut' ? -150 : 0, alive: true });
      this.emit('throw', { kind: t.kind });
    });
    // captura / salto de fuga
    if (Math.abs(this.runner.x - m.x) < CATCH_GAP + 8 && r.state !== 'fallen' && r.fallT <= 0) {
      const catchable = this.time >= MIN_CATCH_T || m.mode === 'cornered' || m.mode === 'slip';
      if (catchable) { m.mode = 'caught'; m.caughtT = 0; m.hasLetter = false; this.emit('caught'); }
      else if (m.leapCd <= 0) { m.x += LEAP; m.leapCd = 2.5; this.emit('quase', { text: 'Quase, Parabólica!' }); }
    }
  }

  private talk() {
    const t = this.time;
    const say = (key: string, at: number, text: string, type: ChaseEventType = 'line') => { if (t >= at && !this.lines.has(key)) { this.lines.add(key); this.emit(type, { text }); } };
    say('h1', 3, 'Hihihi!');
    say('c1', 14, 'Corre, orelhudo!');
    say('read', 28, "'Querido Karimbo...' HAHAHAHA!", 'read');
    say('h2', 40, 'Hihihi!');
    say('c2', 56, 'Arf... arf... pera aí...');
  }

  // ───────────────────────── obstáculos ─────────────────────────
  private hazardsStep(dt: number) {
    const r = this.runner, b = r.body;
    const left = b.x - b.w / 2, right = b.x + b.w / 2, top = b.y - b.h / 2, bottom = b.y + b.h / 2;
    for (const h of this.hazards) {
      h.t += dt;
      const near = Math.abs(h.x - b.x);
      switch (h.kind) {
        case 'sloth': {
          // preguiça pendurada: pular na barriga dá um quique enorme
          const rx = h.x - 22, rw = 44, ry = h.y - 36, rh = 36;
          if (left < rx + rw && right > rx && bottom > ry && top < ry + rh) {
            if (b.vy > 0 && bottom - ry < 22) { b.vy = -668 * 1.3; this.emit('sloth', { text: 'Ôôô... calma... aí...' }); h.hit = true; }
            else if (r.stumble()) { this.stumbles++; this.emit('stumble', { kind: 'sloth' }); }
          }
          break;
        }
        case 'coati': {
          if (!h.on && near < 560) h.on = true;
          for (const c of h.coatis!) {
            if (!c.alive) continue;
            if (h.on) c.x -= 96 * dt;
            const rx = c.x - 14, ry = h.y - 22;
            if (left < rx + 28 && right > rx && bottom > ry && top < ry + 22 && r.stumble()) { this.stumbles++; this.emit('stumble', { kind: 'coati' }); }
          }
          h.px = h.coatis![0].x;
          break;
        }
        case 'toucan': {
          if (!h.on && near < 700) { h.on = true; h.px = h.x + 520; }
          if (h.on) {
            h.px -= 230 * dt;
            const ry = h.y - 62, rh = 24;
            if (left < h.px + 26 && right > h.px - 26 && bottom > ry && top < ry + rh && r.stumble()) { this.stumbles++; this.emit('stumble', { kind: 'toucan' }); }
          }
          break;
        }
        case 'snake': {
          const swing = Math.sin(h.t * 2.4) * 26;
          h.px = h.x + swing;
          const ry = h.y - 110, rh = 78; // da folhagem até a ponta: passa por baixo (deslizando)
          if (left < h.px + 8 && right > h.px - 8 && bottom > ry && top < ry + rh && r.stumble()) { this.stumbles++; this.emit('stumble', { kind: 'snake' }); }
          break;
        }
        case 'hive': {
          const ry = h.y - 82, rh = 40;
          if (!h.hit && left < h.x + 18 && right > h.x - 18 && bottom > ry && top < ry + rh) {
            h.hit = true;
            r.agitatedT = 1.6;
            if (r.stumble()) this.stumbles++;
            this.emit('bees', { kind: 'hive' });
          }
          break;
        }
      }
    }
  }

  private thrownStep(dt: number) {
    const r = this.runner, b = r.body;
    for (const o of this.thrown) {
      if (!o.alive) continue;
      o.x += o.vx * dt;
      if (o.kind === 'coconut') o.y = this.course.pathY(o.x);
      if (Math.abs(o.x - b.x) > 1600) { o.alive = false; continue; }
      const hit = Math.abs(o.x - b.x) < 24 + b.w / 2 && b.y + b.h / 2 > o.y - 20 && b.y - b.h / 2 < o.y;
      if (!hit) continue;
      if (o.kind === 'banana') { if (r.slip()) { this.emit('slip'); o.alive = false; } }
      else if (r.stumble()) { this.stumbles++; this.emit('stumble', { kind: 'coconut' }); o.alive = false; }
    }
  }

  private springsStep(dt: number) {
    const b = this.runner.body;
    this.course.springs.forEach((s, i) => {
      const st = this.springs[i];
      if (st.press > 0) st.press -= dt;
      const feet = b.y + b.h / 2;
      if (b.x > s.x && b.x < s.x + s.w && feet >= s.y - 4 && feet <= s.y + 16 && b.vy >= 0 && st.press <= 0 && this.runner.state !== 'fallen') {
        this.runner.spring();
        st.press = 0.5;
        this.emit('spring');
      }
    });
  }

  private shakyStep(dt: number) {
    const b = this.runner.body;
    const feet = b.y + b.h / 2;
    for (const s of this.shaky) {
      const n = s.def.x1 - s.def.x0;
      if (!s.tiles) s.tiles = new Array(n).fill(-1);
      // cada tile começa a ceder quando pisado e quebra 0,28 s depois: quem corre sem frear atravessa
      if (b.onGround && Math.abs(feet - s.def.row * 32) < 3) {
        for (let wx = b.x - 10; wx <= b.x + 10; wx += 10) {
          const i = Math.floor(wx / 32) - s.def.x0;
          if (i >= 0 && i < n && s.tiles[i] < 0 && !s.gone![i]) { s.tiles[i] = 0; if (!this.onCd('shake', 0.25)) this.emit('shake', { x: b.x }); }
        }
      }
      for (let i = 0; i < n; i++) {
        if (s.tiles[i] < 0) continue;
        s.tiles[i] += dt;
        if (s.tiles[i] >= SHAKE_T && !s.gone![i]) {
          s.gone![i] = true;
          this.course.level.set(s.def.x0 + i, s.def.row, 0);
          if (!this.onCd('break', 0.2)) this.emit('break', { x: (s.def.x0 + i) * 32 + 16 });
        }
      }
    }
  }

  private perfectCheck() {
    const r = this.runner;
    if (r.landed) {
      r.landed = 0;
      const feet = r.feetY, x = r.x;
      for (const p of this.course.perfect) if (x >= p.x - 4 && x <= p.x + p.w && Math.abs(feet - p.y) < 4 && r.boostT <= 0) { r.perfect(); this.emit('perfect', { x }); break; }
    }
  }

  /** Marca o último galho firme (não os que tremem) como ponto seguro de reaparecer. */
  private safeCheck() {
    const r = this.runner, b = r.body;
    for (const s of this.shaky) if (b.x > s.def.x0 * 32 && b.x < s.def.x1 * 32) return;
    const feet = r.feetY;
    if (this.course.level.get(Math.floor(b.x / 32), Math.round(feet / 32)) === 2) r.lastSafe = { x: b.x, y: feet };
  }

  /** Média de passos para os testes: velocidade-alvo do Karimbo. */
  static readonly RUN = CHASE_RUN;
}
