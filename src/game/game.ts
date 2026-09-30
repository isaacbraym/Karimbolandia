import { orient } from '../core/orient';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { PostFX } from './post';
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

type State = 'loading' | 'menu' | 'playing' | 'paused' | 'complete' | 'continue' | 'gameover';

const CONTINUE_SECS = 10;

const MAX_H: Record<Quality, number> = { low: 540, medium: 720, high: 1080 };
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
  /** resolução dinâmica: fração da resolução alvo (0.6..1) — cai antes de qualquer efeito ser cortado */
  renderScale = 1;
  private drsAcc = 0;
  private drsN = 0;
  private drsGood = 0;

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
    this.input.onGesture = () => audio.init();
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
    await buildArt(base, this.quality, (p, l) => this.menus.setLoading(p, l));
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
      if (this.isTouch) q = mem <= 3 || cores <= 4 ? 'low' : mem <= 4 ? 'medium' : 'high';
      else q = 'high';
      if (small && q === 'high') q = 'medium';
    } else q = settings.quality;
    this.quality = q;
  }

  applySettings() {
    audio.setVolumes(settings.music, settings.sfx);
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
    setHudTextScale(this.pxScale);
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
    if (!this.world || again || this.state === 'complete') {
      this.world = new World(buildLevel());
      this.bindWorld(this.world);
    } else {
      this.world.restart();
    }
    const w = this.world;
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
    this.last = performance.now();
  }

  private bindWorld(w: World) {
    w.hooks = {
      onRespawn: () => this.beginRespawn(),
      onContinue: (lives) => this.askContinue(lives),
      onGameOver: () => this.gameOver(),
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
    this.touch.show(this.isTouch || this.input.touch.active);
    audio.setDuck(1);
    this.last = performance.now();
    this.updateRotate();
  }

  restartLevel() {
    if (!this.world) return;
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
    this.state = 'menu';
    this.input.enabled = false;
    this.touch.show(false);
    this.menus.hideAll();
    this.menus.showMain(first ? 'v1.0 • toque em JOGAR' : 'v1.0');
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

  private gameOver() {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    this.input.enabled = false;
    this.touch.show(false);
    audio.setDuck(0.5);
    this.menus.showGameOver();
  }

  private beginRespawn() {
    if (this.respawnPending || !this.world) return;
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
    if (q.get('qa') === '1') (window as unknown as { __kg?: unknown }).__kg = { game: this, world: w }; // QA no navegador
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
      if (sx > 600 * 32) w.nomadLost = true; // teleporte de teste além do portão do Nômad
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
    } else if (this.state === 'continue' && w) {
      // mundo congelado; contagem regressiva + confirmação por gamepad
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
    const n = Math.min(4, Math.max(1, Math.ceil(sdt / (1 / 55))));
    const h = sdt / n;
    for (let i = 0; i < n; i++) {
      w.update(h, this.input.state);
      if (i === 0) this.input.clearEdges();
    }
    this.hud.update(dt);
    this.post.update(w, dt, this.quality);
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
    if (avg > 1 / 47 && this.renderScale > 0.61) {
      this.renderScale = Math.max(0.6, +(this.renderScale - 0.1).toFixed(2));
      this.drsGood = 0;
      this.resize();
    } else if (avg < 1 / 57 && this.renderScale < 1) {
      if (++this.drsGood >= 4) {
        this.renderScale = Math.min(1, +(this.renderScale + 0.05).toFixed(2));
        this.drsGood = 0;
        this.resize();
      }
    } else this.drsGood = 0;
  }

  private autoQuality(dt: number, now: number) {
    this.dynamicResolution(dt);
    // só troca a qualidade se nem a resolução mínima der conta
    if (settings.quality !== 'auto' || this.state !== 'playing' || this.renderScale > 0.61) {
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
    this.hud.draw(g, w, W, H);
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
