/**
 * Orquestra a entrada e a saída dos interiores jogáveis. Este arquivo é pequeno e fica no pacote
 * principal; TUDO que é do interior (simulador, desenho, cômodos) só entra por `import()`:
 * nada é baixado antes de o jogador chegar perto de uma porta, e tudo é liberado ao sair.
 * Aqui só há `import type` de `./interior` (apagado na compilação).
 */
import type { World } from './world';
import type { ControlState, Input } from '../core/input';
import type { ExplorationSpot } from './exploration';
import type { InteriorSession, Outcome, PointerEv } from './interior';
import type { RoomDef } from './interior/types';
import type { Quality } from '../art/index';
import { audio } from '../core/audio';
import { toLocal, localRect } from '../core/orient';

export interface FlowHost {
  canvas: HTMLCanvasElement;
  input: Input;
  quality: () => Quality;
  view: () => { W: number; H: number };
  /** liga/desliga os controles de toque específicos do interior */
  touchMode: (on: boolean) => void;
  /** grava a partida (como ao sair do modal antigo) */
  saved: () => void;
  banner: (title: string, sub: string, dur?: number) => void;
}

type Phase = 'idle' | 'zoom' | 'wait' | 'live' | 'back';
type Mod = typeof import('./interior');

const ZOOM_S = 0.55, BACK_S = 0.4;
const easeIn = (t: number) => t * t;

export class InteriorFlow {
  phase: Phase = 'idle';
  session: InteriorSession | null = null;
  private spot: ExplorationSpot | null = null;
  private t = 0;
  private mod: Mod | null = null;
  private modP: Promise<Mod> | null = null;
  private roomP = new Map<string, Promise<RoomDef>>();
  private room: RoomDef | null = null;
  private backdrop: HTMLCanvasElement | null = null;
  private failed = false;
  private seenAny = false;
  private detach: (() => void) | null = null;

  constructor(private host: FlowHost) {}

  /** O mundo fica congelado e o desenho do interior assume a tela. */
  get active() { return this.phase !== 'idle'; }
  /** O quadro inteiro é do interior (o mundo nem é desenhado). */
  get drawsInterior() { return this.phase === 'live' || this.phase === 'wait'; }

  /** Pré-busca silenciosa quando o jogador chega perto de uma porta com interior. */
  prefetch(spot: ExplorationSpot | undefined) {
    if (!spot?.interior || this.failed) return;
    this.load(spot.interior).catch(() => { this.failed = true; });
  }

  private load(room: NonNullable<ExplorationSpot['interior']>): Promise<RoomDef> {
    if (!this.modP) this.modP = import('./interior').then((m) => (this.mod = m));
    let r = this.roomP.get(room);
    if (!r) {
      r = this.modP.then((m) => m.loadRoom(room));
      this.roomP.set(room, r);
    }
    return r;
  }

  tryEnter(w: World, spot: ExplorationSpot): boolean {
    if (this.phase !== 'idle' || !spot.interior) return false;
    this.spot = spot;
    this.phase = 'zoom';
    this.t = 0;
    this.backdrop = null;
    this.room = null;
    this.seenAny = w.interiors.toSave().length > 0;
    this.load(spot.interior).then((room) => { this.room = room; }, () => { this.failed = true; });
    const p = w.player;
    w.camera.focus = { x: spot.x, y: spot.y - 48, rate: 7 };
    w.camera.zoomTarget = Math.max(w.camera.zoom, 1.7);
    p.body.vx = 0;
    audio.play('uiClick', 0.5);
    return true;
  }

  /** Um quadro de simulação enquanto o fluxo está ativo (o mundo não é atualizado). */
  step(w: World, dt: number, ctl: ControlState) {
    const spot = this.spot!;
    if (this.phase === 'zoom') {
      this.t += dt;
      w.camera.update(dt, spot.x, spot.y - 48, w.player.facing, 0, true, 0, false);
      if (this.t >= ZOOM_S) {
        if (this.failed) { this.abort(w, 'O interior não pôde ser carregado. Tente de novo.'); }
        else this.phase = 'wait';
      }
    } else if (this.phase === 'wait') {
      if (this.failed) this.abort(w, 'O interior não pôde ser carregado. Tente de novo.');
      else if (this.room && this.mod) this.begin(w);
    } else if (this.phase === 'live' && this.session) {
      this.session.update(dt, ctl);
      if (this.session.phase === 'done') this.finish(w);
    } else if (this.phase === 'back') {
      this.t += dt;
      w.camera.update(dt, spot.x, spot.y - 48, w.player.facing, 0, true, 0, false);
      if (this.t >= BACK_S) { this.phase = 'idle'; w.camera.focus = null; }
    }
    this.host.input.clearEdges();
  }

