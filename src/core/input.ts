import { settings } from './storage';
import { BoxGestures } from '../ui/boxGestures';
const hapticsOn = () => settings.haptics !== false;
/**
 * Entrada unificada: teclado + mouse + gamepad + toque.
 * O jogo lê apenas `input.state` (analógico + botões com borda pressionar/soltar).
 */

export type ActionName = 'jump' | 'fire' | 'grenade' | 'special' | 'next' | 'prev' | 'pause' | 'reload' | 'interact';
const ACTIONS: ActionName[] = ['jump', 'fire', 'grenade', 'special', 'next', 'prev', 'pause', 'reload', 'interact'];

export interface Btn {
  held: boolean;
  pressed: boolean;
  released: boolean;
}

/** Botões do boxe em 3ª pessoa (minijogo): 4 golpes de cada lado, esquivas, guarda e a ORELHADA. */
export type MiniButton = 'jab' | 'cruzE' | 'ganchoE' | 'direto' | 'cruzD' | 'ganchoD' | 'esqE' | 'esqD' | 'abaixar' | 'guarda' | 'especial';
export type MiniPad = Record<MiniButton, Btn>;
export const MINI_BUTTONS: readonly MiniButton[] = ['jab', 'cruzE', 'ganchoE', 'direto', 'cruzD', 'ganchoD', 'esqE', 'esqD', 'abaixar', 'guarda', 'especial'];
export type MiniMode = 'boxing' | 'chase';
/**
 * Teclas do boxe (as duas mãos, espelhando a tela): a mão ESQUERDA defende — A/← esquiva para a esquerda,
 * D/→ para a direita, S/↓ abaixa, W/↑ segurada = guarda — e a DIREITA soca: J jab, K direto, U cruzado
 * esquerdo, I cruzado direito, N gancho esquerdo, M gancho direito. Espaço/Enter = ORELHADA.
 */
const MINI_KEYS: Record<MiniButton, string[]> = {
  jab: ['KeyJ'], direto: ['KeyK'], cruzE: ['KeyU'], cruzD: ['KeyI'], ganchoE: ['KeyN'], ganchoD: ['KeyM'],
  esqE: ['KeyA', 'ArrowLeft'], esqD: ['KeyD', 'ArrowRight'], abaixar: ['KeyS', 'ArrowDown'], guarda: ['KeyW', 'ArrowUp'], especial: ['Space', 'Enter'],
};
/** id do "dedo" do mouse no reconhecedor de gestos do boxe */
const MOUSE_BOX_ID = -7;
/** analógico do boxe (0..1): quanto empurrar para esquivar / abaixar */
export const STICK_DODGE = 0.5, STICK_DUCK = 0.55;
const newMiniPad = (): MiniPad => Object.fromEntries(MINI_BUTTONS.map((b) => [b, { held: false, pressed: false, released: false }])) as MiniPad;
const newMiniHeld = (): Record<MiniButton, boolean> => Object.fromEntries(MINI_BUTTONS.map((b) => [b, false])) as Record<MiniButton, boolean>;

export interface TouchState {
  active: boolean; // controles de toque visíveis/em uso
  stickX: number;
  stickY: number;
  /** analógico de tiro (botão FOGO arrastável): vetor de mira, 0,0 quando parado */
  aimX: number;
  aimY: number;
  held: Record<ActionName, boolean>;
  /** minijogo de boxe: botões segurados pelo toque (cada dedo é dono do seu botão) */
  mini: Record<MiniButton, boolean>;
  /** esquivas por gesto (deslizar ←/→): bordas de um quadro, consumidas pelo poll */
  miniTaps: MiniButton[];
}

export const newTouchState = (): TouchState => ({
  active: false,
  stickX: 0,
  stickY: 0,
  aimX: 0,
  aimY: 0,
  held: { jump: false, fire: false, grenade: false, special: false, next: false, prev: false, pause: false, reload:false, interact:false },
  mini: newMiniHeld(),
  miniTaps: [],
});

