/**
 * Save-state no navegador: a cada checkpoint (e ao terminar uma fase) o progresso da partida vai
 * para o localStorage. Se a rede cair, a aba fechar ou o celular reiniciar, o jogo pergunta ao
 * abrir se quer voltar ao último checkpoint — com pontos, vidas, armas, itens e inimigos já
 * derrotados como estavam.
 */
import type { World } from './world';
import type { WeaponId } from './weapons';
import { profileKey, readStored, writeStored } from '../core/persistence';
import { validateSave } from '../core/saveValidation';
import { difficultyId, type DifficultyId } from '../core/difficulty';

const KEY = 'karimbolandia.save.v1';

export interface SaveState {
  v: 1;
  stage: number;
  checkpointIdx: number;
  cpName: string;
  time: number;
  score: number;
  tokens: number;
  lives: number;
  bestCombo: number;
  emblems: number[];
  secrets: number[];
  secretRooms: string[];
  encounters?: string[];
  /** interiores jogáveis: [id do cômodo, bitmask de flags]; ausente em saves antigos */
  interiors?: [string, number][];
  /** reputação na aldeia (−100..100); ausente em saves antigos */
  villageRep?: number;
  killed: number[];
  collected: number[];
  /** IDs of notes collected a second time; absent in older saves. */
  rhythmRepeats?: number[];
  destroyed: number[];
  nomadUsed: boolean;
  nomadLost: boolean;
  bossLivesGiven: boolean;
  /** inventário no checkpoint (munição infinita gravada como -1) */
  weapons: [string, number][];
  magazines?: [string,number][];
  /** minimapa do lago: bitset (base64) das células exploradas; ausente se nada foi visto */
  lakeMap?: string;
  cur: string;
  grenades: number;
  nomad: number;
  stats: { kills: number; deaths: number; damageTaken: number; dashes: number; shots: number; pitFalls: number };
  savedAt: number;
  /** nível da partida (saves antigos não têm: valem como NORMAL) */
  difficulty?: DifficultyId;
}

export function loadSave(): SaveState | null {
  return readStored(profileKey(KEY), validateSave);
}

export function writeSave(s: SaveState) {
  const valid = validateSave(s);
  if (!valid) return false;
  return writeStored(profileKey(KEY), valid, validateSave);
}

export function clearSave() {
  return writeStored(profileKey(KEY), null, validateSave);
}

/** Fotografa a partida no checkpoint atual. */
export function captureSave(w: World): SaveState {
  const snap = w.player.snapshot();
  const cp = w.checkpointIdx >= 0 ? w.data.checkpoints[w.checkpointIdx] : null;
  return {
    v: 1,
    stage: w.data.stage,
    checkpointIdx: w.checkpointIdx,
    cpName: cp ? cp.name : 'Início',
    time: w.time,
    score: w.score,
    tokens: w.tokens,
    lives: w.lives,
    bestCombo: w.bestCombo,
    emblems: [...w.emblems],
    secrets: [...w.secrets],
    secretRooms: [...w.secretRooms],
    encounters: [...w.encounters.completed],
    ...(w.lakeMap?.toSave() ? { lakeMap: w.lakeMap.toSave() } : {}),
    ...(w.interiors.toSave().length || w.interiors.rep ? { interiors: w.interiors.toSave(), villageRep: w.interiors.rep } : {}),
    killed: [...w.killedEnemies],
    collected: [...w.collectedPickups],
    rhythmRepeats: [...w.rhythmRepeats],
    destroyed: [...w.destroyedProps],
    nomadUsed: w.nomadUsed,
    nomadLost: w.nomadLost,
    bossLivesGiven: w.bossLivesGiven,
    weapons: snap.weapons.map(([id, n]) => [id as string, n === Infinity ? -1 : n]),
    magazines: snap.magazines,
    cur: snap.cur,
    grenades: snap.grenades,
    nomad: snap.nomad,
    stats: { kills: w.stats.kills, deaths: w.stats.deaths, damageTaken: w.stats.damageTaken, dashes: w.stats.dashes, shots: w.stats.shots, pitFalls: w.stats.pitFalls },
    savedAt: Date.now(),
    difficulty: difficultyId(),
  };
}

