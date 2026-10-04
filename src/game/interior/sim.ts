/**
 * Simulador do interior: sem arte, sem DOM. Andar pela grade, ações por verbo, ruído, percepção
 * dos moradores e eventos para a sessão/desenho. Determinístico dado o `seed`.
 */
import { InteriorStore, RoomFlags } from '../interiorStore';
import { adjacentCells, cheb, findPath, Grid, hasLine, type Cell } from './grid';
import { screenDirToGrid, screenSide } from './iso';
import type {
  ActInfo, ExitReason, FurnitureDef, FxKind, InteriorEvent, Npc, Pose, RoomDef, Trace, VerbDef, VerbView,
} from './types';

export const WALK_SPEED = 4.5;   // tiles/s (≈ 0,22 s por tile)
export const SNEAK_SPEED = 2.5;  // ≈ 0,4 s por tile
export const VIEW_RANGE = 5;
const COS_CONE = Math.cos((50 * Math.PI) / 180); // cone de 100°
const HALF = 0.2;                // meia largura do Karimbo no chão
const STEP_DIST = 0.9;
const RADIO_R = 2.7;             // alcance da máscara de ruído do rádio ligado
const NOISE_FALLOFF = 4;         // ruído perdido por tile de distância

export interface SimInput { mx: number; my: number; sneak: boolean }

/** O que o simulador precisa saber do mundo de fora (implementado pela sessão; nos testes é um stub). */
export interface InteriorHost {
  /** estado legado (modal antigo): objeto `open` (gaveta aberta) ou `done` (recompensa recolhida) */
  legacy(obj: string, kind: 'open' | 'done'): boolean;
}
export const nullHost: InteriorHost = { legacy: () => false };

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const centerOf = (f: { gx: number; gy: number; w: number; h: number }) => ({ gx: f.gx + f.w / 2, gy: f.gy + f.h / 2 });

export class InteriorSim {
  readonly grid: Grid;
  readonly flags: RoomFlags;
  readonly npcs: Npc[] = [];
  readonly events: InteriorEvent[] = [];
  readonly traces: Trace[] = [];
  /** anéis de ruído para o desenho (envelhecem em update) */
  readonly rings: { gx: number; gy: number; power: number; age: number; life: number }[] = [];
  /** NPC falando agora (boca animada) */
  talking = '';
  private talkT = 0;
  /** estado só desta visita (rádio ligado, cacos...) */
  readonly rt: Record<string, number> = {};
  px: number; py: number;
  dx = 1; dy = 1;
  facing: 1 | -1 = 1;
  moving = false;
  sneaking = false;
  walkPhase = 0;
  path: Cell[] = [];
  intent: { fid: string; vid: string } | null = null;
  busy = 0;
  pose: Pose = 'idle';
  poseT = 0;
  t = 0;
  rep: number;
  /** furniture em que Karimbo está deitado/sentado (some quando ele se mexe) */
  on: string | null = null;
  exited: ExitReason | null = null;
  actSeen = false;
  private rand: () => number;
  private stepAcc = 0;
  private lastLine = new Map<string, number>();
  private pranksSeen = new Set<string>();
  private pranksTimer = 0;
  private armed = false;
  private armT = 0;
  readonly furnById = new Map<string, FurnitureDef>();
  /** móveis "sintéticos" dos NPCs com verbos: tocar neles abre o menu como num móvel */
  private npcFurn = new Map<string, FurnitureDef>();
  /** expulsão: Karimbo é levado à força até a porta */
  forced = false;

