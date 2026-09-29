/**
 * Música original 100% procedural, em camadas, com agendamento por lookahead.
 * Temas: menu, fase (exploração → combate → Nômad) e Felipão (3 fases).
 */
import { audio } from './audio';
import { clamp } from './math';

export type Layer = 'pad' | 'bass' | 'arp' | 'hat' | 'kick' | 'snare' | 'lead' | 'power' | 'choir' | 'tom';
export type ThemeName = 'menu' | 'stage' | 'boss';

const LAYERS: Layer[] = ['pad', 'bass', 'arp', 'hat', 'kick', 'snare', 'lead', 'power', 'choir', 'tom'];
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface Chord {
  root: number; // baixo (midi)
  notes: number[]; // acorde (midi)
}

interface Theme {
  bpm: number;
  chords: Chord[]; // 1 compasso cada
  bassPat: string; // 16 passos: '.' pausa, 'x' raiz, 'o' oitava, '5' quinta
  kickPat: string;
  snarePat: string;
  hatPat: string;
  arpPat: number[]; // índice no acorde por passo (−1 = pausa)
  lead: (number | null)[][]; // por compasso, 16 passos (nota midi ou null)
  tomPat?: string;
  swing?: number;
}

// -------- Tema da fase: Ré menor, 124 bpm ------------------------------------
const STAGE: Theme = {
  bpm: 124,
  chords: [
    { root: 38, notes: [50, 53, 57, 62] }, // Dm
    { root: 34, notes: [46, 50, 53, 58] }, // Bb
    { root: 43, notes: [43, 46, 50, 55] }, // Gm
    { root: 45, notes: [45, 49, 52, 57] }, // A
  ],
  bassPat: 'x..x..x.x..x.o.x',
  kickPat: 'x...x...x...x..x',
  snarePat: '....x.......x...',
  hatPat: 'x.xxx.xxx.xxx.xx',
  arpPat: [0, 2, 1, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2],
  lead: [
    [74, null, null, 77, null, 81, null, 77, 74, null, null, null, 72, null, 74, null], // Dm
    [70, null, null, 74, null, 77, null, 74, 70, null, null, null, 69, null, 70, null], // Bb
    [67, null, null, 70, null, 74, null, 70, 67, null, 72, null, 70, null, 67, null], // Gm
    [69, null, 73, null, 76, null, 81, null, 80, null, 76, null, 73, null, 69, null], // A
  ],
  tomPat: '................',
};

// -------- Tema do menu: mesma harmonia, mais lenta e aérea --------------------
const MENU: Theme = { ...STAGE, bpm: 92, tomPat: '................' };

// -------- Tema do Felipão: Mi menor, 148 bpm ----------------------------------
const BOSS: Theme = {
  bpm: 148,
  chords: [
    { root: 40, notes: [52, 55, 59, 64] }, // Em
    { root: 40, notes: [52, 55, 59, 66] }, // Em (b13 tensão)
    { root: 36, notes: [48, 52, 55, 60] }, // C
    { root: 38, notes: [50, 54, 57, 62] }, // D
    { root: 40, notes: [52, 55, 59, 64] }, // Em
    { root: 41, notes: [53, 56, 60, 65] }, // F (frígio)
    { root: 36, notes: [48, 52, 55, 60] }, // C
    { root: 35, notes: [47, 51, 54, 59] }, // B7 (dominante)
  ],
  bassPat: 'xxoxxoxxxxoxxoxo',
  kickPat: 'x..xx..xx..xx.x.',
  snarePat: '....x.......x..x',
  hatPat: 'xxxxxxxxxxxxxxxx',
  arpPat: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 3, 2, 1, 0],
  lead: [
    [76, null, 76, 79, null, 76, null, 83, null, 82, null, 79, null, 76, null, null],
    [76, null, 76, 79, null, 76, null, 84, null, 83, null, 79, null, 78, null, null],
    [72, null, 72, 76, null, 79, null, 84, null, 83, null, 79, null, 76, null, null],
    [74, null, 74, 78, null, 81, null, 86, null, 85, null, 81, null, 78, null, null],
    [76, null, 79, null, 83, null, 88, null, 86, null, 83, null, 79, null, 76, null],
    [77, null, 80, null, 84, null, 89, null, 87, null, 84, null, 80, null, 77, null],
    [72, null, 76, 79, 84, null, 88, null, 84, 79, 76, null, 72, null, null, null],
    [71, null, 75, 78, 83, null, 87, null, 90, null, 87, null, 83, 78, 75, null],
  ],
  tomPat: '..x...x...x.xxxx',
};

