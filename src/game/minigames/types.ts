/**
 * Contrato dos minijogos carregados sob demanda (boxe e perseguição). SOMENTE TIPOS: ninguém importa
 * este arquivo por valor; o pacote principal só o usa como `import type`.
 */
import type { World, MusicState } from '../world';
import type { ControlState, MiniMode } from '../../core/input';
import type { Quality } from '../../art/index';
import type { DifficultyId } from '../../core/difficulty';

export type MinigameId = 'boxing' | 'chase';
export type TouchMinigameMode = MiniMode;
export interface MinigameResult {
  id: MinigameId; outcome: 'win' | 'lose' | 'abort'; time: number; mistakes: number;
  /** só o boxe: nota S–C da luta e se era a revanche do Campeão */
  grade?: 'S' | 'A' | 'B' | 'C'; champion?: boolean;
}
/** pedidos do mundo ao entrar no minijogo */
export interface MinigameOpts { champion?: boolean }

export interface MinigameContext {
  w: World;
  quality: Quality;
  viewW: number;
  viewH: number;
  difficulty: DifficultyId;
  /** boxe: a revanche contra o Jacaré Campeão */
  champion?: boolean;
  /** retrato borrado do mundo na entrada (assado uma vez pelo fluxo); null se ainda não houve captura */
  backdrop: HTMLCanvasElement | null;
  music: (s: MusicState) => void;
  /** liga o layout de toque do minijogo (null = volta ao normal) */
  touch: (mode: TouchMinigameMode | null) => void;
  /** mostra/esconde o botão ORELHADA! do toque */
  special: (on: boolean, label?: string) => void;
  /** vibração curta (celular) / rumble (controle), respeitando a configuração do jogador */
  haptic?: (strength: number, ms: number) => void;
}

export interface MinigameSession {
  readonly done: boolean;
  /** dt protegido do loop (D04) */
  update(dt: number, ctl: ControlState): void;
  draw(g: CanvasRenderingContext2D, W: number, H: number): void;
  resize(W: number, H: number): void;
  result(): MinigameResult | null;
  /** libera canvases, listeners e clipes */
  dispose(): void;
}

export interface MinigameModule {
  create(ctx: MinigameContext): MinigameSession;
  /** o que precisa estar baixado antes de `create` (fotos, fontes): o fluxo espera esta promessa na tela de carregamento */
  preload?: () => Promise<void>;
}
