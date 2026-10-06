/**
 * Interface do tutorial do boxe (DOM por cima da cena; vive em art/minigames para só carregar com o boxe, regra D09): um cartão com o título, o que apertar (mouse e teclas
 * no computador; dedo e analógico no celular) e os botões; mais o cursor/dedo animado sobre a cena e, nos
 * passos de defesa, o analógico virtual. Tudo é guiado pelo `cue` do roteiro (game/minigames/boxing/tutorial.ts),
 * então o que a dica mostra acontece NO MESMO instante do golpe na tela. O cartão fica no canto de baixo
 * (nunca sobre o Karimbo nem sobre a cabeça do jacaré) e só os botões pegam toque: o resto da tela continua
 * valendo, para a pessoa experimentar enquanto lê.
 */
import { STEPS, type Cue, type StepId } from '../../../game/minigames/boxing/tutorial';

export interface BoxTutorialHandlers { onNext: () => void; onBack: () => void; onSkip: () => void }

interface Copy { title: string; pc: string; touch: string; pcKeys: string; touchKeys: string }
const COPY: Record<StepId, Copy> = {
  soco: {
    title: 'SOCAR',
    pc: 'CLIQUE na tela. Lado <b>ESQUERDO</b> = mão esquerda; lado <b>DIREITO</b> = mão direita.',
    touch: 'TOQUE na tela. Lado <b>ESQUERDO</b> = mão esquerda; lado <b>DIREITO</b> = mão direita.',
    pcKeys: 'Teclado: <kbd>J</kbd> esquerda · <kbd>K</kbd> direita',
    touchKeys: 'Dois dedos, um em cada lado: vale!',
  },
  gancho: {
    title: 'GANCHO E CRUZADO',
    pc: 'Segure o botão e <b>ARRASTE</b>: pra <b>CIMA</b> = GANCHO (fura a guarda alta); pro <b>LADO</b> = CRUZADO (forte).',
    touch: '<b>ARRASTE</b> o dedo: pra <b>CIMA</b> = GANCHO (fura a guarda alta); pro <b>LADO</b> = CRUZADO (forte).',
    pcKeys: 'Teclado: <kbd>N</kbd><kbd>M</kbd> gancho · <kbd>U</kbd><kbd>I</kbd> cruzado',
    touchKeys: 'Arrastar pra baixo também abaixa.',
  },
  esquiva: {
    title: 'VERMELHO: ESQUIVE!',
    pc: 'Quando o jacaré brilhar em <b class="r">VERMELHO</b>, saia da frente. Esquivar na hora certa dá <b>ESTRELA</b> e abre o contra-ataque.',
    touch: 'Quando o jacaré brilhar em <b class="r">VERMELHO</b>, empurre o <b>ANALÓGICO</b> pro lado. Na hora certa dá <b>ESTRELA</b> e abre o contra-ataque.',
    pcKeys: 'Teclado: <kbd>A</kbd> ou <kbd>D</kbd> (← →)',
    touchKeys: 'Analógico: ◀ ou ▶',
  },
  abaixar: {
    title: 'LARANJA: ABAIXE!',
    pc: 'A <b class="o">CABEÇADA</b> (laranja) passa por cima de quem abaixa. Aperte um instante antes de acertar.',
    touch: 'A <b class="o">CABEÇADA</b> (laranja) passa por cima de quem abaixa. Puxe o <b>ANALÓGICO</b> pra baixo um instante antes.',
    pcKeys: 'Teclado: <kbd>S</kbd> (↓)',
    touchKeys: 'Analógico: ▼',
  },
  bloqueio: {
    title: 'AMARELO: BLOQUEIE!',
    pc: 'A <b class="y">PATADA</b> (amarela) pode ser bloqueada. Bloquear <b>na hora certa</b> = nenhum dano.',
    touch: 'A <b class="y">PATADA</b> (amarela) pode ser bloqueada. Segure <b>BLOQUEAR</b> na hora certa = nenhum dano.',
    pcKeys: 'Segure o botão <b>DIREITO</b> do mouse (ou <kbd>W</kbd> ↑)',
    touchKeys: 'Botão BLOQUEAR (segurar)',
  },
  orelhada: {
    title: 'ORELHADA!',
    pc: 'Com o jacaré <b>grogue</b>, acabe com a <b>ORELHADA</b>! Cada estrela que você ganha defendendo bem deixa ela mais forte.',
    touch: 'Com o jacaré <b>grogue</b>, toque em <b>ORELHADA!</b> Cada estrela que você ganha defendendo bem deixa ela mais forte.',
    pcKeys: 'Teclado: <kbd>ESPAÇO</kbd>',
    touchKeys: 'Botão ORELHADA!',
  },
};