const THEMES: Record<ThemeName, Theme> = { menu: MENU, stage: STAGE, boss: BOSS };

class MusicEngine {
  private layerGain = new Map<Layer, GainNode>();
  private layerTarget = new Map<Layer, number>();
  private delay: DelayNode | null = null;
  private send: GainNode | null = null;
  private timer: number | null = null;
  private theme: ThemeName | null = null;
  private step = 0;
  private nextTime = 0;
  private built = false;
  private reverbIn: GainNode | null = null;

  private build() {
    const c = audio.ctx;
    if (!c || this.built) return;
    this.built = true;
    for (const l of LAYERS) {
      const g = c.createGain();
      g.gain.value = 0;
      g.connect(audio.musicBus);
      this.layerGain.set(l, g);
      this.layerTarget.set(l, 0);
    }
    // eco (delay pontuado) para arp/lead
    this.delay = c.createDelay(1.5);
    this.delay.delayTime.value = 0.3;
    const fb = c.createGain();
    fb.gain.value = 0.38;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    this.delay.connect(lp);
    lp.connect(fb);
    fb.connect(this.delay);
    const wet = c.createGain();
    wet.gain.value = 0.5;
    lp.connect(wet);
    wet.connect(audio.musicBus);
    this.send = c.createGain();
    this.send.gain.value = 1;
    this.send.connect(this.delay);
    this.reverbIn = this.send;
  }

