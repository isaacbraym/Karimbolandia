import { orient } from '../core/orient';
import { Input } from '../core/input';
import { audio, type ClipHandle } from '../core/audio';
import { PostFX } from './post';
import { BossComic } from './comic';
import { IntroOverlay, INTRO_COMIC, INTRO_VOICE_AT } from './bossIntro';
import { bakeCivilians } from '../art/civilians';
import { OpeningOverlay } from './opening';
import { NARR_COUNT } from './narrator';
import { setDecoDensity } from '../art/decor';
import { music, MIX, type ThemeName } from '../core/music';
import { settings, progress, saveProgress } from '../core/storage';
import { clamp } from '../core/math';
import { buildArt, getArt, artReady, type Quality } from '../art';
import { World, type MusicState } from './world';
import { buildLevel } from './level/index';
import { Hud, setHudTextScale } from './hud';
import { MenuScene } from './menuScene';
import { Menus, computeRank } from '../ui/menus';
import { TouchUI } from '../ui/touch';
import { hintText } from './hints';
import { VIEW_H } from './level';

type State = 'loading' | 'menu' | 'playing' | 'paused' | 'complete' | 'continue' | 'gameover' | 'comic';

const CONTINUE_SECS = 10;

const MAX_H: Record<Quality, number> = { low: 540, medium: 720, high: 960 };
const CAPS: Record<Quality, { parts: number; density: number }> = {
  low: { parts: 620, density: 0.85 },
  medium: { parts: 760, density: 0.95 },
  high: { parts: 900, density: 1 },
};