const MOUSE = '<svg class="bt-mouse" viewBox="0 0 40 56" aria-hidden="true"><rect x="3" y="3" width="34" height="50" rx="17" class="mb"/><path class="ml" d="M20 3A17 17 0 0 0 3 20H20Z"/><path class="mr" d="M20 3A17 17 0 0 1 37 20H20Z"/><path d="M3 20H37M20 3V20" class="mk"/></svg>';
const STICK = '<div class="bt-stick" aria-hidden="true"><i></i></div>';
const CURSOR = '<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M3 2l17 12-8 1.6L16 25l-4 1.6-4-9.4-5 5z" fill="#fff" stroke="#170f2e" stroke-width="2" stroke-linejoin="round"/></svg>';

export class BoxTutorial {
  readonly root: HTMLElement;
  private card: HTMLElement;
  private ptr: HTMLElement;
  private trail: HTMLElement;
  private mid: HTMLElement;
  private stickBig: HTMLElement;
  private pic: HTMLElement;
  private step = -1;
  private id: StepId = 'soco';
  private canvas: HTMLElement | null;

  constructor(parent: HTMLElement, private coarse: boolean, private h: BoxTutorialHandlers) {
    this.canvas = document.getElementById('game');
    const r = document.createElement('div');
    r.className = `bt ${coarse ? 'bt-touch' : 'bt-pc'}`;
    r.innerHTML = `
      <div class="bt-frame" aria-hidden="true"></div>
      <div class="bt-mode"><strong>TUTORIAL DE BOXE</strong><span>Demonstração e prática · a luta ainda não começou</span></div>
      <div class="bt-mid" aria-hidden="true"><span>◀ MÃO ESQUERDA</span><span>MÃO DIREITA ▶</span></div>
      <div class="bt-trail" aria-hidden="true"></div>
      <div class="bt-ptr" aria-hidden="true">${coarse ? '<i class="bt-dot"></i>' : CURSOR}<i class="bt-rip"></i></div>
      ${coarse ? STICK.replace('bt-stick', 'bt-stick bt-stick-big') : ''}
      <section class="bt-card" role="dialog" aria-label="Tutorial de boxe: como lutar">
        <header><span class="bt-count"></span><span class="bt-dots"></span></header>
        <h3 class="bt-title"></h3>
        <div class="bt-row"><p class="bt-body"></p><div class="bt-pic"></div></div>
        <p class="bt-keys"></p>
        <footer><button type="button" class="bt-skip">IR PARA A LUTA</button><button type="button" class="bt-back">◀</button><button type="button" class="bt-next"></button></footer>
      </section>`;
    parent.appendChild(r);
    this.root = r;
    this.card = r.querySelector('.bt-card') as HTMLElement;
    this.ptr = r.querySelector('.bt-ptr') as HTMLElement;
    this.trail = r.querySelector('.bt-trail') as HTMLElement;
    this.mid = r.querySelector('.bt-mid') as HTMLElement;
    this.stickBig = r.querySelector('.bt-stick-big') as HTMLElement;
    this.pic = r.querySelector('.bt-pic') as HTMLElement;
    const stop = (e: Event) => e.stopPropagation();
    // o cartão não deixa o clique/toque virar soco por baixo (só ele; o resto da tela continua valendo)
    for (const ev of ['pointerdown', 'pointerup', 'pointermove', 'mousedown', 'touchstart']) this.card.addEventListener(ev, stop);
    (r.querySelector('.bt-next') as HTMLElement).addEventListener('click', () => this.h.onNext());
    (r.querySelector('.bt-back') as HTMLElement).addEventListener('click', () => this.h.onBack());
    (r.querySelector('.bt-skip') as HTMLElement).addEventListener('click', () => this.h.onSkip());
  }

