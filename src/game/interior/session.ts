/**
 * Sessão de interior: cola entre o mundo (World, entrada, áudio, recompensas) e o simulador +
 * desenho. Vive só enquanto Karimbo está dentro; ao sair, tudo é liberado.
 */
import type { World } from '../world';
import type { ControlState } from '../../core/input';
import type { ExplorationSpot } from '../exploration';
import { collectCoin } from '../../core/skins';
import { audio } from '../../core/audio';
import type { SfxName } from '../../core/audio';
import { InteriorSim, type InteriorHost } from './sim';
import type { ExitReason, FurnitureDef, InteriorEvent, RoomDef } from './types';
import { InteriorRenderer, type SceneState } from '../../art/interior/renderer';
import { warmActors, clearActorCache } from '../../art/interior/actors';
import { POP_LIFE, type Pop } from '../../art/interior/fx';
import { drawOverlay, lastPointer, newUi, sliceAt, layoutMenu, type UiState } from '../../art/interior/ui';
import type { Quality } from '../../art/index';

export interface PointerEv { type: 'move' | 'tap' | 'long' | 'context'; x: number; y: number; touch: boolean }

export interface SessionInit {
  w: World;
  spot: ExplorationSpot;
  room: RoomDef;
  backdrop: HTMLCanvasElement | null;
  quality: Quality;
  viewW: number;
  viewH: number;
  /** primeira vez que o jogador entra em qualquer interior (liga as dicas) */
  tutorial: boolean;
}

export interface Outcome { reason: ExitReason; alerted: boolean; room: RoomDef['id']; spot: ExplorationSpot }

const ASSEMBLE_S = 1.1, DISASSEMBLE_S = 0.4;
const SFX_OK = new Set<string>(['step', 'creak', 'secret', 'coin', 'heal', 'pickup', 'crateBreak', 'debris', 'burp', 'whistle', 'clap', 'uiClick', 'uiBack', 'lock', 'unlock', 'splash', 'crush', 'knife', 'servo', 'spark', 'wade', 'bird', 'insect', 'frog', 'hurt']);

export class InteriorSession {
  readonly sim: InteriorSim;
  readonly renderer: InteriorRenderer;
  readonly ui: UiState = newUi();
  readonly scene: SceneState = { assemble: 0, hover: null, selFid: null, dest: null, pops: [], pulseFid: null, time: 0 };
  phase: 'in' | 'live' | 'out' | 'done' = 'in';
  outcome: Outcome | null = null;
  private w: World;
  private spot: ExplorationSpot;
  private t = 0;
  private shakeT = 0; private shakeM = 0;
  private kbSel: string | null = null;
  private pointerAge = 99;
  private hoverFid: string | null = null;
  private tutorialStep = 0;
  private hintClock = 0;
  private padHeld = { x: 0, y: 0 };
  private viewW: number; private viewH: number;
  private pendingExit: { reason: ExitReason; alerted: boolean } | null = null;
  private asked = false;

  constructor(init: SessionInit) {
    this.w = init.w; this.spot = init.spot;
    this.viewW = init.viewW; this.viewH = init.viewH;
    const host: InteriorHost = {
      legacy: (obj, kind) => {
        const key = `${init.spot.id}:${obj}`;
        return init.w.encounters.completed.has(kind === 'open' ? `${key}:open` : key);
      },
    };
    this.sim = new InteriorSim(init.room, init.w.interiors, host, Math.floor(init.w.time * 1000) + 1);
    this.sim.set('visited');
    this.renderer = new InteriorRenderer(this.sim, init.backdrop, init.quality);
    this.renderer.fit(init.viewW, init.viewH);
    warmActors(this.sim);
    this.ui.title = init.room.title;
    this.ui.rep = this.sim.rep;
    this.tutorialStep = init.tutorial ? 1 : 99;
    if (init.tutorial) { this.ui.hint = ''; this.hintClock = 0; }
    this.refreshLists();
    audio.setUnderwater(0.38);
  }