export class Game {
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
  private last = 0;
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
  private comic: BossComic | null = null;
  private comicTap = false;
  /** entrada do Felipão: camada de tela, áudio guiando a cena e toque para pular */
  private intro = new IntroOverlay();
  private introClip: ClipHandle | null = null;
  private introTap = false;
  /** narrador: fala tocando agora */
  private narrClip: ClipHandle | null = null;
  private narrId = -1;
  private opening = new OpeningOverlay();
  /** a abertura narrada só passa no começo de uma partida nova (não em QA com teleporte) */
  private noOpening = new URLSearchParams(location.search).has('tp');
  /** resolução dinâmica: fração da resolução alvo (0.6..1) — cai antes de qualquer efeito ser cortado */
  renderScale = 1;
  private drsAcc = 0;
  private drsN = 0;
  private drsGood = 0;
  private drsBad = 0;

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.canvas = canvas;
    this.ui = ui;
    this.g = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
    this.isTouch = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window || new URLSearchParams(location.search).get('touch') === '1';
  }

  // ------------------------------------------------------------------ boot
  async boot(base: string) {
    const app = document.getElementById('app') as HTMLElement;
    this.input.attach(app);
    this.touch = new TouchUI(this.ui, this.input);
    this.menus = new Menus(this.ui, {
      onPlay: () => this.play(),
      onSettingsChanged: () => this.applySettings(),
      onResume: () => this.resume(),
      onRestart: () => this.restartLevel(),
      onQuitToMenu: () => this.toMenu(),
      onPlayAgain: () => this.play(true),
      onContinueYes: () => this.confirmContinue(),
      onContinueNo: () => this.declineContinue(),
      onClick: () => audio.play('uiClick', 0.8),
    });
    this.input.onGesture = () => {
      audio.init();
      if (this.state === 'comic') this.comicTap = true;
      else if (this.state === 'playing' && (this.world?.director.longIntroActive() || this.world?.director.openingActive())) this.introTap = true;
    };
    this.input.onMenuKey = (code) => {
      if (this.state === 'playing') return;
      if (this.menus.handleKey(code)) return;
      if (code === 'Escape' && this.state === 'paused') this.resume();
    };
    this.input.enabled = false;
    this.pickQuality();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => window.setTimeout(() => this.resize(), 250));
    const noPause = new URLSearchParams(location.search).get('nopause') === '1'; // QA
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing' && !noPause) this.pause();
    });
    window.addEventListener('blur', () => {
      if (this.state === 'playing' && !noPause) this.pause();
    });
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
  }

  private pickQuality() {
    let q: Quality;
    if (settings.quality === 'auto') {
      const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
      const cores = navigator.hardwareConcurrency ?? 4;
      const small = Math.min(screen.width, screen.height) * (window.devicePixelRatio || 1) < 900;
      // celular: no máximo 'média' (telas com DPR 3 em 960p pesam demais; a resolução dinâmica ajusta o resto)
      if (this.isTouch) q = mem <= 3 || cores <= 4 ? 'low' : 'medium';
      else q = 'high';
      if (small && q === 'high') q = 'medium';
    } else q = settings.quality;
    this.quality = q;
  }

  applySettings() {
    audio.setVolumes(settings.music, settings.sfx);
    if (this.world) this.world.narrator.enabled = settings.narrator;
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
    const targetH = Math.min(h * dpr, MAX_H[this.quality]);
    this.pxScale = Math.max(1, (targetH / this.viewH) * this.renderScale);
    setDecoDensity((targetH / this.viewH) * 1.25);
    // textos do HUD na escala alvo (sem a resolução dinâmica): cada passo da resolução dinâmica não
    // obriga mais a recriar todas as imagens de texto (isso dava um engasgo a cada ajuste)
    setHudTextScale(Math.max(1, targetH / this.viewH));
    if (this.world) this.world.fx.popScale = Math.max(2, (targetH / this.viewH) * 1.3);
    this.canvas.width = Math.round(this.viewW * this.pxScale);
    this.canvas.height = Math.round(this.viewH * this.pxScale);
    if (this.world) {
      this.world.camera.viewW = this.viewW;
      this.world.camera.viewH = this.viewH;
    }
    // safe area (px lógicos)
    const cs = getComputedStyle(document.documentElement);
    const px = (v: string) => parseFloat(cs.getPropertyValue(v)) || 0;
    void px;
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

  play(again = false) {
    audio.init();
    audio.play('uiStart', 1);
    void this.requestFullscreenLandscape();
    if (orient.rot) this.menus.toast('Vire o celular de lado para jogar em tela cheia');
    this.menus.hideAll();
    this.menus.fade(false);
    this.stopIntroAudio();
    this.stopNarr(0.2);
    if (!this.world || again || this.state === 'complete') {
      this.world = new World(buildLevel());
      this.bindWorld(this.world);
    } else {
      this.world.restart();
    }
    const w = this.world;
    w.director.introArt = this.intro;
    w.narrator.enabled = settings.narrator;
    w.camera.viewW = this.viewW;
    w.camera.viewH = this.viewH;
    this.applyFxCaps();
    w.fx.popScale = Math.max(2, this.pxScale * 1.3);
    this.applyDebugParams(w);
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
    if (settings.narrator && !this.noOpening) w.director.startOpening();
    this.last = performance.now();
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
    w.hooks = {
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
      onBanner: (t, s, d) => this.hud.banner(t, s, d),
      onComplete: () => this.onComplete(),
      onMusic: (s) => this.setMusic(s),
      onHint: (key) => {
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

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.enabled = false;
    this.touch.show(false);
    this.menus.showPause();
    this.introClip?.pause();
    this.narrClip?.pause();
    audio.setDuck(0.3);
    audio.loop('glide', false);
    audio.loop('roll', false);
    audio.loop('alarm', false);
    this.updateRotate();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.menus.hidePause();
    this.state = 'playing';
    this.input.enabled = true;
    this.touch.show(!this.world?.director.longIntroActive() && (this.isTouch || this.input.touch.active));
    this.introClip?.resume();
    this.narrClip?.resume();
    audio.setDuck(1);
    this.last = performance.now();
    this.updateRotate();
  }

  restartLevel() {
    if (!this.world) return;
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
    this.last = performance.now();
    this.updateRotate();
  }

  toMenu(first = false) {
    this.stopIntroAudio();
    this.stopNarr(0.2);
    this.state = 'menu';
    this.input.enabled = false;
    this.touch.show(false);
    this.menus.hideAll();
    this.menus.showMain(first ? 'v4 • toque em JOGAR' : 'v4');
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
    this.last = performance.now();
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
    this.last = performance.now();
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
    this.last = performance.now();
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
    this.stopIntroAudio();
    this.state = 'gameover';
    this.input.enabled = false;
    this.touch.show(false);
    audio.setDuck(0.5);
    this.menus.showGameOver();
  }

  private beginRespawn() {
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
    progress.completed++;
    saveProgress();
    window.setTimeout(() => {
      this.menus.showResults({
        time: w.time, score: w.score, tokens: w.tokens, emblems: w.emblems.size, secrets: w.secrets.size, kills: w.stats.kills, deaths: w.stats.deaths, rank, newBest, bestCombo: w.bestCombo,
      });
      this.input.onMenuKey = (code) => {
        if (this.menus.handleKey(code)) return;
      };
    }, 400);
  }

  // ------------------------------------------------------------------ música
  private setMusic(s: MusicState | 'menu') {
    if (this.wasMusic === s) return;
    this.wasMusic = s;
    const m = (theme: ThemeName, mix: Parameters<typeof music.play>[1]) => music.play(theme, mix);
    switch (s) {
      case 'menu': m('menu', MIX.menu); break;
      case 'explore': m('stage', MIX.explore); break;
      case 'combat': m('stage', MIX.combat); break;
      case 'nomad': m('stage', MIX.nomad); break;
      case 'nomadCombat': m('stage', MIX.nomad); break;
      case 'calm': m('stage', MIX.calm); break;
      case 'boss1': m('boss', MIX.boss1); break;
      case 'boss2': m('boss', MIX.boss2); break;
      case 'boss3': m('boss', MIX.boss3); break;
      case 'victory': m('stage', MIX.victory); break;
      case 'silence': music.setMix({}, 0.15); break;
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
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;
    this.frames++;
    if (now - this.lastFpsUpdate > 500) {
      this.hud.fps = (this.frames * 1000) / (now - this.lastFpsUpdate);
      this.frames = 0;
      this.lastFpsUpdate = now;
    }
    this.autoQuality(dt, now);
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
  }

  private step(w: World, dt: number) {
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
      if (this.state !== 'playing') break; // a HQ congelou o mundo
    }
    this.updateNarrDuck(w);
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

  private processHints(w: World) {
    const p = w.player;
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
    this.touch.sync({ weaponIcon: icon, ammo: ammo === Infinity ? '∞' : String(ammo), lowAmmo: ammo !== Infinity && ammo < 10, grenades: p.grenades, dash01 });
  }

  /**
   * Resolução dinâmica (como nos consoles): se o quadro passa de ~21 ms, reduz a resolução interna
   * em passos de 10% (até 60%); quando sobra folga por alguns segundos, sobe de novo. Todos os
   * efeitos continuam ligados — só a nitidez varia, e pouco.
   */
  private dynamicResolution(dt: number) {
    if (this.state !== 'playing') {
      this.drsAcc = this.drsN = 0;
      return;
    }
    this.drsAcc += Math.min(dt, 0.1);
    this.drsN++;
    if (this.drsAcc < 1.2) return;
    const avg = this.drsAcc / this.drsN;
    this.drsAcc = this.drsN = 0;
    const minScale = this.isTouch ? 0.5 : 0.6;
    if (avg > 1 / 47 && this.renderScale > minScale + 0.01) {
      // só baixa com lentidão sustentada (2 janelas seguidas): cada troca realoca o canvas
      if (++this.drsBad >= 2) {
        this.renderScale = Math.max(minScale, +(this.renderScale - 0.1).toFixed(2));
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
    if (settings.quality !== 'auto' || this.state !== 'playing' || this.renderScale > (this.isTouch ? 0.51 : 0.61)) {
      this.frameTimes.length = 0;
      return;
    }
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 120) this.frameTimes.shift();
    if (now - this.lastQualityCheck < 3500 || this.frameTimes.length < 100) return;
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
    g.imageSmoothingQuality = 'medium';
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
    const cam = w.camera;
    const art = getArt();
    // fundo (espaço de tela)
    const atm = this.atmosphere(w);
    art.bg.draw(g, { camX: cam.x, camY: cam.y, viewW: W, viewH: H, time: w.time, sky: atm.sky, ruin: atm.ruin, refY: w.data.playerStart.y - 200, intensity: w.musicState.startsWith('boss') || w.musicState === 'combat' ? 1 : 0.6 }, this.state === 'playing' ? dt : 0);
    this.post.drawSkyFlash(g, W, H);
    // mundo
    const z = cam.zoom * k;
    const tx = Math.round(-(cam.x - cam.sx) * z + (W * k - W * k) / 2);
    const ty = Math.round(-(cam.y - cam.sy) * z);
    g.setTransform(z, 0, 0, z, tx, ty);
    w.drawWorld(g);
    // primeiro plano e HUD
    g.setTransform(k, 0, 0, k, 0, 0);
    art.bg.drawForeground(g, { camX: cam.x, camY: cam.y, viewW: W, viewH: H, time: w.time, sky: atm.sky, ruin: atm.ruin, refY: 0, intensity: 0.6 }, this.state === 'playing' ? dt : 0);
    if (this.state === 'playing') this.post.drawRain(g, w, W, H);
    this.post.bloom(g, this.canvas, this.quality);
    this.post.grade(g, W, H, this.quality);
    art.bg.drawVignette(g, W, H, 0.9);
    this.post.hurt(g, this.canvas, w.player.mode === 'dead' ? 0 : clamp(w.player.hurtT / 0.28, 0, 1));
    this.hud.drawScreenFx(g, w, W, H);
    if (this.state === 'comic' && this.comic) this.comic.draw(g, W, H);
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