  private begin(w: World) {
    const { W, H } = this.host.view();
    try {
      this.session = new this.mod!.InteriorSession({
        w, spot: this.spot!, room: this.room!, backdrop: this.backdrop, quality: this.host.quality(), viewW: W, viewH: H, tutorial: !this.seenAny,
      });
    } catch (e) {
      console.error('interior', e);
      this.abort(w, 'O interior não pôde ser montado.');
      return;
    }
    this.backdrop = null; // a sessão é a dona
    this.phase = 'live';
    this.host.touchMode(true);
    this.host.input.mouseActions = false;
    this.host.input.suppressHeldActions();
    this.detach = this.attachPointer();
  }

  private abort(w: World, msg: string) {
    this.phase = 'idle';
    this.spot = null;
    w.camera.focus = null;
    this.host.banner('INTERIOR INDISPONÍVEL', msg, 3);
  }

  private finish(w: World) {
    const s = this.session!, o = s.outcome!;
    this.detach?.(); this.detach = null;
    s.dispose();
    this.session = null;
    this.host.touchMode(false);
    this.host.input.mouseActions = true;
    this.host.input.suppressHeldActions();
    audio.setUnderwater(w.underwater);
    this.apply(w, o);
    this.phase = 'back';
    this.t = 0;
    this.host.saved();
  }

  /** Consequências no mundo lateral (inimigo alertado, dano, porta trancada). */
  private apply(w: World, o: Outcome) {
    const p = w.player, spot = o.spot;
    w.interiorLock.delete(o.room);
    if (o.reason === 'escape' && o.alerted && o.room === 'palafita') {
      // o mercenário acordado sai pela porta atrás do Karimbo
      w.spawnEnemy({ id: -1000, type: 'rifle', x: spot.x + 4, y: spot.y, facing: p.facing === 1 ? -1 : 1 });
      w.fx.addShake(2, 0.2);
    } else if (o.reason === 'caught') {
      const dmg = Math.min(Math.round(p.maxHp * 0.22), Math.max(0, p.hp - 1));
      p.hp -= dmg;
      p.hurtT = 0.28; p.invuln = 1.7;
      p.body.vx = -p.facing * 230; p.body.vy = -210;
      w.fx.addShake(3.2, 0.22);
      w.audio('hurt', 0.9, p.x);
    } else if (o.reason === 'expelled') {
      w.interiorLock.set(o.room, w.checkpointIdx);
      p.body.vx = -p.facing * 190; p.body.vy = -150;
      w.audio('lock', 0.7, p.x);
    }
    w.village.afterInterior(o.room, o.reason, spot.x, o.mood);
  }

  // ─────────────── desenho ───────────────
  /** Desenha o interior (se for a vez dele). Devolve true se o quadro já está completo. */
  draw(g: CanvasRenderingContext2D, W: number, H: number): boolean {
    if (this.phase === 'wait') { g.fillStyle = '#05030a'; g.fillRect(0, 0, W, H); return true; }
    if (this.phase === 'live' && this.session) { this.session.draw(g, W, H); return true; }
    return false;
  }

