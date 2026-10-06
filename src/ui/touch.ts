/**
 * Controles de toque: joystick virtual flutuante (esquerda) + botões (direita).
 * Multitouch real: cada controle usa seu próprio pointerId (com captura), então um dedo
 * nunca cancela o outro.
 */
import type { Input, ActionName, MiniButton, MiniMode } from '../core/input';
import { MINI_BUTTONS } from '../core/input';
import { settings } from '../core/storage';
import { toLocal, localRect } from '../core/orient';
import { BoxGestures, type GestureOut } from './boxGestures';

const ICONS: Record<string, string> = {
  fire: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="9" fill="none" stroke="currentColor" stroke-width="3.4"/><path d="M24 4v10M24 34v10M4 24h10M34 24h10" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/><circle cx="24" cy="24" r="2.6" fill="currentColor"/></svg>',
  jump: '<svg viewBox="0 0 48 48"><path d="M10 30l14-14 14 14" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 40h24" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".55"/></svg>',
  grenade: '<svg viewBox="0 0 48 48"><circle cx="22" cy="29" r="12" fill="currentColor" opacity=".9"/><rect x="18" y="10" width="8" height="7" rx="2" fill="currentColor"/><path d="M27 12l9-4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M14 26h16" stroke="#0d0724" stroke-width="2.2" opacity=".55"/></svg>',
  special: '<svg viewBox="0 0 48 48"><path d="M27 4L11 27h11l-3 17 18-25H26z" fill="currentColor"/></svg>',
  switch: '<svg viewBox="0 0 48 48"><path d="M10 18h22l-6-6M38 30H16l6 6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pause: '<svg viewBox="0 0 48 48"><rect x="12" y="10" width="8" height="28" rx="2.5" fill="currentColor"/><rect x="28" y="10" width="8" height="28" rx="2.5" fill="currentColor"/></svg>',
  // boxe: trajetórias dos golpes e das defesas
  jab: '<svg viewBox="0 0 48 48"><path d="M12 36L34 14M34 14H21M34 14v13" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  hook: '<svg viewBox="0 0 48 48"><path d="M9 36C8 16 30 8 38 24M38 24l-12-1M38 24l-1 12" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  upper: '<svg viewBox="0 0 48 48"><path d="M16 40C14 26 34 26 32 10M32 10l-8 9M32 10l8 8" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dodgeL: '<svg viewBox="0 0 48 48"><path d="M26 11L13 24l13 13M40 11L27 24l13 13" fill="none" stroke="currentColor" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dodgeR: '<svg viewBox="0 0 48 48"><path d="M22 11l13 13-13 13M8 11l13 13L8 37" fill="none" stroke="currentColor" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  duck: '<svg viewBox="0 0 48 48"><path d="M11 15l13 14 13-14M11 28l13 14 13-14" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  guard: '<svg viewBox="0 0 48 48"><path d="M24 7l15 6v13c0 9-7 15-15 18-8-3-15-9-15-18V13z" fill="currentColor" opacity=".9"/><path d="M24 14v22" stroke="#0d0724" stroke-width="2.4" opacity=".5"/></svg>',
};
const GESTURE_LABEL: Record<GestureOut, string> = { jab: 'JAB', direto: 'DIRETO', cruzE: 'CRUZADO', cruzD: 'CRUZADO', ganchoE: 'GANCHO', ganchoD: 'GANCHO', abaixar: 'ABAIXAR' };

export class TouchUI {
  root: HTMLElement;
  private stickZone: HTMLElement;
  private base: HTMLElement;
  private knob: HTMLElement;
  private ghost: HTMLElement;
  private buttons = new Map<ActionName, HTMLElement>();
  private releaseTimers = new Map<string, number>();
  /** gestos do boxe (metade esquerda = mão esquerda, metade direita = mão direita) */
  private gestures = new BoxGestures();
  private guardTimer = 0;
  private fxPool: HTMLElement[] = [];
  private fxNext = 0;
  private stickId = -1;
  private ox = 0;
  private oy = 0;
  private radius = 58;
  enabled = false;

