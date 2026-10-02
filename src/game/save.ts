/**
 * Save-state no navegador: a cada checkpoint (e ao terminar uma fase) o progresso da partida vai
 * para o localStorage. Se a rede cair, a aba fechar ou o celular reiniciar, o jogo pergunta ao
 * abrir se quer voltar ao último checkpoint — com pontos, vidas, armas, itens e inimigos já
 * derrotados como estavam.
 */
import type { World } from './world';
import type { WeaponId } from './weapons';

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
  killed: number[];
  collected: number[];
  destroyed: number[];
  nomadUsed: boolean;
  nomadLost: boolean;
  bossLivesGiven: boolean;
  /** inventário no checkpoint (munição infinita gravada como -1) */
  weapons: [string, number][];
  cur: string;
  grenades: number;
  nomad: number;
  stats: { kills: number; deaths: number; damageTaken: number; dashes: number; shots: number; pitFalls: number };
  savedAt: number;
}

export function loadSave(): SaveState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SaveState;
    if (!s || s.v !== 1 || typeof s.stage !== 'number') return null;
    return s;
  } catch {
    return null;
  }
}

export function writeSave(s: SaveState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* modo privado / sem espaço: segue sem salvar */
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
}

/** Fotografa a partida no checkpoint atual. */
export function captureSave(w: World): SaveState {
  const snap = w.checkpointSnap ?? w.player.snapshot();
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
    killed: [...w.killedEnemies],
    collected: [...w.collectedPickups],
    destroyed: [...w.destroyedProps],
    nomadUsed: w.nomadUsed,
    nomadLost: w.nomadLost,
    bossLivesGiven: w.bossLivesGiven,
    weapons: snap.weapons.map(([id, n]) => [id as string, n === Infinity ? -1 : n]),
    cur: snap.cur,
    grenades: snap.grenades,
    nomad: snap.nomad,
    stats: { kills: w.stats.kills, deaths: w.stats.deaths, damageTaken: w.stats.damageTaken, dashes: w.stats.dashes, shots: w.stats.shots, pitFalls: w.stats.pitFalls },
    savedAt: Date.now(),
  };
}

/** Início limpo de uma fase (usado quando a fase anterior foi concluída). */
export function freshSave(stage: number, score = 0): SaveState {
  return {
    v: 1, stage, checkpointIdx: -1, cpName: 'Início', time: 0, score, tokens: 0, lives: 3, bestCombo: 0,
    emblems: [], secrets: [], secretRooms: [], killed: [], collected: [], destroyed: [],
    nomadUsed: false, nomadLost: stage === 2, bossLivesGiven: false,
    weapons: [], cur: '', grenades: -1, nomad: -1,
    stats: { kills: 0, deaths: 0, damageTaken: 0, dashes: 0, shots: 0, pitFalls: 0 },
    savedAt: Date.now(),
  };
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
  for (const e of s.killed) w.killedEnemies.add(e);
  for (const e of s.collected) w.collectedPickups.add(e);
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
      nomad: s.nomad,
    };
  } else w.checkpointSnap = null;
  if (idx >= 0) w.blockBehind(idx, false);
  w.respawn();
  // o respawn deixa a munição mínima de perdão; aqui o inventário volta exatamente como estava
  if (w.checkpointSnap) w.player.restore(w.checkpointSnap);
}
