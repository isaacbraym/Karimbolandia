/** Configurações do aparelho; progresso separado por conta, com recuperação local. */
import { profileKey, readStored, writeStored } from './persistence';
import { record, number, integer, ids } from './saveValidation';
import { isSkinId, type SkinId } from './skinCatalog';

export type QualityPref = 'auto' | 'low' | 'medium' | 'high';

export interface Settings {
  music: number; // 0..1
  sfx: number; // 0..1
  quality: QualityPref;
  touchScale: number; // 0.7..1.4
  touchOpacity: number; // 0.2..0.9
  aimAssist: boolean;
  screenShake: boolean;
  showFps: boolean;
  leftHanded: boolean;
  haptics: boolean; // vibração (celular) / rumble (gamepad)
  narrator: boolean; // voz do narrador da história
}

export interface Progress {
  bestScore: number;
  bestTime: number; // segundos (0 = nenhum)
  bestEmblems: number;
  bestSecrets: number;
  completed: number;
  dashDiscovered: boolean; // jogador já descobriu o segundo avanço
  emblemsFound: number[]; // ids do melhor conjunto
  secretsFound: number[];
  /** fases já concluídas (1, 2...) */
  stagesDone: number[];
  coinsEarned: number;
  coinsMigrated: boolean;
  ownedSkins: SkinId[];
  equippedSkin: SkinId;
}

const KEY_S = 'karimbolandia.settings.v1';
const KEY_P = 'karimbolandia.progress.v1';

export const defaultSettings = (): Settings => ({
  music: 0.7,
  sfx: 0.9,
  quality: 'auto',
  touchScale: 1,
  touchOpacity: 0.55,
  aimAssist: true,
  screenShake: true,
  showFps: false,
  leftHanded: false,
  haptics: true,
  narrator: true,
});

export const defaultProgress = (): Progress => ({
  bestScore: 0,
  bestTime: 0,
  bestEmblems: 0,
  bestSecrets: 0,
  completed: 0,
  dashDiscovered: false,
  emblemsFound: [],
  secretsFound: [],
  stagesDone: [],
  coinsEarned: 0,
  coinsMigrated: false,
  ownedSkins: [],
  equippedSkin: 'classic',
});

function load<T extends object>(key: string, def: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return def();
    return { ...def(), ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return def();
  }
}
function save(key: string, v: object) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* modo privado / storage cheio: ignora */
  }
}

export const settings: Settings = load(KEY_S, defaultSettings);
export function validateProgress(v: unknown): Progress | null {
  if (!record(v)) return null;
  const p = { ...defaultProgress(), ...v };
  for (const k of ['bestScore', 'bestTime', 'bestEmblems', 'bestSecrets', 'completed'] as const) if (!number(p[k])) return null;
  for (const k of ['bestEmblems', 'bestSecrets', 'completed'] as const) if (!integer(p[k])) return null;
  if (typeof p.dashDiscovered !== 'boolean') return null;
  for (const k of ['emblemsFound', 'secretsFound', 'stagesDone'] as const) if (!ids(p[k])) return null;
  if (!p.stagesDone.every(s => s === 1 || s === 2)) return null;
  if (!integer(p.coinsEarned) || typeof p.coinsMigrated !== 'boolean' || !isSkinId(p.equippedSkin)) return null;
  if (!Array.isArray(p.ownedSkins) || p.ownedSkins.length > 2 || !p.ownedSkins.every(s => isSkinId(s) && s !== 'classic') || new Set(p.ownedSkins).size !== p.ownedSkins.length) return null;
  if (p.equippedSkin !== 'classic' && !p.ownedSkins.includes(p.equippedSkin)) return null;
  return {
    bestScore: p.bestScore, bestTime: p.bestTime, bestEmblems: p.bestEmblems,
    bestSecrets: p.bestSecrets, completed: p.completed, dashDiscovered: p.dashDiscovered,
    emblemsFound: [...p.emblemsFound], secretsFound: [...p.secretsFound], stagesDone: [...p.stagesDone],
    coinsEarned: p.coinsEarned, coinsMigrated: p.coinsMigrated,
    ownedSkins: [...p.ownedSkins], equippedSkin: p.equippedSkin,
  };
}
export const progress: Progress = readStored(profileKey(KEY_P), validateProgress) ?? defaultProgress();
export function reloadProgress() { Object.assign(progress, readStored(profileKey(KEY_P), validateProgress) ?? defaultProgress()); }
export function mergeProgress(a: Progress, b: Progress): Progress {
  const times = [a.bestTime, b.bestTime].filter(n => n > 0);
  const union = (x: number[], y: number[]) => [...new Set([...x, ...y])].sort((x, y) => x - y);
  return {
    bestScore: Math.max(a.bestScore, b.bestScore), bestTime: times.length ? Math.min(...times) : 0,
    bestEmblems: Math.max(a.bestEmblems, b.bestEmblems), bestSecrets: Math.max(a.bestSecrets, b.bestSecrets),
    completed: Math.max(a.completed, b.completed), dashDiscovered: a.dashDiscovered || b.dashDiscovered,
    emblemsFound: union(a.emblemsFound, b.emblemsFound), secretsFound: union(a.secretsFound, b.secretsFound),
    stagesDone: union(a.stagesDone, b.stagesDone),
    coinsEarned: Math.max(a.coinsEarned, b.coinsEarned), coinsMigrated: a.coinsMigrated || b.coinsMigrated,
    ownedSkins: [...new Set([...a.ownedSkins, ...b.ownedSkins])], equippedSkin: b.equippedSkin,
  };
}

/** Saves anteriores à loja recebem as fichas da campanha uma única vez. */
export function withLegacyCoins(p: Progress, tokens: number): Progress {
  return p.coinsMigrated ? p : { ...p, coinsMigrated: true, coinsEarned: Math.max(p.coinsEarned, tokens) };
}
export function snapshotProgress(): Progress {
  const stored = readStored(profileKey(KEY_P), validateProgress);
  return stored ? mergeProgress(stored, progress) : validateProgress(progress) ?? defaultProgress();
}

export const saveSettings = () => save(KEY_S, settings);
export const saveProgress = () => {
  // Outra aba pode ter batido um recorde desde que este módulo foi carregado.
  const previous = readStored(profileKey(KEY_P), validateProgress);
  if (previous) Object.assign(progress, mergeProgress(previous, progress));
  return writeStored(profileKey(KEY_P), progress, validateProgress);
};
