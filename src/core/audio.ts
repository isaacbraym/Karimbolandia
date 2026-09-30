/**
 * Motor de áudio 100% procedural (WebAudio). Nenhum arquivo de som externo:
 * funciona offline e não usa material protegido.
 */
import { clamp } from './math';

export type SfxName =
  | 'pistol' | 'rifle' | 'shotgun' | 'launcher' | 'energy' | 'nomadShot'
  | 'explosion' | 'bigExplosion' | 'grenadeThrow' | 'grenadeBounce'
  | 'hit' | 'hitMetal' | 'shieldPing' | 'enemyHurt' | 'enemyDie' | 'robotDie' | 'crateBreak' | 'debris'
  | 'jump' | 'land' | 'step' | 'flap' | 'hurt' | 'die'
  | 'coin' | 'emblem' | 'secret' | 'pickup' | 'heal' | 'weapon' | 'checkpoint'
  | 'dash' | 'dash2' | 'dashHit' | 'nomadBoot' | 'nomadHop' | 'nomadHurt' | 'nomadDeath' | 'eject' | 'nomadEnter'
  | 'uiClick' | 'uiBack' | 'uiStart' | 'alarm' | 'warning' | 'lock' | 'unlock' | 'missile' | 'laserCharge' | 'laserFire'
  | 'enemyShot' | 'sniperShot' | 'turretShot' | 'stomp' | 'bossRoar' | 'bossHit' | 'bossPhase' | 'bossDie' | 'thruster'
  | 'victory' | 'servo' | 'spark' | 'slam' | 'burp' | 'burpBig' | 'crush' | 'extraLife' | 'thunder';

