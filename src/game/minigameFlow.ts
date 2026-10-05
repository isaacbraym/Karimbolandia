/**
 * Orquestra a entrada e a saída dos minijogos (boxe e perseguição). Este arquivo é pequeno e fica no
 * pacote principal; TUDO que é de minijogo (simulação, arte, música própria) só entra por `import()`:
 * nada é baixado antes de o jogador chegar perto do gatilho, e tudo é liberado ao sair.
 * Aqui só há `import type` de `./minigames/*` (apagado na compilação). Padrão de `InteriorFlow`:
 * o mundo fica congelado e a sessão assume a tela.
 */
import type { World, MusicState } from './world';
import type { ControlState, Input, MiniMode } from '../core/input';
import type { MinigameId, MinigameModule, MinigameResult, MinigameSession } from './minigames/types';
import type { Quality } from '../art/index';
import { difficultyId } from '../core/difficulty';
import { audio } from '../core/audio';

export interface MinigameHost {
  input: Input;
  quality: () => Quality;
  view: () => { W: number; H: number };
  /** layout de toque do minijogo (null = normal) */
  touchMode: (mode: MiniMode | null) => void;
  touchSpecial: (on: boolean) => void;
  /** grava a partida depois de uma vitória */
  saved: () => void;
  banner: (title: string, sub: string, dur?: number) => void;
}

type Phase = 'idle' | 'zoom' | 'wait' | 'live' | 'back';
export type MinigameLoaders = Record<MinigameId, () => Promise<MinigameModule>>;

const ZOOM_S = 0.45, BACK_S = 0.4;
const easeIn = (t: number) => t * t;

/** Carregadores reais: o ÚNICO lugar do pacote principal que menciona os minijogos (sempre por import()). */
const REAL_LOADERS: MinigameLoaders = {
  boxing: () => import('./minigames/boxing'),
  chase: () => import('./minigames/chase'),
};

export class MinigameFlow {
  phase: Phase = 'idle';
  session: MinigameSession | null = null;
  id: MinigameId | null = null;
  private onDone: ((r: MinigameResult) => void) | null = null;
  private t = 0;
  private mods = new Map<MinigameId, MinigameModule>();
  private loading = new Map<MinigameId, Promise<MinigameModule>>();
  private failed = new Set<MinigameId>();
  private backdrop: HTMLCanvasElement | null = null;
  private prevMusic: MusicState = 'explore';
  private origin = { x: 0, y: 0 };

  constructor(private host: MinigameHost, private loaders: MinigameLoaders = REAL_LOADERS) {}

  /** O mundo fica congelado e a sessão assume a tela. */
  get active() { return this.phase !== 'idle'; }
  /** O quadro inteiro é da sessão (o mundo nem é desenhado). */
  get drawsMinigame() { return this.phase === 'live' || this.phase === 'wait'; }

  private load(id: MinigameId): Promise<MinigameModule> {
    const have = this.mods.get(id);
    if (have) return Promise.resolve(have);
    let p = this.loading.get(id);
    if (!p) {
      p = this.loaders[id]().then((m) => { this.mods.set(id, m); return m; });
      this.loading.set(id, p);
      p.catch(() => { this.loading.delete(id); });
    }
    return p;
  }

  /** Pré-busca silenciosa quando o jogador se aproxima do gatilho. */
  prefetch(id: MinigameId) {
    if (this.mods.has(id) || this.loading.has(id)) return;
    this.load(id).catch(() => { /* a falha aparece (com banner) só se o jogador tentar entrar */ });
  }

  /** Entra no minijogo: íris, carregamento (se preciso) e sessão. `onDone` recebe o resultado (inclusive `abort`). */
  start(w: World, id: MinigameId, onDone: (r: MinigameResult) => void): boolean {
    if (this.phase !== 'idle') return false;
    this.id = id;
    this.onDone = onDone;
    this.phase = 'zoom';
    this.t = 0;
    this.backdrop = null;
    this.prevMusic = w.musicState;
    this.origin = { x: w.player.x, y: w.player.y - 24 };
    w.narrator.stop();
    w.clearEnemyBullets();
    w.player.body.vx = 0;
    w.camera.focus = { x: this.origin.x, y: this.origin.y, rate: 7 };
    w.camera.zoomTarget = Math.max(w.camera.zoom, 1.5);
    this.failed.delete(id);
    this.load(id).catch(() => { this.failed.add(id); });
    audio.play('uiClick', 0.5);
    return true;
  }