  get active() { return this.phase !== 'done'; }

  // ─────────────── entrada de dados ───────────────
  resize(W: number, H: number) { this.viewW = W; this.viewH = H; }

  pointer(e: PointerEv) {
    lastPointer.x = e.x; lastPointer.y = e.y;
    this.pointerAge = 0;
    if (this.phase !== 'live') return;
    const ui = this.ui, r = this.renderer;
    if (ui.reader) { if (e.type === 'tap' && ui.reader.t > 0.25) ui.reader = null; return; }
    if (e.type === 'move') {
      if (ui.menu) { const i = sliceAt(ui.menu, this.viewW, this.viewH, e.x, e.y); if (i >= 0) ui.menu.sel = i; return; }
      this.scene.hover = r.cellAt(e.x, e.y);
      const f = r.pickFurniture(e.x, e.y);
      this.hoverFid = f?.id ?? null;
      ui.hoverName = f ? f.name : '';
      return;
    }
    if (e.type === 'context') {
      if (ui.menu) { this.closeMenu(); return; }
      const f = r.pickFurniture(e.x, e.y);
      if (f) this.quickExamine(f);
      return;
    }
    if (e.type === 'long') {
      const f = r.pickFurniture(e.x, e.y);
      if (f) this.quickExamine(f);
      return;
    }
    // tap
    if (ui.menu) {
      const i = sliceAt(ui.menu, this.viewW, this.viewH, e.x, e.y);
      if (i >= 0) { ui.menu.sel = i; this.confirmMenu(); } else this.closeMenu();
      return;
    }
    const lr = ui.listRect;
    if (ui.pranks.length && e.x >= lr.x && e.x <= lr.x + lr.w && e.y >= lr.y && e.y <= lr.y + lr.h) { ui.list = !ui.list; audio.play('uiClick', 0.4); return; }
    const f = r.pickFurniture(e.x, e.y);
    if (f) { this.openMenu(f); return; }
    const npc = this.pickNpc(e.x, e.y);
    if (npc) { this.sim.say(this.sim.line('npc:' + npc.id, this.sim.room.id === 'palafita' ? ['Melhor não cutucar.', 'Ele ronca em dó menor.'] : ['Ela está de olho!', 'Educação primeiro, Karimbo.']), 'karimbo', 2.2); return; }
    const c = r.cellAt(e.x, e.y);
    if (c && this.sim.walkTo(c)) this.scene.dest = c;
  }

  private pickNpc(x: number, y: number) {
    const r = this.renderer;
    for (const n of this.sim.npcs) {
      if (n.away) continue;
      const p = r.toScreen(n.gx, n.gy, 0, [0, 0]);
      if (Math.abs(x - p[0]) < 16 * r.s && y < p[1] + 6 && y > p[1] - 70 * r.s) return n;
    }
    return null;
  }

  // ─────────────── menu ───────────────
  private openMenu(f: FurnitureDef) {
    const verbs = this.sim.verbsFor(f.id);
    if (!verbs.length) return;
    const a = this.renderer.anchor(f, [0, 0]);
    this.ui.menu = { fid: f.id, name: f.name, verbs, sel: 0, ax: a[0], ay: a[1] + 14, t: 0 };
    layoutMenu(this.ui.menu, this.viewW, this.viewH);
    this.scene.selFid = f.id;
    audio.play('uiClick', 0.35);
    if (this.tutorialStep === 2) this.setHint('Ondas = barulho da ação. Olho = alguém vai ver. Vermelho = irrita o morador.', 6, 3);
  }

  private closeMenu() { this.ui.menu = null; this.scene.selFid = this.kbSel; audio.play('uiBack', 0.3); }

  private confirmMenu() {
    const m = this.ui.menu;
    if (!m) return;
    const v = m.verbs[m.sel];
    this.ui.menu = null;
    this.scene.selFid = null;
    if (v) {
      this.scene.dest = null;
      this.sim.act(m.fid, v.id);
      audio.play('uiClick', 0.4);
    }
  }

