/**
 * Música original 100% procedural, em camadas, com agendamento por lookahead.
 * Temas: menu, fase (exploração → combate → Nômad) e Felipão (3 fases).
 */
import { audio } from './audio';
import { clamp } from './math';

export type Layer = 'pad' | 'bass' | 'arp' | 'hat' | 'kick' | 'snare' | 'lead' | 'power' | 'choir' | 'tom';
export type ThemeName = 'menu' | 'stage' | 'boss' | 'jungle' | 'rave' | 'monument' | 'fight' | 'chase';

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
  /** selva: tambores, chocalho, marimba, flauta e bordão (em vez de sintetizadores) */
  tribal?: boolean;
  /** congas da selva: 'l' grave, 'm' médio, 'h' agudo, 'x' tapa */
  congaPat?: string;
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

// -------- Tema da selva (fase 2): Sol maior, 128 bpm — tribal animado e "chiclete" --------
// (na linha de Crash Bandicoot / Donkey Kong Country: refrão curto de flauta + marimba que volta
// sempre, baixo saltitante, congas e chocalho constantes, frases de pergunta e resposta)
const JUNGLE: Theme = {
  bpm: 128,
  tribal: true,
  chords: [
    { root: 43, notes: [55, 59, 62, 67] }, // G
    { root: 43, notes: [55, 59, 62, 67] }, // G
    { root: 36, notes: [48, 52, 55, 60] }, // C
    { root: 38, notes: [50, 54, 57, 62] }, // D
    { root: 43, notes: [55, 59, 62, 67] }, // G
    { root: 40, notes: [52, 55, 59, 64] }, // Em
    { root: 36, notes: [48, 52, 55, 60] }, // C
    { root: 38, notes: [50, 54, 57, 62] }, // D (volta para o G)
  ],
  bassPat: 'x..xo.x.x..xo.xo',
  kickPat: 'x...x...x...x...',
  snarePat: '....x.......x..x',
  hatPat: 'xxxxxxxxxxxxxxxx',
  arpPat: [0, -1, 2, -1, 1, 3, -1, 2, 0, -1, 2, 3, -1, 1, 2, -1],
  congaPat: 'l.hhm.h.l.hhm.hm',
  lead: [
    // refrão (pergunta)
    [79, null, 83, 86, null, 83, 79, null, 81, null, 83, null, 86, null, null, null],
    [88, null, 86, 83, null, 81, 79, null, 81, null, 79, null, 76, null, null, null],
    [76, null, 79, 84, null, 79, 76, null, 79, null, 81, null, 84, null, null, null],
    [86, null, 84, 81, null, 78, 74, null, 78, null, 81, null, 74, null, null, null],
    // refrão (resposta, sobe e fecha)
    [79, null, 83, 86, null, 83, 79, null, 81, null, 83, null, 86, null, null, null],
    [88, null, 86, 83, null, 79, 76, null, 79, null, 83, null, 88, null, 86, null],
    [84, null, 81, 79, null, 76, null, 74, 76, null, 79, null, 84, null, null, null],
    [86, null, 88, null, 86, 81, null, 78, 81, null, 86, null, 91, null, null, null],
  ],
};

// -------- Balada (fase 1): Lá menor, 150 bpm — eletrônica frenética ----------
// bumbo 4×4, chimbal em semicolcheias, baixo pulsando no contratempo, arpejo rápido e um riff
// de sintetizador que gruda (pergunta e resposta), com virada de caixa no fim de cada volta
const RAVE: Theme = {
  bpm: 150,
  chords: [
    { root: 45, notes: [57, 60, 64, 69] }, // Am
    { root: 41, notes: [53, 57, 60, 65] }, // F
    { root: 48, notes: [55, 60, 64, 67] }, // C
    { root: 43, notes: [55, 59, 62, 67] }, // G
  ],
  bassPat: '.o.o.o.o.o.o.o.o',
  kickPat: 'x...x...x...x...',
  snarePat: '....x.......x.xx',
  hatPat: 'xxxxxxxxxxxxxxxx',
  arpPat: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 3, 0, 3, 1, 2],
  lead: [
    [81, null, 81, 84, null, 81, 79, null, 76, null, 79, null, 81, null, 84, 86],
    [84, null, 84, 81, null, 77, 76, null, 77, null, 81, null, 84, null, 81, null],
    [79, null, 79, 84, null, 88, 86, null, 84, null, 79, null, 76, null, 79, 81],
    [86, null, 83, 79, null, 83, 86, null, 91, null, 88, null, 86, 83, 79, null],
  ],
  tomPat: '..............xx',
};

