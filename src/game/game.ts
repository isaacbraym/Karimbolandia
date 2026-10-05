import { orient } from '../core/orient';
import { setDifficulty } from '../core/difficulty';
import { Input } from '../core/input';
import { audio, type ClipHandle } from '../core/audio';
import { PostFX } from './post';
import { BossComic } from './comic';
import { IntroOverlay, INTRO_COMIC, INTRO_VOICE_AT } from './bossIntro';
import { bakeCivilians } from '../art/civilians';
import { bakeClubArt } from '../art/club';
import { OpeningOverlay } from './opening';
import { NARR_COUNT } from './narrator';
import { setDecoDensity } from '../art/decor';
import { music, MIX, type ThemeName } from '../core/music';
import { settings, progress, saveProgress } from '../core/storage';
import { clamp } from '../core/math';
import { buildArt, getArt, artReady, setArtStage, stageBg, type Quality } from '../art';
import { loadJungle, getJungle } from '../art/jungle';
import { buildJungle } from './level/jungle';
import { loadSave, clearSave, captureSave, applySave, nextStageSave, type SaveState } from './save';
import { SaveSession } from './saveSession';
import { World, type MusicState } from './world';
import { buildLevel } from './level/index';
import { Hud, setHudTextScale } from './hud';
import { MenuScene } from './menuScene';
import { Menus, computeRank } from '../ui/menus';
import { TouchUI } from '../ui/touch';
import { Investigation } from '../ui/investigation';
import type { ExplorationSpot } from './exploration';
import { hintText } from './hints';
import { VIEW_H } from './level';
import { cloudSaves } from '../core/cloud';
import { persistenceStatus, onPersist } from '../core/persistence';
import { FrameMetrics } from '../debug/performance';
import { preserveProfile } from '../core/profile';
import type { WeaponId } from './weapons';
import { FramePacer } from '../core/framePacing';
import { backingSize, resizeBacking, targetRenderHeight } from '../core/renderBudget';
import { InteriorFlow } from './interiorFlow';

type State = 'loading' | 'menu' | 'playing' | 'paused' | 'complete' | 'continue' | 'gameover' | 'comic';

const CONTINUE_SECS = 10;
/**
 * Piso da resolução dinâmica. A arte é assada em 3× e o canvas usa suavização 'low' (sem mipmaps):
 * abaixo de ~0,75 os sprites ficariam reduzidos a menos de 0,5× e serrilhariam.
 */
const DRS_MIN = 0.75;

/** resolução do fundo distante (fração da tela) por qualidade */
const BG_RES: Record<Quality, number> = { low: 0.55, medium: 0.65, high: 1 };
const CAPS: Record<Quality, { parts: number; density: number }> = {
  low: { parts: 620, density: 0.85 },
  medium: { parts: 760, density: 0.95 },
  high: { parts: 900, density: 1 },
};

export class Game {
  private investigation: Investigation | null = null;
  /** entrada/saída dos interiores jogáveis (o módulo pesado só carrega por import()) */
  private flow!: InteriorFlow;
  private flowPrefetchT = 0;
  private pendingWeapons: WeaponId[] = [];
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  ui: HTMLElement;
  input = new Input();
  touch!: TouchUI;
  menus!: Menus;
  hud = new Hud();
  world: World | null = null;
  menuScene: MenuScene | null = null;
  state: State = 'loading';
  viewW = 640;
  viewH = VIEW_H;
  pxScale = 2;
  quality: Quality = 'high';
  isTouch = false;
  private playRequest = 0;
  private last = 0;
  private pacer=new FramePacer();
  private acc = 0;
  private frameTimes: number[] = [];
  private lastQualityCheck = 0;
  private downgrades = 0;
  private lastFpsUpdate = 0;
  private frames = 0;
  private respawnPending = false;
  private continueLeft = 0;
  private continueTick = 0;
  private wasMusic: MusicState | 'menu' | null = null;
  private orientationBlocked = false;
  private hintsShown = new Set<string>();
  private lastMounted = false;
  /** tempos médios (ms) de simulação/render — útil para depurar desempenho */
  prof = { update: 0, render: 0 };
  private post = new PostFX();
  private bgCanvas: HTMLCanvasElement | null = null;
  private bgCtx: CanvasRenderingContext2D | null = null;
  private comic: BossComic | null = null;
  private comicTap = false;
  /** entrada do Felipão: camada de tela, áudio guiando a cena e toque para pular */
  private intro = new IntroOverlay();
  private introClip: ClipHandle | null = null;
  private introTap = false;
  /** narrador: fala tocando agora */
  private narrClip: ClipHandle | null = null;
  private narrId = -1;
  /** balada da fase 1: música em loop */
  private clubClip: ClipHandle | null = null;
  private opening = new OpeningOverlay();
  /** a abertura narrada só passa no começo de uma partida nova (não em QA com teleporte) */
  private noOpening = new URLSearchParams(location.search).has('tp');
  /** resolução dinâmica: fração da resolução alvo (DRS_MIN..1) — cai antes de qualquer efeito ser cortado */
  renderScale = 1;
  private drsAcc = 0;
  private drsN = 0;
  private drsGood = 0;
  private drsBad = 0;

