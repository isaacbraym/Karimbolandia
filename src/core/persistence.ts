/** Escritas raras, com uma cópia anterior e fallback em memória identificável na UI. */
export type PersistenceStatus = 'saved' | 'recovered' | 'volatile';
const memory = new Map<string, string | null>();
const volatile = new Set<string>();
const listeners = new Set<(key: string) => void>();
const recoveredKeys = new Set<string>();
let scope = '';
try { scope = localStorage.getItem('karimbolandia.profile.v1') ?? ''; } catch { /* visitante */ }
if (!/^[a-zA-Z0-9_-]{1,128}$/.test(scope)) scope = '';

export const profileKey = (key: string) => scope ? `${key}.account.${scope}` : key;
export const currentProfile = () => scope;
export function setProfile(uid: string) {
  if (uid && !/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) throw new Error('Conta inválida');
  scope = uid;
  try { localStorage.setItem('karimbolandia.profile.v1', uid); } catch { /* saves continuam em memória */ }
}
export function persistenceStatus(): PersistenceStatus {
  const active = (key: string) => scope ? key.endsWith(`.account.${scope}`) : !key.includes('.account.');
  return [...volatile].some(active) ? 'volatile' : [...recoveredKeys].some(active) ? 'recovered' : 'saved';
}
export function onPersist(fn: (key: string) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
function emit(key: string) { for (const fn of listeners) fn(key); }

export function readStored<T>(key: string, validate: (raw: unknown) => T | null): T | null {
  const parse = (raw: string | null) => raw === null ? null : validate(JSON.parse(raw));
  if (volatile.has(key)) {
    try { return parse(memory.get(key) ?? null); } catch { return null; }
  }
  try {
    const raw = localStorage.getItem(key);
    // Tombstone: excluir uma partida nunca ressuscita a cópia anterior.
    if (raw === 'null') return null;
    if (raw !== null) {
      try {
        const value = parse(raw);
        if (value !== null) { memory.set(key, raw); return value; }
      } catch { /* tenta cópia anterior */ }
    }
    const previous = localStorage.getItem(`${key}.backup`);
    const value = parse(previous);
    if (value !== null) { recoveredKeys.add(key); memory.set(key, previous); }
    return value;
  } catch {
    volatile.add(key);
    try { return parse(memory.get(key) ?? null); } catch { return null; }
  }
}

export function writeStored<T>(key: string, value: T | null, validate: (raw: unknown) => T | null): boolean {
  const raw = JSON.stringify(value);
  let durable = false;
  try {
    const old = localStorage.getItem(key);
    if (old !== raw) {
      // Só promove uma versão válida; um arquivo danificado nunca destrói o backup bom.
      let validOld = false;
      try { validOld = old !== null && validate(JSON.parse(old)) !== null; } catch { /* inválido */ }
      if (validOld) {
        // Se não couber a cópia, ainda tentamos preservar o save principal mais recente.
        try { localStorage.setItem(`${key}.backup`, old!); } catch { /* principal tem prioridade */ }
      }
      localStorage.setItem(key, raw);
    }
    volatile.delete(key);
    recoveredKeys.delete(key);
    durable = true;
  } catch { volatile.add(key); }
  memory.set(key, raw);
  emit(key);
  return durable;
}