// -------- Monumento (Praça do Pensador): Ré menor, 66 bpm — épico, lento e solene ------------
// pad e coro enormes, tímpano marcando a cada dois tempos, arpejo esparso e uma melodia larga
const MONUMENT: Theme = {
  bpm: 66,
  chords: [
    { root: 38, notes: [50, 53, 57, 62] }, // Dm
    { root: 34, notes: [46, 50, 53, 58] }, // Bb
    { root: 43, notes: [55, 58, 62, 67] }, // Gm
    { root: 33, notes: [45, 49, 52, 57] }, // A
  ],
  bassPat: 'x.......o.......',
  kickPat: 'x.......x.......',
  snarePat: '................',
  hatPat: '................',
  arpPat: [0, -1, -1, -1, 2, -1, -1, -1, 1, -1, -1, -1, 3, -1, -1, -1],
  tomPat: 'x.......x...x...',
  lead: [
    [74, null, null, null, null, null, null, null, 77, null, null, null, 81, null, null, null],
    [82, null, null, null, null, null, 81, null, 77, null, null, null, null, null, null, null],
    [79, null, null, null, 82, null, null, null, 86, null, null, null, null, null, 84, null],
    [85, null, null, null, 81, null, null, null, 76, null, null, null, 81, null, null, null],
  ],
};

// -------- Luta de rua (boxe do jacaré): Mi menor, 132 bpm — tambor tribal, palmas no "BRI-GA!" --------
const FIGHT: Theme = {
  bpm: 132,
  tribal: true,
  chords: [
    { root: 40, notes: [52, 55, 59, 64] }, // Em
    { root: 40, notes: [52, 55, 59, 64] }, // Em
    { root: 36, notes: [48, 52, 55, 60] }, // C
    { root: 43, notes: [55, 59, 62, 67] }, // G
  ],
  bassPat: 'x..xo.x.x..xo.x.',
  kickPat: 'x...x...x...x...',
  snarePat: '....x.......x...',
  hatPat: 'x.x.x.x.x.x.x.x.',
  arpPat: [0, -1, 2, -1, 1, -1, 3, -1, 0, -1, 2, -1, 3, -1, 1, 2],
  congaPat: 'l.hhm.h.l.hhm.xh',
  tomPat: '..x...x...x...xx',
  lead: [
    [76, null, null, 79, null, 83, null, null, 81, null, 79, null, 76, null, null, null],
    [76, null, null, 79, null, 83, null, null, 86, null, 83, null, 81, null, null, null],
    [79, null, null, 84, null, 88, null, null, 86, null, 84, null, 79, null, null, null],
    [81, null, 83, null, 86, null, 83, null, 79, null, 76, null, 79, null, null, null],
  ],
};

// -------- Perseguição pela copa (macaco da carta): Lá menor, 152 bpm — galope, riso e riff de desenho animado --------
const CHASE: Theme = {
  bpm: 152,
  tribal: true,
  chords: [
    { root: 45, notes: [57, 60, 64, 69] }, // Am
    { root: 41, notes: [53, 57, 60, 65] }, // F
    { root: 43, notes: [55, 59, 62, 67] }, // G
    { root: 40, notes: [52, 56, 59, 64] }, // E
  ],
  bassPat: 'x.xxo.x.x.xxo.xx',
  kickPat: 'x...x...x...x.x.',
  snarePat: '....x.......x..x',
  hatPat: 'x.x.x.x.x.x.x.xx',
  arpPat: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 2, 1, 3, 2],
  congaPat: 'l.hhm.h.l.hhm.xh',
  tomPat: '..x...x...x...xx',
  lead: [
    [81, null, 84, null, 81, null, 76, null, 81, null, 84, null, 88, null, 84, null],
    [81, null, 77, null, 81, null, 84, null, 89, null, 84, null, 81, null, 77, null],
    [79, null, 83, null, 86, null, 83, null, 79, null, 83, null, 86, null, 91, null],
    [88, 87, 88, 87, 88, 83, 86, 84, 81, null, null, null, 76, null, 81, null],
  ],
};

