import type { Cell } from './grid';
import type { RoomId } from '../interiorStore';
import type { InteriorSim } from './sim';

export type { RoomId, Cell };

export type VerbId =
  | 'examine' | 'open' | 'close' | 'rummage' | 'take' | 'steal' | 'eat' | 'drink' | 'use' | 'sit' | 'lie'
  | 'knock' | 'smash' | 'give' | 'prank' | 'pet' | 'shoo' | 'water' | 'swing' | 'admire';

/** Pose do Karimbo durante uma ação (o renderer traduz em transformações do rig). */
export type Pose = 'idle' | 'eat' | 'sit' | 'lie' | 'take' | 'poke' | 'kick' | 'carry' | 'mirror' | 'pet' | 'sneak';

export interface VerbDef {
  id: VerbId;
  label: string;
  /** intensidade bruta do ruído gerado (0 = silencioso) */
  noise: number;
  /** vermelho no menu: irrita o morador se ele ver */
  hostile?: boolean;
  /** quanto de suspeita/irritação o morador ganha ao ver (padrão 0) */
  irritation?: number;
  /** segundos de animação em que Karimbo fica ocupado */
  time?: number;
  pose?: Pose;
  /** executa o efeito. O simulador já gerou o ruído, a testemunha e a animação. */
  run(s: InteriorSim, f: FurnitureDef): void;
}

export interface FurnitureDef {
  id: string;
  name: string;
  /** chave do pintor procedural (src/art/interior/furniture.ts) */
  paint: string;
  gx: number; gy: number; w: number; h: number;
  /** bloqueia a visão (armário, estante) e vira raio-X quando está na frente do Karimbo */
  tall?: boolean;
  /** false = tapete/rede de chão: dá para pisar */
  solid?: boolean;
  /** altura visual aproximada em px para o raio-X e a ordenação */
  height?: number;
  /** célula onde Karimbo deve ficar para usar (padrão: vizinha livre mais próxima) */
  stand?: Cell;
  verbs(s: InteriorSim, f: FurnitureDef): VerbDef[];
}

export interface PrankDef {
  id: string;
  label: string;
  /** extra: não conta para o KARIMBADO!, rende estrela dourada */
  bonus?: boolean;
  done(s: InteriorSim): boolean;
}

export interface Npc {
  id: string;
  name: string;
  brain: Brain;
  gx: number; gy: number;
  /** direção de chão em que olha (unitária) */
  dx: number; dy: number;
  facing: 1 | -1;
  state: string;
  /** segundos no estado atual */
  t: number;
  /** medidor principal: sono (0–100) no mercenário, suspeita (0–100) na moradora */
  meter: number;
  mark: '' | '?' | '!' | 'zzz' | '...';
  markT: number;
  path: Cell[];
  speed: number;
  /** fora do cômodo (não desenhar nem perceber) */
  away: boolean;
  /** animação de caminhada */
  walk: number;
  /** espaço livre para o cérebro guardar números */
  data: Record<string, number>;
}

export interface NpcDef {
  id: string; name: string; gx: number; gy: number; dx?: number; dy?: number;
  brain: Brain;
  /** estado inicial */
  state: string;
  meter?: number;
  away?: boolean;
}

export interface Brain {
  update(s: InteriorSim, n: Npc, dt: number): void;
  /** ruído percebido (já com distância e parede aplicados) */
  hear?(s: InteriorSim, n: Npc, perceived: number, at: Cell): void;
  /** o jogador fez `verb` em `f` e este NPC estava vendo */
  witness?(s: InteriorSim, n: Npc, act: ActInfo): void;
  /** olhos abertos? (dormindo não vê) */
  sees?(n: Npc): boolean;
  /** a cena acabou: o cérebro pode pedir saídas especiais */
  onExit?(s: InteriorSim, reason: ExitReason): void;
}

export interface ActInfo { verb: VerbDef; f: FurnitureDef; seen: boolean }

export interface Trace { fid: string; irritation: number; line: string; discovered: boolean; flag?: string }

export type ExitReason = 'door' | 'escape' | 'caught' | 'expelled';

export type FxKind = 'crash' | 'crumbs' | 'feathers' | 'dust' | 'splash' | 'sparkle' | 'heart' | 'zzz' | 'coins' | 'steam' | 'poof';

export type InteriorEvent =
  | { type: 'say'; who: string; text: string; ttl: number }
  | { type: 'ring'; gx: number; gy: number; power: number }
  | { type: 'fx'; kind: FxKind; gx: number; gy: number; n?: number }
  | { type: 'sfx'; name: string; vol?: number }
  | { type: 'shake'; mag: number; dur: number }
  | { type: 'legacy'; obj: string }
  | { type: 'heal'; n: number }
  | { type: 'coins'; n: number }
  | { type: 'rep'; delta: number; total: number }
  | { type: 'prank'; id: string; label: string }
  | { type: 'karimbado'; gold: boolean }
  | { type: 'banner'; title: string; sub: string }
  | { type: 'alert'; npc: string }
  | { type: 'hurt'; dmg: number }
  | { type: 'exit'; reason: ExitReason; alerted: boolean };

export interface RoomDef {
  id: RoomId;
  title: string;
  subtitle: string;
  theme: 'stilt' | 'house';
  rows: readonly string[];
  /** célula de piso diante da porta: pisar aqui sai do cômodo */
  door: Cell;
  spawn: Cell;
  furniture: readonly FurnitureDef[];
  npcs: readonly NpcDef[];
  pranks: readonly PrankDef[];
  /** itens carregados (bolso) para a UI */
  pocket?(s: InteriorSim): { id: string; label: string }[];
  /** chamado ao entrar (primeira visita, falas iniciais, ajustes por reputação/missões) */
  onEnter?(s: InteriorSim): void;
  /** chamado ao sair, antes de gravar */
  onLeave?(s: InteriorSim, reason: ExitReason): void;
  /** zona "privada": a moradora fica mais desconfiada se Karimbo estiver aqui */
  isPrivate?(c: Cell): boolean;
}

/** Pedido de menu para a UI: já resolvido (ruído em ondas, testemunha, hostilidade). */
export interface VerbView { id: VerbId; label: string; waves: 0 | 1 | 2 | 3; witness: boolean; hostile: boolean }
