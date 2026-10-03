/**
 * Controles de toque: joystick virtual flutuante (esquerda) + botões (direita).
 * Multitouch real: cada controle usa seu próprio pointerId (com captura), então um dedo
 * nunca cancela o outro.
 */
import type { Input, ActionName } from '../core/input';
import { settings } from '../core/storage';
import { toLocal, localRect } from '../core/orient';

const ICONS: Record<string, string> = {
  fire: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="9" fill="none" stroke="currentColor" stroke-width="3.4"/><path d="M24 4v10M24 34v10M4 24h10M34 24h10" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/><circle cx="24" cy="24" r="2.6" fill="currentColor"/></svg>',
  jump: '<svg viewBox="0 0 48 48"><path d="M10 30l14-14 14 14" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 40h24" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".55"/></svg>',
  grenade: '<svg viewBox="0 0 48 48"><circle cx="22" cy="29" r="12" fill="currentColor" opacity=".9"/><rect x="18" y="10" width="8" height="7" rx="2" fill="currentColor"/><path d="M27 12l9-4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M14 26h16" stroke="#0d0724" stroke-width="2.2" opacity=".55"/></svg>',
  special: '<svg viewBox="0 0 48 48"><path d="M27 4L11 27h11l-3 17 18-25H26z" fill="currentColor"/></svg>',
  switch: '<svg viewBox="0 0 48 48"><path d="M10 18h22l-6-6M38 30H16l6 6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pause: '<svg viewBox="0 0 48 48"><rect x="12" y="10" width="8" height="28" rx="2.5" fill="currentColor"/><rect x="28" y="10" width="8" height="28" rx="2.5" fill="currentColor"/></svg>',
};

export class TouchUI {
  root: HTMLElement;
  private stickZone: HTMLElement;
  private base: HTMLElement;
  private knob: HTMLElement;
  private ghost: HTMLElement;
  private buttons = new Map<ActionName, HTMLElement>();
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
    `;
    parent.appendChild(this.root);
    this.stickZone = this.root.querySelector('.stick-zone') as HTMLElement;
    this.base = this.root.querySelector('.stick-base') as HTMLElement;
    this.knob = this.root.querySelector('.stick-knob') as HTMLElement;
    this.ghost = this.root.querySelector('.stick-ghost') as HTMLElement;
    this.root.querySelectorAll<HTMLElement>('.tbtn').forEach((el) => {
      this.buttons.set(el.dataset.act as ActionName, el);
      if (el.dataset.act === 'fire') this.bindFireStick(el);
      else this.bindButton(el, el.dataset.act as ActionName);
    });
    this.bindStick();
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
    this.radius = 58 * settings.touchScale;
  }

  show(v: boolean) {
    this.enabled = v;
    this.root.classList.toggle('hidden', !v);
    if (!v) this.releaseAll();
  }

  /** O botão ESPECIAL só aparece quando o Nômad é pilotado. */
  setMounted(m: boolean) {
    this.root.classList.toggle('mounted', m);
  }

  private markActive() {
    this.input.touch.active = true;
    this.input.state.device = 'touch';
  }

  private bindButton(el: HTMLElement, act: ActionName) {
    const t = this.input.touch;
    const down = (e: PointerEvent) => {
      e.preventDefault();
      this.input.haptic(0.2, 8);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ok */
      }
      this.markActive();
      this.input.onGesture?.();
      t.held[act] = true;
      el.classList.add('down');
      el.dataset.pid = String(e.pointerId);
    };
    const up = (e: PointerEvent) => {
      if (el.dataset.pid !== String(e.pointerId)) return;
      e.preventDefault();
      delete el.dataset.pid;
      el.classList.remove('down');
      // garante ≥ 1 frame pressionado (toques muito rápidos)
      window.setTimeout(() => {
        if (!el.classList.contains('down')) t.held[act] = false;
      }, 45);
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
    let pid = -1;
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
      if (pid !== -1) return;
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ok */
      }
      pid = e.pointerId;
      this.input.haptic(0.2, 8);
      this.markActive();
      this.input.onGesture?.();
      t.held.fire = true;
      el.classList.add('down');
      setAim(e);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      e.preventDefault();
      setAim(e);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      e.preventDefault();
      pid = -1;
      el.classList.remove('down');
      t.aimX = t.aimY = 0;
      knob.style.transform = 'translate(-50%,-50%)';
      knob.classList.remove('aiming');
      window.setTimeout(() => {
        if (pid === -1) t.held.fire = false;
      }, 45);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  private bindStick() {
    const z = this.stickZone;
    z.addEventListener('pointerdown', (e) => {
      if (this.stickId !== -1) return;
      e.preventDefault();
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
      const p1 = toLocal(e.clientX, e.clientY);
      this.move(p1.x, p1.y);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = -1;
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
  sync(s: { weaponIcon: string; ammo: string; lowAmmo: boolean; grenades: number; dash01: number; merchant?:boolean;canReload?:boolean;reloading?:boolean;reload01?:number }) {
    const reloadStep=Math.round(Math.max(0,Math.min(1,s.reload01??0))*20);
    const key = `${s.weaponIcon.length}|${s.ammo}|${s.lowAmmo}|${s.grenades}|${Math.round(s.dash01 * 20)}|${s.merchant}|${s.canReload}|${s.reloading}|${reloadStep}`;
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
      if(reload.disabled){this.input.touch.held.reload=false;reload.classList.remove('down');delete reload.dataset.pid;}
    }
    this.buttons.get('interact')?.classList.toggle('hidden',!s.merchant);
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
    for (const k of Object.keys(t.held) as ActionName[]) t.held[k] = false;
    t.stickX = t.stickY = 0;
    t.aimX = t.aimY = 0;
    this.stickId = -1;
    this.base.classList.remove('on');
    this.ghost.classList.remove('off');
    this.root.querySelectorAll('.tbtn').forEach((b) => b.classList.remove('down'));
  }
}