const THEMES: Record<ThemeName, Theme> = { menu: MENU, stage: STAGE, boss: BOSS, jungle: JUNGLE, rave: RAVE, monument: MONUMENT, fight: FIGHT, chase: CHASE };

class MusicEngine {
  private layerGain = new Map<Layer, GainNode>();
  private layerTarget = new Map<Layer, number>();
  private delay: DelayNode | null = null;
  private send: GainNode | null = null;
  private timer: number | null = null;
  private theme: ThemeName | null = null;
  /** instante (relógio do áudio) em que o tema atual começou: base do compasso */
  private t0 = 0;
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
      this.t0 = this.nextTime;
      const bpm = THEMES[theme].bpm;
      if (this.delay) this.delay.delayTime.setTargetAtTime((60 / bpm) * 0.75, audio.ctx.currentTime, 0.05);
    }
    this.setMix(mix);
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), 25);
  }

  /** 0..1 dentro do tempo (batida) atual — para coisas que pulsam no ritmo. */
  beat(): number {
    const c = audio.ctx;
    if (!c || !this.theme) return 0;
    const bps = THEMES[this.theme].bpm / 60;
    const b = (c.currentTime - this.t0) * bps;
    return b - Math.floor(b);
  }
  /** Tempos (batidas) desde o início do tema (−1 sem áudio). */
  beatPos(): number {
    const c = audio.ctx;
    if (!c || !this.theme) return -1;
    return (c.currentTime - this.t0) * (THEMES[this.theme].bpm / 60);
  }
  bpm(): number {
    return this.theme ? THEMES[this.theme].bpm : 120;
  }
  /** Próximo instante do relógio do áudio que cai na grade (div = subdivisões por tempo). */
  quantize(div = 2): number {
    const c = audio.ctx;
    if (!c || !this.theme) return 0;
    const step = 60 / THEMES[this.theme].bpm / div;
    const n = Math.ceil((c.currentTime + 0.02 - this.t0) / step);
    return this.t0 + n * step;
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
    // aba em segundo plano (timer congelado): não despeja de uma vez as notas atrasadas
    if (this.nextTime < c.currentTime - 0.25) this.nextTime = c.currentTime + 0.05;
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

  // ------------------------------------------------------------ selva
  /** Marimba de madeira: seno + harmônico agudo com ataque seco. */
  private marimba(l: Layer, t: number, midi: number, dur: number, vol: number) {
    const c = audio.ctx!;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.dest(l));
    if (this.send) {
      const sg = c.createGain();
      sg.gain.value = 0.35;
      g.connect(sg);
      sg.connect(this.send);
    }
    for (const [mul, v] of [[1, 1], [4, 0.25], [10, 0.06]] as [number, number][]) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = mtof(midi) * mul;
      const og = c.createGain();
      og.gain.setValueAtTime(v, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + dur / mul + 0.02);
      o.connect(og);
      og.connect(g);
      o.start(t);
      o.stop(t + dur + 0.03);
    }
  }

  /** Flauta de bambu: seno com sopro (ruído filtrado), vibrato lento e ataque macio. */
  private flute(l: Layer, t: number, midi: number, dur: number, vol: number) {
    const c = audio.ctx!;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = mtof(midi);
    const o2 = c.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = mtof(midi) * 2;
    const lfo = c.createOscillator();
    lfo.frequency.value = 4.8;
    const lg = c.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(14, t + dur * 0.6);
    lfo.connect(lg);
    lg.connect(o.detune);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.07);
    g.gain.setTargetAtTime(vol * 0.75, t + 0.1, 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = c.createGain();
    g2.gain.value = 0.12;
    o.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(this.dest(l));
    if (this.send) {
      const sg = c.createGain();
      sg.gain.value = 0.5;
      g.connect(sg);
      sg.connect(this.send);
    }
    // sopro
    this.noiseHit(l, t, Math.min(0.25, dur * 0.4), 'bandpass', mtof(midi) * 2, vol * 0.5, 4);
    o.start(t);
    o2.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  /** Bloco de madeira / claves. */
  private woodblock(l: Layer, t: number, f: number, vol: number) {
    const c = audio.ctx!;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.05);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g);
    g.connect(this.dest(l));
    o.start(t);
    o.stop(t + 0.09);
  }

  /** Conga/djembê: tom com batida de pele (ruído curto) por cima. */
  private conga(l: Layer, t: number, f: number, vol: number, slap: boolean) {
    const c = audio.ctx!;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(f * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (slap ? 0.12 : 0.32));
    o.connect(g);
    g.connect(this.dest(l));
    o.start(t);
    o.stop(t + 0.35);
    this.noiseHit(l, t, slap ? 0.06 : 0.03, 'bandpass', slap ? 3000 : 1500, vol * (slap ? 0.6 : 0.3), 1.2);
  }

  private scheduleTribal(th: Theme, step: number, t: number, stepDur: number) {
    const bar = Math.floor(step / 16) % th.chords.length;
    const s = step % 16;
    const chord = th.chords[bar];
    // bordão grave (quinta aberta, filtro escuro)
    if (this.on('pad') && s === 0) this.padChord('pad', t, [chord.root + 12, chord.root + 19, chord.notes[1]], stepDur * 16, 0.045, 900);
    if (this.on('choir') && s === 0) this.padChord('choir', t, [chord.notes[0] + 12, chord.notes[2] + 12], stepDur * 16, 0.04, 1800);
    // baixo dedilhado (madeira)
    if (this.on('bass')) {
      const ch = th.bassPat[s];
      if (ch !== '.') this.pluck('bass', t, chord.root + (ch === 'o' ? 12 : 0), stepDur * 3, 0.3, 'triangle', false);
    }
    if (this.on('power') && s % 4 === 0) this.bassNote('power', t, chord.root + 12, stepDur * 1.5, true);
    // tambores: surdo, congas e claves — a percussão aparece já na exploração
    const drums = this.on('kick');
    if (drums && th.kickPat[s] === 'x') this.kick(t);
    if (drums && th.congaPat) {
      const k = th.congaPat[s];
      if (k === 'l') this.conga('kick', t, 95, 0.55, false);
      else if (k === 'm') this.conga('kick', t, 140, 0.45, false);
      else if (k === 'h') this.conga('kick', t, 205, 0.4, (step >> 4) % 2 === 1 && s > 8);
    }
    if (this.on('tom') && s % 8 === 6) this.conga('tom', t, 70, 0.6, false);
    if ((this.on('snare') || this.on('hat')) && th.snarePat[s] === 'x') this.woodblock(this.on('snare') ? 'snare' : 'hat', t, s % 4 === 2 ? 1250 : 980, 0.22);
    // chocalho (sementes)
    if (this.on('hat') && th.hatPat[s] === 'x') this.noiseHit('hat', t, s % 4 === 0 ? 0.07 : 0.04, 'bandpass', 5600, s % 4 === 0 ? 0.2 : 0.11, 1.4);
    // marimba
    if (this.on('arp')) {
      const idx = th.arpPat[s];
      if (idx >= 0) this.marimba('arp', t, chord.notes[idx] + 12, stepDur * 2.4, 0.13);
    }
    // flauta: melodia (na exploração ela vem mais baixinha, pela camada da marimba)
    const lay: Layer | null = this.on('lead') ? 'lead' : this.on('arp') ? 'arp' : null;
    if (lay) {
      const n = th.lead[bar % th.lead.length][s];
      if (n !== null && n !== undefined) {
        let len = 1;
        const seq = th.lead[bar % th.lead.length];
        while (s + len < 16 && seq[s + len] === null && len < 6) len++;
        this.flute(lay, t, n, stepDur * (len + 1.2), lay === 'lead' ? 0.12 : 0.09);
        // marimba dobrando o refrão uma oitava abaixo: dá o "pique" de jogo de plataforma
        this.marimba(lay, t, n - 12, stepDur * 2.2, lay === 'lead' ? 0.09 : 0.07);
      }
    }
  }

  // ------------------------------------------------------------ sequenciador
  private schedule(th: Theme, step: number, t: number, stepDur: number) {
    if (th.tribal) {
      this.scheduleTribal(th, step, t, stepDur);
      return;
    }
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
  /** sala do ritmo: só percussão e baixo — a melodia é o jogador quem toca */
  rhythm: { pad: 0.45, bass: 0.75, kick: 1, hat: 0.9, tom: 0.9, snare: 0.6 } as Partial<Record<Layer, number>>,
  /** depois de completar a sala: a música inteira, com melodia, para comemorar */
  celebrate: { pad: 0.8, bass: 0.9, arp: 0.9, hat: 0.9, kick: 1, snare: 0.9, lead: 1, tom: 0.8, choir: 0.6 } as Partial<Record<Layer, number>>,
  /** boate: bumbo, chimbal, baixo e caixa (a melodia de sintetizador sai das notas) */
  club: { pad: 0.5, bass: 1, hat: 1, kick: 1, snare: 0.9, power: 0.35 } as Partial<Record<Layer, number>>,
  /** "drop" da boate: tudo, com a guitarra e o coro */
  drop: { pad: 0.8, bass: 1, arp: 0.9, hat: 1, kick: 1, snare: 1, lead: 1, power: 0.9, choir: 0.8, tom: 0.7 } as Partial<Record<Layer, number>>,
  victory: { pad: 1, lead: 0.8, arp: 0.7, bass: 0.6 } as Partial<Record<Layer, number>>,
  /** luta do boxe, round 1: tambor e baixo; o resto entra com os rounds (a música cresce junto com a luta) */
  fight1: { pad: 0.45, bass: 1, arp: 0.35, hat: 0.7, kick: 1, snare: 0.6, tom: 1 } as Partial<Record<Layer, number>>,
  /** round 2: entram o arpejo, a melodia e a caixa cheia */
  fight2: { pad: 0.5, bass: 1, arp: 0.7, hat: 0.9, kick: 1, snare: 0.9, tom: 1, lead: 0.7, choir: 0.35 } as Partial<Record<Layer, number>>,
  /** round 3 (Jacaré Furioso): tudo, com a guitarra e o coro */
  fight3: { pad: 0.6, bass: 1, arp: 0.95, hat: 1, kick: 1, snare: 1, tom: 1, lead: 1, power: 0.55, choir: 0.95 } as Partial<Record<Layer, number>>,
  /** intervalo e contagem: pad, baixo leve e tambor baixo */
  fightBreak: { pad: 0.75, bass: 0.45, arp: 0.4, tom: 0.4, choir: 0.25 } as Partial<Record<Layer, number>>,
  /** perseguição do macaco: galope de tambor, baixo, arpejo e o riff do desenho animado */
  chase: { pad: 0.4, bass: 1, arp: 0.8, hat: 0.9, kick: 1, snare: 0.9, tom: 0.9, lead: 0.9 } as Partial<Record<Layer, number>>,
  /** praça do Pensador: pad e coro, tímpano, baixo e melodia larga */
  monument: { pad: 1, bass: 0.8, arp: 0.55, kick: 0.45, tom: 0.9, choir: 0.95, lead: 0.7 } as Partial<Record<Layer, number>>,
  /** balada com o Karimbo dançando: tudo no máximo */
  rave: { pad: 0.55, bass: 1, arp: 1, hat: 1, kick: 1, snare: 1, lead: 1, power: 0.45, tom: 0.8 } as Partial<Record<Layer, number>>,
};

/** Melodia do tema da cidade (as notas da boate tocam em sintetizador). */
export const STAGE_MELODY: number[] = STAGE.lead.flat().filter((n): n is number => n !== null);
/** Melodia da flauta da selva (o que as notas da sala do ritmo tocam, em ordem). */
export const JUNGLE_MELODY: number[] = JUNGLE.lead.flat().filter((n): n is number => n !== null);
