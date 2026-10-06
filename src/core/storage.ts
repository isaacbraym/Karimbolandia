/** Configurações do aparelho; progresso separado por conta, com recuperação local. */
import { profileKey, readStored, writeStored } from './persistence';
import { record, number, integer, ids } from './saveValidation';
import { isSkinId, isLegacySkin, SKINS, type SkinId } from './skinCatalog';
import { validGear } from './gearCatalog';
import { isDifficulty, type DifficultyId } from './difficulty';
import { readGearReceipts, storeGearReceipts } from './gearReceipts';
import { coinTotal, validateCoinLedger, mergeCoinLedgers, readCoinWriters, flushCoinWriter, type CoinLedger } from './coins';

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
  /** boxe no celular: gestos por metade da tela (padrão) ou botões */
  boxControls: 'gestos' | 'botoes';
  narrator: boolean; // voz do narrador da história
  difficulty: DifficultyId; // nível das próximas partidas
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
  coinsLedger?: CoinLedger;
  gear: string[];
  /** relíquias de Atlântida já encontradas (0..4) — permanentes */
  relics: number[];
}

const KEY_S = 'karimbolandia.settings.v1';
const KEY_P = 'karimbolandia.progress.v1';
// Clientes anteriores à loja ainda gravam KEY_P; não podem apagar compras novas.
const KEY_W = 'karimbolandia.wallet.v1';
// Trajes de recompensa (jacaré...) que clientes antigos em cache não conhecem: um cliente antigo
// invalida o perfil INTEIRO se ownedSkins/equippedSkin tiver um id desconhecido (ver validateProgress),
// recai no backup e sobrescreve o perfil. Por isso eles ficam só nesta chave, que nenhum cliente
// antigo lê nem escreve; o perfil principal e o espelho da carteira nunca os contêm.
const KEY_R = 'karimbolandia.rewards.v1';
/** `over` = traje "legado" gravado no perfil principal junto com `equipped` (se mudou depois, o principal vence). */
export interface Rewards { skins: SkinId[]; equipped?: SkinId; over?: SkinId }
export function validateRewards(v: unknown): Rewards | null {
  if (!record(v) || !Array.isArray(v.skins) || v.skins.length > SKINS.length) return null;
  if (!v.skins.every((s) => isSkinId(s) && !isLegacySkin(s)) || new Set(v.skins).size !== v.skins.length) return null;
  if (v.equipped !== undefined && (!isSkinId(v.equipped) || !v.skins.includes(v.equipped))) return null;
  if (v.over !== undefined && (!isSkinId(v.over) || !isLegacySkin(v.over))) return null;
  return { skins: [...v.skins] as SkinId[], ...(v.equipped !== undefined ? { equipped: v.equipped as SkinId } : {}), ...(v.over !== undefined ? { over: v.over as SkinId } : {}) };
}
/** Última skin "legada" vestida (vai para o perfil principal enquanto uma skin de recompensa estiver equipada). */
let lastLegacyEquipped: SkinId = 'classic';
/** Cópia do progresso sem nenhuma skin de recompensa: é o que vai para o perfil principal e para a carteira. */
export function legacyView(p: Progress): Progress {
  const equippedIsLegacy = isLegacySkin(p.equippedSkin);
  if (equippedIsLegacy) lastLegacyEquipped = p.equippedSkin;
  const owned = p.ownedSkins.filter(isLegacySkin);
  const equippedSkin = equippedIsLegacy ? p.equippedSkin : (owned.includes(lastLegacyEquipped) || lastLegacyEquipped === 'classic') ? lastLegacyEquipped : 'classic';
  return { ...p, ownedSkins: owned, equippedSkin };
}
export function rewardsOf(p: Progress): Rewards {
  const view = legacyView(p);
  const skins = p.ownedSkins.filter((s) => !isLegacySkin(s));
  return { skins, ...(!isLegacySkin(p.equippedSkin) ? { equipped: p.equippedSkin } : {}), over: view.equippedSkin };
}

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
  boxControls: 'gestos',
  narrator: true,
  difficulty: 'normal',
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
  coinsLedger: undefined,
  gear: [],
  relics: [],
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
if (!isDifficulty(settings.difficulty)) settings.difficulty = 'normal';
if (settings.boxControls !== 'botoes') settings.boxControls = 'gestos';
export function validateProgress(v: unknown): Progress | null {
  if (!record(v)) return null;
  const p = { ...defaultProgress(), ...v };
  for (const k of ['bestScore', 'bestTime', 'bestEmblems', 'bestSecrets', 'completed'] as const) if (!number(p[k])) return null;
  for (const k of ['bestEmblems', 'bestSecrets', 'completed'] as const) if (!integer(p[k])) return null;
  if (typeof p.dashDiscovered !== 'boolean') return null;
  for (const k of ['emblemsFound', 'secretsFound', 'stagesDone'] as const) if (!ids(p[k])) return null;
  if (!p.stagesDone.every(s => s === 1 || s === 2)) return null;
  if (!integer(p.coinsEarned) || typeof p.coinsMigrated !== 'boolean' || !isSkinId(p.equippedSkin)) return null;
  if (!Array.isArray(p.ownedSkins) || p.ownedSkins.length > SKINS.length - 1 || !p.ownedSkins.every(s => isSkinId(s) && s !== 'classic') || new Set(p.ownedSkins).size !== p.ownedSkins.length) return null;
  if (p.equippedSkin !== 'classic' && !p.ownedSkins.includes(p.equippedSkin)) return null;
  const ledger=p.coinsLedger===undefined?undefined:validateCoinLedger(p.coinsLedger);
  if(ledger===null)return null;
  if(!validGear(p.gear))return null;
  if(!ids(p.relics)||p.relics.some(r=>r>4)||new Set(p.relics).size!==p.relics.length)return null;
  return {
    bestScore: p.bestScore, bestTime: p.bestTime, bestEmblems: p.bestEmblems,
    bestSecrets: p.bestSecrets, completed: p.completed, dashDiscovered: p.dashDiscovered,
    emblemsFound: [...p.emblemsFound], secretsFound: [...p.secretsFound], stagesDone: [...p.stagesDone],
    coinsEarned: p.coinsEarned, coinsMigrated: p.coinsMigrated,
    ownedSkins: [...p.ownedSkins], equippedSkin: p.equippedSkin,
    coinsLedger: ledger,
    gear: [...p.gear],
    relics: [...p.relics],
  };
}
type Wallet = Pick<Progress, 'coinsEarned' | 'coinsMigrated' | 'ownedSkins' | 'equippedSkin' | 'coinsLedger' | 'gear'>;
function validateWallet(v: unknown): Wallet | null {
  if (!record(v)) return null;
  for (const key of ['coinsEarned', 'coinsMigrated', 'ownedSkins', 'equippedSkin']) if (!(key in v)) return null;
  const p = validateProgress({ ...defaultProgress(), ...v });
  return p ? { coinsEarned: p.coinsEarned, coinsMigrated: p.coinsMigrated, ownedSkins: p.ownedSkins, equippedSkin: p.equippedSkin, coinsLedger:p.coinsLedger, gear:p.gear } : null;
}
function readProfileProgress(): Progress | null {
  const p = readStored(profileKey(KEY_P), validateProgress);
  const wallet = readStored(profileKey(KEY_W), validateWallet);
  const records = p ?? defaultProgress();
  const rewards = readStored(profileKey(KEY_R), validateRewards);
  const combined=wallet?mergeProgress(records,{...records,...wallet}):records;
  if (rewards) {
    combined.ownedSkins = [...new Set([...combined.ownedSkins, ...rewards.skins])];
    // vale o traje de recompensa vestido, a menos que o perfil principal tenha mudado de traje depois
    if (rewards.equipped && combined.ownedSkins.includes(rewards.equipped) && combined.equippedSkin === rewards.over) combined.equippedSkin = rewards.equipped;
  }
  const writers=readCoinWriters();
  const receipts=readGearReceipts();
  combined.gear=[...new Set([...combined.gear,...receipts])];
  if(writers)combined.coinsLedger=mergeCoinLedgers(combined.coinsLedger,writers);
  if(combined.coinsLedger)combined.coinsEarned=Math.max(combined.coinsEarned,coinTotal(combined.coinsLedger));
  return p||wallet||writers||receipts.length||rewards?combined:null;
}
export const hasStoredWallet = () => readStored(profileKey(KEY_W), validateWallet) !== null;
export const progress: Progress = readProfileProgress() ?? defaultProgress();
export function reloadProgress() { Object.assign(progress, readProfileProgress() ?? defaultProgress()); }
export function mergeProgress(a: Progress, b: Progress): Progress {
  const times = [a.bestTime, b.bestTime].filter(n => n > 0);
  const union = (x: number[], y: number[]) => [...new Set([...x, ...y])].sort((x, y) => x - y);
  const ledger=mergeCoinLedgers(a.coinsLedger,b.coinsLedger);
  return {
    bestScore: Math.max(a.bestScore, b.bestScore), bestTime: times.length ? Math.min(...times) : 0,
    bestEmblems: Math.max(a.bestEmblems, b.bestEmblems), bestSecrets: Math.max(a.bestSecrets, b.bestSecrets),
    completed: Math.max(a.completed, b.completed), dashDiscovered: a.dashDiscovered || b.dashDiscovered,
    emblemsFound: union(a.emblemsFound, b.emblemsFound), secretsFound: union(a.secretsFound, b.secretsFound),
    stagesDone: union(a.stagesDone, b.stagesDone),
    coinsEarned: Math.max(a.coinsEarned, b.coinsEarned,ledger?coinTotal(ledger):0), coinsMigrated: a.coinsMigrated || b.coinsMigrated,
    coinsLedger:ledger,
    gear: [...new Set([...a.gear,...b.gear])],
    relics: union(a.relics ?? [], b.relics ?? []),
    ownedSkins: [...new Set([...a.ownedSkins, ...b.ownedSkins])], equippedSkin: b.equippedSkin,
  };
}

