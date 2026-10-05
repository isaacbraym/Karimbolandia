import { progress, saveProgress, snapshotProgress, withLegacyCoins, hasStoredWallet, type Progress } from './storage';
import { loadSave } from '../game/save';
import { isSkinId, skinInfo, skinPrice, type SkinId } from './skinCatalog';
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
export type SkinResult = 'bought' | 'equipped' | 'insufficient' | 'invalid' | 'volatile' | 'locked';
/**
 * Entrega um traje de recompensa (preço 0, o saldo de moedas nunca muda). Devolve false se já era seu.
 * `source`: onde veio ('boxing' = venceu o jacaré; 'relics' = as 5 relíquias de Atlântida).
 */
export function grantSkin(id: SkinId, source: 'boxing' | 'relics'): boolean {
  if (!isSkinId(id) || skinInfo(id).shop !== source) return false;
  ensureWallet();
  if (id === 'classic' || progress.ownedSkins.includes(id)) return false;
  progress.ownedSkins.push(id);
  saveProgress();
  return true;
}
/**
 * Equipa (ou compra e equipa) um traje. O traje de mergulho só se compra com o Sivirino
 * (`from = 'sivirino'`); o Atlante não se compra: é liberado pelas relíquias de Atlântida.
 */
export function chooseSkin(id: SkinId, from: 'skins' | 'sivirino' = 'skins'): SkinResult {
  if (!isSkinId(id)) return 'invalid';
  ensureWallet();
  const owned = id === 'classic' || progress.ownedSkins.includes(id);
  const shop = skinInfo(id).shop;
  if (!owned && (shop === 'relics' || shop === 'boxing' || shop === 'sivirino' && from !== 'sivirino')) return 'locked';
  if (!owned && coinBalance() < skinPrice(id)) return 'insufficient';
  if (!owned) progress.ownedSkins.push(id);
  progress.equippedSkin = id;
  return saveProgress() ? owned ? 'equipped' : 'bought' : 'volatile';
}
