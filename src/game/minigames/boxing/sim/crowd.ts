/**
 * A torcida de crianças em volta do ringue (simulação sem arte): posições em elipse com profundidade,
 * time de cada uma (≈60% do Karimbo, ≈40% do jacaré), gritos em balões e o coro "BRIGA!" no tempo
 * da música. Sem gravação de voz: só balões + palmas/pisadas procedurais no beat.
 */
import { Rng } from '../../../../core/math';
import type { MatchEvent } from './match';

export type Team = 'karimbo' | 'gator';
export interface Kid {
  /** posição no ringue: x −1..1 (esquerda..direita) e depth 0 (fundo) .. 1 (perto da câmera) */
  x: number;
  depth: number;
  team: Team;
  /** aparência (0..7, as crianças da aldeia) */
  look: number;
  phase: number;
  /** humor atual: torcendo, assustada ("UUUH"), rindo ou pulando */
  mood: 'cheer' | 'gasp' | 'laugh' | 'jump';
  moodT: number;
}
export interface Shout { kid: number; text: string; t: number; dur: number }

export const CHEER_KARIMBO = ['VAI KARIMBO!', 'ORELHADA NELE!', 'BATE NO RABO!', 'ESQUIVA, ORELHUDO!'] as const;
export const CHEER_GATOR = ['VAI JACARÉ!', 'ARRANCA A ORELHA DELE!', 'MORDE ELE!', 'JACARÉ NÃO PERDE!'] as const;
export const CHANT = 'BRIGA! BRIGA! BRIGA! BRIGA!';
/** o coro bate no tempo da música (bpm do tema `fight`) */
export const FIGHT_BPM = 132;
export const BEAT = 60 / FIGHT_BPM;

export class Crowd {
  readonly kids: Kid[] = [];
  readonly shouts: Shout[] = [];
  private rng = new Rng(7771);
  private clock = 0;
  private nextShout = 1.2;
  private lastBeat = -1;
  /** batida do coro (0..3 dentro do compasso): a arte pisca o balão BRIGA! */
  chantBeat = -1;

  constructor(count = 14) {
    for (let i = 0; i < count; i++) {
      // elipse: ângulos distribuídos, evitando o lado da câmera (embaixo no centro, onde fica o Karimbo)
      const a = Math.PI * (1.08 + (0.84 * (i + 0.5)) / count) + (i % 2 ? 0.02 : -0.02);
      const x = Math.cos(a) * 0.98;
      const depth = 0.5 + Math.sin(a) * -0.5 + 0.18 * this.rng.next();
      this.kids.push({ x, depth: Math.max(0, Math.min(1, depth)), team: i % 5 < 3 ? 'karimbo' : 'gator', look: i % 8, phase: this.rng.next() * 6.28, mood: 'cheer', moodT: 0 });
    }
    this.kids.sort((p, q) => p.depth - q.depth);
  }

  /** Reage aos eventos da luta (UUUH em golpe forte, risada em golpe no ar, pulos em combo). */
  react(e: MatchEvent) {
    switch (e.type) {
      case 'gatorHit': this.mood(e.attack === 'mordidona' || e.attack === 'rabada' ? 'gasp' : 'cheer', 1.1, 0.7); break;
      case 'hit': if ((e.amount ?? 0) >= 12) this.mood('gasp', 0.8, 0.5); break;
      case 'gatorMiss': this.mood('laugh', 0.9, 0.5); break;
      case 'combo': this.mood('jump', 1.2, 0.8); break;
      case 'groggy': this.mood('gasp', 1.4, 0.9); break;
      case 'win': this.mood('jump', 4, 1); break;
      case 'lose': this.mood('laugh', 4, 1); break;
      default: break;
    }
  }

  private mood(m: Kid['mood'], dur: number, share: number) {
    for (const k of this.kids) if (this.rng.next() < share) { k.mood = m; k.moodT = dur * (0.7 + this.rng.next() * 0.6); }
    if (m === 'gasp') this.shout('UUUUUH!', 1.2);
    else if (m === 'laugh') this.shout('HAHAHA!', 1.0);
  }

  private shout(text: string, dur: number) {
    if (this.shouts.length >= 4) this.shouts.shift();
    this.shouts.push({ kid: Math.floor(this.rng.next() * this.kids.length), text, t: 0, dur });
  }

  /** `chanting`: o coro BRIGA! de abertura/viradas. */
  update(dt: number, chanting: boolean) {
    this.clock += dt;
    for (const k of this.kids) if (k.moodT > 0) { k.moodT -= dt; if (k.moodT <= 0) k.mood = 'cheer'; }
    for (let i = this.shouts.length - 1; i >= 0; i--) { this.shouts[i].t += dt; if (this.shouts[i].t >= this.shouts[i].dur) this.shouts.splice(i, 1); }
    const beat = Math.floor(this.clock / BEAT);
    if (beat !== this.lastBeat) { this.lastBeat = beat; this.chantBeat = chanting ? beat % 4 : -1; }
    this.nextShout -= dt;
    if (this.nextShout <= 0 && !chanting) {
      const i = Math.floor(this.rng.next() * this.kids.length);
      const k = this.kids[i];
      const list = k.team === 'karimbo' ? CHEER_KARIMBO : CHEER_GATOR;
      this.shouts.push({ kid: i, text: list[Math.floor(this.rng.next() * list.length)], t: 0, dur: 1.8 });
      if (this.shouts.length > 4) this.shouts.shift();
      this.nextShout = 1.6 + this.rng.next() * 1.6;
    }
  }
}
