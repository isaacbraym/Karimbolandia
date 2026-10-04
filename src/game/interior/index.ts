/**
 * Ponto de entrada do módulo de interior (carregado sob demanda por `interiorFlow`). Cada cômodo
 * é um chunk próprio: só baixa o que o jogador está prestes a visitar.
 */
import type { RoomId } from '../interiorStore';
import type { RoomDef } from './types';
export { InteriorSession, type SessionInit, type Outcome, type PointerEv } from './session';
export { InteriorRenderer } from '../../art/interior/renderer';

export async function loadRoom(id: RoomId): Promise<RoomDef> {
  switch (id) {
    case 'palafita': return (await import('./rooms/palafitaVigia')).default;
    case 'benedita': return (await import('./rooms/casaBenedita')).default;
  }
}