  constructor(parent: HTMLElement, private input: Input) {
    this.root = document.createElement('div');
    this.root.id = 'touch';
    this.root.className = 'touch hidden';
    this.root.innerHTML = `
      <div class="stick-zone"><div class="stick-ghost"></div><div class="stick-base"><div class="stick-knob"></div></div></div>
      <button class="tbtn t-jump" data-act="jump" aria-label="Pular">${ICONS.jump}<span>PULO</span></button>
      <button class="tbtn t-fire" data-act="fire" aria-label="Atirar e mirar">${ICONS.fire}<span>FOGO</span><i class="fire-knob"></i></button>
      <button class="tbtn t-nade" data-act="grenade" aria-label="Granada">${ICONS.grenade}<b class="badge nade-n">4</b></button>
      <button class="tbtn t-special" data-act="special" aria-label="Especial">${ICONS.special}<i class="cd-ring"></i></button>
      <button class="tbtn t-swap" data-act="next" aria-label="Trocar arma"><img class="wicon" alt="" /><b class="badge ammo-n">∞</b></button>
      <button class="tbtn t-pause" data-act="pause" aria-label="Pausar">${ICONS.pause}</button>
      <button class="tbtn t-reload" data-act="reload" aria-label="Recarregar arma">↻</button>
      <button class="tbtn t-merchant hidden" data-act="interact" aria-label="Conversar com o mercador">OFICINA</button>
      <button class="tbtn ibtn t-iact" data-act="interact" aria-label="Mexer no objeto destacado">AGIR</button>
      <button class="tbtn ibtn t-isneak" data-act="special" aria-label="Andar na ponta dos pés (segurar)">PONTA</button>
      <button class="tbtn ibtn t-ileave" data-act="grenade" aria-label="Sair pela porta">SAIR</button>
      <button class="tbtn ibtn t-ilist" data-act="reload" aria-label="Lista de travessuras">LISTA</button>
      <div class="mhz mhz-l" aria-hidden="true"></div>
      <div class="mhz mhz-r" aria-hidden="true"></div>
      <button class="tbtn mbtn m-dl" data-m="esqE" aria-label="Esquivar para a esquerda">${ICONS.dodgeL}</button>
      <button class="tbtn mbtn m-dr" data-m="esqD" aria-label="Esquivar para a direita">${ICONS.dodgeR}</button>
      <button class="tbtn mbtn mbtns m-du" data-m="abaixar" aria-label="Abaixar">${ICONS.duck}</button>
      <button class="tbtn mbtn mbtns m-gu" data-m="guarda" aria-label="Guarda (segurar)">${ICONS.guard}</button>
      <button class="tbtn mbtn mbtns m-l1" data-m="jab" aria-label="Jab esquerdo">${ICONS.jab}<span>JAB</span></button>
      <button class="tbtn mbtn mbtns m-l2" data-m="cruzE" aria-label="Cruzado esquerdo">${ICONS.hook}<span>CRUZ.</span></button>
      <button class="tbtn mbtn mbtns m-l3" data-m="ganchoE" aria-label="Gancho esquerdo">${ICONS.upper}<span>GANCHO</span></button>
      <button class="tbtn mbtn mbtns m-r1" data-m="direto" aria-label="Direto direito">${ICONS.jab}<span>DIRETO</span></button>
      <button class="tbtn mbtn mbtns m-r2" data-m="cruzD" aria-label="Cruzado direito">${ICONS.hook}<span>CRUZ.</span></button>
      <button class="tbtn mbtn mbtns m-r3" data-m="ganchoD" aria-label="Gancho direito">${ICONS.upper}<span>GANCHO</span></button>
      <button class="tbtn mbtn m-sp hidden" data-m="especial" aria-label="Orelhada">ORELHADA!</button>
    `;
    parent.appendChild(this.root);
    this.stickZone = this.root.querySelector('.stick-zone') as HTMLElement;
    this.base = this.root.querySelector('.stick-base') as HTMLElement;
    this.knob = this.root.querySelector('.stick-knob') as HTMLElement;
    this.ghost = this.root.querySelector('.stick-ghost') as HTMLElement;
    this.root.querySelectorAll<HTMLElement>('.tbtn').forEach((el) => {
      if (el.classList.contains('mbtn')) { this.bindMini(el, el.dataset.m as MiniButton); return; }
      if (el.classList.contains('ibtn')) { this.bindButton(el, el.dataset.act as ActionName); return; }
      this.buttons.set(el.dataset.act as ActionName, el);
      if (el.dataset.act === 'fire') this.bindFireStick(el);
      else this.bindButton(el, el.dataset.act as ActionName);
    });
    this.bindStick();
    this.root.querySelectorAll<HTMLElement>('.mhz').forEach((z) => this.bindHandZone(z, z.classList.contains('mhz-l') ? -1 : 1));
    // bloqueia gestos/menus nativos
    for (const ev of ['touchstart', 'touchmove', 'touchend', 'gesturestart', 'gesturechange', 'contextmenu', 'selectstart']) {
      this.root.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
    }
    this.applySettings();
  }

