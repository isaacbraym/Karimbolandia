/** Menus em DOM: carregamento, principal, configurações, controles, créditos, pausa, resultados, girar celular. */
import { settings, saveSettings, progress, type QualityPref } from '../core/storage';
import { formatTime } from '../core/math';

export interface MenuCallbacks {
  onPlay(): void;
  onSettingsChanged(): void;
  onResume(): void;
  onRestart(): void;
  onQuitToMenu(): void;
  onPlayAgain(): void;
  onContinueYes(): void;
  onContinueNo(): void;
  onClick(): void;
}

export interface ResultData {
  time: number;
  score: number;
  tokens: number;
  emblems: number;
  secrets: number;
  kills: number;
  deaths: number;
  rank: string;
  newBest: boolean;
  bestCombo?: number;
}

export function computeRank(d: { score: number; time: number; emblems: number; secrets: number; deaths: number }) {
  let pts = 0;
  pts += Math.min(40, d.score / 900);
  pts += d.emblems * 3.5;
  pts += d.secrets * 5;
  pts += Math.max(0, 20 - d.deaths * 3);
  pts += Math.max(0, 15 - Math.max(0, d.time - 900) / 90);
  return pts >= 105 ? 'S' : pts >= 84 ? 'A' : pts >= 62 ? 'B' : 'C';
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

export class Menus {
  root: HTMLElement;
  loading: HTMLElement;
  main: HTMLElement;
  panel: HTMLElement;
  pause: HTMLElement;
  results: HTMLElement;
  cont: HTMLElement;
  over: HTMLElement;
  rotate: HTMLElement;
  toastEl: HTMLElement;
  fadeEl: HTMLElement;
  private contNum!: HTMLElement;
  private contRing!: HTMLElement;
  private contLives!: HTMLElement;
  private bar!: HTMLElement;
  private lbl!: HTMLElement;
  private panelReturn: 'main' | 'pause' = 'main';
  private toastT = 0;
  private focusable: HTMLElement[] = [];
  private focusIdx = -1;

  constructor(root: HTMLElement, private cb: MenuCallbacks) {
    this.root = root;
    this.loading = this.buildLoading();
    this.main = this.buildMain();
    this.panel = el('div', 'overlay panel-back hidden');
    this.pause = this.buildPause();
    this.results = el('div', 'overlay hidden');
    this.results.id = 'results';
    this.cont = this.buildContinue();
    this.over = this.buildGameOver();
    this.rotate = this.buildRotate();
    this.toastEl = el('div');
    this.toastEl.id = 'toast';
    this.fadeEl = el('div');
    this.fadeEl.id = 'fade';
    root.append(this.loading, this.main, this.panel, this.pause, this.results, this.cont, this.over, this.rotate, this.toastEl, this.fadeEl);
  }

  // ------------------------------------------------------------------ construção
  private btn(label: string, cls: string, fn: () => void) {
    const b = el('button', `btn ${cls}`.trim(), label);
    b.type = 'button';
    b.addEventListener('click', () => {
      this.cb.onClick();
      fn();
    });
    return b;
  }

  private buildLoading() {
    const o = el('div', 'overlay');
    o.id = 'loading';
    o.innerHTML = `<div class="title logo">KARIMBOLÂNDIA</div><div class="bar"><i></i></div><div class="lbl">Carregando...</div>`;
    this.bar = o.querySelector('.bar > i') as HTMLElement;
    this.lbl = o.querySelector('.lbl') as HTMLElement;
    return o;
  }

  private buildMain() {
    const o = el('div', 'overlay hidden');
    o.id = 'menu';
    const wrap = el('div', 'wrap');
    wrap.append(el('div', 'title', 'KARIMBOLÂNDIA<span class="ver">.v3</span>'), el('div', 'sub', 'RUN &amp; GUN 2.5D'));
    const btns = el('div', 'btns');
    btns.append(
      this.btn('JOGAR', 'primary', () => this.cb.onPlay()),
      this.btn('CONFIGURAÇÕES', 'alt', () => this.showSettings('main')),
      this.btn('CONTROLES', 'alt', () => this.showControls('main')),
      this.btn('CRÉDITOS', 'alt', () => this.showCredits('main'))
    );
    wrap.append(btns);
    o.append(wrap);
    const foot = el('div', 'footer');
    foot.id = 'menu-foot';
    o.append(foot);
    return o;
  }

  private buildPause() {
    const o = el('div', 'overlay panel-back hidden');
    o.style.zIndex = '32';
    const p = el('div', 'panel');
    p.style.width = 'min(360px, 92vw)';
    p.append(el('h2', '', 'PAUSADO'));
    const btns = el('div', 'btns');
    btns.append(
      this.btn('CONTINUAR', 'primary', () => this.cb.onResume()),
      this.btn('CONFIGURAÇÕES', 'alt', () => this.showSettings('pause')),
      this.btn('REINICIAR FASE', 'alt', () => this.cb.onRestart()),
      this.btn('MENU PRINCIPAL', 'alt', () => this.cb.onQuitToMenu())
    );
    p.append(btns);
    o.append(p);
    return o;
  }

  private buildContinue() {
    const o = el('div', 'overlay hidden');
    o.id = 'continue';
    const wrap = el('div', 'wrap');
    wrap.append(el('div', 'title', 'CONTINUAR?'));
    const ring = el('div', 'cring');
    this.contNum = el('b', '', '10');
    ring.append(this.contNum);
    this.contRing = ring;
    this.contLives = el('div', 'clives', '');
    const btns = el('div', 'btns');
    btns.append(this.btn('SIM! GASTAR 1 VIDA', 'primary', () => this.cb.onContinueYes()), this.btn('VOLTAR AO CHECKPOINT', 'alt small', () => this.cb.onContinueNo()));
    wrap.append(ring, this.contLives, btns);
    o.append(wrap);
    return o;
  }

  private buildGameOver() {
    const o = el('div', 'overlay hidden');
    o.id = 'gameover';
    const wrap = el('div', 'wrap');
    wrap.append(el('div', 'title', 'FIM DE JOGO'), el('div', 'sub', 'Suas vidas acabaram'));
    const btns = el('div', 'btns');
    btns.append(this.btn('RECOMEÇAR A FASE', 'primary', () => this.cb.onRestart()), this.btn('MENU PRINCIPAL', 'alt', () => this.cb.onQuitToMenu()));
    wrap.append(btns);
    o.append(wrap);
    return o;
  }

  private buildRotate() {
    const o = el('div', 'overlay hidden');
    o.id = 'rotate';
    o.innerHTML = `<div class="phone"></div><div class="msg">GIRE O CELULAR PARA JOGAR</div><div class="sub">Karimbolândia é jogado na horizontal</div>`;
    return o;
  }

  // ------------------------------------------------------------------ painéis
  private openPanel(content: HTMLElement, from: 'main' | 'pause') {
    this.panelReturn = from;
    // voltar SEMPRE visível no canto superior esquerdo (antes ficava no fim do conteúdo, com rolagem)
    const back = el('button', 'btn back-fab', '<span class="arr">←</span> VOLTAR');
    (back as HTMLButtonElement).type = 'button';
    back.setAttribute('aria-label', 'Voltar');
    back.addEventListener('click', () => {
      this.cb.onClick();
      this.closePanel();
    });
    this.panel.replaceChildren(back, content);
    this.panel.classList.remove('hidden');
    if (from === 'main') this.main.classList.add('hidden');
    else this.pause.classList.add('hidden');
    this.collectFocus(content);
  }

  closePanel() {
    this.panel.classList.add('hidden');
    if (this.panelReturn === 'main') this.main.classList.remove('hidden');
    else this.pause.classList.remove('hidden');
    this.collectFocus(this.panelReturn === 'main' ? this.main : this.pause);
  }

  get panelOpen() {
    return !this.panel.classList.contains('hidden');
  }

  private slider(label: string, get: () => number, set: (v: number) => void, min = 0, max = 1, step = 0.05) {
    const row = el('div', 'row');
    const l = el('label', '', label);
    const i = el('input');
    i.type = 'range';
    i.min = String(min);
    i.max = String(max);
    i.step = String(step);
    i.value = String(get());
    i.addEventListener('input', () => {
      set(parseFloat(i.value));
      saveSettings();
      this.cb.onSettingsChanged();
    });
    row.append(l, i);
    return row;
  }

  private toggle(label: string, get: () => boolean, set: (v: boolean) => void) {
    const row = el('div', 'row');
    const l = el('label', '', label);
    const t = el('div', 'toggle' + (get() ? ' on' : ''));
    t.setAttribute('role', 'switch');
    t.addEventListener('click', () => {
      const v = !get();
      set(v);
      t.classList.toggle('on', v);
      saveSettings();
      this.cb.onClick();
      this.cb.onSettingsChanged();
    });
    row.append(l, t);
    return row;
  }

  showSettings(from: 'main' | 'pause') {
    const c = el('div', 'panel');
    c.append(el('h2', '', 'CONFIGURAÇÕES'));
    c.append(
      this.slider('Música', () => settings.music, (v) => (settings.music = v)),
      this.slider('Efeitos sonoros', () => settings.sfx, (v) => (settings.sfx = v))
    );
    const qrow = el('div', 'row');
    qrow.append(el('label', '', 'Qualidade gráfica'));
    const sel = el('select');
    (
      [
        ['auto', 'Automática'],
        ['high', 'Alta'],
        ['medium', 'Média'],
        ['low', 'Baixa (economia)'],
      ] as [QualityPref, string][]
    ).forEach(([v, t]) => {
      const o = el('option', '', t);
      o.value = v;
      if (settings.quality === v) o.selected = true;
      sel.append(o);
    });
    sel.addEventListener('change', () => {
      settings.quality = sel.value as QualityPref;
      saveSettings();
      this.cb.onSettingsChanged();
      this.toast(settings.quality === 'auto' ? 'Qualidade automática' : 'Qualidade atualizada');
    });
    qrow.append(sel);
    c.append(qrow);
    c.append(
      this.slider('Tamanho dos botões (toque)', () => settings.touchScale, (v) => (settings.touchScale = v), 0.7, 1.4, 0.05),
      this.slider('Opacidade dos botões (toque)', () => settings.touchOpacity, (v) => (settings.touchOpacity = v), 0.2, 0.9, 0.05),
      this.toggle('Modo canhoto (inverte os botões)', () => settings.leftHanded, (v) => (settings.leftHanded = v)),
      this.toggle('Assistência de mira (toque/teclado)', () => settings.aimAssist, (v) => (settings.aimAssist = v)),
      this.toggle('Vibração (celular / controle)', () => settings.haptics, (v) => (settings.haptics = v)),
      this.toggle('Tremor de tela', () => settings.screenShake, (v) => (settings.screenShake = v)),
      this.toggle('Mostrar FPS', () => settings.showFps, (v) => (settings.showFps = v))
    );
    const act = el('div', 'actions');

    c.append(act);
    this.openPanel(c, from);
  }

  showControls(from: 'main' | 'pause') {
    const c = el('div', 'panel');
    c.append(el('h2', '', 'CONTROLES'));
    c.append(
      el(
        'div',
        'kbd-grid',
        `
      <div class="k"><span>Mover</span><span><kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd></span></div>
      <div class="k"><span>Mirar p/ cima</span><span><kbd>W</kbd> / <kbd>↑</kbd></span></div>
      <div class="k"><span>Agachar / engatinhar</span><span><kbd>S</kbd> / <kbd>↓</kbd></span></div>
      <div class="k"><span>Pular</span><span><kbd>ESPAÇO</kbd></span></div>
      <div class="k"><span>Planar (ORELHAS)</span><span>pular de novo no ar</span></div>
      <div class="k"><span>Atirar</span><span>clique / <kbd>J</kbd></span></div>
      <div class="k"><span>Mirar</span><span>mouse</span></div>
      <div class="k"><span>Granada</span><span><kbd>G</kbd> / botão direito</span></div>
      <div class="k"><span>Trocar arma</span><span><kbd>Q</kbd> <kbd>E</kbd> / roda</span></div>
      <div class="k"><span>Especial (Nômad)</span><span><kbd>SHIFT</kbd></span></div>
      <div class="k"><span>Descer da plataforma</span><span><kbd>S</kbd> + <kbd>ESPAÇO</kbd></span></div>
      <div class="k"><span>Pausar</span><span><kbd>ESC</kbd></span></div>`
      )
    );
    c.append(
      el('p', '', '<b>Celular:</b> joystick à esquerda (empurre para cima/diagonal para mirar); botões à direita: <b>FOGO</b>, <b>PULO</b> (toque de novo no ar para planar), granada, especial e troca de arma. Dá para mover, pular e atirar ao mesmo tempo.'),
      el('p', '', '<b>Gamepad:</b> analógico esquerdo mover/mirar • A pular • X/RT atirar • B granada • Y especial • LB/RB trocar arma • Start pausa.')
    );
    const act = el('div', 'actions');

    c.append(act);
    this.openPanel(c, from);
  }

  showCredits(from: 'main' | 'pause') {
    const c = el('div', 'panel credits');
    c.append(el('h2', '', 'CRÉDITOS'));
    c.append(
      el('h3', '', 'KARIMBOLÂNDIA'),
      el('p', '', 'Um jogo de ação e plataforma 2.5D feito para rodar direto no navegador.'),
      el('h3', '', 'ELENCO'),
      el('p', '', '<b>Karimbo</b> — o herói (a própria pessoa da foto!)<br><b>Felipão</b> — o chefe da Legião (a própria pessoa da foto!)<br><b>Nômad</b> — o robô de guerra'),
      el('h3', '', 'TECNOLOGIA'),
      el('p', '', 'TypeScript • Vite • Canvas 2D • WebAudio<br>Toda a arte do cenário, os efeitos, a música e os sons são gerados por código.'),
      el('h3', '', 'FONTES'),
      el('p', '', 'Lilita One e Rajdhani — SIL Open Font License.'),
      el('p', '', '<small>Inspirado no ritmo dos clássicos run-and-gun. Nenhum sprite, música, mapa ou marca de terceiros foi utilizado.</small>')
    );
    const act = el('div', 'actions');

    c.append(act);
    this.openPanel(c, from);
  }

  // ------------------------------------------------------------------ estados
  setLoading(p: number, label: string) {
    this.bar.style.width = `${Math.round(p * 100)}%`;
    this.lbl.textContent = label;
  }
  hideLoading() {
    this.loading.classList.add('hidden');
  }
  showMain(footer = '') {
    this.hideAll();
    this.main.classList.remove('hidden');
    (document.getElementById('menu-foot') as HTMLElement).textContent = footer;
    this.collectFocus(this.main);
  }
  hideAll() {
    this.main.classList.add('hidden');
    this.panel.classList.add('hidden');
    this.pause.classList.add('hidden');
    this.results.classList.add('hidden');
    this.cont.classList.add('hidden');
    this.over.classList.add('hidden');
    this.focusable = [];
    this.focusIdx = -1;
  }
  showPause() {
    this.pause.classList.remove('hidden');
    this.collectFocus(this.pause);
  }
  hidePause() {
    this.pause.classList.add('hidden');
    this.panel.classList.add('hidden');
    this.focusable = [];
  }
  get pauseOpen() {
    return !this.pause.classList.contains('hidden') || this.panelOpen;
  }

  showContinue(livesLeft: number) {
    this.cont.classList.remove('hidden');
    const after = livesLeft - 1;
    this.contLives.textContent = `Vidas: ${livesLeft}  →  ${after}`;
    this.setContinueCount(10, 10);
    this.collectFocus(this.cont);
  }
  setContinueCount(left: number, total: number) {
    this.contNum.textContent = String(Math.max(0, Math.ceil(left)));
    this.contRing.style.setProperty('--p', String(Math.max(0, Math.min(1, left / total))));
    this.contRing.classList.toggle('urgent', left <= 3);
  }
  showGameOver() {
    this.over.classList.remove('hidden');
    this.collectFocus(this.over);
  }

  private updateEl: HTMLElement | null = null;
  private updatePill: HTMLElement | null = null;
  /** Janela de confirmação: há uma versão nova do jogo. */
  showUpdate(apply: () => void, onLater?: () => void) {
    this.updatePill?.remove();
    this.updatePill = null;
    if (this.updateEl) return;
    const o = el('div', 'overlay panel-back');
    o.id = 'update';
    const p = el('div', 'panel');
    p.style.width = 'min(400px, 92vw)';
    p.style.textAlign = 'center';
    p.append(el('h2', '', 'NOVA VERSÃO!'), el('p', '', 'Saiu uma atualização do Karimbolândia. Atualize para jogar a versão mais nova.'));
    const btns = el('div', 'btns');
    btns.append(
      this.btn('ATUALIZAR AGORA', 'primary', () => {
        p.querySelectorAll('.btn').forEach((b) => b.setAttribute('disabled', ''));
        (p.querySelector('h2') as HTMLElement).textContent = 'ATUALIZANDO...';
        apply();
      }),
      this.btn('DEPOIS', 'alt small', () => {
        o.remove();
        this.updateEl = null;
        this.showUpdatePill(apply, onLater);
        onLater?.();
      })
    );
    p.append(btns);
    o.append(p);
    this.root.append(o);
    this.updateEl = o;
    this.collectFocus(o);
  }

  /** Botão discreto (durante a partida): toca para ver a confirmação. */
  showUpdatePill(apply: () => void, onOpen?: () => void) {
    if (this.updatePill || this.updateEl) return;
    const b = el('button', 'update-pill', '⬆ NOVA VERSÃO — ATUALIZAR');
    (b as HTMLButtonElement).type = 'button';
    b.addEventListener('click', () => {
      this.cb.onClick();
      b.remove();
      this.updatePill = null;
      onOpen?.();
      this.showUpdate(apply);
    });
    this.root.append(b);
    this.updatePill = b;
  }

  showResults(d: ResultData) {
    this.results.innerHTML = '';
    const t = el('div', 'title', 'FASE COMPLETA!');
    const rk = el('div', 'rank', d.rank);
    const st = el('div', 'stats');
    const stat = (v: string, l: string) => {
      const s = el('div', 'stat', `<b>${v}</b><span>${l}</span>`);
      st.append(s);
    };
    stat(formatTime(d.time), 'TEMPO');
    stat(String(d.score).padStart(7, '0'), 'PONTUAÇÃO');
    stat(String(d.tokens), 'FICHAS');
    stat(`${d.emblems} / 10`, 'EMBLEMAS');
    stat(`${d.secrets} / 3`, 'ORELHAS DOURADAS');
    stat(`${d.kills}`, 'INIMIGOS DERROTADOS');
    if (d.bestCombo) stat(`${d.bestCombo}`, 'MAIOR COMBO');
    const rec = el('div', '', d.newBest ? '<b style="color:#ffe27a">★ NOVO RECORDE! ★</b>' : `Recorde: ${String(progress.bestScore).padStart(7, '0')}`);
    rec.style.fontWeight = '700';
    const btns = el('div', 'btns');
    btns.style.width = 'min(360px, 80vw)';
    btns.style.flexDirection = 'row';
    btns.append(this.btn('JOGAR DE NOVO', 'primary small', () => this.cb.onPlayAgain()), this.btn('MENU', 'alt small', () => this.cb.onQuitToMenu()));
    this.results.append(t, rk, st, rec, btns);
    this.results.classList.remove('hidden');
    this.collectFocus(btns);
  }

  showRotate(v: boolean) {
    this.rotate.classList.toggle('hidden', !v);
  }

  toast(msg: string) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('on');
    window.clearTimeout(this.toastT);
    this.toastT = window.setTimeout(() => this.toastEl.classList.remove('on'), 2000);
  }

  fade(on: boolean) {
    this.fadeEl.classList.toggle('on', on);
  }

  // ------------------------------------------------------------------ teclado/gamepad nos menus
  private collectFocus(scope: HTMLElement) {
    this.focusable = [...scope.querySelectorAll<HTMLElement>('.btn')];
    this.focusIdx = this.focusable.length ? 0 : -1;
    this.applyFocus();
  }
  private applyFocus() {
    this.focusable.forEach((b, i) => b.classList.toggle('focus', i === this.focusIdx));
  }
  /** Chamado com códigos de tecla enquanto um menu está aberto. Retorna true se consumiu. */
  handleKey(code: string): boolean {
    if (!this.focusable.length) return false;
    if (code === 'ArrowDown' || code === 'KeyS') {
      this.focusIdx = (this.focusIdx + 1) % this.focusable.length;
      this.applyFocus();
      return true;
    }
    if (code === 'ArrowUp' || code === 'KeyW') {
      this.focusIdx = (this.focusIdx - 1 + this.focusable.length) % this.focusable.length;
      this.applyFocus();
      return true;
    }
    if (code === 'Enter' || code === 'Space') {
      this.focusable[this.focusIdx]?.click();
      return true;
    }
    if (code === 'Escape' && this.panelOpen) {
      this.closePanel();
      return true;
    }
    return false;
  }
}