export interface ControlState {
  moveX: number; // -1..1
  moveY: number; // -1 (cima) .. 1 (baixo)
  /** Direção de mira digital/analógica vinda do stick/teclado/gamepad (vetor, pode ser 0,0). */
  aimVecX: number;
  aimVecY: number;
  /** Mira livre por mouse/analógico direito; null quando não usada. */
  mouseAim: { x: number; y: number } | null; // em px de tela do canvas (CSS)
  padAim: { x: number; y: number } | null; // vetor normalizado (analógico direito)
  jump: Btn;
  fire: Btn;
  grenade: Btn;
  special: Btn;
  next: Btn;
  prev: Btn;
  pause: Btn;
  reload?: Btn;
  interact?: Btn;
  /** Preenchido só quando `input.miniMode === 'boxing'`. */
  mini?: MiniPad;
  device: 'kb' | 'touch' | 'pad';
}

const newBtn = (): Btn => ({ held: false, pressed: false, released: false });

const MOVE_KEYS = new Set(['KeyA', 'KeyD', 'KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
export class Input {
  readonly state: ControlState & {reload:Btn;interact:Btn} = {
    moveX: 0,
    moveY: 0,
    aimVecX: 0,
    aimVecY: 0,
    mouseAim: null,
    padAim: null,
    jump: newBtn(),
    fire: newBtn(),
    grenade: newBtn(),
    special: newBtn(),
    next: newBtn(),
    prev: newBtn(),
    pause: newBtn(),
    reload:newBtn(),
    interact:newBtn(),
    device: 'kb',
  };
  readonly touch: TouchState = newTouchState();
  /** Modo de minijogo ativo (muda o mapeamento de teclas/gamepad/toque); null = jogo normal. */
  private _miniMode: MiniMode | null = null;
  private miniPrev = newMiniHeld();
  private miniSuppressed = new Set<MiniButton>();
  get miniMode() { return this._miniMode; }
  /**
   * Entrar/sair de um minijogo: o que estava apertado precisa ser solto antes de valer (nada de golpe
   * ou tiro "fantasma" ao trocar de modo) e as bordas pendentes são descartadas.
   */
  setMiniMode(mode: MiniMode | null) {
    this._miniMode = mode;
    this.state.mini = mode === 'boxing' ? newMiniPad() : undefined;
    this.miniPrev = newMiniHeld();
    this.miniSuppressed.clear();
    this.touch.miniTaps.length = 0;
    this.boxMouse.reset();
    this.mouseGuard = false;
    // o que já está apertado (toque ou teclado) só vale depois de solto: nada de esquiva/guarda/soco "de graça" na entrada
    if (mode === 'boxing') for (const b of MINI_BUTTONS) if (this.touch.mini[b] || MINI_KEYS[b].some((c) => this.keys.has(c) || this.down.has(c))) this.miniSuppressed.add(b);
    this.suppressHeldActions();
  }

  private keys = new Set<string>();
  /** Teclas fisicamente seguradas (sempre atualizado, mesmo com o jogo desligado ou depois de um reset). */
  private down = new Set<string>();
  // A press/release can fit entirely between two rendered frames, especially after pacing.
  private keyTaps=new Set<string>();
  private touchJumpTaps: number[] = [];
  private touchJumpSerial = 0;
  /** Each finger-down is a distinct jump, even if both taps fit between polls. */
  beginTouchJump() {
    if (!this.enabled) return 0;
    this.suppressed.delete('jump');
    const id = ++this.touchJumpSerial;
    this.touchJumpTaps.push(id);
    return id;
  }
  cancelTouchJump(id: number) {
    const i = this.touchJumpTaps.indexOf(id);
    if (i >= 0) this.touchJumpTaps.splice(i, 1);
  }
  clearTouchJump() {
    this.touchJumpTaps.length = 0;
    this.touch.held.jump = false;
  }
  private prevRaw: Record<ActionName, boolean> = { jump: false, fire: false, grenade: false, special: false, next: false, prev: false, pause: false, reload:false, interact:false };
  /** false nos interiores: o mouse vira só ponteiro (não dispara tiro/granada) */
  mouseActions = true;
  private mouseDown = false;
  private mouseRight = false;
  /** boxe com o mouse: clique = soco da metade da tela, arrastar = gancho/cruzado/abaixar, botão direito segurado = guarda */
  private boxMouse = new BoxGestures();
  private mouseGuard = false;
  private mouseTap=false;
  private mouseRightTap=false;
  private wheelNext = false;
  private wheelPrev = false;
  private mouseX = 0;
  private mouseY = 0;
  private mouseLastMove = -1e9;
  private padIndex = -1;
  private padSeen = false;
  private now = () => performance.now();
  /** Chamado quando um clique/gesto acontece (desbloquear áudio, etc.). */
  onGesture: (() => void) | null = null;
  /** Tecla de menu (Enter/Espaço/Esc) usada pelos overlays DOM — o jogo usa `state`. */
  onMenuKey: ((code: string) => void) | null = null;
  private padMenuHeld = new Set<string>();
  private active = true;
  get enabled() { return this.active; }
  set enabled(v: boolean) {
    // Voltar ao jogo com A/D/setas ainda seguradas: a direção continua valendo sem soltar e apertar de novo.
    if (v && !this.active) this.restoreHeldMovement();
    this.active = v;
  }
  private suppressed = new Set<ActionName>();
  /** Fechar uma apresentação não reaproveita o mesmo botão para atirar/pular. */
  suppressHeldActions() {
    // Só descarta apertos pendentes: A/D/setas seguradas continuam andando (ações presas são
    // contidas pela lista `suppressed` abaixo até o botão ser solto).
    this.keyTaps.clear();
    this.touchJumpTaps.length = 0;
    this.mouseTap = this.mouseRightTap = false;
    for (const action of ACTIONS) {
      if (this.state[action].held || this.touch.held[action]) this.suppressed.add(action);
      this.state[action].held = this.state[action].pressed = this.state[action].released = false;
    }
    const mini = this.state.mini;
    if (mini) for (const b of MINI_BUTTONS) {
      if (mini[b].held || this.touch.mini[b]) this.miniSuppressed.add(b);
      mini[b].held = mini[b].pressed = mini[b].released = false;
      this.miniPrev[b] = false;
    }
    this.touch.miniTaps.length = 0;
  }

  private restoreHeldMovement() {
    for (const code of MOVE_KEYS) if (this.down.has(code)) this.keys.add(code);
  }

  attach(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      this.down.add(e.code);
      if (!this.enabled) {
        // Let native controls handle typing, arrows, Tab and activation once.
        const target = e.target instanceof Element ? e.target : null;
        if (e.code === 'Tab'
          || (e.code !== 'Escape' && target?.closest('input, select, textarea, [contenteditable="true"]'))
          || ((e.code === 'Enter' || e.code === 'Space') && target?.closest('button'))) return;
        this.onMenuKey?.(e.code);
        return;
      }
      if (e.repeat) {
        // A repetição do sistema reata uma tecla que perdemos de vista (blur, apresentação, menu).
        if (MOVE_KEYS.has(e.code)) this.keys.add(e.code);
        if (this.isGameKey(e.code)) e.preventDefault();
        return;
      }
      this.keys.add(e.code);
      this.keyTaps.add(e.code);
      this.state.device = 'kb';
      this.touch.active = false;
      this.onGesture?.();
      this.onMenuKey?.(e.code);
      if (this.isGameKey(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => { this.down.clear(); this.releaseAll(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.down.clear(); this.releaseAll(); }
    });

    target.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        this.mouseLastMove = this.now();
        this.state.device = 'kb';
        if (this.touch.active) this.touch.active = false;
        // arrastar com o botão esquerdo apertado: gancho/cruzado/abaixar no instante em que passa do limite
        if (this._miniMode === 'boxing' && (e.buttons & 1)) {
          const out = this.boxMouse.move(MOUSE_BOX_ID, e.clientX, e.clientY, this.now());
          if (out) this.touch.miniTaps.push(out);
        }
      }
    });
    target.addEventListener('pointerdown', (e) => {
      this.onGesture?.();
      if (e.pointerType !== 'mouse') return;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.mouseLastMove = this.now();
      if (e.button === 0) {this.mouseDown = true;if(this.enabled)this.mouseTap=true;}
      else if (e.button === 2) {this.mouseRight = true;if(this.enabled)this.mouseRightTap=true;}
      if (this._miniMode === 'boxing') {
        if (e.button === 0) {
          const r = target.getBoundingClientRect();
          this.boxMouse.down(MOUSE_BOX_ID, e.clientX < r.left + r.width / 2 ? -1 : 1, e.clientX, e.clientY, this.now());
        } else if (e.button === 2) this.mouseGuard = true;
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (e.button === 0) this.mouseDown = false;
      else if (e.button === 2) this.mouseRight = false;
      if (this._miniMode === 'boxing') {
        if (e.button === 0) { const out = this.boxMouse.up(MOUSE_BOX_ID, this.now()); if (out) this.touch.miniTaps.push(out); }
        else if (e.button === 2) this.mouseGuard = false;
      }
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener(
      'wheel',
      (e) => {
        // Menus share the app root: leave their native scrolling untouched.
        if (!this.enabled || (e.target instanceof Element && e.target.closest('#ui'))) return;
        if (e.deltaY > 0) this.wheelNext = true;
        else if (e.deltaY < 0) this.wheelPrev = true;
        e.preventDefault();
      },
      { passive: false }
    );
    window.addEventListener('gamepadconnected', (e) => {
      this.padIndex = e.gamepad.index;
      this.padSeen = true;
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.padIndex = -1;
    });
  }

  private isGameKey(code: string) {
    return /^(Key[A-Z]|Arrow|Space|Shift|Tab|Escape|Enter|Digit)/.test(code);
  }

  private releaseAll() {
    this.keys.clear();
    this.keyTaps.clear();
    this.clearTouchJump();
    this.mouseTap=this.mouseRightTap=false;
    this.mouseDown = false;
    this.mouseRight = false;
    this.boxMouse.reset();
    this.mouseGuard = false;
  }

  private k(...codes: string[]) {
    for (const c of codes) if (this.keys.has(c)||this.keyTaps.has(c)) return true;
    return false;
  }

  private pad(): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    // só consulta depois que algum controle se conectou (getGamepads pode custar caro a cada quadro)
    if (this.padIndex < 0 && !this.padSeen) return null;
    const pads = navigator.getGamepads();
    let p: Gamepad | null = null;
    if (this.padIndex >= 0) p = pads[this.padIndex] ?? null;
    if (!p) for (const g of pads) if (g && g.connected) p = g;
    return p;
  }

  /** Chamar uma vez por frame de render, ANTES das atualizações da simulação. */
  poll() {
    const s = this.state;
    const raw: Record<ActionName, boolean> = { jump: false, fire: false, grenade: false, special: false, next: false, prev: false, pause: false, reload:false, interact:false };

    // ---- teclado
    let mx = 0;
    let my = 0;
    if (this.k('KeyA', 'ArrowLeft')) mx -= 1;
    if (this.k('KeyD', 'ArrowRight')) mx += 1;
    if (this.k('KeyW', 'ArrowUp')) my -= 1;
    if (this.k('KeyS', 'ArrowDown')) my += 1;
    raw.jump = this.k('Space', 'KeyK', 'KeyZ');
    raw.fire = this.k('KeyJ', 'KeyX') || (this.mouseActions && (this.mouseDown||this.mouseTap));
    raw.grenade = this.k('KeyG', 'KeyL', 'KeyC') || (this.mouseActions && (this.mouseRight||this.mouseRightTap));
    raw.special = this.k('ShiftLeft', 'ShiftRight', 'KeyV', 'KeyI');
    raw.next = this.k('KeyE') || this.wheelNext;
    raw.prev = this.k('KeyQ') || this.wheelPrev;
    raw.pause = this.k('Escape', 'KeyP');
    raw.reload=this.k('KeyR');raw.interact=this.k('KeyF');
    // minijogo de boxe: teclas dos 6 golpes, esquivas, guarda e especial (lidas antes de limpar os toques de tecla)
    const mraw = this._miniMode === 'boxing' ? newMiniHeld() : null;
    if (mraw) {
      for (const b of MINI_BUTTONS) mraw[b] = this.k(...MINI_KEYS[b]);
      if (this.mouseGuard) mraw.guarda = true;
    }
    this.keyTaps.clear();this.mouseTap=this.mouseRightTap=false;
    this.wheelNext = this.wheelPrev = false;

    // ---- gamepad
    let padAim: { x: number; y: number } | null = null;
    const gp = this.pad();
    if (gp) {
      const ax = gp.axes[0] ?? 0;
      const ay = gp.axes[1] ?? 0;
      const dz = 0.22;
      const gx = Math.abs(ax) > dz ? ax : 0;
      const gy = Math.abs(ay) > dz ? ay : 0;
      const b = (i: number) => !!gp.buttons[i]?.pressed;
      const dpadL = b(14);
      const dpadR = b(15);
      const dpadU = b(12);
      const dpadD = b(13);
      const padX = gx + (dpadR ? 1 : 0) - (dpadL ? 1 : 0);
      const padY = gy + (dpadD ? 1 : 0) - (dpadU ? 1 : 0);
      const padJump = b(0);
      const padFire = b(2) || b(7);
      const padNade = b(1) || b(6);
      const padSpecial = b(3);
      const any = Math.abs(padX) > 0 || Math.abs(padY) > 0 || padJump || padFire || padNade || padSpecial || b(9) || b(11) || b(8);
      if (any) {
        this.padSeen = true;
        s.device = 'pad';
        this.touch.active = false;
      }
      mx += padX;
      my += padY;
      raw.jump = raw.jump || padJump;
      raw.fire = raw.fire || padFire;
      raw.grenade = raw.grenade || padNade;
      raw.special = raw.special || padSpecial;
      raw.prev = raw.prev || b(4);
      raw.next = raw.next || b(5);
      raw.pause = raw.pause || b(9);
      raw.reload=raw.reload||b(11);raw.interact=raw.interact||b(8);
      if (mraw) {
        // controle: X jab, Y direto, LB/RB cruzados, LT/RT ganchos, A = ORELHADA; direcional ou analógico esquerdo
        // esquivam (←/→), abaixam (↓) e seguram a guarda (↑)
        mraw.jab = mraw.jab || b(2); mraw.direto = mraw.direto || b(3);
        mraw.cruzE = mraw.cruzE || b(4); mraw.cruzD = mraw.cruzD || b(5);
        mraw.ganchoE = mraw.ganchoE || b(6); mraw.ganchoD = mraw.ganchoD || b(7);
        mraw.esqE = mraw.esqE || dpadL || ax < -0.55; mraw.esqD = mraw.esqD || dpadR || ax > 0.55;
        mraw.abaixar = mraw.abaixar || dpadD || ay > 0.55;
        mraw.guarda = mraw.guarda || dpadU || ay < -0.55 || b(1);
        mraw.especial = mraw.especial || b(0);
      }
      const rx = gp.axes[2] ?? 0;
      const ry = gp.axes[3] ?? 0;
      if (Math.hypot(rx, ry) > 0.45) padAim = { x: rx, y: ry };
    }

    // ---- toque
    const t = this.touch;
    const jumpTap = t.active && this.enabled && !this.suppressed.has('jump')
      ? this.touchJumpTaps.shift() !== undefined : false;
    if (!t.active || !this.enabled) this.touchJumpTaps.length = 0;
    if (t.active) {
      // (movimentação digital por limiar; mira analógica)
      mx += Math.abs(t.stickX) > 0.3 ? Math.sign(t.stickX) : 0;
      my += t.stickY;
      for (const a of ACTIONS) raw[a] = raw[a] || t.held[a];
      raw.jump = raw.jump || jumpTap;
      s.device = 'touch';
      if (mraw) {
        for (const b of MINI_BUTTONS) mraw[b] = mraw[b] || t.mini[b];
        // analógico do boxe: empurrar para o lado esquiva, puxar para baixo abaixa (o eixo dominante decide)
        const ax = Math.abs(t.stickX);
        if (ax > STICK_DODGE && ax >= t.stickY) { if (t.stickX < 0) mraw.esqE = true; else mraw.esqD = true; }
        else if (t.stickY > STICK_DUCK && t.stickY > ax) mraw.abaixar = true;
      }
    }
    // esquivas por gesto: a borda de um quadro (cada gesto vira um aperto, mesmo que caiba entre dois polls)
    const gestures = mraw ? t.miniTaps.splice(0) : (t.miniTaps.length = 0, null);

    s.moveX = Math.max(-1, Math.min(1, mx));
    s.moveY = Math.max(-1, Math.min(1, my));
    // Toque e controle: o analógico ESQUERDO só move (e vira o corpo); quem mira é o analógico direito
    // (arrastar FOGO / stick direito) ou o mouse. Antes, o dedo que escorregava para baixo no joystick
    // apontava a arma para o chão e gastava munição. Teclado mantém W/↑ para mirar para cima.
    if (t.active) {
      s.aimVecX = t.stickX;
      s.aimVecY = 0;
    } else if (s.device === 'pad') {
      s.aimVecX = s.moveX;
      s.aimVecY = 0;
    } else {
      s.aimVecX = s.moveX;
      s.aimVecY = s.moveY;
    }
    if (t.active && Math.hypot(t.aimX, t.aimY) > 0.32 && t.held.fire) padAim = { x: t.aimX, y: t.aimY };
    s.padAim = padAim;
    s.mouseAim = !t.active && this.now() - this.mouseLastMove < 3500 && s.device === 'kb' ? { x: this.mouseX, y: this.mouseY } : null;

    for (const action of this.suppressed) {
      if (!raw[action]) this.suppressed.delete(action);
      else raw[action] = false;
    }
    for (const a of ACTIONS) {
      const b = s[a];
      const prev = this.prevRaw[a];
      b.held = raw[a];
      b.pressed = raw[a] && (!prev || (a === 'jump' && jumpTap));
      b.released = !raw[a] && prev;
      this.prevRaw[a] = raw[a];
    }
    // Track raw pad edges even during play, so Start opening pause cannot close it too.
    const menuKeys = new Set<string>();
    if (gp) {
      const b = (i: number) => !!gp.buttons[i]?.pressed;
      if (b(9) || b(1) || b(8)) menuKeys.add('Escape');
      if (b(0)) menuKeys.add('Enter');
      if (b(12) || (gp.axes[1] ?? 0) < -0.5) menuKeys.add('ArrowUp');
      if (b(13) || (gp.axes[1] ?? 0) > 0.5) menuKeys.add('ArrowDown');
      if (b(14) || (gp.axes[0] ?? 0) < -0.5) menuKeys.add('ArrowLeft');
      if (b(15) || (gp.axes[0] ?? 0) > 0.5) menuKeys.add('ArrowRight');
    }
    const menuOpen = !this.enabled;
    for (const code of menuKeys) if (menuOpen && !this.padMenuHeld.has(code)) {
      this.onMenuKey?.(code);
      this.suppressHeldActions();
      break;
    }
    this.padMenuHeld = menuKeys;
    // ---- minijogo: bordas dos botões (cada um com a sua supressão)
    const mini = s.mini;
    if (mini && mraw) {
      for (const b of this.miniSuppressed) {
        if (!mraw[b]) this.miniSuppressed.delete(b);
        else mraw[b] = false;
      }
      for (const b of MINI_BUTTONS) {
        const tap = !!gestures && gestures.includes(b);
        const now = mraw[b] || tap;
        mini[b].held = now;
        mini[b].pressed = now && (!this.miniPrev[b] || tap);
        mini[b].released = !now && this.miniPrev[b];
        this.miniPrev[b] = now;
      }
    }
  }

  /** Limpa bordas após o primeiro substep de simulação do frame. */
  clearEdges() {
    for (const a of ACTIONS) {
      this.state[a].pressed = false;
      this.state[a].released = false;
    }
    const mini = this.state.mini;
    if (mini) for (const b of MINI_BUTTONS) { mini[b].pressed = false; mini[b].released = false; }
  }

  /** Vibração curta: celular (navigator.vibrate) e gamepad (rumble). */
  haptic(strength: number, ms: number) {
    if (!hapticsOn()) return;
    try {
      if (this.state.device === 'touch' && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(Math.round(ms));
      if (this.state.device === 'pad') {
        const gp = this.pad() as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } }) | null;
        void gp?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: Math.min(1, strength), weakMagnitude: Math.min(1, strength * 0.7) });
      }
    } catch {
      /* sem suporte */
    }
  }

  isKeyDown(code: string) {
    return this.keys.has(code);
  }
}