  /** Inicia (ou troca) o tema; `mix` são os níveis por camada. */
  play(theme: ThemeName, mix: Partial<Record<Layer, number>>) {
    if (!audio.ctx) return;
    this.build();
    if (this.theme !== theme) {
      this.theme = theme;
      this.step = 0;
      this.nextTime = audio.ctx.currentTime + 0.08;
      const bpm = THEMES[theme].bpm;
      if (this.delay) this.delay.delayTime.setTargetAtTime((60 / bpm) * 0.75, audio.ctx.currentTime, 0.05);
    }
    this.setMix(mix);
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), 25);
  }

  setMix(mix: Partial<Record<Layer, number>>, rate = 0.25) {
    const c = audio.ctx;
    if (!c) return;
    for (const l of LAYERS) {
      const v = clamp(mix[l] ?? 0, 0, 1);
      if (this.layerTarget.get(l) !== v) {
        this.layerTarget.set(l, v);
        this.layerGain.get(l)?.gain.setTargetAtTime(v, c.currentTime, rate);
      }
    }
  }

  stop(fade = 0.6) {
    const c = audio.ctx;
    if (!c) return;
    for (const l of LAYERS) {
      this.layerTarget.set(l, 0);
      this.layerGain.get(l)?.gain.setTargetAtTime(0, c.currentTime, fade / 3);
    }
    this.theme = null;
    if (this.timer !== null) {
      const t = this.timer;
      window.setTimeout(() => {
        if (this.theme === null) {
          window.clearInterval(t);
          if (this.timer === t) this.timer = null;
        }
      }, fade * 1000 + 200);
    }
  }

  get current() {
    return this.theme;
  }

  private on(l: Layer) {
    return (this.layerTarget.get(l) ?? 0) > 0.02;
  }

  private tick() {
    const c = audio.ctx;
    if (!c || !this.theme || c.state !== 'running') {
      if (c && this.theme) this.nextTime = Math.max(this.nextTime, c.currentTime + 0.05);
      return;
    }
    const th = THEMES[this.theme];
    const stepDur = 60 / th.bpm / 4;
    while (this.nextTime < c.currentTime + 0.14) {
      this.schedule(th, this.step, this.nextTime, stepDur);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  // ------------------------------------------------------------ instrumentos
  private dest(l: Layer) {
    return this.layerGain.get(l)!;
  }

  private kick(t: number) {
    const c = audio.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g);
    g.connect(this.dest('kick'));
    o.start(t);
    o.stop(t + 0.32);
  }

  private noiseHit(l: Layer, t: number, dur: number, type: BiquadFilterType, freq: number, vol: number, q = 0.8) {
    const c = audio.ctx!;
    const s = c.createBufferSource();
    s.buffer = audio.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.dest(l));
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
  }

  private snare(t: number) {
    this.noiseHit('snare', t, 0.16, 'bandpass', 1900, 0.55, 0.7);
    const c = audio.ctx!;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(240, t);
    o.frequency.exponentialRampToValueAtTime(130, t + 0.09);
    const g = c.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g);
    g.connect(this.dest('snare'));
    o.start(t);
    o.stop(t + 0.14);
  }

  private tom(t: number, f: number) {
    const c = audio.ctx!;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(f * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g);
    g.connect(this.dest('tom'));
    o.start(t);
    o.stop(t + 0.3);
  }

  private bassNote(l: Layer, t: number, midi: number, dur: number, drive = false) {
    const c = audio.ctx!;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = mtof(midi);
    const o2 = c.createOscillator();
    o2.type = 'square';
    o2.frequency.value = mtof(midi - 12);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = drive ? 5 : 3;
    f.frequency.setValueAtTime(drive ? 2200 : 1200, t);
    f.frequency.exponentialRampToValueAtTime(180, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(drive ? 0.45 : 0.36, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(this.dest(l));
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.03);
    o2.stop(t + dur + 0.03);
  }

  private padChord(l: Layer, t: number, notes: number[], dur: number, vol: number, bright: number) {
    const c = audio.ctx!;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(bright * 0.6, t);
    f.frequency.linearRampToValueAtTime(bright, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(bright * 0.6, t + dur);
    f.Q.value = 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    f.connect(g);
    g.connect(this.dest(l));
    for (const n of notes) {
      for (const det of [-9, 8]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(n);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    }
  }

  private pluck(l: Layer, t: number, midi: number, dur: number, vol: number, type: OscillatorType = 'square', echo = true) {
    const c = audio.ctx!;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = mtof(midi);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(4200, t);
    f.frequency.exponentialRampToValueAtTime(700, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(this.dest(l));
    if (echo && this.send) {
      const sg = c.createGain();
      sg.gain.value = 0.55;
      g.connect(sg);
      sg.connect(this.send);
    }
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private leadNote(t: number, midi: number, dur: number, vol: number) {
    const c = audio.ctx!;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = mtof(midi);
    const o2 = c.createOscillator();
    o2.type = 'square';
    o2.frequency.value = mtof(midi);
    o2.detune.value = 7;
    const lfo = c.createOscillator();
    lfo.frequency.value = 5.5;
    const lg = c.createGain();
    lg.gain.value = 8;
    lfo.connect(lg);
    lg.connect(o.detune);
    lg.connect(o2.detune);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 3200;
    f.Q.value = 1.4;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.setTargetAtTime(vol * 0.6, t + 0.02, 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(this.dest('lead'));
    if (this.send) {
      const sg = c.createGain();
      sg.gain.value = 0.4;
      g.connect(sg);
      sg.connect(this.send);
    }
    o.start(t);
    o2.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------ sequenciador
  private schedule(th: Theme, step: number, t: number, stepDur: number) {
    const bar = Math.floor(step / 16) % th.chords.length;
    const s = step % 16;
    const chord = th.chords[bar];
    const isBoss = th === BOSS;

    if (this.on('pad') && s === 0) {
      this.padChord('pad', t, chord.notes, stepDur * 16, isBoss ? 0.06 : 0.07, isBoss ? 1400 : 1900);
    }
    if (this.on('choir') && s === 0) {
      // "coro" sombrio: quintas abertas oitava acima, filtro estreito
      this.padChord('choir', t, [chord.notes[0] + 12, chord.notes[1] + 12, chord.notes[2] + 12, chord.notes[0] + 24], stepDur * 16, 0.05, 2600);
    }
    if (this.on('bass') || this.on('power')) {
      const ch = th.bassPat[s];
      if (ch !== '.') {
        const m = chord.root + (ch === 'o' ? 12 : ch === '5' ? 7 : 0);
        if (this.on('bass')) this.bassNote('bass', t, m, stepDur * (isBoss ? 1.6 : 2.2));
        if (this.on('power')) this.bassNote('power', t, m + 12, stepDur * 1.5, true);
      }
    }
    if (this.on('kick') && th.kickPat[s] === 'x') this.kick(t);
    if (this.on('snare') && th.snarePat[s] === 'x') this.snare(t);
    if (this.on('hat') && th.hatPat[s] === 'x') {
      this.noiseHit('hat', t, s % 4 === 2 ? 0.09 : 0.04, 'highpass', 7500, s % 2 === 0 ? 0.22 : 0.14, 0.6);
    }
    if (this.on('tom') && th.tomPat && th.tomPat[s] === 'x') this.tom(t, 90 + ((s * 7) % 5) * 12);
    if (this.on('arp')) {
      const idx = th.arpPat[s];
      if (idx >= 0) this.pluck('arp', t, chord.notes[idx] + 12, stepDur * 1.8, isBoss ? 0.1 : 0.12);
    }
    if (this.on('lead')) {
      const seq = th.lead[bar % th.lead.length];
      const n = seq[s];
      if (n !== null && n !== undefined) this.leadNote(t, n, stepDur * (isBoss ? 2.2 : 3.2), isBoss ? 0.11 : 0.1);
    }
  }
}

export const music = new MusicEngine();

/** Presets de mixagem usados pelo jogo. */
export const MIX = {
  menu: { pad: 0.9, bass: 0.55, arp: 0.7, hat: 0.25, kick: 0.5 } as Partial<Record<Layer, number>>,
  explore: { pad: 0.9, bass: 0.7, arp: 0.8, hat: 0.35, kick: 0.45 } as Partial<Record<Layer, number>>,
  combat: { pad: 0.8, bass: 0.9, arp: 0.7, hat: 0.7, kick: 0.9, snare: 0.8, lead: 0.5 } as Partial<Record<Layer, number>>,
  nomad: { pad: 0.8, bass: 0.9, arp: 0.6, hat: 0.9, kick: 1, snare: 1, lead: 0.85, power: 0.75 } as Partial<Record<Layer, number>>,
  boss1: { pad: 0.7, bass: 1, arp: 0.5, hat: 0.7, kick: 1, snare: 0.9, tom: 0.7 } as Partial<Record<Layer, number>>,
  boss2: { pad: 0.7, bass: 1, arp: 0.7, hat: 0.9, kick: 1, snare: 1, tom: 0.9, lead: 0.7, power: 0.5 } as Partial<Record<Layer, number>>,
  boss3: { pad: 0.7, bass: 1, arp: 0.8, hat: 1, kick: 1, snare: 1, tom: 1, lead: 1, power: 0.85, choir: 0.9 } as Partial<Record<Layer, number>>,
  calm: { pad: 0.8, arp: 0.5, bass: 0.4 } as Partial<Record<Layer, number>>,
  victory: { pad: 1, lead: 0.8, arp: 0.7, bass: 0.6 } as Partial<Record<Layer, number>>,
};
