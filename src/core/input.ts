import { settings } from './storage';
const hapticsOn = () => settings.haptics !== false;
/**
 * Entrada unificada: teclado + mouse + gamepad + toque.
 * O jogo lê apenas `input.state` (analógico + botões com borda pressionar/soltar).
 */

export type ActionName = 'jump' | 'fire' | 'grenade' | 'special' | 'next' | 'prev' | 'pause';
const ACTIONS: ActionName[] = ['jump', 'fire', 'grenade', 'special', 'next', 'prev', 'pause'];

export interface Btn {
  held: boolean;
  pressed: boolean;
  released: boolean;
}

export interface TouchState {
  active: boolean; // controles de toque visíveis/em uso
  stickX: number;
  stickY: number;
  /** analógico de tiro (botão FOGO arrastável): vetor de mira, 0,0 quando parado */
  aimX: number;
  aimY: number;
  held: Record<ActionName, boolean>;
}

export const newTouchState = (): TouchState => ({
  active: false,
  stickX: 0,
  stickY: 0,
  aimX: 0,
  aimY: 0,
  held: { jump: false, fire: false, grenade: false, special: false, next: false, prev: false, pause: false },
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
  device: 'kb' | 'touch' | 'pad';
}

const newBtn = (): Btn => ({ held: false, pressed: false, released: false });

export class Input {
  readonly state: ControlState = {
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
    device: 'kb',
  };
  readonly touch: TouchState = newTouchState();

  private keys = new Set<string>();
  private prevRaw: Record<ActionName, boolean> = { jump: false, fire: false, grenade: false, special: false, next: false, prev: false, pause: false };
  private mouseDown = false;
  private mouseRight = false;
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
  enabled = true;

  attach(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) {
        this.onMenuKey?.(e.code);
        return;
      }
      if (e.repeat) {
        if (this.isGameKey(e.code)) e.preventDefault();
        return;
      }
      this.keys.add(e.code);
      this.state.device = 'kb';
      this.touch.active = false;
      this.onGesture?.();
      this.onMenuKey?.(e.code);
      if (this.isGameKey(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });

    target.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        this.mouseLastMove = this.now();
        this.state.device = 'kb';
        if (this.touch.active) this.touch.active = false;
      }
    });
    target.addEventListener('pointerdown', (e) => {
      this.onGesture?.();
      if (e.pointerType !== 'mouse') return;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.mouseLastMove = this.now();
      if (e.button === 0) this.mouseDown = true;
      else if (e.button === 2) this.mouseRight = true;
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (e.button === 0) this.mouseDown = false;
      else if (e.button === 2) this.mouseRight = false;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener(
      'wheel',
      (e) => {
        if (e.deltaY > 0) this.wheelNext = true;
        else if (e.deltaY < 0) this.wheelPrev = true;
        e.preventDefault();
      },
      { passive: false }
    );
    window.addEventListener('gamepadconnected', (e) => {
      this.padIndex = e.gamepad.index;
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
    this.mouseDown = false;
    this.mouseRight = false;
  }

  private k(...codes: string[]) {
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  private pad(): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    let p: Gamepad | null = null;
    if (this.padIndex >= 0) p = pads[this.padIndex] ?? null;
    if (!p) for (const g of pads) if (g && g.connected) p = g;
    return p;
  }

  /** Chamar uma vez por frame de render, ANTES das atualizações da simulação. */
  poll() {
    const s = this.state;
    const raw: Record<ActionName, boolean> = { jump: false, fire: false, grenade: false, special: false, next: false, prev: false, pause: false };

    // ---- teclado
    let mx = 0;
    let my = 0;
    if (this.k('KeyA', 'ArrowLeft')) mx -= 1;
    if (this.k('KeyD', 'ArrowRight')) mx += 1;
    if (this.k('KeyW', 'ArrowUp')) my -= 1;
    if (this.k('KeyS', 'ArrowDown')) my += 1;
    raw.jump = this.k('Space', 'KeyK', 'KeyZ');
    raw.fire = this.k('KeyJ', 'KeyX') || this.mouseDown;
    raw.grenade = this.k('KeyG', 'KeyL', 'KeyC') || this.mouseRight;
    raw.special = this.k('ShiftLeft', 'ShiftRight', 'KeyV', 'KeyI');
    raw.next = this.k('KeyE') || this.wheelNext;
    raw.prev = this.k('KeyQ') || this.wheelPrev;
    raw.pause = this.k('Escape', 'KeyP');
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
      const any = Math.abs(padX) > 0 || Math.abs(padY) > 0 || padJump || padFire || padNade || padSpecial;
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
      const rx = gp.axes[2] ?? 0;
      const ry = gp.axes[3] ?? 0;
      if (Math.hypot(rx, ry) > 0.45) padAim = { x: rx, y: ry };
    }

    // ---- toque
    const t = this.touch;
    if (t.active) {
      // (movimentação digital por limiar; mira analógica)
      mx += Math.abs(t.stickX) > 0.3 ? Math.sign(t.stickX) : 0;
      my += t.stickY;
      for (const a of ACTIONS) raw[a] = raw[a] || t.held[a];
      s.device = 'touch';
    }

    s.moveX = Math.max(-1, Math.min(1, mx));
    s.moveY = Math.max(-1, Math.min(1, my));
    // vetor de mira do stick (toque usa analógico bruto p/ mira suave em 8 direções)
    if (t.active) {
      s.aimVecX = t.stickX;
      s.aimVecY = t.stickY;
    } else {
      s.aimVecX = s.moveX;
      s.aimVecY = s.moveY;
    }
    if (t.active && Math.hypot(t.aimX, t.aimY) > 0.32 && t.held.fire) padAim = { x: t.aimX, y: t.aimY };
    s.padAim = padAim;
    s.mouseAim = !t.active && this.now() - this.mouseLastMove < 3500 && s.device === 'kb' ? { x: this.mouseX, y: this.mouseY } : null;

    for (const a of ACTIONS) {
      const b = s[a];
      const prev = this.prevRaw[a];
      b.held = raw[a];
      b.pressed = raw[a] && !prev;
      b.released = !raw[a] && prev;
      this.prevRaw[a] = raw[a];
    }
  }

  /** Limpa bordas após o primeiro substep de simulação do frame. */
  clearEdges() {
    for (const a of ACTIONS) {
      this.state[a].pressed = false;
      this.state[a].released = false;
    }
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