  applySettings() {
    const s = document.documentElement.style;
    s.setProperty('--ts', String(settings.touchScale));
    s.setProperty('--to', String(settings.touchOpacity));
    this.root.classList.toggle('lefty', settings.leftHanded);
    this.root.classList.toggle('box-botoes', settings.boxControls === 'botoes');
    this.radius = 58 * settings.touchScale;
  }

  show(v: boolean) {
    this.enabled = v;
    this.root.classList.toggle('hidden', !v);
    if (!v) this.releaseAll();
  }

  /** Toque curto na zona do joystick dentro do interior: vira toque no cômodo (objeto/chão). */
  onInteriorTap: ((clientX: number, clientY: number) => void) | null = null;

  /** Interior isométrico: o joystick continua andando; tiro e pulo dão lugar a AGIR, PONTA, SAIR e LISTA. */
  setInterior(on: boolean) {
    this.root.classList.toggle('interior', on);
    this.releaseAll();
  }

  /**
   * Minijogo: 'chase' mostra joystick + PULO (esconde FOGO, granada, recarga, troca e AGIR); 'boxing' esconde
   * joystick e botões normais e mostra 3 botões de cada lado + a zona de gestos (esquiva/guarda).
   * `null` restaura o layout anterior. Soltar tudo antes de trocar: nenhum dedo "herda" o botão novo.
   */
  setMinigame(mode: MiniMode | null) {
    this.root.classList.toggle('mini-boxing', mode === 'boxing');
    this.root.classList.toggle('mini-chase', mode === 'chase');
    this.root.classList.toggle('box-botoes', settings.boxControls === 'botoes');
    this.root.querySelector('.m-sp')?.classList.add('hidden');
    this.releaseAll();
  }

  /** O botão ORELHADA! só aparece quando o jacaré está grogue. */
  showSpecial(on: boolean) {
    const b = this.root.querySelector<HTMLElement>('.m-sp');
    if (!b) return;
    b.classList.toggle('hidden', !on);
    if (!on) { this.clearRelease('mini:especial'); this.input.touch.mini.especial = false; b.classList.remove('down'); delete b.dataset.pid; }
  }

  /** O botão ESPECIAL só aparece quando o Nômad é pilotado. */
  setMounted(m: boolean) {
    this.root.classList.toggle('mounted', m);
  }

  private markActive() {
    this.input.touch.active = true;
    this.input.state.device = 'touch';
  }

  private clearRelease(act: string) {
    const timer = this.releaseTimers.get(act);
    if (timer !== undefined) window.clearTimeout(timer);
    this.releaseTimers.delete(act);
  }