  /** Um quadro de simulação enquanto o fluxo está ativo (o mundo não é atualizado). */
  step(w: World, dt: number, ctl: ControlState) {
    const id = this.id!;
    if (this.phase === 'zoom') {
      this.t += dt;
      w.camera.update(dt, this.origin.x, this.origin.y, w.player.facing, 0, true, 0, false);
      if (this.t >= ZOOM_S) this.phase = this.failed.has(id) ? this.abortLoad(w) : 'wait';
    } else if (this.phase === 'wait') {
      if (this.failed.has(id)) this.phase = this.abortLoad(w);
      else if (this.mods.has(id)) this.begin(w);
    } else if (this.phase === 'live' && this.session) {
      this.session.update(dt, ctl);
      if (this.session.done) this.finish(w, this.session.result());
    } else if (this.phase === 'back') {
      this.t += dt;
      w.camera.update(dt, this.origin.x, this.origin.y, w.player.facing, 0, true, 0, false);
      if (this.t >= BACK_S) { this.phase = 'idle'; w.camera.focus = null; this.id = null; }
    }
    this.host.input.clearEdges();
  }

  private begin(w: World) {
    const { W, H } = this.host.view();
    try {
      this.session = this.mods.get(this.id!)!.create({
        w, quality: this.host.quality(), viewW: W, viewH: H, difficulty: difficultyId(), backdrop: this.backdrop,
        music: (s) => w.setMusic(s),
        touch: (m) => this.host.touchMode(m),
        special: (on) => this.host.touchSpecial(on),
      });
    } catch (e) {
      console.error('minijogo', e);
      this.phase = this.abortLoad(w, 'O minijogo não pôde ser montado.');
      return;
    }
    this.backdrop = null; // a sessão é a dona
    this.phase = 'live';
    const mode: MiniMode = this.id === 'boxing' ? 'boxing' : 'chase';
    this.host.input.mouseActions = false;
    this.host.input.setMiniMode(mode);
    this.host.touchMode(mode);
  }

  private abortLoad(w: World, msg = 'O minijogo não pôde ser carregado. Tente de novo.'): Phase {
    w.camera.focus = null;
    this.host.banner('MINIJOGO INDISPONÍVEL', msg, 3);
    const id = this.id!;
    this.restore(w);
    this.id = null;
    this.fire({ id, outcome: 'abort', time: 0, mistakes: 0 });
    return 'idle';
  }

  /** Devolve tudo ao jogo: toque, entrada, música e áudio. Nunca deixa o controle preso. */
  private restore(w?: World) {
    this.host.touchSpecial(false);
    this.host.touchMode(null);
    this.host.input.setMiniMode(null);
    this.host.input.mouseActions = true;
    if (w) { w.setMusic(this.prevMusic); audio.setUnderwater(w.underwater); }
  }

  private fire(r: MinigameResult) {
    const cb = this.onDone;
    this.onDone = null;
    try { cb?.(r); } catch (e) { console.error('minijogo (resultado)', e); }
  }

  private finish(w: World, r: MinigameResult | null) {
    const s = this.session!;
    this.session = null;
    s.dispose();
    this.restore(w);
    const result = r ?? { id: this.id!, outcome: 'abort' as const, time: 0, mistakes: 0 };
    this.fire(result);
    this.phase = 'back';
    this.t = 0;
    if (result.outcome === 'win') this.host.saved();
  }

  // ─────────────── desenho ───────────────
  /** Desenha a sessão (se for a vez dela). Devolve true se o quadro já está completo. */
  draw(g: CanvasRenderingContext2D, W: number, H: number): boolean {
    if (this.phase === 'wait') { g.fillStyle = '#05030a'; g.fillRect(0, 0, W, H); return true; }
    if (this.phase === 'live' && this.session) { this.session.draw(g, W, H); return true; }
    return false;
  }

  /** Depois de o mundo ser desenhado: captura o fundo borrado e fecha/abre a íris. */
  postWorld(g: CanvasRenderingContext2D, canvas: HTMLCanvasElement, W: number, H: number, w: World) {
    if (this.phase !== 'zoom' && this.phase !== 'back') return;
    const cam = w.camera;
    const cx = (this.origin.x - cam.x + cam.sx) * cam.zoom, cy = (this.origin.y - cam.y + cam.sy) * cam.zoom;
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

  resize(W: number, H: number) { this.session?.resize(W, H); }

  /** Libera tudo (reinício da fase, sair para o menu, mudar de conta...). Nunca dá prêmio: devolve `abort`. */
  reset(w?: World) {
    if (this.phase === 'idle') return;
    const id = this.id!;
    if (this.session) { this.session.dispose(); this.session = null; }
    if (w) w.camera.focus = null;
    this.restore(w);
    this.phase = 'idle';
    this.backdrop = null;
    this.id = null;
    this.fire({ id, outcome: 'abort', time: 0, mistakes: 0 });
  }
}