  /** fase escolhida (1 = cidade, 2 = selva) */
  stage = new URLSearchParams(location.search).get('fase') === '2' ? 2 : 1;
  private base = './';
  private ambT = 3;
  private saveQueued = false;
  private storageWarningShown = false;
  private saveSession: SaveSession | null = null;
  private saveConflictShown = false;
  private metrics: FrameMetrics | null = null;

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.canvas = canvas;
    this.ui = ui;
    this.g = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
    this.isTouch = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window || new URLSearchParams(location.search).get('touch') === '1';
  }

  // ------------------------------------------------------------------ boot
  async boot(base: string) {
    this.base = base;
    const app = document.getElementById('app') as HTMLElement;
    this.input.attach(app);
    this.touch = new TouchUI(this.ui, this.input);
    this.flow = new InteriorFlow({
      canvas: this.canvas, input: this.input, quality: () => this.quality, view: () => ({ W: this.viewW, H: this.viewH }),
      touchMode: (on) => this.touch.setInterior(on),
      saved: () => { const w = this.world; if (w) { w.checkpointSnap = w.player.snapshot(); this.saveGame(); } },
      banner: (t, sub, d) => this.world?.hooks.onBanner?.(t, sub, d),
    });
    this.menus = new Menus(this.ui, {
      onSelectStage: (stage, save) => {
        if (!save) this.startNewGame(stage);
        else {
          if (save.stage !== stage) return;
          const current = loadSave();
          if (JSON.stringify(current) !== JSON.stringify(save)) preserveProfile();
          this.play(true, stage, save, new SaveSession(current));
        }
      },
      onCancelStageStart: () => this.cancelStageStart(),
      onContinueSave: () => this.continueSave(),
      onDiscardSave: () => {
        clearSave();
        this.refreshContinue();
      },
      onSettingsChanged: () => this.applySettings(),
      onResume: () => this.resume(),
      onRestart: () => this.restartLevel(),
      onQuitToMenu: () => this.toMenu(),
      onPlayAgain: () => this.play(true),
      onContinueYes: () => this.confirmContinue(),
      onContinueNo: () => this.declineContinue(),
      onClick: () => audio.play('uiClick', 0.8),
      onProfileChanged: () => this.profileChanged(),
    });
    if (new URLSearchParams(location.search).get('perf') === '1') this.metrics = new FrameMetrics(this.ui);
    cloudSaves.configureHooks({
      beforeSwitch: () => this.prepareProfileChange(),
      changed: () => this.profileChanged(),
      safeToApply: () => this.state === 'menu' || this.state === 'paused' || this.state === 'complete',
    });
    onPersist(() => {
      if (persistenceStatus() === 'volatile' && !this.storageWarningShown) {
        this.storageWarningShown = true;
        this.menus.toast('Não foi possível salvar no aparelho. Abra SAVE E CONTA e baixe um backup.');
      }
    });
    this.input.onGesture = () => {
      const unlocking = !audio.ctx;
      audio.init();
      // o tema pedido antes do primeiro clique (navegador bloqueia áudio) começa agora
      if (unlocking && audio.ctx && this.wasMusic) {
        const s = this.wasMusic;
        this.wasMusic = null;
        this.setMusic(s);
      }
      if (this.state === 'comic') this.comicTap = true;
      else if (this.state === 'playing' && (this.world?.director.longIntroActive() || this.world?.director.openingActive())) this.introTap = true;
    };
    this.input.onMenuKey = (code) => this.handleMenuKey(code);
    this.input.enabled = false;
    this.pickQuality();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => window.setTimeout(() => this.resize(), 250));
    const noPause = new URLSearchParams(location.search).get('nopause') === '1'; // QA
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing' && !noPause) this.pause();
      if (!document.hidden) {
        this.pacer.reset(this.last = performance.now());
        this.frames = 0;
        this.lastFpsUpdate = this.last;
        audio.wake();
      }
    });
    // voltando de outro app (celular): o áudio pode ter sido suspenso pelo sistema
    window.addEventListener('focus', () => audio.wake());
    window.addEventListener('pageshow', () => audio.wake());
    window.addEventListener('blur', () => {
      if (this.state === 'playing' && !noPause) this.pause();
    });
    window.addEventListener('pagehide', () => this.saveGame());
    // Nenhuma serialização/escrita/nuvem por quadro. O save periódico usa uma janela ociosa.
    window.setInterval(() => { if (this.state === 'playing') this.queueSave(); }, 20000);
    for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    // fontes antes de desenhar HUD
    try {
      await Promise.race([Promise.all([document.fonts.load('400 24px "Lilita One"'), document.fonts.load('700 14px Rajdhani')]), new Promise((r) => setTimeout(r, 2500))]);
    } catch {
      /* segue sem */
    }
    // vozes/entrada do chefe: baixadas junto com a arte (decodificadas no primeiro toque)
    const clips = audio.loadClips(base);
    // narrador: a primeira fala (abertura) chega junto; as outras baixam em segundo plano
    const narr = audio.loadNarration(base, NARR_COUNT);
    await buildArt(base, this.quality, (p, l) => this.menus.setLoading(p * 0.94, l));
    // moradores: só as aparências que existem na fase, assadas uma vez
    this.menus.setLoading(0.95, 'Chamando os moradores...');
    await new Promise((r) => setTimeout(r, 0));
    bakeCivilians(buildLevel().civilians.map((c) => c.look));
    bakeClubArt();
    this.intro.prepare();
    this.opening.prepare();
    this.menus.setLoading(0.98, 'Afinando as vozes...');
    await Promise.race([Promise.all([clips, narr]), new Promise((r) => setTimeout(r, 4000))]);
    this.menus.setLoading(1, 'Pronto!');
    this.hud.showFps = settings.showFps;
    this.menuScene = new MenuScene();
    this.menus.hideLoading();
    this.toMenu(true);
    this.applySettings();
    requestAnimationFrame((t) => this.frame(t));
    // jogo salvo no navegador: pergunta se quer voltar ao último checkpoint
    const sv = loadSave();
    if (sv && !new URLSearchParams(location.search).has('tp')) this.menus.askResume(this.saveLabel(sv));
    // selva (fase 2): prepara em segundo plano, para abrir na hora
    window.setTimeout(() => void loadJungle(base, this.quality).catch(() => undefined), 1200);
  }

  private pickQuality() {
    let q: Quality;
    if (settings.quality === 'auto') {
      const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
      const cores = navigator.hardwareConcurrency ?? 4;
      // celular: no máximo 'média' (telas com DPR 3 em 960p pesam demais; a resolução dinâmica ajusta o resto)
      // Desktop também começa em 'média' (720p): 'alta' (960p) quase dobra os pixels de cada quadro e
      // deixava o jogo pesado em tela cheia com GPU integrada. 'Alta' continua disponível nas configurações.
      if (this.isTouch) q = mem <= 3 || cores <= 4 ? 'low' : 'medium';
      else q = cores <= 2 ? 'low' : 'medium';
    } else q = settings.quality;
    this.quality = q;
  }

  applySettings() {
    audio.setVolumes(settings.music, settings.sfx);
    if (this.world) this.world.narrator.enabled = settings.narrator && this.world.data.stage === 1;
    this.touch.applySettings();
    this.hud.showFps = settings.showFps;
    if (settings.quality !== 'auto' && settings.quality !== this.quality) {
      this.quality = settings.quality;
      this.resize();
    }
    if (settings.quality === 'auto') {
      this.downgrades = 0;
    }
    this.applyFxCaps();
  }

  private applyFxCaps() {
    const c = CAPS[this.quality];
    if (this.world) {
      this.world.fx.maxParts = c.parts;
      this.world.fx.density = c.density;
    }
    if (this.menuScene) this.menuScene.fx.density = c.density * 0.7;
  }

  // ------------------------------------------------------------------ tamanho
  resize() {
    // celular em retrato: gira o jogo 90° para já abrir deitado (sem pedir para girar o aparelho)
    const rot = this.isTouch && window.innerHeight > window.innerWidth;
    orient.rot = rot;
    document.documentElement.classList.toggle('rot', rot);
    const app = document.getElementById('app');
    if (app) {
      app.style.width = rot ? `${window.innerHeight}px` : '';
      app.style.height = rot ? `${window.innerWidth}px` : '';
    }
    const cssW = rot ? window.innerHeight : window.innerWidth;
    const cssH = rot ? window.innerWidth : window.innerHeight;
    // aba em segundo plano / janela minimizada pode reportar 0×0: mantém o tamanho anterior
    if (!(cssW > 0 && cssH > 0)) return;
    document.documentElement.style.setProperty('--game-width', `${cssW}px`);
    document.documentElement.style.setProperty('--game-height', `${cssH}px`);
    const aspect = cssW / cssH;
    this.viewH = VIEW_H;
    this.viewW = clamp(Math.round(aspect * VIEW_H), 520, 820);
    const boxAspect = this.viewW / this.viewH;
    let w = cssW;
    let h = cssW / boxAspect;
    if (h > cssH) {
      h = cssH;
      w = cssH * boxAspect;
    }
    this.canvas.style.width = `${Math.floor(w)}px`;
    this.canvas.style.height = `${Math.floor(h)}px`;
    const dpr = window.devicePixelRatio || 1;
    const targetH = targetRenderHeight(h,dpr,this.quality,this.isTouch);
    const size=backingSize(this.viewW,this.viewH,targetH,this.renderScale);
    this.pxScale = size.pxScale;
    setDecoDensity((targetH / this.viewH) * 1.25);
    // textos do HUD na escala alvo (sem a resolução dinâmica): cada passo da resolução dinâmica não
    // obriga mais a recriar todas as imagens de texto (isso dava um engasgo a cada ajuste)
    setHudTextScale(Math.max(1, targetH / this.viewH));
    if (this.world) this.world.fx.popScale = Math.max(2, (targetH / this.viewH) * 1.3);
    resizeBacking(this.canvas,size.width,size.height);
    if (this.world) {
      this.world.camera.viewW = this.viewW;
      this.world.camera.viewH = this.viewH;
    }
    // safe area (px lógicos)
    this.hud.safeL = 0;
    this.hud.safeR = 0;
    this.hud.safeT = 0;
    this.orientationBlocked = false;
    this.updateRotate();
  }

  private updateRotate() {
    const show = this.orientationBlocked && (this.state === 'playing' || this.state === 'paused');
    this.menus.showRotate(show);
  }

  // ------------------------------------------------------------------ fluxo de estados
  private async requestFullscreenLandscape() {
    try {
      const el = document.documentElement;
      const anyEl = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
        else if (anyEl.webkitRequestFullscreen) await anyEl.webkitRequestFullscreen();
      }
    } catch {
      /* iOS / bloqueado */
    }
    try {
      const so = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      if (so && so.lock) await so.lock('landscape');
    } catch {
      /* não suportado — mostramos o aviso de girar */
    }
  }

  private saveLabel(s: SaveState) {
    return `Fase ${s.stage}${s.stage === 2 ? ' (selva)' : ''} — ${s.cpName}`;
  }
  private refreshContinue() {
    const s = loadSave();
    this.menus.setContinue(s ? this.saveLabel(s) : null);
  }
  /** Checkpoint alcançado: grava a partida no navegador. */
  private saveGame() {
    // Fora da partida, outra aba pode ter restaurado, excluído ou avançado o save.
    if (this.state !== 'playing' && this.state !== 'paused' && this.state !== 'comic') return;
    saveProgress();
    const w = this.world;
    if (!w || w.finished || w.player.hp <= 0) return;
    this.persistRun(captureSave(w));
  }
  private persistRun(save: SaveState | null) {
    this.saveSession ??= new SaveSession();
    const result = this.saveSession.write(save);
    if (result.conflict && !this.saveConflictShown) {
      this.saveConflictShown = true;
      this.menus.toast(result.durable
        ? 'Outra aba alterou o save. Sua partida foi preservada em SAVE E CONTA → PARTIDAS GUARDADAS.'
        : 'Outra aba alterou o save. Sua cópia está só em memória: baixe-a em SAVE E CONTA → PARTIDAS GUARDADAS antes de fechar.');
    }
  }
  private queueSave() {
    if (this.saveQueued) return;
    this.saveQueued = true;
    const save = () => { this.saveQueued = false; if (this.state === 'playing') this.saveGame(); };
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(save, { timeout: 1500 });
    else window.setTimeout(save, 0);
  }
  prepareProfileChange() {
    if (this.state === 'playing' || this.state === 'paused') this.saveGame();
  }
  cancelStageStart() {
    this.playRequest++;
  }
  private startNewGame(stage: number) {
    const start = () => {
      preserveProfile();
      this.play(true, stage);
    };
    const saved = loadSave();
    if (saved) this.menus.askNewGame(this.saveLabel(saved), start);
    else this.play(true, stage);
  }
  profileChanged() {
    this.flow.reset(this.world ?? undefined);
    this.world = null;
    this.menus.closeResume();
    this.toMenu();
  }
  /** Volta ao último checkpoint salvo. */
  continueSave() {
    const s = loadSave();
    if (!s) {
      this.refreshContinue();
      return;
    }
    this.menus.closeResume();
    this.play(true, s.stage, s);
    if (s.checkpointIdx >= 0) window.setTimeout(() => this.hud.banner('CHECKPOINT', s.cpName, 2.2), 500);
  }

  /** ?autoplay=1 (testes): com jogo salvo, continua do checkpoint em vez de começar do zero. */
  autoplay() {
    if (loadSave()) this.continueSave();
    else this.play();
  }

  play(again = false, stage = this.world?.data.stage ?? this.stage, save?: SaveState, session = new SaveSession(save ?? loadSave()), requestId = ++this.playRequest) {
    if (requestId !== this.playRequest) return;
    if (stage === 2 && !getJungle()) {
      // ainda preparando a selva: espera e entra sozinho
      audio.init();
      this.menus.setStageLoading(true);
      this.menus.toast('Entrando na selva...');
      void loadJungle(this.base, this.quality).then(() => this.play(again, 2, save, session, requestId)).catch(() => {
        if (requestId !== this.playRequest) return;
        this.menus.setStageLoading(false);
        this.menus.toast('Não foi possível carregar a selva');
      });
      return;
    }
    this.stage = stage;
    this.saveSession = session;
    this.saveConflictShown = false;
    setArtStage(stage);
    this.post.stage = stage;
    audio.init();
    audio.play('uiStart', 1);
    void this.requestFullscreenLandscape();
    if (orient.rot) this.menus.toast('Vire o celular de lado para jogar em tela cheia');
    this.menus.hideAll();
    this.menus.fade(false);
    this.stopIntroAudio();
    this.stopNarr(0.2);
    this.flow.reset(this.world ?? undefined);
    if (!this.world || again || save || this.state === 'complete' || this.world.data.stage !== stage) {
      // o nível vale para a partida inteira: save continua no nível em que foi gravado
      setDifficulty(save?.difficulty ?? (save ? 'normal' : settings.difficulty));
      this.world = new World(stage === 2 ? buildJungle() : buildLevel());
      this.bindWorld(this.world);
    } else {
      this.world.restart();
    }
    const w = this.world;
    if (save) applySave(w, save);
    w.director.introArt = this.intro;
    w.narrator.enabled = settings.narrator && stage === 1;
    w.camera.viewW = this.viewW;
    w.camera.viewH = this.viewH;
    this.applyFxCaps();
    w.fx.popScale = Math.max(2, this.pxScale * 1.3);
    this.applyDebugParams(w);
    this.pendingWeapons = [];
    this.state = 'playing';
    this.input.enabled = true;
    this.touch.show(this.isTouch || this.input.touch.active);
    this.hud.banners = [];
    this.hud.hint = null;
    this.hintsShown.clear();
    this.updateRotate();
    audio.setDuck(1);
    this.wasMusic = null;
    this.setMusic(w.musicState);
    // abertura narrada (câmera pelas ruínas até o herói)
    if (settings.narrator && !this.noOpening && stage === 1 && !(save && save.checkpointIdx >= 0)) w.director.startOpening();
    this.pacer.reset(this.last = performance.now());
    this.queueSave();
  }

  // ------------------------------------------------------------------ narrador
  private playNarr(id: number) {
    this.narrClip?.stop(0.12);
    this.narrClip = audio.playNarr(id);
    this.narrId = id;
    audio.setNarrDuck(0.5, 0.35);
  }
  private stopNarr(fade = 0.3) {
    this.narrClip?.stop(fade);
    this.narrClip = null;
    this.narrId = -1;
    audio.setNarrDuck(1, 0.5);
    audio.setSfxDuck(1);
  }

  /** Pilotando o Nômad, o barulho dele abaixa enquanto o narrador fala (para a voz ficar clara). */
  private updateNarrDuck(w: World) {
    const talking = w.narrator.busy() && !!this.narrClip && this.narrClip.playing;
    audio.setSfxDuck(talking && w.player.mounted ? 0.45 : 1);
  }

  private bindWorld(w: World) {
    this.pendingWeapons = [];
    w.hooks = {
      onWeaponAcquired: id => {
        if (this.state === 'paused') queueMicrotask(() => {
          if (this.world === w && this.state === 'paused') this.menus.showWeaponAcquired(id, progress.gear);
        });
        else if (this.state === 'playing') this.pendingWeapons.push(id);
      },
      onRespawn: () => this.beginRespawn(),
      onContinue: (lives) => this.askContinue(lives),
      onGameOver: () => this.gameOver(),
      onBossIntro: () => this.startBossIntro(),
      onBossComic: (len) => this.startComic(len),
      onBossIntroEnd: () => this.endBossIntro(),
      onNarrate: (id) => this.playNarr(id),
      onNarrStop: () => this.stopNarr(0.3),
      onNarrEnd: () => {
        audio.setNarrDuck(1, 0.6);
        audio.setSfxDuck(1);
      },
      narrReady: (id) => audio.narrReady(id),
      narrPlaying: (id) => this.narrId === id && !!this.narrClip?.playing,
      onNarrPrepare: (id) => audio.prepareNarr(id),
      onCheckpoint: () => this.queueSave(),
      onProgress: () => this.queueSave(),
      onControlReturned: () => this.input.suppressHeldActions(),
      onBanner: (t, s, d) => this.hud.banner(t, s, d),
      onComplete: () => this.onComplete(),
      onMusic: (s) => this.setMusic(s),
      onHint: (key) => {
        if (key === 'interceptGrenade') {
          if (this.hintsShown.has(key)) return;
          this.hintsShown.add(key);
        }
        const t = hintText(key, this.input.state.device);
        if (t) this.hud.setHint(t, 6);
      },
    };
    w.screenToWorldFn = (cx, cy) => {
      const r = this.canvas.getBoundingClientRect();
      const lx = ((cx - r.left) / r.width) * this.viewW;
      const ly = ((cy - r.top) / r.height) * this.viewH;
      return { x: w.camera.toWorldX(lx), y: w.camera.toWorldY(ly) };
    };
  }

  private handleMenuKey(code: string) {
    if (this.state === 'playing') return;
    if (this.investigation) { this.investigation.handleKey(code); return; }
    if (this.menus.handleKey(code)) return;
    if (code === 'Escape' && this.state === 'paused') this.resume();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.saveGame();
    this.state = 'paused';
    this.input.enabled = false;
    this.touch.show(false);
    this.menus.showPause();
    audio.setUnderwater(0);
    this.introClip?.pause();
    this.narrClip?.pause();
    this.clubClip?.pause();
    audio.setDuck(0.3);
    audio.loop('glide', false);
    audio.loop('roll', false);
    audio.loop('alarm', false);
    this.updateRotate();
  }

  resume() {
    if (this.state !== 'paused') return;
    if(this.investigation){this.investigation.destroy();this.investigation=null;this.input.suppressHeldActions();}
    audio.wake();
    this.menus.hidePause();
    this.state = 'playing';
    this.input.enabled = true;
    this.touch.show(!this.world?.director.longIntroActive() && (this.isTouch || this.input.touch.active));
    this.introClip?.resume();
    this.narrClip?.resume();
    this.clubClip?.resume();
    audio.setDuck(1);
    this.pacer.reset(this.last = performance.now());
    this.updateRotate();
  }

  restartLevel() {
    if (!this.world) return;
    this.investigation?.destroy();this.investigation=null;
    this.flow.reset(this.world);
    this.stopIntroAudio();
    this.menus.hidePause();
    this.menus.hideAll();
    this.world.restart();
    this.hud.banners = [];
    this.hintsShown.clear();
    this.state = 'playing';
    this.input.enabled = true;
    this.touch.show(this.isTouch || this.input.touch.active);
    audio.setDuck(1);
    audio.play('uiStart', 0.8);
    this.wasMusic = null;
    this.setMusic('explore');
    this.pacer.reset(this.last = performance.now());
    this.updateRotate();
    this.queueSave();
  }

  toMenu(first = false) {
    this.investigation?.destroy();this.investigation=null;
    this.flow.reset(this.world ?? undefined);
    this.pendingWeapons = [];
    this.cancelStageStart();
    if (this.state === 'playing' || this.state === 'paused') this.saveGame();
    this.world = null;
    this.stopIntroAudio();
    audio.setUnderwater(0);
    this.stopNarr(0.2);
    this.state = 'menu';
    this.input.enabled = false;
    this.touch.show(false);
    this.menus.hideAll();
    this.menus.showMain(first ? 'v5 • toque em JOGAR' : 'v5');
    this.refreshContinue();
    this.menus.fade(false);
    this.updateRotate();
    audio.setDuck(1);
    audio.loop('glide', false);
    audio.loop('roll', false);
    audio.loop('alarm', false);
    this.wasMusic = null;
    this.setMusic('menu');
    if (document.fullscreenElement && !first) {
      /* mantém fullscreen ao voltar ao menu */
    }
  }

  /** Metal Slug: morreu com vidas sobrando → contagem regressiva para gastar uma vida e continuar. */
  private askContinue(lives: number) {
    if (this.state !== 'playing') return;
    saveProgress();
    this.state = 'continue';
    this.input.enabled = false;
    this.touch.show(false);
    this.continueLeft = CONTINUE_SECS;
    this.continueTick = CONTINUE_SECS;
    audio.setDuck(0.45);
    this.world?.narrator.onContinue();
    audio.loop('glide', false);
    audio.loop('roll', false);
    audio.loop('alarm', false);
    this.menus.showContinue(lives);
  }

  private confirmContinue() {
    if (this.state !== 'continue' || !this.world) return;
    if (this.continueLeft > CONTINUE_SECS - 0.6) return; // evita confirmar sem querer (botões apertados na morte)
    this.menus.hideAll();
    this.state = 'playing';
    this.input.enabled = true;
    this.touch.show(this.isTouch || this.input.touch.active);
    audio.setDuck(1);
    audio.play('uiStart', 0.8);
    this.world.reviveInPlace();
    this.wasMusic = null;
    this.setMusic(this.world.musicState);
    this.pacer.reset(this.last = performance.now());
  }

  /** Sem confirmar (ou tempo esgotado): volta ao último checkpoint, sem gastar vida. */
  private declineContinue() {
    if (this.state !== 'continue' || !this.world) return;
    this.menus.hideAll();
    this.state = 'playing';
    this.input.enabled = true;
    this.touch.show(this.isTouch || this.input.touch.active);
    audio.setDuck(1);
    this.world.respawnRequested = true;
    this.beginRespawn();
    this.pacer.reset(this.last = performance.now());
  }

  /** Entrada longa do Felipão: esconde os controles, abafa a música e toca o áudio que guia a cena. */
  private startBossIntro() {
    this.touch.show(false);
    audio.loop('glide', false);
    audio.loop('roll', false);
    audio.loop('alarm', false);
    audio.setCineDuck(0, 0.35);
    this.introClip?.stop(0.1);
    this.introClip = audio.playClip('bossIntro', { vol: 1, fadeIn: 0.03 });
    this.introTap = false;
    this.input.clearEdges();
  }

  /** Fim (natural ou pulado) da entrada: corta o que sobrou do áudio e devolve a música. */
  private endBossIntro() {
    if (this.introClip?.playing) this.introClip.stop(0.35);
    this.introClip = null;
    audio.setCineDuck(1, 0.8);
    if (this.state === 'playing') this.touch.show(this.isTouch || this.input.touch.active);
  }

  /** Pular a sequência inteira (toque, tiro ou pulo): fade curto nos áudios e direto para a luta. */
  private skipBossIntro(w: World) {
    this.introClip?.stop(0.25);
    this.introClip = null;
    if (this.comic) {
      this.comic.stopVoice(0.15);
      this.endComic(false);
    }
    this.input.clearEdges();
    w.director.skipBossIntro();
  }

  /** Para qualquer áudio da entrada (reinício, menu, nova partida). */
  private stopIntroAudio() {
    this.introClip?.stop(0.2);
    this.introClip = null;
    this.comic?.stopVoice(0.1);
    this.comic = null;
    this.stopClubMusic(0.2);
    audio.setCineDuck(1, 0.3);
  }

  /** Filminho do chefe: congela o mundo, esconde os controles e toca a HQ. */
  private startComic(len?: number) {
    if (this.state !== 'playing') return;
    // a voz do Karimbo entra quando o áudio do chefe termina
    const c = new BossComic(len, INTRO_VOICE_AT);
    this.comic = c;
    this.state = 'comic';
    this.comicTap = false;
    this.touch.show(false);
    audio.loop('glide', false);
    audio.loop('roll', false);
    audio.loop('alarm', false);
  }

  private endComic(notify = true) {
    this.comic = null;
    if (this.state !== 'comic') return;
    this.state = 'playing';
    this.input.enabled = true;
    this.touch.show(this.isTouch || this.input.touch.active);
    this.input.clearEdges();
    this.pacer.reset(this.last = performance.now());
    // a HQ fecha a entrada do chefe: a luta começa
    if (notify) this.world?.director.onComicDone();
  }

  /** Há versão nova publicada: confirmação no menu/pausa; durante a partida, só um botão discreto. */
  notifyUpdate(apply: () => void) {
    const busy = this.state === 'playing' || this.state === 'comic' || this.state === 'continue';
    if (busy) this.menus.showUpdatePill(apply, () => this.pause());
    else this.menus.showUpdate(apply);
  }

  private gameOver() {
    if (this.state !== 'playing') return;
    saveProgress();
    this.stopIntroAudio();
    this.state = 'gameover';
    this.input.enabled = false;
    this.touch.show(false);
    audio.setDuck(0.5);
    this.menus.showGameOver();
  }

  private beginRespawn() {
    this.pendingWeapons = [];
    if (this.respawnPending || !this.world) return;
    this.stopIntroAudio();
    this.respawnPending = true;
    this.menus.fade(true);
    window.setTimeout(() => {
      this.world?.respawn();
      this.respawnPending = false;
      this.wasMusic = null;
      this.setMusic(this.world?.musicState ?? 'explore');
      window.setTimeout(() => this.menus.fade(false), 120);
    }, 420);
  }

  private onComplete() {
    const w = this.world!;
    this.state = 'complete';
    this.input.enabled = false;
    this.touch.show(false);
    this.stopClubMusic(0.2);
    audio.loop('glide', false);
    audio.loop('roll', false);
    audio.loop('alarm', false);
    const rank = computeRank({ score: w.score, time: w.time, emblems: w.emblems.size, secrets: w.secrets.size, deaths: w.stats.deaths });
    // bônus de fim de fase
    const timeBonus = Math.max(0, Math.round(6000 - w.time * 4));
    const noHit = w.stats.deaths === 0 ? 3000 : 0;
    w.score += timeBonus + noHit + w.emblems.size * 400 + w.secrets.size * 1500;
    const newBest = w.score > progress.bestScore;
    if (newBest) progress.bestScore = w.score;
    if (!progress.bestTime || w.time < progress.bestTime) progress.bestTime = w.time;
    progress.bestEmblems = Math.max(progress.bestEmblems, w.emblems.size);
    progress.bestSecrets = Math.max(progress.bestSecrets, w.secrets.size);
    progress.emblemsFound = [...new Set([...progress.emblemsFound, ...w.emblems])];
    progress.secretsFound = [...new Set([...progress.secretsFound, ...w.secrets])];
    progress.completed++;
    if (!progress.stagesDone.includes(w.data.stage)) progress.stagesDone.push(w.data.stage);
    saveProgress();
    // fase concluída: o save passa a apontar para o começo da próxima (a selva ainda é prévia)
    if (w.data.stage === 1) this.persistRun(nextStageSave(w, 2));
    else this.persistRun(null);
    window.setTimeout(() => {
      if (this.state !== 'complete' || this.world !== w) return;
      this.menus.showResults({
        nextStage: w.data.stage === 1 ? 2 : undefined,
        time: w.time, score: w.score, tokens: w.tokens, emblems: w.emblems.size, secrets: w.secrets.size, kills: w.stats.kills, deaths: w.stats.deaths, rank, newBest, bestCombo: w.bestCombo,
      });
    }, 400);
  }

  private stopClubMusic(fade = 0.25) {
    if (this.clubClip) {
      this.clubClip.stop(fade);
      this.clubClip = null;
    }
  }

  // ------------------------------------------------------------------ música
  private setMusic(s: MusicState | 'menu') {
    if (this.wasMusic === s) return;
    this.wasMusic = s;
    // na selva o tema da fase é o tribal (tambores, marimba e flauta)
    const jungle = this.world?.data.stage === 2;
    const isStage1Club = this.world?.data.stage === 1 && (s === 'club' || s === 'drop' || s === 'rave');
    const m = (theme: ThemeName, mix: Parameters<typeof music.play>[1]) => music.play(jungle && theme === 'stage' ? 'jungle' : theme, mix);

    if (isStage1Club) {
      // Somente na fase 1 dentro da balada: música do vídeo em loop
      if (!this.clubClip || !this.clubClip.playing) {
        this.clubClip = audio.playMusicClip('balada', { loop: true, vol: 1, fadeIn: 0.25 });
      } else {
        this.clubClip.setVol(1, 0.08);
      }
      if (this.clubClip?.playing) {
        // Balada tocando: roda o relógio visual (150 BPM) sem instrumentos procedurais
        music.play('rave', {});
      } else {
        // Fallback procedural (áudio ainda baixando ou ambiente sem decodificador)
        if (s === 'rave') music.play('rave', MIX.rave);
        else m('stage', s === 'drop' ? MIX.drop : MIX.club);
      }
      return;
    }

    if (s === 'silence') {
      if (this.clubClip?.playing) {
        this.clubClip.setVol(0.0001, 0.04);
      }
      music.setMix({}, 0.15);
      return;
    }

    if (this.clubClip) {
      this.stopClubMusic(0.25);
    }

    switch (s) {
      case 'menu': m('menu', MIX.menu); break;
      case 'explore': m('stage', MIX.explore); break;
      case 'combat': m('stage', MIX.combat); break;
      case 'nomad': m('stage', MIX.nomad); break;
      case 'nomadCombat': m('stage', MIX.nomad); break;
      case 'calm': m('stage', MIX.calm); break;
      case 'rhythm': m('stage', MIX.rhythm); break;
      case 'celebrate': m('stage', MIX.celebrate); break;
      case 'club': m('stage', MIX.club); break;
      case 'drop': m('stage', MIX.drop); break;
      case 'boss1': m('boss', MIX.boss1); break;
      case 'boss2': m('boss', MIX.boss2); break;
      case 'boss3': m('boss', MIX.boss3); break;
      case 'victory': m('stage', MIX.victory); break;
      case 'rave': music.play('rave', MIX.rave); break;
    }
  }

  // ------------------------------------------------------------------ depuração/QA (via URL)
  private applyDebugParams(w: World) {
    const q = new URLSearchParams(location.search);
    if (q.get('god') === '1') w.invulnerable = true;
    if (q.get('qa') === '1') (window as unknown as { __kg?: unknown }).__kg = { game: this, world: w, art: getArt() }; // QA no navegador
    const tp = q.get('tp');
    if (tp) {
      const tx = parseFloat(tp);
      const sx = tx * 32 + 16;
      // seção mais próxima define a altura (evita cair em "tetos" ao procurar o chão)
      let sec = w.data.sections[0];
      for (const s of w.data.sections) if (Math.abs(s.x - sx) < Math.abs(sec.x - sx)) sec = s;
      const gy = w.level.groundBelow(sx, sec.y - 100, 900);
      const y = gy ?? sec.y;
      // marca o último checkpoint antes do ponto (sem repetir avisos)
      const cps = w.data.checkpoints;
      let idx = -1;
      for (let i = 0; i < cps.length; i++) if (cps[i].x <= sx) idx = i;
      w.checkpointIdx = idx;
      w.player.reset(sx, y);
      if (sx > w.data.nomadSpawn.x + 40 * 32) w.nomadLost = true; // teleporte de teste além do portão do Nômad
      w.checkpointSnap = w.player.snapshot();
      w.cameraSnap();
    }
    if (q.get('arms') === '1') {
      for (const id of ['rifle', 'shotgun', 'launcher', 'energy'] as const) w.player.weapons.set(id, id === 'rifle' ? 300 : id === 'shotgun' ? 48 : id === 'launcher' ? 24 : 100);
      w.player.grenades = 8;
    }
  }

  // ------------------------------------------------------------------ loop
  private frame(now: number) {
    requestAnimationFrame((t) => this.frame(t));
    // Aba oculta não desenha nem altera a qualidade; também não contamina o diagnóstico.
    if (document.hidden) {this.pacer.reset(now);return;}
    const frameMs=this.pacer.take(now,this.state==='playing'||this.state==='comic'||this.state==='continue'?60:30);
    if(frameMs===null)return;
    let dt=frameMs/1000;
    this.last=now;
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;
    this.frames++;
    if (now - this.lastFpsUpdate > 500) {
      this.hud.fps = (this.frames * 1000) / (now - this.lastFpsUpdate);
      this.frames = 0;
      this.lastFpsUpdate = now;
    }
    // Intervalo real desde o quadro anterior, inclusive pausas >250 ms (a física usa o dt protegido).
    const rawMs = Number.isFinite(this.pacer.raw) ? this.pacer.raw : frameMs;
    const focused = document.hasFocus();
    if (focused) this.autoQuality(rawMs / 1000, now);
    else { this.drsAcc = this.drsN = 0; this.frameTimes.length = 0; this.metrics?.inactive(); }
    this.input.poll();
    const w = this.world;

    const t0 = performance.now();
    if (this.state === 'playing' && w) {
      if (this.input.state.pause.pressed) {
        this.input.clearEdges();
        this.pause();
      } else if (this.orientationBlocked) {
        /* pausado até girar */
      } else {
        this.step(w, dt);
      }
      this.updateTouchState(w);
    } else if (this.state === 'comic' && w && this.comic) {
      const s = this.input.state;
      const tap = s.fire.pressed || s.jump.pressed || s.pause.pressed || this.comicTap;
      this.comicTap = false;
      this.input.clearEdges();
      if (tap) this.skipBossIntro(w);
      else {
        // a HQ acompanha o relógio do áudio da entrada; quando ele acaba, o Karimbo fala na hora
        const clip = this.introClip;
        if (clip && clip.playing) {
          const e = clip.elapsed();
          if (e >= 0) this.comic.syncTo(Math.min(e - INTRO_COMIC, this.comic.voiceAt - 0.01));
        } else if (clip && this.comic.real < this.comic.voiceAt) this.comic.syncTo(this.comic.voiceAt);
        this.comic.update(dt);
        if (this.comic.done) this.endComic();
      }
    } else if (this.state === 'continue' && w) {
      // mundo congelado; contagem regressiva + confirmação por gamepad (o narrador continua)
      w.narrator.update(dt);
      this.continueLeft -= dt;
      if (Math.ceil(this.continueLeft) < this.continueTick) {
        this.continueTick = Math.ceil(this.continueLeft);
        if (this.continueTick >= 0) audio.play('uiClick', this.continueTick <= 3 ? 0.9 : 0.4);
      }
      this.menus.setContinueCount(this.continueLeft, CONTINUE_SECS);
      const s = this.input.state;
      if (s.device === 'pad' && (s.jump.pressed || s.fire.pressed)) this.confirmContinue();
      else if (this.continueLeft <= 0) this.declineContinue();
    } else if (this.state === 'menu' && this.menuScene) {
      this.menuScene.update(dt, this.viewW);
    }
    const t1 = performance.now();
    this.render(dt);
    const t2 = performance.now();
    this.prof.update += (t1 - t0 - this.prof.update) * 0.05;
    this.prof.render += (t2 - t1 - this.prof.render) * 0.05;
    if (focused && this.state === 'playing' && w && !this.orientationBlocked) {
      this.metrics?.sample(rawMs, t1 - t0, t2 - t1, now, `Fase ${w.data.stage} • ${this.quality} • ${this.canvas.width}×${this.canvas.height}\nalvo 60 • DPR ${window.devicePixelRatio||1} • resolução ${(this.renderScale * 100).toFixed(0)}%`);
    }
  }

  private step(w: World, dt: number) {
    if (this.flow.active) { this.flow.step(w, dt, this.input.state); return; }
    this.flowPrefetchT -= dt;
    if (this.flowPrefetchT <= 0) { this.flowPrefetchT = 0.4; this.flow.prefetch(w.exploration.nearInterior(w)); }
    const spot=w.exploration.nearest(w);
    if(this.input.state.interact.pressed&&spot&&w.exploration.safe(w,spot)) {
      if (spot.interior) {
        this.input.clearEdges(); this.input.suppressHeldActions();
        if (this.flow.tryEnter(w, spot)) return;
      }
      this.openInvestigation(w,spot);return;
    }
    if(this.input.state.interact.pressed&&w.merchant.near(w)) {
      this.input.clearEdges();this.pause();
      this.menus.showMerchant(w,()=>{w.checkpointSnap=w.player.snapshot();this.saveGame();});return;
    }
    // hit-stop / câmera lenta
    let sdt = dt;
    if (w.fx.hitStop > 0) {
      w.fx.hitStop -= dt;
      this.input.clearEdges();
      w.camera.update(dt, w.player.x, w.player.y - 14, w.player.facing, w.player.body.vx, w.player.body.onGround, w.fx.shake, settings.screenShake);
      this.hud.update(dt);
      return;
    }
    if (w.fx.slowmo > 0) sdt = dt * w.fx.slowScale;
    // abertura narrada: a fala manda no ritmo e o controle só volta quando ela termina
    if (w.director.openingActive()) {
      if (this.narrId === 1 && this.narrClip?.playing) w.director.syncOpening(this.narrClip.elapsed());
      this.introTap = false;
    }
    // entrada do Felipão: o áudio é o relógio da cena; toque/tiro/pulo pula tudo
    if (w.director.longIntroActive()) {
      const s = this.input.state;
      if ((s.fire.pressed || s.jump.pressed || this.introTap) && w.director.introTime() > 0.6) this.skipBossIntro(w);
      else {
        const e = this.introClip ? this.introClip.elapsed() : -1;
        if (e >= 0) w.director.syncIntro(e);
      }
      this.introTap = false;
    }
    const n = Math.min(4, Math.max(1, Math.ceil(sdt / (1 / 55))));
    const h = sdt / n;
    for (let i = 0; i < n; i++) {
      w.update(h, this.input.state);
      if (i === 0) this.input.clearEdges();
      if (this.state === 'playing' && this.pendingWeapons.length) {
        this.pause();
        this.input.suppressHeldActions();
        const next = () => {
          const id = this.pendingWeapons.shift();
          if (id) this.menus.showWeaponAcquired(id, progress.gear, next);
          else { this.input.suppressHeldActions(); this.resume(); }
        };
        next();
        return;
      }
      if (this.state !== 'playing') break; // a HQ congelou o mundo
    }
    this.updateNarrDuck(w);
    audio.setUnderwater(w.underwater);
    if (w.data.stage === 2) this.jungleAmbience(w, dt);
    if (w.director.skyPulse > 0) {
      this.post.skyFlash(w.director.skyPulse);
      w.director.skyPulse = 0;
    }
    this.hud.update(dt);
    this.post.update(w, dt, this.quality);
    w.rainLevel = this.post.rain;
    // dicas contextuais
    this.processHints(w);
  }

  private openInvestigation(w:World,spot:ExplorationSpot) {
    this.input.clearEdges();this.pause();this.menus.hidePause();
    this.input.suppressHeldActions();
    this.investigation=new Investigation(this.ui,w,spot,()=>this.resume(),()=>{
      w.checkpointSnap=w.player.snapshot();this.saveGame();
    });
  }

  /** Sons da selva: pássaros, insetos e sapos (perto do pântano) em intervalos aleatórios. */
  private jungleAmbience(w: World, dt: number) {
    this.ambT -= dt;
    if (this.ambT > 0) return;
    this.ambT = 0.8 + Math.random() * 2.6;
    const pan = Math.random() * 1.6 - 0.8;
    const near = w.water.zones.some((z) => z.kind === 'swamp' && Math.abs(z.x + z.w / 2 - w.player.x) < 700);
    const under = w.underwater > 0;
    const r = Math.random();
    if (under) {
      if (r < 0.5) audio.play('bubble', 0.4, pan);
    } else if (near && r < 0.35) audio.play('frog', 0.7, pan);
    else if (r < 0.62) audio.play('bird', 0.6, pan);
    else if (r < 0.82) audio.play('bird2', 0.6, pan);
    else audio.play('insect', 0.7, pan);
  }

  private processHints(w: World) {
    const p = w.player;
    if (w.inRoom()) return;
    for (const t of w.data.triggers) {
      if (!t.id.startsWith('hint:')) continue;
      const key = t.id.slice(5);
      if (this.hintsShown.has(key)) continue;
      const r = t.rect;
      if (p.x >= r.x && p.x <= r.x + r.w) {
        if ((key === 'nomad' || key === 'dash') && !p.mounted) continue;
        if (key === 'jump' && this.hintsShown.size > 3) continue;
        this.hintsShown.add(key);
        const txt = hintText(key, this.input.state.device);
        if (txt) this.hud.setHint(txt, 4.5);
      }
    }
  }

  private weaponIcons = new Map<string, string>();
  private lastHp = -1;
  private updateTouchState(w: World) {
    if (this.flow.active) return;
    const p = w.player;
    const m = p.mounted;
    if (m !== this.lastMounted) {
      this.lastMounted = m;
      this.touch.setMounted(m);
    }
    // vibração ao levar dano
    const hpNow = p.nomad ? p.nomad.hp : p.hp;
    if (this.lastHp >= 0 && hpNow < this.lastHp - 0.5) this.input.haptic(0.7, p.nomad ? 30 : 45);
    this.lastHp = hpNow;
    if (!this.touch.enabled) return;
    let icon = this.weaponIcons.get(p.cur);
    if (!icon) {
      const spr = getArt().karimbo.weapons[p.cur];
      icon = spr.c.toDataURL();
      this.weaponIcons.set(p.cur, icon);
    }
    const ammo = p.weapons.get(p.cur) ?? 0;
    const n = p.nomad;
    let dash01 = 1;
    if (n) dash01 = n.window > 0 ? 1 : n.cooldown > 0 ? clamp(1 - n.cooldown / 3.4, 0, 1) : 1;
    const spot=w.exploration.nearest(w),explore=!!spot&&w.exploration.safe(w,spot);
    this.touch.sync({ weaponIcon: icon, ammo: p.mounted?(ammo===Infinity?'∞':String(ammo)):p.ammoLabel, lowAmmo: !p.mounted&&p.loadedAmmo===0, grenades: p.grenades, dash01,merchant:w.merchant.near(w),interaction:explore?(spot.cabin?'ENTRAR':'INVESTIGAR'):undefined,canReload:p.canReload,reloading:p.reloadT>0,reload01:p.reload01 });
  }

  /**
   * Resolução dinâmica (como nos consoles): se o quadro passa de ~21 ms, reduz a resolução interna
   * em passos de 10% (até DRS_MIN); quando sobra folga por alguns segundos, sobe de novo. Todos os
   * efeitos continuam ligados — só a nitidez varia, e pouco.
   */
  private dynamicResolution(dt: number) {
    if (this.state !== 'playing') {
      this.drsAcc = this.drsN = 0;
      return;
    }
    this.drsAcc += Math.min(dt, 0.1);
    this.drsN++;
    if (this.drsAcc < 0.75) return;
    const avg = this.drsAcc / this.drsN;
    this.drsAcc = this.drsN = 0;
    const minScale = DRS_MIN;
    if (avg > 1 / 47 && this.renderScale > minScale + 0.01) {
      // lentidão clara (abaixo de ~40 fps) baixa já na primeira janela e em passo maior
      if (++this.drsBad >= (avg > 1 / 40 ? 1 : 2)) {
        this.renderScale = Math.max(minScale, +(this.renderScale - (avg > 1 / 40 ? 0.15 : 0.1)).toFixed(2));
        this.drsBad = 0;
        this.drsGood = 0;
        this.resize();
      }
    } else if (avg < 1 / 57 && this.renderScale < 1) {
      this.drsBad = 0;
      if (++this.drsGood >= 6) {
        this.renderScale = Math.min(1, +(this.renderScale + 0.05).toFixed(2));
        this.drsGood = 0;
        this.resize();
      }
    } else {
      this.drsGood = 0;
      this.drsBad = 0;
    }
  }

  private autoQuality(dt: number, now: number) {
    this.dynamicResolution(dt);
    // só troca a qualidade se nem a resolução mínima der conta
    if (settings.quality !== 'auto' || this.state !== 'playing' || this.renderScale > DRS_MIN + 0.01) {
      this.frameTimes.length = 0;
      return;
    }
    this.frameTimes.push(Math.min(dt, 0.1));
    if (this.frameTimes.length > 120) this.frameTimes.shift();
    if (now - this.lastQualityCheck < 2000 || this.frameTimes.length < 60) return;
    this.lastQualityCheck = now;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    if (avg > 0.026 && this.downgrades < 2 && this.quality !== 'low') {
      this.downgrades++;
      this.quality = this.quality === 'high' ? 'medium' : 'low';
      this.resize();
      this.applyFxCaps();
      this.frameTimes.length = 0;
      this.menus.toast(`Qualidade ajustada: ${this.quality === 'medium' ? 'média' : 'baixa'} (para manter o jogo fluido)`);
    }
  }

  // ------------------------------------------------------------------ render
  private render(dt: number) {
    const g = this.g;
    const k = this.pxScale;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.imageSmoothingEnabled = true;
    // 'low' = bilinear sem mipmaps. Com 'medium', cada canvas desenhado reduzido exige mipmaps: o Skia
    // copia a textura inteira e regenera os níveis A CADA QUADRO (GrGpu::copySurface +
    // regenerateMipMapLevels no processo de GPU). A arte é assada em 3× e desenhada a ~0,55–1×, onde
    // o bilinear é visualmente igual; ícones muito reduzidos do HUD usam drawSprShrunk (kit.ts).
    g.imageSmoothingQuality = 'low';
    const W = this.viewW;
    const H = this.viewH;
    if (!artReady()) {
      g.fillStyle = '#0d0724';
      g.fillRect(0, 0, W, H);
      return;
    }
    const w = this.world;
    if ((this.state === 'menu' || this.state === 'loading') && this.menuScene) {
      this.menuScene.draw(g, W, H);
      return;
    }
    if (!w) return;
    if (this.flow.drawsInterior && this.flow.draw(g, W, H)) return;
    const cam = w.camera;
    const bg = stageBg();
    // fundo (espaço de tela). No celular ('média'/'baixa') o fundo distante — que já é suave — é
    // pintado numa imagem com ~65% da resolução e ampliado: um terço da pintura de tela, sem
    // diferença visível; o mundo, os personagens e o HUD continuam na resolução cheia.
    const atm = this.atmosphere(w);
    const bgs = { camX: cam.x, camY: cam.y, viewW: W, viewH: H, time: w.time, sky: atm.sky, ruin: atm.ruin, canopy: w.forestLight.shadeAt(w.player.x), refY: w.data.playerStart.y - 200, intensity: w.musicState.startsWith('boss') || w.musicState === 'combat' ? 1 : 0.6 };
    const bdt = this.state === 'playing' ? dt : 0;
    if (this.quality !== 'high') {
      const f = BG_RES[this.quality];
      const bw = Math.max(1, Math.round(W * k * f));
      const bh = Math.max(1, Math.round(H * k * f));
      if (!this.bgCanvas) this.bgCanvas = document.createElement('canvas');
      const bc = this.bgCanvas;
      if (bc.width !== bw || bc.height !== bh) {
        bc.width = bw;
        bc.height = bh;
        this.bgCtx = bc.getContext('2d', { alpha: false });
      }
      const bx = this.bgCtx ?? bc.getContext('2d')!;
      this.bgCtx = bx;
      bx.setTransform(k * f, 0, 0, k * f, 0, 0);
      bx.imageSmoothingEnabled = true;
      bg.draw(bx, bgs, bdt);
      g.drawImage(bc, 0, 0, W, H);
    } else bg.draw(g, bgs, bdt);
    this.post.drawSkyFlash(g, W, H);
    // mundo
    const z = cam.zoom * k;
    const tx = Math.round(-(cam.x - cam.sx) * z + (W * k - W * k) / 2);
    const ty = Math.round(-(cam.y - cam.sy) * z);
    g.setTransform(z, 0, 0, z, tx, ty);
    w.drawWorld(g);
    // primeiro plano e HUD
    g.setTransform(k, 0, 0, k, 0, 0);
    bg.drawForeground(g, { camX: cam.x, camY: cam.y, viewW: W, viewH: H, time: w.time, sky: atm.sky, ruin: atm.ruin, canopy: w.forestLight.shadeAt(w.player.x), refY: 0, intensity: 0.6, under: w.underwater || (w.inRoom() ? 1 : 0) }, this.state === 'playing' ? dt : 0);
    if (this.state === 'playing') this.post.drawRain(g, w, W, H,dt);
    this.post.bloom(g, this.canvas, this.quality);
    this.post.grade(g, W, H, this.quality);
    bg.drawVignette(g, W, H, 0.9);
    this.post.hurt(g, this.canvas, w.player.mode === 'dead' ? 0 : clamp(w.player.hurtT / 0.28, 0, 1));
    this.hud.drawScreenFx(g, w, W, H);
    if (w.blackout > 0.01) {
      g.globalAlpha = Math.min(1, w.blackout);
      g.fillStyle = '#000000';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
    this.flow.postWorld(g, this.canvas, W, H, w);
    if (this.flow.active) { /* o mundo congela: sem HUD durante a íris */ }
    else if (this.state === 'comic' && this.comic) this.comic.draw(g, W, H);
    else if (w.director.longIntroActive()) this.intro.draw(g, W, H, w.director.introTime(), w.director.introLandT());
    else if (w.director.openingActive()) this.opening.draw(g, W, H, w.director.openingTime());
    else this.hud.draw(g, w, W, H);
  }

  private atmosphere(w: World) {
    const pts = w.data.atmosphere;
    const x = w.camera.x + w.camera.w / 2;
    if (!pts.length) return { sky: 0, ruin: 0 };
    if (x <= pts[0].x) return pts[0];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (x >= a.x && x <= b.x) {
        const t = clamp((x - a.x) / Math.max(1, b.x - a.x), 0, 1);
        return { sky: a.sky + (b.sky - a.sky) * t, ruin: a.ruin + (b.ruin - a.ruin) * t };
      }
    }
    return pts[pts.length - 1];
  }
}