  constructor(readonly room: RoomDef, readonly store: InteriorStore, readonly host: InteriorHost = nullHost, seed = 1) {
    this.flags = store.flags(room.id);
    this.rep = store.rep;
    this.rand = mulberry32(seed * 7919 + room.id.length);
    this.grid = new Grid(room.rows, room.furniture);
    for (const f of room.furniture) this.furnById.set(f.id, f);
    this.px = room.spawn.x + 0.5;
    this.py = room.spawn.y + 0.5;
    for (const d of room.npcs) {
      this.npcs.push({
        id: d.id, name: d.name, brain: d.brain, gx: d.gx + 0.5, gy: d.gy + 0.5, dx: d.dx ?? 1, dy: d.dy ?? 1,
        facing: screenSide(d.dx ?? 1, d.dy ?? 1), state: d.state, t: 0, meter: d.meter ?? 0, mark: '', markT: 0,
        path: [], speed: 2.4, away: !!d.away, walk: 0, data: {},
      });
    }
    for (const n of this.npcs) {
      if (!n.brain.verbs) continue;
      const f: FurnitureDef = { id: 'npc:' + n.id, name: n.name, paint: 'npc', gx: Math.floor(n.gx), gy: Math.floor(n.gy), w: 1, h: 1, solid: false, height: 60, verbs: (s) => (n.away ? [] : n.brain.verbs!(s, n)) };
      this.npcFurn.set(n.id, f); this.furnById.set(f.id, f);
    }
    room.onEnter?.(this);
    for (const p of room.pranks) if (p.done(this)) this.pranksSeen.add(p.id);
  }

  // ─────────────── utilidades para quartos e cérebros ───────────────
  random() { return this.rand(); }
  has(flag: string) { return this.flags.has(flag); }
  set(flag: string) { this.flags.set(flag); }
  npc(id: string) { return this.npcs.find((n) => n.id === id); }
  cell(): Cell { return { x: Math.floor(this.px), y: Math.floor(this.py) }; }
  emit(e: InteriorEvent) { this.events.push(e); }
  drain(): InteriorEvent[] { return this.events.splice(0, this.events.length); }

  say(text: string, who = 'karimbo', ttl = 3.4) {
    this.emit({ type: 'say', who, text, ttl });
    if (who !== 'karimbo') { this.talking = who; this.talkT = Math.min(ttl, 2.4); }
  }
  /** manchas no chão (cacos, poças, migalhas): só desenho; as flags refazem tudo ao reentrar */
  readonly decals: { kind: string; gx: number; gy: number }[] = [];
  decal(kind: string, gx: number, gy: number) { if (this.decals.length < 24) this.decals.push({ kind, gx, gy }); }
  /** Karimbo está levando a panela apreendida (para o desenho e para o bolso). */
  get carrying() { return !!this.room.pocket?.(this).some((i) => i.id === 'panela'); }
  /** Escolhe uma fala que não repete a anterior da mesma chave. */
  line(key: string, lines: readonly string[]): string {
    if (lines.length === 1) return lines[0];
    let i = Math.floor(this.rand() * lines.length);
    if (i === this.lastLine.get(key)) i = (i + 1) % lines.length;
    this.lastLine.set(key, i);
    return lines[i];
  }
  /** Onomatopeia em balão de quadrinho sobre o chão. */
  pop(text: string, gx: number, gy: number, color = '#ffd24a') { this.emit({ type: 'pop', text, gx, gy, color }); }
  /** Texto longo (lore): abre a folha de leitura em vez de um balão. */
  read(title: string, text: string) { this.emit({ type: 'read', title, text }); }
  fx(kind: FxKind, gx: number, gy: number, n = 1) { this.emit({ type: 'fx', kind, gx, gy, n }); }
  sfx(name: string, vol = 1) { this.emit({ type: 'sfx', name, vol }); }
  shake(mag: number, dur: number) { this.emit({ type: 'shake', mag, dur }); }
  heal(n: number) { this.emit({ type: 'heal', n }); }
  grenade(n = 1) { this.emit({ type: 'grenade', n }); }
  coins(n: number) { this.emit({ type: 'coins', n }); }
  legacy(obj: string) { this.emit({ type: 'legacy', obj }); }
  addRep(delta: number) {
    this.rep = Math.max(-100, Math.min(100, this.rep + delta));
    this.emit({ type: 'rep', delta, total: this.rep });
  }
  /** Multiplicador de suspeita pela reputação: de ×1,5 (infame) a ×0,6 (querido). */
  repMult() { return 1.5 - ((this.rep + 100) / 200) * 0.9; }
  banner(title: string, sub: string) { this.emit({ type: 'banner', title, sub }); }
  /** Registra um rastro que só a moradora descobre depois (se ninguém viu a ação). */
  trace(fid: string, irritation: number, line: string, flag?: string) {
    if (!this.actSeen && irritation > 0) this.traces.push({ fid, irritation, line, discovered: false, flag });
  }

