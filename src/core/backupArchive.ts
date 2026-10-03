/** Arquivo portátil de recuperação. Não remove nem altera nenhuma partida. */
import { captureProfile, parseBackup, validateProfile, type ProfileData } from './profile';
import { profileKey, readStored } from './persistence';
import { record } from './saveValidation';
import { listSaveCopies } from '../game/saveSession';

export const MAX_ARCHIVE_BYTES = 8_000_000;
const MAX_ENTRIES = 1000;
export interface BackupChoice { kind: 'current' | 'copy' | 'previous'; data: ProfileData }

function checkSize(text: string) {
  if (text.length > MAX_ARCHIVE_BYTES || new TextEncoder().encode(text).length > MAX_ARCHIVE_BYTES) {
    throw new Error('Arquivo grande demais. Use os backups individuais das partidas.');
  }
}
export function exportAllBackups(): string {
  const current = captureProfile();
  const entries: BackupChoice[] = [{ kind: 'current', data: current }];
  for (const copy of listSaveCopies()) entries.push({ kind: 'copy', data: { ...current, save: copy.save } });
  const previous = readStored(profileKey('karimbolandia.before-restore.v1'), validateProfile);
  if (previous) entries.push({ kind: 'previous', data: previous });
  if (entries.length > MAX_ENTRIES) throw new Error('Há muitas partidas para um arquivo só. Baixe os backups individuais.');
  for (const entry of entries) {
    const valid = validateProfile(entry.data);
    if (!valid) throw new Error('Uma partida não pôde ser validada. Seu progresso foi mantido.');
    entry.data = valid;
  }
  const text = JSON.stringify({ game: 'karimbolandia', version: 2, kind: 'archive', exportedAt: new Date().toISOString(), entries }, null, 2);
  checkSize(text);
  return text;
}
/** Valida o arquivo inteiro antes de disponibilizar qualquer opção de restauração. */
export function parseBackupChoices(text: string): BackupChoice[] {
  checkSize(text);
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('O arquivo não contém um backup válido.'); }
  if (record(raw) && raw.game === 'karimbolandia' && raw.version === 1) {
    return [{ kind: 'current', data: parseBackup(text) }];
  }
  if (!record(raw) || raw.game !== 'karimbolandia' || raw.version !== 2 || raw.kind !== 'archive'
    || !Array.isArray(raw.entries) || !raw.entries.length || raw.entries.length > MAX_ENTRIES) {
    throw new Error('Escolha um backup ou arquivo de partidas do Karimbolândia.');
  }
  const entries: BackupChoice[] = [];
  for (const entry of raw.entries) {
    if (!record(entry) || typeof entry.kind !== 'string' || !['current', 'copy', 'previous'].includes(entry.kind)) {
      throw new Error('O arquivo de partidas está incompleto ou danificado. Seu progresso foi mantido.');
    }
    const data = validateProfile(entry.data);
    if (!data) throw new Error('Uma partida do arquivo está danificada. Seu progresso foi mantido.');
    entries.push({ kind: entry.kind as BackupChoice['kind'], data });
  }
  return entries;
}
