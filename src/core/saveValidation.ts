import type { SaveState } from '../game/save';
import { WEAPON_ORDER } from '../game/weapons';
import { isDifficulty } from './difficulty';
import { MAX_ROOM_ENTRIES, REP_MAX, REP_MIN } from '../game/interiorStore';

export const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const number = (v: unknown, min = 0, max = 1e12) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
export const integer = (v: unknown, min = 0, max = 1e9) => number(v, min, max) && Number.isInteger(v);
export const ids = (v: unknown): v is number[] => Array.isArray(v) && v.length <= 20000 && v.every(x => integer(x));

/** Valida antes de restaurar mundos; não confia em casts de JSON vindo do disco/nuvem. */
export function validateSave(v: unknown): SaveState | null {
  if (!record(v) || v.v !== 1 || !integer(v.stage, 1, 2) || !integer(v.checkpointIdx, -1, 200)) return null;
  if (typeof v.cpName !== 'string' || v.cpName.length > 150) return null;
  for (const k of ['time', 'score', 'tokens', 'lives', 'bestCombo']) if (!number(v[k])) return null;
  if (!number(v.savedAt, 0, Number.MAX_SAFE_INTEGER)) return null;
  for (const k of ['tokens', 'lives', 'bestCombo']) if (!integer(v[k])) return null;
  for (const k of ['emblems', 'secrets', 'killed', 'collected', 'destroyed']) if (!ids(v[k])) return null;
  if (!Array.isArray(v.secretRooms) || v.secretRooms.length > 1000 || !v.secretRooms.every(x => typeof x === 'string' && x.length <= 100)) return null;
  if (v.encounters !== undefined && (!Array.isArray(v.encounters) || v.encounters.length > 64 || !v.encounters.every(x => typeof x === 'string' && /^[a-z0-9:-]{1,80}$/.test(x)))) return null;
  if (v.interiors !== undefined) {
    if (!Array.isArray(v.interiors) || v.interiors.length > MAX_ROOM_ENTRIES) return null;
    const rooms = new Set<string>();
    for (const pair of v.interiors) {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || !/^[a-z0-9:-]{1,40}$/.test(pair[0])
        || rooms.has(pair[0]) || !integer(pair[1], 0, 2 ** 31 - 1)) return null;
      rooms.add(pair[0]);
    }
  }
  if (v.villageRep !== undefined && !integer(v.villageRep, REP_MIN, REP_MAX)) return null;
  for (const k of ['nomadUsed', 'nomadLost', 'bossLivesGiven']) if (typeof v[k] !== 'boolean') return null;
  if (!Array.isArray(v.weapons) || v.weapons.length > WEAPON_ORDER.length) return null;
  const seen = new Set<string>();
  for (const pair of v.weapons) {
    if (!Array.isArray(pair) || pair.length !== 2 || !WEAPON_ORDER.includes(pair[0]) || !integer(pair[1], -1)) return null;
    if (pair[1] === -1 && pair[0] !== 'pistol') return null;
    if (seen.has(pair[0])) return null;
    seen.add(pair[0]);
  }
  if (typeof v.cur !== 'string' || (v.weapons.length ? !seen.has(v.cur) : v.cur !== '')) return null;
  if(v.magazines!==undefined) {
    if(!Array.isArray(v.magazines)||v.magazines.length>WEAPON_ORDER.length)return null;
    const clips=new Set<string>();
    for(const pair of v.magazines){if(!Array.isArray(pair)||pair.length!==2||!seen.has(pair[0])||clips.has(pair[0])||!integer(pair[1],0,100))return null;clips.add(pair[0]);}
  }
  if (v.difficulty !== undefined && !isDifficulty(v.difficulty)) return null;
  if (!integer(v.grenades, -1) || !number(v.nomad, -1) || !record(v.stats)) return null;
  for (const k of ['kills', 'deaths', 'damageTaken', 'dashes', 'shots', 'pitFalls']) if (!number(v.stats[k])) return null;
  // Clone também remove propriedades desconhecidas nos subobjetos usados pelo jogo.
  const s = v as unknown as SaveState;
  return {
    v: 1, stage: s.stage, checkpointIdx: s.checkpointIdx, cpName: s.cpName,
    time: s.time, score: s.score, tokens: s.tokens, lives: s.lives, bestCombo: s.bestCombo,
    emblems: [...s.emblems], secrets: [...s.secrets], secretRooms: [...s.secretRooms],
    encounters: [...new Set(s.encounters ?? [])],
    ...(s.interiors !== undefined ? { interiors: s.interiors.map(([id, m]): [string, number] => [id, m]) } : {}),
    ...(s.villageRep !== undefined ? { villageRep: s.villageRep } : {}),
    killed: [...s.killed], collected: [...s.collected], destroyed: [...s.destroyed],
    nomadUsed: s.nomadUsed, nomadLost: s.nomadLost, bossLivesGiven: s.bossLivesGiven,
    weapons: s.weapons.map(([id, n]) => [id, n]), cur: s.cur, grenades: s.grenades, nomad: s.nomad,
    magazines:s.magazines?.map(([id,n])=>[id,n]),
    stats: { kills: s.stats.kills, deaths: s.stats.deaths, damageTaken: s.stats.damageTaken, dashes: s.stats.dashes, shots: s.stats.shots, pitFalls: s.stats.pitFalls },
    savedAt: s.savedAt,
    ...(s.difficulty ? { difficulty: s.difficulty } : {}),
  };
}