  /** Botão do boxe: cada dedo é dono do seu botão; soltar um nunca solta o outro. */
  private bindMini(el: HTMLElement, btn: MiniButton) {
    const t = this.input.touch;
    const key = 'mini:' + btn;
    const down = (e: PointerEvent) => {
      if (el.dataset.pid !== undefined) return;
      this.clearRelease(key);
      e.preventDefault();
      this.input.haptic(0.25, 10);
      try { el.setPointerCapture(e.pointerId); } catch { /* ok */ }
      this.markActive();
      this.input.onGesture?.();
      t.mini[btn] = true;
      el.classList.add('down');
      el.dataset.pid = String(e.pointerId);
    };
    const up = (e: PointerEvent) => {
      if (el.dataset.pid !== String(e.pointerId)) return;
      e.preventDefault();
      this.clearRelease(key);
      delete el.dataset.pid;
      el.classList.remove('down');
      if (e.type !== 'pointerup') { t.mini[btn] = false; return; }
      // um toque que cabe entre dois quadros ainda vale um golpe: pequena tolerância (só em toque concluído)
      this.releaseTimers.set(key, window.setTimeout(() => {
        this.releaseTimers.delete(key);
        if (el.dataset.pid === undefined) t.mini[btn] = false;
      }, 45));
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  /** Cada metade da tela é uma mão. Toque = reto, deslizar = cruzado/gancho/abaixar, dois polegares parados = guarda. */
  private bindHandZone(el: HTMLElement, side: -1 | 1) {
    const t = this.input.touch;
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const guardTick = () => {
      const on = this.gestures.updateGuard(now());
      if (t.mini.guarda !== on) { t.mini.guarda = on; this.root.classList.toggle('boxguard', on); if (on) this.input.haptic(0.2, 10); }
      if (!this.gestures.active) { window.clearInterval(this.guardTimer); this.guardTimer = 0; }
    };
    const fire = (out: GestureOut | null, x: number, y: number) => {
      if (!out) return;
      t.miniTaps.push(out);
      this.input.haptic(out === 'ganchoE' || out === 'ganchoD' ? 0.4 : 0.25, out === 'jab' || out === 'direto' ? 8 : 14);
      this.gestureFx(out, x, y);
    };
    const end = (e: PointerEvent) => {
      const pt = toLocal(e.clientX, e.clientY);
      let out: GestureOut | null = null;
      if (e.type === 'pointerup') out = this.gestures.up(e.pointerId, now());
      else this.gestures.cancel(e.pointerId);
      fire(out, pt.x, pt.y);
      if (t.mini.guarda && !this.gestures.guarding) { t.mini.guarda = false; this.root.classList.remove('boxguard'); }
      if (!this.gestures.active) el.classList.remove('down');
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { /* ok */ }
      this.markActive();
      this.input.onGesture?.();
      const pt = toLocal(e.clientX, e.clientY);
      this.gestures.down(e.pointerId, side, pt.x, pt.y, now());
      el.classList.add('down');
      if (!this.guardTimer) this.guardTimer = window.setInterval(guardTick, 30);
    });
    el.addEventListener('pointermove', (e) => {
      e.preventDefault();
      const pt = toLocal(e.clientX, e.clientY);
      fire(this.gestures.move(e.pointerId, pt.x, pt.y, now()), pt.x, pt.y);
    });
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  }

  /** Rótulo do golpe que o gesto acabou de dar (ensina jogando): uma pequena reserva de elementos reaproveitados. */
  private gestureFx(out: GestureOut, x: number, y: number) {
    if (this.fxPool.length < 4) {
      const d = document.createElement('div');
      d.className = 'mfx';
      d.setAttribute('aria-hidden', 'true');
      this.root.appendChild(d);
      this.fxPool.push(d);
    }
    const d = this.fxPool[this.fxNext++ % this.fxPool.length];
    const r = localRect(this.root);
    d.textContent = GESTURE_LABEL[out];
    d.style.left = `${x - r.left}px`;
    d.style.top = `${y - r.top - 26}px`;
    d.classList.remove('go');
    void d.offsetWidth;
    d.classList.add('go');
  }

  private finishPress(el: HTMLElement, act: ActionName, e: PointerEvent) {
    e.preventDefault();
    this.clearRelease(act);
    delete el.dataset.pid;
    el.classList.remove('down');
    if (e.type !== 'pointerup') {
      this.input.touch.held[act] = false;
      return;
    }
    // Keep short-tap height; Input queues distinct jump edges independently of this grace.
    // Only a completed tap gets the short grace period, never a cancelled gesture.
    this.releaseTimers.set(act, window.setTimeout(() => {
      this.releaseTimers.delete(act);
      if (el.dataset.pid === undefined) this.input.touch.held[act] = false;
    }, 45));
  }

  private bindButton(el: HTMLElement, act: ActionName) {
    const t = this.input.touch;
    let jumpPress = 0;
    const down = (e: PointerEvent) => {
      if (el.dataset.pid !== undefined) return;
      this.clearRelease(act);
      e.preventDefault();
      this.input.haptic(0.2, 8);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ok */
      }
      this.markActive();
      this.input.onGesture?.();
      if (act === 'jump') jumpPress = this.input.beginTouchJump();
      t.held[act] = true;
      el.classList.add('down');
      el.dataset.pid = String(e.pointerId);
    };
    const up = (e: PointerEvent) => {
      if (el.dataset.pid !== String(e.pointerId)) return;
      if (act === 'jump' && e.type !== 'pointerup') this.input.cancelTouchJump(jumpPress);
      this.finishPress(el, act, e);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  /** FOGO = analógico de tiro: segurar atira; arrastar mira em 360° (o vetor sai do centro do botão). */
  private bindFireStick(el: HTMLElement) {
    const t = this.input.touch;
    const knob = el.querySelector('.fire-knob') as HTMLElement;
    const setAim = (e: PointerEvent) => {
      const r = localRect(el);
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const R = r.width * 0.5;
      const pt = toLocal(e.clientX, e.clientY);
      const dx = pt.x - cx;
      const dy = pt.y - cy;
      const d = Math.hypot(dx, dy);
      const m = Math.min(1, d / (R * 1.1));
      const a = Math.atan2(dy, dx);
      // zona morta central: toque simples atira para onde o Karimbo olha
      t.aimX = m < 0.3 ? 0 : Math.cos(a) * m;
      t.aimY = m < 0.3 ? 0 : Math.sin(a) * m;
      const k = Math.min(d, R * 0.95);
      knob.style.transform = `translate(calc(-50% + ${Math.cos(a) * k}px), calc(-50% + ${Math.sin(a) * k}px))`;
      knob.classList.toggle('aiming', m >= 0.3);
    };
    const down = (e: PointerEvent) => {
      if (el.dataset.pid !== undefined) return;
      this.clearRelease('fire');
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ok */
      }
      el.dataset.pid = String(e.pointerId);
      this.input.haptic(0.2, 8);
      this.markActive();
      this.input.onGesture?.();
      t.held.fire = true;
      el.classList.add('down');
      setAim(e);
    };
    const move = (e: PointerEvent) => {
      if (el.dataset.pid !== String(e.pointerId)) return;
      e.preventDefault();
      setAim(e);
    };
    const up = (e: PointerEvent) => {
      if (el.dataset.pid !== String(e.pointerId)) return;
      this.finishPress(el, 'fire', e);
      t.aimX = t.aimY = 0;
      knob.style.transform = 'translate(-50%,-50%)';
      knob.classList.remove('aiming');
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  private bindStick() {
    const z = this.stickZone;
    // toque curto e parado (no interior) não é joystick: é um toque no cômodo por baixo da zona
    let downAt = 0, downX = 0, downY = 0, travel = 0;
    z.addEventListener('pointerdown', (e) => {
      if (this.stickId !== -1) return;
      e.preventDefault();
      downAt = performance.now(); downX = e.clientX; downY = e.clientY; travel = 0;
      this.markActive();
      this.input.onGesture?.();
      try {
        z.setPointerCapture(e.pointerId);
      } catch {
        /* ok */
      }
      this.stickId = e.pointerId;
      const r = localRect(z);
      const pt = toLocal(e.clientX, e.clientY);
      // origem flutuante (limitada à zona, para o polegar não ficar em cima da borda)
      const m = this.radius + 10;
      this.ox = Math.min(Math.max(pt.x, r.left + m), r.right - m);
      this.oy = Math.min(Math.max(pt.y, r.top + m), r.bottom - m);
      this.base.style.left = `${this.ox - r.left}px`;
      this.base.style.top = `${this.oy - r.top}px`;
      this.base.classList.add('on');
      this.ghost.classList.add('off');
      const p0 = toLocal(e.clientX, e.clientY);
      this.move(p0.x, p0.y);
    });
    z.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickId) return;
      e.preventDefault();
      travel = Math.max(travel, Math.hypot(e.clientX - downX, e.clientY - downY));
      const p1 = toLocal(e.clientX, e.clientY);
      this.move(p1.x, p1.y);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = -1;
      if (e.type === 'pointerup' && travel < 14 && performance.now() - downAt < 350 && this.root.classList.contains('interior')) this.onInteriorTap?.(e.clientX, e.clientY);
      this.input.touch.stickX = 0;
      this.input.touch.stickY = 0;
      this.base.classList.remove('on');
      this.ghost.classList.remove('off');
      this.knob.style.transform = 'translate(-50%,-50%)';
    };
    z.addEventListener('pointerup', end);
    z.addEventListener('pointercancel', end);
    z.addEventListener('lostpointercapture', end);
  }

  private move(cx: number, cy: number) {
    let dx = cx - this.ox;
    let dy = cy - this.oy;
    const d = Math.hypot(dx, dy);
    const R = this.radius;
    if (d > R) {
      // joystick "segue" o dedo quando ele passa do raio (arrasta a base)
      const k = (d - R) / d;
      this.ox += dx * k;
      this.oy += dy * k;
      dx = cx - this.ox;
      dy = cy - this.oy;
      const r = localRect(this.stickZone);
      this.base.style.left = `${this.ox - r.left}px`;
      this.base.style.top = `${this.oy - r.top}px`;
    }
    const m = Math.min(1, Math.hypot(dx, dy) / R);
    const a = Math.atan2(dy, dx);
    const dead = 0.16;
    const mag = m < dead ? 0 : (m - dead) / (1 - dead);
    this.input.touch.stickX = Math.cos(a) * mag;
    this.input.touch.stickY = Math.sin(a) * mag;
    this.knob.style.transform = `translate(calc(-50% + ${Math.cos(a) * m * R}px), calc(-50% + ${Math.sin(a) * m * R}px))`;
  }

  private lastSync = '';
  private lastWeaponIcon = '';
  /** Atualiza os botões com o estado do jogo (ícone/munição da arma, granadas, recarga do avanço). */
  sync(s: { weaponIcon: string; ammo: string; lowAmmo: boolean; grenades: number; dash01: number; merchant?:boolean;interaction?:string;canReload?:boolean;reloading?:boolean;reload01?:number }) {
    const reloadStep=Math.round(Math.max(0,Math.min(1,s.reload01??0))*20);
    const key = `${s.weaponIcon.length}|${s.ammo}|${s.lowAmmo}|${s.grenades}|${Math.round(s.dash01 * 20)}|${s.merchant}|${s.interaction}|${s.canReload}|${s.reloading}|${reloadStep}`;
    const iconChanged = s.weaponIcon !== this.lastWeaponIcon;
    if (key === this.lastSync && !iconChanged) return;
    this.lastSync = key;
    this.lastWeaponIcon = s.weaponIcon;
    const reload=this.buttons.get('reload') as HTMLButtonElement|undefined;
    if(reload){
      reload.disabled=s.canReload===false||!!s.reloading;
      reload.classList.toggle('reloading',!!s.reloading);
      reload.style.setProperty('--reload',String(reloadStep/20));
      reload.setAttribute('aria-label',s.reloading?`Recarregando • ${reloadStep*5}%`:reload.disabled?'Recarregar arma • indisponível':'Recarregar arma');
      if(reload.disabled){this.clearRelease('reload');this.input.touch.held.reload=false;reload.classList.remove('down');delete reload.dataset.pid;}
    }
    const interact=this.buttons.get('interact');
    if(interact){
      const visible=!!s.merchant||!!s.interaction;
      interact.classList.toggle('hidden',!visible);
      interact.textContent=s.interaction??'OFICINA';
      interact.setAttribute('aria-label',s.interaction??'Conversar com o mercador');
      if(!visible){this.clearRelease('interact');this.input.touch.held.interact=false;interact.classList.remove('down');delete interact.dataset.pid;}
    }
    const swap = this.buttons.get('next');
    if (swap) {
      const img = swap.querySelector('.wicon') as HTMLImageElement;
      if (iconChanged) {
        img.src = s.weaponIcon;
      }
      const b = swap.querySelector('.ammo-n') as HTMLElement;
      b.textContent = s.ammo;
      b.classList.toggle('low', s.lowAmmo);
    }
    const nade = this.buttons.get('grenade');
    if (nade) {
      (nade.querySelector('.nade-n') as HTMLElement).textContent = String(s.grenades);
      nade.classList.toggle('empty', s.grenades <= 0);
    }
    const sp = this.buttons.get('special');
    if (sp) {
      sp.style.setProperty('--cd', String(s.dash01));
      sp.classList.toggle('ready', s.dash01 >= 1);
    }
  }

  releaseAll() {
    const t = this.input.touch;
    this.input.clearTouchJump();
    for (const k of Object.keys(t.held) as ActionName[]) {this.clearRelease(k);t.held[k] = false;}
    for (const b of MINI_BUTTONS) { this.clearRelease('mini:' + b); t.mini[b] = false; }
    t.miniTaps.length = 0;
    this.gestures?.reset(); // (ausente em controles montados só para teste)
    if (this.guardTimer) { window.clearInterval(this.guardTimer); this.guardTimer = 0; }
    this.root.classList?.remove('boxguard');
    this.root.querySelectorAll?.('.mhz')?.forEach((z) => z.classList.remove('down'));
    t.stickX = t.stickY = 0;
    t.aimX = t.aimY = 0;
    this.stickId = -1;
    this.base.classList.remove('on');
    this.ghost.classList.remove('off');
    this.root.querySelectorAll<HTMLElement>('.tbtn').forEach((b) => {b.classList.remove('down');delete b.dataset.pid;});
  }
}