type LoopName = 'glide' | 'roll' | 'alarm' | 'laser' | 'thrusterLoop';

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  private comp!: DynamicsCompressorNode;
  noiseBuf!: AudioBuffer;
  private active = 0;
  private sfxVol = 0.9;
  private musicVol = 0.7;
  private duck = 1;
  private loops = new Map<LoopName, { nodes: AudioNode[]; params: Record<string, AudioParam | undefined>; gain: GainNode }>();
  private lastPlay = new Map<string, number>();
  muted = false;

  /** Deve ser chamado a partir de um gesto do usuário. */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AC) return;
    try {
      this.ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      return;
    }
    const c = this.ctx;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 18;
    this.comp.ratio.value = 6;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.2;
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    this.sfxBus = c.createGain();
    this.musicBus = c.createGain();
    this.sfxBus.connect(this.comp);
    this.musicBus.connect(this.comp);
    this.comp.connect(this.master);
    this.master.connect(c.destination);
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    if (c.state === 'suspended') void c.resume();
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setVolumes(music: number, sfx: number) {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
  }
  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.muted ? 0 : this.sfxVol, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.muted ? 0 : this.musicVol * 0.34 * this.duck, t, 0.05);
  }
  /** Abaixa a música (pausa/menus) sem parar o contexto. */
  setDuck(v: number) {
    this.duck = v;
    this.applyVolumes();
  }
  setMuted(m: boolean) {
    this.muted = m;
    this.applyVolumes();
  }
  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // ------------------------------------------------------------------ primitivas
  private out(pan = 0): AudioNode {
    const c = this.ctx!;
    if (pan !== 0 && typeof c.createStereoPanner === 'function') {
      const p = c.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      p.connect(this.sfxBus);
      return p;
    }
    return this.sfxBus;
  }

  private tone(o: {
    type?: OscillatorType; f0: number; f1?: number; dur: number; vol?: number; att?: number; delay?: number;
    pan?: number; q?: number; lp?: number; detune?: number; vib?: number; vibHz?: number;
  }) {
    const c = this.ctx!;
    const t0 = c.currentTime + (o.delay ?? 0);
    const osc = c.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(20, o.f0), t0);
    if (o.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = c.createGain();
    const vol = (o.vol ?? 0.3);
    const att = o.att ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    let node: AudioNode = osc;
    if (o.lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      f.Q.value = o.q ?? 0.7;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.out(o.pan ?? 0));
    if (o.vib) {
      const lfo = c.createOscillator();
      lfo.frequency.value = o.vibHz ?? 30;
      const lg = c.createGain();
      lg.gain.value = o.vib;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + o.dur + 0.05);
    }
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.05);
    this.active++;
    osc.onended = () => this.active--;
  }

  private noise(o: {
    dur: number; vol?: number; type?: BiquadFilterType; f0: number; f1?: number; q?: number; att?: number; delay?: number; pan?: number;
  }) {
    const c = this.ctx!;
    const t0 = c.currentTime + (o.delay ?? 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = o.type ?? 'lowpass';
    f.frequency.setValueAtTime(Math.max(30, o.f0), t0);
    if (o.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.f1), t0 + o.dur);
    f.Q.value = o.q ?? 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol ?? 0.3, t0 + (o.att ?? 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.out(o.pan ?? 0));
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + o.dur + 0.05);
    this.active++;
    src.onended = () => this.active--;
  }

  /**
   * Arroto de monstro: voz grave em dente-de-serra com "ronco" (modulação de amplitude irregular
   * ~24–38 Hz, como a glote vibrando), passando por dois formantes de boca e com o pitch caindo.
   */
  private burp(big: boolean, v: number, pan: number) {
    const c = this.ctx!;
    const t0 = c.currentTime;
    const dur = (big ? 1.25 : 0.62) * (0.85 + Math.random() * 0.35);
    const f0 = (big ? 62 : 78) * (0.85 + Math.random() * 0.3);
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0 * 1.35, t0);
    osc.frequency.exponentialRampToValueAtTime(f0, t0 + dur * 0.25);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.62, t0 + dur);
    // ronco: modulação de amplitude com frequência que oscila (soa "molhado"/irregular)
    const am = c.createGain();
    am.gain.value = 0.55;
    const lfo = c.createOscillator();
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(big ? 24 : 31, t0);
    lfo.frequency.linearRampToValueAtTime(big ? 17 : 22, t0 + dur);
    const lfoG = c.createGain();
    lfoG.gain.value = 0.45;
    lfo.connect(lfoG);
    lfoG.connect(am.gain);
    // jitter de pitch
    const jit = c.createOscillator();
    jit.type = 'triangle';
    jit.frequency.value = 7 + Math.random() * 5;
    const jitG = c.createGain();
    jitG.gain.value = f0 * 0.12;
    jit.connect(jitG);
    jitG.connect(osc.frequency);
    // formantes (vogal "ô/uó")
    const mk = (f: number, q: number, g: number) => {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(f * 1.25, t0);
      bp.frequency.exponentialRampToValueAtTime(f * 0.8, t0 + dur);
      bp.Q.value = q;
      const gg = c.createGain();
      gg.gain.value = g;
      am.connect(bp);
      bp.connect(gg);
      return gg;
    };
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(0.9 * v, t0 + 0.05);
    env.gain.setValueAtTime(0.9 * v, t0 + dur * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const f1 = mk(big ? 380 : 470, 4, 1.4);
    const f2 = mk(big ? 820 : 980, 6, 0.6);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    am.connect(lp);
    osc.connect(am);
    for (const n of [f1, f2, lp]) n.connect(env);
    env.connect(this.out(pan));
    for (const o of [osc, lfo, jit]) {
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }
    this.active++;
    osc.onended = () => this.active--;
    // "estalo" de garganta no início
    this.noise({ dur: 0.07, vol: 0.25 * v, type: 'bandpass', f0: 700, f1: 300, q: 2, pan });
  }

  // ------------------------------------------------------------------ efeitos
  /** vol: 0..1 (distância); pan: -1..1 */
  play(name: SfxName, vol = 1, pan = 0) {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    if (this.active > 56) return;
    const now = this.ctx.currentTime;
    // anti-spam: mesmo som muito rápido
    const last = this.lastPlay.get(name) ?? -1;
    const minGap = MIN_GAP[name] ?? 0.012;
    if (now - last < minGap) return;
    this.lastPlay.set(name, now);
    const v = clamp(vol, 0, 1.5);
    const r = 1 + (Math.random() - 0.5) * 0.08; // variação de pitch
    switch (name) {
      case 'pistol':
        this.noise({ dur: 0.09, vol: 0.32 * v, type: 'bandpass', f0: 2600, f1: 700, q: 0.9, pan });
        this.tone({ type: 'square', f0: 340 * r, f1: 90, dur: 0.08, vol: 0.16 * v, pan });
        break;
      case 'rifle':
        this.noise({ dur: 0.07, vol: 0.28 * v, type: 'bandpass', f0: 3000, f1: 900, q: 1, pan });
        this.tone({ type: 'sawtooth', f0: 420 * r, f1: 110, dur: 0.06, vol: 0.13 * v, pan, lp: 2200 });
        break;
      case 'shotgun':
        this.noise({ dur: 0.42, vol: 0.62 * v, type: 'lowpass', f0: 4200, f1: 240, q: 0.7, pan });
        this.tone({ type: 'sine', f0: 130 * r, f1: 38, dur: 0.32, vol: 0.5 * v, pan });
        this.noise({ dur: 0.05, vol: 0.4 * v, type: 'highpass', f0: 3500, pan });
        break;
      case 'nomadShot':
        this.noise({ dur: 0.62, vol: 0.85 * v, type: 'lowpass', f0: 3800, f1: 160, q: 0.7, pan });
        this.tone({ type: 'sine', f0: 100 * r, f1: 28, dur: 0.5, vol: 0.75 * v, pan });
        this.tone({ type: 'sawtooth', f0: 220, f1: 50, dur: 0.18, vol: 0.2 * v, pan, lp: 900 });
        this.noise({ dur: 0.06, vol: 0.5 * v, type: 'highpass', f0: 3000, pan });
        break;
      case 'launcher':
        this.tone({ type: 'sine', f0: 200 * r, f1: 55, dur: 0.22, vol: 0.5 * v, pan });
        this.noise({ dur: 0.2, vol: 0.3 * v, type: 'bandpass', f0: 900, f1: 300, pan });
        break;
      case 'energy':
        this.tone({ type: 'sawtooth', f0: 1500 * r, f1: 260, dur: 0.2, vol: 0.2 * v, pan, lp: 5000 });
        this.tone({ type: 'sine', f0: 2400, f1: 800, dur: 0.16, vol: 0.14 * v, pan, vib: 30, vibHz: 55 });
        this.noise({ dur: 0.1, vol: 0.12 * v, type: 'highpass', f0: 4500, pan });
        break;
      case 'explosion':
        this.noise({ dur: 0.85, vol: 0.85 * v, type: 'lowpass', f0: 2200, f1: 70, q: 0.6, pan });
        this.tone({ type: 'sine', f0: 90, f1: 26, dur: 0.7, vol: 0.85 * v, pan });
        this.noise({ dur: 0.08, vol: 0.5 * v, type: 'highpass', f0: 2000, pan });
        break;
      case 'bigExplosion':
        this.noise({ dur: 1.7, vol: 1.0 * v, type: 'lowpass', f0: 2600, f1: 50, q: 0.5, pan });
        this.tone({ type: 'sine', f0: 70, f1: 20, dur: 1.4, vol: 1.0 * v, pan });
        this.noise({ dur: 0.9, vol: 0.5 * v, type: 'bandpass', f0: 500, f1: 120, q: 0.6, delay: 0.12, pan });
        this.noise({ dur: 0.1, vol: 0.6 * v, type: 'highpass', f0: 2500, pan });
        break;
      case 'grenadeThrow':
        this.noise({ dur: 0.16, vol: 0.14 * v, type: 'bandpass', f0: 500, f1: 1400, q: 1, pan });
        break;
      case 'grenadeBounce':
        this.tone({ type: 'triangle', f0: 420, f1: 180, dur: 0.07, vol: 0.2 * v, pan });
        break;
      case 'hit':
        this.noise({ dur: 0.05, vol: 0.18 * v, type: 'bandpass', f0: 1800, f1: 900, q: 1.2, pan });
        this.tone({ type: 'triangle', f0: 240 * r, f1: 120, dur: 0.05, vol: 0.12 * v, pan });
        break;
      case 'hitMetal':
        this.tone({ type: 'square', f0: 1300 * r, f1: 900, dur: 0.06, vol: 0.09 * v, pan });
        this.noise({ dur: 0.05, vol: 0.14 * v, type: 'highpass', f0: 3500, pan });
        break;
      case 'shieldPing':
        this.tone({ type: 'sine', f0: 2100 * r, f1: 1800, dur: 0.22, vol: 0.2 * v, pan });
        this.tone({ type: 'sine', f0: 3300, dur: 0.15, vol: 0.08 * v, pan });
        this.noise({ dur: 0.03, vol: 0.16 * v, type: 'highpass', f0: 5000, pan });
        break;
      case 'enemyHurt':
        this.tone({ type: 'sawtooth', f0: 380 * r, f1: 150, dur: 0.12, vol: 0.14 * v, pan, lp: 1800 });
        break;
      case 'enemyDie':
        this.tone({ type: 'sawtooth', f0: 420 * r, f1: 70, dur: 0.32, vol: 0.2 * v, pan, lp: 1400 });
        this.noise({ dur: 0.2, vol: 0.2 * v, type: 'lowpass', f0: 1800, f1: 200, pan });
        break;
      case 'robotDie':
        this.noise({ dur: 0.55, vol: 0.5 * v, type: 'lowpass', f0: 2600, f1: 120, pan });
        this.tone({ type: 'square', f0: 220, f1: 40, dur: 0.4, vol: 0.2 * v, pan, lp: 1200 });
        this.tone({ type: 'sine', f0: 80, f1: 30, dur: 0.4, vol: 0.4 * v, pan });
        break;
      case 'crateBreak':
        this.noise({ dur: 0.22, vol: 0.4 * v, type: 'bandpass', f0: 1200, f1: 300, q: 0.7, pan });
        this.tone({ type: 'triangle', f0: 180, f1: 70, dur: 0.14, vol: 0.2 * v, pan });
        break;
      case 'debris':
        this.noise({ dur: 0.1, vol: 0.14 * v, type: 'highpass', f0: 2200, pan });
        break;
      case 'jump':
        this.tone({ type: 'sine', f0: 260 * r, f1: 560, dur: 0.13, vol: 0.14 * v, pan });
        break;
      case 'flap':
        this.tone({ type: 'sine', f0: 320, f1: 900, dur: 0.16, vol: 0.14 * v, pan });
        this.noise({ dur: 0.14, vol: 0.12 * v, type: 'bandpass', f0: 900, f1: 2400, q: 1.5, pan });
        break;
      case 'land':
        this.noise({ dur: 0.09, vol: 0.2 * v, type: 'lowpass', f0: 700, f1: 200, pan });
        break;
      case 'step':
        this.noise({ dur: 0.04, vol: 0.06 * v, type: 'lowpass', f0: 1400 * r, f1: 500, pan });
        break;
      case 'hurt':
        this.tone({ type: 'sawtooth', f0: 520, f1: 140, dur: 0.28, vol: 0.28 * v, lp: 2000 });
        this.noise({ dur: 0.12, vol: 0.2 * v, type: 'bandpass', f0: 1500, f1: 400 });
        break;
      case 'die':
        this.tone({ type: 'sawtooth', f0: 600, f1: 60, dur: 0.9, vol: 0.28 * v, lp: 1800 });
        this.tone({ type: 'square', f0: 300, f1: 40, dur: 0.9, vol: 0.12 * v, lp: 900 });
        break;
      case 'coin':
        this.tone({ type: 'square', f0: 988, dur: 0.06, vol: 0.09 * v, pan });
        this.tone({ type: 'square', f0: 1319, dur: 0.16, vol: 0.09 * v, delay: 0.06, pan });
        break;
      case 'emblem':
        [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.22, vol: 0.2 * v, delay: i * 0.07, pan }));
        break;
      case 'secret':
        [392, 494, 587, 784, 988, 1175].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.3, vol: 0.2 * v, delay: i * 0.08 }));
        this.tone({ type: 'sine', f0: 1568, dur: 0.9, vol: 0.12 * v, delay: 0.4, vib: 12, vibHz: 6 });
        break;
      case 'pickup':
        this.tone({ type: 'triangle', f0: 600, f1: 1200, dur: 0.12, vol: 0.18 * v, pan });
        this.tone({ type: 'triangle', f0: 900, f1: 1500, dur: 0.12, vol: 0.14 * v, delay: 0.09, pan });
        break;
      case 'heal':
        [659, 784, 988].forEach((f, i) => this.tone({ type: 'sine', f0: f, dur: 0.24, vol: 0.2 * v, delay: i * 0.09 }));
        break;
      case 'weapon':
        this.tone({ type: 'square', f0: 300, f1: 600, dur: 0.1, vol: 0.14 * v });
        this.noise({ dur: 0.08, vol: 0.2 * v, type: 'bandpass', f0: 2500, f1: 1500 });
        this.tone({ type: 'square', f0: 500, f1: 900, dur: 0.12, vol: 0.14 * v, delay: 0.1 });
        break;
      case 'checkpoint':
        [523, 784, 1047].forEach((f, i) => this.tone({ type: 'sine', f0: f, dur: 0.4, vol: 0.2 * v, delay: i * 0.1 }));
        break;
      case 'dash':
        this.noise({ dur: 0.4, vol: 0.5 * v, type: 'bandpass', f0: 300, f1: 3200, q: 1.2, pan });
        this.tone({ type: 'sawtooth', f0: 90, f1: 240, dur: 0.3, vol: 0.3 * v, lp: 800, pan });
        break;
      case 'dash2':
        this.noise({ dur: 0.6, vol: 0.7 * v, type: 'bandpass', f0: 200, f1: 4500, q: 1, pan });
        this.tone({ type: 'sawtooth', f0: 70, f1: 320, dur: 0.5, vol: 0.4 * v, lp: 1200, pan });
        this.tone({ type: 'square', f0: 660, f1: 1320, dur: 0.3, vol: 0.12 * v, pan });
        break;
      case 'dashHit':
        this.noise({ dur: 0.16, vol: 0.5 * v, type: 'lowpass', f0: 2500, f1: 200, pan });
        this.tone({ type: 'sine', f0: 120, f1: 40, dur: 0.16, vol: 0.5 * v, pan });
        break;
      case 'nomadBoot':
        this.tone({ type: 'sawtooth', f0: 60, f1: 420, dur: 1.4, vol: 0.28 * v, lp: 1600, att: 0.2 });
        this.tone({ type: 'square', f0: 220, f1: 880, dur: 0.9, vol: 0.1 * v, delay: 0.3, lp: 2400 });
        this.noise({ dur: 1.2, vol: 0.2 * v, type: 'bandpass', f0: 200, f1: 2600, q: 1.5 });
        [392, 523, 784].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.3, vol: 0.2 * v, delay: 1.1 + i * 0.1 }));
        break;
      case 'nomadEnter':
        this.noise({ dur: 0.3, vol: 0.35 * v, type: 'lowpass', f0: 1800, f1: 200 });
        this.tone({ type: 'sine', f0: 140, f1: 60, dur: 0.3, vol: 0.5 * v });
        this.tone({ type: 'square', f0: 700, f1: 1400, dur: 0.15, vol: 0.12 * v, delay: 0.15 });
        break;
      case 'nomadHop':
        this.tone({ type: 'sawtooth', f0: 140, f1: 320, dur: 0.18, vol: 0.2 * v, lp: 900, pan });
        this.noise({ dur: 0.14, vol: 0.2 * v, type: 'lowpass', f0: 1200, f1: 300, pan });
        break;
      case 'nomadHurt':
        this.noise({ dur: 0.18, vol: 0.4 * v, type: 'bandpass', f0: 1800, f1: 400, pan });
        this.tone({ type: 'square', f0: 200, f1: 80, dur: 0.18, vol: 0.2 * v, lp: 1000, pan });
        break;
      case 'nomadDeath':
        this.noise({ dur: 1.4, vol: 0.9 * v, type: 'lowpass', f0: 2400, f1: 60 });
        this.tone({ type: 'sine', f0: 80, f1: 22, dur: 1.2, vol: 0.9 * v });
        this.tone({ type: 'sawtooth', f0: 440, f1: 40, dur: 1.0, vol: 0.2 * v, lp: 1500 });
        break;
      case 'eject':
        this.noise({ dur: 0.5, vol: 0.4 * v, type: 'bandpass', f0: 400, f1: 3000, q: 1 });
        this.tone({ type: 'sine', f0: 300, f1: 900, dur: 0.4, vol: 0.2 * v });
        break;
      case 'uiClick':
        this.tone({ type: 'triangle', f0: 720, f1: 1040, dur: 0.06, vol: 0.16 * v });
        break;
      case 'uiBack':
        this.tone({ type: 'triangle', f0: 620, f1: 380, dur: 0.08, vol: 0.16 * v });
        break;
      case 'uiStart':
        [330, 494, 659, 988].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: 0.16, vol: 0.1 * v, delay: i * 0.06, lp: 2600 }));
        this.noise({ dur: 0.5, vol: 0.2 * v, type: 'bandpass', f0: 300, f1: 2400, q: 1 });
        break;
      case 'alarm':
        this.tone({ type: 'square', f0: 660, dur: 0.16, vol: 0.09 * v, lp: 1600 });
        this.tone({ type: 'square', f0: 880, dur: 0.16, vol: 0.09 * v, delay: 0.18, lp: 1600 });
        break;
      case 'warning':
        for (let i = 0; i < 3; i++) this.tone({ type: 'sawtooth', f0: 300, f1: 520, dur: 0.32, vol: 0.18 * v, delay: i * 0.4, lp: 1400 });
        break;
      case 'lock':
        this.noise({ dur: 0.2, vol: 0.35 * v, type: 'bandpass', f0: 300, f1: 1600, q: 1.5 });
        this.tone({ type: 'square', f0: 200, f1: 100, dur: 0.24, vol: 0.2 * v, lp: 800 });
        break;
      case 'unlock':
        this.tone({ type: 'sine', f0: 440, f1: 880, dur: 0.25, vol: 0.2 * v });
        this.tone({ type: 'sine', f0: 660, f1: 1320, dur: 0.25, vol: 0.14 * v, delay: 0.1 });
        break;
      case 'missile':
        this.noise({ dur: 0.8, vol: 0.32 * v, type: 'bandpass', f0: 1800, f1: 350, q: 0.8, pan });
        this.tone({ type: 'sawtooth', f0: 500, f1: 120, dur: 0.6, vol: 0.1 * v, lp: 800, pan });
        break;
      case 'laserCharge':
        this.tone({ type: 'sawtooth', f0: 100, f1: 900, dur: 1.0, vol: 0.2 * v, lp: 2600, att: 0.3 });
        this.tone({ type: 'sine', f0: 400, f1: 2400, dur: 1.0, vol: 0.12 * v, vib: 40, vibHz: 20 });
        break;
      case 'laserFire':
        this.noise({ dur: 0.9, vol: 0.5 * v, type: 'bandpass', f0: 1200, f1: 400, q: 0.7 });
        this.tone({ type: 'sawtooth', f0: 180, f1: 120, dur: 0.9, vol: 0.32 * v, lp: 1800, vib: 20, vibHz: 40 });
        break;
      case 'enemyShot':
        this.noise({ dur: 0.07, vol: 0.14 * v, type: 'bandpass', f0: 2000, f1: 700, q: 1, pan });
        this.tone({ type: 'square', f0: 260 * r, f1: 100, dur: 0.07, vol: 0.09 * v, pan, lp: 1800 });
        break;
      case 'sniperShot':
        this.noise({ dur: 0.35, vol: 0.5 * v, type: 'bandpass', f0: 3500, f1: 500, q: 0.8, pan });
        this.tone({ type: 'sawtooth', f0: 600, f1: 60, dur: 0.3, vol: 0.28 * v, pan, lp: 2000 });
        break;
      case 'turretShot':
        this.tone({ type: 'square', f0: 460 * r, f1: 130, dur: 0.09, vol: 0.12 * v, pan, lp: 1800 });
        this.noise({ dur: 0.06, vol: 0.14 * v, type: 'bandpass', f0: 2200, f1: 900, pan });
        break;
      case 'burp':
        this.burp(false, v, pan);
        break;
      case 'burpBig':
        this.burp(true, v, pan);
        break;
      case 'crush':
        this.noise({ dur: 0.22, vol: 0.5 * v, type: 'lowpass', f0: 2400, f1: 200, pan });
        this.tone({ type: 'square', f0: 140 * r, f1: 40, dur: 0.18, vol: 0.22 * v, lp: 900, pan });
        this.noise({ dur: 0.1, vol: 0.25 * v, type: 'highpass', f0: 2500, pan, delay: 0.03 });
        break;
      case 'thunder':
        this.noise({ dur: 0.35, vol: 0.45 * v, type: 'lowpass', f0: 3000, f1: 400 });
        this.noise({ dur: 2.6, vol: 0.55 * v, type: 'lowpass', f0: 420, f1: 60, att: 0.12, delay: 0.05 });
        this.tone({ type: 'sine', f0: 55, f1: 28, dur: 2.2, vol: 0.4 * v, att: 0.2 });
        break;
      case 'extraLife':
        for (let i = 0; i < 4; i++) this.tone({ type: 'square', f0: [523, 659, 784, 1047][i], dur: 0.16, vol: 0.18 * v, delay: i * 0.09, lp: 3500 });
        this.tone({ type: 'triangle', f0: 1047, f1: 2093, dur: 0.5, vol: 0.2 * v, delay: 0.36 });
        break;
      case 'stomp':
        this.tone({ type: 'sine', f0: 110, f1: 30, dur: 0.35, vol: 0.7 * v, pan });
        this.noise({ dur: 0.3, vol: 0.4 * v, type: 'lowpass', f0: 800, f1: 90, pan });
        break;
      case 'slam':
        this.tone({ type: 'sine', f0: 90, f1: 22, dur: 0.6, vol: 0.9 * v });
        this.noise({ dur: 0.6, vol: 0.7 * v, type: 'lowpass', f0: 1600, f1: 70 });
        this.noise({ dur: 0.08, vol: 0.4 * v, type: 'highpass', f0: 3000 });
        break;
      case 'bossRoar':
        this.tone({ type: 'sawtooth', f0: 110, f1: 55, dur: 1.4, vol: 0.4 * v, lp: 900, att: 0.08, vib: 14, vibHz: 22 });
        this.tone({ type: 'square', f0: 82, f1: 41, dur: 1.4, vol: 0.28 * v, lp: 500, att: 0.08 });
        this.noise({ dur: 1.2, vol: 0.25 * v, type: 'lowpass', f0: 900, f1: 200, att: 0.1 });
        break;
      case 'bossHit':
        this.noise({ dur: 0.1, vol: 0.2 * v, type: 'bandpass', f0: 1000, f1: 400, q: 1 });
        this.tone({ type: 'sine', f0: 160, f1: 80, dur: 0.1, vol: 0.28 * v });
        break;
      case 'bossPhase':
        this.tone({ type: 'sawtooth', f0: 80, f1: 40, dur: 1.6, vol: 0.4 * v, lp: 700, att: 0.05 });
        this.noise({ dur: 1.4, vol: 0.5 * v, type: 'lowpass', f0: 2000, f1: 60 });
        this.tone({ type: 'sine', f0: 60, f1: 20, dur: 1.4, vol: 0.7 * v });
        break;
      case 'bossDie':
        this.noise({ dur: 2.6, vol: 1.0 * v, type: 'lowpass', f0: 3000, f1: 40, q: 0.5 });
        this.tone({ type: 'sine', f0: 65, f1: 18, dur: 2.2, vol: 1.0 * v });
        this.tone({ type: 'sawtooth', f0: 320, f1: 30, dur: 2.0, vol: 0.25 * v, lp: 1400 });
        break;
      case 'thruster':
        this.noise({ dur: 0.5, vol: 0.4 * v, type: 'bandpass', f0: 600, f1: 250, q: 0.6, pan });
        break;
      case 'victory':
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.34, vol: 0.22 * v, delay: i * 0.13 }));
        [262, 330, 392].forEach((f) => this.tone({ type: 'sawtooth', f0: f, dur: 1.4, vol: 0.06 * v, delay: 0.9, lp: 1400 }));
        break;
      case 'servo':
        this.tone({ type: 'sawtooth', f0: 200, f1: 420, dur: 0.14, vol: 0.06 * v, lp: 1200, pan });
        break;
      case 'spark':
        this.noise({ dur: 0.05, vol: 0.12 * v, type: 'highpass', f0: 4000 + Math.random() * 3000, pan });
        break;
    }
  }

  // ------------------------------------------------------------------ loops contínuos
  /**
   * Zumbido de pernilongo (glide), rolagem da esfera do Nômad, alarme, laser.
   * `params`: speed/pitch de 0..1 conforme o loop.
   */
  loop(name: LoopName, on: boolean, a = 0, b = 0) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const c = this.ctx;
    let L = this.loops.get(name);
    if (!on) {
      if (L) {
        L.gain.gain.setTargetAtTime(0, c.currentTime, 0.04);
        const nodes = L.nodes;
        this.loops.delete(name);
        setTimeout(() => nodes.forEach((n) => { try { (n as OscillatorNode).stop?.(); n.disconnect(); } catch { /* ok */ } }), 300);
      }
      return;
    }
    if (!L) {
      const gain = c.createGain();
      gain.gain.value = 0;
      gain.connect(this.sfxBus);
      const nodes: AudioNode[] = [gain];
      const params: Record<string, AudioParam | undefined> = {};
      if (name === 'glide') {
        // BZZZZ: serra + serra desafinada + vibrato rápido + ruído de asa
        const o1 = c.createOscillator();
        o1.type = 'sawtooth';
        const o2 = c.createOscillator();
        o2.type = 'square';
        o2.detune.value = 14;
        const lfo = c.createOscillator();
        lfo.frequency.value = 34;
        const lg = c.createGain();
        lg.gain.value = 12;
        lfo.connect(lg);
        lg.connect(o1.frequency);
        lg.connect(o2.frequency);
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 900;
        bp.Q.value = 1.6;
        const g1 = c.createGain();
        g1.gain.value = 0.5;
        o1.connect(bp);
        o2.connect(g1);
        g1.connect(bp);
        bp.connect(gain);
        // ruído de asas (tremolo)
        const ns = c.createBufferSource();
        ns.buffer = this.noiseBuf;
        ns.loop = true;
        const nf = c.createBiquadFilter();
        nf.type = 'bandpass';
        nf.frequency.value = 2400;
        nf.Q.value = 2;
        const ng = c.createGain();
        ng.gain.value = 0.25;
        const trem = c.createOscillator();
        trem.frequency.value = 22;
        const tg = c.createGain();
        tg.gain.value = 0.2;
        trem.connect(tg);
        tg.connect(ng.gain);
        ns.connect(nf);
        nf.connect(ng);
        ng.connect(gain);
        [o1, o2, lfo, trem].forEach((o) => o.start());
        ns.start();
        nodes.push(o1, o2, lfo, trem, ns, bp, nf, ng, g1, lg, tg);
        params.f1 = o1.frequency;
        params.f2 = o2.frequency;
        params.bp = bp.frequency;
        params.lfo = lfo.frequency;
      } else if (name === 'roll') {
        const ns = c.createBufferSource();
        ns.buffer = this.noiseBuf;
        ns.loop = true;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 300;
        lp.Q.value = 2;
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 50;
        const og = c.createGain();
        og.gain.value = 0.35;
        const olp = c.createBiquadFilter();
        olp.type = 'lowpass';
        olp.frequency.value = 260;
        ns.connect(lp);
        lp.connect(gain);
        o.connect(olp);
        olp.connect(og);
        og.connect(gain);
        ns.start();
        o.start();
        nodes.push(ns, lp, o, og, olp);
        params.f = lp.frequency;
        params.o = o.frequency;
      } else if (name === 'alarm') {
        const o = c.createOscillator();
        o.type = 'square';
        const lfo = c.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 2.4;
        const lg = c.createGain();
        lg.gain.value = 110;
        lfo.connect(lg);
        lg.connect(o.frequency);
        o.frequency.value = 770;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1500;
        o.connect(lp);
        lp.connect(gain);
        o.start();
        lfo.start();
        nodes.push(o, lfo, lg, lp);
      } else if (name === 'laser') {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 140;
        const lfo = c.createOscillator();
        lfo.frequency.value = 38;
        const lg = c.createGain();
        lg.gain.value = 40;
        lfo.connect(lg);
        lg.connect(o.frequency);
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1400;
        o.connect(lp);
        lp.connect(gain);
        o.start();
        lfo.start();
        nodes.push(o, lfo, lg, lp);
      } else {
        // thrusterLoop
        const ns = c.createBufferSource();
        ns.buffer = this.noiseBuf;
        ns.loop = true;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 500;
        bp.Q.value = 0.6;
        ns.connect(bp);
        bp.connect(gain);
        ns.start();
        nodes.push(ns, bp);
      }
      L = { nodes, params, gain };
      this.loops.set(name, L);
    }
    const t = c.currentTime;
    const p = L.params;
    if (name === 'glide') {
      // a: 0..1 (velocidade), b: -1..1 (subindo/descendo)
      const base = 340 + a * 160 + b * 90;
      p.f1?.setTargetAtTime(base, t, 0.05);
      p.f2?.setTargetAtTime(base * 1.005, t, 0.05);
      p.bp?.setTargetAtTime(base * 2.3, t, 0.08);
      p.lfo?.setTargetAtTime(30 + a * 12, t, 0.1);
      L.gain.gain.setTargetAtTime(0.16, t, 0.05);
    } else if (name === 'roll') {
      p.f?.setTargetAtTime(150 + a * 900, t, 0.06);
      p.o?.setTargetAtTime(38 + a * 90, t, 0.06);
      L.gain.gain.setTargetAtTime(clamp(a * 0.55, 0, 0.5) * (b || 1), t, 0.06);
    } else if (name === 'alarm') {
      L.gain.gain.setTargetAtTime(0.06 * (a || 1), t, 0.05);
    } else if (name === 'laser') {
      L.gain.gain.setTargetAtTime(0.22, t, 0.05);
    } else {
      L.gain.gain.setTargetAtTime(0.25 * (a || 1), t, 0.05);
    }
  }

  stopAllLoops() {
    for (const n of [...this.loops.keys()]) this.loop(n, false);
  }
}

const MIN_GAP: Partial<Record<SfxName, number>> = {
  burp: 0.5,
  burpBig: 0.9,
  crush: 0.05,
  step: 0.08,
  spark: 0.03,
  debris: 0.03,
  hit: 0.02,
  hitMetal: 0.03,
  rifle: 0.03,
  coin: 0.03,
  servo: 0.1,
  enemyShot: 0.03,
  turretShot: 0.04,
  pistol: 0.03,
};

export const audio = new AudioEngine();
