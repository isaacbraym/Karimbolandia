import { currentProfile } from './persistence';

export type StorageUsage = { available: true; totalBytes: number; profileBytes: number } | { available: false };
// Dados de conta; configurações, seleção de perfil e atualização são globais.
const profileRoots = [
  'progress.v1', 'wallet.v1', 'save.v1', 'before-restore.v1', 'cloud-base.v1',
];
const profilePrefixes = ['partidas.v1.', 'coin-writers.v2.', 'gear.v1.'];
const root = 'karimbolandia.';

/** Estimativa UTF-16 das chaves e valores físicos, incluindo backups.
 * Só consultar ao abrir/atualizar o menu: não mede quota nem espaço livre.
 * Não usa readStored, pois uma leitura de diagnóstico não deve reparar saves.
 */
export function storageUsage(profile = currentProfile()): StorageUsage {
  try {
    const disk = localStorage;
    let totalBytes = 0, profileBytes = 0;
    const seen = new Set<string>();
    const length = disk.length;
    for (let i = 0; i < length; i++) {
      const key = disk.key(i);
      if (!key?.startsWith(root) || seen.has(key)) continue;
      seen.add(key);
      const value = disk.getItem(key);
      if (value === null) continue; // Outra aba pode remover uma chave durante a leitura.
      const bytes = (key.length + value.length) * 2;
      totalBytes += bytes;
      const original = key.endsWith('.backup') ? key.slice(0, -7) : key;
      const suffix = profile ? `.account.${profile}` : '';
      if (suffix ? !original.endsWith(suffix) : original.includes('.account.')) continue;
      const name = original.slice(root.length, suffix ? -suffix.length : undefined);
      if (profileRoots.includes(name) || profilePrefixes.some(prefix => name.startsWith(prefix))) profileBytes += bytes;
    }
    return { available: true, totalBytes, profileBytes };
  } catch {
    // Uma leitura parcial não representa o total; nunca exibir zero como sucesso.
    return { available: false };
  }
}
