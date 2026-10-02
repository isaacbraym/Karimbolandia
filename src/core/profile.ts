import { progress, saveProgress, validateProgress, mergeProgress, snapshotProgress, withLegacyCoins, type Progress } from './storage';
import { loadSave, writeSave, clearSave, type SaveState } from '../game/save';
import { validateSave, record } from './saveValidation';
import { profileKey, writeStored } from './persistence';

export const MAX_BACKUP_BYTES = 512_000;
export interface ProfileData { v: 1; progress: Progress; save: SaveState | null }
export interface Backup { game: 'karimbolandia'; version: 1; exportedAt: string; data: ProfileData }
export function captureProfile(): ProfileData {
  const save = loadSave();
  return { v: 1, progress: withLegacyCoins(snapshotProgress(), save?.tokens ?? 0), save };
}
export function validateProfile(value: unknown): ProfileData | null {
  if (!record(value) || value.v !== 1) return null;
  const p = validateProgress(value.progress);
  const s = value.save === null ? null : validateSave(value.save);
  if (!p || (value.save !== null && !s)) return null;
  return { v: 1, progress: withLegacyCoins(p, s?.tokens ?? 0), save: s };
}
export function parseBackup(text: string): ProfileData {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('O arquivo é grande demais para ser um save.');
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('O arquivo não contém um backup válido.'); }
  if (!record(raw) || raw.game !== 'karimbolandia' || raw.version !== 1) throw new Error('Escolha um backup do Karimbolândia (versão 1).');
  const data = validateProfile(raw.data);
  if (!data) throw new Error('O backup está incompleto ou danificado. Seu progresso atual foi mantido.');
  return data;
}
export function exportBackup(data = captureProfile()): string {
  const valid = validateProfile(data);
  if (!valid) throw new Error('Progresso inválido.');
  const backup: Backup = { game: 'karimbolandia', version: 1, exportedAt: new Date().toISOString(), data: valid };
  return JSON.stringify(backup, null, 2);
}
export function applyProfile(data: ProfileData): boolean {
  const valid = validateProfile(data);
  if (!valid) throw new Error('Progresso inválido.');
  // Cópia completa antes de trocar save + recordes; permanece disponível para desfazer.
  const preserved = preserveProfile();
  Object.assign(progress, valid.progress);
  const p = saveProgress();
  const s = valid.save ? writeSave(valid.save) : clearSave();
  return preserved && p && s;
}
export function preserveProfile() {
  return writeStored(profileKey('karimbolandia.before-restore.v1'), captureProfile(), validateProfile);
}
export function hasProgress(data: ProfileData) {
  return !!data.save || data.progress.coinsEarned > 0 || data.progress.ownedSkins.length > 0 || data.progress.bestScore > 0 || data.progress.completed > 0 || data.progress.dashDiscovered || data.progress.stagesDone.length > 0;
}
/** Recordes são monotônicos; fichas/inventário da partida vêm inteiros do save escolhido. */
export function mergeRecords(a: Progress, b: Progress): Progress {
  return mergeProgress(a, b);
}
