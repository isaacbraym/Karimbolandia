/**
 * Ponto de entrada do módulo de interior (carregado sob demanda por `interiorFlow`). Cada cômodo
 * é um chunk próprio: só baixa o que o jogador está prestes a visitar.
 */
import type { RoomId } from '../interiorStore';
import type { RoomDef } from './types';
export { InteriorSession, type SessionInit, type Outcome, type PointerEv } from './session';
export { InteriorRenderer } from '../../art/interior/renderer';

/** Dados do cômodo + pintores dos móveis (cada um num chunk próprio, baixado só quando preciso). */
export async function loadRoom(id: RoomId): Promise<RoomDef> {
  switch (id) {
    case 'palafita': {
      const [room] = await Promise.all([import('./rooms/palafitaVigia'), import('../../art/interior/paint/palafita')]);
      return room.default;
    }
    case 'benedita': {
      const [room] = await Promise.all([import('./rooms/casaBenedita'), import('../../art/interior/paint/benedita')]);
      return room.default;
    }
    default: {
      const [rooms] = await Promise.all([import('./rooms/community'), import('../../art/interior/paint/community'),
        import('../../art/interior/paint/benedita'), import('../../art/interior/paint/palafita')]);
      return rooms.makeCommunityRoom(id);
    }
  }
}
