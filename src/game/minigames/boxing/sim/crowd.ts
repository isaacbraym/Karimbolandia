/**
 * A torcida de crianças do ringue (simulação sem arte): cada criança ocupa uma posição do layout em U
 * (`art/minigames/boxing/layout.ts`, mesmo índice), tem um time (≈60% do Karimbo, ≈40% do jacaré, e o
 * juiz do sino), um humor que reage aos eventos da luta, gritos em balões e o coro "BRIGA!" no tempo da
 * música. Sem gravação de voz: só balões + palmas/pisadas procedurais no beat.
 */
import { Rng } from '../../../../core/math';
import type { MatchEvent } from './match';
import { BEAT } from './rules';

export type Team = 'karimbo' | 'gator' | 'judge';
export type Mood = 'cheer' | 'gasp' | 'laugh' | 'jump';
export interface Kid {
  team: Team;
  /** aparência (0..7, as crianças da aldeia) */
  look: number;
  phase: number;
  mood: Mood;
  moodT: number;
  /** segura uma plaquinha (a arte assa o cartaz junto da criança) */
  sign: boolean;
}
export interface Shout { kid: number; text: string; t: number; dur: number }

export const CHEER_KARIMBO = ['VAI KARIMBO!', 'ORELHADA NELE!', 'BATE NO RABO!', 'ESQUIVA, ORELHUDO!'] as const;
export const CHEER_GATOR = ['VAI JACARÉ!', 'ARRANCA A ORELHA DELE!', 'MORDE ELE!', 'JACARÉ NÃO PERDE!'] as const;
export const CHANT = 'BRIGA!';
/** o coro bate no tempo da música (bpm do tema `fight`) */
export const BEAT_S = BEAT;
/** crianças da torcida (9 por lado) + o juiz */
export const CROWD_SIZE = 19;

export class Crowd {
  readonly kids: Kid[] = [];
  readonly shouts: Shout[] = [];
  /** o juiz está tocando o sino (0..1 → 0 = parado) */
  bell = 0;
  private rng = new Rng(7771);
  private clock = 0;
  private nextShout = 1.2;
  private lastBeat = -1;
  /** batida do coro (0..3 dentro do compasso): a arte pisca o balão BRIGA! */
  chantBeat = -1;

  constructor(count = CROWD_SIZE) {
    for (let i = 0; i < count; i++) {
      const judge = i === count - 1;
      // 60/40 em cada lado, intercalado: ninguém fica só de um time
      const team: Team = judge ? 'judge' : (i * 7 + (i >> 1)) % 5 < 3 ? 'karimbo' : 'gator';
      this.kids.push({ team, look: judge ? 3 : (i * 3 + 1) % 8, phase: this.rng.next() * 6.28, mood: 'cheer', moodT: 0, sign: !judge && i % 4 === 0 });
    }
  }