  // ─────────────── percepção e ruído ───────────────
  canSee(n: Npc, gx: number, gy: number): boolean {
    if (n.away || (n.brain.sees && !n.brain.sees(n))) return false;
    const vx = gx - n.gx, vy = gy - n.gy, d = Math.hypot(vx, vy);
    if (d > VIEW_RANGE) return false;
    if (d > 1.2 && (vx * n.dx + vy * n.dy) / d < COS_CONE) return false;
    return hasLine(this.grid, Math.floor(n.gx), Math.floor(n.gy), Math.floor(gx), Math.floor(gy), true);
  }
  witnesses(gx = this.px, gy = this.py): Npc[] { return this.npcs.filter((n) => this.canSee(n, gx, gy)); }

  /** Evento de ruído: cada NPC ouve `power − 4·distância` (metade se há parede no meio). */
  noise(gx: number, gy: number, power: number) {
    if (power <= 0) return;
    if (power >= 8) {
      this.emit({ type: 'ring', gx, gy, power });
      if (this.rings.length < 8) this.rings.push({ gx, gy, power, age: 0, life: 0.9 });
    }
    const cx = Math.floor(gx), cy = Math.floor(gy);
    for (const n of this.npcs) {
      // quem está fora escuta pela porta (a casa tem "ouvido" na entrada)
      const at: Cell = n.away ? this.room.door : { x: Math.floor(n.gx), y: Math.floor(n.gy) };
      let p = power - NOISE_FALLOFF * cheb(at.x, at.y, cx, cy);
      if (!hasLine(this.grid, at.x, at.y, cx, cy, false)) p *= 0.5;
      if (p > 0.5) n.brain.hear?.(this, n, p, { x: cx, y: cy });
    }
  }

  // ─────────────── ações ───────────────
  furniture(id: string) { return this.furnById.get(id); }
  /** Verbos disponíveis agora, já com ondas de ruído e aviso de testemunha. */
  verbsFor(fid: string): VerbView[] {
    const f = this.furnById.get(fid);
    if (!f) return [];
    const c = centerOf(f);
    const seen = this.npcs.some((n) => this.canSee(n, c.gx, c.gy));
    return f.verbs(this, f).map((v) => ({
      id: v.id, label: v.label, hostile: !!v.hostile || (v.irritation ?? 0) > 0, witness: seen,
      waves: v.noise <= 0 ? 0 : v.noise <= 8 ? 1 : v.noise <= 25 ? 2 : 3,
    }));
  }

  /** Móveis ao alcance do braço, do mais perto para o mais longe (seleção por teclado/controle). */
  reachable(max = 1.9): FurnitureDef[] {
    const out: { f: FurnitureDef; d: number }[] = [];
    for (const f of [...this.room.furniture, ...this.npcFurn.values()]) {
      if (!f.verbs(this, f).length) continue;
      const nx = Math.max(f.gx, Math.min(this.px, f.gx + f.w)), ny = Math.max(f.gy, Math.min(this.py, f.gy + f.h));
      const d = Math.hypot(this.px - nx, this.py - ny);
      if (d <= max) out.push({ f, d });
    }
    return out.sort((a, b) => a.d - b.d).map((o) => o.f);
  }

  private standCells(f: FurnitureDef): Cell[] {
    if (f.stand) return [f.stand];
    return adjacentCells(this.grid, f);
  }

  private nearEnough(f: FurnitureDef) {
    const nx = Math.max(f.gx, Math.min(this.px, f.gx + f.w)), ny = Math.max(f.gy, Math.min(this.py, f.gy + f.h));
    if (f.stand) return Math.hypot(this.px - (f.stand.x + 0.5), this.py - (f.stand.y + 0.5)) < 0.45;
    return Math.hypot(this.px - nx, this.py - ny) <= 1.15;
  }

