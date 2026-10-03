import { progress, saveProgress, snapshotProgress, withLegacyCoins, hasStoredWallet, type Progress } from './storage';
import { loadSave } from '../game/save';
import { isSkinId, skinPrice, type SkinId } from './skinCatalog';
import { addCoin } from './coins';
import { gearCost } from './gearCatalog';

/** Preços únicos: uma skin comprada nunca cobra de novo, nem ao restaurar um backup antigo. */
export function coinBalance(p: Progress = progress): number {
  let spent = gearCost(p.gear);
  for (let i = 0; i < p.ownedSkins.length; i++) spent += skinPrice(p.ownedSkins[i]);
  return Math.max(0, p.coinsEarned - spent);
}
export function ensureWallet() {
  Object.assign(progress, snapshotProgress());
  if (!progress.coinsMigrated) {
    Object.assign(progress, withLegacyCoins(progress, loadSave()?.tokens ?? 0));
    saveProgress();
  } else if (!hasStoredWallet()) saveProgress();
}
/** Só muda contadores em memória; checkpoint, pausa e autosave fazem a gravação. */
export function collectCoin() {
  if (!progress.coinsMigrated) ensureWallet();
  addCoin(progress);
}
export type SkinResult = 'bought' | 'equipped' | 'insufficient' | 'invalid' | 'volatile';
export function chooseSkin(id: SkinId): SkinResult {
  if (!isSkinId(id)) return 'invalid';
  ensureWallet();
  const owned = id === 'classic' || progress.ownedSkins.includes(id);
  if (!owned && coinBalance() < skinPrice(id)) return 'insufficient';
  if (!owned) progress.ownedSkins.push(id);
  progress.equippedSkin = id;
  return saveProgress() ? owned ? 'equipped' : 'bought' : 'volatile';
}