/** Início limpo de uma fase (usado quando a fase anterior foi concluída). */
export function freshSave(stage: number, score = 0): SaveState {
  return {
    v: 1, stage, checkpointIdx: -1, cpName: 'Início', time: 0, score, tokens: 0, lives: 3, bestCombo: 0,
    emblems: [], secrets: [], secretRooms: [], encounters: [], killed: [], collected: [], destroyed: [],
    nomadUsed: false, nomadLost: stage === 2, bossLivesGiven: false,
    weapons: [], cur: '', grenades: -1, nomad: -1,
    stats: { kills: 0, deaths: 0, damageTaken: 0, dashes: 0, shots: 0, pitFalls: 0 },
    savedAt: Date.now(),
    difficulty: difficultyId(),
  };
}

/** Continua a campanha sem levar IDs e checkpoints de um mapa para o outro. */
export function nextStageSave(w: World, stage: number): SaveState {
  const snap=captureSave(w);
  return { ...freshSave(stage, w.score), tokens: w.tokens, weapons:snap.weapons,magazines:snap.magazines,cur:snap.cur,grenades:snap.grenades };
}

/** Restaura o save num mundo recém-criado e põe o Karimbo no checkpoint. */
export function applySave(w: World, s: SaveState) {
  w.time = s.time;
  w.score = s.score;
  w.tokens = s.tokens;
  w.lives = Math.max(1, s.lives);
  w.bestCombo = s.bestCombo;
  for (const e of s.emblems) w.emblems.add(e);
  for (const e of s.secrets) w.secrets.add(e);
  for (const e of s.secretRooms) w.secretRooms.add(e);
  for (const e of s.encounters ?? []) w.encounters.completed.add(e);
  w.interiors.load(s.interiors, s.villageRep);
  w.lakeMap?.load(s.lakeMap);
  for (const e of s.killed) w.killedEnemies.add(e);
  for (const e of s.collected) w.collectedPickups.add(e);
  const notes = w.data.pickups.filter(p => p.kind === 'note');
  const collectedNotes = notes.filter(p => w.collectedPickups.has(p.id));
  // Legacy saves cannot tell which repeats were collected: credit past notes without
  // granting rewards on load, keeping the remaining challenge achievable.
  const repeats = new Set(s.rhythmRepeats ?? collectedNotes.map(p => p.id));
  for (const p of collectedNotes) if (repeats.has(p.id)) w.rhythmRepeats.add(p.id);
  w.rhythm.got = collectedNotes.length + w.rhythmRepeats.size;
  w.rhythm.done = w.rhythm.total > 0 && w.rhythm.got >= w.rhythm.total;
  for (const e of s.destroyed) w.destroyedProps.add(e);
  w.nomadUsed = s.nomadUsed;
  w.nomadLost = s.nomadLost || w.data.stage === 2;
  w.bossLivesGiven = s.bossLivesGiven;
  Object.assign(w.stats, s.stats);
  const idx = Math.min(s.checkpointIdx, w.data.checkpoints.length - 1);
  w.checkpointIdx = idx;
  if (s.weapons.length) {
    w.checkpointSnap = {
      weapons: s.weapons.map(([id, n]) => [id as WeaponId, n < 0 ? Infinity : n]),
      cur: s.cur as WeaponId,
      grenades: s.grenades,
      magazines: s.magazines as [WeaponId,number][]|undefined,
      nomad: s.nomad,
    };
  } else w.checkpointSnap = null;
  if (idx >= 0) w.blockBehind(idx, false);
  w.respawn();
  // o respawn deixa a munição mínima de perdão; aqui o inventário volta exatamente como estava
  if (w.checkpointSnap) w.player.restore(w.checkpointSnap);
}