  /** Pede uma ação: anda até o móvel (se preciso) e executa. Devolve false se não dá para chegar. */
  act(fid: string, vid: string): boolean {
    if (this.busy > 0 || this.exited) return false;
    const f = this.furnById.get(fid);
    if (!f || !f.verbs(this, f).some((v) => v.id === vid)) return false;
    this.getOff();
    this.intent = { fid, vid };
    if (this.nearEnough(f)) { this.arrive(); return true; }
    const p = findPath(this.grid, this.cell(), this.standCells(f));
    if (!p) { this.intent = null; this.say(this.line('cant', ['Não alcanço daqui.', 'Tem coisa no caminho.']), 'karimbo', 1.6); return false; }
    this.path = p;
    return true;
  }

  private getOff() { if (this.on) { this.on = null; this.pose = 'idle'; } }

  /** Anda até uma célula (clique no piso). */
  walkTo(c: Cell): boolean {
    if (this.busy > 0 || this.exited) return false;
    this.getOff();
    this.intent = null;
    const p = findPath(this.grid, this.cell(), [c]);
    if (!p) return false;
    this.path = p;
    return true;
  }

  /** Expulsão: o Karimbo é varrido até a porta (ignora comandos) e a visita termina como "expulso". */
  forceOut() {
    if (this.forced || this.exited) return;
    const p = findPath(this.grid, this.cell(), [this.room.door]);
    this.forced = true; this.busy = 0; this.intent = null; this.on = null; this.pose = 'idle';
    this.path = p ?? [];
    this.pop('VASSOURADA!', this.px, this.py, '#ff7a5a'); this.shake(4, 0.35); this.sfx('slam', 1);
  }

  /** Esc/“Sair”: vai até o tapete da porta. */
  leave(): boolean { return this.walkTo(this.room.door); }

  private arrive() {
    const it = this.intent;
    this.intent = null;
    this.path = [];
    if (!it) return;
    const f = this.furnById.get(it.fid);
    const v = f?.verbs(this, f).find((x) => x.id === it.vid);
    if (!f || !v) return;
    const c = centerOf(f);
    this.facing = screenSide(c.gx - this.px, c.gy - this.py);
    const len = Math.hypot(c.gx - this.px, c.gy - this.py) || 1;
    this.dx = (c.gx - this.px) / len; this.dy = (c.gy - this.py) / len;
    this.execute(f, v);
  }

  private execute(f: FurnitureDef, v: VerbDef) {
    const seers = this.witnesses();
    this.actSeen = seers.length > 0;
    this.busy = v.time ?? 0.55;
    this.pose = v.pose ?? 'take';
    this.poseT = 0;
    v.run(this, f);
    const c = centerOf(f);
    if (v.noise > 0) this.noise(c.gx, c.gy, v.noise);
    const info: ActInfo = { verb: v, f, seen: this.actSeen };
    for (const n of seers) n.brain.witness?.(this, n, info);
    this.actSeen = false;
  }

  // ─────────────── saída ───────────────
  exit(reason: ExitReason, alerted = false) {
    if (this.exited) return;
    this.exited = reason;
    this.room.onLeave?.(this, reason);
    for (const n of this.npcs) n.brain.onExit?.(this, reason);
    this.emit({ type: 'exit', reason, alerted });
    this.path = []; this.intent = null;
  }

  /** Efetiva no store: flags da visita + reputação. */
  commit() {
    this.store.commit(this.flags);
    this.store.rep = this.rep;
  }

  // ─────────────── atualização ───────────────
  /** Move um NPC pelo seu caminho. Devolve true se chegou ao fim. */
  moveNpc(n: Npc, dt: number): boolean {
    let left = n.speed * dt;
    while (left > 1e-4 && n.path.length) {
      const c = n.path[0], tx = c.x + 0.5, ty = c.y + 0.5;
      const vx = tx - n.gx, vy = ty - n.gy, d = Math.hypot(vx, vy);
      if (d <= left) { n.gx = tx; n.gy = ty; left -= d; n.path.shift(); }
      else { n.gx += (vx / d) * left; n.gy += (vy / d) * left; left = 0; }
      if (d > 1e-4) { n.dx = vx / d; n.dy = vy / d; n.facing = screenSide(vx, vy); }
    }
    const moved = n.speed * dt - left;
    n.walk += moved * 1.6;
    return n.path.length === 0;
  }

