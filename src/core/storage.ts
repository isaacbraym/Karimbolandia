/** Configurações e progresso persistidos em localStorage (com fallback silencioso). */

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
export const progress: Progress = load(KEY_P, defaultProgress);

export const saveSettings = () => save(KEY_S, settings);
export const saveProgress = () => save(KEY_P, progress);