  private quickExamine(f: FurnitureDef) {
    const verbs = this.sim.verbsFor(f.id);
    const v = verbs.find((x) => x.id === 'examine') ?? verbs[0];
    if (v) this.sim.act(f.id, v.id);
  }

  private setHint(text: string, secs: number, nextStep?: number) { this.ui.hint = text; this.ui.hintT = secs; if (nextStep) this.tutorialStep = nextStep; }

  private hintText(step: number, device: string): string {
    if (step === 1) return device === 'touch' ? 'Toque no chão para andar e num objeto para ver o que dá para fazer.'
      : device === 'pad' ? 'Analógico anda · LB/RB escolhe objeto · A age · B sai pela porta.'
      : 'Clique no chão para andar e num objeto para agir. Setas/WASD também andam · Espaço age.';
    if (step === 3) return device === 'touch' ? 'Segure PONTA para andar sem fazer barulho.' : 'Segure SHIFT para andar na ponta dos pés: bem menos barulho.';
    return '';
  }

  // ─────────────── atualização ───────────────
  update(dt: number, ctl: ControlState) {
    this.t += dt;
    this.pointerAge += dt;
    this.scene.time = this.t;
    const ui = this.ui;
    if (ui.hintT > 0) ui.hintT -= dt;
    for (const c of ui.captions) c.age += dt;
    ui.captions = ui.captions.filter((c) => c.age < c.ttl);
    for (const to of ui.toasts) to.t += dt;
    ui.toasts = ui.toasts.filter((to) => to.t < 3);
    if (ui.menu) ui.menu.t += dt;
    if (ui.reader) ui.reader.t += dt;
    if (ui.stamp) { ui.stamp.t += dt; if (ui.stamp.t > 2.7) ui.stamp = null; }
    for (const p of this.scene.pops) p.t += dt;
    this.scene.pops = this.scene.pops.filter((p) => p.t < POP_LIFE);
    if (this.shakeT > 0) this.shakeT -= dt;
    this.renderer.particles.update(dt);
    // montagem / desmontagem
    if (this.phase === 'in') {
      this.scene.assemble = Math.min(1, this.scene.assemble + dt / ASSEMBLE_S);
      if (this.scene.assemble >= 1) { this.phase = 'live'; if (this.tutorialStep === 1) { this.hintClock = 0.4; } }
      this.handleSkip(ctl);
      this.drainEvents();
      return;
    }
    if (this.phase === 'out') {
      this.scene.assemble = Math.max(0, this.scene.assemble - dt / DISASSEMBLE_S);
      if (this.scene.assemble <= 0) { this.phase = 'done'; this.outcome = { ...this.pendingExit!, room: this.sim.room.id, spot: this.spot }; }
      this.drainEvents();
      return;
    }
    if (this.phase !== 'live') return;
    // dica de tutorial depois de um instante
    if (this.hintClock > 0 && this.tutorialStep === 1) {
      this.hintClock -= dt;
      if (this.hintClock <= 0) this.setHint(this.hintText(1, ctl.device), 7, 2);
    }
    this.input(dt, ctl);
    this.sim.update(dt, { mx: this.moveX, my: this.moveY, sneak: this.sneak });
    this.afterSim(ctl);
    this.drainEvents();
  }

  private moveX = 0; private moveY = 0; private sneak = false;

  private handleSkip(ctl: ControlState) {
    // qualquer botão pula a montagem
    if (this.phase === 'in' && this.scene.assemble > 0.15 && (ctl.jump.pressed || ctl.fire.pressed || ctl.interact?.pressed || ctl.grenade.pressed)) { this.scene.assemble = 1; }
  }