  /** Manda um NPC andar até a célula livre mais próxima do alvo. */
  npcGoto(n: Npc, c: Cell): boolean {
    const p = findPath(this.grid, { x: Math.floor(n.gx), y: Math.floor(n.gy) }, [c]);
    if (!p) return false;
    n.path = p;
    return true;
  }

  /** Aproxima o NPC de uma célula: vai até a vizinhança livre (3×3) mais próxima, mesmo se a célula for ocupada. */
  npcApproach(n: Npc, c: Cell): boolean {
    const goals: Cell[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.grid.walkable(c.x + dx, c.y + dy)) goals.push({ x: c.x + dx, y: c.y + dy });
    const p = findPath(this.grid, { x: Math.floor(n.gx), y: Math.floor(n.gy) }, goals);
    if (!p) return false;
    n.path = p;
    return true;
  }

  private blocked(cx: number, cy: number) { return !this.grid.walkable(cx, cy); }
  private boxFree(x: number, y: number) {
    return !this.blocked(Math.floor(x - HALF), Math.floor(y - HALF)) && !this.blocked(Math.floor(x + HALF), Math.floor(y - HALF))
      && !this.blocked(Math.floor(x - HALF), Math.floor(y + HALF)) && !this.blocked(Math.floor(x + HALF), Math.floor(y + HALF));
  }

  private stepNoise(dist: number) {
    this.stepAcc += dist;
    if (this.stepAcc < STEP_DIST) return;
    this.stepAcc -= STEP_DIST;
    const c = this.cell();
    const squeak = this.grid.squeaky(c.x, c.y);
    let p = squeak ? 18 : 3;
    if (this.sneaking) p *= 0.25;
    const radio = this.rt.radio ? this.room.furniture.find((f) => f.id === 'radio') : undefined;
    if (radio && Math.hypot(this.px - (radio.gx + radio.w / 2), this.py - (radio.gy + radio.h / 2)) <= RADIO_R) p *= 0.5;
    this.sfx(squeak ? 'creak' : 'step', this.sneaking ? 0.25 : 0.55);
    this.noise(this.px, this.py, p);
  }

  update(dt: number, inp: SimInput) {
    if (this.exited) return;
    dt = Math.min(dt, 0.1);
    this.t += dt;
    this.armT += dt;
    this.poseT += dt;
    if (!this.armed && (this.armT > 0.9 || this.cell().x !== this.room.door.x || this.cell().y !== this.room.door.y)) this.armed = true;
    this.sneaking = inp.sneak && !this.forced;
    this.moving = false;
    for (const n of this.npcs) { const f = this.npcFurn.get(n.id); if (f) { f.gx = Math.floor(n.gx); f.gy = Math.floor(n.gy); } }
    if (this.forced) {
      this.updateForced(dt);
    } else if (this.busy > 0) {
      this.busy -= dt;
      if (this.busy <= 0) { this.busy = 0; if (this.pose !== 'lie' && this.pose !== 'sit') this.pose = 'idle'; }
    } else {
      const speed = inp.sneak ? SNEAK_SPEED : WALK_SPEED;
      const manual = inp.mx !== 0 || inp.my !== 0;
      if (manual) {
        this.path = []; this.intent = null;
        if (this.on) { this.on = null; this.pose = 'idle'; }
        const v = screenDirToGrid(inp.mx, inp.my);
        const sx = v.x * speed * dt, sy = v.y * speed * dt;
        if (this.boxFree(this.px + sx, this.py)) this.px += sx;
        if (this.boxFree(this.px, this.py + sy)) this.py += sy;
        this.dx = v.x; this.dy = v.y; this.facing = screenSide(v.x, v.y);
        this.moving = true;
        this.walkPhase += speed * dt * 2.1;
        this.stepNoise(speed * dt);
      } else if (this.path.length) {
        let left = speed * dt;
        while (left > 1e-4 && this.path.length) {
          const c = this.path[0], tx = c.x + 0.5, ty = c.y + 0.5;
          const vx = tx - this.px, vy = ty - this.py, d = Math.hypot(vx, vy);
          if (d <= left) { this.px = tx; this.py = ty; left -= d; this.path.shift(); }
          else { this.px += (vx / d) * left; this.py += (vy / d) * left; left = 0; }
          if (d > 1e-4) { this.dx = vx / d; this.dy = vy / d; this.facing = screenSide(vx, vy); }
        }
        const moved = speed * dt - left;
        this.moving = moved > 1e-4;
        this.walkPhase += moved * 2.1;
        this.stepNoise(moved);
        if (!this.path.length && this.intent) {
          const f = this.furnById.get(this.intent.fid);
          if (f) this.arrive();
        }
      }
      if (this.pose === 'idle' && inp.sneak && this.moving) this.pose = 'sneak';
      else if (this.pose === 'sneak' && !(inp.sneak && this.moving)) this.pose = 'idle';
    }
    const c = this.cell();
    if (!this.forced && this.armed && c.x === this.room.door.x && c.y === this.room.door.y && !this.busy) this.escapeOrLeave();
    for (const n of this.npcs) {
      n.t += dt;
      if (n.markT > 0) { n.markT -= dt; if (n.markT <= 0) n.mark = ''; }
      n.brain.update(this, n, dt);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) { this.rings[i].age += dt; if (this.rings[i].age >= this.rings[i].life) this.rings.splice(i, 1); }
    if (this.talkT > 0) { this.talkT -= dt; if (this.talkT <= 0) this.talking = ''; }
    this.pranksTimer -= dt;
    if (this.pranksTimer <= 0) { this.pranksTimer = 0.2; this.checkPranks(); }
  }

