/** Registro central de arte: constrói (uma vez) todos os sprites do jogo. */
import { loadPhotos, bakeKarimboHeads, type Photos } from './photo';
import { bakeKarimbo, type KarimboArt } from './karimbo';
import { bakeNomad, type NomadArt } from './nomad';
import { bakeFelipao, type FelipaoArt } from './felipao';
import { bakeSoldier, type SoldierArt, type SoldierStyle } from './soldiers';
import { bakeRobots, type RobotArt } from './robots';
import { bakeTiles, type TileArt } from './tiles';
import { bakeProps, bakePickups } from './props';
import { Background } from './background';
import { setArtScale, type Sprite } from './kit';
import type { PropKind, PickupKind } from '../game/level';

export interface Art {
  photos: Photos;
  karimbo: KarimboArt;
  nomad: NomadArt;
  felipao: FelipaoArt;
  soldiers: Record<SoldierStyle, SoldierArt>;
  robots: RobotArt;
  tiles: TileArt;
  props: Record<PropKind, Sprite>;
  pickups: Record<PickupKind, Sprite>;
  bg: Background;
}

let art: Art | null = null;

export function getArt(): Art {
  if (!art) throw new Error('Arte ainda não carregada');
  return art;
}
export const artReady = () => art !== null;

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export type Quality = 'low' | 'medium' | 'high';

/** Baixa as fotos e "asa" todos os sprites, cedendo ao navegador entre etapas (barra de carregamento). */
export async function buildArt(base: string, quality: Quality, onProgress: (p: number, label: string) => void): Promise<Art> {
  if (art) return art;
  const scale = quality === 'high' ? 3 : quality === 'medium' ? 2 : 2;
  setArtScale(scale);
  onProgress(0.02, 'Baixando personagens...');
  const photos = await loadPhotos(base, (p) => onProgress(0.02 + p * 0.28, 'Baixando personagens...'));
  const steps: [string, () => void][] = [];
  const out: Partial<Art> = { photos };
  steps.push(['Montando Karimbo...', () => {
    const heads = bakeKarimboHeads(photos, quality === 'low' ? 2 : 3);
    out.karimbo = bakeKarimbo(heads);
  }]);
  steps.push(['Ligando o Nômad...', () => { out.nomad = bakeNomad(photos); }]);
  steps.push(['Equipando o Felipão...', () => { out.felipao = bakeFelipao(photos); }]);
  steps.push(['Convocando a Legião...', () => {
    out.soldiers = { rifle: bakeSoldier('rifle'), shotgun: bakeSoldier('shotgun'), shield: bakeSoldier('shield'), jetpack: bakeSoldier('jetpack'), sniper: bakeSoldier('sniper') };
    out.robots = bakeRobots();
  }]);
  steps.push(['Construindo a cidade...', () => { out.tiles = bakeTiles(); }]);
  steps.push(['Espalhando caixas e tesouros...', () => { out.props = bakeProps(); out.pickups = bakePickups(); }]);
  steps.push(['Pintando o horizonte...', () => { out.bg = new Background(quality === 'high' ? 1.5 : quality === 'medium' ? 1.25 : 1); }]);
  for (let i = 0; i < steps.length; i++) {
    onProgress(0.3 + (i / steps.length) * 0.7, steps[i][0]);
    await tick();
    steps[i][1]();
  }
  onProgress(1, 'Pronto!');
  art = out as Art;
  return art;
}
