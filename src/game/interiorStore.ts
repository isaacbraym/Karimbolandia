/**
 * Estado persistente dos interiores. Fica FORA de `interior/` de propósito: o World e o save o
 * importam estaticamente (é minúsculo), enquanto todo o resto do interior só carrega sob demanda.
 * Cada cômodo guarda um bitmask de flags (≤ 31 bits); a reputação da aldeia vai de −100 a +100.
 */
export type RoomId = 'palafita' | 'benedita' | `home:${number}` | `hut:${number}`;
export const ROOM_IDS: readonly RoomId[] = ['palafita', 'benedita',
  ...Array.from({ length: 29 }, (_, i): RoomId => `home:${i + 1}`), 'hut:1', 'hut:2'];
const VISIT_FLAGS = ['visited', 'keepsake', 'meal', 'water', 'plant', 'rest', 'gift', 'drawer', 'chest', 'karimbado', 'clean'];

/** Ordem = posição do bit. Nunca reordenar: o save grava só o número. */
export const ROOM_FLAGS: Record<RoomId, readonly string[]> = {
  ...Object.fromEntries(ROOM_IDS.filter(id => id.includes(':')).map(id => [id, VISIT_FLAGS])),
  palafita: ['visited', 'panela', 'laces', 'mustache', 'bottle', 'cofre', 'caixa', 'revista', 'karimbado', 'clean', 'caboGone'],
  benedita: ['visited', 'panela', 'bean1', 'bean2', 'bean3', 'cake', 'filter', 'tv', 'tin', 'plant', 'cat', 'nap',
    'piggyStolen', 'piggyBroken', 'dresser', 'chest', 'karimbado', 'clean', 'cabinet', 'hen', 'mirror', 'photos'],
};

export const REP_MIN = -100, REP_MAX = 100;
export const MAX_ROOM_ENTRIES = 64;

const bit = (room: RoomId, flag: string) => {
  const i = ROOM_FLAGS[room].indexOf(flag);
  if (i < 0) throw new Error(`flag desconhecida ${room}:${flag}`);
  return 2 ** i;
};

/** Conjunto de flags de um cômodo, manipulado por nome. */
export class RoomFlags {
  constructor(readonly room: RoomId, public mask = 0) {}
  has(flag: string) { return Math.floor(this.mask / bit(this.room, flag)) % 2 === 1; }
  set(flag: string) { if (!this.has(flag)) this.mask += bit(this.room, flag); }
  clear(flag: string) { if (this.has(flag)) this.mask -= bit(this.room, flag); }
  count() { let n = 0; for (const f of ROOM_FLAGS[this.room]) if (this.has(f)) n++; return n; }
}

export class InteriorStore {
  private masks = new Map<RoomId, number>();
  rep = 0;
  get(room: RoomId): number { return this.masks.get(room) ?? 0; }
  flags(room: RoomId): RoomFlags { return new RoomFlags(room, this.get(room)); }
  has(room: RoomId, flag: string) { return this.flags(room).has(flag); }
  commit(f: RoomFlags) { if (f.mask) this.masks.set(f.room, f.mask); else this.masks.delete(f.room); }
  addRep(n: number) { this.rep = Math.max(REP_MIN, Math.min(REP_MAX, Math.round(this.rep + n))); }
  /** Karimbo está levando a panela apreendida (pegou na palafita e ainda não devolveu). */
  carriesPanela() { return this.has('palafita', 'panela') && !this.has('benedita', 'panela'); }
  clear() { this.masks.clear(); this.rep = 0; }
  toSave(): [string, number][] { return [...this.masks.entries()].filter(([, m]) => m > 0); }
  load(entries: readonly [string, number][] | undefined, rep: number | undefined) {
    this.clear();
    for (const [id, mask] of entries ?? []) if ((ROOM_IDS as readonly string[]).includes(id)) this.masks.set(id as RoomId, mask);
    this.rep = Math.max(REP_MIN, Math.min(REP_MAX, Math.round(rep ?? 0)));
  }
}