  private input(dt: number, ctl: ControlState) {
    const ui = this.ui, sim = this.sim;
    this.moveX = 0; this.moveY = 0;
    this.sneak = ctl.special.held;
    const accept = ctl.jump.pressed || ctl.interact?.pressed;
    if (ui.reader) {
      if ((accept || ctl.grenade.pressed || ctl.fire.pressed) && ui.reader.t > 0.25) ui.reader = null;
      return;
    }
    if (ui.menu) {
      const m = ui.menu;
      const px = Math.abs(ctl.moveX) > 0.55 ? Math.sign(ctl.moveX) : 0, py = Math.abs(ctl.moveY) > 0.55 ? Math.sign(ctl.moveY) : 0;
      let step = 0;
      if (px !== this.padHeld.x && px) step = px; else if (py !== this.padHeld.y && py) step = py;
      this.padHeld.x = px; this.padHeld.y = py;
      if (ctl.next.pressed) step = 1; else if (ctl.prev.pressed) step = -1;
      if (step) { m.sel = (m.sel + step + m.verbs.length) % m.verbs.length; audio.play('uiClick', 0.25); }
      if (accept) this.confirmMenu();
      else if (ctl.grenade.pressed || ctl.fire.pressed) this.closeMenu();
      return;
    }
    this.padHeld.x = this.padHeld.y = 0;
    if (ctl.reload?.pressed) { ui.list = !ui.list; audio.play('uiClick', 0.4); }
    this.moveX = ctl.moveX; this.moveY = ctl.moveY;
    const reach = sim.reachable();
    const usePointer = this.pointerAge < 2.5 && ctl.device === 'kb';
    if (!reach.some((f) => f.id === this.kbSel)) this.kbSel = reach[0]?.id ?? null;
    if (ctl.next.pressed && reach.length) { const i = reach.findIndex((f) => f.id === this.kbSel); this.kbSel = reach[(i + 1) % reach.length].id; audio.play('uiClick', 0.2); }
    if (ctl.prev.pressed && reach.length) { const i = reach.findIndex((f) => f.id === this.kbSel); this.kbSel = reach[(i - 1 + reach.length) % reach.length].id; audio.play('uiClick', 0.2); }
    this.scene.selFid = ctl.device === 'touch' ? null : (usePointer ? this.hoverFid : this.kbSel);
    ui.hoverName = usePointer ? ui.hoverName : (ctl.device === 'touch' ? '' : (sim.furnById.get(this.kbSel ?? '')?.name ?? ''));
    if (accept && this.kbSel) { const f = sim.furnById.get(this.kbSel); if (f) this.openMenu(f); }
    else if (ctl.fire.pressed && this.kbSel) { const f = sim.furnById.get(this.kbSel); if (f) this.quickExamine(f); }
    else if (ctl.grenade.pressed) { if (!sim.leave()) sim.say('Daqui não dá para sair.', 'karimbo', 1.6); else this.scene.dest = sim.room.door; }
    if (sim.moving && this.tutorialStep === 2) this.tutorialStep = 2;
    if (sim.path.length === 0) this.scene.dest = null;
    void dt;
  }

  private afterSim(ctl: ControlState) {
    const sim = this.sim;
    if (sim.rings.length && this.tutorialStep === 3 && !sim.sneaking && this.ui.hintT <= 0) this.setHint(this.hintText(3, ctl.device), 6, 99);
    this.ui.rep = sim.rep;
    if ((sim.t * 4 | 0) !== ((sim.t - 0.016) * 4 | 0)) this.refreshLists();
  }

  private refreshLists() {
    this.ui.pranks = this.sim.pranksDone();
    this.ui.pocket = this.sim.room.pocket?.(this.sim) ?? [];
  }

  // ─────────────── eventos ───────────────
  private drainEvents() {
    const sim = this.sim, w = this.w;
    for (const e of sim.drain()) this.handle(e, sim, w);
  }

