/** Menus em DOM: carregamento, principal, configurações, controles, créditos, pausa, resultados, girar celular. */
import { settings, saveSettings, progress, type QualityPref } from '../core/storage';
import { DIFFICULTIES, DIFFICULTY_ORDER, difficulty } from '../core/difficulty';
const fmt=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:2});
import { formatTime } from '../core/math';
import { cloudSaves } from '../core/cloud';
import { applyProfile, captureProfile, exportBackup, validateProfile, preserveProfile, type ProfileData } from '../core/profile';
import { exportAllBackups, parseBackupChoices, MAX_ARCHIVE_BYTES } from '../core/backupArchive';
import { persistenceStatus, onPersist, profileKey, readStored } from '../core/persistence';
import { storageUsage } from '../core/storageUsage';
import { SKINS, skinPrice, type SkinId } from '../core/skinCatalog';
import { chooseSkin, coinBalance, ensureWallet } from '../core/skins';
import { getArt } from '../art';
import { drawKarimbo } from '../art/karimbo';
import { listSaveCopies } from '../game/saveSession';
import { loadSave, type SaveState } from '../game/save';
import { STAGES, stageCheckpoints, type StageId } from '../game/stageSelect';
import { GEAR, PERKS, karimboStats, perkLevel, reloadSeconds, UNLOCK_PRICE, type GearItem } from '../core/gearCatalog';
import { attributeBars, effectChips, pips, weaponCanvas } from './forgeShop';
import { buyGearWhenOpen, withWalletLock } from '../core/forge';
import { gearPreview } from '../core/gearPreview';
import { WEAPON_ORDER, WEAPONS, WEAPON_INFO, type WeaponId } from '../game/weapons';
import type { World } from '../game/world';
import { weaponReveal } from './weaponReveal';

export interface MenuCallbacks {
  onSelectStage(stage: StageId, save?: SaveState): void;
  onCancelStageStart(): void;
  /** voltar ao último checkpoint salvo no navegador */
  onContinueSave(): void;
  /** descartar o save (novo jogo) */
  onDiscardSave(): void;
  onSettingsChanged(): void;
  onResume(): void;
  onRestart(): void;
  onQuitToMenu(): void;
  onPlayAgain(): void;
  onContinueYes(): void;
  onContinueNo(): void;
  onClick(): void;
  onProfileChanged(): void;
}

export interface ResultData {
  nextStage?: number;
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
  private saveUnsubscribe: (() => void) | null = null;
  private shopBtn!: HTMLButtonElement;
  private merchantExit:(()=>void)|null=null;
  private weaponClose: (() => void) | null = null;
  private weaponOverlay: HTMLElement | null = null;
  get weaponOpen() { return this.weaponOverlay !== null; }

