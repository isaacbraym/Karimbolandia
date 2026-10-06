/**
 * O que cada evento da luta faz nos sentidos (puro, sem áudio nem DOM): sons em camadas, vibração e a
 * trilha de cada momento. Fica separado da sessão para ser testado: cada ataque do jacaré tem um sinal
 * sonoro DIFERENTE (dá para jogar até de olhos fechados, como no Punch-Out!!), os golpes ficam mais
 * pesados do jab ao gancho e a música cresce com os rounds.
 */
import type { SfxName } from '../../../core/audio';
import type { MusicState } from '../../world';
import type { MatchEvent } from './sim/match';
import { PUNCHES } from './sim/rules';

export type Sfx = readonly [SfxName, number];
export interface Haptic { s: number; ms: number }

/** Sons de um evento. `blocked`: o golpe que acabou de acertar foi bloqueado (o baque de dano não toca). */
export function sfxFor(e: MatchEvent, blocked = false): Sfx[] {
  switch (e.type) {
    case 'bell': return [['bell', 0.9]];
    case 'roundEnd': return [['bell', 0.9]];
    case 'punch': { const t = e.punch ? PUNCHES[e.punch].tier : 'jab'; return [['whoosh', t === 'jab' ? 0.22 : t === 'direto' ? 0.3 : 0.45]]; }
    case 'whiff': return [['whoosh', 0.2]];
    case 'block': return [['blockThud', e.punch ? 0.7 : 0.9]];
    case 'hit': {
      if (blocked) return [];
      const tier = e.punch ? PUNCHES[e.punch].tier : 'gancho';
      return [[tier === 'jab' || tier === 'direto' ? 'jabHit' : tier === 'cruzado' ? 'hookHit' : 'upperHit', tier === 'jab' ? 0.7 : 0.9]];
    }
    case 'counter': return [['punchHeavy', 0.8]];
    case 'dodge': case 'duck': return [['dodgeSwish', 0.6]];
    case 'perfect': case 'perfectGuard': return [['perfectChime', 0.8]];
    case 'star': return [['starGet', 0.7]];
    case 'fury': return [['furyRoar', 0.9]];
    case 'combo': return [['emblem', 0.5]];
    case 'read': return [['crowdLaugh', 0.4]];
    case 'tired': return [['tick', 0.25]];
    case 'gatorAttack':
      switch (e.attack) {
        case 'patada': return [['whoosh', 0.45]];
        case 'cabecada': return [['thump', 0.5]];
        case 'rabada': return [['rumble', 0.5]];
        case 'mordidona': return [['laserCharge', 0.5]];
        case 'chapelada': return [['whistle', 0.7]];
        case 'giro': return [['clap', 0.6]];
        default: return [['whoosh', 0.4]];
      }
    case 'gatorHit': return [[e.attack === 'mordidona' ? 'chomp' : 'punchHeavy', 1], ['crowdGasp', 0.6]];
    case 'gatorMiss': return [['crowdLaugh', 0.35]];
    case 'taunt': return [['whistle', 0.5]];
    case 'dizzy': return [['crowdGasp', 0.7]];
    case 'groggy': return [['crowdGasp', 0.8]];
    case 'kdG': return [['thump', 0.9], ['crowdGasp', 0.8]];
    case 'kdGCount': case 'kdKCount': return [['tick', 0.5]];
    case 'rise': return [['whoosh', 0.5]];
    case 'kdK': return [['thump', 1], ['crowdLaugh', 0.5]];
    case 'getup': return [['starGet', 0.8]];
    case 'carga': return [['laserCharge', 0.7]];
    case 'orelhada': return [['laserCharge', 0.8]];
    case 'impact': return [['bigExplosion', 1], ['punchHeavy', 1]];
    case 'ko': return [['thump', 1]];
    case 'count': return [['thump', 0.4]];
    case 'decision': return [['bell', 0.8]];
    case 'win': return [['victory', 0.9]];
    case 'lose': return [['crowdLaugh', 0.9]];
    default: return [];
  }
}

/** Vibração (celular) / rumble (controle): o peso do golpe vira o peso da vibração. */
export function hapticFor(e: MatchEvent, blocked = false): Haptic | null {
  switch (e.type) {
    case 'block': return e.punch ? { s: 0.2, ms: 8 } : { s: 0.3, ms: 14 };
    case 'hit': {
      if (blocked) return null;
      const tier = e.punch ? PUNCHES[e.punch].tier : 'gancho';
      return tier === 'jab' ? { s: 0.2, ms: 8 } : tier === 'direto' ? { s: 0.3, ms: 12 } : { s: 0.5, ms: 20 };
    }
    case 'counter': return { s: 0.6, ms: 30 };
    case 'perfect': case 'perfectGuard': return { s: 0.3, ms: 14 };
    case 'fury': return { s: 0.7, ms: 80 };
    case 'gatorHit': return e.attack === 'mordidona' ? { s: 1, ms: 90 } : { s: 0.8, ms: 50 };
    case 'kdG': return { s: 0.8, ms: 120 };
    case 'kdK': return { s: 1, ms: 160 };
    case 'impact': return { s: 1, ms: 200 };
    default: return null;
  }
}

/** A trilha de cada momento da luta (null = não muda): cresce com os rounds, respira nos intervalos. */
export function musicFor(e: MatchEvent, round: number): MusicState | null {
  const fight = `fight${Math.max(1, Math.min(3, round))}` as MusicState;
  switch (e.type) {
    case 'roundStart': return `fight${e.n ?? 1}` as MusicState;
    case 'roundEnd': return (e.n ?? 1) >= 3 ? 'silence' : 'fightBreak';
    case 'groggy': case 'kdG': case 'kdK': return 'fightBreak';
    case 'rise': case 'getup': return fight;
    case 'carga': case 'orelhada': case 'decision': return 'silence';
    case 'win': return 'victory';
    default: return null;
  }
}