  private handle(e: InteriorEvent, sim: InteriorSim, w: World) {
    const ui = this.ui, r = this.renderer;
    switch (e.type) {
      case 'say': {
        ui.captions = ui.captions.filter((c) => c.who !== e.who);
        ui.captions.push({ who: e.who, text: e.text, ttl: e.ttl, age: 0 });
        break;
      }
      case 'read': ui.reader = { title: e.title, text: e.text, t: 0 }; audio.play('pickup', 0.4); break;
      case 'ring': break;
      case 'pop': {
        const p = r.toScreen(e.gx, e.gy, 40, [0, 0]);
        this.scene.pops.push({ text: e.text, sx: p[0], sy: p[1], t: 0, color: e.color, size: 17 } as Pop);
        break;
      }
      case 'fx': r.particles.burst(e.kind, e.gx, e.gy, e.n ?? 1); break;
      case 'sfx': if (SFX_OK.has(e.name)) audio.play(e.name as SfxName, e.vol ?? 1, 0); break;
      case 'shake': this.shakeT = e.dur; this.shakeM = e.mag; break;
      case 'legacy': this.legacy(e.obj); break;
      case 'heal': {
        const p = w.player;
        p.hp = Math.min(p.maxHp, p.hp + e.n);
        audio.play('heal', 0.7);
        r.particles.burst('sparkle', sim.px, sim.py, 6, 30);
        break;
      }
      case 'coins': {
        for (let i = 0; i < e.n; i++) collectCoin();
        w.tokens += e.n; w.score += e.n * 10;
        audio.play('coin', 0.8);
        r.particles.burst('coins', sim.px, sim.py, Math.min(8, e.n), 36);
        this.toast(`+${e.n} moedas`, '', 'info');
        break;
      }
      case 'rep': this.toast(e.delta > 0 ? 'A aldeia gostou disso' : 'A aldeia torceu o nariz', `Reputação ${e.total > 0 ? '+' : ''}${e.total}`, 'rep'); break;
      case 'prank': this.toast('Travessura!', e.label, 'prank'); w.hooks.onProgress?.(); this.refreshLists(); break;
      case 'karimbado': {
        ui.stamp = { t: 0, gold: e.gold };
        const coins = e.gold ? 160 : 80;
        for (let i = 0; i < coins; i++) collectCoin();
        w.tokens += coins; w.score += coins * 10;
        audio.play('secret', 1);
        r.particles.burst('sparkle', sim.px, sim.py, 24, 50);
        this.shakeT = 0.4; this.shakeM = 3;
        this.toast(`+${coins} moedas`, e.gold ? 'Estrela dourada!' : 'Lista completa', 'info');
        break;
      }
      case 'banner': this.toast(e.title, e.sub, 'info'); break;
      case 'alert': audio.play('warning', 0.4); break;
      case 'hurt': break;
      case 'exit': {
        this.pendingExit = { reason: e.reason, alerted: e.alerted };
        this.phase = 'out';
        ui.menu = null; ui.reader = null;
        sim.commit();
        break;
      }
    }
  }

  private toast(title: string, sub: string, kind: 'prank' | 'rep' | 'info') {
    this.ui.toasts.push({ title, sub, t: 0, kind });
    if (this.ui.toasts.length > 3) this.ui.toasts.shift();
  }

  /** Objetos legados (gaveta, baú, retrato, carta) usam a economia e o caderno do modal antigo. */
  private legacy(objId: string) {
    const spot = this.spot, w = this.w;
    const obj = spot.objects.find((o) => o.id === objId);
    if (!obj) return;
    const text = w.exploration.inspect(w, spot, obj);
    if (!text) return;
    if (text.length > 120) this.sim.read(obj.name, text); else this.sim.say(text, 'karimbo', 4);
    w.hooks.onProgress?.();
  }

  // ─────────────── desenho ───────────────
  draw(g: CanvasRenderingContext2D, W: number, H: number) {
    g.save();
    if (this.shakeT > 0) {
      const k = Math.min(1, this.shakeT / 0.3) * this.shakeM;
      g.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    }
    this.renderer.draw(g, W, H, this.t, this.scene);
    g.restore();
    if (this.scene.assemble > 0.8) drawOverlay(g, this.renderer, this.ui, W, H, this.t);
  }

  /** Para a sessão e libera tudo. */
  dispose() {
    this.renderer.dispose();
    clearActorCache();
    this.phase = 'done';
  }
}