/** Saves anteriores à loja recebem as fichas da campanha uma única vez. */
export function withLegacyCoins(p: Progress, tokens: number): Progress {
  return p.coinsMigrated ? p : { ...p, coinsMigrated: true, coinsEarned: Math.max(p.coinsEarned, tokens) };
}
export function snapshotProgress(): Progress {
  const stored = readProfileProgress();
  return stored ? mergeProgress(stored, progress) : validateProgress(progress) ?? defaultProgress();
}

export const saveSettings = () => save(KEY_S, settings);
export const saveProgress = () => {
  const coins=flushCoinWriter(progress.coinsLedger);
  // Outra aba pode ter batido um recorde desde que este módulo foi carregado.
  const previous = readProfileProgress();
  if (previous) Object.assign(progress, mergeProgress(previous, progress));
  const gear=storeGearReceipts(progress.gear);
  const view = legacyView(progress);
  const wallet = writeStored(profileKey(KEY_W), validateWallet(view)!, validateWallet);
  const records = writeStored(profileKey(KEY_P), view, validateProgress);
  // só grava a chave de recompensas quando há algo a guardar (ou já existe): perfis sem o traje ficam idênticos aos de antes
  const rw = rewardsOf(progress);
  const rewards = rw.skins.length || readStored(profileKey(KEY_R), validateRewards) ? writeStored(profileKey(KEY_R), rw, validateRewards) : true;
  return coins && gear && wallet && records && rewards;
};