  showWeaponAcquired(id: WeaponId, gear: string[], onDone?: () => void) {
    const previousFocus = document.activeElement as HTMLElement | null;
    const background = this.panelOpen ? this.panel : this.pause;
    const close = () => {
      this.weaponOverlay?.remove(); this.weaponOverlay = null; this.weaponClose = null;
      background.inert = false;
      this.collectFocus(background);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      onDone?.();
    };
    const view = weaponReveal(id, gear, close);
    background.inert = true;
    this.weaponClose = close; this.weaponOverlay = view.overlay;
    this.root.append(view.overlay); this.collectFocus(view.overlay); view.button.focus();
  }

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
    const b = el('button', `btn ${cls}`.trim());
    b.textContent = label;
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
    wrap.append(el('div', 'title', 'KARIMBOLÂNDIA<span class="ver">.v6</span>'), el('div', 'sub', 'RUN &amp; GUN 2.5D'));
    const btns = el('div', 'btns');
    this.contBtn = this.btn('CONTINUAR', 'primary', () => this.cb.onContinueSave());
    this.contBtn.style.display = 'none';
    this.shopBtn = this.btn('LOJA DE SKINS', 'alt', () => this.showShop());
    btns.append(
      this.contBtn,
      this.btn('JOGAR', 'primary', () => this.showStages()),
      this.shopBtn,
      this.btn('SAVE E CONTA', 'alt', () => this.showSaves('main')),
      this.btn('CONFIGURAÇÕES', 'alt', () => this.showSettings('main')),
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
    const p = el('div', 'panel pause-panel');
    p.append(el('h2', '', 'PAUSADO'));
    const btns = el('div', 'btns');
    btns.append(
      this.btn('CONTINUAR', 'primary', () => this.cb.onResume()),
      this.btn('PERSONAGEM', 'alt', () => this.showShop('pause')),
      this.btn('SAVE E CONTA', 'alt', () => this.showSaves('pause')),
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
  private openPanel(content: HTMLElement, from: 'main' | 'pause', onBack?: () => void) {
    this.panelReturn = from;
    // voltar SEMPRE visível no canto superior esquerdo (antes ficava no fim do conteúdo, com rolagem)
    const back = el('button', 'btn back-fab', '<span class="arr">←</span> VOLTAR');
    (back as HTMLButtonElement).type = 'button';
    back.setAttribute('aria-label', 'Voltar');
    back.addEventListener('click', () => {
      this.cb.onClick();
      if (onBack) onBack();
      else this.closePanel();
    });
    this.panel.replaceChildren(back, content);
    this.panel.classList.remove('hidden');
    if (from === 'main') this.main.classList.add('hidden');
    else this.pause.classList.add('hidden');
    this.collectFocus(content);
  }

  closePanel() {
    if(this.merchantExit){const exit=this.merchantExit;this.merchantExit=null;this.saveUnsubscribe?.();this.saveUnsubscribe=null;this.panel.classList.add('hidden');exit();return;}
    if (this.panel.querySelector('.stage-picker')) this.cb.onCancelStageStart();
    this.saveUnsubscribe?.();
    this.saveUnsubscribe = null;
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

  showStages() {
    this.closeResume();
    const panel = el('div', 'panel stage-picker');
    panel.append(el('h2', '', 'ESCOLHA SUA AVENTURA'));
    const note = el('p', 'stage-picker-note', 'Escolha a fase e o ponto de partida.');
    panel.append(this.difficultyPicker());
    const cards = el('div', 'stage-cards');
    const current = loadSave();
    const previous = readStored(profileKey('karimbolandia.before-restore.v1'), validateProfile)?.save;
    const copies = listSaveCopies().map(copy => copy.save);
    if (previous) copies.push(previous);
    for (const stage of STAGES) {
      const saves = stageCheckpoints(stage.id, current, copies);
      const card = el('div', `stage-card stage-${stage.theme}`);
      const visual = el('div', 'stage-art');
      visual.setAttribute('aria-hidden', 'true');
      visual.innerHTML = stage.theme === 'city'
        ? `<svg viewBox="0 0 240 80"><circle cx="191" cy="25" r="19" fill="#925aff" opacity=".6"/><path d="M12 76V34h29v42M49 76V12h32v64M94 76V45h28v31M135 76V25h35v51M184 76V49h41v27" fill="#121b45" stroke="#50eaff" stroke-width="2"/><path d="M57 25h16m-16 13h16m-16 13h16M144 38h17m-17 13h17M20 48h14M193 60h23M0 78h240" stroke="#50eaff" stroke-width="2"/><path d="M0 6h40l10 8h66m124 50h-26l-10-8h-23" fill="none" stroke="#ed69ff" opacity=".7"/></svg>`
        : `<svg viewBox="0 0 240 80"><circle cx="120" cy="30" r="24" fill="#ffc45a" opacity=".35"/><path d="M59 77l14-14h10V50h13V37h15V25h18v12h15v13h13v13h10l14 14Z" fill="#937246" stroke="#f5ca79" stroke-width="2"/><path d="M110 77V56h20v21" fill="#253d24"/><path d="M5 0q38 27 15 80M236 0q-38 28-14 80M33 0q16 8 4 35" fill="none" stroke="#58b768" stroke-width="4"/><path d="M24 32Q0 10 3 42q16 8 21-10m-2 17q31-26 27 1-18 15-27-1m199-16q27-25 22 6-14 9-22-6m-1 23q-33-22-25 4 20 12 25-4" fill="#62ce75"/><path d="M88 64h62M100 49h40" stroke="#473c2d" stroke-width="3"/></svg>`;
      const tag = el('div', 'stage-tag', `FASE ${String(stage.id).padStart(2, '0')} · ${stage.tag}`);
      card.append(visual, tag, el('h3', '', stage.name), el('p', 'stage-description', stage.description));
      const label = el('label', 'stage-checkpoint-label', 'PONTO DE PARTIDA');
      const select = el('select', 'stage-checkpoint');
      select.id = `stage-checkpoint-${stage.id}`;
      label.htmlFor = select.id;
      select.setAttribute('aria-label', `Ponto de partida da Fase ${stage.id}`);
      const start = el('option');
      start.value = 'new'; start.textContent = 'Início — nova partida';
      select.append(start);
      saves.forEach((save, index) => {
        const option = el('option');
        option.value = String(index);
        option.textContent = `Continuar — ${save.cpName}`;
        select.append(option);
      });
      select.value = saves.length ? '0' : 'new';
      const details = el('p', 'stage-save-details');
      const selectedSave = () => select.value === 'new' ? undefined : saves[Number(select.value)];
      const launch = this.btn('', 'stage-launch', () => this.cb.onSelectStage(stage.id, selectedSave()));
      const update = () => {
        const save = selectedSave();
        details.textContent = save ? `${save.tokens} fichas · ${save.lives} vidas · progresso salvo` : 'Começar a fase desde o início';
        launch.textContent = `${save ? 'CONTINUAR' : 'JOGAR'} FASE ${stage.id}`;
        launch.setAttribute('aria-label', `${save ? 'Continuar' : 'Jogar'} Fase ${stage.id} — ${stage.name}`);
      };
      select.addEventListener('change', update);
      update();
      card.append(label, select, details, launch);
      cards.append(card);
    }
    panel.append(note, cards);
    this.openPanel(panel, 'main');
  }

  /** Três níveis lado a lado; vale para novas partidas (saves continuam no nível em que foram gravados). */
  private difficultyPicker() {
    const box = el('div', 'difficulty-picker');
    box.setAttribute('role', 'radiogroup');
    box.setAttribute('aria-label', 'Dificuldade');
    const info = el('p', 'difficulty-info');
    const buttons: HTMLButtonElement[] = [];
    const paint = () => {
      const d = DIFFICULTIES[settings.difficulty];
      buttons.forEach((b, i) => {
        const on = DIFFICULTY_ORDER[i] === settings.difficulty;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', String(on));
      });
      info.textContent = `${d.description} Inimigos ${Math.round(d.enemyHp * 100)}% de vida • dano recebido ${Math.round(d.playerDmg * 100)}%${d.eliteChance ? ` • elites ${Math.round(d.eliteChance * 100)}%` : ''}.`;
    };
    for (const id of DIFFICULTY_ORDER) {
      const d = DIFFICULTIES[id];
      const b = this.btn('', `difficulty-option diff-${id}`, () => {
        settings.difficulty = id;
        saveSettings();
        paint();
      });
      b.setAttribute('role', 'radio');
      b.append(el('strong', '', d.label), el('small', '', d.tag));
      buttons.push(b);
    }
    const row = el('div', 'difficulty-row');
    row.append(...buttons);
    box.append(el('span', 'difficulty-title', 'DIFICULDADE'), row, info);
    paint();
    return box;
  }

  setStageLoading(loading: boolean) {
    const panel = this.panel.querySelector('.stage-picker');
    if (!panel) return;
    panel.setAttribute('aria-busy', String(loading));
    panel.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('.stage-launch, select').forEach(control => { control.disabled = loading; });
    panel.querySelector('.stage-picker-note')!.textContent = loading ? 'Preparando a selva… Você pode voltar para cancelar.' : 'Escolha a fase e o ponto de partida.';
  }

  showSettings(from: 'main' | 'pause') {
    const c = el('div', 'panel settings-panel');
    c.append(el('h2', '', 'CONFIGURAÇÕES'));
    const audio = el('div', 'settings-group active');
    const game = el('div', 'settings-group');
    const touch = el('div', 'settings-group');
    const tabs = el('div', 'settings-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Categorias de configurações');
    const groups = [audio, game, touch];
    ['SOM', 'JOGO', 'TOQUE'].forEach((label, index) => {
      const tab = this.btn(label, 'alt small', () => {
        groups.forEach((group, i) => group.classList.toggle('active', i === index));
        [...tabs.children].forEach((button, i) => button.setAttribute('aria-selected', String(i === index)));
      });
      tab.id = `settings-tab-${index}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(index === 0));
      tab.setAttribute('aria-controls', `settings-group-${index}`);
      groups[index].id = `settings-group-${index}`;
      groups[index].setAttribute('role', 'tabpanel');
      groups[index].setAttribute('aria-labelledby', tab.id);
      tabs.append(tab);
    });
    const nav = el('div', 'settings-nav');
    nav.append(tabs, this.btn('CONTROLES', 'alt small settings-controls', () => this.showControls(from, true)));
    c.append(nav, ...groups);
    audio.append(
      this.slider('Música', () => settings.music, (v) => (settings.music = v)),
      this.slider('Efeitos sonoros', () => settings.sfx, (v) => (settings.sfx = v)),
      this.toggle('Narrador da história', () => settings.narrator, (v) => (settings.narrator = v))
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
    game.append(qrow);
    touch.append(
      this.slider('Tamanho dos botões (toque)', () => settings.touchScale, (v) => (settings.touchScale = v), 0.7, 1.4, 0.05),
      this.slider('Opacidade dos botões (toque)', () => settings.touchOpacity, (v) => (settings.touchOpacity = v), 0.2, 0.9, 0.05),
      this.toggle('Modo canhoto (inverte os botões)', () => settings.leftHanded, (v) => (settings.leftHanded = v))
    );
    game.append(
      this.toggle('Assistência de mira (toque/teclado)', () => settings.aimAssist, (v) => (settings.aimAssist = v)),
      this.toggle('Vibração (celular / controle)', () => settings.haptics, (v) => (settings.haptics = v)),
      this.toggle('Tremor de tela', () => settings.screenShake, (v) => (settings.screenShake = v)),
      this.toggle('Mostrar FPS', () => settings.showFps, (v) => (settings.showFps = v))
    );
    this.openPanel(c, from);
  }

  showControls(from: 'main' | 'pause', settingsReturn = false) {
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
      <div class="k"><span>Recarregar / mercador</span><span><kbd>R</kbd> / <kbd>F</kbd> • controle: R3 / Select</span></div>
      <div class="k"><span>Especial (Nômad)</span><span><kbd>SHIFT</kbd></span></div>
      <div class="k"><span>Descer da plataforma</span><span><kbd>S</kbd> + <kbd>ESPAÇO</kbd></span></div>
      <div class="k"><span>Pausar</span><span><kbd>ESC</kbd></span></div>`
      )
    );
    c.append(
      el('p', '', '<b>Celular:</b> joystick à esquerda só para andar, agachar e descer; para mirar, <b>arraste o botão FOGO</b> na direção desejada; botões à direita: <b>FOGO</b>, <b>PULO</b> (toque de novo no ar para planar), granada, especial e troca de arma. Dá para mover, pular e atirar ao mesmo tempo.'),
      el('p', '', '<b>Gamepad:</b> analógico esquerdo mover • analógico direito mirar • A pular • X/RT atirar • B granada • Y especial • LB/RB trocar arma • Start pausa.')
    );
    const act = el('div', 'actions');

    c.append(act);
    this.openPanel(c, from, settingsReturn ? () => this.showSettings(from) : undefined);
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
  /** Trajes do Karimbo. Na pausa vira o menu PERSONAGEM: troca de traje no meio da partida. */
  showShop(from: 'main' | 'pause' = 'main') {
    ensureWallet();
    const panel = el('div', 'panel skin-shop');
    panel.append(el('h2', '', from === 'pause' ? 'PERSONAGEM • TRAJES' : 'TRAJES DO KARIMBO'));
    const balance = el('p', 'shop-balance');
    balance.setAttribute('role', 'status');
    const note = el('p', 'shop-note', 'Junte moedas na cidade e na selva. Saldo e trajes ficam guardados entre partidas. O traje de mergulho (Sivirino) e o Atlante (relíquias de Atlântida) têm poderes.');
    const cards = el('div', 'skin-cards');
    panel.append(balance, note, cards);
    const update = () => {
      ensureWallet();
      balance.textContent = `${coinBalance()} MOEDAS • ${progress.ownedSkins.length + 1}/${SKINS.length} TRAJES`;
      cards.replaceChildren();
      for (const skin of SKINS) {
        const owned = skin.id === 'classic' || progress.ownedSkins.includes(skin.id);
        const equipped = progress.equippedSkin === skin.id;
        const card = el('article', 'skin-card' + (equipped ? ' equipped' : ''));
        card.style.setProperty('--skin-color', skin.color);
        const viaSivirino = skin.shop === 'sivirino', viaRelics = skin.shop === 'relics';
        card.append(el('span', 'skin-tag', equipped ? 'EQUIPADO' : owned ? 'SEU TRAJE' : viaRelics ? 'EXCLUSIVO' : viaSivirino ? `SIVIRINO • ${skin.price}` : `${skin.price} MOEDAS`));
        const canvas = el('canvas', 'skin-preview');
        canvas.width = 320; canvas.height = 330;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `Karimbo ${skin.name}`);
        const g = canvas.getContext('2d')!;
        g.scale(3.2, 3.2);
        drawKarimbo(g, getArt().karimbo, 50, 97, {
          facing: 1, state: 'idle', t: 0, runPhase: 0, speed01: 0, aim: 0,
          weapon: 'pistol', kick: 0, flash: false, earGlide: 0, vy: 0, alpha: 1, hasGun: false, suit: skin.id === 'diver' ? 1 : 0,
        }, skin.id);
        card.append(canvas, el('h3', '', skin.name));
        if (skin.perk) card.append(el('p', 'skin-perk', `✦ ${skin.perk}`));
        const description = el('p', 'skin-description');
        description.textContent = skin.description;
        const affordable = coinBalance() >= skin.price;
        const lockedText = viaRelics ? `RELÍQUIAS ${progress.relics.length}/5` : 'COMPRE COM O SIVIRINO';
        const action = this.btn(equipped ? 'EQUIPADO' : owned ? `USAR ${skin.name.toUpperCase()}` : viaRelics || viaSivirino ? lockedText : `COMPRAR • ${skin.price}`, owned ? 'alt small' : 'primary small', () => {
          void withWalletLock(()=>chooseSkin(skin.id)).then(result=>{
          if (result === 'locked') this.toast(viaRelics ? 'Ache as 5 relíquias de Atlântida para vestir o Atlante.' : 'O traje de mergulho só se compra com o Sivirino, na oficina.');
          else if (result === 'insufficient') this.toast('Ainda faltam moedas para este traje.');
          else if (result === 'volatile') this.toast('Traje disponível nesta sessão. Baixe um backup: não foi possível gravar no aparelho.');
          else this.toast(result === 'bought' ? `${skin.name} comprado e equipado!` : `${skin.name} equipado!`);
          update();
          }).catch(()=>this.toast('A conta mudou. Abra a loja novamente antes de comprar.'));
        });
        action.disabled = equipped || (!owned && (!affordable || viaRelics || viaSivirino));
        action.setAttribute('aria-label', equipped ? `${skin.name} equipado` : owned ? `Usar ${skin.name}` : `Comprar ${skin.name} por ${skin.price} moedas`);
        card.append(description, action);
        if (!owned && !affordable && !viaRelics && !viaSivirino) card.append(el('small', 'skin-shortfall', `Faltam ${skin.price - coinBalance()} moedas`));
        cards.append(card);
      }
      this.shopBtn.textContent = `LOJA DE SKINS • ${coinBalance()} MOEDAS`;
      this.collectFocus(panel);
    };
    this.openPanel(panel, from);
    update();
    const persisted = onPersist(() => update());
    const changed = () => update();
    window.addEventListener('storage', changed);
    this.saveUnsubscribe = () => { persisted(); window.removeEventListener('storage', changed); };
  }

  /** Save portátil funciona mesmo sem serviço de contas e sem internet. */
  showMerchant(w:World,onChange:()=>void) {
    this.saveUnsubscribe?.();this.saveUnsubscribe=null;
    const player=w.player;
    ensureWallet();
    const panel=el('div','panel forge-shop');
    const head=el('header','forge-head');
    const title=el('h2','','SIVIRINO • OFICINA');
    const balance=el('p','shop-balance');balance.setAttribute('role','status');
    const close=this.btn('FECHAR','alt small forge-close',()=>this.closePanel());
    close.setAttribute('aria-label','Fechar oficina');
    head.append(title,balance,close);
    const list=el('div','forge-list');list.setAttribute('role','tablist');list.setAttribute('aria-label','Armas');
    const detail=el('section','forge-detail');
    const status=el('p','forge-message','Armas compradas são suas: descarregam, mas voltam ao achar munição.');status.setAttribute('role','status');
    const body=el('div','forge-body');body.append(list,detail);
    panel.append(head,body,status);
    const isOpen=()=>panel.isConnected&&!this.panel.classList.contains('hidden');
    let selected:WeaponId|'traje'|'karimbo'=player.cur;
    let purchaseFocus:string|undefined;
    const thumbs=new Map(WEAPON_ORDER.map(id=>[id,weaponCanvas(id,74,30,3)]));
    const hero=new Map<WeaponId,HTMLCanvasElement>();
    const ownsWeapon=(id:WeaponId)=>id==='pistol'||player.weapons.has(id)||progress.gear.includes(`${id}.unlock.1`);
    const levelOf=(id:WeaponId,kind:string)=>progress.gear.filter(x=>x.startsWith(`${id}.${kind}.`)).length;
    const buy=(item:GearItem,button:HTMLButtonElement)=>{
      purchaseFocus=item.kind;button.disabled=true;
      void buyGearWhenOpen(item.id,player.weapons,isOpen).then(result=>{
        if(result==='cancelled'||!isOpen())return;
        if(result==='bought'||result==='volatile') {
          if(item.weapon!=='karimbo'&&item.kind==='unlock'&&!player.weapons.has(item.weapon))player.giveWeapon(item.weapon,w);
          if(item.weapon==='karimbo')player.applyPerks(true);
          onChange();
        }
        status.textContent=result==='bought'?(item.weapon==='karimbo'?`${item.label}: o Karimbo já sentiu a diferença!`:item.kind==='unlock'?`${WEAPONS[item.weapon].name} é sua! Volta sempre que achar munição.`:`${item.label} instalado. Sinta a diferença no próximo tiro!`):result==='volatile'?'Compra nesta sessão. Baixe um backup: o aparelho não conseguiu salvar.':result==='insufficient'?'Faltam moedas.':result==='locked'?'Adquira a arma ou a melhoria anterior primeiro.':'Você já tem esta melhoria.';
        update();
      }).catch(()=>{if(isOpen())status.textContent='A conta mudou. Feche e abra a oficina novamente.';});
    };
    const update=()=>{
      const focused=document.activeElement as HTMLElement|null;
      const focusedKind=focused?.closest<HTMLElement>('.forge-track')?.dataset.kind??(focused?.closest('.forge-tab')?'tab':undefined)??(focused===document.body?purchaseFocus:undefined);
      purchaseFocus=undefined;
      ensureWallet();
      const coins=coinBalance();
      balance.textContent=`${coins} MOEDAS`;
      list.replaceChildren();
      for(const id of WEAPON_ORDER){
        const info=WEAPON_INFO[id],owned=ownsWeapon(id),ammo=player.weapons.get(id);
        const tab=el('button','forge-tab'+(id===selected?' on':''));tab.type='button';
        tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(id===selected));
        tab.style.setProperty('--tier',info.tierColor);
        const state=id==='pistol'?'INFINITA':owned?(ammo===0?'VAZIA':player.cur===id?'EQUIPADA':'SUA'):`● ${UNLOCK_PRICE[id]}`;
        tab.setAttribute('aria-label',`${WEAPONS[id].name}, ${owned?state:`${UNLOCK_PRICE[id]} moedas`}`);
        const navName=id==='launcher'?'LANÇA':WEAPONS[id].name;
        tab.append(thumbs.get(id)!,el('strong','',navName),el('small',owned?'owned':coins>=UNLOCK_PRICE[id]?'afford':'',state));
        tab.addEventListener('click',()=>{this.cb.onClick();selected=id;status.textContent=WEAPON_INFO[id].lore;update();});
        list.append(tab);
      }
      for(const special of ['traje','karimbo'] as const){
        const owned=special==='karimbo'||progress.ownedSkins.includes('diver');
        const tab=el('button','forge-tab'+(special===selected?' on':''));tab.type='button';
        tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(special===selected));
        tab.style.setProperty('--tier',special==='traje'?'#4fb3ff':'#ffd23a');
        const state=special==='karimbo'?`${progress.gear.filter(g=>g.startsWith('karimbo.')).length}/7`:owned?(progress.equippedSkin==='diver'?'VESTIDO':'SEU'):`● ${skinPrice('diver')}`;
        tab.append(karimboCanvas(special==='traje'?'diver':progress.equippedSkin,special==='traje'?1:0,74,30),el('strong','',special==='traje'?'TRAJE':'KARIMBO'),el('small',owned?'owned':coins>=skinPrice('diver')?'afford':'',state));
        tab.addEventListener('click',()=>{this.cb.onClick();selected=special;status.textContent=special==='traje'?'Sem traje, o ar acaba e a pressão do fundo não perdoa. Com ele, Atlântida é sua.':'Tunar o Karimbo vale para todas as fases e partidas.';update();});
        list.append(tab);
      }
      if(selected==='traje'||selected==='karimbo'){
        const sel=selected;
        const top=el('div','forge-hero');top.style.setProperty('--tier',sel==='traje'?'#4fb3ff':'#ffd23a');
        const name=el('div','forge-name');
        const st=karimboStats(progress.gear);
        if(sel==='traje'){
          name.append(el('span','forge-tier','ÉPICO'),el('h3','','TRAJE DE MERGULHO'),el('p','forge-role','Respira debaixo da água'));
          name.append(el('p','forge-facts','Sem barra de ar • lanterna no capacete • pressão do fundo não afeta'));
        } else {
          name.append(el('span','forge-tier','PERSONAGEM'),el('h3','','KARIMBO'),el('p','forge-role','Melhorias permanentes'));
          name.append(el('p','forge-facts',`Vida ${st.hp} • Ar ${fmt(st.air)} s • Granadas ${st.nades} • Nado ×${fmt(st.swim)}`));
        }
        top.append(karimboCanvas(sel==='traje'?'diver':progress.equippedSkin,sel==='traje'?1:0,124,64),name);
        const stats=el('div','forge-stats-box');
        const lore=el('ul','forge-perks');
        const lines=sel==='traje'
          ?['Mergulhe sem limite de ar e sem a pressão do fundo.','A cidade submersa de Atlântida fica no fundo do lago da selva.','Troque de traje no menu PERSONAGEM (pausa).']
          :['Vida: +20 por nível.','Fôlego: mais tempo debaixo da água sem traje.','Cinturão: mais granadas ao começar e ao voltar.','Nadadeira: nada 25% mais rápido.'];
        for(const line of lines)lore.append(el('li','',line));
        stats.append(lore);
        const tracks=el('div','forge-tracks');
        if(sel==='traje'){
          const owned=progress.ownedSkins.includes('diver'),worn=progress.equippedSkin==='diver',price=skinPrice('diver');
          const row=el('article','forge-track unlock');row.dataset.kind='traje';
          const label=el('div','forge-track-label');label.append(el('strong','',owned?(worn?'Traje vestido':'Vestir traje'):'Comprar traje'));
          const text=el('p','forge-preview',owned?(worn?'Troque no menu PERSONAGEM':'Seu para sempre • veste agora'):'Compra e já veste');
          const button=this.btn(owned?(worn?'EM USO':'VESTIR'):`${price}`,'small primary forge-buy',()=>{
            purchaseFocus='traje';button.disabled=true;
            void withWalletLock(()=>isOpen()?chooseSkin('diver','sivirino'):'invalid' as const).then(r=>{
              if(!isOpen())return;
              status.textContent=r==='bought'?'Traje comprado e vestido. O fundo do lago te espera!':r==='equipped'?'Traje vestido.':r==='insufficient'?`Faltam ${price-coinBalance()} moedas.`:r==='volatile'?'Traje nesta sessão. Baixe um backup: o aparelho não conseguiu salvar.':'Não foi possível comprar agora.';
              if(r==='bought'||r==='equipped'||r==='volatile')onChange();
              update();
            }).catch(()=>{if(isOpen())status.textContent='A conta mudou. Feche e abra a oficina novamente.';});
          });
          button.disabled=worn||(!owned&&coins<price);
          row.append(label,text,button);
          if(!owned&&coins<price)row.append(el('small','forge-shortfall',`faltam ${price-coins}`));
          tracks.append(row);
        } else for(const [kind] of PERKS){
          const options=GEAR.filter(x=>x.weapon==='karimbo'&&x.kind===kind);
          const item=options.find(x=>!progress.gear.includes(x.id))??options[options.length-1];
          const acquired=progress.gear.includes(item.id);
          const row=el('article','forge-track');row.dataset.kind=kind;
          const label=el('div','forge-track-label');label.append(el('strong','',item.label.replace(/ \d$/,'')),pips(perkLevel(progress.gear,kind),options.length));
          const text=el('p',acquired?'':'forge-preview',acquired?'Nível máximo':gearPreview(item,progress.gear));
          const button=this.btn(acquired?'MÁX':`${item.price}`,'small alt forge-buy',()=>buy(item,button));
          button.disabled=acquired||coins<item.price;
          row.append(label,text,button);
          if(!acquired&&coins<item.price)row.append(el('small','forge-shortfall',`faltam ${item.price-coins}`));
          tracks.append(row);
        }
        detail.replaceChildren(top,stats,tracks);
        if (this.weaponOpen) return;
        this.collectFocus(panel);
        const restoreFocus=focusedKind==='tab'?list.querySelector<HTMLButtonElement>('.forge-tab.on'):focusedKind?tracks.querySelector<HTMLButtonElement>(`[data-kind="${focusedKind}"] button:not(:disabled)`)??list.querySelector<HTMLButtonElement>('.forge-tab.on'):null;
        if(restoreFocus){this.focusIdx=this.focusable.indexOf(restoreFocus);this.applyFocus();restoreFocus.focus({preventScroll:true});}
        return;
      }
      const id=selected,info=WEAPON_INFO[id],owned=ownsWeapon(id),d=player.weaponDef(id);
      if(!hero.has(id))hero.set(id,weaponCanvas(id,200,74,4));
      const top=el('div','forge-hero');top.style.setProperty('--tier',info.tierColor);top.dataset.weapon=id;
      const name=el('div','forge-name');
      name.append(el('span','forge-tier',info.tier),el('h3','',WEAPONS[id].name),el('p','forge-role',info.role));
      const facts=el('p','forge-facts');
      const total=player.weapons.get(id);
      facts.textContent=`Recarga ${fmt(reloadSeconds(id))} s${owned&&total!==undefined?` • munição ${total===Infinity?'∞':total}`:''}${d.explosive?` • explosão ${fmt(d.explosive.dmg)}`:''}${d.pierce?` • perfura ${d.pierce}`:''}`;
      name.append(facts);
      top.append(hero.get(id)!,name);
      const stats=el('div','forge-stats-box');
      // prévia: só as barras mudam (o resto da tela fica parado sob o ponteiro)
      const renderStats=(item?:GearItem)=>stats.replaceChildren(attributeBars(id,progress.gear,item?[...progress.gear,item.id]:undefined),effectChips(id,difficulty().armorWeight));
      renderStats();
      const tracks=el('div','forge-tracks');
      for(const kind of ['unlock','damage','rate','mag','scope','pierce']) {
        if(kind==='unlock'&&(id==='pistol'||progress.gear.includes(`${id}.unlock.1`)))continue;
        const options=GEAR.filter(x=>x.weapon===id&&x.kind===kind);
        const item=options.find(x=>!progress.gear.includes(x.id))??options[options.length-1];
        const acquired=progress.gear.includes(item.id),allowed=kind==='unlock'||owned;
        const row=el('article','forge-track'+(kind==='unlock'?' unlock':''));row.dataset.kind=kind;
        const label=el('div','forge-track-label');
        label.append(el('strong','',kind==='unlock'?(player.weapons.has(id)?'Guardar arma':'Comprar arma'):kind==='pierce'?'Perfuração':item.label.replace(/ \d$/,'')));
        if(kind!=='unlock')label.append(pips(levelOf(id,kind),options.length));
        const text=el('p',acquired?'':'forge-preview');
        text.textContent=acquired?'Nível máximo':!allowed?'Requer a arma':kind==='unlock'&&player.weapons.has(id)?'Permanente • mantém munição':gearPreview(item,progress.gear).replace('Já sem dispersão','Sem dispersão');
        const button=this.btn(acquired?'MÁX':`${item.price}`,'small '+(kind==='unlock'?'primary':'alt')+' forge-buy',()=>buy(item,button));
        button.disabled=acquired||!allowed||coins<item.price;
        if(!acquired&&allowed&&coins<item.price)button.title=`Faltam ${item.price-coins} moedas`;
        button.setAttribute('aria-label',acquired?`${item.label} no máximo`:`Comprar ${item.label} por ${item.price} moedas`);
        if(!acquired&&allowed){
          row.addEventListener('pointerenter',()=>renderStats(item));
          row.addEventListener('pointerleave',()=>renderStats());
          button.addEventListener('focus',()=>renderStats(item));
          button.addEventListener('blur',()=>renderStats());
        }
        row.append(label,text,button);
        if(!acquired&&allowed&&coins<item.price)row.append(el('small','forge-shortfall',`faltam ${item.price-coins}`));
        tracks.append(row);
      }
      detail.replaceChildren(top,stats,tracks);
      if (this.weaponOpen) return;
      this.collectFocus(panel);
      const restoreFocus=focusedKind==='tab'
        ? list.querySelector<HTMLButtonElement>('.forge-tab.on')
        : focusedKind
          ? tracks.querySelector<HTMLButtonElement>(`[data-kind="${focusedKind}"] button:not(:disabled)`)??list.querySelector<HTMLButtonElement>('.forge-tab.on')
          : null;
      if(restoreFocus){this.focusIdx=this.focusable.indexOf(restoreFocus);this.applyFocus();restoreFocus.focus({preventScroll:true});}
    };
    this.openPanel(panel,'pause');this.merchantExit=()=>this.cb.onResume();update();
    let pending=false;
    const changed=()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;if(isOpen())update();});};
    const unsubscribe=onPersist(changed);window.addEventListener('storage',changed);
    this.saveUnsubscribe=()=>{unsubscribe();window.removeEventListener('storage',changed);};
  }

  showSaves(from: 'main' | 'pause' = 'main') {
    this.saveUnsubscribe?.();
    const panel = el('div', 'panel save-panel');
    panel.append(el('h2', '', 'SEU PROGRESSO'));
    const local = el('p', 'save-status');
    local.setAttribute('role', 'status');
    const account = el('p', 'save-account');
    const remote = el('p', 'save-status');
    remote.setAttribute('role', 'status');
    const details = el('p', 'save-details');
    const buttons = el('div', 'btns');
    const login = this.btn('ENTRAR COM GOOGLE', 'primary', () => { void cloudSaves.login(); });
    const sync = this.btn('SINCRONIZAR AGORA', 'alt', () => { void cloudSaves.sync(); });
    const logout = this.btn('SAIR DA CONTA', 'alt small', () => { void cloudSaves.logout(); });
    const conflicts = el('div', 'save-conflicts');
    const copies = el('div', 'save-copies');
    let copyPage = 0;
    const pageSize = 4;
    const downloadText = (text: string, all = false) => {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `karimbolandia-${all ? 'partidas-' : ''}${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      this.toast('Backup pronto. Guarde o arquivo para recuperar seu progresso.');
    };
    const downloadData = (data?: ProfileData) => downloadText(exportBackup(data));
    const download = this.btn('BAIXAR BACKUP', 'primary', () => downloadData());
    const downloadAll = this.btn('BAIXAR TODAS AS PARTIDAS', 'alt', () => {
      try { downloadText(exportAllBackups(), true); }
      catch (error) { this.toast(error instanceof Error ? error.message : 'Não foi possível preparar o arquivo.'); }
    });
    const file = el('input', 'save-file');
    file.type = 'file';
    file.accept = '.json,application/json';
    file.setAttribute('aria-label', 'Escolher backup do Karimbolândia');
    const preview = el('div', 'save-preview');
    const describe = (data: ProfileData) => data.save
      ? `Fase ${data.save.stage} • ${data.save.cpName} • ${data.save.tokens} fichas • ${data.save.score} pontos`
      : `Sem partida em andamento • recorde ${data.progress.bestScore} • ${data.progress.completed} fases concluídas`;
    const confirmRestore = (data: ProfileData, label = 'RESTAURAR ESTE BACKUP', onCancel?: () => void) => {
      preview.replaceChildren();
      const text = el('p');
      text.textContent = `${describe(data)}. Restaurar substitui a partida deste perfil e guarda uma cópia da atual.`;
      preview.append(text, this.btn(label, 'primary', () => {
        const durable = applyProfile(data);
        this.cb.onProfileChanged();
        this.showSaves('main');
        this.toast(durable ? 'Backup restaurado. Use CONTINUAR para jogar.' : 'Restaurado em memória. Baixe um backup: este navegador não conseguiu gravar.');
      }), this.btn('CANCELAR', 'alt small', () => { if (onCancel) onCancel(); else { preview.replaceChildren(); this.collectFocus(panel); } }));
      this.collectFocus(panel);
      preview.querySelector<HTMLButtonElement>('button')?.focus();
      preview.scrollIntoView({ block: 'nearest' });
    };
    file.addEventListener('change', async () => {
      const selected = file.files?.[0];
      if (!selected) return;
      try {
        if (selected.size > MAX_ARCHIVE_BYTES) throw new Error('Arquivo grande demais. Escolha um backup do jogo.');
        const text = await selected.text();
        if (!panel.isConnected || this.panel.classList.contains('hidden')) return;
        const choices = parseBackupChoices(text);
        if (choices.length === 1) confirmRestore(choices[0].data);
        else {
          let page = 0;
          const showChoices = () => {
            preview.replaceChildren(el('h3', '', 'ESCOLHA UMA PARTIDA DO ARQUIVO'),
              el('p', 'save-note', `${choices.length} partidas disponíveis. Seus dados só mudam depois da confirmação.`));
            for (const [offset, choice] of choices.slice(page * pageSize, (page + 1) * pageSize).entries()) {
              const label = choice.kind === 'current' ? 'ATUAL' : choice.kind === 'previous' ? 'ANTES DA RESTAURAÇÃO' : 'GUARDADA';
              preview.append(this.btn(`${page * pageSize + offset + 1} • ${label} • ${describe(choice.data)}`, 'alt small', () => confirmRestore(choice.data, 'RESTAURAR ESTA PARTIDA', showChoices)));
            }
            addPages(preview, page, Math.ceil(choices.length / pageSize), next => { page = next; showChoices(); });
            preview.append(this.btn('CANCELAR IMPORTAÇÃO', 'alt small', () => { preview.replaceChildren(); this.collectFocus(panel); }));
            this.collectFocus(panel);
            preview.querySelector<HTMLButtonElement>('button')?.focus();
          };
          showChoices(); preview.scrollIntoView({ block: 'nearest' });
        }
      } catch (error) {
        preview.replaceChildren();
        const text = el('p');
        text.setAttribute('role', 'alert');
        text.textContent = error instanceof Error ? error.message : 'Não foi possível ler o backup.';
        preview.append(text);
        this.collectFocus(panel);
      } finally { file.value = ''; }
    });
    const restore = this.btn('RESTAURAR BACKUP', 'alt', () => file.click());
    const undo = this.btn('RECUPERAR SAVE ANTERIOR', 'alt small', () => {
      const data = readStored(profileKey('karimbolandia.before-restore.v1'), validateProfile);
      if (data) confirmRestore(data);
      else this.toast('Ainda não há uma restauração anterior neste perfil.');
    });
    buttons.append(login, sync, logout, download, downloadAll, restore, undo);
    panel.append(local, buttons, details, account, remote, conflicts, copies, file, preview);
    const note = el('p', 'save-note');
    note.textContent = 'A partida volta ao último checkpoint, com fichas, equipamentos e itens salvos. Baixar um backup também protege seu progresso se você limpar os dados do navegador.';
    panel.append(note);
    const usageInfo = el('details', 'save-note');
    const usageTitle = el('summary', '', 'ESPAÇO DOS SAVES');
    const usageText = el('p', '');
    usageInfo.append(usageTitle, usageText);
    panel.append(usageInfo);
    this.openPanel(panel, from);
    const addPages = (target: HTMLElement, page: number, total: number, go: (page: number) => void) => {
      if (total <= 1) return;
      const nav = el('div', 'save-pages');
      nav.setAttribute('aria-label', 'Páginas das partidas');
      const move = (nextPage: number, direction: number) => {
        go(nextPage);
        const buttons = [...target.querySelectorAll<HTMLButtonElement>('.save-pages button')];
        const preferred = buttons[direction > 0 ? 1 : 0];
        (preferred && !preferred.disabled ? preferred : buttons.find(button => !button.disabled))?.focus();
      };
      const prev = this.btn('ANTERIORES', 'alt small', () => move(page - 1, -1));
      const next = this.btn('PRÓXIMAS', 'alt small', () => move(page + 1, 1));
      prev.disabled = page === 0; next.disabled = page + 1 >= total;
      nav.append(prev, el('span', '', `${page + 1} / ${total}`), next); target.append(nav);
    };
    const update = () => {
      const data = captureProfile();
      const previous = readStored(profileKey('karimbolandia.before-restore.v1'), validateProfile);
      const status = persistenceStatus();
      local.textContent = status === 'volatile'
        ? 'Não foi possível gravar no aparelho. Baixe um backup antes de fechar o jogo.'
        : status === 'recovered' ? 'Uma cópia anterior foi recuperada. Baixe um backup por segurança.' : 'Seu progresso está salvo neste aparelho.';
      local.classList.toggle('warning', status !== 'saved');
      details.textContent = describe(data);
      const usage = storageUsage();
      const size = (bytes: number) => `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KiB`;
      usageText.textContent = usage.available
        ? `Saves deste perfil: ${size(usage.profileBytes)}. Total do jogo neste navegador: ${size(usage.totalBytes)}. Estimativa UTF-16, incluindo cópias; não indica espaço livre. Nenhuma partida é apagada aqui.`
        : 'O navegador não permitiu consultar o tamanho dos saves. Baixe um backup para proteger seu progresso.';
      account.textContent = cloudSaves.user ? `Conta: ${cloudSaves.user.email ?? 'Google'}` : 'Jogando neste aparelho';
      remote.textContent = cloudSaves.state === 'unconfigured'
        ? 'O login ainda não está disponível nesta versão. Você já pode baixar e restaurar backups.' : cloudSaves.message;
      login.hidden = !!cloudSaves.user || !cloudSaves.available;
      sync.hidden = logout.hidden = !cloudSaves.user;
      sync.disabled = cloudSaves.state === 'syncing' || cloudSaves.state === 'conflict';
      login.disabled = cloudSaves.state === 'loading' || cloudSaves.state === 'syncing';
      undo.hidden = !previous;
      conflicts.replaceChildren();
      copies.replaceChildren();
      const savedCopies = listSaveCopies();
      copyPage = Math.min(copyPage, Math.max(0, Math.ceil(savedCopies.length / pageSize) - 1));
      if (savedCopies.length) {
        copies.append(el('h3', '', `PARTIDAS GUARDADAS • ${savedCopies.length}`), el('p', 'save-note', 'Estas cópias preservam partidas de outras abas e sessões. Baixe todas em um único arquivo ou escolha uma abaixo.'));
        for (const copy of savedCopies.slice(copyPage * pageSize, (copyPage + 1) * pageSize)) {
          const row = el('div', 'save-copy');
          const date = new Date(copy.save.savedAt);
          const when = Number.isNaN(date.getTime()) ? '' : ` • ${date.toLocaleString('pt-BR')}`;
          const copyDetails = el('p', 'save-details');
          copyDetails.textContent = `${describe({ ...data, save: copy.save })}${when}`;
          row.append(copyDetails,
            this.btn(`RECUPERAR • FASE ${copy.save.stage} • ${copy.save.cpName}`, 'alt small', () => {
              confirmRestore({ ...captureProfile(), save: copy.save }, 'RECUPERAR ESTA PARTIDA');
            }), this.btn(`BAIXAR BACKUP • FASE ${copy.save.stage} • ${copy.save.cpName}`, 'alt small', () => {
              downloadData({ ...captureProfile(), save: copy.save });
            }));
          copies.append(row);
        }
        addPages(copies, copyPage, Math.ceil(savedCopies.length / pageSize), next => { copyPage = next; update(); });
      }
      if (cloudSaves.conflict && cloudSaves.state === 'conflict') {
        const { remote: saved } = cloudSaves.conflict;
        const here = el('p'), there = el('p');
        here.textContent = `Neste aparelho: ${describe(captureProfile())}`;
        there.textContent = `Na conta: ${describe(saved.data)}`;
        conflicts.append(here, there,
          this.btn('CONTINUAR PARTIDA DO APARELHO', 'primary', () => { void cloudSaves.resolveConflict('local'); }),
          this.btn('CONTINUAR PARTIDA DA CONTA', 'alt', () => { void cloudSaves.resolveConflict('remote'); }));
      }
      this.collectFocus(panel);
    };
    let pending = false;
    const changed = () => {
      if (pending) return;
      pending = true;
      queueMicrotask(() => { pending = false; if (panel.isConnected && !this.panel.classList.contains('hidden')) update(); });
    };
    const unsubscribeCloud = cloudSaves.subscribe(changed);
    const unsubscribeLocal = onPersist(changed);
    window.addEventListener('storage', changed);
    this.saveUnsubscribe = () => { unsubscribeCloud(); unsubscribeLocal(); window.removeEventListener('storage', changed); };
  }

  setLoading(p: number, label: string) {
    this.bar.style.width = `${Math.round(p * 100)}%`;
    this.lbl.textContent = label;
  }
  hideLoading() {
    this.loading.classList.add('hidden');
  }
  showMain(footer = '') {
    this.hideAll();
    ensureWallet();
    const balance = `${coinBalance()} MOEDAS`;
    this.shopBtn.setAttribute('aria-label', `LOJA DE SKINS • ${balance}`);
    this.shopBtn.replaceChildren(el('span', '', 'LOJA DE SKINS'), el('span', 'menu-detail', balance));
    this.main.classList.remove('hidden');
    const copies = listSaveCopies().length;
    (document.getElementById('menu-foot') as HTMLElement).textContent = copies
      ? `${copies} partida${copies === 1 ? '' : 's'} guardada${copies === 1 ? '' : 's'} em SAVE E CONTA`
      : footer;
    this.collectFocus(this.main);
  }
  hideAll() {
    this.weaponOverlay?.remove(); this.weaponOverlay = null; this.weaponClose = null;
    this.panel.inert = this.pause.inert = false;
    this.merchantExit=null;
    this.saveUnsubscribe?.();
    this.saveUnsubscribe = null;
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
  private contBtn!: HTMLButtonElement;
  private resumeEl: HTMLElement | null = null;
  /** Mostra (ou esconde) o botão CONTINUAR do menu com a descrição do save. */
  setContinue(label: string | null) {
    if (!this.contBtn) return;
    this.contBtn.style.display = label ? '' : 'none';
    this.contBtn.setAttribute('aria-label', label ? `CONTINUAR • ${label}` : 'CONTINUAR');
    this.contBtn.replaceChildren(el('span', '', 'CONTINUAR'));
    if (label) {
      const detail = el('span', 'menu-detail');
      detail.textContent = label;
      this.contBtn.append(detail);
    }
  }

  closeResume() {
    this.resumeEl?.remove();
    this.resumeEl = null;
  }

  askNewGame(label: string, start: () => void) {
    this.closeResume();
    const overlay = el('div', 'overlay panel-back');
    overlay.id = 'resume';
    const panel = el('div', 'panel');
    panel.style.width = 'min(460px, calc(var(--game-width) - 28px))';
    const text = el('p');
    text.textContent = `Já existe uma partida: ${label}. Ao começar outra, seus recordes continuam e a partida atual fica em RECUPERAR SAVE ANTERIOR.`;
    panel.append(el('h2', '', 'COMEÇAR OUTRA PARTIDA?'), text);
    const buttons = el('div', 'btns');
    buttons.append(
      this.btn('CONTINUAR PARTIDA SALVA', 'primary', () => { this.closeResume(); this.cb.onContinueSave(); }),
      this.btn('COMEÇAR NOVA PARTIDA', 'alt', () => { this.closeResume(); start(); }),
      this.btn('VOLTAR', 'alt small', () => { this.closeResume(); this.collectFocus(this.panelOpen ? this.panel : this.main); })
    );
    panel.append(buttons); overlay.append(panel); this.root.append(overlay);
    this.resumeEl = overlay; this.collectFocus(overlay);
  }

  /** Ao abrir o jogo com um save: pergunta se quer voltar ao último checkpoint. */
  askResume(label: string) {
    if (this.resumeEl) return;
    const o = el('div', 'overlay panel-back');
    o.id = 'resume';
    const p = el('div', 'panel');
    p.style.width = 'min(420px, calc(var(--game-width) - 28px))';
    p.style.textAlign = 'center';
    const description = el('p');
    description.textContent = `Você tem um jogo salvo: ${label}. Quer voltar ao último checkpoint?`;
    p.append(el('h2', '', 'CONTINUAR?'), description);
    const btns = el('div', 'btns');
    const close = () => {
      o.remove();
      this.resumeEl = null;
      this.collectFocus(this.main);
    };
    btns.append(
      this.btn('VOLTAR AO CHECKPOINT', 'primary', () => {
        close();
        this.cb.onContinueSave();
      }),
      this.btn('NOVO JOGO', 'alt small', () => {
        close();
        preserveProfile();
        this.cb.onDiscardSave();
      }),
      this.btn('IR AO MENU', 'alt small', close)
    );
    p.append(btns);
    o.append(p);
    this.root.append(o);
    this.resumeEl = o;
    this.collectFocus(o);
  }

  showUpdate(apply: () => void, onLater?: () => void) {
    this.updatePill?.remove();
    this.updatePill = null;
    if (this.updateEl) return;
    const o = el('div', 'overlay panel-back');
    o.id = 'update';
    const p = el('div', 'panel');
    p.style.width = 'min(400px, calc(var(--game-width) - 28px))';
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
    btns.classList.add('result-actions');
    if (d.nextStage === 2) btns.append(this.btn('CONTINUAR NA SELVA', 'primary small', () => this.cb.onContinueSave()));
    btns.append(this.btn('JOGAR DE NOVO', d.nextStage ? 'alt small' : 'primary small', () => this.cb.onPlayAgain()), this.btn('MENU', 'alt small', () => this.cb.onQuitToMenu()));
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
    this.focusable = [...scope.querySelectorAll<HTMLElement>('.btn')].filter(b => !b.hidden && !(b as HTMLButtonElement).disabled && b.style.display !== 'none');
    this.focusIdx = this.focusable.length ? 0 : -1;
    this.applyFocus();
  }
  private applyFocus() {
    this.focusable.forEach((b, i) => b.classList.toggle('focus', i === this.focusIdx));
    this.focusable[this.focusIdx]?.focus({ preventScroll: true });
  }
  /** Chamado com códigos de tecla enquanto um menu está aberto. Retorna true se consumiu. */
  handleKey(code: string): boolean {
    if (code === 'Escape' && this.weaponClose) { this.weaponClose(); return true; }
    if (code === 'Escape' && this.resumeEl) {
      this.closeResume();
      this.collectFocus(this.panelOpen ? this.panel : this.main);
      return true;
    }
    if (code === 'Escape' && this.panelOpen) {
      this.panel.querySelector<HTMLButtonElement>('.back-fab')?.click();
      return true;
    }
    if (!this.focusable.length) return false;
    // Tab/click may have moved DOM focus independently of the gamepad cursor.
    const focused = this.focusable.indexOf(document.activeElement as HTMLElement);
    if (focused >= 0) this.focusIdx = focused;
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
    return false;
  }
}

/** Karimbo desenhado num canvas (oficina): traje e capacete de mergulho opcionais. */
function karimboCanvas(skin: SkinId, suit: number, w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  c.setAttribute('aria-hidden', 'true');
  const g = c.getContext('2d');
  if (g) {
    const k = (h * 2) / 74;
    g.scale(k, k);
    drawKarimbo(g, getArt().karimbo, (w * 2) / k / 2, 86, {
      facing: 1, state: 'idle', t: 0, runPhase: 0, speed01: 0, aim: 0,
      weapon: 'pistol', kick: 0, flash: false, earGlide: 0, vy: 0, alpha: 1, hasGun: false, suit,
    }, skin);
  }
  return c;
}