  /** Reage aos eventos da luta: cada time vibra com o que é bom para ele. */
  react(e: MatchEvent) {
    switch (e.type) {
      case 'bell': case 'roundStart': this.bell = 1; break;
      case 'hit': if ((e.amount ?? 0) >= 12) { this.mood('karimbo', 'jump', 0.7, 0.6); this.mood('gator', 'gasp', 0.7, 0.5); } break;
      case 'gatorHit': {
        const big = e.attack === 'mordidona' || e.attack === 'rabada';
        this.mood('gator', 'jump', big ? 1.1 : 0.7, 0.7);
        this.mood('karimbo', 'gasp', big ? 1.1 : 0.7, 0.7);
        if (big) this.shout('UUUUUH!', 1.2);
        break;
      }
      case 'gatorMiss': this.mood('karimbo', 'jump', 0.8, 0.7); this.mood('gator', 'laugh', 0.6, 0.3); break;
      case 'perfect': case 'perfectGuard': this.mood('karimbo', 'jump', 1.2, 0.9); this.shout('OLÉÉ!', 1); break;
      case 'combo': case 'star': case 'fury': this.mood('karimbo', 'jump', 1.2, 0.8); break;
      case 'counter': this.mood('karimbo', 'jump', 1, 0.8); this.mood('gator', 'gasp', 1, 0.6); this.shout('CONTRA!', 1); break;
      case 'read': this.mood('gator', 'laugh', 1.2, 0.8); this.shout('LIDO!', 1.1); break;
      case 'kdG': this.mood('karimbo', 'jump', 2, 1); this.mood('gator', 'gasp', 2, 1); this.shout('NOCAUTE!', 1.6); break;
      case 'rise': this.mood('gator', 'jump', 1.2, 0.9); break;
      case 'kdK': this.mood('gator', 'jump', 2, 1); this.mood('karimbo', 'gasp', 2, 1); this.shout('ELE CAIU!', 1.6); break;
      case 'getup': this.mood('karimbo', 'jump', 1.5, 1); break;
      case 'groggy': this.mood('karimbo', 'jump', 1.4, 1); this.mood('gator', 'gasp', 1.4, 1); break;
      case 'orelhada': this.mood('karimbo', 'jump', 3, 1); this.mood('gator', 'gasp', 3, 1); break;
      case 'win': this.mood('karimbo', 'jump', 5, 1); this.mood('gator', 'gasp', 5, 1); break;
      case 'lose': this.mood('gator', 'laugh', 5, 1); this.mood('karimbo', 'gasp', 5, 1); break;
      case 'decision': this.mood('karimbo', 'gasp', 2, 0.8); this.mood('gator', 'gasp', 2, 0.8); break;
      default: break;
    }
  }

  private mood(team: Team, m: Mood, dur: number, share: number) {
    for (const k of this.kids) if (k.team === team && this.rng.next() < share) { k.mood = m; k.moodT = dur * (0.7 + this.rng.next() * 0.6); }
    if (m === 'laugh') this.shout('HAHAHA!', 1.0, team);
  }

  private shout(text: string, dur: number, team?: Team) {
    if (this.shouts.length >= 4) this.shouts.shift();
    const pool: number[] = [];
    for (let i = 0; i < this.kids.length; i++) if (this.kids[i].team !== 'judge' && (!team || this.kids[i].team === team)) pool.push(i);
    if (!pool.length) return;
    this.shouts.push({ kid: pool[Math.floor(this.rng.next() * pool.length)], text, t: 0, dur });
  }

  /** `chanting`: o coro BRIGA! de abertura, dos intervalos e das viradas. */
  update(dt: number, chanting: boolean) {
    this.clock += dt;
    if (this.bell > 0) this.bell = Math.max(0, this.bell - dt / 1.4);
    for (const k of this.kids) if (k.moodT > 0) { k.moodT -= dt; if (k.moodT <= 0) k.mood = 'cheer'; }
    for (let i = this.shouts.length - 1; i >= 0; i--) { this.shouts[i].t += dt; if (this.shouts[i].t >= this.shouts[i].dur) this.shouts.splice(i, 1); }
    const beat = Math.floor(this.clock / BEAT_S);
    if (beat !== this.lastBeat) { this.lastBeat = beat; this.chantBeat = chanting ? beat % 4 : -1; }
    this.nextShout -= dt;
    if (this.nextShout <= 0 && !chanting) {
      const i = Math.floor(this.rng.next() * this.kids.length);
      const k = this.kids[i];
      if (k.team !== 'judge') {
        const list = k.team === 'karimbo' ? CHEER_KARIMBO : CHEER_GATOR;
        this.shouts.push({ kid: i, text: list[Math.floor(this.rng.next() * list.length)], t: 0, dur: 1.8 });
        if (this.shouts.length > 4) this.shouts.shift();
      }
      this.nextShout = 1.8 + this.rng.next() * 1.8;
    }
  }
}