  private updateForced(dt: number) {
    let left = 6.2 * dt;
    while (left > 1e-4 && this.path.length) {
      const c = this.path[0], tx = c.x + 0.5, ty = c.y + 0.5, vx = tx - this.px, vy = ty - this.py, d = Math.hypot(vx, vy);
      if (d <= left) { this.px = tx; this.py = ty; left -= d; this.path.shift(); } else { this.px += (vx / d) * left; this.py += (vy / d) * left; left = 0; }
      if (d > 1e-4) this.facing = screenSide(vx, vy);
    }
    this.moving = true; this.walkPhase += 6.2 * dt * 2.1;
    if (!this.path.length) this.exit('expelled');
  }

  /** Pisar no tapete: sai. Um mercenário acordado e a caminho vira “fuga”. */
  private escapeOrLeave() {
    const chaser = this.npcs.find((n) => !n.away && (n.state === 'chase' || n.state === 'alert'));
    this.exit(chaser ? 'escape' : 'door', !!chaser);
  }

  // ─────────────── travessuras ───────────────
  pranksDone(): { id: string; label: string; done: boolean; bonus: boolean }[] {
    return this.room.pranks.map((p) => ({ id: p.id, label: p.label, done: p.done(this), bonus: !!p.bonus }));
  }

  private checkPranks() {
    let main = true, bonus = true, anyBonus = false;
    for (const p of this.room.pranks) {
      const d = p.done(this);
      if (d && !this.pranksSeen.has(p.id)) {
        this.pranksSeen.add(p.id);
        this.emit({ type: 'prank', id: p.id, label: p.label });
        this.sfx('secret', 0.6);
      }
      if (p.bonus) { anyBonus = true; if (!d) bonus = false; } else if (!d) main = false;
    }
    if (main && !this.has('karimbado')) {
      this.set('karimbado');
      // a estrela dourada é decidida agora: todos os bônus "merecidos" neste instante
      const extras = this.room.pranks.filter((p) => p.bonus);
      const gold = extras.length > 0 && extras.every((p) => (p.earn ? p.earn(this) : p.done(this)));
      if (gold) this.set('clean');
      this.emit({ type: 'karimbado', gold });
    }
    void anyBonus; void bonus;
  }

  /** Karimbo na rede/cadeira/cama: o desenho usa `on` para posicionar. */
  settle(fid: string, pose: Pose) {
    const f = this.furnById.get(fid);
    if (!f) return;
    const c = centerOf(f);
    this.px = c.gx; this.py = c.gy; this.on = fid; this.pose = pose;
  }
}
