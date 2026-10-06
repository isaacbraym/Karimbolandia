import { AimPractice, AIM_ORIGIN } from './aimPractice';

type Device = 'kb' | 'touch' | 'pad';
const COPY: Record<Device, { title: string; text: string; stick: string; fire: string }> = {
  pad: { title: 'ANALÓGICO DIREITO → MIRA', text: 'Mova o analógico direito para apontar a arma. Segure R2 / RT para atirar. Pressionar R3 recarrega.', stick: 'ANALÓGICO DIREITO (R3)', fire: 'R2 / RT · ATIRAR' },
  touch: { title: 'SEGURE E ARRASTE FOGO', text: 'O botão FOGO também é um analógico de mira: segure e arraste na direção do alvo. Ele mira e atira ao mesmo tempo.', stick: 'FOGO · ARRASTE PARA MIRAR', fire: 'SEGURAR FOGO' },
  kb: { title: 'MOUSE → MIRA', text: 'Aponte o mouse para o alvo e segure o botão esquerdo para atirar. As teclas J / X também atiram.', stick: 'EXPERIMENTE O ANALÓGICO DIREITO', fire: 'CLIQUE / J · ATIRAR' },
};

/** Janela de treino carregada por import(); recursos e nós são criados só na abertura. */
export class AimTutorial {
  readonly root: HTMLElement;
  readonly practice = new AimPractice();
  private device: Device;
  private aim: { x: number; y: number } | null = null;
  private firing = false;
  private idle = 0;
  private time = 0;
  private pointer: number | null = null;
  private confirmReleased = false;
  private readonly frameAim = { x: 1, y: 0 };
  private readonly gun: SVGElement;
  private readonly target: SVGElement;
  private readonly ray: SVGElement;
  private readonly knob: HTMLElement;
  private readonly stick: HTMLElement;
  private readonly arena: SVGSVGElement;
  private readonly count: HTMLElement;
  private readonly cue: HTMLElement;
  constructor(parent: HTMLElement, device: Device, private readonly done: () => void) {
    this.device = device;
    const r = document.createElement('div'); this.root = r;
    r.className = 'aim-lesson'; r.setAttribute('role', 'dialog'); r.setAttribute('aria-modal', 'true'); r.setAttribute('aria-labelledby', 'aim-title');
    r.innerHTML = `<section class="aim-card">
      <header><span class="aim-tag">TUTORIAL · MIRA E DISPARO</span><span class="aim-safe">FASE PAUSADA</span></header>
      <h2 id="aim-title">APRENDA A APONTAR A ARMA</h2>
      <p class="aim-intro">Este é um treino separado. Pode experimentar à vontade, sem gastar munição ou perder vida.</p>
      <div class="aim-tabs" role="group" aria-label="Seu dispositivo"><button data-device="pad">CONTROLE</button><button data-device="touch">CELULAR</button><button data-device="kb">MOUSE / TECLADO</button></div>
      <div class="aim-content"><div class="aim-demo"><span class="aim-demo-label">JANELA DE TREINO</span>
      <svg class="aim-arena" viewBox="0 0 540 280" aria-label="Alvos de treino">
        <defs><linearGradient id="aim-sky" x2="0" y2="1"><stop stop-color="#17263f"/><stop offset="1" stop-color="#294a56"/></linearGradient><pattern id="aim-grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#9cd6d6" opacity=".08"/></pattern></defs>
        <rect width="540" height="280" rx="18" fill="url(#aim-sky)"/><rect width="540" height="280" fill="url(#aim-grid)"/>
        <path d="M55 280V211Q42 190 69 166L94 145L119 167L100 210V280" fill="#dbbd7c" stroke="#10192e" stroke-width="5"/>
        <g class="aim-gun"><path d="M-18-12H63V10H15V38H-5V10H-18Z" fill="#8195a5" stroke="#111b31" stroke-width="5"/><path d="M16-7H61V0H16" stroke="#b8dcd6" stroke-width="3"/><path d="M-6 2H5V28H-6Z" fill="#39445a"/></g>
        <line class="aim-ray" stroke="#ffe68c" stroke-width="4" stroke-linecap="round"/>
        <g class="aim-target"><circle r="25" fill="#f7ddae" stroke="#111a2e" stroke-width="4"/><circle r="17" fill="#e77469"/><circle r="9" fill="#fff0ce"/><circle r="3" fill="#de675f"/></g>
      </svg><div class="aim-feedback"><span class="aim-cue">DEMONSTRAÇÃO</span><span class="aim-count" aria-live="polite">0 / 3 ALVOS</span></div></div>
      <div class="aim-guide"><h3 class="aim-command"></h3><p class="aim-copy"></p>
        <div class="aim-controller"><div class="aim-move-stick"><i></i><small>MOVER</small></div><div class="aim-stick" role="slider" tabindex="0" aria-label="Analógico de mira de treino" aria-valuemin="-180" aria-valuemax="180" aria-valuenow="0"><i></i><b>3</b></div></div>
        <strong class="aim-stick-label"></strong><button class="aim-fire" type="button"></button><small class="aim-tip">Arraste o círculo para experimentar. No controle, use o analógico direito e R2 / RT.</small>
      </div></div>
      <footer><span>Prática opcional · continue quando entender a mira.</span><button class="aim-done" type="button">ENTENDI · COMEÇAR A FASE ▶</button></footer>
    </section>`;
    const q = <T extends Element>(s: string) => r.querySelector<T>(s)!;
    this.gun = q('.aim-gun'); this.target = q('.aim-target'); this.ray = q('.aim-ray'); this.knob = q('.aim-stick i'); this.stick = q('.aim-stick'); this.arena = q('.aim-arena'); this.count = q('.aim-count'); this.cue = q('.aim-cue');
    for (const ev of ['pointerdown', 'pointerup', 'pointermove', 'click', 'contextmenu']) r.addEventListener(ev, e => e.stopPropagation());
    r.addEventListener('contextmenu', e => e.preventDefault());
    r.querySelectorAll<HTMLButtonElement>('[data-device]').forEach(b => b.onclick = () => this.select(b.dataset.device as Device));
    q<HTMLButtonElement>('.aim-done').onclick = done;
    const fire = q<HTMLElement>('.aim-fire');
    fire.onpointerdown = e => { fire.setPointerCapture(e.pointerId); this.firing = true; this.idle = 0; };
    fire.onpointerup = fire.onpointercancel = () => { this.firing = false; };
    const move = (e: PointerEvent) => {
      const box = this.stick.getBoundingClientRect(), radius = box.width * .35;
      let x = (e.clientX - box.left - box.width / 2) / radius, y = (e.clientY - box.top - box.height / 2) / radius;
      const len = Math.max(1, Math.hypot(x, y)); x /= len; y /= len;
      this.aim = { x, y }; this.idle = 0;
    };
    this.stick.onpointerdown = e => { this.pointer = e.pointerId; this.stick.setPointerCapture(e.pointerId); move(e); this.firing = this.device === 'touch'; };
    this.stick.onpointermove = e => { if (this.pointer === e.pointerId) move(e); };
    this.stick.onpointerup = this.stick.onpointercancel = () => { this.pointer = null; this.firing = false; this.aim = null; };
    const mouseAim = (e: PointerEvent) => {
      if (this.device !== 'kb') return;
      const matrix = this.arena.getScreenCTM(); if (!matrix) return;
      const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
      this.aim = { x: point.x - AIM_ORIGIN.x, y: point.y - AIM_ORIGIN.y }; this.idle = 0;
    };
    this.arena.onpointermove = mouseAim;
    this.arena.onpointerdown = e => { mouseAim(e); if (this.device === 'kb') { this.arena.setPointerCapture(e.pointerId); this.firing = true; } };
    this.arena.onpointerup = this.arena.onpointercancel = () => { this.firing = false; };
    r.onkeydown = e => {
      e.stopPropagation();
      if (['KeyJ', 'KeyX'].includes(e.code)) { e.preventDefault(); this.firing = true; this.idle = 0; }
      if (e.target === this.stick && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault(); this.aim = { x: Math.cos(this.practice.angle + (e.code === 'ArrowUp' || e.code === 'ArrowLeft' ? -.12 : .12)), y: Math.sin(this.practice.angle + (e.code === 'ArrowUp' || e.code === 'ArrowLeft' ? -.12 : .12)) }; this.idle = 0;
      }
      if (e.code === 'Tab') {
        const focus = [...r.querySelectorAll<HTMLElement>('button,[tabindex="0"]')];
        if (e.shiftKey && document.activeElement === focus[0]) { e.preventDefault(); focus.at(-1)!.focus(); }
        else if (!e.shiftKey && document.activeElement === focus.at(-1)) { e.preventDefault(); focus[0].focus(); }
      }
    };
    r.onkeyup = e => { e.stopPropagation(); if (['KeyJ', 'KeyX'].includes(e.code)) this.firing = false; };
    parent.append(r); this.select(device); q<HTMLElement>(`[data-device="${device}"]`).focus({ preventScroll: true }); this.update(0);
  }
  private select(device: Device) {
    this.device = device; this.aim = null; this.firing = false; this.idle = 3;
    const c = COPY[device]; this.root.dataset.device = device;
    this.root.querySelector('.aim-done')!.textContent = device === 'pad' ? 'ENTENDI · A / ✕ PARA COMEÇAR ▶' : 'ENTENDI · COMEÇAR A FASE ▶';
    for (const [s, value] of [['.aim-command', c.title], ['.aim-copy', c.text], ['.aim-stick-label', c.stick], ['.aim-fire', c.fire]]) this.root.querySelector(s)!.textContent = value;
    this.root.querySelectorAll<HTMLButtonElement>('[data-device]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.device === device)));
  }
  update(dt: number) {
    this.time += dt; this.idle += dt;
    let aim = this.aim, firing = this.firing;
    const pads = navigator.getGamepads?.();
    let pad: Gamepad | null = null;
    if (this.device === 'pad' && pads) for (let i = 0; i < pads.length; i++) if (pads[i]?.connected) { pad = pads[i]; break; }
    if (pad) {
      if (!pad.buttons[0]?.pressed) this.confirmReleased = true;
      else if (this.confirmReleased) { this.done(); return; }
      const x = pad.axes[2] ?? 0, y = pad.axes[3] ?? 0;
      if (Math.hypot(x, y) > .45) { this.frameAim.x = x; this.frameAim.y = y; aim = this.frameAim; this.idle = 0; }
      firing ||= !!pad.buttons[7]?.pressed || !!pad.buttons[2]?.pressed;
      if (firing) this.idle = 0;
    }
    const demo = this.idle > 2 && !firing && this.pointer === null;
    if (demo) {
      const t = this.practice.target;
      const a = Math.atan2(t.y - AIM_ORIGIN.y, t.x - AIM_ORIGIN.x) + Math.sin(this.time * 2) * .18;
      this.frameAim.x = Math.cos(a); this.frameAim.y = Math.sin(a); aim = this.frameAim; firing = Math.sin(this.time * 4) > .8;
    }
    this.practice.update(dt, aim, firing, demo);
    const a = this.practice.angle, t = this.practice.target;
    this.gun.setAttribute('transform', `translate(110 155) rotate(${a * 180 / Math.PI})`);
    this.target.setAttribute('transform', `translate(${t.x} ${t.y})`);
    this.ray.setAttribute('x1', String(110 + Math.cos(a) * 66)); this.ray.setAttribute('y1', String(155 + Math.sin(a) * 66));
    this.ray.setAttribute('x2', String(110 + Math.cos(a) * 405)); this.ray.setAttribute('y2', String(155 + Math.sin(a) * 405));
    this.ray.style.opacity = this.practice.flash > 0 ? '1' : '0';
    this.knob.style.transform = `translate(${Math.cos(a) * 25}px,${Math.sin(a) * 25}px)`;
    this.stick.setAttribute('aria-valuenow', String(Math.round(a * 180 / Math.PI)));
    const cue = demo ? 'DEMONSTRAÇÃO · EXPERIMENTE A MIRA' : this.practice.hits >= 3 ? 'BOA! VOCÊ JÁ PODE COMEÇAR.' : 'SUA VEZ · MIRE E ATIRE';
    if (this.cue.textContent !== cue) this.cue.textContent = cue;
    const count = `${Math.min(3, this.practice.hits)} / 3 ALVOS`;
    if (this.count.textContent !== count) this.count.textContent = count;
  }
  dispose() { this.root.remove(); }
}
