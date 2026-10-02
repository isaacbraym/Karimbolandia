/** Uma partida nunca perde sua cópia para o autosave de outra aba. */
import { profileKey, readStored, storedKeys, writeStored } from '../core/persistence';
import { validateSave } from '../core/saveValidation';
import { clearSave, loadSave, writeSave, type SaveState } from './save';

const ROOT = 'karimbolandia.partidas.v1.';
let serial = 0;
const fingerprint = (save: SaveState | null) => JSON.stringify(save);
export interface SaveCopy { key: string; save: SaveState }
export interface SaveResult { durable: boolean; conflict: boolean }

export class SaveSession {
  private readonly profile = profileKey('karimbolandia.save.v1');
  private readonly key = profileKey(`${ROOT}${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${++serial}`);
  private expected: string;
  private conflicted = false;

  constructor(base: SaveState | null = loadSave()) {
    this.expected = fingerprint(base);
  }

  write(value: SaveState | null): SaveResult {
    const save = value === null ? null : validateSave(value);
    if (value !== null && !save) return { durable: false, conflict: this.conflicted };
    // Chave independente ANTES de comparar: localStorage não oferece CAS atômico.
    const copied = writeStored(this.key, save, validateSave);
    if (this.profile !== profileKey('karimbolandia.save.v1') || fingerprint(loadSave()) !== this.expected) this.conflicted = true;
    if (this.conflicted || !copied) return { durable: copied, conflict: this.conflicted };
    const durable = save ? writeSave(save) : clearSave();
    // writeStored mantém o novo valor em memória mesmo se a gravação física falhar.
    this.expected = fingerprint(save);
    return { durable, conflict: false };
  }
}

/** Só mostra partidas diferentes da principal; cada escritor mantém a sua última cópia. */
export function listSaveCopies(): SaveCopy[] {
  const main = loadSave();
  const comparable = (s: SaveState | null) => s ? JSON.stringify({ ...s, savedAt: 0 }) : 'null';
  const seen = new Set([comparable(main)]);
  const suffix = profileKey('') || '';
  const copies: SaveCopy[] = [];
  for (const key of storedKeys(ROOT)) {
    const id = key.slice(ROOT.length);
    if (suffix ? !id.endsWith(suffix) : id.includes('.account.')) continue;
    const stem = suffix ? id.slice(0, -suffix.length) : id;
    if (!/^[a-z0-9-]{1,100}$/.test(stem)) continue;
    const save = readStored(key, validateSave);
    if (save) copies.push({ key, save });
  }
  return copies.sort((a, b) => b.save.savedAt - a.save.savedAt).filter(({ save }) => {
    const value = comparable(save);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