  /** Mostra o passo `i` (texto, figura e botões). */
  setStep(i: number) {
    if (i === this.step) return;
    this.step = i;
    this.id = STEPS[i];
    const c = COPY[this.id], last = i === STEPS.length - 1;
    const q = (s: string) => this.root.querySelector(s) as HTMLElement;
    q('.bt-count').textContent = `${i + 1}/${STEPS.length}`;
    q('.bt-dots').innerHTML = STEPS.map((_, k) => `<i class="${k === i ? 'on' : k < i ? 'done' : ''}"></i>`).join('');
    q('.bt-title').textContent = c.title;
    q('.bt-body').innerHTML = this.coarse ? c.touch : c.pc;
    q('.bt-keys').innerHTML = this.coarse ? c.touchKeys : c.pcKeys;
    q('.bt-next').textContent = last ? 'TERMINAR TREINO E LUTAR ▶' : 'PRÓXIMO ▶';
    q('.bt-next').classList.toggle('go', last);
    (q('.bt-back') as HTMLButtonElement).disabled = i === 0;
    this.root.dataset.step = this.id;
    // figura do comando
    const key = (k: string, on = '') => `<kbd class="bt-k ${on}" data-k="${k}">${k}</kbd>`;
    let fig = '';
    if (!this.coarse) {
      if (this.id === 'soco' || this.id === 'gancho') fig = MOUSE;
      else if (this.id === 'esquiva') fig = key('A') + key('D');
      else if (this.id === 'abaixar') fig = key('S');
      else if (this.id === 'bloqueio') fig = MOUSE.replace('bt-mouse', 'bt-mouse rbtn');
      else fig = key('ESPAÇO');
    } else if (this.id === 'esquiva' || this.id === 'abaixar') fig = STICK;
    this.pic.innerHTML = fig;
    this.mid.classList.toggle('on', this.id === 'soco' || this.id === 'gancho');
    // no celular os botões reais (BLOQUEAR) piscam no passo do bloqueio
    document.getElementById('touch')?.classList.toggle('bt-hl-guard', this.coarse && this.id === 'bloqueio');
  }

  /** A cada quadro: posiciona o cursor/dedo, o analógico e acende a tecla do comando. */
  update(cue: Cue) {
    const rect = (this.canvas ?? document.body).getBoundingClientRect();
    const X = (f: number) => rect.left + rect.width * f, Y = (f: number) => rect.top + rect.height * f;
    const on = cue.kind === 'tap' || cue.kind === 'swipeUp' || cue.kind === 'swipeSide';
    this.ptr.classList.toggle('on', on);
    this.ptr.classList.toggle('down', on && cue.down);
    this.trail.classList.toggle('on', on && (cue.kind === 'swipeUp' || cue.kind === 'swipeSide') && cue.p > 0.15);
    if (on) {
      let x = 0.24, y = 0.52, x0 = 0, y0 = 0;
      const p = Math.max(0, Math.min(1, cue.p));
      if (cue.kind === 'tap') { x = cue.side < 0 ? 0.24 : 0.76; y = 0.52 - 0.05 * Math.sin(Math.min(1, p * 2) * Math.PI * 0.5); }
      else if (cue.kind === 'swipeUp') { x = 0.76; y = 0.66 - 0.3 * p; x0 = 0.76; y0 = 0.66; }
      else { x = 0.1 + 0.26 * p; y = 0.56; x0 = 0.1; y0 = 0.56; }
      this.ptr.style.transform = `translate(${X(x)}px, ${Y(y)}px)`;
      if (cue.kind !== 'tap') {
        const dx = X(x) - X(x0), dy = Y(y) - Y(y0), len = Math.hypot(dx, dy);
        this.trail.style.cssText = `left:${X(x0)}px;top:${Y(y0)}px;width:${len}px;transform:rotate(${Math.atan2(dy, dx)}rad)`;
      }
    }
    // analógico virtual (celular): o botão do passo "esquivar/abaixar" anda para o lado ou para baixo
    const stickOn = cue.kind === 'stickSide' || cue.kind === 'stickDown';
    const kx = cue.kind === 'stickSide' ? cue.side * cue.p : 0, ky = cue.kind === 'stickDown' ? cue.p : 0;
    for (const s of this.root.querySelectorAll<HTMLElement>('.bt-stick')) {
      s.style.setProperty('--kx', String(kx)); s.style.setProperty('--ky', String(ky));
      s.classList.toggle('pull', stickOn && cue.p > 0.3);
    }
    if (this.stickBig) this.stickBig.classList.toggle('on', stickOn);
    // teclas e botões acesos
    const lit = cue.down;
    const keys = this.pic.querySelectorAll<HTMLElement>('.bt-k');
    for (const k of keys) k.classList.toggle('on', lit && (cue.kind === 'stickSide' ? k.dataset.k === 'A' : true));
    const mouse = this.pic.querySelector<HTMLElement>('.bt-mouse');
    if (mouse) { mouse.classList.toggle('lit', lit && (cue.kind === 'tap' || cue.kind === 'swipeUp' || cue.kind === 'swipeSide' || cue.kind === 'guard')); }
  }

  dispose() {
    document.getElementById('touch')?.classList.remove('bt-hl-guard');
    this.root.remove();
  }
}