  /** Depois de o mundo ser desenhado: captura o fundo desfocado e fecha/abre a íris. */
  postWorld(g: CanvasRenderingContext2D, canvas: HTMLCanvasElement, W: number, H: number, w: World) {
    if (this.phase !== 'zoom' && this.phase !== 'back') return;
    const spot = this.spot!;
    const cam = w.camera;
    const cx = (spot.x - cam.x + cam.sx) * cam.zoom, cy = (spot.y - 48 - cam.y + cam.sy) * cam.zoom;
    const maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 8;
    let k: number;
    if (this.phase === 'zoom') {
      k = Math.min(1, this.t / ZOOM_S);
      if (k >= 0.3 && !this.backdrop) this.capture(canvas);
      k = easeIn(Math.max(0, (k - 0.15) / 0.85));
    } else k = 1 - Math.min(1, this.t / BACK_S);
    const r = maxR * (1 - k) * (1 - k) + 0.001;
    if (k <= 0.001) return;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const kx = canvas.width / W, ky = canvas.height / H;
    g.fillStyle = '#05030a';
    g.beginPath();
    g.rect(0, 0, canvas.width, canvas.height);
    g.arc(cx * kx, cy * ky, r * kx, 0, Math.PI * 2, true);
    g.fill('evenodd');
    g.restore();
  }

  private capture(canvas: HTMLCanvasElement) {
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.ceil(canvas.width / 8)); c.height = Math.max(2, Math.ceil(canvas.height / 8));
    const x = c.getContext('2d');
    if (!x) return;
    x.imageSmoothingEnabled = true;
    x.drawImage(canvas, 0, 0, c.width, c.height);
    this.backdrop = c;
  }

  /** Libera tudo (reinício da fase, sair para o menu...). */
  reset(w?: World) {
    this.detach?.(); this.detach = null;
    if (this.session) { this.session.dispose(); this.session = null; }
    if (this.phase !== 'idle') {
      this.host.touchMode(false);
      this.host.input.mouseActions = true;
      if (w) { w.camera.focus = null; audio.setUnderwater(w.underwater); }
    }
    this.phase = 'idle';
    this.spot = null;
    this.backdrop = null;
  }

  // ─────────────── ponteiro ───────────────
  /** Tela (clientX/Y) → coordenadas lógicas do quadro. */
  private toView(clientX: number, clientY: number) {
    const r = localRect(this.host.canvas), p = toLocal(clientX, clientY), { W, H } = this.host.view();
    return { x: ((p.x - r.left) / r.width) * W, y: ((p.y - r.top) / r.height) * H };
  }

  /** Toque curto vindo da zona do joystick (que fica por cima do canvas): age como toque no cômodo. */
  tapAt(clientX: number, clientY: number) {
    if (!this.session || this.phase !== 'live') return;
    const q = this.toView(clientX, clientY);
    this.session.pointer({ type: 'tap', x: q.x, y: q.y, touch: true });
  }

  private attachPointer(): () => void {
    const c = this.host.canvas;
    const conv = (e: PointerEvent | MouseEvent) => this.toView(e.clientX, e.clientY);
    const send = (type: PointerEv['type'], e: PointerEvent | MouseEvent, touch: boolean) => {
      if (!this.session) return;
      const q = conv(e);
      this.session.pointer({ type, x: q.x, y: q.y, touch });
    };
    let down: { id: number; x: number; y: number; t: number; touch: boolean; timer: number; long: boolean } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.button === 2) return;
      const touch = e.pointerType !== 'mouse';
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), touch, timer: 0, long: false };
      if (touch) down.timer = window.setTimeout(() => { if (down) { down.long = true; send('long', e, true); } }, 430);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') send('move', e, false);
      if (down && down.id === e.pointerId && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) { window.clearTimeout(down.timer); down.long = true; }
    };
    const onUp = (e: PointerEvent) => {
      if (!down || down.id !== e.pointerId) return;
      window.clearTimeout(down.timer);
      const d = down; down = null;
      if (d.long || e.button === 2) return;
      send('tap', e, d.touch);
    };
    const onCancel = () => { if (down) window.clearTimeout(down.timer); down = null; };
    const onCtx = (e: MouseEvent) => { e.preventDefault(); send('context', e, false); };
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    c.addEventListener('contextmenu', onCtx);
    return () => {
      c.removeEventListener('pointerdown', onDown);
      c.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      c.removeEventListener('contextmenu', onCtx);
      if (down) window.clearTimeout(down.timer);
    };
  }

  /** Quantos canvases do interior continuam vivos (diagnóstico de vazamento). */
  async aliveCanvases(): Promise<number> {
    if (!this.mod) return 0;
    return this.mod.InteriorRenderer.alive;
  }
}
